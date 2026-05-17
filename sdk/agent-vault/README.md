# dpp-agent-vault

Encrypted **per-user / per-agent** delegation storage for DPP agent platforms (MCP servers, cloud Actions backends). OAuth access/refresh tokens and capability JWS material **never** enter LLM context or tool JSON.

Normative boundary: [wallet-oauth-linking.md](../../docs/protocol/wallet-oauth-linking.md) §2, [threat-model v0.1](../../docs/threat-model/v0.1.md) §6.4.

## Install

```bash
npm install dpp-agent-vault
```

## Usage (MCP server)

```typescript
import { createAgentVault, sanitizeForLlm } from 'dpp-agent-vault';

const vault = createAgentVault({
  masterKey: process.env.DPP_VAULT_MASTER_KEY!, // 32-byte secret or KMS-wrapped key
});

// After wallet.exchangeCode — store server-side only
const tokens = await wallet.exchangeCode({ /* ... */ });
const handle = vault.storeOAuthTokens({
  delegationId: tokens.delegationId,
  userId: session.userId,
  agentSub: agent.sub,
  accessToken: tokens.accessToken,
  refreshToken: tokens.refreshToken,
  expiresIn: tokens.expiresIn,
  scope: tokens.scope,
});

// Return ONLY safe handle to the tool layer / model host
return sanitizeForLlm(handle);

// Later: issue capability via wallet API, then vault.storeCapability({ delegationId, capabilityJws })
// Payment path: vault.getSecrets(delegationId) — never log or return to LLM
```

## API

| Method | LLM-safe? | Purpose |
|--------|-----------|---------|
| `storeOAuthTokens` | return value yes | Persist OAuth delegation after link |
| `storeCapability` | return value yes | Persist capability JWS after wallet issue |
| `getSafeHandle` / `listByUser` | yes | Opaque handles for tools |
| `getSecrets` | **no** | Server-side only |
| `revoke` / `delete` | yes | Lifecycle |

## Security

- AES-256-GCM at rest per delegation record
- `sanitizeForLlm` + `assertSafeForLlmContext` fail closed on JWT/bearer patterns
- `VaultSecret` redacts `JSON.stringify` / inspect output

Production: load `masterKey` from a KMS or HSM; do not commit keys. See [wallet-kms-signing.md](../../docs/operations/wallet-kms-signing.md) for issuer-side key hygiene patterns.

## Test

```bash
npm ci && npm test
```
