import type { DPPWalletIssuer } from './issuer.js';
import type {
  OAuthAuthorizationRequest,
  OAuthAuthorizationUrl,
  OAuthTokenExchangeInput,
  OAuthTokenResponse,
} from './types.js';
import {
  DPP_ERROR_CODE,
  OAUTH_AUTHORIZE_PARAM,
  OAUTH_PKCE_METHOD,
  OAUTH_RESPONSE_TYPE,
  OAUTH_TOKEN_TYPE,
  OAUTH_TTL_SECONDS,
  type OAuthPkceMethod,
} from './constants.js';
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

export type IssueAuthorizationCodeInput = {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly agentSub: string;
  readonly scope: ReadonlyArray<string>;
  readonly state: string;
  readonly codeChallenge: string;
  readonly codeChallengeMethod: OAuthPkceMethod;
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

function assertPkceMethod(method: string): asserts method is OAuthPkceMethod {
  if (method !== OAUTH_PKCE_METHOD.S256) {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, 'code_challenge_method MUST be S256');
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

  assertPkceMethod(request.codeChallengeMethod);
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
  authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.RESPONSE_TYPE, OAUTH_RESPONSE_TYPE.CODE);
  authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.CLIENT_ID, request.clientId);
  authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.REDIRECT_URI, request.redirectUri);
  authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.SCOPE, request.scope.join(' '));
  authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.STATE, request.state);
  authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.CODE_CHALLENGE, request.codeChallenge);
  authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.CODE_CHALLENGE_METHOD, OAUTH_PKCE_METHOD.S256);
  authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.DPP_AGENT_SUB, request.agentSub);
  if (request.resource) {
    authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.RESOURCE, request.resource);
  } else {
    authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.RESOURCE, new URL(issuer.config.issuer).origin);
  }

  return {
    url: authorize.toString(),
    state: request.state,
    expiresAt: Date.now() + OAUTH_TTL_SECONDS.AUTHORIZATION_CODE * 1000,
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

  assertPkceMethod(input.codeChallengeMethod);
  if (!isValidCodeChallenge(input.codeChallenge)) {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, 'code_challenge is invalid for S256 PKCE');
  }

  const agent = requireActiveAgent(getRegisteredAgent(issuer, input.agentSub), input.agentSub);
  if (agent.clientId !== input.clientId) {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, 'client_id does not match registered agent');
  }
  assertRedirectUriAllowed(agent.redirectUris, input.redirectUri);
  assertDelegationAllowed(issuer, input.userId, input.agentSub);

  const ttlSeconds = input.ttlSeconds ?? OAUTH_TTL_SECONDS.AUTHORIZATION_CODE;
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
    codeChallengeMethod: OAUTH_PKCE_METHOD.S256,
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
  const expiresIn = OAUTH_TTL_SECONDS.ACCESS_TOKEN;
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
    tokenType: OAUTH_TOKEN_TYPE.BEARER,
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
