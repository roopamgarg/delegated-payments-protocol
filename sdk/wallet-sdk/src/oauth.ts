import type { DPPWalletIssuer } from './issuer.js';
import type {
  OAuthAuthorizationRequest,
  OAuthAuthorizationUrl,
  OAuthTokenExchangeInput,
  OAuthTokenResponse,
} from './types.js';
import { DPP_ERROR_CODE } from './constants.js';
import { DPPError } from './errors.js';
import { getRegisteredAgent, requireActiveAgent } from './agent-registry.js';
import {
  getIssuerState,
  userAgentKey,
  type PendingAuthorizationCode,
} from './internal/issuer-state.js';
import {
  newAccessToken,
  newAuthorizationCode,
  newDelegationId,
  newRefreshToken,
} from './internal/ids.js';
import { isValidCodeChallenge, verifyPkceS256 } from './internal/pkce.js';
import {
  assertNonEmpty,
  validateOAuthScopes,
  validateRedirectUri,
  walletAuthorizeUrl,
} from './internal/validate.js';

const DEFAULT_CODE_TTL_SECONDS = 600;
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 3600;

export type IssueAuthorizationCodeInput = {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly agentSub: string;
  readonly scope: ReadonlyArray<string>;
  readonly state: string;
  readonly codeChallenge: string;
  readonly codeChallengeMethod: 'S256';
  readonly userId: string;
  readonly ttlSeconds?: number;
};

export type IssuedAuthorizationCode = {
  readonly code: string;
  readonly expiresAt: number;
};

function assertRedirectUriAllowed(agentRedirectUris: ReadonlyArray<string>, redirectUri: string): void {
  if (!agentRedirectUris.includes(redirectUri)) {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, 'redirect_uri does not match registered agent URIs', {
      redirectUri,
    });
  }
}

function assertDelegationAllowed(issuer: DPPWalletIssuer, userId: string, agentSub: string): void {
  const state = getIssuerState(issuer);
  if (state.revokedUserAgent.has(userAgentKey(userId, agentSub))) {
    throw new DPPError(
      DPP_ERROR_CODE.DELEGATION_REVOKED,
      `delegation revoked for user and agent: ${userId}, ${agentSub}`,
      { userId, agentSub },
    );
  }
}

export async function createAuthorizationUrl(
  issuer: DPPWalletIssuer,
  request: OAuthAuthorizationRequest,
): Promise<OAuthAuthorizationUrl> {
  assertNonEmpty(request.state, 'state');
  assertNonEmpty(request.clientId, 'clientId');
  assertNonEmpty(request.agentSub, 'agentSub');
  validateRedirectUri(request.redirectUri);
  validateOAuthScopes(request.scope);

  if (request.codeChallengeMethod !== 'S256') {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, 'code_challenge_method MUST be S256');
  }
  if (!isValidCodeChallenge(request.codeChallenge)) {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, 'code_challenge is invalid for S256 PKCE');
  }

  const agent = requireActiveAgent(getRegisteredAgent(issuer, request.agentSub), request.agentSub);
  if (agent.clientId !== request.clientId) {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, 'client_id does not match registered agent', {
      clientId: request.clientId,
      agentSub: request.agentSub,
    });
  }
  assertRedirectUriAllowed(agent.redirectUris, request.redirectUri);

  const authorize = walletAuthorizeUrl(issuer.config.issuer);
  authorize.searchParams.set('response_type', 'code');
  authorize.searchParams.set('client_id', request.clientId);
  authorize.searchParams.set('redirect_uri', request.redirectUri);
  authorize.searchParams.set('scope', request.scope.join(' '));
  authorize.searchParams.set('state', request.state);
  authorize.searchParams.set('code_challenge', request.codeChallenge);
  authorize.searchParams.set('code_challenge_method', 'S256');
  authorize.searchParams.set('dpp_agent_sub', request.agentSub);
  if (request.resource) {
    authorize.searchParams.set('resource', request.resource);
  } else {
    authorize.searchParams.set('resource', new URL(issuer.config.issuer).origin);
  }

  return {
    url: authorize.toString(),
    state: request.state,
    expiresAt: Date.now() + DEFAULT_CODE_TTL_SECONDS * 1000,
  };
}

/** Wallet consent handler: mint a single-use authorization code after user approval. */
export async function issueAuthorizationCode(
  issuer: DPPWalletIssuer,
  input: IssueAuthorizationCodeInput,
): Promise<IssuedAuthorizationCode> {
  assertNonEmpty(input.userId, 'userId');
  assertNonEmpty(input.state, 'state');
  validateOAuthScopes(input.scope);
  validateRedirectUri(input.redirectUri);

  if (input.codeChallengeMethod !== 'S256') {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, 'code_challenge_method MUST be S256');
  }
  if (!isValidCodeChallenge(input.codeChallenge)) {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, 'code_challenge is invalid for S256 PKCE');
  }

  const agent = requireActiveAgent(getRegisteredAgent(issuer, input.agentSub), input.agentSub);
  if (agent.clientId !== input.clientId) {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, 'client_id does not match registered agent');
  }
  assertRedirectUriAllowed(agent.redirectUris, input.redirectUri);
  assertDelegationAllowed(issuer, input.userId, input.agentSub);

  const ttlSeconds = input.ttlSeconds ?? DEFAULT_CODE_TTL_SECONDS;
  const expiresAt = Date.now() + ttlSeconds * 1000;
  const code = newAuthorizationCode();

  const pending: PendingAuthorizationCode = {
    code,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    agentSub: input.agentSub,
    scope: [...input.scope],
    state: input.state,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: 'S256',
    userId: input.userId,
    expiresAt,
    used: false,
  };

  getIssuerState(issuer).authorizationCodes.set(code, pending);
  return { code, expiresAt };
}

export async function exchangeCode(
  issuer: DPPWalletIssuer,
  input: OAuthTokenExchangeInput,
): Promise<OAuthTokenResponse> {
  assertNonEmpty(input.code, 'code');
  assertNonEmpty(input.clientId, 'clientId');
  validateRedirectUri(input.redirectUri);

  const state = getIssuerState(issuer);
  const pending = state.authorizationCodes.get(input.code);
  if (!pending) {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, 'authorization code is invalid or expired', {
      code: input.code,
    });
  }

  if (pending.used) {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, 'authorization code was already exchanged');
  }
  if (Date.now() > pending.expiresAt) {
    state.authorizationCodes.delete(input.code);
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, 'authorization code is invalid or expired');
  }
  if (pending.clientId !== input.clientId || pending.redirectUri !== input.redirectUri) {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, 'client_id or redirect_uri mismatch');
  }
  if (!verifyPkceS256(input.codeVerifier, pending.codeChallenge)) {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, 'PKCE verification failed');
  }

  const agent = requireActiveAgent(getRegisteredAgent(issuer, pending.agentSub), pending.agentSub);
  if (agent.clientId !== input.clientId) {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, 'client_id does not match registered agent');
  }
  assertDelegationAllowed(issuer, pending.userId, pending.agentSub);

  pending.used = true;
  state.authorizationCodes.delete(input.code);

  const delegationId = newDelegationId();
  const accessToken = newAccessToken();
  const refreshToken = newRefreshToken();
  const expiresIn = DEFAULT_ACCESS_TOKEN_TTL_SECONDS;
  const expiresAt = Date.now() + expiresIn * 1000;

  const delegation = {
    delegationId,
    userId: pending.userId,
    agentSub: pending.agentSub,
    clientId: pending.clientId,
    scope: pending.scope,
    accessToken,
    refreshToken,
    expiresAt,
    revoked: false,
  };

  state.delegations.set(delegationId, delegation);
  state.delegationsByAccessToken.set(accessToken, delegation);

  return {
    accessToken,
    tokenType: 'Bearer',
    expiresIn,
    refreshToken,
    scope: pending.scope.join(' '),
    delegationId,
  };
}

export async function revokeDelegation(
  issuer: DPPWalletIssuer,
  userId: string,
  agentSub: string,
): Promise<void> {
  assertNonEmpty(userId, 'userId');
  assertNonEmpty(agentSub, 'agentSub');

  const state = getIssuerState(issuer);
  state.revokedUserAgent.add(userAgentKey(userId, agentSub));

  for (const delegation of state.delegations.values()) {
    if (delegation.userId === userId && delegation.agentSub === agentSub) {
      delegation.revoked = true;
    }
  }
}
