# Wallet issuer MVP (`@dpp/example-wallet-issuer`)

Reference **wallet service** for DPP v0.1: deployable Express app built on [`dpp-wallet-sdk`](../../wallet-sdk). Demonstrates demo user accounts, mock UPI/card linking, OAuth PKCE agent consent, JWKS discovery, and capability issuance.

## Quick start

```bash
cd sdk/wallet-sdk && npm run build
cd ../examples/wallet-issuer && npm install && npm run smoke
npm start
```

Default URL: `http://127.0.0.1:3350`  
Issuer claim (`iss`): `https://127.0.0.1:3350/issuer` (override with `WALLET_ISSUER`).

## Endpoints

| Route | Purpose |
|-------|---------|
| `GET /` | Wallet home (link payment methods) |
| `GET /login` | Demo user sign-in |
| `GET /oauth/authorize` | OAuth authorize + consent UI |
| `POST /oauth/consent` | Approve/deny agent linking |
| `POST /oauth/token` | Authorization code exchange |
| `GET /.well-known/jwks.json` | Merchant trust config |
| `POST /v1/delegations/issue` | Issue capability JWS (Bearer delegation token) |
| `GET /v1/users/me/rails` | Rail catalog after linking methods |

## E2E with express-merchant

Point merchant `issuerAllowlist` at this service’s `WALLET_ISSUER` and load JWKS from `/.well-known/jwks.json`. The pre-registered demo agent matches [`fixtures.mjs`](./fixtures.mjs).

## Security notes

Demo only: in-memory stores, single demo user. `POST /v1/agents` requires `Authorization: Bearer` with `DPP_OPERATOR_TOKEN` (see `.env.example`). Set `DPP_AGENT_REGISTRATION=0` in production to disable public registration. Do not use in production without persistence, TLS, and real authentication.
