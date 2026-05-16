import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateTestKeyPair,
  signCapabilityForTest,
  verifyCapabilityJws,
} from '../dist/crypto/jws.js';
import { InMemoryNonceStore } from '../dist/crypto/nonce-store.js';

const basePayload = () => ({
  dpp: '0.1',
  typ: 'capability',
  iss: 'https://wallet.example/issuer',
  sub: 'did:key:z6Mkagent',
  exp: Math.floor(Date.now() / 1000) + 600,
  scopes: ['pay:initiate'],
  constraints: {
    maxAmount: { value: '25.00', currency: 'USD' },
    merchantAllowlist: ['merchant:example_com'],
  },
});

test('rejects replayed nonce within TTL', async () => {
  const store = new InMemoryNonceStore();
  const { privateKey, publicJwk } = await generateTestKeyPair();
  const jwks = { keys: [{ ...publicJwk, kid: 'test-key', alg: 'ES256', use: 'sig' }] };

  const payload = { ...basePayload(), nonce: 'replay_nonce_001' };
  const jwt = await signCapabilityForTest(payload, privateKey);
  const trust = { jwks, issuerAllowlist: [payload.iss], nonceStore: store };

  await verifyCapabilityJws(jwt, trust);
  await assert.rejects(
    () => verifyCapabilityJws(jwt, trust),
    (err) => err.code === 'token_replay',
  );
});

test('rejects replayed jti within TTL', async () => {
  const store = new InMemoryNonceStore();
  const { privateKey, publicJwk } = await generateTestKeyPair();
  const jwks = { keys: [{ ...publicJwk, kid: 'test-key', alg: 'ES256', use: 'sig' }] };

  const payload = { ...basePayload(), nonce: 'replay_nonce_002', jti: 'jti_replay_001' };
  const jwt = await signCapabilityForTest(payload, privateKey);
  const trust = { jwks, nonceStore: store };

  await verifyCapabilityJws(jwt, trust);
  await assert.rejects(
    () => verifyCapabilityJws(jwt, trust),
    (err) => err.code === 'token_replay',
  );
});

test('idempotencyKey scopes nonce so distinct keys do not replay-block', async () => {
  const store = new InMemoryNonceStore();
  const { privateKey, publicJwk } = await generateTestKeyPair();
  const jwks = { keys: [{ ...publicJwk, kid: 'test-key', alg: 'ES256', use: 'sig' }] };

  const payload = { ...basePayload(), nonce: 'replay_nonce_003' };
  const jwt = await signCapabilityForTest(payload, privateKey);
  const trust = { jwks, nonceStore: store };

  await verifyCapabilityJws(jwt, trust, { idempotencyKey: 'idem_a' });
  await verifyCapabilityJws(jwt, trust, { idempotencyKey: 'idem_b' });
  await assert.rejects(
    () => verifyCapabilityJws(jwt, trust, { idempotencyKey: 'idem_a' }),
    (err) => err.code === 'token_replay',
  );
});
