# Delegated Payments Protocol (DPP)

**The open standard for delegated AI financial actions.**

DPP enables AI agents to perform financial transactions on behalf of users while preserving user control, merchant trust, and full auditability. **DPP v0.1 spec of record:** tag [`v0.1.0-spec`](https://github.com/roopamgarg/delegated-payments-protocol/releases/tag/v0.1.0-spec) — see [docs/RELEASE.md](docs/RELEASE.md) for canonical artifacts and release policy.

## Mission

Make it safe and practical for users to delegate bounded payment authority to AI agents—without exposing raw credentials, bypassing human-in-the-loop controls (OTP, escalation), or sacrificing merchant verification.

## Core Principles

1. **Agents never access raw credentials** — Delegation uses capability tokens and scoped permissions, not stored card numbers, UPI PINs, or API secrets.
2. **Security by default** — Least privilege, explicit scopes, replay protection, and cryptographic identity are baseline requirements, not optional add-ons.
3. **Graceful degradation** — When a payment rail requires OTP or user approval, agents pause and escalate; DPP orchestrates around human steps rather than bypassing them.
4. **Merchant verifiability** — Merchants can independently verify that an agent is authorized for a specific payment intent before accepting funds.
5. **Auditability** — Every delegated action produces a traceable, attributable record for users, merchants, and regulators.
6. **Open ecosystem** — DPP is an open standard with reference schemas and SDKs; no proprietary lock-in.

## Repository Structure

```
delegated-payments-protocol/
├── README.md                 # This file
├── LICENSE                   # Apache 2.0
├── CONTRIBUTING.md           # How to contribute
├── SECURITY.md               # Security policy
├── docs/
│   ├── protocol/             # Protocol specs and research
│   ├── architecture/         # Architecture diagrams and decisions
│   ├── threat-model/         # Security analysis
│   └── integration-guides/   # Developer guides
├── specs/
│   ├── schemas/              # JSON schemas
│   └── openapi/              # API definitions
├── sdk/
│   ├── merchant-sdk/         # Merchant verification SDK
│   └── examples/             # Integration examples
└── .github/                  # CI, issue and PR templates
```

## Spec of record

| Item | Location |
|------|----------|
| v0.1 tag | [`v0.1.0-spec`](https://github.com/roopamgarg/delegated-payments-protocol/releases/tag/v0.1.0-spec) |
| Release policy | [docs/RELEASE.md](docs/RELEASE.md) |

## Status

| Component | Status |
|-----------|--------|
| Protocol research | Draft — [docs/protocol/research.md](docs/protocol/research.md) |
| Capability token schema | v0.1 — [specs/schemas/capability-token.schema.json](specs/schemas/capability-token.schema.json) |
| Payment intent + mandate schemas | v0.1 — [specs/schemas/payment-intent.schema.json](specs/schemas/payment-intent.schema.json), [specs/schemas/mandate.schema.json](specs/schemas/mandate.schema.json) |
| Agent identity + payment intent specs | Draft — [docs/protocol/agent-identity.md](docs/protocol/agent-identity.md), [docs/protocol/payment-intents.md](docs/protocol/payment-intents.md) |
| Verification & escalation | Draft — [docs/protocol/verification-flows.md](docs/protocol/verification-flows.md) |
| Threat model | Draft — [docs/threat-model/v0.1.md](docs/threat-model/v0.1.md) |
| UPI integration guide | Draft — [docs/integration-guides/upi.md](docs/integration-guides/upi.md) |
| Merchant SDK (TypeScript) | v0.1 contract — [sdk/merchant-sdk/](sdk/merchant-sdk/) |
| Reference Stripe example | [sdk/examples/stripe-delegated-payment/](sdk/examples/stripe-delegated-payment/) |

## Contributing

We welcome contributions. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. All changes go through feature branches and PR review; `main` is protected.

## Security

Report vulnerabilities per [SECURITY.md](SECURITY.md). **Never** commit secrets, API keys, private keys, `.env` files, or PII to this repository.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
