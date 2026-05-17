import * as jose from 'jose';
import type { SigningKeyMaterial } from '../types.js';
import type { KmsEs256Signer } from './kms-signer.js';
import {
  createAwsKmsEs256Signer,
  createJoseEs256SignerFromKms,
  createJoseEs256SignerFromLocalKey,
  createLocalKmsEs256Signer,
  importLocalEs256PrivateKey,
  type JoseEs256Signer,
} from './kms-signer.js';
import { DPPError } from '../errors.js';
import { DPP_ERROR_CODE } from '../constants.js';

const ES256_ALG = 'ES256';

type LocalSigningKeyMaterial = Extract<SigningKeyMaterial, { readonly type: 'local' }>;
type KmsSigningKeyMaterial = Extract<SigningKeyMaterial, { readonly type: 'kms' }>;

function assertLocalSigningKey(
  signingKey: SigningKeyMaterial,
): asserts signingKey is LocalSigningKeyMaterial {
  if (signingKey.type !== 'local') {
    throw new DPPError(DPP_ERROR_CODE.INVALID_CONFIG, 'Expected a local signing key');
  }
}

function assertKmsSigningKey(
  signingKey: SigningKeyMaterial,
): asserts signingKey is KmsSigningKeyMaterial {
  if (signingKey.type !== 'kms') {
    throw new DPPError(DPP_ERROR_CODE.INVALID_CONFIG, 'Expected a KMS signing key');
  }
}

function assertKmsPublicJwk(signingKey: KmsSigningKeyMaterial): void {
  const { kty, crv, x, y } = signingKey.publicJwk;
  if (!kty || !crv || !x || !y) {
    throw new DPPError(
      DPP_ERROR_CODE.INVALID_CONFIG,
      'KMS signing key must include cached public JWK coordinates (kty, crv, x, y)',
    );
  }
}

export async function resolveJoseEs256Signer(
  signingKey: SigningKeyMaterial,
  kmsSigner?: KmsEs256Signer,
): Promise<JoseEs256Signer> {
  if (signingKey.type === 'local') {
    const key = await importLocalEs256PrivateKey(signingKey.privateJwk);
    return createJoseEs256SignerFromLocalKey(key, signingKey.kid);
  }

  assertKmsSigningKey(signingKey);
  assertKmsPublicJwk(signingKey);
  const kms =
    kmsSigner ??
    (await createAwsKmsEs256Signer(signingKey.keyId, signingKey.kmsClient as never));
  if (kms.keyId !== signingKey.keyId) {
    throw new DPPError(
      DPP_ERROR_CODE.INVALID_CONFIG,
      'Injected kmsSigner keyId does not match signingKey.keyId',
    );
  }
  return createJoseEs256SignerFromKms(kms, signingKey.kid);
}

/** @deprecated Use resolveJoseEs256Signer — retained for callers expecting CryptoKey. */
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
  if (signingKey.type === 'kms') {
    assertKmsPublicJwk(signingKey);
    return {
      ...signingKey.publicJwk,
      alg: signingKey.publicJwk.alg ?? ES256_ALG,
      use: signingKey.publicJwk.use ?? 'sig',
      kid: signingKey.kid,
    } as JsonWebKey;
  }

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

export async function createTestKmsSigningKey(
  privateJwk: JsonWebKey,
  kid: string,
  keyId = 'test-kms-key',
): Promise<{ signingKey: KmsSigningKeyMaterial; kmsSigner: KmsEs256Signer }> {
  const publicJwk = getPublicJwk({ type: 'local', privateJwk, kid });
  return {
    signingKey: {
      type: 'kms',
      keyId,
      kid,
      publicJwk,
    },
    kmsSigner: await createLocalKmsEs256Signer(privateJwk, keyId),
  };
}
