/**
 * Stripe secret key guardrails for local sandbox runs.
 * Rejects live keys; requires sk_test_ when a secret is configured.
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const LIVE_PREFIX = 'sk_live_';
const TEST_PREFIX = 'sk_test_';

/** @typedef {'stripe_mock' | 'stripe_test'} StripePspMode */

/**
 * Parse KEY=VALUE lines from `.env.local` (gitignored). Does not override existing env.
 * @param {string} dir
 */
export function loadEnvLocal(dir) {
  for (const name of ['.env', '.env.local']) {
    loadEnvFile(join(dir, name));
  }
}

/**
 * @param {string} path
 */
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

/**
 * Resolve PSP mode from STRIPE_SECRET_KEY and exit on unsafe keys.
 * @param {string | undefined} secretKey
 * @param {{ requireTestKey?: boolean }} [opts]
 * @returns {{ mode: StripePspMode, useStripe: boolean }}
 */
export function resolveStripePspMode(secretKey, opts = {}) {
  const { requireTestKey = false } = opts;

  if (!secretKey?.trim()) {
    if (requireTestKey) {
      fail(
        'STRIPE_SECRET_KEY is not set. Copy .env.example to .env (or .env.local) and add your Stripe **test** secret (sk_test_…). See README “Stripe Test Mode sandbox”.',
      );
    }
    return { mode: 'stripe_mock', useStripe: false };
  }

  const key = secretKey.trim();

  if (key.startsWith(LIVE_PREFIX)) {
    fail(
      'STRIPE_SECRET_KEY must not be a live key (sk_live_…). ' +
        'Use Stripe Test Mode: Dashboard → Developers → API keys → Secret key (sk_test_…). ' +
        'Never commit API keys.',
    );
  }

  if (!key.startsWith(TEST_PREFIX)) {
    fail(
      'STRIPE_SECRET_KEY must be a Stripe test secret (sk_test_…). ' +
        'Copy the Test mode secret from Dashboard → Developers → API keys. ' +
        'Unset STRIPE_SECRET_KEY to use the in-memory mock instead.',
    );
  }

  return { mode: 'stripe_test', useStripe: true };
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`[express-merchant] ${message}`);
  process.exit(1);
}
