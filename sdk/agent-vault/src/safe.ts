import { SECRET_LEAK_PATTERNS, VAULT_ERROR_CODE } from './constants.js';
import { DPPVaultError } from './errors.js';

const REDACTED = '[REDACTED]';

/**
 * Recursively clone a value for MCP tool responses, redacting known secret shapes.
 * Throws if a JWT or DPP bearer prefix survives redaction (fail-closed).
 */
export function sanitizeForLlm<T>(value: T): T {
  const seen = new WeakSet<object>();
  const sanitized = sanitizeValue(value, seen) as T;
  assertSafeForLlmContext(sanitized);
  return sanitized;
}

function sanitizeValue(value: unknown, seen: WeakSet<object>): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return redactString(value);
  }
  if (typeof value !== 'object') {
    return value;
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item, seen));
  }
  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (isSecretFieldName(key)) {
      out[key] = REDACTED;
      continue;
    }
    out[key] = sanitizeValue(entry, seen);
  }
  return out;
}

function isSecretFieldName(key: string): boolean {
  const lower = key.toLowerCase();
  return (
    lower.includes('token') ||
    lower.includes('secret') ||
    lower.includes('password') ||
    lower === 'compactjws' ||
    lower === 'capabilityjws' ||
    lower === 'refresh' ||
    lower.endsWith('jws')
  );
}

function redactString(value: string): string {
  let out = value;
  for (const pattern of SECRET_LEAK_PATTERNS) {
    if (pattern.test(out)) {
      return REDACTED;
    }
  }
  return out;
}

/** Fail-closed guard before returning tool output to an LLM host. */
export function assertSafeForLlmContext(value: unknown): void {
  const serialized = JSON.stringify(value);
  for (const pattern of SECRET_LEAK_PATTERNS) {
    if (pattern.test(serialized)) {
      throw new DPPVaultError(
        VAULT_ERROR_CODE.UNSAFE_FOR_LLM,
        'tool output contains material that must stay in the vault',
        { pattern: String(pattern) },
      );
    }
  }
}

/** Opaque server-side secret — JSON.stringify and util.inspect never leak value. */
export class VaultSecret<T = string> {
  readonly #value: T;

  constructor(value: T) {
    this.#value = value;
  }

  unwrap(): T {
    return this.#value;
  }

  toJSON(): string {
    return REDACTED;
  }

  toString(): string {
    return REDACTED;
  }

  [Symbol.for('nodejs.util.inspect.custom')](): string {
    return REDACTED;
  }
}
