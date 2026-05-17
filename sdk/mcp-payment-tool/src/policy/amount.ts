import { Decimal } from 'decimal.js';

const AMOUNT_PATTERN = /^\d+(\.\d+)?$/;

export function assertValidAmount(value: string): void {
  if (!AMOUNT_PATTERN.test(value)) {
    throw new Error(`invalid_amount:${value}`);
  }
}

export function amountLte(value: string, max: string): boolean {
  assertValidAmount(value);
  assertValidAmount(max);
  return new Decimal(value).lte(new Decimal(max));
}
