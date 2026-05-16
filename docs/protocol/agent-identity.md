# Agent Identity (DPP v0.1)

**Status:** Draft specification  
**Last updated:** 2026-05-15  
**Related:** [ADR-001](../architecture/adr-001-capability-token-model.md), [capability token schema](../../specs/schemas/capability-token.schema.json), [payment intents](./payment-intents.md)

This document defines how **agents**—automated clients acting on behalf of users—establish **cryptographic identity** for DPP. Identity answers *who* may hold a capability; authorization remains in the capability token ([ADR-001](../architecture/adr-001-capability-token-model.md)).

---

## 1. Goals

1. **Verifiable** — Relying parties (wallet services, merchants) can validate authenticity and integrity of agent-signed material without shared secrets.
2. **Interoperable** — Prefer widely deployed formats (`did:key`, SPIFFE, JWT `sub`) over bespoke IDs.
3. **Least exposure** — Agent keys prove workload identity; they MUST NOT substitute for user payment credentials (UPI PIN, card secrets).
4. **v0.1 feasible** — Mandatory profiles are narrow; optional profiles allow ecosystem growth.

---

## 2. Terminology

| Term | Definition |
|------|-------------|
| **Agent** | Software acting on user-delegated payment tasks; holder of capability tokens |
| **Agent identifier** | Stable string carried in capability `sub` and audit logs |
| **Verification key** | Public key used to verify signatures attributed to the agent |
| **Wallet service** | User-trusted issuer of capabilities; may also register agent keys |

---

## 3. Identifier profiles (normative)

Implementations MUST support **at least one** of the following for `sub` in capability tokens. Wallet services SHOULD document which profiles they issue.

### 3.1 `did:key` (recommended default)

- **Syntax:** `did:key:` multi-base encoded public key per [did:key](https://w3c-ccg.github.io/did-method-key/).
- **Signing:** Agents SHOULD use the private key material corresponding to the `did:key` when the wallet or protocol requires agent signatures (e.g., future request signing).
- **Verification:** Resolvers derive the verification key from the DID; no registry required for basic validation.

### 3.2 SPIFFE ID + JWT-SVID (infrastructure workloads)

- **Identifier syntax:** `spiffe://<trust_domain>/<path>` per [SPIFFE](https://spiffe.io/).
- **Binding:** In regulated environments, the agent process presents an X.509-SVID or JWT-SVID; the **string in `sub`** SHOULD match the SPIFFE ID asserted in the SVID.
- **Verification:** Merchants or wallet connectors validate SVIDs via trust bundle distribution (out of scope for merchant-only verification paths).

### 3.3 HTTPS URI (hosted agent registration)

- **Syntax:** `https://<authority>/.well-known/dpp/agent/<opaque-id>` or organization-defined stable HTTPS URL under the wallet’s domain.
- **Requirements:** MUST be HTTPS. MUST serve a **JWKS** or **JSON document** documenting the agent’s current verification keys (see §4).
- **Use when:** SaaS agents registered centrally; humans audit via stable org URLs.

**Interoperability note:** Capability token JSON Schema [`sub`](../../specs/schemas/capability-token.schema.json) allows any non-empty string; this document narrows **interoperable** choices to the profiles above.

---

## 4. Key formats and algorithms (normative)

### 4.1 Approved asymmetric algorithms

| Algorithm | JWT `alg` | Curve / parameters | Notes |
|-----------|-----------|--------------------|-------|
| Ed25519 | `EdDSA` | Ed25519 | Preferred for new agents; compact keys |
| ECDSA P-256 | `ES256` | NIST P-256 | Required where FIPS or HSM constraints apply |

Implementations MUST NOT use RSA-PKCS1 for new agent keys in v0.1. Agents MUST NOT use symmetric keys as *public* verification material.

### 4.2 Public key encodings

- **JWK** ([RFC 7517](https://datatracker.ietf.org/doc/html/rfc7517)) — REQUIRED for JWKS discovery documents.
- ** PKIX SPKI DER ** — Optional for mTLS or legacy integrations; conversion to JWK is recommended at boundaries.

### 4.3 Key discovery

For `did:key`, discovery is implicit. For HTTPS URIs, wallets MUST publish rotation-capable key sets:

- `GET` agent document or JWKS MUST return `200` with `Cache-Control` appropriate for rotation frequency.
- Multiple keys MAY be active; verifiers MUST accept any key marked `use: sig` until `exp` or explicit revocation.

---

## 5. Capability token binding

- **`iss`** — Delegation issuer (wallet or delegate); not necessarily the agent.
- **`sub`** — **Agent identifier** per §3; MUST be stable for the delegation lifetime.
- **`aud`** — Optional list of intended verifiers (merchants, rails).

Wallet services MUST ensure **`sub` refers to an agent principal they intend to authorize**. Delegation depth and attenuation follow [ADR-001](../architecture/adr-001-capability-token-model.md).

---

## 6. Rotation and revocation

| Event | Requirement |
|-------|-------------|
| Key rotation | Agents MAY publish overlapping keys; wallet SHOULD shorten capability TTL during rotation windows |
| Compromise | Wallet MUST revoke outstanding capabilities for affected agents; merchants SHOULD honor revocation registries when configured |
| Identifier change | New `sub` implies new agent identity; capabilities MUST be re-issued |

*v0.1 informative:* Online revocation endpoints and CRL-style artifacts are implementation-defined.

---

## 7. Security considerations

| Threat | Mitigation |
|--------|------------|
| Impersonation via forged `sub` | Capability signature validates only if issuer authorized that `sub`; merchants verify issuer trust |
| Long-lived stolen agent key | Short capability TTL, rotation, optional DPoP-style proof-of-possession (v0.2+) |
| Confusion between user and agent | Never use agent keys to satisfy OTP or enter PIN; rail challenges stay user/wallet-local ([verification-flows](./verification-flows.md)) |

---

## 8. References

- [ADR-001: Capability Token Model](../architecture/adr-001-capability-token-model.md)
- [W3C DID Core](https://www.w3.org/TR/did-core/) — *informative*
- [SPIFFE](https://spiffe.io/docs/latest/spiffe-about/spiffe-concepts/) — *informative*
