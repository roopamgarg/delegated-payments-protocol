import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyDelegation } from '../dist/verify.js';
import {
  ARTIFACT_TYPE,
  DELEGATION_VERDICT,
  DPP_VERSION,
  PAYMENT_RAIL,
  RAIL_CLASS,
  VERIFICATION_REASON,
  DIGEST_ALG,
} from '../dist/constants.js';

const capability = {
  dpp: DPP_VERSION,
  typ: ARTIFACT_TYPE.CAPABILITY,
  iss: 'https://wallet.example/issuer',
  sub: 'did:key:z6Mkagent',
  exp: Math.floor(Date.now() / 1000) + 600,
  nonce: 'nonce00000001',
  scopes: ['pay:initiate'],
  constraints: {
    maxAmount: { value: '25.00', currency: 'USD' },
    merchantAllowlist: ['merchant:example_com'],
    paymentMethods: [PAYMENT_RAIL.CARD],
  },
  intentBind: 'fa1183e76b890f5cea60ea03d76bd8f2e6f32fee72f47e25669d68ae84b360db',
};

const paymentIntent = {
  dpp: DPP_VERSION,
  typ: ARTIFACT_TYPE.PAYMENT_INTENT,
  intentId: 'pi_01HABC',
  idempotencyKey: 'idem_001',
  amount: { value: '10.00', currency: 'USD' },
  merchantId: 'merchant:example_com',
  rail: PAYMENT_RAIL.CARD,
  railClass: RAIL_CLASS.B,
  digest: {
    alg: DIGEST_ALG.SHA256,
    value: 'fa1183e76b890f5cea60ea03d76bd8f2e6f32fee72f47e25669d68ae84b360db',
  },
};

test('verifyDelegation accepts valid pair', () => {
  const result = verifyDelegation({ capability, paymentIntent });
  assert.equal(result.verdict, DELEGATION_VERDICT.VALID);
});

test('verifyDelegation rejects amount over max', () => {
  const result = verifyDelegation({
    capability,
    paymentIntent: {
      ...paymentIntent,
      amount: { value: '99.00', currency: 'USD' },
    },
  });
  assert.equal(result.verdict, DELEGATION_VERDICT.INVALID);
  assert.ok(result.reasons.includes(VERIFICATION_REASON.INTENT_AMOUNT_EXCEEDS_MAX));
});

test('verifyDelegation rejects capability without pay:initiate', () => {
  const result = verifyDelegation({
    capability: { ...capability, scopes: ['pay:view'] },
    paymentIntent,
  });
  assert.equal(result.verdict, DELEGATION_VERDICT.INVALID);
  assert.ok(result.reasons.includes(VERIFICATION_REASON.CAPABILITY_INSUFFICIENT_SCOPE));
});

test('verifyDelegation honors custom requiredScopes', () => {
  const result = verifyDelegation({
    capability: { ...capability, scopes: ['pay:view'] },
    paymentIntent,
    requiredScopes: ['pay:view'],
  });
  assert.equal(result.verdict, DELEGATION_VERDICT.VALID);
});
