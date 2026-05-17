import type { PaymentIntentInput } from 'dpp-wallet-sdk';

/** Server-side delegation limits enforced before MCP tools mutate wallet/merchant state. */
export type DelegationPolicy = {
  readonly maxAmount: { readonly value: string; readonly currency: string };
  readonly merchantAllowlist: readonly string[];
  readonly paymentMethods: readonly string[];
  readonly previewMaxAgeSeconds: number;
};

export type PolicyViolation =
  | 'delegation_revoked'
  | 'amount_invalid'
  | 'amount_exceeds_max'
  | 'currency_mismatch'
  | 'merchant_not_allowlisted'
  | 'rail_not_allowed'
  | 'preview_required'
  | 'preview_expired'
  | 'preview_delegation_mismatch';

export type PolicyDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly violations: readonly PolicyViolation[];
      readonly message: string;
    };

export type PreviewPolicyInput = {
  readonly delegationId: string;
  readonly intent: Pick<PaymentIntentInput, 'amount' | 'merchantId' | 'rail'>;
};

export type ConfirmPolicyInput = {
  readonly delegationId: string;
  readonly intent: Pick<PaymentIntentInput, 'amount' | 'merchantId' | 'rail'>;
  readonly previewCreatedAt: string;
};
