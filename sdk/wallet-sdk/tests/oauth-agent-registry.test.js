import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  createWalletIssuer,
  DPP_ERROR_CODE,
  DPP_OAUTH_SCOPE,
  DPPError,
  issueAuthorizationCode,
} from '../dist/index.js';

const devConfig = {
  issuer: 'https://wallet.example/issuer',
  signingKey: {
    type: 'local',
    kid: 'dev-1',
    privateJwk: { kty: 'EC', crv: 'P-256', d: 'test' },
  },
};

const agentProfile = {
  sub: 'did:key:z6MkagentTest',
  displayName: 'Demo MCP Agent',
  redirectUris: ['https://mcp.example/oauth/callback'],
};

function pkcePair() {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

describe('dpp-wallet-sdk oauth + agent registry (AGE-38)', () => {
  it('registerAgent and createAuthorizationUrl build PKCE authorize URL', async () => {
    const wallet = createWalletIssuer(devConfig);
    const { codeChallenge } = pkcePair();
    const registered = await wallet.registerAgent(agentProfile);

    const { url, state } = await wallet.createAuthorizationUrl({
      clientId: registered.clientId,
      redirectUri: agentProfile.redirectUris[0],
      scope: [DPP_OAUTH_SCOPE.DELEGATION_READ, DPP_OAUTH_SCOPE.INTENT_WRITE],
      state: 'csrf-state-1',
      codeChallenge,
      codeChallengeMethod: 'S256',
      agentSub: agentProfile.sub,
    });

    const parsed = new URL(url);
    assert.equal(parsed.pathname, '/oauth/authorize');
    assert.equal(parsed.searchParams.get('response_type'), 'code');
    assert.equal(parsed.searchParams.get('client_id'), registered.clientId);
    assert.equal(parsed.searchParams.get('code_challenge_method'), 'S256');
    assert.equal(parsed.searchParams.get('dpp_agent_sub'), agentProfile.sub);
    assert.equal(parsed.searchParams.get('state'), state);
  });

  it('exchangeCode returns delegation after consent issues code', async () => {
    const wallet = createWalletIssuer(devConfig);
    const { codeVerifier, codeChallenge } = pkcePair();
    const registered = await wallet.registerAgent(agentProfile);
    const scope = [DPP_OAUTH_SCOPE.DELEGATION_READ];

    await wallet.createAuthorizationUrl({
      clientId: registered.clientId,
      redirectUri: agentProfile.redirectUris[0],
      scope,
      state: 'csrf-state-2',
      codeChallenge,
      codeChallengeMethod: 'S256',
      agentSub: agentProfile.sub,
    });

    const { code } = await issueAuthorizationCode(wallet, {
      clientId: registered.clientId,
      redirectUri: agentProfile.redirectUris[0],
      agentSub: agentProfile.sub,
      scope,
      state: 'csrf-state-2',
      codeChallenge,
      codeChallengeMethod: 'S256',
      userId: 'user_01',
    });

    const tokens = await wallet.exchangeCode({
      code,
      redirectUri: agentProfile.redirectUris[0],
      codeVerifier,
      clientId: registered.clientId,
    });

    assert.equal(tokens.tokenType, 'Bearer');
    assert.ok(tokens.delegationId.startsWith('dlg_'));
    assert.ok(tokens.accessToken.startsWith('dpp_at_'));
  });

  it('revokeDelegation blocks subsequent code issuance', async () => {
    const wallet = createWalletIssuer(devConfig);
    const { codeChallenge } = pkcePair();
    const registered = await wallet.registerAgent(agentProfile);

    await wallet.revokeDelegation('user_02', agentProfile.sub);

    await assert.rejects(
      () =>
        issueAuthorizationCode(wallet, {
          clientId: registered.clientId,
          redirectUri: agentProfile.redirectUris[0],
          agentSub: agentProfile.sub,
          scope: [DPP_OAUTH_SCOPE.DELEGATION_READ],
          state: 'csrf-state-3',
          codeChallenge,
          codeChallengeMethod: 'S256',
          userId: 'user_02',
        }),
      (err) => err instanceof DPPError && err.code === DPP_ERROR_CODE.DELEGATION_REVOKED,
    );
  });

  it('revokeAgent blocks new authorization URLs', async () => {
    const wallet = createWalletIssuer(devConfig);
    const { codeChallenge } = pkcePair();
    const registered = await wallet.registerAgent(agentProfile);
    await wallet.revokeAgent(agentProfile.sub);

    await assert.rejects(
      () =>
        wallet.createAuthorizationUrl({
          clientId: registered.clientId,
          redirectUri: agentProfile.redirectUris[0],
          scope: [DPP_OAUTH_SCOPE.DELEGATION_READ],
          state: 'csrf-state-4',
          codeChallenge,
          codeChallengeMethod: 'S256',
          agentSub: agentProfile.sub,
        }),
      (err) => err instanceof DPPError && err.code === DPP_ERROR_CODE.OAUTH_ERROR,
    );
  });
});
