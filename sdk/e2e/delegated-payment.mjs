/**
 * E2E: MCP tool handlers → wallet-issuer → express-merchant (plan §8.10).
 * Spawns demo wallet + merchant, completes OAuth without a browser, runs link → preview → confirm → status.
 */

import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import {
  McpPaymentSession,
  handleLinkWallet,
  handlePreviewPayment,
  handleConfirmPayment,
  handleGetPaymentStatus,
} from 'dpp-mcp-payment-tool';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SDK_ROOT = join(__dirname, '..');
const WALLET_PORT = 3353;
const MERCHANT_PORT = 3342;
const walletBase = `http://127.0.0.1:${WALLET_PORT}`;
const merchantBase = `http://127.0.0.1:${MERCHANT_PORT}`;
const walletIssuer = `https://127.0.0.1:${WALLET_PORT}/issuer`;
const DEMO_USER_ID = 'usr_demo_alice';

function spawnDemo(cwd, script, env) {
  return spawn('node', [script], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

async function waitForListen(child, needle, attempts = 50) {
  let booted = false;
  child.stdout.on('data', (chunk) => {
    if (chunk.toString().includes(needle)) booted = true;
  });
  for (let i = 0; i < attempts && !booted; i++) {
    await delay(100);
  }
  if (!booted) {
    child.kill();
    throw new Error(`Process failed to start (${needle})`);
  }
}

async function walletLoginSession() {
  const loginRes = await fetch(`${walletBase}/login`, { method: 'POST', redirect: 'manual' });
  if (loginRes.status !== 302) {
    throw new Error(`wallet login expected 302, got ${loginRes.status}`);
  }
  const setCookie =
    loginRes.headers.getSetCookie?.() ??
    (loginRes.headers.get('set-cookie') ? [loginRes.headers.get('set-cookie')] : []);
  const sessionCookie = setCookie.find((c) => c.startsWith('dpp_wallet_session='));
  if (!sessionCookie) {
    throw new Error('wallet login did not set session cookie');
  }
  return sessionCookie.split(';')[0];
}

async function approveOAuthConsent(authorizeUrl, sessionCookie) {
  const consentRes = await fetch(authorizeUrl, {
    headers: { cookie: sessionCookie },
    redirect: 'manual',
  });
  if (consentRes.status !== 200) {
    throw new Error(`expected consent HTML, got ${consentRes.status}`);
  }
  const body = await consentRes.text();
  if (!body.includes('Agent consent')) {
    throw new Error('consent page missing expected title');
  }

  const state = new URL(authorizeUrl).searchParams.get('state');
  if (!state) throw new Error('authorize URL missing state');

  const approveRes = await fetch(`${walletBase}/oauth/consent`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: sessionCookie,
    },
    body: new URLSearchParams({ state, action: 'approve' }),
    redirect: 'manual',
  });
  if (approveRes.status !== 302) {
    throw new Error(`expected redirect after approve, got ${approveRes.status}`);
  }
  const location = approveRes.headers.get('location');
  if (!location) throw new Error('missing redirect location after consent');
  const code = new URL(location).searchParams.get('code');
  if (!code) throw new Error('authorization code missing from redirect');
  return { code, state };
}

async function linkWalletViaMcp(session) {
  const start = await handleLinkWallet(session, { userId: DEMO_USER_ID });
  if (start.status !== 'authorization_required' || !start.authorizationUrl || !start.state) {
    throw new Error(`link_wallet start failed: ${JSON.stringify(start)}`);
  }

  const sessionCookie = await walletLoginSession();
  const { code, state } = await approveOAuthConsent(start.authorizationUrl, sessionCookie);
  if (state !== start.state) {
    throw new Error('OAuth state mismatch between MCP and wallet redirect');
  }

  const linked = await handleLinkWallet(session, {
    userId: DEMO_USER_ID,
    authorizationCode: code,
    state,
  });
  if (linked.status !== 'linked' || !linked.delegation?.delegationId) {
    throw new Error(`link_wallet completion failed: ${JSON.stringify(linked)}`);
  }
  return linked.delegation.delegationId;
}

async function main() {
  const walletChild = spawnDemo(join(SDK_ROOT, 'examples/wallet-issuer'), 'server.mjs', {
    PORT: String(WALLET_PORT),
    WALLET_ISSUER: walletIssuer,
  });
  const merchantChild = spawnDemo(join(SDK_ROOT, 'examples/express-merchant'), 'server.mjs', {
    PORT: String(MERCHANT_PORT),
    DPP_TRUST_JWKS_URI: `${walletBase}/.well-known/jwks.json`,
    DPP_TRUST_ISSUER: walletIssuer,
  });

  try {
    await waitForListen(walletChild, 'listening');
    await waitForListen(merchantChild, 'listening');

    const walletHealth = await fetch(`${walletBase}/health`).then((r) => r.json());
    const merchantHealth = await fetch(`${merchantBase}/health`).then((r) => r.json());
    if (!walletHealth.ok || !merchantHealth.ok) {
      throw new Error('wallet or merchant health check failed');
    }

    const config = {
      walletBaseUrl: walletBase,
      merchantBaseUrl: merchantBase,
      walletIssuer,
      oauth: {
        clientId: walletHealth.demoClientId,
        agentSub: walletHealth.demoAgentSub,
        redirectUri: 'http://127.0.0.1:8765/oauth/callback',
        scopes: ['dpp:delegation:read', 'dpp:delegation:issue'],
      },
      vaultMasterKey: randomBytes(32).toString('base64'),
      defaultMerchantId: 'merchant:example_com',
      oauthCallbackHost: '127.0.0.1',
      oauthCallbackPort: 8765,
    };

    const session = new McpPaymentSession(config);
    const delegationId = await linkWalletViaMcp(session);

    const preview = await handlePreviewPayment(session, {
      delegationId,
      amountValue: '10.00',
      currency: 'USD',
    });
    if (preview.status !== 'preview_ready' || !preview.previewId) {
      throw new Error(`preview_payment failed: ${JSON.stringify(preview)}`);
    }

    const confirm = await handleConfirmPayment(session, { previewId: preview.previewId });
    if (confirm.status !== 'succeeded') {
      throw new Error(`confirm_payment failed: ${JSON.stringify(confirm)}`);
    }
    if (!confirm.pspPaymentId) {
      throw new Error('confirm_payment missing pspPaymentId');
    }

    const status = await handleGetPaymentStatus(session, {
      pspPaymentId: confirm.pspPaymentId,
    });
    if (status.status !== 'succeeded') {
      throw new Error(`get_payment_status failed: ${JSON.stringify(status)}`);
    }

    console.log(
      JSON.stringify(
        {
          e2e: 'ok',
          path: 'mcp → wallet-issuer → express-merchant',
          delegationId,
          previewId: preview.previewId,
          pspPaymentId: confirm.pspPaymentId,
          verdict: confirm.verdict,
        },
        null,
        2,
      ),
    );
  } finally {
    walletChild.kill();
    merchantChild.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
