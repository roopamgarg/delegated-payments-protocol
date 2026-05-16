import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as jose from 'jose';
import {
  generateTestKeyPair,
  signCapabilityForTest,
  verifyCapabilityJws,
} from '../dist/crypto/jws.js';
import {
  ARTIFACT_TYPE,
  DPP_ERROR_CODE,
  DPP_VERSION,
  FORBIDDEN_CLAIM,
  JWS,
} from '../dist/constants.js';

test('verifyCapabilityJws round-trip with test key', async () => {
  const { privateKey, publicJwk } = await generateTestKeyPair();
  const jwks = { keys: [{ ...publicJwk, kid: JWS.TEST_KEY_ID, alg: JWS.ALG_ES256, use: 'sig' }] };

  const payload = {
    dpp: DPP_VERSION,
    typ: ARTIFACT_TYPE.CAPABILITY,
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
  const jwks = { keys: [{ ...publicJwk, kid: JWS.TEST_KEY_ID, alg: JWS.ALG_ES256, use: 'sig' }] };

  const payload = {
    dpp: DPP_VERSION,
    typ: ARTIFACT_TYPE.CAPABILITY,
    iss: 'https://wallet.example/issuer',
    sub: 'did:key:z6Mkagent',
    exp: Math.floor(Date.now() / 1000) + 600,
    nonce: 'nonce00000002',
    scopes: ['pay:initiate'],
    constraints: {
      maxAmount: { value: '25.00', currency: 'USD' },
      merchantAllowlist: ['merchant:example_com'],
    },
    [FORBIDDEN_CLAIM.OTP_BYPASS]: true,
  };

  const jwt = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: JWS.ALG_ES256, kid: JWS.TEST_KEY_ID })
    .sign(privateKey);

  await assert.rejects(
    () => verifyCapabilityJws(jwt, { jwks }),
    (err) => err.code === DPP_ERROR_CODE.FORBIDDEN_CLAIM,
  );
});
