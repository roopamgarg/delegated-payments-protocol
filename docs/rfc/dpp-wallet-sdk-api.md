# DPP Wallet SDK API RFC (dpp-wallet-sdk v0.1)

**Status:** Draft RFC (Phase 0)  
**Last updated:** 2026-05-17  
**Issue:** AGE-35  
**Package:** `sdk/wallet-sdk` → npm `dpp-wallet-sdk`  
**Audience:** Wallet backend engineers, SDK implementers, Security Researcher review  
**Symmetric SDK:** [`dpp-merchant-sdk`](../../sdk/merchant-sdk/) (verify + charge)

This document is the **normative API contract** for the wallet issuer SDK. It mirrors merchant SDK ergonomics (TypeScript, ESM, `DPPError`, AJV against `specs/schemas/*`) while keeping issuer-only concerns (signing, OAuth, intent orchestration) separate from PSP charge logic.

---

## 1. Goals and non-goals

### 1.1 Goals

| Goal | How |
|------|-----|
| Issue capability JWS verifiable by `dpp-merchant-sdk` | `issueCapability` + JWKS |
| Orchestrate payment intent lifecycle | Intent FSM per [verification-flows.md](../protocol/verification-flows.md) §4 |
| Link agents via OAuth 2.0 + PKCE | Helpers aligned with [wallet-oauth-linking.md](../protocol/wallet-oauth-linking.md) |
| Fail closed on revocation | `revokeDelegation`, `revokeAgent` |
| Developer ergonomics | `createWalletIssuer(config)` factory, typed errors |

### 1.2 Non-goals (v0.1 scaffold)

- Consumer mobile UI
- PSP/NPCI rail adapters inside the SDK (wallet service integrates rails; SDK exposes hooks)
- MCP agent tool (separate package)
- npm publish (until alpha implementation + security review)

---

## 2. Package layout

```
sdk/wallet-sdk/
├── src/
│   ├── issuer.ts           # DPPWalletIssuer, createWalletIssuer
│   ├── capability.ts       # issueCapability
│   ├── intent.ts           # intent FSM + computeIntentDigest
│   ├── oauth.ts            # OAuth helpers
│   ├── agent-registry.ts   # registerAgent, revokeAgent
│   ├── crypto/jwks.ts      # exportJwks, rotateKeys
│   ├── constants.ts
│   ├── errors.ts
│   └── types.ts
├── schemas/                # bundled copies of specs/schemas (publish)
└── tests/
```

**Shared monorepo artifacts (not duplicated in SDK logic):**

- `specs/schemas/capability-token.schema.json`
- `specs/schemas/payment-intent.schema.json`
- `specs/schemas/mandate.schema.json`

Future `sdk/shared/` MAY extract digest canonicalization and decimal helpers used by both SDKs.

---

## 3. Configuration

### 3.1 `createWalletIssuer(config)`

```typescript
type DPPWalletIssuerConfig = {
  issuer: string;                    // HTTPS issuer URL (JWT iss)
  signingKey: SigningKeyMaterial;
  defaultCapabilityTtlSeconds?: number;  // default 600
  oauth?: {
    authorizationServerMetadataUrl?: string;
    clientRegistration?: 'static' | 'dynamic';
  };
};

type SigningKeyMaterial =
  | { type: 'local'; privateJwk: JsonWebKey; kid: string }
  | { type: 'kms'; keyId: string; kid: string; publicJwk: JsonWebKey };

type KeyRotationConfig = {
  retentionSeconds?: number;  // default 86400
};
```

| Field | Requirement |
|-------|-------------|
| `issuer` | MUST be `https://` origin; used as JWT `iss` and OAuth AS issuer |
| `signingKey` | Production MUST use KMS/HSM; local JWK for dev/test only |
| `defaultCapabilityTtlSeconds` | SHOULD be ≤ 900; MUST NOT exceed wallet policy max |

**Validation (scaffold):** `createWalletIssuer` rejects non-HTTPS `issuer` with `DPPError` / `invalid_config`.

---

## 4. Capability issuance

### 4.1 `issueCapability(input) → Promise<IssueCapabilityResult>`

Signs a compact JWS capability token merchants verify with `dpp-merchant-sdk`.

```typescript
type CapabilityClaimsInput = {
  sub: string;                       // agent subject (agent-identity.md)
  aud?: string[];
  scopes: string[];                  // e.g. ['pay:initiate']
  constraints: {
    maxAmount: { value: string; currency: string };
    merchantAllowlist: string[];
    paymentMethods?: ('upi' | 'card' | 'wallet_balance')[];
    requiresOtp?: boolean;
  };
  intentBind?: string;               // digest from computeIntentDigest
  ttlSeconds?: number;
};

type IssueCapabilityResult = {
  compactJws: string;
  jti: string;
  expiresAt: number;                 // Unix seconds
};
```

| Rule | Source |
|------|--------|
| MUST include `nonce`, `jti`, `exp`, `nbf` (optional), `scopes`, `constraints` | capability-token.schema.json |
| MUST NOT emit forbidden claims (`dpp:otpBypass`, etc.) | merchant-sdk constants |
| `intentBind` MUST match intent digest when intent-bound payment | payment-intents.md |
| Signing alg | ES256 or EdDSA (wallet documents choice in JWKS) |

**Implementation track:** AGE-36 (capability issuance + JWKS).

---

## 5. Payment intents

### 5.1 `computeIntentDigest(intent) → string`

Returns canonical SHA-256 digest (hex) for `PaymentIntent.digest.value` and capability `intentBind`.

- Input: `PaymentIntentInput` (pre-digest fields)
- Output: lowercase hex string, 64 chars
- Canonicalization: **normative rules in** [payment-intents.md](../protocol/payment-intents.md) (stable key order, decimal amounts as strings)

### 5.2 Intent FSM

States and events align with merchant SDK `INTENT_STATE` / `INTENT_EVENT` and [verification-flows.md](../protocol/verification-flows.md) §4.

| Method | Transition |
|--------|------------|
| `createIntent(payload)` | → `created` |
| `submitIntent(intentId)` | `created` → `validating` → `executing` \| `rejected` |
| `getIntentStatus(intentId)` | Read current record |
| `resumeAfterUserAction(intentId)` | `pending_user_action` → rail resume |

```typescript
type PaymentIntentRecord = PaymentIntentInput & {
  dpp: '0.1';
  typ: 'payment_intent';
  digest: { alg: 'sha256'; value: string };
  state: IntentState;
  createdAt: string;   // ISO 8601
  updatedAt: string;
};
```

Wallet services MAY persist intents in a database; the SDK provides pure transition helpers + optional in-memory store for tests.

**Implementation track:** AGE-37 (intent FSM + digest).

---

## 6. OAuth and delegation

Aligned with [wallet-oauth-linking.md](../protocol/wallet-oauth-linking.md) and [wallet-oauth.yaml](../../specs/openapi/wallet-oauth.yaml).

### 6.1 `createAuthorizationUrl(request)`

Builds PKCE authorization URL for agent linking. Does **not** perform HTTP — wallet service renders consent UI.

```typescript
type OAuthAuthorizationRequest = {
  clientId: string;
  redirectUri: string;
  scope: string[];                   // dpp:delegation:* scopes
  state: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  agentSub: string;                    // dpp_agent_sub query param
  resource?: string;                   // RFC 8707
};
```

### 6.2 `exchangeCode(input)`

Exchanges authorization code for tokens. Returns opaque `delegationId` for vault storage (MCP server).

### 6.3 `revokeDelegation(userId, agentSub)`

Fail-closed: new capabilities and intents for `(userId, agentSub)` rejected immediately.

**Implementation track:** AGE-38 (OAuth helpers + agent registry).

---

## 7. Agent registry

| Method | Purpose |
|--------|---------|
| `registerAgent(profile)` | Register agent `sub`, redirect URIs, display name |
| `revokeAgent(agentSub)` | Disable agent; existing delegations SHOULD be revoked |

```typescript
type AgentProfile = {
  sub: string;
  displayName: string;
  redirectUris: string[];
  clientId?: string;
};
```

Agent `sub` format: [agent-identity.md](../protocol/agent-identity.md).

---

## 8. JWKS and key rotation

| Method | Purpose |
|--------|---------|
| `exportJwks()` | Public keys for `/.well-known/jwks.json` |
| `rotateKeys(nextSigningKey)` | Rotate signing key; retain previous `kid` in JWKS until `keyRotation.retentionSeconds` elapses |

Merchants pin `jwksUri` in `dpp-merchant-sdk` trust config.

**Implementation track:** AGE-36 (JWKS).

---

## 9. Error model

`DPPError` with `code` from `DPP_ERROR_CODE`:

| Code | When |
|------|------|
| `not_implemented` | Scaffold methods (removed in alpha) |
| `invalid_config` | Bad issuer URL, missing signing key |
| `invalid_token` | Malformed claims pre-sign |
| `oauth_error` | Token exchange / metadata failure |
| `agent_not_registered` | Unknown `agentSub` |
| `delegation_revoked` | Revoked delegation |
| `intent_not_found` | Unknown intent id |
| `invalid_state_transition` | FSM violation |
| `forbidden_claim` | Disallowed capability claim |

---

## 10. Security considerations

| Threat | Mitigation |
|--------|------------|
| Capability theft via LLM | Tokens never in SDK callers' logs; vault pattern (MCP) |
| OTP bypass | SDK MUST NOT add `dpp:otpBypass`; wallet UI for step-up |
| Replay | Unique `jti` / `nonce`; merchant verifies via nonce store |
| OAuth code interception | PKCE S256 mandatory |
| Key exfiltration | KMS signing in production; no private keys in repo |
| Over-delegation | `constraints` + `intentBind` + merchant offline checks |

Security Researcher review required before npm `@alpha` publish (plan §7 Phase 0).

---

## 11. Verification matrix (acceptance)

| Criterion | Verification |
|-----------|--------------|
| Wallet issues JWS in &lt; 10 lines | Example in wallet-sdk README after AGE-36 |
| Merchant verifies issued token | `dpp-merchant-sdk` + express-merchant demo |
| Intent FSM matches spec diagram | Automated tests (AGE-37) |
| OAuth link without JWT in chat | E2E MCP issue (AGE-8+) |

---

## 12. Implementation phases

| Phase | Issues | Deliverable |
|-------|--------|-------------|
| **0 (this RFC)** | AGE-35 | Scaffold + API contract |
| **1a** | AGE-36, AGE-37, AGE-38 | Alpha implementations |
| **1b** | AGE-6+ | Wallet service MVP using SDK |
| **Publish** | Board + Security | `npm publish --tag alpha` |

---

## 13. References

- AGE-33 plan §5.2 — original API table (Paperclip plan document)
- [wallet-oauth-linking.md](../protocol/wallet-oauth-linking.md)
- [verification-flows.md](../protocol/verification-flows.md)
- [merchant-sdk integration guide](../integration-guides/merchant-sdk.md)
- [ADR-001 capability token model](../architecture/adr-001-capability-token-model.md)
