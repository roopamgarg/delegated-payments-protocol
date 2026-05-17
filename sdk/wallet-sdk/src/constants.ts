/** DPP protocol version supported by this SDK. */
export const DPP_VERSION = '0.1' as const;

export const ARTIFACT_TYPE = {
  CAPABILITY: 'capability',
  PAYMENT_INTENT: 'payment_intent',
  MANDATE: 'mandate',
} as const;

/** Payment intent states per docs/protocol/verification-flows.md §4. */
export const INTENT_STATE = {
  CREATED: 'created',
  VALIDATING: 'validating',
  REJECTED: 'rejected',
  EXECUTING: 'executing',
  PENDING_USER_ACTION: 'pending_user_action',
  SUCCEEDED: 'succeeded',
  FAILED: 'failed',
  EXPIRED: 'expired',
} as const;

export type IntentState = (typeof INTENT_STATE)[keyof typeof INTENT_STATE];

export const INTENT_EVENT = {
  SUBMIT: 'submit',
  VALIDATION_FAILED: 'validation_failed',
  VALIDATION_PASSED: 'validation_passed',
  RAIL_ERROR: 'rail_error',
  RAIL_REQUIRES_ACTION: 'rail_requires_action',
  RAIL_SUCCEEDED: 'rail_succeeded',
  RAIL_FAILED: 'rail_failed',
  USER_COMPLETED: 'user_completed',
  USER_DENIED: 'user_denied',
  TTL_EXPIRED: 'ttl_expired',
} as const;

export type IntentEvent = (typeof INTENT_EVENT)[keyof typeof INTENT_EVENT];

export const PAYMENT_RAIL = {
  UPI: 'upi',
  CARD: 'card',
  WALLET_BALANCE: 'wallet_balance',
} as const;

export const RAIL_CLASS = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
} as const;

export const DIGEST_ALG = {
  SHA256: 'sha-256',
} as const;

export const DPP_OAUTH_SCOPE = {
  DELEGATION_READ: 'dpp:delegation:read',
  DELEGATION_ISSUE: 'dpp:delegation:issue',
  INTENT_READ: 'dpp:intent:read',
  INTENT_WRITE: 'dpp:intent:write',
  RAIL_READ: 'dpp:rail:read',
} as const;

/** Agent registry lifecycle per wallet-oauth-linking.md §5.2. */
export const AGENT_STATUS = {
  ACTIVE: 'active',
  REVOKED: 'revoked',
} as const;

export type AgentStatus = (typeof AGENT_STATUS)[keyof typeof AGENT_STATUS];

/** OAuth 2.0 / PKCE values for wallet linking (RFC 7636, wallet-oauth-linking.md §6). */
export const OAUTH_PKCE_METHOD = {
  S256: 'S256',
} as const;

export type OAuthPkceMethod = (typeof OAUTH_PKCE_METHOD)[keyof typeof OAUTH_PKCE_METHOD];

export const OAUTH_RESPONSE_TYPE = {
  CODE: 'code',
} as const;

export const OAUTH_TOKEN_TYPE = {
  BEARER: 'Bearer',
} as const;

/** Authorize endpoint query parameter names. */
export const OAUTH_AUTHORIZE_PARAM = {
  RESPONSE_TYPE: 'response_type',
  CLIENT_ID: 'client_id',
  REDIRECT_URI: 'redirect_uri',
  SCOPE: 'scope',
  STATE: 'state',
  CODE_CHALLENGE: 'code_challenge',
  CODE_CHALLENGE_METHOD: 'code_challenge_method',
  DPP_AGENT_SUB: 'dpp_agent_sub',
  RESOURCE: 'resource',
} as const;

/** Default TTLs aligned with wallet-oauth-linking.md (code ≤10 min). */
export const OAUTH_TTL_SECONDS = {
  AUTHORIZATION_CODE: 600,
  ACCESS_TOKEN: 3600,
} as const;

/** `Error.name` for {@link DPPError}. */
export const DPP_ERROR_CLASS_NAME = 'DPPError' as const;

export const DPP_ERROR_CODE = {
  NOT_IMPLEMENTED: 'not_implemented',
  INVALID_CONFIG: 'invalid_config',
  INVALID_TOKEN: 'invalid_token',
  INVALID_SIGNATURE: 'invalid_signature',
  OAUTH_ERROR: 'oauth_error',
  AGENT_NOT_REGISTERED: 'agent_not_registered',
  DELEGATION_REVOKED: 'delegation_revoked',
  INTENT_NOT_FOUND: 'intent_not_found',
  INVALID_STATE_TRANSITION: 'invalid_state_transition',
  FORBIDDEN_CLAIM: 'forbidden_claim',
} as const;

export type DPPErrorCode = (typeof DPP_ERROR_CODE)[keyof typeof DPP_ERROR_CODE];
