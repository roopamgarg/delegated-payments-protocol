# Contributing to DPP

Thank you for helping build the Delegated Payments Protocol. This project is open source and community-driven.

## Workflow

1. **Fork or branch** — Create a feature branch from `main`:
   ```
   git checkout -b feature/ISSUE-ID-short-description
   ```
2. **Make changes** — Keep commits focused. Follow existing structure and naming.
3. **Open a PR** — Target `main`. Fill out the PR template. Link related issues.
4. **Review** — At least one maintainer review is required before merge (enforced by branch protection on `main`).
5. **Merge** — **Human maintainers only**, using the GitHub **web UI** (Merge / Squash / Rebase button). Automation, bots, and agent sessions must **not** merge pull requests (no `gh pr merge`, no API merge from agent credentials).

### Why human UI merges

GitHub does not expose a “UI-only” merge flag. Policy is: agents and automation open PRs and leave them for a maintainer to merge in the browser. Prefer **fine-grained personal access tokens** for automation with **Contents: Read** and **Pull requests: Read/Write** as needed, but **without** merge ability where possible; never store maintainer merge tokens in agent environments.

## Branch Naming

| Prefix | Use |
|--------|-----|
| `feature/` | New protocol features, schemas, SDK code |
| `docs/` | Documentation-only changes |
| `fix/` | Bug fixes and corrections |

## What We Accept

- Protocol specifications and JSON schemas
- Architecture decision records
- Threat model updates
- SDK implementations and examples
- Documentation and integration guides

## What We Do Not Accept

- Secrets, API keys, credentials, or private keys
- `.env` files or real user/merchant data
- Changes that bypass OTP or human approval requirements
- Unreviewed direct pushes to `main`

## Code and Doc Style

- Use clear, descriptive names
- Prefer small, reviewable PRs
- Document non-obvious security assumptions
- Use placeholder values in examples (`YOUR_MERCHANT_ID`, not real IDs)

## Questions

Open a GitHub issue for design questions. For security concerns, see [SECURITY.md](SECURITY.md).
