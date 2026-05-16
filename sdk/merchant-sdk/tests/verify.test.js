import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyDelegation } from '../dist/verify.js';

const capability = {
  dpp: '0.1',
  typ: 'capability',
  iss: 'https://wallet.example/issuer',
  sub: 'did:key:z6Mkagent',
  exp: Math.floor(Date.now() / 1000) + 600,
  nonce: 'nonce00000001',
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

test('verifyDelegation accepts valid pair', () => {
  const result = verifyDelegation({ capability, paymentIntent });
  assert.equal(result.verdict, 'delegation_valid');
});

test('verifyDelegation rejects amount over max', () => {
  const result = verifyDelegation({
    capability,
    paymentIntent: {
      ...paymentIntent,
      amount: { value: '99.00', currency: 'USD' },
    },
  });
  assert.equal(result.verdict, 'delegation_invalid');
  assert.ok(result.reasons.includes('intent:amount_exceeds_max'));
});

test('verifyDelegation rejects capability without pay:initiate', () => {
  const result = verifyDelegation({
    capability: { ...capability, scopes: ['pay:view'] },
    paymentIntent,
  });
  assert.equal(result.verdict, 'delegation_invalid');
  assert.ok(result.reasons.includes('capability:insufficient_scope'));
});

test('verifyDelegation honors custom requiredScopes', () => {
  const result = verifyDelegation({
    capability: { ...capability, scopes: ['pay:view'] },
    paymentIntent,
    requiredScopes: ['pay:view'],
  });
  assert.equal(result.verdict, 'delegation_valid');
});
