import * as jose from 'jose';
import type { JSONWebKeySet } from 'jose';
import type { CapabilityTokenPayload } from '../types.js';
import { DPPError } from '../errors.js';
import {
  ARTIFACT_TYPE,
  DEFAULT_CLOCK_SKEW_SECONDS,
  DPP_ERROR_CODE,
  DPP_VERSION,
  FORBIDDEN_CLAIMS,
  JWS,
} from '../constants.js';
import {
  assertNotReplayed,
  getDefaultNonceStore,
  ReplayError,
  type NonceStore,
} from './nonce-store.js';
import { validateCapabilitySchema } from './schema-validator.js';

export type JwsTrustConfig = {
  /** JWKS document URL for the wallet issuer. */
  readonly jwksUri?: string;
  /** Inline JWKS (testing or pinned keys). */
  readonly jwks?: JSONWebKeySet;
  /** Allowed `iss` values after signature verification. */
  readonly issuerAllowlist?: ReadonlyArray<string>;
  /** Expected JWT audiences; when set, `aud` must intersect. */
  readonly audience?: ReadonlyArray<string>;
  /** Capability scopes required for payment (default: `pay:initiate`). */
  readonly requiredScopes?: ReadonlyArray<string>;
  /**
   * When true, `createMerchant` does not require issuerAllowlist/audience.
   * Use only in local tests and examples — never in production deployments.
   */
  readonly allowInsecureTrustConfig?: boolean;
  readonly clockSkewSeconds?: number;
  /**
   * Replay store for `nonce` / `jti`. When omitted, `InMemoryNonceStore` is used
   * (dev, tests, single-node). Horizontally scaled production MUST set a shared store.
   */
  readonly nonceStore?: NonceStore;
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
      throw new DPPError(
        DPP_ERROR_CODE.FORBIDDEN_CLAIM,
        `Token contains forbidden claim: ${forbidden}`,
        { claim: forbidden },
      );
    }
  }
  if (record.dpp !== DPP_VERSION || record.typ !== ARTIFACT_TYPE.CAPABILITY) {
    throw new DPPError(DPP_ERROR_CODE.INVALID_TOKEN, 'Unsupported capability token type or version');
  }
  return payload as CapabilityTokenPayload;
}

type JwksVerifier = ReturnType<typeof jose.createRemoteJWKSet>;

async function resolveJwks(config: JwsTrustConfig): Promise<JwksVerifier> {
  if (config.jwks) return jose.createLocalJWKSet(config.jwks) as JwksVerifier;
  if (config.jwksUri) {
    return jose.createRemoteJWKSet(new URL(config.jwksUri));
  }
  throw new DPPError(DPP_ERROR_CODE.INVALID_TOKEN, 'JWS trust config requires jwksUri or jwks');
}

export async function verifyCapabilityJws(
  compactJwt: string,
  trust: JwsTrustConfig,
  options?: VerifyCapabilityOptions,
): Promise<CapabilityTokenPayload> {
  const jwks = await resolveJwks(trust);
  const skew = trust.clockSkewSeconds ?? DEFAULT_CLOCK_SKEW_SECONDS;

  let payload: jose.JWTPayload;
  try {
    const verified = await jose.jwtVerify(compactJwt, jwks, {
      clockTolerance: skew,
      audience: trust.audience?.length ? [...trust.audience] : undefined,
    });
    payload = verified.payload;
  } catch (err) {
    throw new DPPError(
      DPP_ERROR_CODE.INVALID_SIGNATURE,
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
    throw new DPPError(DPP_ERROR_CODE.UNTRUSTED_ISSUER, `Issuer not allowlisted: ${capability.iss}`, {
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
      throw new DPPError(DPP_ERROR_CODE.TOKEN_REPLAY, err.message, { replayKey: err.replayKey });
    }
    throw new DPPError(
      DPP_ERROR_CODE.INVALID_TOKEN,
      err instanceof Error ? err.message : 'Replay check failed',
    );
  }

  return capability;
}

/** Sign a capability JWT for tests and local development only. */
export async function signCapabilityForTest(
  payload: CapabilityTokenPayload,
  privateKey: CryptoKey,
  kid = JWS.TEST_KEY_ID,
): Promise<string> {
  return new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: JWS.ALG_ES256, kid })
    .sign(privateKey);
}

/** Generate an ES256 key pair for tests. */
export async function generateTestKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
  publicJwk: jose.JWK;
}> {
  const { publicKey, privateKey } = await jose.generateKeyPair(JWS.ALG_ES256);
  const publicJwk = await jose.exportJWK(publicKey);
  return { publicKey, privateKey, publicJwk };
}
