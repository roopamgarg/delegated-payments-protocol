# UPI Integration Guide (DPP v0.1)

**Status:** Draft (informative)  
**Last updated:** 2026-05-15  
**Audience:** Wallet engineers, Indian market integrators  
**Related:** [verification-flows.md](../protocol/verification-flows.md), [payment-intents.md](../protocol/payment-intents.md), [mandate schema](../../specs/schemas/mandate.schema.json)

This guide maps India’s **Unified Payments Interface (UPI)** patterns to DPP constructs. NPCI continually evolves product rules—validate against issuer and NPCI documentation before production certification.

---

## 1. Scope

DPP does not replace NPCI messaging. Wallets **translate** between:

- DPP **capability tokens** + **payment intents** (agent-facing), and  
- UPI collect mandates, payer PSP APIs, and autopay constructs (rail-facing).

Agents never handle UPI PIN, OTP, or PSP keys.

---

## 2. UPI flows vs DPP rail classes

| UPI pattern | Typical DPP `railClass` | Notes |
|-------------|-------------------------|-------|
| One-time merchant pay (intent + QR / collect) | `B` or `D` | OTP or device bind step common on first use or risk triggers |
| Recurring / autopay registration | `C` | Map to **mandate** lifecycle |
| Small-value pre-approved wallet rules | `A` | Rare on UPI; only if issuer policy truly allows unattended debit |

`rail` on the payment intent SHOULD be `upi` for these integrations.

---

## 3. Mandate mapping (autopay)

Register autopay or recurring consent in the **wallet UI** (user-facing). Persist as DPP **mandate** object:

| DPP field | UPI-oriented usage |
|-----------|-------------------|
| `mandateId` | Wallet-issued stable ID; may mirror NPCI mandate reference stored PSP-side |
| `rail` | `upi_autopay` |
| `maxAmountPerDebit` | Per-collection cap agreed with user |
| `frequency` | `as_presented`, `monthly`, etc., per product |
| `merchantScope` | `merchant:` IDs the mandate covers |
| `status` | `active` only while NPCI/PSP state is authorized |

**Normative security alignment:** Follow [verification-flows §5.3](../protocol/verification-flows.md)—agents MUST NOT create mandates; users revoke via wallet; revoked mandates reject new intents.

---

## 4. Verification sequence (merchant + wallet)

1. **Agent** constructs `PaymentIntent` with `rail=upi`, correct `railClass`, optional `mandateId` for autopay pulls.
2. **Wallet** validates capability + digest + mandate bounds (if class `C`).
3. **Wallet** calls PSP/UPI rails; on OTP or device-binding challenge → transition intent to `pending_user_action` per [verification-flows §5.2](../protocol/verification-flows.md).
4. **User** completes challenge in bank or wallet app (never via agent chat).
5. **Merchant** polls wallet status; fulfills order only on `succeeded`.

Merchant-side checks reuse the shared **merchant SDK** contract (`sdk/merchant-sdk/`) for delegation validation before PSP handoff.

---

## 5. OTP and compliance

- Treat OTP SMS, UPI PIN prompts, and issuer decline reasons as **rail challenges**—never surface through the agent.
- Display copy for end users SHOULD direct them to **bank-approved surfaces** ("Approve in your UPI app", not "Send OTP to agent").
- Store only minimal correlation tokens in `metadata` (e.g., NPCI transaction ref once available from wallet callbacks); avoid PII.

---

## 6. Testing checklist

- [ ] OTP-required transaction escalates to `pending_user_action` with TTL  
- [ ] Mandate revoked mid-series rejects new intents with `mandate_revoked`  
- [ ] Amount above mandate cap rejected before PSP call  
- [ ] Merchant verifies capability + intent binding prior to pay UI  

---

## 7. References (external, informative)

- NPCI UPI product documentation and participant specifications  
- RBI digital payment security guidance
