# ADR-001: Capability Token Model for DPP v0.1

**Status:** Accepted (draft)  
**Date:** 2026-05-15  
**Deciders:** CTO

## Context

DPP must let users delegate bounded payment authority to AI agents without exposing raw credentials. Our [protocol research](../protocol/research.md) surveyed OAuth 2.0, UCAN, Macaroons, and SPIFFE. None provide payment-native delegation; each contributes patterns we can combine.

## Decision

DPP v0.1 will use **signed JWT capability tokens** with:

1. **Asymmetric signatures** (ES256 or EdDSA) — merchants verify offline without shared secrets with the issuer.
2. **Attenuation chain** (UCAN-inspired) — each delegation step narrows permissions; delegates cannot expand scope.
3. **Embedded caveats** (Macaroon-inspired) — machine-checkable restrictions: `maxAmount`, `currency`, `merchantAllowlist`, `expiresAt`, `nonce`.
4. **OAuth-style scope strings** — human-readable permission labels for SDK ergonomics and documentation.
5. **Separate agent identity** — `sub` identifies the agent; capabilities live in token claims, not in identity documents alone.

### Token structure (normative outline)

| Claim | Purpose |
|-------|---------|
| `iss` | Delegation issuer (user wallet service or delegate) |
| `sub` | Agent identity (did:key or SPIFFE URI profile) |
| `aud` | Intended verifier (merchant or payment rail) |
| `exp` / `nbf` | Time bounds |
| `jti` | Unique token ID for replay tracking |
| `dpp:scopes` | OAuth-style scope strings |
| `dpp:caveats` | Array of restriction objects |
| `dpp:chain` | Prior signature references for attenuation audit |

### Caveat types (v0.1 minimum)

- `amount.lte` — maximum single payment amount
- `currency.eq` — allowed currency code
- `merchant.in` — allowlisted merchant IDs
- `intent.bind` — binds token to a specific payment intent hash

## Consequences

**Positive**

- Merchants can verify tokens without calling issuer on every transaction (configurable online revocation for high-value remains possible).
- Clear separation of identity (SPIFFE/did profile) and authorization (capability token).
- Extensible caveat vocabulary for v0.2 without breaking v0.1 parsers.

**Negative**

- JWT size grows with delegation chains; deep chains may hit header limits on some payment APIs.
- Revocation requires TTL discipline or a revocation registry for high-value flows.

**Risks mitigated in follow-up work**

- Token theft → short TTL, intent binding, DPoP-style proof-of-possession (evaluate for v0.1 or v0.2).
- Scope escalation → attenuation enforced at issuance; verifiers reject expanded caveats.

## Alternatives considered

| Alternative | Rejected because |
|-------------|------------------|
| Pure OAuth bearer tokens | No native attenuation or payment caveats |
| Pure Macaroons (HMAC) | Symmetric root key distribution to all merchants is impractical at scale |
| Pure UCAN without DPP caveats | Missing payment-specific semantics |
| Opaque tokens + introspection only | Merchants depend on issuer availability; weaker offline verification |

## Next steps

- [AGE-3](/AGE/issues/AGE-3): JSON schema for capability tokens
- Threat model v0.1: validate STRIDE against this model (pending Security Researcher hire)
- OTP escalation flows: [verification-flows.md](../protocol/verification-flows.md) (AGE-4)
