# Claude Desktop MCP Setup (DPP v0.1)

**Package:** [`dpp-claude-desktop-mcp`](../../sdk/platform-adapters/claude-desktop/) (§8.13) · **Server:** [`dpp-mcp-payment-tool`](../../sdk/mcp-payment-tool/) (§8.8)

## Install

Build wallet-sdk, agent-vault, and mcp-payment-tool, then:

```bash
cd sdk/platform-adapters/claude-desktop && npm install && npm run print-config
```

Register MCP agent via `POST /v1/agents` on wallet (`:3350`).

## Configure

Merge `print-config` output into Claude Desktop `claude_desktop_config.json` (macOS: `~/Library/Application Support/Claude/`). Restart Claude.

## Flow

`link_wallet` → OAuth in browser → `preview_payment` → `confirm_payment` → `get_payment_status`.

Never paste OTPs into chat; use wallet UI on `requiresUserAction`.
