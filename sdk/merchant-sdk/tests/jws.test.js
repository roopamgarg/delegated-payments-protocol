import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as jose from 'jose';
import {
  generateTestKeyPair,
  signCapabilityForTest,
  verifyCapabilityJws,
} from '../dist/crypto/jws.js';

test('verifyCapabilityJws round-trip with test key', async () => {
  const { privateKey, publicJwk } = await generateTestKeyPair();
  const jwks = { keys: [{ ...publicJwk, kid: 'test-key', alg: 'ES256', use: 'sig' }] };

  const payload = {
    dpp: '0.1',
    typ: 'capability',
    iss: 'https://wallet.example/issuer',
    sub: 'did:key:z6Mkagent',
    exp: Math.floor(Date.now() / 1000) + 600,
    nonce: 'nonce00000001',
    scopes: ['pay:initiate'],
    constraints: {
      maxAmount: { value: '25.00', currency: 'USD' },
      merchantAllowlist: ['merchant:example_com'],
    },
  };

  const jwt = await signCapabilityForTest(payload, privateKey);
  const verified = await verifyCapabilityJws(jwt, {
    jwks,
    issuerAllowlist: ['https://wallet.example/issuer'],
  });

  assert.equal(verified.sub, payload.sub);
});

test('verifyCapabilityJws rejects forbidden claim', async () => {
  const { privateKey, publicJwk } = await generateTestKeyPair();
  const jwks = { keys: [{ ...publicJwk, kid: 'test-key', alg: 'ES256', use: 'sig' }] };

  const payload = {
    dpp: '0.1',
    typ: 'capability',
    iss: 'https://wallet.example/issuer',
    sub: 'did:key:z6Mkagent',
    exp: Math.floor(Date.now() / 1000) + 600,
    nonce: 'nonce00000002',
    scopes: ['pay:initiate'],
    constraints: {
      maxAmount: { value: '25.00', currency: 'USD' },
      merchantAllowlist: ['merchant:example_com'],
    },
    'dpp:otpBypass': true,
  };

  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .sign(privateKey);

  await assert.rejects(
    () => verifyCapabilityJws(jwt, { jwks }),
    (err) => err.code === 'forbidden_claim',
  );
});

test('verifyCapabilityJws rejects untrusted issuer', async () => {
  const { privateKey, publicJwk } = await generateTestKeyPair();
  const jwks = { keys: [{ ...publicJwk, kid: 'test-key', alg: 'ES256', use: 'sig' }] };

  const payload = {
    dpp: '0.1',
    typ: 'capability',
    iss: 'https://evil.example/issuer',
    sub: 'did:key:z6Mkagent',
    exp: Math.floor(Date.now() / 1000) + 600,
    nonce: 'nonce00000003',
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
        issuerAllowlist: ['https://wallet.example/issuer'],
      }),
    (err) => err.code === 'untrusted_issuer',
  );
});

test('verifyCapabilityJws rejects audience mismatch', async () => {
  const { privateKey, publicJwk } = await generateTestKeyPair();
  const jwks = { keys: [{ ...publicJwk, kid: 'test-key', alg: 'ES256', use: 'sig' }] };

  const payload = {
    dpp: '0.1',
    typ: 'capability',
    iss: 'https://wallet.example/issuer',
    sub: 'did:key:z6Mkagent',
    aud: ['merchant:other_store'],
    exp: Math.floor(Date.now() / 1000) + 600,
    nonce: 'nonce00000004',
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
        issuerAllowlist: ['https://wallet.example/issuer'],
        audience: ['merchant:example_com'],
      }),
    (err) => err.code === 'invalid_signature',
  );
});
