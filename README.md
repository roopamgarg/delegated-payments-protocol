# Delegated Payments Protocol (DPP)

**The open standard for delegated AI financial actions.**

DPP enables AI agents to perform financial transactions on behalf of users while preserving user control, merchant trust, and full auditability. Version 0.1 is under active development.

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

## Status

| Component | Status |
|-----------|--------|
| Protocol research | In progress — see [docs/protocol/research.md](docs/protocol/research.md) |
| v0.1 specification | Planned |
| JSON schemas | Planned |
| Merchant SDK | Planned |

## Contributing

We welcome contributions. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. All changes go through feature branches and PR review; `main` is protected.

## Security

Report vulnerabilities per [SECURITY.md](SECURITY.md). **Never** commit secrets, API keys, private keys, `.env` files, or PII to this repository.

## License

Apache License 2.0 — see [LICENSE](LICENSE).
