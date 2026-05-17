import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  assertSafeForLlmContext,
  createAgentVault,
  DPPVaultError,
  sanitizeForLlm,
  VaultSecret,
  VAULT_ERROR_CODE,
} from '../dist/index.js';

const masterKey = randomBytes(32);
const sampleJws =
  'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkaWQ6a2V5Onp6TWthZ2VudCJ9.signature';
const sampleAccess = 'dpp_at_' + randomBytes(24).toString('base64url');
const sampleRefresh = 'dpp_rt_' + randomBytes(24).toString('base64url');

describe('dpp-agent-vault (AGE-41)', () => {
  it('stores OAuth tokens encrypted and returns safe handle only', () => {
    const vault = createAgentVault({ masterKey });
    const handle = vault.storeOAuthTokens({
      delegationId: 'dlg_test_01',
      userId: 'user_01',
      agentSub: 'did:key:z6MkagentTest',
      accessToken: sampleAccess,
      refreshToken: sampleRefresh,
      expiresIn: 3600,
      scope: 'dpp:delegation:read',
      walletIssuer: 'https://wallet.example/issuer',
    });

    assert.equal(handle.delegationId, 'dlg_test_01');
    assert.equal(handle.status, 'active');
    assert.equal(handle.hasCapability, false);

    const serialized = JSON.stringify(handle);
    assert.doesNotMatch(serialized, /eyJ/);
    assert.doesNotMatch(serialized, /dpp_at_/);
    assert.doesNotMatch(serialized, /dpp_rt_/);

    const secrets = vault.getSecrets('dlg_test_01');
    assert.equal(secrets.accessToken, sampleAccess);
    assert.equal(secrets.refreshToken, sampleRefresh);
  });

  it('stores capability JWS without exposing it in safe handles', () => {
    const vault = createAgentVault({ masterKey });
    vault.storeOAuthTokens({
      delegationId: 'dlg_test_02',
      userId: 'user_02',
      agentSub: 'did:key:z6MkagentTwo',
      accessToken: sampleAccess,
    });

    const handle = vault.storeCapability({
      delegationId: 'dlg_test_02',
      capabilityJws: sampleJws,
    });

    assert.equal(handle.hasCapability, true);
    const toolJson = JSON.stringify(sanitizeForLlm(handle));
    assert.doesNotMatch(toolJson, /eyJ/);

    assert.equal(vault.getSecrets('dlg_test_02').capabilityJws, sampleJws);
  });

  it('revoke clears secrets and blocks getSecrets', () => {
    const vault = createAgentVault({ masterKey });
    vault.storeOAuthTokens({
      delegationId: 'dlg_test_03',
      userId: 'user_03',
      agentSub: 'did:key:z6MkagentThree',
      accessToken: sampleAccess,
    });

    const revoked = vault.revoke('dlg_test_03');
    assert.equal(revoked.status, 'revoked');
    assert.equal(revoked.hasCapability, false);

    assert.throws(
      () => vault.getSecrets('dlg_test_03'),
      (err) => err instanceof DPPVaultError && err.code === VAULT_ERROR_CODE.REVOKED,
    );
  });

  it('red-team: assertSafeForLlmContext rejects JWT in tool payloads', () => {
    assert.throws(
      () => assertSafeForLlmContext({ capability: sampleJws }),
      (err) => err instanceof DPPVaultError && err.code === VAULT_ERROR_CODE.UNSAFE_FOR_LLM,
    );
  });

  it('VaultSecret never leaks via JSON.stringify', () => {
    const wrapped = new VaultSecret(sampleAccess);
    assert.equal(JSON.stringify({ token: wrapped }), '{"token":"[REDACTED]"}');
    assert.equal(wrapped.unwrap(), sampleAccess);
  });

  it('rejects duplicate user/agent link with different delegationId', () => {
    const vault = createAgentVault({ masterKey });
    vault.storeOAuthTokens({
      delegationId: 'dlg_a',
      userId: 'user_dup',
      agentSub: 'did:key:z6Mkdup',
      accessToken: sampleAccess,
    });

    assert.throws(
      () =>
        vault.storeOAuthTokens({
          delegationId: 'dlg_b',
          userId: 'user_dup',
          agentSub: 'did:key:z6Mkdup',
          accessToken: sampleAccess,
        }),
      (err) => err instanceof DPPVaultError && err.code === VAULT_ERROR_CODE.ALREADY_EXISTS,
    );
  });

  it('listByUser returns only safe handles', () => {
    const vault = createAgentVault({ masterKey });
    vault.storeOAuthTokens({
      delegationId: 'dlg_list_1',
      userId: 'user_list',
      agentSub: 'did:key:z6Mklist1',
      accessToken: sampleAccess,
    });
    vault.storeCapability({ delegationId: 'dlg_list_1', capabilityJws: sampleJws });

    const list = vault.listByUser('user_list');
    assert.equal(list.length, 1);
    const json = JSON.stringify(list);
    assert.doesNotMatch(json, /eyJ/);
    assert.doesNotMatch(json, /dpp_at_/);
  });
});
