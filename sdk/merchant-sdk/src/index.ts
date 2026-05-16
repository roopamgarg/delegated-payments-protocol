export type {
  CapabilityTokenPayload,
  DelegationVerdict,
  PaymentIntentPayload,
  VerifyDelegationResult,
} from './types.js';

export { verifyDelegation } from './verify.js';
export { DPPError, DPP_ERROR_CODE, type DPPErrorCode } from './errors.js';
export {
  ARTIFACT_TYPE,
  AUDIT_EVENT,
  DELEGATION_VERDICT,
  DPP_ERROR_CLASS_NAME,
  DPP_VERSION,
  FORBIDDEN_CLAIM,
  INTENT_EVENT,
  INTENT_STATE,
  METADATA_KEY,
  PSP_NAME,
  REQUIRED_ACTION,
  RESUME_HINT,
  VERIFICATION_REASON,
} from './constants.js';

export { amountLte, assertValidAmount } from './core/decimal.js';
export {
  canTransition,
  isTerminalState,
  transition,
  type IntentEvent,
  type IntentState,
} from './core/state-machine.js';
export { validateDelegation, type ValidateDelegationResult } from './core/token-validator.js';

export {
  verifyCapabilityJws,
  signCapabilityForTest,
  generateTestKeyPair,
  type JwsTrustConfig,
} from './crypto/jws.js';

export type {
  CreatePaymentParams,
  EscalationHandle,
  PSPAdapter,
  PSPPaymentResult,
  PaymentStatus,
  WebhookEvent,
} from './adapters/types.js';
export { StripeAdapter, type StripeAdapterConfig } from './adapters/stripe.js';
export { RazorpayAdapter, type RazorpayAdapterConfig } from './adapters/razorpay.js';

export {
  DPPMerchant,
  createMerchant,
  type AuditLogEntry,
  type AuditLogger,
  type DPPMerchantConfig,
  type ProcessPaymentInput,
  type ProcessPaymentResult,
} from './merchant.js';
