import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as jose from 'jose';
import { createWalletIssuer } from '../dist/index.js';

const issuerUrl = 'https://wallet.example/issuer';

describe('dpp-wallet-sdk capability JWKS (AGE-36)', () => {
  it('rotateKeys retains previous kid in JWKS until retention expires', async () => {
    const { privateKey: keyA } = await jose.generateKeyPair('ES256', { extractable: true });
    const { privateKey: keyB } = await jose.generateKeyPair('ES256', { extractable: true });
    const jwkA = await jose.exportJWK(keyA);
    const jwkB = await jose.exportJWK(keyB);

    const wallet = createWalletIssuer({
      issuer: issuerUrl,
      keyRotation: { retentionSeconds: 3600 },
      signingKey: {
        type: 'local',
        kid: 'key-a',
        privateJwk: { ...jwkA, alg: 'ES256', use: 'sig' },
      },
    });

    const tokenA = await wallet.issueCapability({
      sub: 'did:key:z6Mkagent',
      scopes: ['pay:initiate'],
      constraints: {
        maxAmount: { value: '10.00', currency: 'USD' },
        merchantAllowlist: ['merchant:example'],
      },
    });

    const before = await wallet.exportJwks();
    assert.equal(before.keys.length, 1);
    assert.equal(before.keys[0]?.kid, 'key-a');

    await wallet.rotateKeys({
      type: 'local',
      kid: 'key-b',
      privateJwk: { ...jwkB, alg: 'ES256', use: 'sig' },
    });

    const after = await wallet.exportJwks();
    assert.equal(after.keys.length, 2);
    const kids = after.keys.map((k) => k.kid).sort();
    assert.deepEqual(kids, ['key-a', 'key-b']);

    const tokenB = await wallet.issueCapability({
      sub: 'did:key:z6Mkagent',
      scopes: ['pay:initiate'],
      constraints: {
        maxAmount: { value: '20.00', currency: 'USD' },
        merchantAllowlist: ['merchant:example'],
      },
    });

    assert.notEqual(tokenA.compactJws, tokenB.compactJws);
  });
});
