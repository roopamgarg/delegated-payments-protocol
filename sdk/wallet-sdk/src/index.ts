export type {
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
  SigningKeyMaterial,
  KeyRotationConfig,
} from './types.js';

export { DPPError, DPP_ERROR_CODE, type DPPErrorCode } from './errors.js';

export {
  ARTIFACT_TYPE,
  DPP_OAUTH_SCOPE,
  DPP_VERSION,
  DIGEST_ALG,
  INTENT_EVENT,
  INTENT_STATE,
  PAYMENT_RAIL,
  RAIL_CLASS,
  type IntentEvent,
  type IntentState,
} from './constants.js';

export { DPPWalletIssuer, createWalletIssuer } from './issuer.js';

export { issueCapability } from './capability.js';

export {
  computeIntentDigest,
  createIntent,
  getIntentStatus,
  resumeAfterUserAction,
  submitIntent,
} from './intent.js';

export {
  createAuthorizationUrl,
  exchangeCode,
  issueAuthorizationCode,
  revokeDelegation,
  type IssueAuthorizationCodeInput,
  type IssuedAuthorizationCode,
} from './oauth.js';

export { registerAgent, revokeAgent } from './agent-registry.js';

export { exportJwks, rotateKeys } from './crypto/jwks.js';
