import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as jose from 'jose';
import {
  createWalletIssuer,
  DPP_ERROR_CODE,
  DPPError,
} from '../dist/index.js';
import { verifyCapabilityJws } from '../../merchant-sdk/dist/crypto/jws.js';

const issuerUrl = 'https://wallet.example/issuer';

describe('dpp-wallet-sdk scaffold', () => {
  it('createWalletIssuer rejects non-HTTPS issuer', () => {
    assert.throws(
      () =>
        createWalletIssuer({
          issuer: 'http://insecure.example/issuer',
          signingKey: {
            type: 'local',
            kid: 'dev-1',
            privateJwk: { kty: 'EC', crv: 'P-256', d: 'test' },
          },
        }),
      (err) => err instanceof DPPError && err.code === DPP_ERROR_CODE.INVALID_CONFIG,
    );
  });

  it('createWalletIssuer returns issuer client', () => {
    const wallet = createWalletIssuer({
      issuer: issuerUrl,
      signingKey: {
        type: 'local',
        kid: 'dev-1',
        privateJwk: { kty: 'EC', crv: 'P-256', d: 'test' },
      },
    });
    assert.equal(wallet.config.issuer, issuerUrl);
  });

  it('issueCapability issues ES256 tokens verifiable by merchants', async () => {
    const { privateKey } = await jose.generateKeyPair('ES256', { extractable: true });
    const privateJwk = await jose.exportJWK(privateKey);
    const wallet = createWalletIssuer({
      issuer: issuerUrl,
      defaultCapabilityTtlSeconds: 600,
      signingKey: {
        type: 'local',
        kid: 'dev-issue',
        privateJwk: { ...privateJwk, alg: 'ES256', use: 'sig' },
      },
    });

    const now = Math.floor(Date.now() / 1000);
    const result = await wallet.issueCapability({
      sub: 'did:key:z6Mkagent',
      aud: ['merchant:example'],
      scopes: ['pay:initiate'],
      constraints: {
        maxAmount: { value: '250.00', currency: 'USD' },
        merchantAllowlist: ['merchant:example'],
      },
    });

    const defaultTtl = wallet.config.defaultCapabilityTtlSeconds ?? 600;
    const ttlDelta = result.expiresAt - now;
    assert(ttlDelta >= defaultTtl);
    assert(ttlDelta <= defaultTtl + 1);
    assert.ok(result.jti.length);

    const jwks = await wallet.exportJwks();
    assert.equal(jwks.keys[0]?.kid, wallet.config.signingKey.kid);

    const verified = await verifyCapabilityJws(result.compactJws, {
      jwks,
      issuerAllowlist: [wallet.config.issuer],
      audience: ['merchant:example'],
    });

    assert.equal(verified.iss, wallet.config.issuer);
    assert.equal(verified.sub, 'did:key:z6Mkagent');
    assert.equal(verified.jti, result.jti);
  });
});
