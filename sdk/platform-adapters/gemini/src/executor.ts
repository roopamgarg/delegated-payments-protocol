import {
  handleConfirmPayment,
  handleGetPaymentStatus,
  handleLinkWallet,
  handlePreviewPayment,
  type McpPaymentSession,
} from 'dpp-mcp-payment-tool';

export type GeminiFunctionCall = {
  name: string;
  args?: Record<string, unknown>;
};

const KNOWN_TOOLS = new Set([
  'link_wallet',
  'preview_payment',
  'confirm_payment',
  'get_payment_status',
]);

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing or invalid string field: ${key}`);
  }
  return value;
}

function optionalString(record: Record<string, unknown>, key: string): string | undefined {
  const value = record[key];
  return typeof value === 'string' ? value : undefined;
}

function optionalNumber(record: Record<string, unknown>, key: string): number | undefined {
  const value = record[key];
  return typeof value === 'number' ? value : undefined;
}

/** Execute a Gemini function call against the shared MCP payment session (vault + HTTP). */
export async function executeGeminiFunctionCall(
  session: McpPaymentSession,
  call: GeminiFunctionCall,
): Promise<unknown> {
  const name = call.name;
  const args = call.args ?? {};

  if (!KNOWN_TOOLS.has(name)) {
    return { status: 'error', code: 'unknown_tool', message: `Unknown function: ${name}` };
  }

  switch (name) {
    case 'link_wallet':
      return handleLinkWallet(session, {
        userId: requireString(args, 'userId'),
        authorizationCode: optionalString(args, 'authorizationCode'),
        state: optionalString(args, 'state'),
        waitForCallbackSeconds: optionalNumber(args, 'waitForCallbackSeconds'),
      });
    case 'preview_payment':
      return handlePreviewPayment(session, {
        delegationId: requireString(args, 'delegationId'),
        amountValue: requireString(args, 'amountValue'),
        currency: requireString(args, 'currency'),
        merchantId: optionalString(args, 'merchantId'),
        rail: optionalString(args, 'rail') as
          | 'card'
          | 'upi'
          | 'wallet'
          | 'bank_transfer'
          | 'other'
          | undefined,
        idempotencyKey: optionalString(args, 'idempotencyKey'),
      });
    case 'confirm_payment':
      return handleConfirmPayment(session, {
        previewId: requireString(args, 'previewId'),
      });
    case 'get_payment_status':
      return handleGetPaymentStatus(session, {
        pspPaymentId: optionalString(args, 'pspPaymentId'),
        previewId: optionalString(args, 'previewId'),
      });
    default:
      return { status: 'error', code: 'unknown_tool', message: `Unknown function: ${name}` };
  }
}
