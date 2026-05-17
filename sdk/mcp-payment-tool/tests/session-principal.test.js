import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import { McpPaymentSession } from '../dist/session.js';
import { handleLinkWallet } from '../dist/tools/link-wallet.js';
import { handlePreviewPayment } from '../dist/tools/preview-payment.js';

const baseConfig = {
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
  sessionUserId: 'usr_session_principal',
  defaultMerchantId: 'merchant:example_com',
  oauthCallbackHost: '127.0.0.1',
  oauthCallbackPort: 8765,
};

test('link_wallet rejects userId that does not match session principal (F-01)', async () => {
  const session = new McpPaymentSession(baseConfig);
  const result = await handleLinkWallet(session, { userId: 'usr_attacker' });
  assert.equal(result.status, 'error');
  assert.equal(result.code, 'policy_denied');
});

test('preview_payment rejects delegation for another session principal (F-01)', async () => {
  const session = new McpPaymentSession(baseConfig);
  const stored = session.vault.storeOAuthTokens({
    delegationId: 'dlg_cross_user',
    userId: 'usr_other',
    agentSub: baseConfig.oauth.agentSub,
    accessToken: 'at_demo_not_real',
    expiresIn: 3600,
  });
  const preview = await handlePreviewPayment(session, {
    delegationId: stored.delegationId,
    amountValue: '1.00',
    currency: 'USD',
  });
  assert.equal(preview.status, 'error');
  assert.equal(preview.code, 'policy_denied');
});
