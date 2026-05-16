import {
  ARTIFACT_TYPE,
  DPP_VERSION,
  type DelegationVerdict,
  DIGEST_ALG,
  PAYMENT_RAIL,
  RAIL_CLASS,
} from './constants.js';

export type { DelegationVerdict };

/** Subset of capability token claims used for merchant verification (see specs/schemas/capability-token.schema.json). */
export type CapabilityTokenPayload = {
  readonly dpp: typeof DPP_VERSION;
  readonly typ: typeof ARTIFACT_TYPE.CAPABILITY;
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
    readonly paymentMethods?: ReadonlyArray<
      (typeof PAYMENT_RAIL)[keyof typeof PAYMENT_RAIL]
    >;
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
  readonly dpp: typeof DPP_VERSION;
  readonly typ: typeof ARTIFACT_TYPE.PAYMENT_INTENT;
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly amount: { readonly value: string; readonly currency: string };
  readonly merchantId: string;
  readonly rail: (typeof PAYMENT_RAIL)[keyof typeof PAYMENT_RAIL];
  readonly railClass: (typeof RAIL_CLASS)[keyof typeof RAIL_CLASS];
  readonly mandateId?: string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly digest: { readonly alg: typeof DIGEST_ALG.SHA256; readonly value: string };
};

export type VerifyDelegationResult = {
  readonly verdict: DelegationVerdict;
  readonly reasons: readonly string[];
};
