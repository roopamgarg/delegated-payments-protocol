/**
 * Smoke: OAuth link flow + JWKS + capability issue (no long-lived server).
 * Run: npm run smoke (from this directory, after wallet-sdk build).
 */

import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = 3352;
const base = `http://127.0.0.1:${PORT}`;

function pkcePair() {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

const child = spawn('node', ['server.mjs'], {
  env: {
    ...process.env,
    PORT: String(PORT),
    WALLET_ISSUER: `https://127.0.0.1:${PORT}/issuer`,
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let booted = false;
child.stdout.on('data', (chunk) => {
  if (chunk.toString().includes('listening')) booted = true;
});

for (let i = 0; i < 40 && !booted; i++) {
  await delay(100);
}

if (!booted) {
  child.kill();
  console.error('Server failed to start');
  process.exit(1);
}

try {
  const health = await fetch(`${base}/health`).then((r) => r.json());
  if (!health.ok) throw new Error('health check failed');

  const jwks = await fetch(`${base}/.well-known/jwks.json`).then((r) => r.json());
  if (!jwks.keys?.length) throw new Error('JWKS missing keys');

  const { codeVerifier, codeChallenge } = pkcePair();
  const state = 'smoke-state-1';
  const clientId = health.demoClientId;
  const agentSub = health.demoAgentSub;
  const redirectUri = 'http://127.0.0.1:8765/oauth/callback';
  const scope = 'dpp:delegation:read dpp:delegation:issue';

  const authorizeUrl = new URL(`${base}/oauth/authorize`);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('scope', scope);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('dpp_agent_sub', agentSub);

  const loginRes = await fetch(`${base}/login`, { method: 'POST', redirect: 'manual' });
  const setCookie = loginRes.headers.getSetCookie?.() ?? [];
  const sessionCookie = setCookie.find((c) => c.startsWith('dpp_wallet_session='));
  if (!sessionCookie) throw new Error('login did not set session cookie');

  const consentRes = await fetch(authorizeUrl.toString(), {
    headers: { cookie: sessionCookie.split(';')[0] },
    redirect: 'manual',
  });
  if (consentRes.status !== 200) {
    throw new Error(`expected consent HTML, got ${consentRes.status}`);
  }

  const consentBody = await consentRes.text();
  if (!consentBody.includes('Agent consent')) {
    throw new Error('consent page missing expected title');
  }

  const approveRes = await fetch(`${base}/oauth/consent`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      cookie: sessionCookie.split(';')[0],
    },
    body: new URLSearchParams({ state, action: 'approve' }),
    redirect: 'manual',
  });
  if (approveRes.status !== 302) {
    throw new Error(`expected redirect after approve, got ${approveRes.status}`);
  }
  const location = approveRes.headers.get('location');
  if (!location) throw new Error('missing redirect location');
  const callback = new URL(location);
  const code = callback.searchParams.get('code');
  if (!code) throw new Error('authorization code missing from redirect');

  const tokenRes = await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
      client_id: clientId,
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok) throw new Error(`token exchange failed: ${JSON.stringify(tokens)}`);
  if (!tokens.access_token) throw new Error('access_token missing');

  const capRes = await fetch(`${base}/v1/delegations/issue`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${tokens.access_token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      scopes: ['pay:initiate'],
      constraints: {
        maxAmount: { value: '10.00', currency: 'USD' },
        merchantAllowlist: ['merchant:example_com'],
        paymentMethods: ['card'],
      },
    }),
  });
  const capability = await capRes.json();
  if (!capRes.ok) throw new Error(`delegation issue failed: ${JSON.stringify(capability)}`);
  if (!capability.capabilityToken?.includes('.')) {
    throw new Error('capabilityToken does not look like a JWS');
  }

  const railsRes = await fetch(`${base}/v1/users/me/rails`, {
    headers: { cookie: sessionCookie.split(';')[0] },
  });
  const rails = await railsRes.json();
  if (!Array.isArray(rails.rails)) throw new Error('rails catalog missing');

  console.log(
    JSON.stringify(
      {
        smoke: 'ok',
        jwksKids: jwks.keys.map((k) => k.kid),
        delegationId: tokens.dpp_delegation_id,
        capabilityJti: capability.jti,
      },
      null,
      2,
    ),
  );
} finally {
  child.kill();
}
