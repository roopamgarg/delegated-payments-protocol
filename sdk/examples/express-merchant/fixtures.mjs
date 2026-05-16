/** Shared sample intent + capability claims for the Express demo. */

export const ISSUER = 'https://wallet.example/issuer';
export const MERCHANT_ID = 'merchant:example_com';

/** Fixed digest matching sdk/merchant-sdk/tests/verify.test.js */
export const SAMPLE_DIGEST =
  'fa1183e76b890f5cea60ea03d76bd8f2e6f32fee72f47e25669d68ae84b360db';

export function samplePaymentIntent(overrides = {}) {
  return {
    dpp: '0.1',
    typ: 'payment_intent',
    intentId: 'pi_demo_001',
    idempotencyKey: 'idem_demo_001',
    amount: { value: '10.00', currency: 'USD' },
    merchantId: MERCHANT_ID,
    rail: 'card',
    railClass: 'B',
    digest: { alg: 'sha-256', value: SAMPLE_DIGEST },
    ...overrides,
  };
}

export function sampleCapabilityClaims(overrides = {}) {
  return {
    dpp: '0.1',
    typ: 'capability',
    iss: ISSUER,
    sub: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGJpnn5uSiZuNR',
    exp: Math.floor(Date.now() / 1000) + 600,
    nonce: 'nonce_demo_001',
    scopes: ['pay:initiate'],
    constraints: {
      maxAmount: { value: '25.00', currency: 'USD' },
      merchantAllowlist: [MERCHANT_ID],
      paymentMethods: ['card'],
    },
    intentBind: SAMPLE_DIGEST,
    ...overrides,
  };
}
