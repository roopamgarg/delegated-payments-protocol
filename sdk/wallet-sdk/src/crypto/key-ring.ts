import type { SigningKeyMaterial } from '../types.js';
import { DPP_ERROR_CODE } from '../constants.js';
import { DPPError } from '../errors.js';
import { getPublicJwk } from './keys.js';

const MAX_CAPABILITY_TTL_SECONDS = 900;

export const DEFAULT_KEY_RETENTION_SECONDS = 86_400;

export type KeyRotationConfig = {
  readonly retentionSeconds?: number;
};

export type RetiredSigningKey = {
  readonly material: SigningKeyMaterial;
  readonly retiredAt: number;
  readonly expiresAt: number;
};

export class SigningKeyRing {
  private active: SigningKeyMaterial;
  private readonly retentionSeconds: number;
  private retired: RetiredSigningKey[] = [];

  constructor(active: SigningKeyMaterial, rotation?: KeyRotationConfig) {
    this.active = active;
    this.retentionSeconds = Math.max(
      rotation?.retentionSeconds ?? DEFAULT_KEY_RETENTION_SECONDS,
      MAX_CAPABILITY_TTL_SECONDS * 2,
    );
  }

  getActive(): SigningKeyMaterial {
    return this.active;
  }

  listPublicJwks(now = Math.floor(Date.now() / 1000)): JsonWebKey[] {
    this.pruneExpired(now);
    return [getPublicJwk(this.active), ...this.retired.map((entry) => getPublicJwk(entry.material))];
  }

  rotate(nextSigningKey: SigningKeyMaterial, now = Math.floor(Date.now() / 1000)): JsonWebKey[] {
    if (nextSigningKey.kid === this.active.kid) {
      throw new DPPError(
        DPP_ERROR_CODE.INVALID_CONFIG,
        'rotateKeys next signing key must use a different kid than the active key',
      );
    }
    this.retired.push({
      material: this.active,
      retiredAt: now,
      expiresAt: now + this.retentionSeconds,
    });
    this.active = nextSigningKey;
    this.pruneExpired(now);
    return this.listPublicJwks(now);
  }

  private pruneExpired(now: number): void {
    this.retired = this.retired.filter((entry) => entry.expiresAt > now);
  }
}
