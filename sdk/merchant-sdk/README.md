# DPP Merchant SDK (v0.1 contract)

TypeScript types and a small **offline verifier** that checks whether a parsed capability token payload is consistent with a `PaymentIntent`.

## Security notes

- **Validate JWT signatures** (JWS) and **issuer trust** before calling `verifyDelegation`.
- This package does **not** implement JWKS fetch, revocation, or online introspection.
- Amount comparison uses deterministic string logic suitable for demo and tests; high-scale merchants should substitute a certified decimal library.

## Usage

```typescript
import { verifyDelegation } from 'dpp-merchant-sdk';

const result = verifyDelegation({ capability, paymentIntent });
if (result.verdict !== 'delegation_valid') {
  throw new Error(result.reasons.join(','));
}
```

## Related specifications

- [`specs/schemas/capability-token.schema.json`](../../specs/schemas/capability-token.schema.json)
- [`specs/schemas/payment-intent.schema.json`](../../specs/schemas/payment-intent.schema.json)
- [`docs/protocol/verification-flows.md`](../../docs/protocol/verification-flows.md)

## Develop

```bash
cd sdk/merchant-sdk
npm install
npm run typecheck
```
