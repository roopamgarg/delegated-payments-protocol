import type { DPPWalletIssuer } from './issuer.js';
import type {
  OAuthAuthorizationRequest,
  OAuthAuthorizationUrl,
  OAuthTokenExchangeInput,
  OAuthTokenResponse,
} from './types.js';
import { notImplemented } from './not-implemented.js';

export async function createAuthorizationUrl(
  _issuer: DPPWalletIssuer,
  _request: OAuthAuthorizationRequest,
): Promise<OAuthAuthorizationUrl> {
  notImplemented('createAuthorizationUrl');
}

export async function exchangeCode(
  _issuer: DPPWalletIssuer,
  _input: OAuthTokenExchangeInput,
): Promise<OAuthTokenResponse> {
  notImplemented('exchangeCode');
}

export async function revokeDelegation(
  _issuer: DPPWalletIssuer,
  _userId: string,
  _agentSub: string,
): Promise<void> {
  notImplemented('revokeDelegation');
}
