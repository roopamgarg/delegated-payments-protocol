import { Type, type FunctionDeclaration } from '@google/genai';

/** Gemini-compatible tool declarations mirroring the reference MCP payment tool. */
export const DPP_GEMINI_FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'link_wallet',
    description:
      'Link the user wallet via OAuth PKCE. Returns an authorization URL or a safe delegation handle. Tokens stay in the server vault — never in model context.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        userId: {
          type: Type.STRING,
          description: 'Stable user id for vault partitioning',
        },
        authorizationCode: {
          type: Type.STRING,
          description: 'OAuth code from redirect (second step)',
        },
        state: {
          type: Type.STRING,
          description: 'OAuth state from the first link_wallet call',
        },
        waitForCallbackSeconds: {
          type: Type.INTEGER,
          description: 'Block up to N seconds for local OAuth callback (demo only)',
        },
      },
      required: ['userId'],
    },
  },
  {
    name: 'preview_payment',
    description:
      'Build a hashable payment intent preview bound to a delegation. Does not charge or issue capability tokens.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        delegationId: {
          type: Type.STRING,
          description: 'Safe delegation id from link_wallet',
        },
        amountValue: {
          type: Type.STRING,
          description: 'Decimal amount string, e.g. 10.00',
        },
        currency: {
          type: Type.STRING,
          description: 'ISO 4217 currency code, e.g. USD',
        },
        merchantId: { type: Type.STRING },
        rail: {
          type: Type.STRING,
          description: 'card | upi | wallet | bank_transfer | other',
        },
        idempotencyKey: { type: Type.STRING },
      },
      required: ['delegationId', 'amountValue', 'currency'],
    },
  },
  {
    name: 'confirm_payment',
    description:
      'Issue a capability from the wallet (server-side) and submit payment to the merchant. Returns safe status only.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        previewId: {
          type: Type.STRING,
          description: 'previewId from preview_payment',
        },
      },
      required: ['previewId'],
    },
  },
  {
    name: 'get_payment_status',
    description: 'Poll merchant payment status by pspPaymentId or previewId.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        pspPaymentId: { type: Type.STRING },
        previewId: { type: Type.STRING },
      },
    },
  },
];
