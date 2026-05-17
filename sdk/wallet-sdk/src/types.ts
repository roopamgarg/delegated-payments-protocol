import {
  ARTIFACT_TYPE,
  DPP_VERSION,
  type IntentState,
  PAYMENT_RAIL,
  RAIL_CLASS,
} from './constants.js';
import type { KmsEs256Signer } from './crypto/kms-signer.js';

export type CapabilityClaimsInput = {
  readonly sub: string;
  readonly aud?: ReadonlyArray<string>;
  readonly scopes: ReadonlyArray<string>;
  readonly constraints: {
    readonly maxAmount: { readonly value: string; readonly currency: string };
    readonly merchantAllowlist: ReadonlyArray<string>;
    readonly paymentMethods?: ReadonlyArray<
      (typeof PAYMENT_RAIL)[keyof typeof PAYMENT_RAIL]
    >;
    readonly requiresOtp?: boolean;
  };
  readonly intentBind?: string;
  readonly ttlSeconds?: number;
};

export type IssueCapabilityResult = {
  readonly compactJws: string;
  readonly jti: string;
  readonly expiresAt: number;
};

export type PaymentIntentInput = {
  readonly intentId: string;
  readonly idempotencyKey: string;
  readonly amount: { readonly value: string; readonly currency: string };
  readonly merchantId: string;
  readonly rail: (typeof PAYMENT_RAIL)[keyof typeof PAYMENT_RAIL];
  readonly railClass: (typeof RAIL_CLASS)[keyof typeof RAIL_CLASS];
  readonly mandateId?: string;
  readonly metadata?: Readonly<Record<string, string>>;
};

export type PaymentIntentRecord = PaymentIntentInput & {
  readonly dpp: typeof DPP_VERSION;
  readonly typ: typeof ARTIFACT_TYPE.PAYMENT_INTENT;
  readonly digest: { readonly alg: 'sha256'; readonly value: string };
  readonly state: IntentState;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type AgentProfile = {
  readonly sub: string;
  readonly displayName: string;
  readonly redirectUris: ReadonlyArray<string>;
  readonly clientId?: string;
};

export type OAuthAuthorizationRequest = {
  readonly clientId: string;
  readonly redirectUri: string;
  readonly scope: ReadonlyArray<string>;
  readonly state: string;
  readonly codeChallenge: string;
  readonly codeChallengeMethod: 'S256';
  readonly agentSub: string;
  readonly resource?: string;
};

export type OAuthAuthorizationUrl = {
  readonly url: string;
  readonly state: string;
  readonly expiresAt?: number;
};

export type OAuthTokenExchangeInput = {
  readonly code: string;
  readonly redirectUri: string;
  readonly codeVerifier: string;
  readonly clientId: string;
};

export type OAuthTokenResponse = {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly refreshToken?: string;
  readonly scope: string;
  readonly delegationId: string;
};

export type SigningKeyMaterial =
  | { readonly type: 'local'; readonly privateJwk: JsonWebKey; readonly kid: string }
  | {
      readonly type: 'kms';
      readonly keyId: string;
      readonly kid: string;
      /** Cached from KMS GetPublicKey — never store private key material. */
      readonly publicJwk: JsonWebKey;
      /** Optional injected client for AWS KMS (production) or tests. */
      readonly kmsClient?: unknown;
    };

export type KeyRotationConfig = {
  /** Seconds to keep retired public keys in JWKS (default 86400, min 2× max capability TTL). */
  readonly retentionSeconds?: number;
};

export type DPPWalletIssuerConfig = {
  readonly issuer: string;
  readonly signingKey: SigningKeyMaterial;
  readonly defaultCapabilityTtlSeconds?: number;
  /**
   * Injected KMS signer for `signingKey.type === 'kms'`.
   * When omitted, the SDK uses `@aws-sdk/client-kms` with optional `signingKey.kmsClient`.
   */
  readonly kmsSigner?: KmsEs256Signer;
  readonly keyRotation?: KeyRotationConfig;
  readonly oauth?: {
    readonly authorizationServerMetadataUrl?: string;
    readonly clientRegistration?: 'static' | 'dynamic';
  };
};
