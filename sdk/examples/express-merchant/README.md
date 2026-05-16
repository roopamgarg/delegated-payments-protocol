# Express merchant server (reference example)

Minimal **Express 5** server showing how to wire `@dpp/merchant-sdk` into HTTP routes: mint a test capability, verify delegation, charge via Stripe (or an in-memory mock), and handle webhooks.

## Prerequisites

- Node.js 20+
- Built merchant SDK:

```bash
cd sdk/merchant-sdk
npm install
npm run build
```

## Install and run

```bash
cd sdk/examples/express-merchant
npm install
npm start
```

Server defaults to `http://127.0.0.1:3340`.

### Smoke test (CI-friendly)

```bash
npm run smoke
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness + PSP mode (`stripe_mock` or `stripe_live`) |
| `POST` | `/demo/capability` | **Dev only** — returns signed JWT + sample `PaymentIntent` |
| `POST` | `/delegation/verify` | JWS + offline checks, no PSP charge |
| `POST` | `/payments/delegate` | Full `processPayment` flow |
| `GET` | `/payments/:pspPaymentId/status` | Poll PSP status |
| `POST` | `/webhooks/stripe` | Raw body webhook handler |

## Try it

```bash
# Mint sample token + intent
curl -s -X POST http://127.0.0.1:3340/demo/capability | jq .

# Verify only
curl -s -X POST http://127.0.0.1:3340/delegation/verify \
  -H 'content-type: application/json' \
  -d @- <<'EOF' | jq .
{
  "capabilityToken": "<paste from demo>",
  "paymentIntent": <paste intent object>
}
EOF

# Charge (mock Stripe by default)
curl -s -X POST http://127.0.0.1:3340/payments/delegate \
  -H 'content-type: application/json' \
  -d '{"capabilityToken":"...","paymentIntent":{...}}' | jq .
```

## Environment

| Variable | Purpose |
|----------|---------|
| `PORT` | Listen port (default `3340`) |
| `STRIPE_SECRET_KEY` | Use live Stripe adapter instead of mock |
| `STRIPE_WEBHOOK_SECRET` | Verify webhook signatures |
| `DPP_MOCK_STRIPE_MODE` | `succeeded` (default) or `requires_action` for escalation demo |
| `DPP_AUDIT_LOG` | Set to `1` for structured audit lines |

## Production notes

- Remove `/demo/capability` in production; capabilities come from the user wallet.
- Pin `jwksUri` and `issuerAllowlist` — do not use ephemeral test keys.
- Never log capability JWTs or PSP secrets.

## Related docs

- [Merchant SDK integration guide](../../../docs/integration-guides/merchant-sdk.md)
- [Package README](../../merchant-sdk/README.md)
