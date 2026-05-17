/**
 * Start the express-merchant harness for board sandbox verification.
 * Builds merchant-sdk, requires sk_test_, binds 127.0.0.1 only.
 *
 * Usage: npm run sandbox
 */

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadEnvLocal, resolveStripePspMode } from './stripe-key-guard.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const merchantSdkDir = join(__dirname, '../../merchant-sdk');
const PORT = Number(process.env.PORT ?? 3340);
const HOST = '127.0.0.1';

loadEnvLocal(__dirname);

const { mode: pspMode } = resolveStripePspMode(process.env.STRIPE_SECRET_KEY, {
  requireTestKey: true,
});

console.log('[sandbox] Building dpp-merchant-sdk…');
const build = spawn('npm', ['run', 'build'], {
  cwd: merchantSdkDir,
  stdio: 'inherit',
  shell: true,
});

build.on('close', (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }
  startServer();
});

function startServer() {
  const url = `http://${HOST}:${PORT}`;
  console.log('');
  console.log('────────────────────────────────────────────');
  console.log('  DPP sandbox harness (Stripe Test Mode)');
  console.log(`  API:      ${url}`);
  console.log(`  Console:  ${url}/sandbox`);
  console.log(`  PSP mode: ${pspMode}`);
  console.log('  SANDBOX ONLY — bind 127.0.0.1, no live keys');
  console.log('────────────────────────────────────────────');
  console.log('');

  const child = spawn('node', ['server.mjs'], {
    cwd: __dirname,
    env: {
      ...process.env,
      PORT: String(PORT),
      DPP_BIND_HOST: HOST,
    },
    stdio: 'inherit',
  });

  child.on('exit', (code) => process.exit(code ?? 0));
}
