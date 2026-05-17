# dpp-mcp-payment-tool

Reference **MCP server** for DPP v0.1 delegated payments. Exposes four tools that call the wallet and merchant HTTP APIs while keeping OAuth tokens and capability JWS in [`dpp-agent-vault`](../agent-vault/) — never in LLM tool JSON.

Normative context: [wallet-oauth-linking.md](../../docs/protocol/wallet-oauth-linking.md), plan §8.8.

## Tools

| Tool | Purpose |
|------|---------|
| `link_wallet` | OAuth PKCE wallet link → vault-stored delegation handle |
| `preview_payment` | Build intent + digest preview (no charge) |
| `confirm_payment` | Issue capability (wallet) + charge (merchant) |
| `get_payment_status` | Poll merchant PSP status |

## Prerequisites

- Node.js 20+
- Running [wallet-issuer](../examples/wallet-issuer/) (`:3350`) and [express-merchant](../examples/express-merchant/) (`:3340`)
- Built dependencies:

```bash
cd sdk/wallet-sdk && npm ci && npm run build
cd ../agent-vault && npm ci && npm run build
cd ../mcp-payment-tool && npm ci && npm run build
```

Register the MCP agent once (operator token from wallet-issuer env):

```bash
curl -s -X POST http://127.0.0.1:3350/v1/agents \
  -H "Authorization: Bearer dev-operator-token" \
  -H 'content-type: application/json' \
  -d '{"sub":"did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGJpnn5uSiZuNR","displayName":"DPP Reference MCP Agent","redirectUris":["http://127.0.0.1:8765/oauth/callback"]}' | jq .
```

Use `clientId` from the response (or `/health` `demoClientId` when using the bundled demo agent).

## Configure

```bash
export DPP_VAULT_MASTER_KEY="$(openssl rand -base64 32)"
export DPP_OAUTH_CLIENT_ID="<clientId from wallet>"
export DPP_MCP_AGENT_SUB="did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGJpnn5uSiZuNR"
export DPP_WALLET_BASE_URL="http://127.0.0.1:3350"
export DPP_MERCHANT_BASE_URL="http://127.0.0.1:3340"
```

See [`.env.example`](./.env.example).

## Run (stdio MCP)

```bash
npm start
```

Wire into Cursor / Claude Desktop MCP config:

```json
{
  "mcpServers": {
    "dpp-payments": {
      "command": "node",
      "args": ["/path/to/sdk/mcp-payment-tool/dist/bin/dpp-mcp-payment.js"],
      "env": {
        "DPP_VAULT_MASTER_KEY": "...",
        "DPP_OAUTH_CLIENT_ID": "...",
        "DPP_MCP_AGENT_SUB": "did:key:..."
      }
    }
  }
}
```

## Local OAuth flow

1. `link_wallet` → open `authorizationUrl` (wallet demo user must be logged in at `/login`).
2. Approve consent → callback hits `http://127.0.0.1:8765/oauth/callback`.
3. Either set `waitForCallbackSeconds` on the first call, or call `link_wallet` again with `authorizationCode` + `state`.
4. `preview_payment` → `confirm_payment` → `get_payment_status`.

## Security

- Tool responses pass `assertSafeForLlmContext` / vault sanitization.
- Capabilities are issued at **confirm** time with `intentBind` from the preview digest.
- OTP / 3DS escalations return `requiresUserAction` — never bypass.

## Test

```bash
npm test
```

Unit tests cover intent building and vault-safe payloads (no live wallet required).
