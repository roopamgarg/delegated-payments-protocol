/** Subset of capability token claims used for merchant verification (see specs/schemas/capability-token.schema.json). */
export type CapabilityTokenPayload = {
  readonly dpp: '0.1';
  readonly typ: 'capability';
  readonly iss: string;
  readonly sub: string;
  readonly aud?: ReadonlyArray<string>;
  readonly exp: number;
  readonly nbf?: number;
  readonly nonce: string;
  readonly scopes: ReadonlyArray<string>;
  readonly constraints: {
    readonly maxAmount: { readonly value: string; readonly currency: string };
    readonly merchantAllowlist: ReadonlyArray<string>;
    readonly paymentMethods?: ReadonlyArray<'card' | 'upi' | 'wallet' | 'bank_transfer' | 'other'>;
    readonly requiresOtp?: boolean;
  };
  readonly delegation?: {
    readonly parentJti?: string;
    readonly depth?: number;
    readonly mayDelegate?: boolean;
  };
  /**
   * When present, MUST equal PaymentIntent.digest.value for the intent being settled.
   * (JWT profile may use a dedicated claim name; wallets should document mapping.)
   */
  readonly intentBind?: string;
};

export type PaymentIntentPayload = {
  readonly dpp: '0.1';
  readonly typ: 'payment_intent';
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly amount: { readonly value: string; readonly currency: string };
  readonly merchantId: string;
  readonly rail: 'card' | 'upi' | 'wallet' | 'bank_transfer' | 'other';
  readonly railClass: 'A' | 'B' | 'C' | 'D';
  readonly mandateId?: string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly digest: { readonly alg: 'sha-256'; readonly value: string };
};

export type DelegationVerdict = 'delegation_valid' | 'delegation_invalid' | 'delegation_pending';

export type VerifyDelegationResult = {
  readonly verdict: DelegationVerdict;
  readonly reasons: readonly string[];
};
