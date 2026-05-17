/**
 * Smoke test without starting a long-lived server.
 * Run: npm run smoke (from this directory, after merchant-sdk build).
 */

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = 3341;
const base = `http://127.0.0.1:${PORT}`;

const smokeEnv = { ...process.env, PORT: String(PORT) };
delete smokeEnv.STRIPE_SECRET_KEY;
delete smokeEnv.STRIPE_WEBHOOK_SECRET;

const child = spawn('node', ['server.mjs'], {
  env: smokeEnv,
  stdio: ['ignore', 'pipe', 'pipe'],
});

let booted = false;
child.stdout.on('data', (chunk) => {
  if (chunk.toString().includes('listening')) booted = true;
});

for (let i = 0; i < 30 && !booted; i++) {
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

  const sandboxPage = await fetch(`${base}/sandbox/`);
  if (!sandboxPage.ok) throw new Error('sandbox UI not served');
  const html = await sandboxPage.text();
  if (!html.includes('DPP Sandbox Console')) throw new Error('sandbox HTML missing title');
  if (!html.includes('error-panel')) throw new Error('sandbox HTML missing error panel');
  if (!html.includes('bad-token-toggle')) throw new Error('sandbox HTML missing bad-token toggle');
  if (!html.includes('chat-agent') && !html.includes('Chat agent')) {
    throw new Error('sandbox HTML missing chat agent tab');
  }
  if (!html.includes('btn-chat-confirm')) throw new Error('sandbox HTML missing chat confirm');

  const mintPay = await fetch(`${base}/demo/capability`, { method: 'POST' }).then((r) => r.json());

  const mintVerify = await fetch(`${base}/demo/capability`, { method: 'POST' }).then((r) => r.json());
  const verifyOnly = await fetch(`${base}/delegation/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      capabilityToken: mintVerify.capabilityToken,
      paymentIntent: mintVerify.paymentIntent,
    }),
  }).then((r) => r.json());
  if (verifyOnly.verdict !== 'delegation_valid') {
    throw new Error(`verify-only expected delegation_valid, got ${JSON.stringify(verifyOnly)}`);
  }

  const corrupt =
    mintVerify.capabilityToken.length > 4
      ? `${mintVerify.capabilityToken.slice(0, -4)}xxxx`
      : `${mintVerify.capabilityToken}x`;
  const badRes = await fetch(`${base}/delegation/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      capabilityToken: corrupt,
      paymentIntent: mintVerify.paymentIntent,
    }),
  });
  const badBody = await badRes.json();
  const badJson = JSON.stringify(badBody);
  if (badRes.ok) throw new Error('bad token should fail');
  if (!badBody.code || !badBody.message) throw new Error('bad token missing DPPError shape');
  if (/stack/i.test(badJson)) throw new Error('bad token response must not include stack');

  const pay = await fetch(`${base}/payments/delegate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      capabilityToken: mintPay.capabilityToken,
      paymentIntent: mintPay.paymentIntent,
    }),
  }).then((r) => r.json());

  if (pay.status !== 'succeeded') {
    throw new Error(`expected succeeded, got ${JSON.stringify(pay)}`);
  }

  console.log(JSON.stringify({ smoke: 'ok', payment: pay.status, verdict: pay.verdict }, null, 2));
} finally {
  child.kill();
}
