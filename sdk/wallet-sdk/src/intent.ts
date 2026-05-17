import type { DPPWalletIssuer } from './issuer.js';
import type { PaymentIntentInput, PaymentIntentRecord } from './types.js';
import { notImplemented } from './not-implemented.js';

export function computeIntentDigest(_intent: PaymentIntentInput): string {
  notImplemented('computeIntentDigest');
}

export async function createIntent(
  _issuer: DPPWalletIssuer,
  _payload: PaymentIntentInput,
): Promise<PaymentIntentRecord> {
  notImplemented('createIntent');
}

export async function submitIntent(
  _issuer: DPPWalletIssuer,
  _intentId: string,
): Promise<PaymentIntentRecord> {
  notImplemented('submitIntent');
}

export async function getIntentStatus(
  _issuer: DPPWalletIssuer,
  _intentId: string,
): Promise<PaymentIntentRecord> {
  notImplemented('getIntentStatus');
}

export async function resumeAfterUserAction(
  _issuer: DPPWalletIssuer,
  _intentId: string,
): Promise<PaymentIntentRecord> {
  notImplemented('resumeAfterUserAction');
}
