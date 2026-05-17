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

## Stacked pull requests (dependent work)

When a Paperclip issue is **blocked by** another issue (or logically depends on unmerged code), do **not** open a second PR directly to `main` that re-implements the same foundation.

1. **Branch from the blocker** — e.g. `git checkout -b feature/AGE-36-… feature/AGE-38-…` after the scaffold PR exists.
2. **Open a stacked PR** — set the PR **base** to the blocker branch (not `main`) until the blocker merges.
3. **Retarget after merge** — when the base PR merges to `main`, rebase your branch on `origin/main`, change the PR base to `main`, and force-push with lease:

   ```bash
   gh pr edit <pr-number> --base main
   git fetch origin main
   git rebase origin/main
   git push --force-with-lease
   ```

4. **One concern per PR** — the diff against the effective base should contain only commits for that issue (no duplicate scaffold or doc commits already on `main`).

**Wallet SDK merge train (example):** scaffold → parallel SDK slices (OAuth, capability, intent FSM) → demos/MVP stacked on capability → KMS (#AGE-50) stacked on capability, not `main`.

Agent sessions with non-empty `blockedByIssueIds` must stack on the blocker branch instead of targeting `main`.

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
