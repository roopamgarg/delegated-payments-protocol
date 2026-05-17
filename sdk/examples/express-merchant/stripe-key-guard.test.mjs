import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveStripePspMode } from './stripe-key-guard.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));

assert.deepEqual(resolveStripePspMode(undefined), { mode: 'stripe_mock', useStripe: false });
assert.deepEqual(resolveStripePspMode('sk_test_abc'), {
  mode: 'stripe_test',
  useStripe: true,
});

function runGuard(script) {
  return spawnSync(
    process.execPath,
    ['--input-type=module', '-e', script],
    { cwd: here, stdio: 'pipe' },
  );
}

const live = runGuard(
  "import { resolveStripePspMode } from './stripe-key-guard.mjs'; resolveStripePspMode('sk_live_secret');",
);
assert.equal(live.status, 1);
assert.match(live.stderr.toString(), /live key/i);

const bad = runGuard(
  "import { resolveStripePspMode } from './stripe-key-guard.mjs'; resolveStripePspMode('sk_prod_secret');",
);
assert.equal(bad.status, 1);
assert.match(bad.stderr.toString(), /sk_test_/i);

const sandboxMissing = runGuard(
  "import { resolveStripePspMode } from './stripe-key-guard.mjs'; resolveStripePspMode(undefined, { requireTestKey: true });",
);
assert.equal(sandboxMissing.status, 1);
assert.match(sandboxMissing.stderr.toString(), /STRIPE_SECRET_KEY is not set/i);

console.log('stripe-key-guard: ok');
