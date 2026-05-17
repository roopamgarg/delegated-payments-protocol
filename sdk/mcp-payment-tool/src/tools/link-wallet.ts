import { randomBytes } from 'node:crypto';
import { sanitizeForLlm } from 'dpp-agent-vault';
import {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  generatePkcePair,
  mapWalletErrorToToolCode,
} from '../clients/wallet-client.js';
import {
  clearPendingOAuth,
  consumePendingVerifier,
  ensureOAuthCallbackServer,
  registerPendingOAuth,
} from '../oauth-callback.js';
import { denyIfUserIdMismatch } from '../session-principal.js';
import type { McpPaymentSession } from '../session.js';
import type { LinkWalletResult } from '../types.js';

async function storeLinkedDelegation(
  session: McpPaymentSession,
  input: {
    userId: string;
    code: string;
    codeVerifier: string;
  },
): Promise<LinkWalletResult> {
  const { config, vault } = session;
  try {
    const tokens = await exchangeAuthorizationCode(config, {
      code: input.code,
      codeVerifier: input.codeVerifier,
    });
    const handle = vault.storeOAuthTokens({
      delegationId: tokens.delegationId,
      userId: input.userId,
      agentSub: tokens.agentSub ?? config.oauth.agentSub,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      scope: tokens.scope,
      walletIssuer: config.walletIssuer,
    });
    return { status: 'linked', delegation: sanitizeForLlm(handle) };
  } catch (err) {
    return {
      status: 'error',
      code: mapWalletErrorToToolCode(err),
      message: err instanceof Error ? err.message : 'link failed',
    };
  }
}

export async function handleLinkWallet(
  session: McpPaymentSession,
  input: {
    userId: string;
    authorizationCode?: string;
    state?: string;
    waitForCallbackSeconds?: number;
  },
): Promise<LinkWalletResult> {
  const principalDenied = denyIfUserIdMismatch(session, input.userId);
  if (principalDenied) return principalDenied;

  const { config } = session;

  if (input.authorizationCode && input.state) {
    const codeVerifier = consumePendingVerifier(input.state);
    if (!codeVerifier) {
      return {
        status: 'error',
        code: 'unknown_state',
        message: 'No pending OAuth session for state — start link_wallet without a code first.',
      };
    }
    const result = await storeLinkedDelegation(session, {
      userId: input.userId,
      code: input.authorizationCode,
      codeVerifier,
    });
    clearPendingOAuth(input.state);
    return result;
  }

  const { codeVerifier, codeChallenge } = generatePkcePair();
  const state = `mcp_${randomBytes(12).toString('base64url')}`;
  const authorizationUrl = buildAuthorizationUrl(config, { state, codeChallenge });

  await ensureOAuthCallbackServer(config);

  const callbackPromise = registerPendingOAuth(state, {
    codeVerifier,
    userId: input.userId,
  });

  const waitSeconds = Math.min(Math.max(input.waitForCallbackSeconds ?? 0, 0), 120);
  if (waitSeconds > 0) {
    const timeoutMs = waitSeconds * 1000;
    const raced = await Promise.race([
      callbackPromise.then((cb) => ({ kind: 'callback' as const, cb })),
      new Promise<{ kind: 'timeout' }>((resolve) =>
        setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs),
      ),
    ]);

    if (raced.kind === 'callback') {
      const result = await storeLinkedDelegation(session, {
        userId: input.userId,
        code: raced.cb.code,
        codeVerifier,
      });
      clearPendingOAuth(state);
      return result;
    }
  }

  return {
    status: 'authorization_required',
    authorizationUrl,
    state,
    message:
      'Open authorizationUrl in a browser while signed into the wallet demo. Then call link_wallet again with authorizationCode and the same state, or set waitForCallbackSeconds.',
  };
}
