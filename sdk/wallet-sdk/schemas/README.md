# Normative JSON schemas (bundled reference)

Canonical schemas live in [`specs/schemas/`](../../../specs/schemas/). Wallet SDK validators resolve from this directory when published, or from `specs/schemas/` in the monorepo.

| Schema | Path |
|--------|------|
| Capability token | `capability-token.schema.json` |
| Payment intent | `payment-intent.schema.json` |
| Mandate | `mandate.schema.json` |

Copy or symlink from `specs/schemas/` before npm publish (same pattern as `dpp-merchant-sdk`).
