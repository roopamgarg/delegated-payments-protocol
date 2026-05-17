import { createHash } from 'node:crypto';
import * as jose from 'jose';
import { DPPError } from '../errors.js';
import { DPP_ERROR_CODE } from '../constants.js';

const ES256_ALG = 'ES256';

/**
 * Signs ES256 without exposing private key material to the SDK process.
 * - `signMessage`: signs the JWS signing input (dev/test mock).
 * - `signSha256Digest`: signs a 32-byte digest (AWS KMS ECDSA_SHA_256).
 */
export type KmsEs256Signer =
  | {
      readonly keyId: string;
      readonly signMessage: (message: Uint8Array) => Promise<Uint8Array>;
    }
  | {
      readonly keyId: string;
      readonly signSha256Digest: (digest: Uint8Array) => Promise<Uint8Array>;
    };

export type JoseEs256Signer = {
  readonly kid: string;
  readonly sign: (data: Uint8Array) => Promise<Uint8Array>;
};

function assertDigestLength(digest: Uint8Array): void {
  if (digest.byteLength !== 32) {
    throw new DPPError(
      DPP_ERROR_CODE.INVALID_CONFIG,
      'ES256 KMS signing expects a 32-byte SHA-256 digest',
    );
  }
}

/** Wrap a local private JWK as a KMS message signer (dev/test only). */
export async function createLocalKmsEs256Signer(
  privateJwk: JsonWebKey,
  keyId: string,
): Promise<KmsEs256Signer> {
  const privateKey = await importLocalEs256PrivateKey(privateJwk);
  return {
    keyId,
    async signMessage(message) {
      const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        privateKey,
        message as BufferSource,
      );
      return new Uint8Array(signature);
    },
  };
}

/** Convert ASN.1 DER ECDSA signature to raw P-256 R||S for JWS. */
export function derEcdsaSignatureToJose(der: Uint8Array): Uint8Array {
  let offset = 0;
  if (der[offset++] !== 0x30) {
    throw new DPPError(DPP_ERROR_CODE.INVALID_CONFIG, 'Invalid DER ECDSA signature');
  }
  const seqLen = der[offset++];
  if (seqLen + 2 !== der.length) {
    throw new DPPError(DPP_ERROR_CODE.INVALID_CONFIG, 'Unexpected DER sequence length');
  }
  if (der[offset++] !== 0x02) {
    throw new DPPError(DPP_ERROR_CODE.INVALID_CONFIG, 'Invalid DER integer tag for r');
  }
  const rLen = der[offset++];
  const r = der.subarray(offset, offset + rLen);
  offset += rLen;
  if (der[offset++] !== 0x02) {
    throw new DPPError(DPP_ERROR_CODE.INVALID_CONFIG, 'Invalid DER integer tag for s');
  }
  const sLen = der[offset++];
  const s = der.subarray(offset, offset + sLen);

  const raw = new Uint8Array(64);
  raw.set(r.length > 32 ? r.subarray(r.length - 32) : r, r.length > 32 ? 0 : 32 - r.length);
  raw.set(s.length > 32 ? s.subarray(s.length - 32) : s, 64 - (s.length > 32 ? 32 : s.length));
  return raw;
}

export function createJoseEs256SignerFromKms(
  kms: KmsEs256Signer,
  kid: string,
): JoseEs256Signer {
  if ('signMessage' in kms) {
    return { kid, sign: (data) => kms.signMessage(data) };
  }
  return {
    kid,
    async sign(data) {
      const digest = createHash('sha256').update(data).digest();
      const signature = await kms.signSha256Digest(new Uint8Array(digest));
      if (signature.byteLength === 64) {
        return signature;
      }
      return derEcdsaSignatureToJose(signature);
    },
  };
}

export async function createJoseEs256SignerFromLocalKey(
  privateKey: globalThis.CryptoKey,
  kid: string,
): Promise<JoseEs256Signer> {
  return {
    kid,
    sign: async (data) => {
      const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        privateKey,
        data as BufferSource,
      );
      return new Uint8Array(signature);
    },
  };
}

type AwsKmsClient = {
  send(command: unknown): Promise<{ Signature?: Uint8Array }>;
};

type AwsKmsModule = {
  KMSClient: new (config?: object) => AwsKmsClient;
  SignCommand: new (input: {
    KeyId: string;
    Message: Uint8Array;
    MessageType: 'DIGEST';
    SigningAlgorithm: 'ECDSA_SHA_256';
  }) => unknown;
};

export async function createAwsKmsEs256Signer(
  keyId: string,
  client?: AwsKmsClient,
): Promise<KmsEs256Signer> {
  let kmsModule: AwsKmsModule;
  try {
    kmsModule = (await import(
      '@aws-sdk/client-kms'
    )) as AwsKmsModule;
  } catch {
    throw new DPPError(
      DPP_ERROR_CODE.INVALID_CONFIG,
      'AWS KMS signing requires @aws-sdk/client-kms; install it or inject kmsSigner on the issuer config',
    );
  }

  const kmsClient = client ?? new kmsModule.KMSClient({});

  return {
    keyId,
    async signSha256Digest(digest: Uint8Array) {
      assertDigestLength(digest);
      const response = await kmsClient.send(
        new kmsModule.SignCommand({
          KeyId: keyId,
          Message: digest,
          MessageType: 'DIGEST',
          SigningAlgorithm: 'ECDSA_SHA_256',
        }),
      );
      if (!response.Signature?.byteLength) {
        throw new DPPError(DPP_ERROR_CODE.INVALID_CONFIG, 'KMS Sign returned an empty signature');
      }
      return response.Signature;
    },
  };
}

export async function importLocalEs256PrivateKey(
  privateJwk: JsonWebKey,
): Promise<globalThis.CryptoKey> {
  const jwk = {
    ...privateJwk,
    alg: privateJwk.alg ?? ES256_ALG,
    use: privateJwk.use ?? 'sig',
  };
  return (await jose.importJWK(jwk, ES256_ALG)) as globalThis.CryptoKey;
}
