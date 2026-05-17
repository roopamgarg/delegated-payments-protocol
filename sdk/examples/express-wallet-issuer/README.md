# Express wallet issuer server (reference example)

Minimal **Express 5** server showing how to wire `dpp-wallet-sdk` into HTTP routes for wallet OAuth linking, JWKS discovery, capability issuance, and payment intent submission.

Pairs with [`express-merchant`](../express-merchant/) — point the merchant demo at this server's JWKS and issuer URL.

## Prerequisites

- Node.js 20+
- Built wallet SDK:

```bash
cd sdk/wallet-sdk
npm install
npm run build
```

## Install and run

```bash
cd sdk/examples/express-wallet-issuer
npm install
npm start
```

Server defaults to `http://127.0.0.1:3350`.

### Smoke test (CI-friendly)

```bash
npm run smoke
```

Smoke harness env (optional): `DPP_SMOKE_ORIGIN`, `DPP_SMOKE_REDIRECT_URI`, `DPP_SMOKE_PORT` — defaults to `http://127.0.0.1:3352` and `{origin}/demo/oauth/callback`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness + configured issuer |
| `GET` | `/.well-known/jwks.json` | Issuer signing keys (`exportJwks`) |
| `GET` | `/.well-known/oauth-authorization-server` | RFC 8414 metadata |
| `GET` | `/oauth/authorize` | PKCE authorization (HTML consent or auto-redirect) |
| `POST` | `/oauth/token` | Authorization code exchange |
| `POST` | `/oauth/revoke` | Demo delegation revoke |
| `POST` | `/v1/agents` | Register agent (`registerAgent`; requires `Authorization: Bearer` operator token) |
| `POST` | `/v1/intents` | Submit intent + capability (demo in-memory FSM) |
| `GET` | `/v1/intents/:intentId` | Poll intent status |
| `POST` | `/v1/intents/:intentId/cancel` | Cancel before settlement |
| `POST` | `/demo/capability` | **Dev only** — mint signed capability + sample intent |
| `POST` | `/demo/oauth/consent` | Demo consent form handler |

## Try it

```bash
# JWKS + capability
curl -s http://127.0.0.1:3350/.well-known/jwks.json | jq .
curl -s -X POST http://127.0.0.1:3350/demo/capability | jq .

# Submit intent
curl -s -X POST http://127.0.0.1:3350/v1/intents \
  -H 'content-type: application/json' \
  -d '{"paymentIntent":{...},"capabilityToken":"..."}' | jq .
```

## Environment

| Variable | Purpose |
|----------|---------|
| `PORT` | Listen port (default `3350`) |
| `DPP_ISSUER` | HTTPS issuer URL for JWT `iss` (default `https://127.0.0.1:{PORT}/issuer`) |
| `DPP_OPERATOR_TOKEN` | Bearer token for `POST /v1/agents` (default `dev-operator-token`; set a strong secret in prod) |
| `DPP_AGENT_REGISTRATION` | `0` = disable `POST /v1/agents` (404; use for production when agents are provisioned out-of-band) |
| `DPP_DEMO_USER_ID` | Synthetic user id for demo OAuth consent |
| `DPP_DEMO_AUTO_CONSENT` | `1` = skip HTML consent on `/oauth/authorize` |

## Production notes

- Set `DPP_AGENT_REGISTRATION=0` and provision agents via operator tooling (not public HTTP).
- Require a strong `DPP_OPERATOR_TOKEN` (or mTLS at the edge) if registration HTTP remains enabled.
- Remove `/demo/*` routes in production; use real consent UI and vault storage for tokens.
- Intent routes use an **in-memory demo store** until `dpp-wallet-sdk` intent FSM is wired (AGE-37 package implementation).
- Use KMS signing (`AGE-50`); never commit private keys.
- Never log capability JWTs or OAuth tokens.

## Related docs

- [Wallet SDK API RFC](../../../docs/rfc/dpp-wallet-sdk-api.md)
- [wallet-oauth.yaml](../../../specs/openapi/wallet-oauth.yaml)
- [express-merchant](../express-merchant/) — merchant verification demo
