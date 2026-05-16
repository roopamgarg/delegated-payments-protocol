/**
 * Replay protection for capability token `nonce` and JWT `jti`.
 * Merchants SHOULD use a distributed store in production (Redis, etc.).
 */
export type NonceStore = {
  /**
   * Record first use of a replay key until `expiresAtUnix`.
   * @returns `true` on first use; `false` when the key is still within its TTL window.
   */
  tryConsume(key: string, expiresAtUnix: number): Promise<boolean> | boolean;
};

export class InMemoryNonceStore implements NonceStore {
  private readonly seen = new Map<string, number>();

  tryConsume(key: string, expiresAtUnix: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    this.prune(now);
    const existing = this.seen.get(key);
    if (existing !== undefined && existing > now) {
      return false;
    }
    this.seen.set(key, expiresAtUnix);
    return true;
  }

  private prune(now: number): void {
    for (const [key, expiresAt] of this.seen) {
      if (expiresAt <= now) {
        this.seen.delete(key);
      }
    }
  }
}

const defaultStore = new InMemoryNonceStore();

/** Process-wide in-memory store used when config omits `nonceStore`. */
export function getDefaultNonceStore(): NonceStore {
  return defaultStore;
}

export type ReplayCheckInput = {
  readonly nonce: string;
  readonly exp: number;
  readonly jti?: string;
  /** When set, nonce replay keys are scoped to this payment idempotency key (wallet contract). */
  readonly idempotencyKey?: string;
};

export async function assertNotReplayed(
  store: NonceStore,
  input: ReplayCheckInput,
): Promise<void> {
  const keys = replayKeys(input);
  for (const key of keys) {
    const firstUse = await store.tryConsume(key, input.exp);
    if (!firstUse) {
      throw new ReplayError(key);
    }
  }
}

export class ReplayError extends Error {
  readonly replayKey: string;

  constructor(replayKey: string) {
    super(`Capability token replay detected: ${replayKey}`);
    this.name = 'ReplayError';
    this.replayKey = replayKey;
  }
}

function replayKeys(input: ReplayCheckInput): string[] {
  const keys: string[] = [];
  const nonceKey = input.idempotencyKey
    ? `nonce:${input.nonce}:idem:${input.idempotencyKey}`
    : `nonce:${input.nonce}`;
  keys.push(nonceKey);
  if (input.jti !== undefined && input.jti.length >= 8) {
    keys.push(`jti:${input.jti}`);
  }
  return keys;
}
