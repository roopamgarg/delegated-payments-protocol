# Payment Intents (DPP v0.1)

**Status:** Draft specification  
**Last updated:** 2026-05-15  
**Related:** [verification-flows.md](./verification-flows.md), [agent-identity.md](./agent-identity.md), [JSON Schema](../../specs/schemas/payment-intent.schema.json)

A **payment intent** is the structured, hashable request that agents submit alongside capability tokens. It binds delegation to a concrete financial action: amount, currency, merchant, and rail metadata.

---

## 1. Objectives

1. **Deterministic verification** — Merchants and wallets recompute digests and compare to capability `intent.bind` caveats.
2. **Rail clarity** — `rail` and `railClass` map to the authentication patterns in [verification-flows.md](./verification-flows.md).
3. **Auditability** — `intentId` and `idempotencyKey` support correlation without exposing PII in agent channels.

---

## 2. Field summary

| Field | Purpose |
|-------|---------|
| `dpp` / `typ` | Version (`0.1`) and discriminator (`payment_intent`) |
| `intentId` | Wallet- or merchant-visible correlation ID |
| `idempotencyKey` | Agent-supplied idempotency for safe retries |
| `amount` | Decimal string `value` + ISO 4217 `currency` (major/minor handling is rail-specific; use smallest practical unit policy per wallet) |
| `merchantId` | `merchant:` prefixed identifier aligned with capability caveats |
| `rail` | Transport family (`card`, `upi`, `wallet`, `bank_transfer`, `other`) |
| `railClass` | `A`–`D` per §3 |
| `mandateId` | Required for class `C` mandates |
| `metadata` | Optional non-sensitive key/value hints (order id, MCC) |
| `digest` | `sha-256` hex over canonical intent (see §4) |

**Normative:** JSON MUST conform to [`payment-intent.schema.json`](../../specs/schemas/payment-intent.schema.json).

---

## 3. Rail classes

| Class | Meaning | Typical rails |
|-------|---------|---------------|
| `A` | Delegation-only pre-authorized band | Internal wallet balances, micro-limits |
| `B` | Step-up per transaction | UPI P2M with OTP, 3-D Secure |
| `C` | Mandate-gated | UPI autopay, SEPA DD, registered recurring |
| `D` | Explicit approval | Push-to-approve, per-intent user decisions |

Mapping tables and state machines are normative in [verification-flows.md](./verification-flows.md).

---

## 4. Canonical serialization and digest

**Goal:** Two independent implementations MUST produce the same `digest.value` for identical logical intent fields.

**v0.1 canonical rules (normative):**

1. Start from the payment intent JSON **excluding** the `digest` property.
2. Serialize with **keys sorted lexicographically** at every object level, UTF-8, no insignificant whitespace, no duplicated keys.
3. Numbers MUST NOT appear; monetary amounts are **strings** in `amount.value`.
4. Compute SHA-256 over the UTF-8 octets of the canonical string; lowercase hex-encode the digest.
5. Set `digest` to `{ "alg": "sha-256", "value": "<hex>" }`.

**Informative:** Future versions may register a JCS or RFC 8785 profile; v0.1 uses explicit sort + stable JSON to avoid parser ambiguity.

---

## 5. Capability binding

Capability tokens embed caveats restricting delegation. At minimum, wallets MUST ensure:

- Parsed `amount.currency` and decimal `amount.value` respect `constraints.maxAmount` and currency rules on the token.
- `merchantId` is in `constraints.merchantAllowlist`.
- When the token carries an `intent.bind` caveat, its hash equals `digest.value`.

Forbidden capabilities (e.g., OTP bypass) are listed in [verification-flows.md §6](./verification-flows.md).

---

## 6. Agent and wallet responsibilities

| Actor | MUST |
|-------|------|
| Agent | Supply fresh `idempotencyKey` per new logical payment; never reuse for changed amounts or merchants |
| Agent | Include accurate `railClass` provided by wallet catalog; do not downgrade class to skip escalation |
| Wallet | Validate digest, caveats, and escalation state transitions atomically |
| Merchant | Re-verify binding before initiating rail capture (see [verification-flows §7](./verification-flows.md)) |

---

## 7. Security considerations

| Risk | Mitigation |
|------|------------|
| Digest replay | Bind digest to expiring capability `nonce` / `jti`; short TTL |
| Metadata injection | `metadata` values are strings only; no nested JSON; reject suspicious size |
| Mandate bypass | Class `C` requires valid `mandateId` and active mandate ([mandate schema](../../specs/schemas/mandate.schema.json)) |

---

## 8. References

- [Verification and escalation flows](./verification-flows.md)
- [Capability token schema](../../specs/schemas/capability-token.schema.json)
- [Mandate schema](../../specs/schemas/mandate.schema.json)
