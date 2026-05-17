# dpp-gemini-payment-adapter

**Google Gemini** platform adapter for DPP v0.1 — function-calling declarations, server-side tool executor, and OAuth wallet-link sample. Plan §8.14.

Maps the four [reference MCP payment tools](../../mcp-payment-tool/) to Gemini `FunctionDeclaration`s. Execution reuses `dpp-mcp-payment-tool` handlers and `dpp-agent-vault` so OAuth tokens and capability JWS never enter the model transcript.

## Architecture

```
User prompt → Gemini API (function declarations)
                    ↓ functionCall parts
            executeGeminiFunctionCall(session)
                    ↓
        dpp-mcp-payment-tool + dpp-agent-vault
                    ↓
        wallet-issuer (:3350) + express-merchant (:3340)
```

## Prerequisites

Same stack as the MCP tool:

1. [wallet-issuer](../../examples/wallet-issuer/) on `:3350`
2. [express-merchant](../../examples/express-merchant/) on `:3340`
3. Built `dpp-wallet-sdk`, `dpp-agent-vault`, `dpp-mcp-payment-tool`

```bash
cd sdk/wallet-sdk && npm ci && npm run build
cd ../agent-vault && npm ci && npm run build
cd ../mcp-payment-tool && npm ci && npm run build
cd ../platform-adapters/gemini && npm install && npm run build
```

Register the MCP agent once per [mcp-payment-tool README](../../mcp-payment-tool/README.md).

## Configure

Copy [`.env.example`](./.env.example).

| Variable | Required for |
|----------|----------------|
| `DPP_VAULT_MASTER_KEY`, `DPP_OAUTH_CLIENT_ID`, `DPP_MCP_AGENT_SUB` | Tool execution |
| `GEMINI_API_KEY` | Interactive `npm run sample` only |

## OAuth flow (wallet link)

1. Model calls `link_wallet` (or run `npm run sample` with a link prompt).
2. Open `authorizationUrl` in a browser (wallet demo user logged in at `/login`).
3. Approve consent → `http://127.0.0.1:8765/oauth/callback`.
4. Use `waitForCallbackSeconds` on the first call, or call `link_wallet` again with `authorizationCode` + `state`.
5. `preview_payment` → `confirm_payment` → `get_payment_status`.

## Embed in your app

```typescript
import { GoogleGenAI } from '@google/genai';
import { loadConfigFromEnv, McpPaymentSession } from 'dpp-mcp-payment-tool';
import {
  DPP_GEMINI_FUNCTION_DECLARATIONS,
  executeGeminiFunctionCall,
} from 'dpp-gemini-payment-adapter';

const session = new McpPaymentSession(loadConfigFromEnv());
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const response = await ai.models.generateContent({
  model: 'gemini-2.0-flash',
  contents: [{ role: 'user', parts: [{ text: 'Preview a $5 payment' }] }],
  config: { tools: [{ functionDeclarations: DPP_GEMINI_FUNCTION_DECLARATIONS }] },
});
// Dispatch functionCall parts via executeGeminiFunctionCall; return functionResponse to the model.
```

## Interactive sample

```bash
export GEMINI_API_KEY="..."
npm run sample -- "Link my wallet and preview $1.00 USD"
```

## Test

```bash
npm test
```

## Security

- Vault sanitization, intent binding at confirm, `requiresUserAction` for OTP/3DS — same as MCP.
- Never put `GEMINI_API_KEY`, vault keys, or raw OAuth tokens in prompts or tool args.
