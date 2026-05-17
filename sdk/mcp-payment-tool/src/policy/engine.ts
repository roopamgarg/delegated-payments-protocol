import type { DelegationRecordMeta } from 'dpp-agent-vault';
import { amountLte, assertValidAmount } from './amount.js';
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
    violations.push('amount_invalid');
    return violations;
  }

  if (intent.amount.currency !== policy.maxAmount.currency) {
    violations.push('currency_mismatch');
  } else {
    try {
      if (!amountLte(intent.amount.value, policy.maxAmount.value)) {
        violations.push('amount_exceeds_max');
      }
    } catch {
      violations.push('amount_invalid');
    }
  }

  if (!policy.merchantAllowlist.includes(intent.merchantId)) {
    violations.push('merchant_not_allowlisted');
  }

  if (!policy.paymentMethods.includes(intent.rail)) {
    violations.push('rail_not_allowed');
  }

  return violations;
}

export function evaluatePreviewPaymentPolicy(input: {
  readonly policy: DelegationPolicy;
  readonly delegation: DelegationRecordMeta;
  readonly intent: PreviewPolicyInput['intent'];
}): PolicyDecision {
  if (input.delegation.status !== 'active') {
    return deny(['delegation_revoked'], 'Delegation is not active — re-link with link_wallet.');
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
  if (input.delegation.status !== 'active') {
    return deny(['delegation_revoked'], 'Delegation is not active — re-link with link_wallet.');
  }

  const violations = checkIntentAgainstPolicy(input.policy, input.intent);
  const createdAtMs = Date.parse(input.previewCreatedAt);
  if (Number.isNaN(createdAtMs)) {
    violations.push('preview_expired');
  } else {
    const ageSeconds = (Date.now() - createdAtMs) / 1000;
    if (ageSeconds > input.policy.previewMaxAgeSeconds) {
      violations.push('preview_expired');
    }
  }

  if (violations.length > 0) {
    return deny(violations, formatPolicyMessage(violations));
  }

  return { allowed: true };
}

export function policyDeniedToolPayload(decision: Extract<PolicyDecision, { allowed: false }>) {
  return {
    status: 'error' as const,
    code: 'policy_denied' as const,
    policyViolations: [...decision.violations],
    message: decision.message,
  };
}

function formatPolicyMessage(violations: readonly PolicyViolation[]): string {
  if (violations.includes('amount_exceeds_max')) {
    return 'Payment amount exceeds delegated maximum.';
  }
  if (violations.includes('merchant_not_allowlisted')) {
    return 'Merchant is not on the delegation allowlist.';
  }
  if (violations.includes('rail_not_allowed')) {
    return 'Payment rail is not permitted for this delegation.';
  }
  if (violations.includes('preview_expired')) {
    return 'Payment preview expired — call preview_payment again before confirm_payment.';
  }
  if (violations.includes('currency_mismatch')) {
    return 'Payment currency does not match delegation policy.';
  }
  return 'Payment blocked by server policy.';
}
