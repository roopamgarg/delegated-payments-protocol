# Express merchant server (reference example)

Minimal **Express 5** server showing how to wire `dpp-merchant-sdk` into HTTP routes: mint a test capability, verify delegation, charge via Stripe (or an in-memory mock), and handle webhooks.

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

Server binds to `127.0.0.1` (default port `3340`).

### Smoke test (CI-friendly)

```bash
npm run smoke
```

## Stripe Test Mode sandbox

Use this path when you want real Stripe Test Mode API calls (not the in-memory mock). No card charges occur in Test Mode.

### 1. Stripe Dashboard setup

1. Sign in to [Stripe Dashboard](https://dashboard.stripe.com/) (create a free account if needed).
2. Turn **Test mode** on (toggle in the header — must show “Test mode”).
3. Go to **Developers → API keys**.
4. Under **Standard keys**, reveal and copy the **Secret key** (`sk_test_…`).
5. **Do not** paste keys into git, issues, or chat. Use a local `.env.local` file only (gitignored).

Optional webhooks: **Developers → Webhooks** (Test mode) or the [Stripe CLI](https://stripe.com/docs/stripe-cli) to forward events; set `STRIPE_WEBHOOK_SECRET=whsec_…` in `.env.local`.

### 2. Local env

```bash
cp .env.example .env.local
# Edit .env.local — set STRIPE_SECRET_KEY=sk_test_... (your test secret only)
```

### 3. Start sandbox

```bash
npm run sandbox
```

This script:

- Builds `dpp-merchant-sdk`
- Loads `.env` or `.env.local` if present
- **Requires** `sk_test_…` (exits with setup instructions if missing)
- **Rejects** `sk_live_…` keys with a clear error before the server listens
- Binds to `127.0.0.1` and prints the URL + PSP mode

Example output:

```text
[sandbox] Building dpp-merchant-sdk…
────────────────────────────────────────────
  DPP sandbox harness (Stripe Test Mode)
  URL:      http://127.0.0.1:3340
  PSP mode: stripe_test
  SANDBOX ONLY — 127.0.0.1, no live keys
────────────────────────────────────────────
DPP express-merchant demo listening on http://127.0.0.1:3340
PSP mode: Stripe Test Mode (stripe_test)
```

For offline mock PSP (no Stripe account), use `npm start` without `STRIPE_SECRET_KEY` — not `npm run sandbox`.

### Guardrail check

```bash
npm run test:guard
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness + PSP mode (`stripe_mock`, `stripe_test`) |
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

# Charge (mock Stripe by default; stripe_test when STRIPE_SECRET_KEY=sk_test_…)
curl -s -X POST http://127.0.0.1:3340/payments/delegate \
  -H 'content-type: application/json' \
  -d '{"capabilityToken":"...","paymentIntent":{...}}' | jq .
```

## Environment

| Variable | Purpose |
|----------|---------|
| `PORT` | Listen port (default `3340`) |
| `STRIPE_SECRET_KEY` | Stripe **test** secret (`sk_test_…`) — uses real Test Mode API; omit for in-memory mock |
| `STRIPE_WEBHOOK_SECRET` | Verify webhook signatures (`whsec_…`) |
| `DPP_MOCK_STRIPE_MODE` | `succeeded` (default) or `requires_action` for escalation demo (mock only) |
| `DPP_AUDIT_LOG` | Set to `1` for structured audit lines |
| `DPP_BIND_HOST` | Bind address (default `127.0.0.1`; set by `npm run sandbox`) |

**Security:** Never commit `.env` or API keys. `sk_live_…` keys are refused at startup.

## Production notes

- Remove `/demo/capability` in production; capabilities come from the user wallet.
- Pin `jwksUri` and `issuerAllowlist` — do not use ephemeral test keys.
- Never log capability JWTs or PSP secrets.

## Related docs

- [Merchant SDK integration guide](../../../docs/integration-guides/merchant-sdk.md)
- [Package README](../../merchant-sdk/README.md)
