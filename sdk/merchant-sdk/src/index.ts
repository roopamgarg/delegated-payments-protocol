export type {
  CapabilityTokenPayload,
  DelegationVerdict,
  PaymentIntentPayload,
  VerifyDelegationResult,
} from './types.js';

export { verifyDelegation } from './verify.js';
export { DPPError, type DPPErrorCode } from './errors.js';

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
