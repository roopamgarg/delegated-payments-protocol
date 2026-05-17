import { assertSafeForLlmContext } from 'dpp-agent-vault';
import { getPaymentStatus } from '../clients/merchant-client.js';
import type { McpPaymentSession } from '../session.js';

export async function handleGetPaymentStatus(
  session: McpPaymentSession,
  input: { pspPaymentId?: string; previewId?: string },
): Promise<Record<string, unknown>> {
  const pspPaymentId =
    input.pspPaymentId ??
    (input.previewId ? session.getPaymentIdForPreview(input.previewId) : undefined);

  if (!pspPaymentId) {
    return {
      status: 'error',
      code: 'missing_payment_id',
      message: 'Provide pspPaymentId from confirm_payment or previewId.',
    };
  }

  try {
    const result = await getPaymentStatus(session.config, pspPaymentId);
    const safe = {
      status: result.status,
      pspPaymentId: result.pspPaymentId ?? pspPaymentId,
      requiresUserAction: result.status === 'pending_user_action',
      escalation: result.escalation
        ? { escalationId: (result.escalation as { escalationId?: string }).escalationId }
        : undefined,
    };
    assertSafeForLlmContext(safe);
    return safe;
  } catch (err) {
    return {
      status: 'error',
      code: 'merchant_error',
      message: err instanceof Error ? err.message : 'status poll failed',
    };
  }
}
