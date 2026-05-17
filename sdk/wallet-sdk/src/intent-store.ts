import type { DPPWalletIssuer } from './issuer.js';
import type { PaymentIntentRecord } from './types.js';

const storeByIssuer = new WeakMap<DPPWalletIssuer, Map<string, PaymentIntentRecord>>();

export function getIntentStore(issuer: DPPWalletIssuer): Map<string, PaymentIntentRecord> {
  let store = storeByIssuer.get(issuer);
  if (!store) {
    store = new Map();
    storeByIssuer.set(issuer, store);
  }
  return store;
}
