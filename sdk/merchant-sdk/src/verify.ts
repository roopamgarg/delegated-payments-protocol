import type { CapabilityTokenPayload, PaymentIntentPayload, VerifyDelegationResult } from './types.js';
import { amountLte } from './core/decimal.js';

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
  const skew = input.clockSkewSeconds ?? 60;
  const cap = input.capability;
  const pi = input.paymentIntent;

  if (cap.dpp !== '0.1' || cap.typ !== 'capability') {
    reasons.push('capability:unsupported_type');
  }
  if (pi.dpp !== '0.1' || pi.typ !== 'payment_intent') {
    reasons.push('intent:unsupported_type');
  }

  const exp = cap.exp;
  if (typeof exp !== 'number' || exp < nowUnix() - skew) {
    reasons.push('capability:expired');
  }
  if (cap.nbf !== undefined && cap.nbf > nowUnix() + skew) {
    reasons.push('capability:not_yet_valid');
  }

  if (!cap.constraints.merchantAllowlist.includes(pi.merchantId)) {
    reasons.push('intent:merchant_not_allowlisted');
  }

  if (pi.amount.currency !== cap.constraints.maxAmount.currency) {
    reasons.push('intent:currency_mismatch');
  } else {
    try {
      if (!amountLte(pi.amount.value, cap.constraints.maxAmount.value)) {
        reasons.push('intent:amount_exceeds_max');
      }
    } catch {
      reasons.push('intent:invalid_amount');
    }
  }

  const methods = cap.constraints.paymentMethods;
  if (methods?.length && !methods.includes(pi.rail)) {
    reasons.push('intent:rail_not_permitted');
  }

  if (cap.intentBind !== undefined && cap.intentBind !== pi.digest.value) {
    reasons.push('intent:digest_mismatch');
  }

  if (reasons.length === 0) {
    return { verdict: 'delegation_valid', reasons: [] };
  }
  return { verdict: 'delegation_invalid', reasons };
}
