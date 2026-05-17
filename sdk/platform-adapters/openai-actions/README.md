# `dpp-openai-actions`

HTTP adapter exposing the [`dpp-mcp-payment-tool`](../../mcp-payment-tool) flow for ChatGPT Actions (OpenAPI import).

Wallet OAuth stays on the MCP OAuth callback helper: register `DPP_OAUTH_REDIRECT_URI` with your issuer separately from ChatGPT. This Actions server exposes payment HTTP routes only.

## Headers

Authenticate with `DPP_ACTIONS_API_KEY` as `Authorization: Bearer …` **or** `X-Api-Key`.

Identify the payer with **`X-DPP-User-Id`** (`userId` JSON field acceptable for demos). Map this reliably to ChatGPT-signed-in principals in production.

## Run

Copy `.env.example`, fill placeholders, export env vars:

```bash
npm install
npm run build
npm start
```

Point the GPT builder at `{DPP_ACTIONS_PUBLIC_URL}/openapi.yaml`.

See `chatgpt-oauth-wiring.json` for GPT builder wiring checklist.
