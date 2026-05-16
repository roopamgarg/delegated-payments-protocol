import * as jose from 'jose';
import type { JSONWebKeySet } from 'jose';
import type { CapabilityTokenPayload } from '../types.js';
import { DPPError } from '../errors.js';

/** Claims that MUST be rejected per verification-flows.md §6. */
const FORBIDDEN_CLAIMS = [
  'dpp:otpBypass',
  'dpp:scaSatisfied',
  'dpp:userPresentProof',
] as const;

export type JwsTrustConfig = {
  /** JWKS document URL for the wallet issuer. */
  readonly jwksUri?: string;
  /** Inline JWKS (testing or pinned keys). */
  readonly jwks?: JSONWebKeySet;
  /** Allowed `iss` values after signature verification. */
  readonly issuerAllowlist?: ReadonlyArray<string>;
  /** Expected JWT audiences; when set, `aud` must intersect. */
  readonly audience?: ReadonlyArray<string>;
  readonly clockSkewSeconds?: number;
};

function assertCapabilityPayload(payload: jose.JWTPayload): CapabilityTokenPayload {
  const record = payload as Record<string, unknown>;
  for (const forbidden of FORBIDDEN_CLAIMS) {
    if (forbidden in record) {
      throw new DPPError('forbidden_claim', `Token contains forbidden claim: ${forbidden}`, {
        claim: forbidden,
      });
    }
  }
  if (record.dpp !== '0.1' || record.typ !== 'capability') {
    throw new DPPError('invalid_token', 'Unsupported capability token type or version');
  }
  return payload as CapabilityTokenPayload;
}

type JwksVerifier = ReturnType<typeof jose.createRemoteJWKSet>;

async function resolveJwks(config: JwsTrustConfig): Promise<JwksVerifier> {
  if (config.jwks) return jose.createLocalJWKSet(config.jwks) as JwksVerifier;
  if (config.jwksUri) {
    return jose.createRemoteJWKSet(new URL(config.jwksUri));
  }
  throw new DPPError('invalid_token', 'JWS trust config requires jwksUri or jwks');
}

export async function verifyCapabilityJws(
  compactJwt: string,
  trust: JwsTrustConfig,
): Promise<CapabilityTokenPayload> {
  const jwks = await resolveJwks(trust);
  const skew = trust.clockSkewSeconds ?? 60;

  let payload: jose.JWTPayload;
  try {
    const verified = await jose.jwtVerify(compactJwt, jwks, {
      clockTolerance: skew,
      audience: trust.audience?.length ? [...trust.audience] : undefined,
    });
    payload = verified.payload;
  } catch (err) {
    throw new DPPError(
      'invalid_signature',
      err instanceof Error ? err.message : 'JWS verification failed',
    );
  }

  const capability = assertCapabilityPayload(payload);

  if (
    trust.issuerAllowlist?.length &&
    !trust.issuerAllowlist.includes(capability.iss)
  ) {
    throw new DPPError('untrusted_issuer', `Issuer not allowlisted: ${capability.iss}`, {
      iss: capability.iss,
    });
  }

  return capability;
}

/** Sign a capability JWT for tests and local development only. */
export async function signCapabilityForTest(
  payload: CapabilityTokenPayload,
  privateKey: CryptoKey,
  kid = 'test-key',
): Promise<string> {
  return new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: 'ES256', kid })
    .sign(privateKey);
}

/** Generate an ES256 key pair for tests. */
export async function generateTestKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicJwk: jose.JWK;
}> {
  const { publicKey, privateKey } = await jose.generateKeyPair('ES256');
  const publicJwk = await jose.exportJWK(publicKey);
  return { publicKey, privateKey, publicJwk };
}
