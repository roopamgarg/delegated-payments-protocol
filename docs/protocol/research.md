# Protocol Research: Delegation Standards Survey

**Status:** Initial draft (v0.1 research phase)  
**Author:** CTO / DPP team  
**Last updated:** 2026-05-15

This document surveys existing delegation and authorization standards relevant to DPP v0.1. The goal is to identify proven patterns, gaps for financial delegation, and design constraints before committing to protocol primitives.

---

## Executive Summary

| Standard | Primary model | Strength for DPP | Gap for DPP |
|----------|---------------|------------------|-------------|
| OAuth 2.0 | Bearer tokens + scopes via AS | Mature ecosystem, scope syntax, refresh/revocation | Not payment-native; tokens often opaque; no built-in attenuation |
| UCAN | Chained capability JWTs (did:key) | Delegation chains, attenuation, offline verification | No payment semantics; key management burden |
| Macaroons | HMAC caveats on bearer tokens | Third-party delegation, embedded restrictions | Symmetric keys; caveat language not standardized for payments |
| SPIFFE/SPIRE | Workload identity (X.509/SVID) | Strong agent/service identity | Infrastructure-focused; no user delegation or payment intents |

**Preliminary conclusion:** DPP should adopt a **hybrid capability-token model** inspired by UCAN attenuation and Macaroon caveats, with OAuth-like scope syntax for ergonomics, and SPIFFE-compatible agent identity hooks. Payment-specific semantics (amount limits, merchant binding, OTP escalation) must be defined by DPP—not inherited wholesale from any single standard.

---

## 1. OAuth 2.0 Delegation Model

### Overview

OAuth 2.0 ([RFC 6749](https://datatracker.ietf.org/doc/html/rfc6749)) delegates access via an **authorization server** that issues access tokens to clients acting on a resource owner's behalf. Scopes express coarse-grained permissions; refresh tokens enable long-lived delegation with revocation.

### Relevant Patterns

- **Scope-based least privilege** — `scope` parameter limits what a client can do
- **Authorization code + PKCE** — secure user consent for public clients
- **Token introspection / revocation** — centralized control when tokens are opaque
- **Resource indicators** ([RFC 8707](https://datatracker.ietf.org/doc/html/rfc8707)) — bind tokens to specific APIs

### Applicability to DPP

| Aspect | Assessment |
|--------|------------|
| User consent flow | Strong fit — DPP needs explicit user grants for delegation |
| Scope syntax | Useful baseline for permission strings (`pay:merchant:123:max:500`) |
| Token format | JWT access tokens ([RFC 9068](https://datatracker.ietf.org/doc/html/rfc9068)) align with verifiable capabilities |
| Financial semantics | **Not present** — OAuth scopes don't express amount, currency, or time windows natively |
| Agent identity | Client credentials identify apps, not individual agent instances |

### Gaps

- No standard for **payment intent** structure or merchant verification
- Bearer token theft remains a risk without binding (DPoP [RFC 9449](https://datatracker.ietf.org/doc/html/rfc9449) helps)
- Refresh tokens can grant overly broad long-lived access if scopes aren't attenuated at grant time

### DPP Takeaways

1. Adopt scope-like syntax for human-readable permission boundaries
2. Require explicit, auditable user consent for initial delegation
3. Support token revocation and short TTLs by default
4. Do **not** treat OAuth as sufficient alone—layer payment-specific caveats on tokens

---

## 2. UCAN (User Controlled Authorization Networks)

### Overview

[UCAN](https://ucan.xyz/) is a decentralized capability model using signed JWT chains. Users delegate by issuing tokens that embed their DID; delegates can further attenuate and re-delegate within bounds. Verification is offline-capable via signature chain validation.

### Relevant Patterns

- **Attenuation** — Each delegation step can only narrow, never expand, permissions
- **Chain of authority** — `iss` / `aud` / `att` fields encode delegation path
- **Invocation semantics** — Separate "invoke" from "delegate" capabilities
- **did:key / did:web identity** — Cryptographic agent and user identity

### Applicability to DPP

| Aspect | Assessment |
|--------|------------|
| Delegation chains | Strong fit for user → agent → sub-agent attenuation |
| Offline merchant verification | Merchants can verify token chain without calling issuer |
| Payment semantics | **Undefined** — UCAN is general-purpose |
| Revocation | Requires out-of-band revocation lists or short TTLs |

### Gaps

- No built-in replay protection beyond `exp` / `nbf`
- Payment rails (UPI, cards) have no UCAN integration
- Key rotation and recovery are operationally complex for end users

### DPP Takeaways

1. Use chained, attenuating capability tokens as the core delegation primitive
2. Encode delegation path in token for auditability
3. Define DPP-specific `att` (attenuation) fields: `maxAmount`, `currency`, `merchantId`, `validUntil`
4. Plan for revocation registry or online validation for high-value operations

---

## 3. Macaroons

### Overview

[Macaroons](https://research.google/pubs/pub41892/) are bearer credentials with embedded **caveats** (restrictions) enforced via HMAC chains. Third parties can add caveats without the issuer's private key, enabling decentralized attenuation.

### Relevant Patterns

- **Caveat language** — Predicates checked at verification (`merchant = X`, `amount < 100`)
- **Third-party caveats** — External services can mint additional restrictions
- **Partial delegation** — Delegate by adding caveats, not re-signing from root

### Applicability to DPP

| Aspect | Assessment |
|--------|------------|
| Embedded restrictions | Excellent model for payment bounds (amount, merchant, time) |
| Third-party verification | Merchants verify without issuer round-trip |
| Symmetric crypto | HMAC root keys are harder to distribute than asymmetric UCAN |
| Standardization | No IETF standard; caveat syntax is implementation-specific |

### Gaps

- Root key compromise affects all derived macaroons
- No standard identity binding for agents
- Caveat language must be defined by DPP

### DPP Takeaways

1. Treat payment constraints as **caveats** checked at verification time
2. Consider asymmetric macaroons or hybrid (signed JWT + caveat list) for public verifiability
3. Define a minimal DPP caveat vocabulary in v0.1 spec

---

## 4. SPIFFE / SPIRE (Workload Identity)

### Overview

[SPIFFE](https://spiffe.io/) provides cryptographic identity for workloads via SPIFFE IDs and SVIDs (typically X.509 or JWT). [SPIRE](https://spiffe.io/docs/latest/spire-about/) is the reference implementation for attestation and issuance.

### Relevant Patterns

- **Strong workload identity** — Agents/services prove who they are, not what they can do
- **Attestation** — Bind identity to platform evidence (K8s, AWS, etc.)
- **Federation** — Cross-trust-domain identity

### Applicability to DPP

| Aspect | Assessment |
|--------|------------|
| Agent identity | Strong fit for **who** the agent is |
| User delegation | **Out of scope** — SPIFFE doesn't model end-user grants |
| Payment authorization | **Not present** — identity ≠ permission |

### Gaps

- No user-to-agent delegation semantics
- No payment intent or merchant verification

### DPP Takeaways

1. DPP agent identity **may** reference SPIFFE IDs for service agents in enterprise deployments
2. Keep authorization (capabilities) separate from authentication (identity)
3. v0.1 should define `did:key` or JWT `sub` for agents; SPIFFE as optional profile

---

## 5. Comparative Analysis

### Delegation Model

```
User ──grants──▶ Capability Token ──presented──▶ Merchant / Payment Rail
                      │
                      ▼
                 Agent holds token
                 (never holds credentials)
```

| Property | OAuth 2.0 | UCAN | Macaroons | SPIFFE |
|----------|-----------|------|-----------|--------|
| User delegation | Yes (AS) | Yes (chain) | Yes (caveats) | No |
| Attenuation | Limited | Yes | Yes | N/A |
| Offline verify | Sometimes | Yes | Yes | Yes (identity only) |
| Payment-native | No | No | No | No |
| Revocation | Yes | Harder | Harder | Cert rotation |
| Agent identity | Weak | did:key | None | Strong |

### Security Properties Needed by DPP

| Property | Priority | Best reference |
|----------|----------|----------------|
| Least privilege | P0 | UCAN attenuation + Macaroon caveats |
| Non-replayability | P0 | Custom nonce + short TTL (all models need extension) |
| Merchant verification | P0 | **DPP-defined** |
| OTP / human escalation | P0 | **DPP-defined** (not in any surveyed standard) |
| Audit trail | P0 | OAuth logging + UCAN chain |
| Agent identity | P1 | SPIFFE + did:key hybrid |

---

## 6. Recommendations for DPP v0.1

### Adopt

1. **Capability tokens** (JWT, signed) as the primary delegation artifact—not raw OAuth bearer tokens alone
2. **Attenuation chains** (UCAN-inspired) from user grant → agent → optional sub-delegation
3. **Caveat vocabulary** (Macaroon-inspired) for `maxAmount`, `currency`, `merchantAllowlist`, `expiresAt`, `nonce`
4. **Scope strings** (OAuth-inspired) for developer ergonomics and documentation
5. **Separate identity and authorization** — agent identity (SPIFFE/did:key profile) distinct from payment capabilities

### Defer to v0.2+

- Full decentralized identity (user-managed DIDs)
- Cross-domain federation between issuers
- On-chain audit anchors

### Open Questions (for Protocol Engineer)

1. Symmetric (Macaroon) vs asymmetric (UCAN JWT) root signing for v0.1?
2. Online vs offline merchant verification as default?
3. Revocation: short TTL only, or mandatory revocation endpoint for high-value?
4. How to bind capability tokens to payment intents without double-spend?

---

## 7. Next Steps

| Action | Owner | Issue |
|--------|-------|-------|
| Draft capability token schema | Protocol Engineer | TBD |
| Threat model: token theft, scope escalation | Security Researcher | TBD |
| Architecture decision record: token format | CTO | TBD |
| OTP escalation flow spec | CTO | [verification-flows.md](./verification-flows.md) (AGE-4) |

---

## References

- [RFC 6749 — OAuth 2.0](https://datatracker.ietf.org/doc/html/rfc6749)
- [RFC 9449 — OAuth 2.0 DPoP](https://datatracker.ietf.org/doc/html/rfc9449)
- [UCAN Specification](https://ucan.xyz/spec/)
- [Macaroons paper (Google Research)](https://research.google/pubs/pub41892/)
- [SPIFFE Specification](https://github.com/spiffe/spiffe/blob/main/standards/SPIFFE.md)
- [FAPI 2.0 (financial-grade OAuth)](https://openid.net/specs/fapi-2_0-security-profile.html) — relevant for high-assurance financial APIs
