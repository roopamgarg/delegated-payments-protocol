# dpp-merchant-sdk (v0.2 alpha)

Production-oriented merchant SDK for the [Delegated Payments Protocol](https://github.com/roopamgarg/delegated-payments-protocol). Verifies capability tokens (JWS), validates delegation against payment intents, and orchestrates PSP charges with escalation handling per [verification-flows.md](../../docs/protocol/verification-flows.md).

## Install

```bash
npm install dpp-merchant-sdk@alpha
# Optional PSP peers:
npm install stripe          # StripeAdapter
npm install razorpay        # RazorpayAdapter
```

> **npm:** Published as `dpp-merchant-sdk` (unscoped — `@dpp` org unavailable on npm). Install with `@alpha` tag.

## Quick start (Stripe)

```typescript
import { createMerchant } from 'dpp-merchant-sdk';

const dpp = createMerchant({
  psp: 'stripe',
  trust: {
    jwksUri: 'https://wallet.example/.well-known/jwks.json',
    issuerAllowlist: ['https://wallet.example/issuer'],
  },
  credentials: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  },
});

const result = await dpp.processPayment({
  capabilityToken: req.body.token, // compact JWS
  paymentIntent: req.body.intent,
});

if (result.status === 'pending_user_action') {
  // Surface 3DS / bank approval — do not fulfill yet
  return res.json({ escalation: result.escalation, clientSecret: result.psp.clientSecret });
}
```

## API surface

| Export | Purpose |
|--------|---------|
| `DPPMerchant` / `createMerchant` | End-to-end verify + charge |
| `validateDelegation` | JWS + offline caveat checks |
| `verifyDelegation` | Offline checks only (parsed payloads) |
| `verifyCapabilityJws` | Signature, schema validation, nonce/`jti` replay gate |
| `InMemoryNonceStore` / `NonceStore` | Pluggable replay protection (use Redis in prod) |
| `StripeAdapter` / `RazorpayAdapter` | PSP integrations |
| `transition`, `canTransition` | Escalation state machine helpers |

## Security

- Built-in rejection of forbidden claims (`dpp:otpBypass`, etc.).
- AJV validation against the normative capability token schema after JWS verify.
- Default in-memory `nonce` / `jti` replay store; inject a distributed `nonceStore` for production.
- Configure `issuerAllowlist` and JWKS pinning in production.
- Merchants verify delegation **before** rail handoff; OTP/3DS completion stays on the user channel.
- Set `DPP_AUDIT_LOG=1` for structured audit lines.

## Publish (maintainers)

After merge to `main`, from `sdk/merchant-sdk`:

```bash
npm login
npm publish --tag alpha   # first v0.2.0-alpha.0
```

`prepublishOnly` runs the test suite. Promote to `latest` only after board sign-off on coverage and hardening follow-ups.

## Develop

```bash
cd sdk/merchant-sdk
npm install
npm test
```

## Integration guide

See [docs/integration-guides/merchant-sdk.md](../../docs/integration-guides/merchant-sdk.md) for end-to-end wiring, security checklist, and API reference. Run the [Express example](../examples/express-merchant/) locally.

## Related specifications

- [`specs/schemas/capability-token.schema.json`](../../specs/schemas/capability-token.schema.json)
- [`docs/protocol/verification-flows.md`](../../docs/protocol/verification-flows.md)
