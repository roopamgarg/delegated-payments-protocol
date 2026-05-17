# Wallet KMS signing and key rotation (v0.1)

Operational guidance for `dpp-wallet-sdk` production deployments using cloud KMS/HSM for ES256 capability signing.

## Requirements

| Control | v0.1 expectation |
|---------|------------------|
| Private key material | MUST remain in KMS/HSM; SDK process holds only public JWK cache + IAM role |
| Algorithm | ES256 (`ECDSA_SHA_256` on AWS KMS) |
| JWKS | `exportJwks()` publishes active + retired public keys only |
| Rotation | `rotateKeys(nextSigningKey)` after provisioning the successor key |
| Retention | Retired `kid` values stay in JWKS for `keyRotation.retentionSeconds` (default **86400s**, minimum **2×** max capability TTL = 1800s floor at 900s TTL) |

## Provider portability (not AWS-only)

Production signing is **not** tied to AWS. The SDK exposes a small, provider-agnostic `KmsEs256Signer` interface; your wallet service implements or injects it.

| Path | When to use |
|------|-------------|
| `signingKey.type: 'local'` | Dev, CI, single-node tests only |
| `config.kmsSigner` (injected) | **Any** KMS/HSM that can ES256-sign — GCP Cloud KMS, Azure Key Vault, HashiCorp Vault Transit, on-prem HSM, etc. |
| `createAwsKmsEs256Signer()` | Optional convenience when you already run on AWS; requires peer dep `@aws-sdk/client-kms` |

Injected signers support two shapes (pick what your backend offers):

- **`signMessage(message)`** — signs the JWS signing input bytes (used by dev/test mocks).
- **`signSha256Digest(digest)`** — signs a 32-byte SHA-256 digest (matches AWS KMS `ECDSA_SHA_256` with `MessageType: DIGEST`).

Example (non-AWS) — wrap your HSM client:

```typescript
const wallet = createWalletIssuer({
  issuer: 'https://wallet.example/issuer',
  signingKey: {
    type: 'kms',
    keyId: 'vault:transit/keys/dpp-signing',
    kid: '2026-05-primary',
    publicJwk: cachedPublicJwkFromHsm,
  },
  kmsSigner: {
    keyId: 'vault:transit/keys/dpp-signing',
    async signSha256Digest(digest) {
      return myHsmClient.signEs256Digest(digest); // DER or raw P-256 R||S
    },
  },
});
```

v0.1 ships an AWS helper and reference ops runbook because that is a common deployment path; it is **not** a protocol or SDK requirement.

## AWS KMS setup (reference)

1. Create an asymmetric `ECC_NIST_P256` signing key with `SIGN_VERIFY` usage.
2. Grant the wallet service role `kms:Sign` and `kms:GetPublicKey` on that key (deny `kms:Decrypt`).
3. On deploy, call `GetPublicKey`, convert to JWK (`kty=EC`, `crv=P-256`, `x`, `y`), and pass as `signingKey.publicJwk`.
4. Configure the issuer:

```typescript
createWalletIssuer({
  issuer: 'https://wallet.example/issuer',
  signingKey: {
    type: 'kms',
    keyId: 'arn:aws:kms:...:key/...',
    kid: '2026-05-primary',
    publicJwk: cachedFromGetPublicKey,
  },
  keyRotation: { retentionSeconds: 86_400 },
});
```

Install `@aws-sdk/client-kms` in the wallet service, or inject `kmsSigner` from `createAwsKmsEs256Signer(keyId, client)`.

## Rotation procedure

1. Provision successor KMS key; cache its public JWK and `kid`.
2. Deploy config with `nextSigningKey` ready (or call `rotateKeys` with the new `SigningKeyMaterial`).
3. Invoke `wallet.rotateKeys(nextSigningKey)` during a maintenance window.
4. Update `kmsSigner` / IAM if the key ARN changed.
5. Serve `exportJwks()` at `/.well-known/jwks.json` — merchants verify against the union of active + retained retired keys.
6. After `retentionSeconds`, retired keys drop from JWKS automatically; capabilities signed with the old `kid` must have expired.

## Retention and cleanup

- **JWKS retention:** in-process `SigningKeyRing` prunes retired public keys when `expiresAt` passes. No private material is stored.
- **KMS keys:** disable/delete retired KMS keys only after retention elapses **and** no outstanding capabilities reference the old `kid` (max capability TTL ≤ 900s provides a hard upper bound).
- **Audit:** enable CloudTrail / KMS audit logs for `Sign` and `GetPublicKey`; alert on anomalous signing rates (see threat model § wallet issuer).

## Dev / test

Local JWK (`type: 'local'`) remains for unit tests. KMS paths can be exercised with an injected `kmsSigner` wrapping a local key (`createTestKmsSigningKey` in tests) without AWS credentials.

## Security review handoff

Security Researcher should validate: IAM least privilege, break-glass rotation, dual-control for `rotateKeys` in production, and alignment with [threat model § stolen signing key](../threat-model/v0.1.md).
