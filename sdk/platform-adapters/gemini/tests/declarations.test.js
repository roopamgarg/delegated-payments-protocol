import assert from 'node:assert/strict';
import test from 'node:test';
import { DPP_GEMINI_FUNCTION_DECLARATIONS } from '../dist/declarations.js';
import { executeGeminiFunctionCall } from '../dist/executor.js';

test('declarations mirror MCP tool names', () => {
  const names = DPP_GEMINI_FUNCTION_DECLARATIONS.map((d) => d.name).sort();
  assert.deepEqual(names, [
    'confirm_payment',
    'get_payment_status',
    'link_wallet',
    'preview_payment',
  ]);
});

test('executor rejects unknown tools without network', async () => {
  const fakeSession = { config: {}, vault: {} };
  const out = await executeGeminiFunctionCall(fakeSession, {
    name: 'not_a_tool',
    args: {},
  });
  assert.equal(out.code, 'unknown_tool');
});

test('link_wallet requires userId', async () => {
  const fakeSession = { config: {}, vault: {} };
  await assert.rejects(
    () => executeGeminiFunctionCall(fakeSession, { name: 'link_wallet', args: {} }),
    /userId/,
  );
});
