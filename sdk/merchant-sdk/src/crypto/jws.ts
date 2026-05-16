import * as jose from 'jose';
import type { JSONWebKeySet } from 'jose';
import type { CapabilityTokenPayload } from '../types.js';
import { DPPError } from '../errors.js';
import {
  assertNotReplayed,
  getDefaultNonceStore,
  ReplayError,
  type NonceStore,
} from './nonce-store.js';
import { validateCapabilitySchema } from './schema-validator.js';

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
  /** Replay store for `nonce` / `jti`; defaults to in-memory (single-node only). */
  readonly nonceStore?: NonceStore;
  /** Scopes required on capability tokens (default: `pay:initiate`). */
  readonly requiredScopes?: ReadonlyArray<string>;
  /** Skip production issuer/audience checks (local dev and tests only). */
  readonly allowInsecureTrustConfig?: boolean;
};

export type VerifyCapabilityOptions = {
  /**
   * When set, nonce consumption is scoped to this payment idempotency key
   * (per wallet contract). Retries with the same key do not count as replay.
   */
  readonly idempotencyKey?: string;
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
  options?: VerifyCapabilityOptions,
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

  const record = payload as Record<string, unknown>;
  const capability = assertCapabilityPayload(payload);

  validateCapabilitySchema(record);

  if (
    trust.issuerAllowlist?.length &&
    !trust.issuerAllowlist.includes(capability.iss)
  ) {
    throw new DPPError('untrusted_issuer', `Issuer not allowlisted: ${capability.iss}`, {
      iss: capability.iss,
    });
  }

  const store = trust.nonceStore ?? getDefaultNonceStore();
  const jti = typeof record.jti === 'string' ? record.jti : undefined;
  try {
    await assertNotReplayed(store, {
      nonce: capability.nonce,
      exp: capability.exp,
      jti,
      idempotencyKey: options?.idempotencyKey,
    });
  } catch (err) {
    if (err instanceof ReplayError) {
      throw new DPPError('token_replay', err.message, { replayKey: err.replayKey });
    }
    throw new DPPError(
      'invalid_token',
      err instanceof Error ? err.message : 'Replay check failed',
    );
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
