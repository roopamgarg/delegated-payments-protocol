import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createMerchant } from '../dist/merchant.js';

const credentials = { secretKey: 'sk_test_demo_only' };
const jwks = { keys: [{ kty: 'EC', crv: 'P-256', x: 'x', y: 'y', kid: 'demo' }] };

test('createMerchant rejects production config without issuerAllowlist', () => {
  assert.throws(
    () =>
      createMerchant({
        psp: 'stripe',
        trust: { jwks, audience: ['merchant:example_com'] },
        credentials,
      }),
    (err) => err.code === 'invalid_token' && err.details?.field === 'issuerAllowlist',
  );
});

test('createMerchant rejects production config without audience', () => {
  assert.throws(
    () =>
      createMerchant({
        psp: 'stripe',
        trust: { jwks, issuerAllowlist: ['https://wallet.example/issuer'] },
        credentials,
      }),
    (err) => err.code === 'invalid_token' && err.details?.field === 'audience',
  );
});

test('createMerchant allows dev trust flag without issuer or audience', () => {
  assert.doesNotThrow(() =>
    createMerchant({
      psp: 'stripe',
      trust: { jwks, allowInsecureTrustConfig: true },
      credentials,
    }),
  );
});

test('createMerchant accepts full production trust config', () => {
  assert.doesNotThrow(() =>
    createMerchant({
      psp: 'stripe',
      trust: {
        jwks,
        issuerAllowlist: ['https://wallet.example/issuer'],
        audience: ['merchant:example_com'],
      },
      credentials,
    }),
  );
});
