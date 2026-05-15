# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x (draft) | Yes |

## Reporting a Vulnerability

**Do not** open a public GitHub issue for security vulnerabilities.

Report security issues privately by opening a GitHub Security Advisory on this repository, or contact the maintainers through your organization's security channel.

We aim to acknowledge reports within 48 hours and provide an initial assessment within 7 days.

## Scope

This policy covers:

- Protocol design flaws (delegation bypass, scope escalation, replay attacks)
- Schema or SDK implementations in this repository
- Documentation that could lead to unsafe integrations

Out of scope: vulnerabilities in third-party payment processors, user devices, or deployments not maintained in this repo.

## Secure Development Requirements

Contributors **must not** commit:

- API keys, secrets, tokens, or passwords
- Private keys or certificates
- `.env` files or database credentials
- PII or real transaction data

Use environment variables and placeholders in examples.

## Design Security Principles

DPP is designed with these non-negotiable constraints:

1. Agents must not receive or store raw payment credentials
2. OTP and human-in-the-loop steps must not be bypassed by the protocol
3. Capability tokens must be scoped, time-bound, and non-replayable
4. Merchants must be able to verify delegation independently

Proposals that violate these principles will be rejected regardless of convenience.

## Disclosure

We follow coordinated disclosure. We will credit reporters who wish to be acknowledged, unless they prefer anonymity.
