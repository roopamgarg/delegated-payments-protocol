import type {
  AgentProfile,
  CapabilityClaimsInput,
  DPPWalletIssuerConfig,
  IssueCapabilityResult,
  OAuthAuthorizationRequest,
  OAuthAuthorizationUrl,
  OAuthTokenExchangeInput,
  OAuthTokenResponse,
  PaymentIntentInput,
  PaymentIntentRecord,
} from './types.js';
import { issueCapability } from './capability.js';
import {
  computeIntentDigest,
  createIntent,
  getIntentStatus,
  resumeAfterUserAction,
  submitIntent,
} from './intent.js';
import { createAuthorizationUrl, exchangeCode, revokeDelegation } from './oauth.js';
import { registerAgent, revokeAgent } from './agent-registry.js';
import { exportJwks, rotateKeys } from './crypto/jwks.js';
import { SigningKeyRing } from './crypto/key-ring.js';
import { DPP_ERROR_CODE } from './constants.js';
import { DPPError } from './errors.js';
import type { SigningKeyMaterial } from './types.js';

export type { DPPWalletIssuerConfig };

/**
 * Root wallet issuer client — signs capabilities, orchestrates intents, and exposes OAuth helpers.
 */
export class DPPWalletIssuer {
  readonly config: DPPWalletIssuerConfig;
  readonly signingKeyRing: SigningKeyRing;

  constructor(config: DPPWalletIssuerConfig) {
    this.config = config;
    this.signingKeyRing = new SigningKeyRing(config.signingKey, config.keyRotation);
  }

  issueCapability(input: CapabilityClaimsInput): Promise<IssueCapabilityResult> {
    return issueCapability(this, input);
  }

  createIntent(payload: PaymentIntentInput): Promise<PaymentIntentRecord> {
    return createIntent(this, payload);
  }

  submitIntent(intentId: string): Promise<PaymentIntentRecord> {
    return submitIntent(this, intentId);
  }

  getIntentStatus(intentId: string): Promise<PaymentIntentRecord> {
    return getIntentStatus(this, intentId);
  }

  resumeAfterUserAction(intentId: string): Promise<PaymentIntentRecord> {
    return resumeAfterUserAction(this, intentId);
  }

  computeIntentDigest(intent: PaymentIntentInput): string {
    return computeIntentDigest(intent);
  }

  registerAgent(profile: AgentProfile): Promise<AgentProfile> {
    return registerAgent(this, profile);
  }

  revokeAgent(agentSub: string): Promise<void> {
    return revokeAgent(this, agentSub);
  }

  createAuthorizationUrl(request: OAuthAuthorizationRequest): Promise<OAuthAuthorizationUrl> {
    return createAuthorizationUrl(this, request);
  }

  exchangeCode(input: OAuthTokenExchangeInput): Promise<OAuthTokenResponse> {
    return exchangeCode(this, input);
  }

  revokeDelegation(userId: string, agentSub: string): Promise<void> {
    return revokeDelegation(this, userId, agentSub);
  }

  exportJwks(): Promise<{ keys: ReadonlyArray<JsonWebKey> }> {
    return exportJwks(this);
  }

  rotateKeys(nextSigningKey: SigningKeyMaterial): Promise<{ keys: ReadonlyArray<JsonWebKey> }> {
    return rotateKeys(this, nextSigningKey);
  }
}

export function createWalletIssuer(config: DPPWalletIssuerConfig): DPPWalletIssuer {
  if (!config.issuer?.startsWith('https://')) {
    throw new DPPError(DPP_ERROR_CODE.INVALID_CONFIG, 'issuer MUST be an HTTPS URL');
  }
  return new DPPWalletIssuer(config);
}
