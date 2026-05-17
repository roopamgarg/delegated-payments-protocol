import { DELEGATION_STATUS, type DelegationRecordMeta } from 'dpp-agent-vault';
import { amountLte, assertValidAmount } from './amount.js';
import { MCP_TOOL_CODE, MCP_TOOL_STATUS, POLICY_VIOLATION } from './constants.js';
import type {
  ConfirmPolicyInput,
  DelegationPolicy,
  PolicyDecision,
  PolicyViolation,
  PreviewPolicyInput,
} from './types.js';

function deny(violations: PolicyViolation[], message: string): PolicyDecision {
  return { allowed: false, violations, message };
}

function checkIntentAgainstPolicy(
  policy: DelegationPolicy,
  intent: PreviewPolicyInput['intent'],
): PolicyViolation[] {
  const violations: PolicyViolation[] = [];

  try {
    assertValidAmount(intent.amount.value);
  } catch {
    violations.push(POLICY_VIOLATION.AMOUNT_INVALID);
    return violations;
  }

  if (intent.amount.currency !== policy.maxAmount.currency) {
    violations.push(POLICY_VIOLATION.CURRENCY_MISMATCH);
  } else {
    try {
      if (!amountLte(intent.amount.value, policy.maxAmount.value)) {
        violations.push(POLICY_VIOLATION.AMOUNT_EXCEEDS_MAX);
      }
    } catch {
      violations.push(POLICY_VIOLATION.AMOUNT_INVALID);
    }
  }

  if (!policy.merchantAllowlist.includes(intent.merchantId)) {
    violations.push(POLICY_VIOLATION.MERCHANT_NOT_ALLOWLISTED);
  }

  if (!policy.paymentMethods.includes(intent.rail)) {
    violations.push(POLICY_VIOLATION.RAIL_NOT_ALLOWED);
  }

  return violations;
}

export function evaluatePreviewPaymentPolicy(input: {
  readonly policy: DelegationPolicy;
  readonly delegation: DelegationRecordMeta;
  readonly intent: PreviewPolicyInput['intent'];
}): PolicyDecision {
  if (input.delegation.status !== DELEGATION_STATUS.ACTIVE) {
    return deny(
      [POLICY_VIOLATION.DELEGATION_REVOKED],
      'Delegation is not active — re-link with link_wallet.',
    );
  }

  const violations = checkIntentAgainstPolicy(input.policy, input.intent);
  if (violations.length > 0) {
    return deny(violations, formatPolicyMessage(violations));
  }

  return { allowed: true };
}

export function evaluateConfirmPaymentPolicy(input: {
  readonly policy: DelegationPolicy;
  readonly delegation: DelegationRecordMeta;
  readonly intent: ConfirmPolicyInput['intent'];
  readonly previewCreatedAt: string;
}): PolicyDecision {
  if (input.delegation.status !== DELEGATION_STATUS.ACTIVE) {
    return deny(
      [POLICY_VIOLATION.DELEGATION_REVOKED],
      'Delegation is not active — re-link with link_wallet.',
    );
  }

  const violations = checkIntentAgainstPolicy(input.policy, input.intent);
  const createdAtMs = Date.parse(input.previewCreatedAt);
  if (Number.isNaN(createdAtMs)) {
    violations.push(POLICY_VIOLATION.PREVIEW_EXPIRED);
  } else {
    const ageSeconds = (Date.now() - createdAtMs) / 1000;
    if (ageSeconds > input.policy.previewMaxAgeSeconds) {
      violations.push(POLICY_VIOLATION.PREVIEW_EXPIRED);
    }
  }

  if (violations.length > 0) {
    return deny(violations, formatPolicyMessage(violations));
  }

  return { allowed: true };
}

export function policyDeniedToolPayload(decision: Extract<PolicyDecision, { allowed: false }>) {
  return {
    status: MCP_TOOL_STATUS.ERROR,
    code: MCP_TOOL_CODE.POLICY_DENIED,
    policyViolations: [...decision.violations],
    message: decision.message,
  };
}

function formatPolicyMessage(violations: readonly PolicyViolation[]): string {
  if (violations.includes(POLICY_VIOLATION.AMOUNT_EXCEEDS_MAX)) {
    return 'Payment amount exceeds delegated maximum.';
  }
  if (violations.includes(POLICY_VIOLATION.MERCHANT_NOT_ALLOWLISTED)) {
    return 'Merchant is not on the delegation allowlist.';
  }
  if (violations.includes(POLICY_VIOLATION.RAIL_NOT_ALLOWED)) {
    return 'Payment rail is not permitted for this delegation.';
  }
  if (violations.includes(POLICY_VIOLATION.PREVIEW_EXPIRED)) {
    return 'Payment preview expired — call preview_payment again before confirm_payment.';
  }
  if (violations.includes(POLICY_VIOLATION.CURRENCY_MISMATCH)) {
    return 'Payment currency does not match delegation policy.';
  }
  return 'Payment blocked by server policy.';
}
