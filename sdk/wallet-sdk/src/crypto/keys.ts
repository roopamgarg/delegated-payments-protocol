import * as jose from 'jose';
import type { SigningKeyMaterial } from '../types.js';
import { DPPError } from '../errors.js';
import { DPP_ERROR_CODE } from '../constants.js';

const ES256_ALG = 'ES256';

type LocalSigningKeyMaterial = Extract<SigningKeyMaterial, { readonly type: 'local' }>;

function assertLocalSigningKey(
  signingKey: SigningKeyMaterial,
): asserts signingKey is LocalSigningKeyMaterial {
  if (signingKey.type !== 'local') {
    throw new DPPError(
      DPP_ERROR_CODE.NOT_IMPLEMENTED,
      'KMS-backed signing keys require dpp-wallet-sdk KMS support (see AGE-50)',
    );
  }
}

export async function importSigningKey(
  signingKey: SigningKeyMaterial,
): Promise<{ key: globalThis.CryptoKey; kid: string }> {
  assertLocalSigningKey(signingKey);
  const jwk = {
    ...signingKey.privateJwk,
    alg: signingKey.privateJwk.alg ?? ES256_ALG,
    use: signingKey.privateJwk.use ?? 'sig',
  };
  const key = (await jose.importJWK(jwk, ES256_ALG)) as globalThis.CryptoKey;
  return { key, kid: signingKey.kid };
}

export function getPublicJwk(signingKey: SigningKeyMaterial): JsonWebKey {
  assertLocalSigningKey(signingKey);
  const { kty, crv, x, y } = signingKey.privateJwk;
  if (!kty || !crv || !x || !y) {
    throw new DPPError(
      DPP_ERROR_CODE.INVALID_CONFIG,
      'Local signing key must expose public coordinates (kty, crv, x, y)',
    );
  }
  return {
    kty,
    crv,
    x,
    y,
    alg: ES256_ALG,
    use: 'sig',
    kid: signingKey.kid,
  } as JsonWebKey;
}
