import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash, randomBytes } from 'node:crypto';
import { assertSafeForLlmContext } from 'dpp-agent-vault';
import { computeIntentDigest } from 'dpp-wallet-sdk';
import {
  buildAuthorizationUrl,
  buildPaymentIntentRecord,
  generatePkcePair,
} from '../dist/clients/wallet-client.js';
import { buildPolicyFromEnv } from '../dist/policy/defaults.js';
import { handlePreviewPayment } from '../dist/tools/preview-payment.js';
import { McpPaymentSession } from '../dist/session.js';

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
  policy: buildPolicyFromEnv({ defaultMerchantId: 'merchant:example_com' }),
};

test('PKCE challenge matches verifier', () => {
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const digest = createHash('sha256').update(codeVerifier).digest('base64url');
  assert.equal(digest, codeChallenge);
});

test('buildAuthorizationUrl includes PKCE and agent sub', () => {
  const { codeChallenge } = generatePkcePair();
  const url = new URL(buildAuthorizationUrl(config, { state: 'st1', codeChallenge }));
  assert.equal(url.pathname, '/oauth/authorize');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('dpp_agent_sub'), config.oauth.agentSub);
});

test('payment intent record digest matches computeIntentDigest', () => {
  const intentInput = {
    intentId: 'pi_test_1',
    idempotencyKey: 'idem_test_1',
    amount: { value: '10.00', currency: 'USD' },
    merchantId: 'merchant:example_com',
    rail: 'card',
    railClass: 'B',
  };
  const record = buildPaymentIntentRecord(intentInput);
  assert.equal(record.digest.value, computeIntentDigest(intentInput));
});

test('preview_payment returns LLM-safe payload when delegation exists', async () => {
  const session = new McpPaymentSession(config);
  const stored = session.vault.storeOAuthTokens({
    delegationId: 'dlg_preview_test',
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
  assert.ok(preview.previewId);
  assertSafeForLlmContext(preview);
  assert.doesNotMatch(JSON.stringify(preview), /at_demo_not_real/);
});
