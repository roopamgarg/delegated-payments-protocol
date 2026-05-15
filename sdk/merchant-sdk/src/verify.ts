import type { CapabilityTokenPayload, PaymentIntentPayload, VerifyDelegationResult } from './types.js';

/**
 * Compare two non-negative decimal strings without floating point.
 * v0.1 limitation: assumes no exponential notation; production code should use a decimal library.
 */
function decimalStringLte(value: string, max: string): boolean {
  const norm = (s: string): string[] => {
    const [whole, frac = ''] = s.split('.');
    const w = whole.replace(/^0+/, '') || '0';
    return [w, frac.replace(/0+$/, '')];
  };
  const [vw, vf] = norm(value);
  const [mw, mf] = norm(max);
  if (vw.length !== mw.length) return vw.length < mw.length;
  if (vw !== mw) return vw < mw;
  const a = vf.padEnd(8, '0');
  const b = mf.padEnd(8, '0');
  return a <= b;
}

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
  } else if (!decimalStringLte(pi.amount.value, cap.constraints.maxAmount.value)) {
    reasons.push('intent:amount_exceeds_max');
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
