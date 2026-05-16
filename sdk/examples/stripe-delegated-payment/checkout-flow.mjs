import { verifyDelegation } from '../../merchant-sdk/dist/index.js';

const capability = {
  dpp: '0.1',
  typ: 'capability',
  iss: 'https://wallet.example/issuer',
  sub: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGJpnn5uSiZuNR',
  exp: Math.floor(Date.now() / 1000) + 600,
  nonce: 'nonce0001',
  scopes: ['pay:initiate'],
  constraints: {
    maxAmount: { value: '25.00', currency: 'USD' },
    merchantAllowlist: ['merchant:example_com'],
    paymentMethods: ['card'],
  },
  intentBind: 'fa1183e76b890f5cea60ea03d76bd8f2e6f32fee72f47e25669d68ae84b360db',
};

const paymentIntent = {
  dpp: '0.1',
  typ: 'payment_intent',
  intentId: 'pi_01HABC',
  idempotencyKey: 'idem_001',
  amount: { value: '10.00', currency: 'USD' },
  merchantId: 'merchant:example_com',
  rail: 'card',
  railClass: 'B',
  digest: {
    alg: 'sha-256',
    value: 'fa1183e76b890f5cea60ea03d76bd8f2e6f32fee72f47e25669d68ae84b360db',
  },
};

const result = verifyDelegation({ capability, paymentIntent });
console.log(JSON.stringify({ verdict: result.verdict, reasons: result.reasons }, null, 2));

/** Pseudo-step: create Stripe PaymentIntent only after delegation_valid. */
if (result.verdict === 'delegation_valid') {
  console.log(
    '[next] stripe.paymentIntents.create({ amount, currency, metadata: { dppIntentId: paymentIntent.intentId } })',
  );
}
