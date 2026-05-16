import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as jose from 'jose';
import {
  generateTestKeyPair,
  signCapabilityForTest,
  verifyCapabilityJws,
} from '../dist/crypto/jws.js';
import { InMemoryNonceStore } from '../dist/crypto/nonce-store.js';
import {
  ARTIFACT_TYPE,
  DPP_ERROR_CODE,
  DPP_ERROR_CLASS_NAME,
  DPP_VERSION,
  JWS,
} from '../dist/constants.js';

test('missing constraints yields invalid_token', async () => {
  const { privateKey, publicJwk } = await generateTestKeyPair();
  const jwks = { keys: [{ ...publicJwk, kid: JWS.TEST_KEY_ID, alg: JWS.ALG_ES256, use: 'sig' }] };

  const payload = {
    dpp: DPP_VERSION,
    typ: ARTIFACT_TYPE.CAPABILITY,
    iss: 'https://wallet.example/issuer',
    sub: 'did:key:z6Mkagent',
    exp: Math.floor(Date.now() / 1000) + 600,
    nonce: 'schema_test_001',
    scopes: ['pay:initiate'],
  };

  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: JWS.ALG_ES256, kid: JWS.TEST_KEY_ID })
    .sign(privateKey);

  await assert.rejects(
    () =>
      verifyCapabilityJws(jwt, {
        jwks,
        nonceStore: new InMemoryNonceStore(),
      }),
    (err) => err.code === DPP_ERROR_CODE.INVALID_TOKEN && err.name === DPP_ERROR_CLASS_NAME,
  );
});

test('malformed nonce pattern yields invalid_token without throwing', async () => {
  const { privateKey, publicJwk } = await generateTestKeyPair();
  const jwks = { keys: [{ ...publicJwk, kid: JWS.TEST_KEY_ID, alg: JWS.ALG_ES256, use: 'sig' }] };

  const payload = {
    dpp: DPP_VERSION,
    typ: ARTIFACT_TYPE.CAPABILITY,
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
    (err) => err.code === DPP_ERROR_CODE.INVALID_TOKEN && err instanceof Error,
  );
});
