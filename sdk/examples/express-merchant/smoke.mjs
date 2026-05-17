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

  const mint = await fetch(`${base}/demo/capability`, { method: 'POST' }).then((r) => r.json());

  const pay = await fetch(`${base}/payments/delegate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      capabilityToken: mint.capabilityToken,
      paymentIntent: mint.paymentIntent,
    }),
  }).then((r) => r.json());

  if (pay.status !== 'succeeded') {
    throw new Error(`expected succeeded, got ${JSON.stringify(pay)}`);
  }

  console.log(JSON.stringify({ smoke: 'ok', payment: pay.status, verdict: pay.verdict }, null, 2));
} finally {
  child.kill();
}
