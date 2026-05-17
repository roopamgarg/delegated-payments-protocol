/**
 * Lexicographically sorted JSON serialization per payment-intents.md §4.
 */
export function canonicalJsonStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  const record = value as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    sorted[key] = sortDeep(record[key]);
  }
  return sorted;
}
