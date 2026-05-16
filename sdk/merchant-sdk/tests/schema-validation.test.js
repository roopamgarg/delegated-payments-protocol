import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as jose from 'jose';
import {
  generateTestKeyPair,
  signCapabilityForTest,
  verifyCapabilityJws,
} from '../dist/crypto/jws.js';
import { InMemoryNonceStore } from '../dist/crypto/nonce-store.js';

test('missing constraints yields invalid_token', async () => {
  const { privateKey, publicJwk } = await generateTestKeyPair();
  const jwks = { keys: [{ ...publicJwk, kid: 'test-key', alg: 'ES256', use: 'sig' }] };

  const payload = {
    dpp: '0.1',
    typ: 'capability',
    iss: 'https://wallet.example/issuer',
    sub: 'did:key:z6Mkagent',
    exp: Math.floor(Date.now() / 1000) + 600,
    nonce: 'schema_test_001',
    scopes: ['pay:initiate'],
  };

  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .sign(privateKey);

  await assert.rejects(
    () =>
      verifyCapabilityJws(jwt, {
        jwks,
        nonceStore: new InMemoryNonceStore(),
      }),
    (err) => err.code === 'invalid_token' && err.name === 'DPPError',
  );
});

test('malformed nonce pattern yields invalid_token without throwing', async () => {
  const { privateKey, publicJwk } = await generateTestKeyPair();
  const jwks = { keys: [{ ...publicJwk, kid: 'test-key', alg: 'ES256', use: 'sig' }] };

  const payload = {
    dpp: '0.1',
    typ: 'capability',
    iss: 'https://wallet.example/issuer',
    sub: 'did:key:z6Mkagent',
    exp: Math.floor(Date.now() / 1000) + 600,
    nonce: 'bad nonce!',
    scopes: ['pay:initiate'],
    constraints: {
      maxAmount: { value: '25.00', currency: 'USD' },
      merchantAllowlist: ['merchant:example_com'],
    },
  };

  const jwt = await signCapabilityForTest(payload, privateKey);

  await assert.rejects(
    () =>
      verifyCapabilityJws(jwt, {
        jwks,
        nonceStore: new InMemoryNonceStore(),
      }),
    (err) => err.code === 'invalid_token' && err instanceof Error,
  );
});
