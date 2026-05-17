import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createWalletIssuer,
  DPP_ERROR_CODE,
  DPPError,
} from '../dist/index.js';

const devConfig = {
  issuer: 'https://wallet.example/issuer',
  signingKey: {
    type: 'local',
    kid: 'dev-1',
    privateJwk: { kty: 'EC', crv: 'P-256', d: 'test' },
  },
};

describe('dpp-wallet-sdk scaffold', () => {
  it('createWalletIssuer rejects non-HTTPS issuer', () => {
    assert.throws(
      () =>
        createWalletIssuer({
          ...devConfig,
          issuer: 'http://insecure.example/issuer',
        }),
      (err) => err instanceof DPPError && err.code === DPP_ERROR_CODE.INVALID_CONFIG,
    );
  });

  it('createWalletIssuer returns issuer client', () => {
    const wallet = createWalletIssuer(devConfig);
    assert.equal(wallet.config.issuer, devConfig.issuer);
  });

  it('issueCapability throws not_implemented', async () => {
    const wallet = createWalletIssuer(devConfig);
    await assert.rejects(
      () =>
        wallet.issueCapability({
          sub: 'did:key:z6Mk…',
          scopes: ['pay:initiate'],
          constraints: {
            maxAmount: { value: '100.00', currency: 'INR' },
            merchantAllowlist: ['merchant:demo'],
          },
        }),
      (err) => err instanceof DPPError && err.code === DPP_ERROR_CODE.NOT_IMPLEMENTED,
    );
  });
});
