import { DELEGATION_STATUS, VAULT_ERROR_CODE } from './constants.js';
import { decryptPayload, encryptPayload, resolveMasterKey } from './crypto.js';
import { DPPVaultError } from './errors.js';
import type {
  AgentVaultConfig,
  DelegationRecordMeta,
  DelegationSecrets,
  SafeDelegationHandle,
  StoreCapabilityInput,
  StoreOAuthTokensInput,
} from './types.js';

type InternalRecord = {
  readonly delegationId: string;
  readonly userId: string;
  readonly agentSub: string;
  readonly walletIssuer?: string;
  readonly status: (typeof DELEGATION_STATUS)[keyof typeof DELEGATION_STATUS];
  readonly linkedAt: string;
  readonly updatedAt: string;
  readonly encryptedSecrets: string;
};

function userAgentKey(userId: string, agentSub: string): string {
  return `${userId}\0${agentSub}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class AgentVault {
  readonly #masterKey: Buffer;
  readonly #byDelegationId = new Map<string, InternalRecord>();
  readonly #byUserAgent = new Map<string, string>();

  constructor(config: AgentVaultConfig) {
    try {
      this.#masterKey = resolveMasterKey(config.masterKey);
    } catch (err) {
      throw new DPPVaultError(
        VAULT_ERROR_CODE.INVALID_CONFIG,
        err instanceof Error ? err.message : 'invalid masterKey',
      );
    }
  }

  storeOAuthTokens(input: StoreOAuthTokensInput): SafeDelegationHandle {
    const {
      delegationId,
      userId,
      agentSub,
      accessToken,
      refreshToken,
      expiresIn,
      scope,
      walletIssuer,
    } = input;
    assertNonEmpty(delegationId, 'delegationId');
    assertNonEmpty(userId, 'userId');
    assertNonEmpty(agentSub, 'agentSub');
    assertNonEmpty(accessToken, 'accessToken');

    const uaKey = userAgentKey(userId, agentSub);
    const existingId = this.#byUserAgent.get(uaKey);
    if (existingId && existingId !== delegationId) {
      throw new DPPVaultError(VAULT_ERROR_CODE.ALREADY_EXISTS, 'user/agent pair already linked', {
        userId,
        agentSub,
        existingDelegationId: existingId,
      });
    }

    const tokenExpiresAt =
      typeof expiresIn === 'number' && expiresIn > 0
        ? Math.floor(Date.now() / 1000) + expiresIn
        : undefined;

    const prior = this.#byDelegationId.get(delegationId);
    const secrets: DelegationSecrets = {
      ...(prior ? this.#readSecrets(prior) : {}),
      accessToken,
      refreshToken,
      scope,
      tokenExpiresAt,
    };

    const linkedAt = prior?.linkedAt ?? nowIso();
    const record: InternalRecord = {
      delegationId,
      userId,
      agentSub,
      walletIssuer: walletIssuer ?? prior?.walletIssuer,
      status: DELEGATION_STATUS.ACTIVE,
      linkedAt,
      updatedAt: nowIso(),
      encryptedSecrets: this.#encryptSecrets(secrets),
    };

    this.#byDelegationId.set(delegationId, record);
    this.#byUserAgent.set(uaKey, delegationId);
    return this.#toSafeHandle(record, Boolean(secrets.capabilityJws));
  }

  storeCapability(input: StoreCapabilityInput): SafeDelegationHandle {
    const { delegationId, capabilityJws } = input;
    assertNonEmpty(delegationId, 'delegationId');
    assertNonEmpty(capabilityJws, 'capabilityJws');

    const record = this.#requireActive(delegationId);
    const secrets = this.#readSecrets(record);
    const next: DelegationSecrets = { ...secrets, capabilityJws };
    const updated: InternalRecord = {
      ...record,
      updatedAt: nowIso(),
      encryptedSecrets: this.#encryptSecrets(next),
    };
    this.#byDelegationId.set(delegationId, updated);
    return this.#toSafeHandle(updated, true);
  }

  /** Server-side retrieval only — never pass return value to MCP tool JSON. */
  getSecrets(delegationId: string): DelegationSecrets {
    const record = this.#requireActive(delegationId);
    return this.#readSecrets(record);
  }

  getSafeHandle(delegationId: string): SafeDelegationHandle {
    const record = this.#byDelegationId.get(delegationId);
    if (!record) {
      throw new DPPVaultError(VAULT_ERROR_CODE.NOT_FOUND, `delegation not found: ${delegationId}`);
    }
    const secrets = record.status === DELEGATION_STATUS.ACTIVE ? this.#readSecrets(record) : {};
    return this.#toSafeHandle(record, Boolean(secrets.capabilityJws));
  }

  getMeta(delegationId: string): DelegationRecordMeta {
    const safe = this.getSafeHandle(delegationId);
    const record = this.#byDelegationId.get(delegationId)!;
    return { ...safe, updatedAt: record.updatedAt };
  }

  listByUser(userId: string): ReadonlyArray<SafeDelegationHandle> {
    assertNonEmpty(userId, 'userId');
    const handles: SafeDelegationHandle[] = [];
    for (const record of this.#byDelegationId.values()) {
      if (record.userId !== userId) {
        continue;
      }
      const secrets =
        record.status === DELEGATION_STATUS.ACTIVE ? this.#readSecrets(record) : {};
      handles.push(this.#toSafeHandle(record, Boolean(secrets.capabilityJws)));
    }
    return handles;
  }

  revoke(delegationId: string): SafeDelegationHandle {
    const record = this.#byDelegationId.get(delegationId);
    if (!record) {
      throw new DPPVaultError(VAULT_ERROR_CODE.NOT_FOUND, `delegation not found: ${delegationId}`);
    }
    const updated: InternalRecord = {
      ...record,
      status: DELEGATION_STATUS.REVOKED,
      updatedAt: nowIso(),
      encryptedSecrets: this.#encryptSecrets({}),
    };
    this.#byDelegationId.set(delegationId, updated);
    this.#byUserAgent.delete(userAgentKey(record.userId, record.agentSub));
    return this.#toSafeHandle(updated, false);
  }

  delete(delegationId: string): void {
    const record = this.#byDelegationId.get(delegationId);
    if (!record) {
      throw new DPPVaultError(VAULT_ERROR_CODE.NOT_FOUND, `delegation not found: ${delegationId}`);
    }
    this.#byDelegationId.delete(delegationId);
    this.#byUserAgent.delete(userAgentKey(record.userId, record.agentSub));
  }

  #requireActive(delegationId: string): InternalRecord {
    const record = this.#byDelegationId.get(delegationId);
    if (!record) {
      throw new DPPVaultError(VAULT_ERROR_CODE.NOT_FOUND, `delegation not found: ${delegationId}`);
    }
    if (record.status === DELEGATION_STATUS.REVOKED) {
      throw new DPPVaultError(VAULT_ERROR_CODE.REVOKED, `delegation revoked: ${delegationId}`);
    }
    return record;
  }

  #encryptSecrets(secrets: DelegationSecrets): string {
    return encryptPayload(JSON.stringify(secrets), this.#masterKey);
  }

  #readSecrets(record: InternalRecord): DelegationSecrets {
    try {
      return JSON.parse(decryptPayload(record.encryptedSecrets, this.#masterKey)) as DelegationSecrets;
    } catch {
      throw new DPPVaultError(VAULT_ERROR_CODE.INVALID_CONFIG, 'failed to decrypt delegation secrets');
    }
  }

  #toSafeHandle(record: InternalRecord, hasCapability: boolean): SafeDelegationHandle {
    return {
      delegationId: record.delegationId,
      userId: record.userId,
      agentSub: record.agentSub,
      status: record.status,
      hasCapability,
      walletIssuer: record.walletIssuer,
      linkedAt: record.linkedAt,
    };
  }
}

export function createAgentVault(config: AgentVaultConfig): AgentVault {
  return new AgentVault(config);
}

function assertNonEmpty(value: string, field: string): void {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new DPPVaultError(VAULT_ERROR_CODE.INVALID_CONFIG, `${field} MUST be a non-empty string`);
  }
}
