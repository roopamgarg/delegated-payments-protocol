/**
 * DPP wallet service MVP — demo issuer using dpp-wallet-sdk.
 * OAuth consent UI, demo accounts, mock UPI/card linking, JWKS, delegation issue.
 */

import { randomBytes } from 'node:crypto';
import express from 'express';
import * as jose from 'jose';
import {
  createWalletIssuer,
  DPP_OAUTH_SCOPE,
  DPPError,
  issueAuthorizationCode,
} from 'dpp-wallet-sdk';
import { DEFAULT_ISSUER, DEMO_AGENT, DEMO_USER } from './fixtures.mjs';

const PORT = Number(process.env.PORT ?? 3350);
const ISSUER = process.env.WALLET_ISSUER ?? DEFAULT_ISSUER;
const OPERATOR_TOKEN = process.env.DPP_OPERATOR_TOKEN ?? 'dev-operator-token';
const SESSION_COOKIE = 'dpp_wallet_session';

/** @type {import('dpp-wallet-sdk').DPPWalletIssuer | undefined} */
let wallet;
/** @type {{ sub: string; clientId: string; displayName: string } | undefined} */
let demoAgent;

const sessions = new Map();
const users = new Map();
const paymentMethods = new Map();
/** @type {Map<string, object>} */
const pendingAuthorize = new Map();
/** @type {Map<string, { agentSub: string; userId: string }>} */
const authCodeMeta = new Map();
/** @type {Map<string, { delegationId: string; agentSub: string; userId: string }>} */
const delegationByAccessToken = new Map();

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const [rawKey, ...rest] = part.trim().split('=');
    if (!rawKey) continue;
    out[rawKey] = decodeURIComponent(rest.join('='));
  }
  return out;
}

function getSessionUserId(req) {
  const sessionId = parseCookies(req.headers.cookie)[SESSION_COOKIE];
  if (!sessionId) return undefined;
  return sessions.get(sessionId)?.userId;
}

function requireSession(req, res) {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.status(401).json({ error: 'unauthorized', message: 'Sign in at /login' });
    return undefined;
  }
  return userId;
}

function requireOperator(req, res) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== OPERATOR_TOKEN) {
    res.status(401).json({ error: 'unauthorized', message: 'Operator Bearer token required' });
    return false;
  }
  return true;
}

function sendDppError(res, err) {
  if (err instanceof DPPError) {
    res.status(400).json({ error: err.code, message: err.message, details: err.details });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal_error', message: 'Unexpected error' });
}

async function bootstrap() {
  const { privateKey } = await jose.generateKeyPair('ES256', { extractable: true });
  const privateJwk = await jose.exportJWK(privateKey);

  wallet = createWalletIssuer({
    issuer: ISSUER,
    defaultCapabilityTtlSeconds: 600,
    signingKey: { type: 'local', kid: 'wallet-mvp-1', privateJwk: { ...privateJwk, alg: 'ES256', use: 'sig' } },
  });

  const registered = await wallet.registerAgent(DEMO_AGENT);
  demoAgent = { ...DEMO_AGENT, clientId: registered.clientId };
  users.set(DEMO_USER.userId, { ...DEMO_USER });
  paymentMethods.set(DEMO_USER.userId, []);
}

function walletBaseUrl(req) {
  return `${req.protocol}://${req.get('host')}`;
}

function renderLayout(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} — DPP Wallet MVP</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 42rem; margin: 2rem auto; padding: 0 1rem; line-height: 1.5; }
    .card { border: 1px solid #ccc; border-radius: 8px; padding: 1rem 1.25rem; margin: 1rem 0; }
    button, .btn { background: #0b5; color: #fff; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
    button.deny { background: #c33; }
    a { color: #06c; }
    code { background: #f4f4f4; padding: 0.1rem 0.3rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${body}
  <p><small>DPP wallet MVP — demo only. OTP and rails are mocked.</small></p>
</body>
</html>`;
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, issuer: ISSUER, demoAgentSub: demoAgent?.sub, demoClientId: demoAgent?.clientId });
});

app.get('/.well-known/jwks.json', async (_req, res) => {
  try {
    const jwks = await wallet.exportJwks();
    res.json(jwks);
  } catch (err) {
    sendDppError(res, err);
  }
});

app.get('/.well-known/oauth-authorization-server', (req, res) => {
  const base = walletBaseUrl(req);
  res.json({
    issuer: base,
    authorization_endpoint: `${base}/oauth/authorize`,
    token_endpoint: `${base}/oauth/token`,
    revocation_endpoint: `${base}/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: Object.values(DPP_OAUTH_SCOPE),
  });
});

app.get('/login', (req, res) => {
  const returnTo = typeof req.query.return === 'string' ? req.query.return : '/';
  res.type('html').send(
    renderLayout(
      'Sign in',
      `<div class="card">
        <p>Demo wallet — sign in as <strong>${escapeHtml(DEMO_USER.displayName)}</strong></p>
        <form method="post" action="/login">
          <input type="hidden" name="return" value="${escapeHtml(returnTo)}" />
          <button type="submit">Continue</button>
        </form>
      </div>`,
    ),
  );
});

app.post('/login', (req, res) => {
  const sessionId = randomBytes(24).toString('base64url');
  sessions.set(sessionId, { userId: DEMO_USER.userId, createdAt: Date.now() });
  const returnTo = typeof req.body?.return === 'string' ? req.body.return : '/';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${sessionId}; HttpOnly; Path=/; SameSite=Lax`);
  res.redirect(returnTo);
});

app.get('/', (req, res) => {
  const userId = getSessionUserId(req);
  if (!userId) {
    res.redirect('/login?return=/');
    return;
  }
  const methods = paymentMethods.get(userId) ?? [];
  const methodList =
    methods.length === 0
      ? '<p>No payment methods linked yet.</p>'
      : `<ul>${methods.map((m) => `<li><code>${escapeHtml(m.type)}</code> — ${escapeHtml(m.label)} (${escapeHtml(m.masked)})</li>`).join('')}</ul>`;

  res.type('html').send(
    renderLayout(
      'Wallet home',
      `<div class="card">
        <p>Signed in as <strong>${escapeHtml(DEMO_USER.displayName)}</strong></p>
        <h2>Payment methods</h2>
        ${methodList}
        <form method="post" action="/v1/users/me/payment-methods" style="margin-top:1rem">
          <label>Link mock method:
            <select name="type">
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>
          </label>
          <button type="submit">Link</button>
        </form>
      </div>`,
    ),
  );
});

app.post('/v1/users/me/payment-methods', (req, res) => {
  const userId = requireSession(req, res);
  if (!userId) return;

  const type = req.body?.type === 'card' ? 'card' : 'upi';
  const list = paymentMethods.get(userId) ?? [];
  const masked = type === 'upi' ? '****@upi' : '****4242';
  list.push({
    id: `pm_${randomBytes(6).toString('hex')}`,
    type,
    label: type === 'upi' ? 'Demo UPI' : 'Demo Visa',
    masked,
    linkedAt: new Date().toISOString(),
  });
  paymentMethods.set(userId, list);

  if (req.accepts('html')) {
    res.redirect('/');
    return;
  }
  res.status(201).json({ paymentMethods: list });
});

app.get('/v1/users/me/payment-methods', (req, res) => {
  const userId = requireSession(req, res);
  if (!userId) return;
  res.json({ paymentMethods: paymentMethods.get(userId) ?? [] });
});

app.get('/v1/users/me/rails', (req, res) => {
  const userId = requireSession(req, res);
  if (!userId) return;
  const methods = paymentMethods.get(userId) ?? [];
  const rails = [];
  if (methods.some((m) => m.type === 'upi')) {
    rails.push({ rail: 'upi', railClass: 'B', label: 'UPI (demo)' });
  }
  if (methods.some((m) => m.type === 'card')) {
    rails.push({ rail: 'card', railClass: 'B', label: 'Card (demo)' });
  }
  res.json({ rails });
});

app.post('/v1/agents', (req, res) => {
  if (!requireOperator(req, res)) return;
  wallet
    .registerAgent(req.body)
    .then((profile) => res.status(201).json(profile))
    .catch((err) => sendDppError(res, err));
});

app.get('/oauth/authorize', async (req, res) => {
  try {
    const clientId = String(req.query.client_id ?? '');
    const redirectUri = String(req.query.redirect_uri ?? '');
    const scope = String(req.query.scope ?? '').split(/\s+/).filter(Boolean);
    const state = String(req.query.state ?? '');
    const codeChallenge = String(req.query.code_challenge ?? '');
    const codeChallengeMethod = String(req.query.code_challenge_method ?? '');
    const agentSub = String(req.query.dpp_agent_sub ?? '');

    if (req.query.response_type !== 'code') {
      res.status(400).send('response_type must be code');
      return;
    }
    if (codeChallengeMethod !== 'S256' || !codeChallenge) {
      res.status(400).send('PKCE S256 required');
      return;
    }

    await wallet.createAuthorizationUrl({
      clientId,
      redirectUri,
      scope,
      state,
      codeChallenge,
      codeChallengeMethod: 'S256',
      agentSub,
    });

    pendingAuthorize.set(state, {
      clientId,
      redirectUri,
      scope,
      state,
      codeChallenge,
      codeChallengeMethod: 'S256',
      agentSub,
    });

    const userId = getSessionUserId(req);
    if (!userId) {
      res.redirect(`/login?return=${encodeURIComponent(req.originalUrl)}`);
      return;
    }

    const agentName =
      agentSub === demoAgent?.sub ? demoAgent.displayName : agentSub;
    const scopeList = scope.map((s) => `<li><code>${escapeHtml(s)}</code></li>`).join('');

    res.type('html').send(
      renderLayout(
        'Agent consent',
        `<div class="card">
          <p><strong>${escapeHtml(agentName)}</strong> requests access to your wallet.</p>
          <p>Agent ID: <code>${escapeHtml(agentSub)}</code></p>
          <p>Redirect: <code>${escapeHtml(redirectUri)}</code></p>
          <h2>Scopes</h2>
          <ul>${scopeList}</ul>
          <form method="post" action="/oauth/consent" style="display:flex;gap:0.5rem">
            <input type="hidden" name="state" value="${escapeHtml(state)}" />
            <button type="submit" name="action" value="approve">Approve</button>
            <button type="submit" name="action" value="deny" class="deny">Deny</button>
          </form>
        </div>`,
      ),
    );
  } catch (err) {
    sendDppError(res, err);
  }
});

app.post('/oauth/consent', async (req, res) => {
  const state = String(req.body?.state ?? '');
  const pending = pendingAuthorize.get(state);
  if (!pending) {
    res.status(400).send('Unknown or expired authorization request');
    return;
  }

  const userId = requireSession(req, res);
  if (!userId) return;

  const redirect = new URL(pending.redirectUri);
  if (req.body?.action === 'deny') {
    redirect.searchParams.set('error', 'access_denied');
    redirect.searchParams.set('state', pending.state);
    pendingAuthorize.delete(state);
    res.redirect(redirect.toString());
    return;
  }

  try {
    const { code } = await issueAuthorizationCode(wallet, {
      clientId: pending.clientId,
      redirectUri: pending.redirectUri,
      agentSub: pending.agentSub,
      scope: pending.scope,
      state: pending.state,
      codeChallenge: pending.codeChallenge,
      codeChallengeMethod: 'S256',
      userId,
    });
    authCodeMeta.set(code, { agentSub: pending.agentSub, userId });
    redirect.searchParams.set('code', code);
    redirect.searchParams.set('state', pending.state);
    pendingAuthorize.delete(state);
    res.redirect(redirect.toString());
  } catch (err) {
    sendDppError(res, err);
  }
});

app.post('/oauth/token', async (req, res) => {
  try {
    if (req.body?.grant_type !== 'authorization_code') {
      res.status(400).json({ error: 'unsupported_grant_type' });
      return;
    }
    const code = String(req.body.code ?? '');
    const meta = authCodeMeta.get(code);
    const tokens = await wallet.exchangeCode({
      code,
      redirectUri: String(req.body.redirect_uri ?? ''),
      codeVerifier: String(req.body.code_verifier ?? ''),
      clientId: String(req.body.client_id ?? ''),
    });
    authCodeMeta.delete(code);
    if (meta) {
      delegationByAccessToken.set(tokens.accessToken, {
        delegationId: tokens.delegationId,
        agentSub: meta.agentSub,
        userId: meta.userId,
      });
    }
    res.json({
      access_token: tokens.accessToken,
      token_type: tokens.tokenType,
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
      dpp_delegation_id: tokens.delegationId,
      dpp_agent_sub: meta?.agentSub,
    });
  } catch (err) {
    sendDppError(res, err);
  }
});

app.post('/v1/delegations/issue', async (req, res) => {
  const auth = req.headers.authorization ?? '';
  if (!auth.startsWith('Bearer ')) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const accessToken = auth.slice(7);
  const delegation = delegationByAccessToken.get(accessToken);
  if (!delegation) {
    res.status(401).json({ error: 'invalid_token' });
    return;
  }

  try {
    const body = req.body ?? {};
    const capability = await wallet.issueCapability({
      sub: body.agentSub ?? delegation.agentSub,
      scopes: body.scopes ?? ['pay:initiate'],
      constraints: body.constraints ?? {
        maxAmount: { value: '25.00', currency: 'USD' },
        merchantAllowlist: ['merchant:example_com'],
        paymentMethods: ['card'],
      },
      intentBind: body.intentBind,
      ttlSeconds: body.ttlSeconds,
    });
    res.json({
      capabilityToken: capability.compactJws,
      jti: capability.jti,
      expiresAt: capability.expiresAt,
      delegationId: delegation.delegationId,
    });
  } catch (err) {
    sendDppError(res, err);
  }
});

app.post('/v1/delegations/revoke', async (req, res) => {
  const userId = requireSession(req, res);
  if (!userId) return;
  const agentSub = String(req.body?.agentSub ?? demoAgent?.sub ?? '');
  try {
    await wallet.revokeDelegation(userId, agentSub);
    res.status(204).end();
  } catch (err) {
    sendDppError(res, err);
  }
});

await bootstrap();

app.listen(PORT, () => {
  console.log(`DPP wallet MVP listening on http://127.0.0.1:${PORT} (issuer ${ISSUER})`);
});
