import assert from 'node:assert/strict';
import test from 'node:test';
import { randomBytes } from 'node:crypto';
import { PAYMENT_RAIL, RAIL_CLASS } from 'dpp-wallet-sdk';
import {
  evaluateConfirmPaymentPolicy,
  evaluatePreviewPaymentPolicy,
} from '../dist/policy/engine.js';
import { buildPolicyFromEnv } from '../dist/policy/defaults.js';
import { handlePreviewPayment } from '../dist/tools/preview-payment.js';
import { McpPaymentSession } from '../dist/session.js';

const policy = buildPolicyFromEnv({
  defaultMerchantId: 'merchant:example_com',
  maxAmountValue: '10.00',
  maxAmountCurrency: 'USD',
  paymentMethods: 'card',
  previewMaxAgeSeconds: '60',
});

const config = {
  walletBaseUrl: 'http://127.0.0.1:3350',
  merchantBaseUrl: 'http://127.0.0.1:3340',
  walletIssuer: 'https://127.0.0.1:3350/issuer',
  oauth: {
    clientId: 'demo-client',
    agentSub: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGJpnn5uSiZuNR',
    redirectUri: 'http://127.0.0.1:8765/oauth/callback',
    scopes: ['dpp:delegation:read', 'dpp:delegation:issue'],
  },
  vaultMasterKey: randomBytes(32).toString('base64'),
  defaultMerchantId: 'merchant:example_com',
  oauthCallbackHost: '127.0.0.1',
  oauthCallbackPort: 8765,
  policy,
};

const activeDelegation = {
  delegationId: 'dlg_policy_test',
  userId: 'usr_test',
  agentSub: config.oauth.agentSub,
  status: 'active',
  hasCapability: false,
  linkedAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

test('preview policy denies amount above max', () => {
  const decision = evaluatePreviewPaymentPolicy({
    policy,
    delegation: activeDelegation,
    intent: {
      amount: { value: '25.01', currency: 'USD' },
      merchantId: 'merchant:example_com',
      rail: PAYMENT_RAIL.CARD,
    },
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.violations.includes('amount_exceeds_max'));
});

test('preview policy denies merchant outside allowlist', () => {
  const decision = evaluatePreviewPaymentPolicy({
    policy,
    delegation: activeDelegation,
    intent: {
      amount: { value: '5.00', currency: 'USD' },
      merchantId: 'merchant:other',
      rail: PAYMENT_RAIL.CARD,
    },
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.violations.includes('merchant_not_allowlisted'));
});

test('preview policy denies disallowed rail', () => {
  const decision = evaluatePreviewPaymentPolicy({
    policy,
    delegation: activeDelegation,
    intent: {
      amount: { value: '5.00', currency: 'USD' },
      merchantId: 'merchant:example_com',
      rail: PAYMENT_RAIL.UPI,
    },
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.violations.includes('rail_not_allowed'));
});

test('confirm policy denies expired preview', () => {
  const decision = evaluateConfirmPaymentPolicy({
    policy,
    delegation: activeDelegation,
    intent: {
      amount: { value: '5.00', currency: 'USD' },
      merchantId: 'merchant:example_com',
      rail: PAYMENT_RAIL.CARD,
    },
    previewCreatedAt: new Date(Date.now() - 120_000).toISOString(),
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.violations.includes('preview_expired'));
});

test('preview_payment tool returns policy_denied before creating preview', async () => {
  const session = new McpPaymentSession(config);
  const stored = session.vault.storeOAuthTokens({
    delegationId: 'dlg_preview_policy',
    userId: 'usr_test',
    agentSub: config.oauth.agentSub,
    accessToken: 'at_demo_not_real',
    expiresIn: 3600,
  });
  session.bindDelegationPolicy(stored.delegationId);

  const preview = await handlePreviewPayment(session, {
    delegationId: stored.delegationId,
    amountValue: '99.00',
    currency: 'USD',
  });

  assert.equal(preview.status, 'error');
  assert.equal(preview.code, 'policy_denied');
  assert.ok(preview.policyViolations.includes('amount_exceeds_max'));
  assert.equal(session.getPreview(preview.previewId), undefined);
});

test('preview_payment allows in-policy amount', async () => {
  const session = new McpPaymentSession(config);
  const stored = session.vault.storeOAuthTokens({
    delegationId: 'dlg_preview_ok',
    userId: 'usr_test',
    agentSub: config.oauth.agentSub,
    accessToken: 'at_demo_not_real',
    expiresIn: 3600,
  });
  session.bindDelegationPolicy(stored.delegationId);

  const preview = await handlePreviewPayment(session, {
    delegationId: stored.delegationId,
    amountValue: '5.00',
    currency: 'USD',
  });

  assert.equal(preview.status, 'preview_ready');
  assert.equal(preview.payment.railClass, RAIL_CLASS.B);
});
