import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { McpPaymentConfig } from './types.js';
import { McpPaymentSession } from './session.js';
import { handleLinkWallet } from './tools/link-wallet.js';
import { handlePreviewPayment } from './tools/preview-payment.js';
import { handleConfirmPayment } from './tools/confirm-payment.js';
import { handleGetPaymentStatus } from './tools/get-payment-status.js';

function jsonContent(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
  };
}

export function createMcpPaymentServer(config: McpPaymentConfig): McpServer {
  const session = new McpPaymentSession(config);
  const server = new McpServer(
    { name: 'dpp-mcp-payment-tool', version: '0.1.0-alpha.0' },
    { capabilities: { tools: {} } },
  );

  server.registerTool(
    'link_wallet',
    {
      description:
        'Link the user wallet via OAuth PKCE. Returns an authorization URL or a safe delegation handle. Tokens stay in the server vault — never in model context.',
      inputSchema: {
        userId: z.string().describe('Must match DPP_SESSION_USER_ID for this MCP server process'),
        authorizationCode: z.string().optional().describe('OAuth code from redirect (second step)'),
        state: z.string().optional().describe('OAuth state from the first link_wallet call'),
        waitForCallbackSeconds: z
          .number()
          .int()
          .min(0)
          .max(120)
          .optional()
          .describe('Block up to N seconds for local OAuth callback (demo)'),
      },
    },
    async (args) => jsonContent(await handleLinkWallet(session, args)),
  );

  server.registerTool(
    'preview_payment',
    {
      description:
        'Build a hashable payment intent preview bound to a delegation. Does not charge or issue capability tokens.',
      inputSchema: {
        delegationId: z.string().describe('Safe delegation id from link_wallet'),
        amountValue: z.string().describe('Decimal amount string, e.g. 10.00'),
        currency: z.string().describe('ISO 4217 currency code, e.g. USD'),
        merchantId: z.string().optional(),
        rail: z.enum(['card', 'upi', 'wallet', 'bank_transfer', 'other']).optional(),
        idempotencyKey: z.string().optional(),
      },
    },
    async (args) => jsonContent(await handlePreviewPayment(session, args)),
  );

  server.registerTool(
    'confirm_payment',
    {
      description:
        'Issue a capability from the wallet (server-side) and submit payment to the merchant. Returns safe status only.',
      inputSchema: {
        previewId: z.string().describe('previewId from preview_payment'),
      },
    },
    async (args) => jsonContent(await handleConfirmPayment(session, args)),
  );

  server.registerTool(
    'get_payment_status',
    {
      description: 'Poll merchant payment status by pspPaymentId or previewId.',
      inputSchema: {
        pspPaymentId: z.string().optional(),
        previewId: z.string().optional(),
      },
    },
    async (args) => jsonContent(await handleGetPaymentStatus(session, args)),
  );

  return server;
}

export async function runMcpPaymentStdio(config: McpPaymentConfig): Promise<void> {
  const server = createMcpPaymentServer(config);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
