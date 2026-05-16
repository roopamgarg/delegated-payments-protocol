import { test } from 'node:test';
import assert from 'node:assert/strict';
import { amountLte, assertValidAmount } from '../dist/core/decimal.js';

test('amountLte compares decimal strings', () => {
  assert.equal(amountLte('10.00', '25.00'), true);
  assert.equal(amountLte('25.01', '25.00'), false);
  assert.equal(amountLte('0.99', '1.00'), true);
});

test('assertValidAmount rejects exponent notation', () => {
  assert.throws(() => assertValidAmount('1e3'));
});
