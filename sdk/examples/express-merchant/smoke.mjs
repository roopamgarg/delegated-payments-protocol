/**
 * Smoke test without starting a long-lived server.
 * Run: npm run smoke (from this directory, after merchant-sdk build).
 */

import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const PORT = 3341;
const base = `http://127.0.0.1:${PORT}`;

const child = spawn('node', ['server.mjs'], {
  env: { ...process.env, PORT: String(PORT) },
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

  const mint = await fetch(`${base}/demo/capability`, { method: 'POST' }).then((r) => r.json());
  const verify = await fetch(`${base}/delegation/verify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      capabilityToken: mint.capabilityToken,
      paymentIntent: mint.paymentIntent,
    }),
  }).then((r) => r.json());

  if (verify.verdict !== 'delegation_valid') {
    throw new Error(`expected delegation_valid, got ${verify.verdict}`);
  }

  const pay = await fetch(`${base}/payments/delegate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      capabilityToken: mint.capabilityToken,
      paymentIntent: mint.paymentIntent,
    }),
  }).then((r) => r.json());

  if (pay.status !== 'succeeded') {
    throw new Error(`expected succeeded, got ${pay.status}`);
  }

  console.log(JSON.stringify({ smoke: 'ok', verify: verify.verdict, payment: pay.status }, null, 2));
} finally {
  child.kill();
}
