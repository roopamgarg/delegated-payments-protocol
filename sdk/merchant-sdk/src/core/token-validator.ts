import type { CapabilityTokenPayload, PaymentIntentPayload, VerifyDelegationResult } from '../types.js';
import { verifyDelegation } from '../verify.js';
import { verifyCapabilityJws, type JwsTrustConfig } from '../crypto/jws.js';
import { DPPError } from '../errors.js';
import { DELEGATION_VERDICT, DPP_ERROR_CODE } from '../constants.js';

export type ValidateDelegationInput = {
  readonly capabilityToken: string;
  readonly paymentIntent: PaymentIntentPayload;
  readonly trust: JwsTrustConfig;
  readonly clockSkewSeconds?: number;
};

export type ValidateDelegationResult = VerifyDelegationResult & {
  readonly capability: CapabilityTokenPayload;
};

/**
 * Verify JWS signature + issuer trust, then run offline delegation checks.
 */
export async function validateDelegation(
  input: ValidateDelegationInput,
): Promise<ValidateDelegationResult> {
  const capability = await verifyCapabilityJws(input.capabilityToken, input.trust, {
    idempotencyKey: input.paymentIntent.idempotencyKey,
  });
  const result = verifyDelegation({
    capability,
    paymentIntent: input.paymentIntent,
    clockSkewSeconds: input.clockSkewSeconds ?? input.trust.clockSkewSeconds,
    requiredScopes: input.trust.requiredScopes,
  });

  if (result.verdict === DELEGATION_VERDICT.INVALID) {
    throw new DPPError(DPP_ERROR_CODE.DELEGATION_INVALID, result.reasons.join(','), {
      reasons: result.reasons,
    });
  }

  return { ...result, capability };
}
