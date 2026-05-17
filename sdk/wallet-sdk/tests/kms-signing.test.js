import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as jose from 'jose';
import { createWalletIssuer } from '../dist/index.js';
import { createTestKmsSigningKey } from '../dist/crypto/keys.js';
import { verifyCapabilityJws } from '../../merchant-sdk/dist/crypto/jws.js';

const issuerUrl = 'https://wallet.example/issuer';

describe('dpp-wallet-sdk KMS signing', () => {
  it('issues capabilities via injected KMS signer without local private JWK', async () => {
    const { privateKey } = await jose.generateKeyPair('ES256', { extractable: true });
    const privateJwk = await jose.exportJWK(privateKey);
    const { signingKey, kmsSigner } = await createTestKmsSigningKey(
      { ...privateJwk, alg: 'ES256', use: 'sig' },
      'kms-active',
    );

    const wallet = createWalletIssuer({
      issuer: issuerUrl,
      signingKey,
      kmsSigner,
    });

    const result = await wallet.issueCapability({
      sub: 'did:key:z6Mkkms',
      aud: ['merchant:kms'],
      scopes: ['pay:initiate'],
      constraints: {
        maxAmount: { value: '99.00', currency: 'USD' },
        merchantAllowlist: ['merchant:kms'],
      },
    });

    const jwks = await wallet.exportJwks();
    assert.equal(jwks.keys.length, 1);
    assert.equal(jwks.keys[0]?.kid, 'kms-active');

    const verified = await verifyCapabilityJws(result.compactJws, {
      jwks,
      issuerAllowlist: [issuerUrl],
      audience: ['merchant:kms'],
    });
    assert.equal(verified.sub, 'did:key:z6Mkkms');
  });

  it('rotateKeys retains previous kid in JWKS until retention expires', async () => {
    const pairA = await jose.generateKeyPair('ES256', { extractable: true });
    const pairB = await jose.generateKeyPair('ES256', { extractable: true });
    const jwkA = await jose.exportJWK(pairA.privateKey);
    const jwkB = await jose.exportJWK(pairB.privateKey);

    const active = await createTestKmsSigningKey(
      { ...jwkA, alg: 'ES256', use: 'sig' },
      'kid-a',
      'kms-a',
    );
    const next = await createTestKmsSigningKey(
      { ...jwkB, alg: 'ES256', use: 'sig' },
      'kid-b',
      'kms-b',
    );

    const wallet = createWalletIssuer({
      issuer: issuerUrl,
      signingKey: active.signingKey,
      kmsSigner: active.kmsSigner,
      keyRotation: { retentionSeconds: 3600 },
    });

    const before = await wallet.exportJwks();
    assert.equal(before.keys.length, 1);
    assert.equal(before.keys[0]?.kid, 'kid-a');

    const rotated = await wallet.rotateKeys(next.signingKey, next.kmsSigner);
    assert.equal(rotated.keys.length, 2);
    assert.deepEqual(
      rotated.keys.map((key) => key.kid).sort(),
      ['kid-a', 'kid-b'],
    );

    const after = await wallet.issueCapability({
      sub: 'did:key:z6Mkrotate',
      scopes: ['pay:initiate'],
      constraints: {
        maxAmount: { value: '10.00', currency: 'USD' },
        merchantAllowlist: ['merchant:kms'],
      },
    });

    const jwks = await wallet.exportJwks();
    const verified = await verifyCapabilityJws(after.compactJws, {
      jwks,
      issuerAllowlist: [issuerUrl],
    });
    assert.equal(verified.sub, 'did:key:z6Mkrotate');
  });
});
