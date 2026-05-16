import type { CapabilityTokenPayload, PaymentIntentPayload, VerifyDelegationResult } from './types.js';
import { amountLte } from './core/decimal.js';
import {
  ARTIFACT_TYPE,
  DELEGATION_VERDICT,
  DEFAULT_CLOCK_SKEW_SECONDS,
  DPP_VERSION,
  VERIFICATION_REASON,
} from './constants.js';

function nowUnix(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Offline-style verification of a capability payload against a payment intent.
 * Callers MUST validate JWS signatures and issuer trust before relying on this result.
 */
export function verifyDelegation(input: {
  readonly capability: CapabilityTokenPayload;
  readonly paymentIntent: PaymentIntentPayload;
  readonly clockSkewSeconds?: number;
}): VerifyDelegationResult {
  const reasons: string[] = [];
  const skew = input.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS;
  const cap = input.capability;
  const pi = input.paymentIntent;

  if (cap.dpp !== DPP_VERSION || cap.typ !== ARTIFACT_TYPE.CAPABILITY) {
    reasons.push(VERIFICATION_REASON.CAPABILITY_UNSUPPORTED_TYPE);
  }
  if (pi.dpp !== DPP_VERSION || pi.typ !== ARTIFACT_TYPE.PAYMENT_INTENT) {
    reasons.push(VERIFICATION_REASON.INTENT_UNSUPPORTED_TYPE);
  }

  const exp = cap.exp;
  if (typeof exp !== 'number' || exp < nowUnix() - skew) {
    reasons.push(VERIFICATION_REASON.CAPABILITY_EXPIRED);
  }
  if (cap.nbf !== undefined && cap.nbf > nowUnix() + skew) {
    reasons.push(VERIFICATION_REASON.CAPABILITY_NOT_YET_VALID);
  }

  if (!cap.constraints.merchantAllowlist.includes(pi.merchantId)) {
    reasons.push(VERIFICATION_REASON.INTENT_MERCHANT_NOT_ALLOWLISTED);
  }

  if (pi.amount.currency !== cap.constraints.maxAmount.currency) {
    reasons.push(VERIFICATION_REASON.INTENT_CURRENCY_MISMATCH);
  } else {
    try {
      if (!amountLte(pi.amount.value, cap.constraints.maxAmount.value)) {
        reasons.push(VERIFICATION_REASON.INTENT_AMOUNT_EXCEEDS_MAX);
      }
    } catch {
      reasons.push(VERIFICATION_REASON.INTENT_INVALID_AMOUNT);
    }
  }

  const methods = cap.constraints.paymentMethods;
  if (methods?.length && !methods.includes(pi.rail)) {
    reasons.push(VERIFICATION_REASON.INTENT_RAIL_NOT_PERMITTED);
  }

  if (cap.intentBind !== undefined && cap.intentBind !== pi.digest.value) {
    reasons.push(VERIFICATION_REASON.INTENT_DIGEST_MISMATCH);
  }

  if (reasons.length === 0) {
    return { verdict: DELEGATION_VERDICT.VALID, reasons: [] };
  }
  return { verdict: DELEGATION_VERDICT.INVALID, reasons };
}
