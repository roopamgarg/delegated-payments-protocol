import { PAYMENT_RAIL } from 'dpp-wallet-sdk';

/** Default platform policy when env overrides are absent (DPP examples use INR). */
export const POLICY_DEFAULT_MAX_AMOUNT_VALUE = '25.00' as const;
export const POLICY_DEFAULT_CURRENCY = 'INR' as const;
export const POLICY_DEFAULT_PREVIEW_MAX_AGE_SECONDS = 300 as const;
export const POLICY_DEFAULT_PAYMENT_METHODS = [PAYMENT_RAIL.CARD] as const;

export const POLICY_VIOLATION = {
  DELEGATION_REVOKED: 'delegation_revoked',
  AMOUNT_INVALID: 'amount_invalid',
  AMOUNT_EXCEEDS_MAX: 'amount_exceeds_max',
  CURRENCY_MISMATCH: 'currency_mismatch',
  MERCHANT_NOT_ALLOWLISTED: 'merchant_not_allowlisted',
  RAIL_NOT_ALLOWED: 'rail_not_allowed',
  PREVIEW_REQUIRED: 'preview_required',
  PREVIEW_EXPIRED: 'preview_expired',
  PREVIEW_DELEGATION_MISMATCH: 'preview_delegation_mismatch',
} as const;

export type PolicyViolationCode =
  (typeof POLICY_VIOLATION)[keyof typeof POLICY_VIOLATION];

export const MCP_TOOL_CODE = {
  POLICY_DENIED: 'policy_denied',
  DELEGATION_NOT_FOUND: 'delegation_not_found',
  LINK_EXPIRED: 'link_expired',
  PREVIEW_NOT_FOUND: 'preview_not_found',
  WALLET_UNREACHABLE: 'wallet_unreachable',
  AGENT_REVOKED: 'agent_revoked',
  WALLET_ERROR: 'wallet_error',
} as const;

export const MCP_TOOL_STATUS = {
  ERROR: 'error',
  PREVIEW_READY: 'preview_ready',
} as const;
