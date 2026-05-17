import { createHash, randomBytes } from 'node:crypto';
import {
  ARTIFACT_TYPE,
  DPP_VERSION,
  DIGEST_ALG,
  OAUTH_AUTHORIZE_PARAM,
  OAUTH_PKCE_METHOD,
  OAUTH_RESPONSE_TYPE,
  computeIntentDigest,
  type PaymentIntentInput,
} from 'dpp-wallet-sdk';
import type { DelegationPolicy } from '../policy/types.js';
import type { McpPaymentConfig } from '../types.js';

export function delegationConstraintsFromPolicy(policy: DelegationPolicy): Record<string, unknown> {
  return {
    maxAmount: { ...policy.maxAmount },
    merchantAllowlist: [...policy.merchantAllowlist],
    paymentMethods: [...policy.paymentMethods],
  };
}

export type OAuthTokenBundle = {
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresIn?: number;
  readonly scope?: string;
  readonly delegationId: string;
  readonly agentSub?: string;
};

export type IssuedCapability = {
  readonly capabilityToken: string;
  readonly jti: string;
  readonly expiresAt: string;
  readonly delegationId: string;
};

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function buildAuthorizationUrl(
  config: McpPaymentConfig,
  input: {
    state: string;
    codeChallenge: string;
  },
): string {
  const authorize = new URL('/oauth/authorize', config.walletBaseUrl);
  authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.RESPONSE_TYPE, OAUTH_RESPONSE_TYPE.CODE);
  authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.CLIENT_ID, config.oauth.clientId);
  authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.REDIRECT_URI, config.oauth.redirectUri);
  authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.SCOPE, config.oauth.scopes.join(' '));
  authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.STATE, input.state);
  authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.CODE_CHALLENGE, input.codeChallenge);
  authorize.searchParams.set(
    OAUTH_AUTHORIZE_PARAM.CODE_CHALLENGE_METHOD,
    OAUTH_PKCE_METHOD.S256,
  );
  authorize.searchParams.set(OAUTH_AUTHORIZE_PARAM.DPP_AGENT_SUB, config.oauth.agentSub);
  authorize.searchParams.set(
    OAUTH_AUTHORIZE_PARAM.RESOURCE,
    new URL(config.walletIssuer).origin,
  );
  return authorize.toString();
}

export async function exchangeAuthorizationCode(
  config: McpPaymentConfig,
  input: { code: string; codeVerifier: string },
): Promise<OAuthTokenBundle> {
  const res = await fetch(`${config.walletBaseUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: config.oauth.redirectUri,
      code_verifier: input.codeVerifier,
      client_id: config.oauth.clientId,
    }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new WalletHttpError(res.status, String(body.error ?? 'oauth_error'), body);
  }
  return {
    accessToken: String(body.access_token),
    refreshToken: body.refresh_token ? String(body.refresh_token) : undefined,
    expiresIn: typeof body.expires_in === 'number' ? body.expires_in : undefined,
    scope: body.scope ? String(body.scope) : undefined,
    delegationId: String(body.dpp_delegation_id),
    agentSub: body.dpp_agent_sub ? String(body.dpp_agent_sub) : config.oauth.agentSub,
  };
}

export async function issueCapability(
  config: McpPaymentConfig,
  input: {
    accessToken: string;
    intentBind: string;
    constraints?: Record<string, unknown>;
  },
): Promise<IssuedCapability> {
  const res = await fetch(`${config.walletBaseUrl}/v1/delegations/issue`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({
      agentSub: config.oauth.agentSub,
      scopes: ['pay:initiate'],
      intentBind: input.intentBind,
      constraints:
        input.constraints ??
        delegationConstraintsFromPolicy({
          maxAmount: { value: '25.00', currency: 'USD' },
          merchantAllowlist: [config.defaultMerchantId],
          paymentMethods: ['card'],
          previewMaxAgeSeconds: 300,
        }),
    }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new WalletHttpError(res.status, String(body.error ?? 'issue_failed'), body);
  }
  return {
    capabilityToken: String(body.capabilityToken),
    jti: String(body.jti),
    expiresAt: String(body.expiresAt),
    delegationId: String(body.delegationId),
  };
}

export function buildPaymentIntentRecord(intentInput: PaymentIntentInput): Record<string, unknown> {
  const digestHex = computeIntentDigest(intentInput);
  return {
    ...intentInput,
    dpp: DPP_VERSION,
    typ: ARTIFACT_TYPE.PAYMENT_INTENT,
    digest: { alg: DIGEST_ALG.SHA256, value: digestHex },
  };
}

export class WalletHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, details: unknown) {
    super(`Wallet HTTP ${status}: ${code}`);
    this.name = 'WalletHttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Map wallet HTTP errors to MCP-safe tool codes (wallet-oauth-linking.md §14). */
export function mapWalletErrorToToolCode(err: unknown): string {
  if (!(err instanceof WalletHttpError)) {
    return 'wallet_unreachable';
  }
  if (err.status === 401) return 'link_expired';
  if (err.status === 403 && err.code === 'agent_disabled') return 'agent_revoked';
  if (err.status === 403) return 'policy_denied';
  return 'wallet_error';
}
