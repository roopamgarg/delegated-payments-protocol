import type { McpPaymentSession } from './session.js';
import type { LinkWalletResult } from './types.js';

export function denyIfUserIdMismatch(
  session: McpPaymentSession,
  userId: string,
): LinkWalletResult | null {
  if (userId !== session.sessionUserId) {
    return {
      status: 'error',
      code: 'policy_denied',
      message: 'userId does not match the MCP session principal.',
    };
  }
  return null;
}

export function denyIfVaultUserMismatch(
  session: McpPaymentSession,
  vaultUserId: string,
): { status: 'error'; code: string; message: string } | null {
  if (vaultUserId !== session.sessionUserId) {
    return {
      status: 'error',
      code: 'policy_denied',
      message: 'Delegation does not belong to the MCP session principal.',
    };
  }
  return null;
}
