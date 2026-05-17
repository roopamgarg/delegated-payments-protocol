import type { DPPWalletIssuer } from '../issuer.js';
import type { SigningKeyMaterial } from '../types.js';
import { DPP_ERROR_CODE } from '../constants.js';
import { DPPError } from '../errors.js';

export async function exportJwks(
  issuer: DPPWalletIssuer,
): Promise<{ keys: ReadonlyArray<JsonWebKey> }> {
  return { keys: issuer.signingKeyRing.listPublicJwks() };
}

export async function rotateKeys(
  issuer: DPPWalletIssuer,
  nextSigningKey: SigningKeyMaterial,
): Promise<{ keys: ReadonlyArray<JsonWebKey> }> {
  if (!nextSigningKey?.kid) {
    throw new DPPError(DPP_ERROR_CODE.INVALID_CONFIG, 'rotateKeys requires nextSigningKey with kid');
  }
  return { keys: issuer.signingKeyRing.rotate(nextSigningKey) };
}
