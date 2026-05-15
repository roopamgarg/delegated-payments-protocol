# Verification and Escalation Flows (DPP v0.1)

**Status:** Draft specification  
**Author:** CTO / DPP team  
**Last updated:** 2026-05-15  
**Related:** [ADR-001](../architecture/adr-001-capability-token-model.md), [research.md](./research.md)

This document specifies how DPP handles payment rails that require one-time passwords (OTP), strong customer authentication (SCA), or explicit user approval. It is normative for v0.1 implementers unless marked *informative*.

---

## 1. Scope

DPP separates **delegation** (what an agent may attempt) from **rail authentication** (what the payment network requires to settle). Many rails mandate human steps that cannot be replaced by a capability token. DPP **orchestrates** those steps; it does **not** provide shortcuts around them.

### 1.1 Terminology

| Term | Definition |
|------|------------|
| **Payment intent** | Structured, hashable request describing amount, currency, merchant, and rail metadata |
| **Capability token** | Signed JWT delegating bounded authority (see [ADR-001](../architecture/adr-001-capability-token-model.md)) |
| **Rail challenge** | OTP, SCA, biometric, or issuer approval required by the payment network |
| **Escalation** | Transition from agent-driven execution to user-driven completion on a trusted channel |
| **Pre-authorized band** | Delegation + rail rules that allow settlement without a per-payment user step |
| **Mandate** | Standing user authorization registered with issuer/wallet for recurring or bounded autopay |

### 1.2 Actors

- **User** — Account holder; sole party who can satisfy rail challenges
- **Agent** — AI or automated client holding a capability token
- **Wallet service** — User-trusted issuer of capabilities; bridges agent API and payment rails
- **Merchant** — Payee; verifies delegation before accepting funds
- **Payment rail** — Card network, UPI, bank transfer scheme, etc.

---

## 2. Design principles (normative)

1. **Agents MUST NOT receive, store, or transmit rail credentials** — UPI PIN, card CVV, 3DS passwords, or OTP codes are never agent-accessible.
2. **Capability tokens MUST NOT encode OTP bypass** — No claim, scope, or caveat may imply that presenting a token substitutes for a rail-mandated challenge.
3. **Escalation is a first-class state** — Implementations MUST model `pending_user_action` (and related states) explicitly; silent failure or indefinite retry is forbidden.
4. **Merchants verify delegation, not OTP** — Merchants validate capability + intent binding; OTP completion happens on user↔issuer channels outside the agent trust boundary.
5. **Fail closed** — If escalation is required and cannot complete within policy bounds, the intent MUST terminate as `failed` or `expired`, not as `succeeded`.
6. **Auditability** — Every escalation transition MUST be logged with intent ID, timestamp, actor, and outcome.

---

## 3. Rail authentication classes

Payment rails fall into classes that determine which DPP flow applies. Wallet services classify rails at integration time; agents receive the class via intent metadata.

| Class | Rail behavior | DPP flow |
|-------|---------------|----------|
| **A — Delegation-only** | Settlement when capability + intent verify and caveats pass | Pre-authorized (within band) |
| **B — Step-up per transaction** | OTP/SCA required for each payment (or above threshold) | Hybrid handoff |
| **C — Mandate-gated** | Recurring/bulk allowed only under registered mandate | Mandate flow |
| **D — Approval-gated** | Explicit user approve/deny per intent (push, email link) | Hybrid handoff or mandate + approval |

*Informative:* Most card-not-present and UPI P2M rails are class B or D; some wallet-internal balances may be class A within strict limits.

---

## 4. Escalation state machine

Every payment intent progresses through a finite state machine. Agents observe states via the wallet service API; they MUST NOT infer success from partial rail responses.

```
                    ┌──────────────┐
                    │   created    │
                    └──────┬───────┘
                           │ submit (agent + capability)
                           ▼
                    ┌──────────────┐
         ┌─────────│  validating  │─────────┐
         │         └──────┬───────┘         │
         │ invalid        │ valid           │ rail error
         ▼                ▼                 ▼
  ┌────────────┐   ┌──────────────┐   ┌────────────┐
  │  rejected  │   │   executing  │   │  failed    │
  └────────────┘   └──────┬───────┘   └────────────┘
                          │
            ┌─────────────┼─────────────┐
            │ no challenge  │ challenge   │
            ▼               ▼             │
     ┌────────────┐  ┌──────────────────┐ │
     │ succeeded  │  │ pending_user_    │ │
     └────────────┘  │     action       │ │
                     └────────┬─────────┘ │
                              │ user completes / denies / timeout
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
       ┌────────────┐   ┌────────────┐  ┌────────────┐
       │ succeeded  │   │  failed    │  │  expired   │
       └────────────┘   └────────────┘  └────────────┘
```

### 4.1 State definitions

| State | Meaning | Agent may |
|-------|---------|-----------|
| `created` | Intent drafted, not submitted | Amend (if policy allows), cancel |
| `validating` | Wallet verifying capability, caveats, merchant binding | Poll only |
| `rejected` | Delegation invalid or out of scope | None (terminal) |
| `executing` | Rail processing without user step | Poll only |
| `pending_user_action` | Rail challenge or approval required | Poll; MUST NOT claim success |
| `succeeded` | Funds committed or authorization captured | Read receipt |
| `failed` | Rail or user denied; no settlement | None (terminal) |
| `expired` | User action window elapsed | None (terminal) |

### 4.2 Timers (v0.1 defaults)

| Timer | Default | Owner |
|-------|---------|-------|
| `pending_user_action` TTL | 10 minutes (rail-specific override allowed) | Wallet service |
| Intent absolute TTL | 30 minutes from `created` | Wallet service |
| Agent poll backoff | Exponential, max 30s interval | Agent SDK |

When TTL elapses, wallet service MUST transition to `expired` and MUST NOT retry OTP on behalf of the user.

---

## 5. Flow patterns

### 5.1 Pre-authorized limits (class A)

**When:** Delegation caveats and rail rules align such that no per-payment user step is required—e.g., micro-payments under `amount.lte`, merchant on allowlist, sufficient mandate coverage.

**Sequence:**

1. Agent submits payment intent + capability token to wallet service.
2. Wallet validates token chain, caveats, and `intent.bind` hash.
3. Wallet submits to rail without user challenge.
4. Intent → `executing` → `succeeded` or `failed`.

**Normative rules:**

- Wallet service MUST NOT classify a rail as class A unless issuer/rail documentation explicitly permits unattended execution for the amount and instrument type.
- If the rail returns a step-up requirement mid-flight, wallet MUST transition to `pending_user_action` immediately (no automatic retry without escalation).

### 5.2 Hybrid handoff (class B and D)

**When:** Rail requires OTP, SCA, or per-transaction approval. The agent initiates; the user completes authentication on a **trusted user channel** controlled by the wallet or issuer app.

**Sequence:**

1. Agent submits intent + capability → `validating` → `executing`.
2. Rail responds with challenge required → wallet sets `pending_user_action` and returns an **escalation handle** to the agent (opaque ID, no secrets).
3. Wallet notifies user via push/SMS/deep link (*informative* channel choice is wallet-specific).
4. User completes OTP/SCA/approval in wallet UI (agent not in the loop).
5. Wallet resumes rail call → `succeeded`, `failed`, or `expired`.

**Escalation handle (v0.1 shape):**

```json
{
  "escalationId": "esc_01HXYZ",
  "intentId": "pi_01HABC",
  "status": "pending_user_action",
  "requiredAction": "otp",
  "userChannel": "wallet_app",
  "expiresAt": "2026-05-15T12:10:00Z",
  "resumeHint": "poll_intent"
}
```

**Normative rules:**

- Agent MUST treat `escalationId` as read-only correlation; it grants no authority.
- Agent MUST NOT accept OTP or approval payloads from the user via chat, email, or agent UI—only the wallet user channel may satisfy the challenge.
- Wallet MUST bind escalation completion to the same `intentId` and `jti` (capability token ID) as the original submission.
- If user denies or rail fails, agent receives `failed` with `reasonCode` (see §7).

### 5.3 Mandate flows (class C)

**When:** User has pre-registered a standing authorization (e.g., SEPA direct debit mandate, UPI autopay, card-on-file with issuer recurring flag) covering the agent or wallet service.

**Mandate object (v0.1 outline):**

```json
{
  "mandateId": "mdt_01HDEF",
  "userId": "usr_...",
  "rail": "upi_autopay",
  "maxAmountPerDebit": { "value": "5000", "currency": "INR" },
  "frequency": "as_presented",
  "merchantScope": ["merch_abc"],
  "validFrom": "2026-05-01T00:00:00Z",
  "validUntil": "2027-05-01T00:00:00Z",
  "revokedAt": null
}
```

**Sequence:**

1. User establishes mandate via wallet (out of band from agent); mandate ID stored with delegation profile.
2. Agent submits intent referencing `mandateId` + capability whose caveats are ⊆ mandate bounds.
3. Wallet verifies mandate active, amount within per-debit and aggregate limits, merchant in scope.
4. If rail still requires step-up (e.g., first debit, amount spike), fall through to **hybrid handoff** (§5.2).
5. Otherwise → `executing` → terminal state.

**Normative rules:**

- Mandates MUST be revocable by the user instantly; wallet MUST reject new intents on revoked mandates.
- Capability token alone is insufficient without a valid `mandateId` when rail class is C.
- Agents MUST NOT create or amend mandates; only users via wallet UI.

---

## 6. Capability token interaction

Escalation flows consume [ADR-001](../architecture/adr-001-capability-token-model.md) capability tokens but do not replace rail challenges.

| Check | Where enforced |
|-------|----------------|
| Signature valid, not expired | Wallet + merchant |
| Caveats ⊆ payment intent | Wallet |
| `intent.bind` matches intent hash | Wallet + merchant |
| Token does not assert `otp.waived` or equivalent | Wallet (reject token if present) |
| Delegation allows `pay` scope for merchant/amount | Wallet |

**Forbidden claims (v0.1):** Implementations MUST reject tokens containing any of:

- `dpp:otpBypass`, `dpp:scaSatisfied`, `dpp:userPresentProof` (unless defined in a future spec with hardware attestation—out of scope for v0.1)

Merchants verify delegation **before** presenting pay UI; they do not verify OTP. Merchant SDK returns:

- `delegation_valid` — proceed to rail checkout
- `delegation_invalid` — reject before rail
- `delegation_pending` — *informative* rare case when online revocation check is async

---

## 7. Merchant behavior (normative)

| Rule | Requirement |
|------|-------------|
| M1 | Verify capability token + payment intent binding before initiating rail payment |
| M2 | MUST NOT request OTP, PIN, or card secrets from the agent or agent channel |
| M3 | MUST NOT treat agent-supplied “approval” text as rail authorization |
| M4 | On `pending_user_action`, display user-facing copy directing them to their wallet/issuer app |
| M5 | Poll wallet/merchant API for intent status; MUST NOT mark order paid until `succeeded` |
| M6 | Include `intentId` in settlement metadata for chargeback and audit correlation |

*Informative:* Merchant UX may show “Complete payment in your bank app” with a deep link provided by the wallet, not the agent.

### 7.1 Reason codes (terminal failures)

| Code | Meaning | Agent action |
|------|---------|--------------|
| `delegation_exceeded` | Amount/merchant outside caveats | Do not retry without new token |
| `user_denied` | User rejected escalation | Terminal; inform user |
| `otp_expired` | Challenge window elapsed | May create new intent if policy allows |
| `rail_declined` | Issuer/network decline | Terminal or retry per rail rules |
| `mandate_revoked` | Standing auth no longer valid | Request user re-authorize mandate |
| `intent_expired` | Absolute TTL exceeded | Create new intent |

---

## 8. Agent and wallet responsibilities

### 8.1 Agent MUST

- Stop execution when status is `pending_user_action`; surface escalation UX that points user to wallet
- Poll intent status via wallet API only
- Respect `expired` and `failed` as terminal
- Log escalation correlation IDs for audit

### 8.2 Agent MUST NOT

- Prompt user for OTP, PIN, CVV, or passwords in agent chat/UI
- Retry rail submission while `pending_user_action`
- Mark transactions complete without `succeeded`
- Request broader scopes to avoid escalation

### 8.3 Wallet service MUST

- Own all rail credential and OTP interactions
- Enforce state machine transitions atomically
- Revoke or shorten capability TTL when repeated escalation failures occur (*informative* fraud heuristic)
- Expose idempotent intent submission keyed by agent-provided `idempotencyKey`

---

## 9. Security considerations

| Threat | Mitigation |
|--------|------------|
| Agent tricks user into pasting OTP | OTP only accepted on wallet channel; spec forbids agent collection (§8.2) |
| Token theft + replay | Short TTL, `intent.bind`, `jti` tracking; optional online revocation for high value |
| Merchant skips delegation check | M1; merchant SDK test vectors in follow-up work |
| Fake `succeeded` from agent | Merchants confirm via wallet status API, not agent assertions |
| Scope escalation to avoid OTP | Caveats cannot expand; wallet re-validates on every intent |
| Mandate abuse | Per-debit caps, merchant scope, user revocation |

*Follow-up:* Formal threat-model entries for escalation bypass → Security Researcher (post-hire).

---

## 10. v0.1 API sketch (*informative*)

Wallet service endpoints expected by SDK work (OpenAPI to follow in specs):

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/intents` | Create and submit intent with capability |
| `GET` | `/v1/intents/{intentId}` | Poll status + escalation handle |
| `POST` | `/v1/intents/{intentId}/cancel` | Agent-cancel before settlement |
| `GET` | `/v1/mandates/{mandateId}` | Read mandate status (agent read-only) |

User-only (agent forbidden):

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/v1/escalations/{escalationId}/complete` | Satisfy OTP/approval |
| `POST` | `/v1/mandates` | Create/revoke mandate |

---

## 11. Acceptance mapping

| Criterion | Section |
|-----------|---------|
| Agents cannot bypass OTP by design | §2, §5.2, §6, §8.2 |
| Escalation states defined | §4 |
| Merchant behavior defined | §7 |
| Pre-authorized limits | §5.1 |
| Hybrid handoff | §5.2 |
| Mandate flows | §5.3 |

---

## 12. Open questions (v0.2+)

1. Hardware-bound `userPresentProof` for lowering escalation friction on supported devices
2. Cross-device escalation (agent on desktop, OTP on phone) — deep-link standardization
3. Federated wallet issuers and mandate portability
4. JSON Schemas for `PaymentIntent`, `Escalation`, and `Mandate` objects — `PaymentIntent` and `Mandate` shipped in v0.1 (`specs/schemas/`); `Escalation` handle remains documented in this file until formalized

---

## References

- [ADR-001: Capability Token Model](../architecture/adr-001-capability-token-model.md)
- [PSD2 SCA regulatory technical standards](https://eur-lex.europa.eu/) — *informative* for class B rails in EU
- [EMV 3-D Secure](https://www.emvco.com/) — *informative* for card step-up
