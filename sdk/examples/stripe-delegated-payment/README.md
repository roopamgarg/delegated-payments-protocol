# Stripe-style delegated checkout (reference example)

This example shows how a **merchant server** verifies a DPP capability versus a `PaymentIntent` **before** creating a [Stripe PaymentIntent](https://docs.stripe.com/api/payment_intents) (or any rail). It is illustrative—wire your real wallet issuer, JWT verification, and Stripe keys in production.

## Prerequisites

- Node.js 20+
- Built merchant SDK (`dist/`)

## Run

```bash
cd sdk/merchant-sdk
npm install
npm run build
cd ../examples/stripe-delegated-payment
node checkout-flow.mjs
```

Expected output includes `delegation_valid` for the happy path object.

## Flow

1. **User** delegates via wallet → agent receives short-lived capability JWT.
2. **Agent** constructs DPP `PaymentIntent` + digest, presents to merchant checkout.
3. **Merchant** verifies JWS + issuer trust (skipped here), then calls `verifyDelegation`.
4. On `delegation_valid`, merchant creates a **Stripe PaymentIntent** for the same amount/currency and continues Elements/Checkout.
5. If Stripe requires 3DS (`requires_action`), surface bank approval—this matches DPP `railClass` `B` escalation ([verification-flows.md](../../docs/protocol/verification-flows.md)).

## Files

- `checkout-flow.mjs` — end-to-end snippet with stub capability payload
- This `README.md` — operational context for engineers

## Compliance

- Never log capability JWTs or Stripe secret keys.
- OTP/3DS happen on issuer-controlled surfaces, not in the agent chat UI.
