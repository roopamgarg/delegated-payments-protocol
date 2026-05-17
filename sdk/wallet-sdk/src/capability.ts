import { randomBytes, randomUUID } from 'node:crypto';
import { SignJWT, type JWTPayload } from 'jose';
import type { DPPWalletIssuer } from './issuer.js';
import type { CapabilityClaimsInput, IssueCapabilityResult } from './types.js';
import { ARTIFACT_TYPE, DPP_ERROR_CODE, DPP_VERSION } from './constants.js';
import { DPPError } from './errors.js';
import { importSigningKey } from './crypto/keys.js';

const DEFAULT_CAPABILITY_TTL_SECONDS = 600;
const MAX_CAPABILITY_TTL_SECONDS = 900;
const ES256_ALG = 'ES256';

function buildConstraints(
  inputConstraints: CapabilityClaimsInput['constraints'],
): CapabilityClaimsInput['constraints'] {
  return {
    maxAmount: { ...inputConstraints.maxAmount },
    merchantAllowlist: [...inputConstraints.merchantAllowlist],
    ...(inputConstraints.paymentMethods
      ? { paymentMethods: [...inputConstraints.paymentMethods] }
      : {}),
    ...(inputConstraints.requiresOtp !== undefined
      ? { requiresOtp: inputConstraints.requiresOtp }
      : {}),
  };
}

function resolveTtlSeconds(
  input: CapabilityClaimsInput,
  defaultTtl?: number,
): number {
  const requested = input.ttlSeconds ?? defaultTtl ?? DEFAULT_CAPABILITY_TTL_SECONDS;
  const ttl = Math.floor(requested);
  if (ttl <= 0) {
    throw new DPPError(DPP_ERROR_CODE.INVALID_CONFIG, 'ttlSeconds must be a positive number');
  }
  return Math.min(ttl, MAX_CAPABILITY_TTL_SECONDS);
}

function createNonce(): string {
  return randomBytes(18).toString('base64url');
}

/** Claim order matches jose SignJWT setter sequence for byte-identical payloads. */
function buildCapabilityPayload(
  issuer: DPPWalletIssuer,
  input: CapabilityClaimsInput,
  now: number,
  expiresAt: number,
  nonce: string,
  jti: string,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    dpp: DPP_VERSION,
    typ: ARTIFACT_TYPE.CAPABILITY,
    nonce,
    scopes: [...input.scopes],
    constraints: buildConstraints(input.constraints),
    ...(input.intentBind !== undefined ? { intentBind: input.intentBind } : {}),
    iss: issuer.config.issuer,
    sub: input.sub,
    exp: expiresAt,
    iat: now,
    jti,
  };
  if (input.aud?.length) {
    payload.aud = [...input.aud];
  }
  return payload;
}

function buildCapabilitySignJwt(payload: Record<string, unknown>, kid: string): SignJWT {
  const { iss, sub, exp, iat, jti, aud, ...customClaims } = payload;
  let jwt = new SignJWT(customClaims as JWTPayload)
    .setProtectedHeader({ alg: ES256_ALG, kid })
    .setIssuer(iss as string)
    .setSubject(sub as string)
    .setExpirationTime(exp as number)
    .setIssuedAt(iat as number)
    .setJti(jti as string);
  if (Array.isArray(aud) && aud.length) {
    jwt = jwt.setAudience(aud as string[]);
  }
  return jwt;
}

export async function issueCapability(
  issuer: DPPWalletIssuer,
  input: CapabilityClaimsInput,
): Promise<IssueCapabilityResult> {
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = resolveTtlSeconds(input, issuer.config.defaultCapabilityTtlSeconds);
  const expiresAt = now + ttlSeconds;
  const nonce = createNonce();
  const jti = randomUUID();
  const activeKey = issuer.signingKeyRing.getActive();
  const { key, kid } = await importSigningKey(activeKey);
  const payload = buildCapabilityPayload(issuer, input, now, expiresAt, nonce, jti);
  const compactJws = await buildCapabilitySignJwt(payload, kid).sign(key);

  return { compactJws, jti, expiresAt };
}
