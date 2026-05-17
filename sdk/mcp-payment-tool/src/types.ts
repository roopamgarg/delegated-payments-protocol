import type { PaymentIntentInput } from 'dpp-wallet-sdk';
import type { SafeDelegationHandle } from 'dpp-agent-vault';

export type McpPaymentConfig = {
  readonly walletBaseUrl: string;
  readonly merchantBaseUrl: string;
  readonly walletIssuer: string;
  readonly oauth: {
    readonly clientId: string;
    readonly agentSub: string;
    readonly redirectUri: string;
    readonly scopes: readonly string[];
  };
  readonly vaultMasterKey: string;
  readonly defaultMerchantId: string;
  readonly oauthCallbackHost: string;
  readonly oauthCallbackPort: number;
};

export type PaymentPreviewRecord = {
  readonly previewId: string;
  readonly delegationId: string;
  readonly userId: string;
  readonly agentSub: string;
  readonly intentInput: PaymentIntentInput;
  readonly digestHex: string;
  readonly paymentIntent: Record<string, unknown>;
  readonly createdAt: string;
};

export type LinkWalletResult =
  | {
      readonly status: 'authorization_required';
      readonly authorizationUrl: string;
      readonly state: string;
      readonly message: string;
    }
  | {
      readonly status: 'linked';
      readonly delegation: SafeDelegationHandle;
    }
  | {
      readonly status: 'error';
      readonly code: string;
      readonly message: string;
    };
