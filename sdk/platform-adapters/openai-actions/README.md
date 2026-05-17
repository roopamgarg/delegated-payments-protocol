# dpp-openai-actions

HTTP adapter exposing the [`dpp-mcp-payment-tool`](../../mcp-payment-tool) primitives as endpoints suitable for importing into ChatGPT Actions (OpenAPI-first).

This package does **not** replace wallet OAuth—you still register `DPP_OAUTH_REDIRECT_URI` with your wallet issuer—the Actions server exposes payment flow HTTP only.

## Quick start

Copy `.env.example` to `.env`, fill secrets, export into the shell, then:

```bash
npm install
npm run build
npm start
```

Expose `openapi.yaml` to the GPT builder (served locally at `/openapi.yaml`).

## Headers

Authenticated routes require **`DPP_ACTIONS_API_KEY`** as `Authorization: Bearer …` **or** `X-Api-Key`.

End-user partitioning uses **`X-DPP-User-Id`** (or `userId` in JSON bodies for demos). Never let the language model synthesize identities.

See `chatgpt-oauth-wiring.json` for a short checklist bridging wallet OAuth versus Actions API secrets.
