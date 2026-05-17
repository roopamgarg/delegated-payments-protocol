/** Shared fixtures for the wallet issuer Express demo. */

export function demoAgentProfile(port) {
  return {
    sub: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGJpnn5uSiZuNR',
    displayName: 'DPP Demo Agent',
    redirectUris: [`http://127.0.0.1:${port}/demo/oauth/callback`],
    clientId: 'demo-agent-client',
  };
}

export const MERCHANT_ID = 'merchant:example_com';

/** Matches express-merchant / merchant-sdk verify tests. */
export const SAMPLE_DIGEST =
  'fa1183e76b890f5cea60ea03d76bd8f2e6f32fee72f47e25669d68ae84b360db';

export function samplePaymentIntent(overrides = {}) {
  return {
    dpp: '0.1',
    typ: 'payment_intent',
    intentId: 'pi_wallet_demo_001',
    idempotencyKey: 'idem_wallet_demo_001',
    amount: { value: '10.00', currency: 'USD' },
    merchantId: MERCHANT_ID,
    rail: 'card',
    railClass: 'B',
    digest: { alg: 'sha-256', value: SAMPLE_DIGEST },
    ...overrides,
  };
}

export function sampleCapabilityInput(agentSub, overrides = {}) {
  return {
    sub: agentSub,
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
