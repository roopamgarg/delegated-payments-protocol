/** DPP protocol version supported by this SDK. */
export const DPP_VERSION = '0.1' as const;

export const ARTIFACT_TYPE = {
  CAPABILITY: 'capability',
  PAYMENT_INTENT: 'payment_intent',
} as const;

export const DELEGATION_VERDICT = {
  VALID: 'delegation_valid',
  INVALID: 'delegation_invalid',
  PENDING: 'delegation_pending',
} as const;

export type DelegationVerdict = (typeof DELEGATION_VERDICT)[keyof typeof DELEGATION_VERDICT];

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

export const REQUIRED_CAPABILITY_SCOPE = {
  PAY_INITIATE: 'pay:initiate',
} as const;

export const VERIFICATION_REASON = {
  CAPABILITY_UNSUPPORTED_TYPE: 'capability:unsupported_type',
  CAPABILITY_INSUFFICIENT_SCOPE: 'capability:insufficient_scope',
  INTENT_UNSUPPORTED_TYPE: 'intent:unsupported_type',
  CAPABILITY_EXPIRED: 'capability:expired',
  CAPABILITY_NOT_YET_VALID: 'capability:not_yet_valid',
  INTENT_MERCHANT_NOT_ALLOWLISTED: 'intent:merchant_not_allowlisted',
  INTENT_CURRENCY_MISMATCH: 'intent:currency_mismatch',
  INTENT_AMOUNT_EXCEEDS_MAX: 'intent:amount_exceeds_max',
  INTENT_INVALID_AMOUNT: 'intent:invalid_amount',
  INTENT_RAIL_NOT_PERMITTED: 'intent:rail_not_permitted',
  INTENT_DIGEST_MISMATCH: 'intent:digest_mismatch',
} as const;

/** `Error.name` for {@link DPPError}. */
export const DPP_ERROR_CLASS_NAME = 'DPPError' as const;

export const DPP_ERROR_CODE = {
  INVALID_TOKEN: 'invalid_token',
  INVALID_SIGNATURE: 'invalid_signature',
  UNTRUSTED_ISSUER: 'untrusted_issuer',
  DELEGATION_INVALID: 'delegation_invalid',
  FORBIDDEN_CLAIM: 'forbidden_claim',
  PSP_ERROR: 'psp_error',
  PSP_NOT_CONFIGURED: 'psp_not_configured',
  INVALID_STATE_TRANSITION: 'invalid_state_transition',
  PAYMENT_NOT_FOUND: 'payment_not_found',
} as const;

export type DPPErrorCode = (typeof DPP_ERROR_CODE)[keyof typeof DPP_ERROR_CODE];

/** Claims that MUST be rejected per verification-flows.md §6. */
export const FORBIDDEN_CLAIM = {
  OTP_BYPASS: 'dpp:otpBypass',
  SCA_SATISFIED: 'dpp:scaSatisfied',
  USER_PRESENT_PROOF: 'dpp:userPresentProof',
} as const;

export const FORBIDDEN_CLAIMS: readonly string[] = Object.values(FORBIDDEN_CLAIM);

export const PSP_NAME = {
  STRIPE: 'stripe',
  RAZORPAY: 'razorpay',
} as const;

export type PspName = (typeof PSP_NAME)[keyof typeof PSP_NAME];

export const REQUIRED_ACTION = {
  OTP: 'otp',
  SCA: 'sca',
  APPROVAL: 'approval',
  THREE_DS: '3ds',
} as const;

export type RequiredAction = (typeof REQUIRED_ACTION)[keyof typeof REQUIRED_ACTION];

export const RESUME_HINT = {
  POLL_INTENT: 'poll_intent',
  WEBHOOK: 'webhook',
} as const;

export type ResumeHint = (typeof RESUME_HINT)[keyof typeof RESUME_HINT];

export const USER_CHANNEL = {
  CARD_ISSUER: 'card_issuer',
  WALLET_APP: 'wallet_app',
} as const;

export const DIGEST_ALG = {
  SHA256: 'sha-256',
} as const;

export const PAYMENT_RAIL = {
  CARD: 'card',
  UPI: 'upi',
  WALLET: 'wallet',
  BANK_TRANSFER: 'bank_transfer',
  OTHER: 'other',
} as const;

export const RAIL_CLASS = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
} as const;

/** External Stripe PaymentIntent.status values. */
export const STRIPE_PAYMENT_INTENT_STATUS = {
  SUCCEEDED: 'succeeded',
  CANCELED: 'canceled',
  REQUIRES_ACTION: 'requires_action',
  REQUIRES_CONFIRMATION: 'requires_confirmation',
  PROCESSING: 'processing',
} as const;

/** External Razorpay order.status values. */
export const RAZORPAY_ORDER_STATUS = {
  PAID: 'paid',
  ATTEMPTED: 'attempted',
  CREATED: 'created',
} as const;

export const METADATA_KEY = {
  DPP_INTENT_ID: 'dppIntentId',
  DPP_IDEMPOTENCY_KEY: 'dppIdempotencyKey',
  DPP_MERCHANT_ID: 'dppMerchantId',
  DPP_MANDATE_ID: 'dppMandateId',
} as const;

export const AUDIT_EVENT = {
  PAYMENT_SUBMIT: 'payment.submit',
  PAYMENT_ESCALATION: 'payment.escalation',
} as const;

export const WEBHOOK = {
  UNKNOWN_PSP_PAYMENT_ID: 'unknown',
  STRIPE_PAYMENT_INTENT_PREFIX: 'payment_intent.',
} as const;

export const JWS = {
  ALG_ES256: 'ES256',
  TEST_KEY_ID: 'test-key',
} as const;

export const ENV = {
  AUDIT_LOG: 'DPP_AUDIT_LOG',
  AUDIT_LOG_ENABLED: '1',
} as const;

export const DEFAULT_CLOCK_SKEW_SECONDS = 60;
export const ESCALATION_TTL_MS = 10 * 60 * 1000;

export const ESCALATION_ID_PREFIX = {
  STRIPE: 'esc_stripe_',
  RAZORPAY: 'esc_razorpay_',
} as const;
