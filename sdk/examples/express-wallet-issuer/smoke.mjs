/**
 * Smoke test: OAuth metadata, JWKS, capability mint, intent submit.
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
    DPP_ISSUER: `https://127.0.0.1:${PORT}/issuer`,
    DPP_DEMO_AUTO_CONSENT: '1',
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

  const unauthRegister = await fetch(`${base}/v1/agents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      sub: 'did:key:z6MkSmokeUnauthAgent',
      displayName: 'Smoke unauth',
      redirectUris: [`http://127.0.0.1:${PORT}/demo/oauth/callback`],
    }),
  });
  if (unauthRegister.status !== 401) {
    throw new Error(`POST /v1/agents without token expected 401, got ${unauthRegister.status}`);
  }

  const metadata = await fetch(`${base}/.well-known/oauth-authorization-server`).then((r) =>
    r.json(),
  );
  if (!metadata.token_endpoint?.includes('/oauth/token')) {
    throw new Error('oauth metadata missing token_endpoint');
  }

  const jwks = await fetch(`${base}/.well-known/jwks.json`).then((r) => r.json());
  if (!jwks.keys?.length) throw new Error('jwks empty');

  const mint = await fetch(`${base}/demo/capability`, { method: 'POST' }).then((r) => r.json());
  if (!mint.capabilityToken) throw new Error('demo capability mint failed');

  const intent = await fetch(`${base}/v1/intents`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      paymentIntent: mint.paymentIntent,
      capabilityToken: mint.capabilityToken,
    }),
  }).then((r) => r.json());

  if (intent.state !== 'succeeded') {
    throw new Error(`expected succeeded intent, got ${intent.state}`);
  }

  const polled = await fetch(`${base}/v1/intents/${intent.intentId}`).then((r) => r.json());
  if (polled.state !== 'succeeded') {
    throw new Error(`poll expected succeeded, got ${polled.state}`);
  }

  const { codeVerifier, codeChallenge } = pkcePair();
  const authorizeUrl = new URL(`${base}/oauth/authorize`);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', 'demo-agent-client');
  authorizeUrl.searchParams.set('redirect_uri', `http://127.0.0.1:${PORT}/demo/oauth/callback`);
  authorizeUrl.searchParams.set('scope', 'dpp:delegation:read dpp:intent:write');
  authorizeUrl.searchParams.set('state', 'smoke-state');
  authorizeUrl.searchParams.set('code_challenge', codeChallenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  authorizeUrl.searchParams.set('dpp_agent_sub', health.agentSub);

  const redirectRes = await fetch(authorizeUrl, { redirect: 'manual' });
  const location = redirectRes.headers.get('location');
  if (!location) throw new Error('oauth authorize did not redirect');
  const code = new URL(location).searchParams.get('code');
  if (!code) throw new Error('authorization code missing');

  const tokenRes = await fetch(`${base}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `http://127.0.0.1:${PORT}/demo/oauth/callback`,
      client_id: 'demo-agent-client',
      code_verifier: codeVerifier,
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokens.access_token || !tokens.dpp_delegation_id) {
    throw new Error('token exchange failed');
  }

  console.log(
    JSON.stringify(
      {
        smoke: 'ok',
        jwksKids: jwks.keys.map((k) => k.kid),
        intent: intent.state,
        delegationId: tokens.dpp_delegation_id,
      },
      null,
      2,
    ),
  );
} finally {
  child.kill();
}
