import type { DelegationStatus } from './constants.js';

/** Server-side plaintext secrets — never return from MCP tools. */
export type DelegationSecrets = {
  readonly accessToken?: string;
  readonly refreshToken?: string;
  readonly capabilityJws?: string;
  readonly tokenExpiresAt?: number;
  readonly scope?: string;
};

export type AgentVaultConfig = {
  /** 32-byte key, base64 key, or passphrase (scrypt-derived in dev only). */
  readonly masterKey: Buffer | string;
};

export type StoreOAuthTokensInput = {
  readonly delegationId: string;
  readonly userId: string;
  readonly agentSub: string;
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresIn?: number;
  readonly scope?: string;
  readonly walletIssuer?: string;
};

export type StoreCapabilityInput = {
  readonly delegationId: string;
  readonly capabilityJws: string;
};

/** Safe for MCP tool JSON — no bearer material. */
export type SafeDelegationHandle = {
  readonly delegationId: string;
  readonly userId: string;
  readonly agentSub: string;
  readonly status: DelegationStatus;
  readonly hasCapability: boolean;
  readonly walletIssuer?: string;
  readonly linkedAt: string;
};

export type DelegationRecordMeta = SafeDelegationHandle & {
  readonly updatedAt: string;
};
