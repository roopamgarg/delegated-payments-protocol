# dpp-wallet-sdk (v0.1 alpha scaffold)

Wallet issuer SDK for the [Delegated Payments Protocol](https://github.com/roopamgarg/delegated-payments-protocol). Mirrors [`dpp-merchant-sdk`](../merchant-sdk/) ergonomics: TypeScript, ESM, `DPPError` codes, and normative JSON schemas from `specs/schemas/`.

**Status:** Local ES256 capability issuance + JWKS ([AGE-36](https://github.com/roopamgarg/delegated-payments-protocol/issues)); OAuth/agent registry ([AGE-38](https://github.com/roopamgarg/delegated-payments-protocol/issues)). KMS signing tracked in AGE-50.

## Install (future)

```bash
npm install dpp-wallet-sdk@alpha
```

> Not yet published. Use monorepo `file:../../wallet-sdk` during development.

## Quick start (sketch)

```typescript
import { createWalletIssuer } from 'dpp-wallet-sdk';

const wallet = createWalletIssuer({
  issuer: 'https://wallet.example/issuer',
  signingKey: { type: 'kms', keyId: 'alias/dpp-signing', kid: '2026-05' },
  defaultCapabilityTtlSeconds: 600,
});

// Alpha scaffold — implementations in AGE-36–AGE-38:
const { compactJws } = await wallet.issueCapability({
  sub: 'did:key:z6Mk…',
  scopes: ['pay:initiate'],
  constraints: {
    maxAmount: { value: '500.00', currency: 'INR' },
    merchantAllowlist: ['merchant:demo'],
  },
});
```

## API surface (RFC)

| Module | Export | Purpose |
|--------|--------|---------|
| Issuer | `createWalletIssuer`, `DPPWalletIssuer` | Root client |
| Capabilities | `issueCapability` | Sign capability JWS |
| Intents | `createIntent`, `submitIntent`, `getIntentStatus`, `resumeAfterUserAction` | Intent FSM |
| Binding | `computeIntentDigest` | Canonical digest for `intentBind` |
| Agents | `registerAgent`, `revokeAgent` | Agent registry |
| OAuth | `createAuthorizationUrl`, `exchangeCode`, `revokeDelegation` | Agent linking (PKCE) |
| Crypto | `exportJwks`, `rotateKeys` | Merchant discovery |

Full contract: [docs/rfc/dpp-wallet-sdk-api.md](../../docs/rfc/dpp-wallet-sdk-api.md).

## Develop

```bash
cd sdk/wallet-sdk
npm install
npm test
```

## Related specifications

- [wallet-oauth-linking.md](../../docs/protocol/wallet-oauth-linking.md)
- [wallet-oauth.yaml](../../specs/openapi/wallet-oauth.yaml)
- [verification-flows.md](../../docs/protocol/verification-flows.md)
- [dpp-merchant-sdk](../merchant-sdk/) — symmetric verifier SDK
