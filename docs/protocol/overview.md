# Protocol Overview

> **Status:** v0.1 specification in progress.

The Delegated Payments Protocol (DPP) defines how users delegate bounded payment authority to AI agents and how merchants verify that authority.

## Core Concepts

- **Agent identity** — Cryptographic identity for agents acting on behalf of users
- **Wallet linking** — OAuth 2.0 / OIDC profile for user consent and agent platform sessions ([wallet-oauth-linking.md](./wallet-oauth-linking.md))
- **Capability tokens** — Attenuating, scoped delegation artifacts ([ADR-001](../architecture/adr-001-capability-token-model.md))
- **Payment intents** — Structured requests for financial actions
- **Verification flows** — How merchants and payment rails validate delegation ([verification-flows.md](./verification-flows.md))
- **Approval escalation** — Human-in-the-loop when OTP or explicit consent is required ([verification-flows.md](./verification-flows.md))

## Documents

| Document | Status |
|----------|--------|
| [research.md](./research.md) | Draft — standards survey |
| [agent-identity.md](./agent-identity.md) | Draft — cryptographic agent identity |
| [wallet-oauth-linking.md](./wallet-oauth-linking.md) | Draft — wallet↔agent OAuth/OIDC linking |
| [payment-intents.md](./payment-intents.md) | Draft — payment intent + digest rules |
| [verification-flows.md](./verification-flows.md) | Draft — OTP and escalation |
| [ADR-001](../architecture/adr-001-capability-token-model.md) | Accepted (draft) — token model |
