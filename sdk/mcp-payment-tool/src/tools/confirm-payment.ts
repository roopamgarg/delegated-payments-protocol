import { assertSafeForLlmContext } from 'dpp-agent-vault';
import { delegatePayment } from '../clients/merchant-client.js';
import { issueCapability, mapWalletErrorToToolCode } from '../clients/wallet-client.js';
import type { McpPaymentSession } from '../session.js';

export async function handleConfirmPayment(
  session: McpPaymentSession,
  input: { previewId: string },
): Promise<Record<string, unknown>> {
  const preview = session.getPreview(input.previewId);
  if (!preview) {
    return {
      status: 'error',
      code: 'preview_not_found',
      message: 'Call preview_payment first.',
    };
  }

  const secrets = session.vault.getSecrets(preview.delegationId);
  if (!secrets?.accessToken) {
    return {
      status: 'error',
      code: 'link_expired',
      message: 'Wallet delegation missing or expired — re-link with link_wallet.',
    };
  }

  let capabilityToken: string;
  try {
    const issued = await issueCapability(session.config, {
      accessToken: secrets.accessToken,
      intentBind: preview.digestHex,
    });
    capabilityToken = issued.capabilityToken;
    session.vault.storeCapability({
      delegationId: preview.delegationId,
      capabilityJws: capabilityToken,
    });
  } catch (err) {
    return {
      status: 'error',
      code: mapWalletErrorToToolCode(err),
      message: err instanceof Error ? err.message : 'capability issue failed',
    };
  }

  try {
    const result = await delegatePayment(session.config, {
      capabilityToken,
      paymentIntent: preview.paymentIntent,
    });

    if (result.pspPaymentId) {
      session.rememberPayment(input.previewId, result.pspPaymentId);
    }
    session.deletePreview(input.previewId);

    const safe = {
      status: result.status,
      verdict: result.verdict,
      pspPaymentId: result.pspPaymentId,
      requiresUserAction: result.status === 'pending_user_action',
      escalation: result.escalation
        ? { escalationId: (result.escalation as { escalationId?: string }).escalationId }
        : undefined,
      message:
        result.status === 'pending_user_action'
          ? 'Payment requires user step-up on bank/wallet surfaces — not in chat.'
          : 'Payment submitted to merchant.',
    };

    assertSafeForLlmContext(safe);
    return safe;
  } catch (err) {
    return {
      status: 'error',
      code: 'merchant_error',
      message: err instanceof Error ? err.message : 'merchant charge failed',
    };
  }
}
