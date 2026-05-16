# DPP release and spec-of-record policy

This document defines how **Delegated Payments Protocol (DPP) v0.1** is pinned as the spec of record in this repository.

## Version tags

| Tag | Commit role | When to use |
|-----|-------------|-------------|
| `v0.1.0-spec` | **Spec of record** for DPP v0.1 | Implementers, auditors, and integrators SHOULD treat this tag as the canonical v0.1 snapshot unless a later errata tag is published. |

**Naming convention (v0.1 line):**

- `v0.1.N-spec` — normative spec snapshots (schemas + protocol docs listed below).
- Future implementation/SDK semver tags (e.g. `merchant-sdk-v0.1.0`) may be added separately; they do not replace `v0.1.N-spec` for protocol conformance.

**Errata:** Security or normative corrections that do not bump the protocol minor version may use patch-style spec tags (e.g. `v0.1.1-spec`) with a GitHub Release note describing the delta. Agents and automation must not move or delete published spec tags.

## GitHub Releases vs tags only

Each `v*-spec` tag SHOULD have a matching **GitHub Release** whose notes restate:

1. The tag name and commit SHA.
2. The canonical artifact list (below).
3. Known draft vs normative status per component.

If a release is not created, the tag plus this file still define the policy (**tag-only mode**).

## Canonical artifacts at `v0.1.0-spec`

The following paths at tag `v0.1.0-spec` are **normative or contractually binding** for v0.1:

### JSON Schemas (normative)

| Artifact | Path |
|----------|------|
| Capability token | `specs/schemas/capability-token.schema.json` |
| Payment intent | `specs/schemas/payment-intent.schema.json` |
| Mandate | `specs/schemas/mandate.schema.json` |

Schema `$id` URIs under `https://delegated-payments-protocol.dev/schemas/v0.1/` refer to these files at the spec tag.

### Protocol specifications (normative unless marked draft in-file)

| Topic | Path |
|-------|------|
| Agent identity | `docs/protocol/agent-identity.md` |
| Payment intents | `docs/protocol/payment-intents.md` |
| Verification & escalation | `docs/protocol/verification-flows.md` |

### Informative (non-normative but shipped in v0.1 bundle)

| Topic | Path |
|-------|------|
| Research survey | `docs/protocol/research.md` |
| UPI integration guide | `docs/integration-guides/upi.md` |
| Merchant SDK integration guide | `docs/integration-guides/merchant-sdk.md` |
| Threat model (draft) | `docs/threat-model/v0.1.md` |
| ADR-001 capability model | `docs/architecture/adr-001-capability-token-model.md` |

### API sketch (informative)

| Artifact | Path |
|----------|------|
| Merchant verification OpenAPI | `specs/openapi/merchant-verification.yaml` |

### SDK contract (v0.1 TypeScript surface)

| Artifact | Path |
|----------|------|
| Merchant SDK package + README | `sdk/merchant-sdk/` |
| Reference Stripe-shaped example | `sdk/examples/stripe-delegated-payment/` |
| Express merchant example | `sdk/examples/express-merchant/` |

Implementers MAY copy schemas and docs from the tagged tree; they MUST NOT treat `main` after the tag as automatically normative until a new spec tag is published.

## What is out of scope for spec tags

- CI workflows, issue templates, and contributor docs (unless explicitly listed above).
- Unreleased work on `main` after the tag.
- Runtime secrets, test keys, or environment configuration (never part of a release).

## Publishing checklist (maintainers)

1. Ensure v0.1 deliverables are merged to `main` (see [AGE-8](https://github.com/roopamgarg/delegated-payments-protocol/issues) / PR #7).
2. Create annotated tag `v0.1.0-spec` on the chosen commit.
3. Publish GitHub Release with notes linking this file and the artifact table.
4. Update root `README.md` status table if component maturity changed.

Human maintainers create tags and releases; agents prepare branches and release notes only.
