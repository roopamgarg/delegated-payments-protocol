import type { JoseEs256Signer } from './kms-signer.js';

function encodeBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

/** Sign a capability JWT with an external ES256 signer (KMS/HSM). */
export async function signCapabilityJwt(
  protectedHeader: Record<string, unknown>,
  payload: Record<string, unknown>,
  signer: JoseEs256Signer,
): Promise<string> {
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const headerB64 = encodeBase64Url(new TextEncoder().encode(JSON.stringify(protectedHeader)));
  const payloadB64 = encodeBase64Url(payloadBytes);
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = await signer.sign(new TextEncoder().encode(signingInput));
  const signatureB64 = encodeBase64Url(signature);
  return `${signingInput}.${signatureB64}`;
}
