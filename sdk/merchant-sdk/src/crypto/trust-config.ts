import type { JwsTrustConfig } from './jws.js';
import { DPPError } from '../errors.js';

const DEFAULT_REQUIRED_SCOPES = ['pay:initiate'] as const;

function isNonEmptyStringArray(value?: ReadonlyArray<string>): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === 'string' && entry.trim().length > 0)
  );
}

/** Scopes that MUST appear on capability tokens unless overridden in trust config. */
export function resolveRequiredScopes(
  trust?: Pick<JwsTrustConfig, 'requiredScopes'>,
): readonly string[] {
  return trust?.requiredScopes?.length ? trust.requiredScopes : DEFAULT_REQUIRED_SCOPES;
}

/**
 * Enforce issuer allowlist + audience in production.
 * Local tests and examples may set `allowInsecureTrustConfig: true`.
 */
export function assertProductionTrustConfig(trust: JwsTrustConfig): void {
  if (trust.allowInsecureTrustConfig) {
    return;
  }

  if (!isNonEmptyStringArray(trust.issuerAllowlist)) {
    throw new DPPError(
      'invalid_token',
      'Production trust config requires a non-empty issuerAllowlist (or allowInsecureTrustConfig for local dev)',
      { field: 'issuerAllowlist' },
    );
  }

  if (!isNonEmptyStringArray(trust.audience)) {
    throw new DPPError(
      'invalid_token',
      'Production trust config requires a non-empty audience (or allowInsecureTrustConfig for local dev)',
      { field: 'audience' },
    );
  }
}
