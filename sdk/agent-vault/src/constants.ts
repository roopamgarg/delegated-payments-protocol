export const VAULT_ERROR_CLASS_NAME = 'DPPVaultError' as const;

export const VAULT_ERROR_CODE = {
  INVALID_CONFIG: 'invalid_config',
  NOT_FOUND: 'not_found',
  ALREADY_EXISTS: 'already_exists',
  REVOKED: 'revoked',
  UNSAFE_FOR_LLM: 'unsafe_for_llm',
} as const;

export type VaultErrorCode = (typeof VAULT_ERROR_CODE)[keyof typeof VAULT_ERROR_CODE];

export const DELEGATION_STATUS = {
  ACTIVE: 'active',
  REVOKED: 'revoked',
} as const;

export type DelegationStatus = (typeof DELEGATION_STATUS)[keyof typeof DELEGATION_STATUS];

/** Patterns that MUST NOT appear in MCP tool JSON returned to the model. */
export const SECRET_LEAK_PATTERNS = [
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  /\bdpp_at_[A-Za-z0-9_-]{16,}\b/,
  /\bdpp_rt_[A-Za-z0-9_-]{16,}\b/,
  /\bBearer\s+[A-Za-z0-9._-]{20,}\b/i,
] as const;
