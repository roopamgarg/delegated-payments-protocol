import { DPP_OAUTH_SCOPE, DPP_ERROR_CODE } from '../constants.js';
import { DPPError } from '../errors.js';

const ALLOWED_SCOPES = new Set<string>(Object.values(DPP_OAUTH_SCOPE));

const AGENT_SUB_PREFIXES = ['did:key:', 'spiffe://', 'https://'] as const;

export function assertNonEmpty(value: string, field: string): void {
  if (!value?.trim()) {
    throw new DPPError(DPP_ERROR_CODE.INVALID_CONFIG, `${field} MUST be non-empty`);
  }
}

export function validateAgentSub(agentSub: string): void {
  assertNonEmpty(agentSub, 'agentSub');
  const valid = AGENT_SUB_PREFIXES.some((prefix) => agentSub.startsWith(prefix));
  if (!valid) {
    throw new DPPError(
      DPP_ERROR_CODE.INVALID_CONFIG,
      'agentSub MUST use did:key:, spiffe://, or https:// profile',
      { agentSub },
    );
  }
}

export function validateRedirectUri(redirectUri: string): void {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    throw new DPPError(DPP_ERROR_CODE.INVALID_CONFIG, 'redirectUri MUST be a valid URL', {
      redirectUri,
    });
  }
  if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    throw new DPPError(
      DPP_ERROR_CODE.INVALID_CONFIG,
      'redirectUri MUST use HTTPS in production (localhost excepted)',
      { redirectUri },
    );
  }
}

export function validateOAuthScopes(scopes: ReadonlyArray<string>): void {
  if (scopes.length === 0) {
    throw new DPPError(DPP_ERROR_CODE.INVALID_CONFIG, 'scope MUST include at least one DPP scope');
  }
  for (const scope of scopes) {
    if (!ALLOWED_SCOPES.has(scope)) {
      throw new DPPError(DPP_ERROR_CODE.INVALID_CONFIG, `unsupported OAuth scope: ${scope}`, {
        scope,
        allowed: [...ALLOWED_SCOPES],
      });
    }
  }
}

export function walletAuthorizeUrl(issuerUrl: string): URL {
  const issuer = new URL(issuerUrl);
  return new URL('/oauth/authorize', issuer.origin);
}
