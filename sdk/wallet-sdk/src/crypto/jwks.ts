import type { DPPWalletIssuer } from '../issuer.js';
import { notImplemented } from '../not-implemented.js';

export async function exportJwks(_issuer: DPPWalletIssuer): Promise<{ keys: ReadonlyArray<JsonWebKey> }> {
  notImplemented('exportJwks');
}

export async function rotateKeys(_issuer: DPPWalletIssuer): Promise<{ keys: ReadonlyArray<JsonWebKey> }> {
  notImplemented('rotateKeys');
}
