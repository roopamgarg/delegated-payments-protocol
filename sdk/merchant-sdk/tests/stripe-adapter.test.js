import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StripeAdapter } from '../dist/adapters/stripe.js';

test('StripeAdapter maps requires_action to pending_user_action', async () => {
  const mockStripe = {
    paymentIntents: {
      create: async () => ({
        id: 'pi_mock',
        status: 'requires_action',
        client_secret: 'sec_mock',
        metadata: { dppIntentId: 'pi_dpp_1' },
      }),
    },
  };

  const adapter = new StripeAdapter({ secretKey: 'sk_test', stripe: mockStripe });
  const result = await adapter.createPayment({
    paymentIntent: {
      dpp: '0.1',
      typ: 'payment_intent',
      intentId: 'pi_dpp_1',
      idempotencyKey: 'idem_1',
      amount: { value: '10.00', currency: 'USD' },
      merchantId: 'merchant:example_com',
      rail: 'card',
      railClass: 'B',
      digest: { alg: 'sha-256', value: 'abc' },
    },
  });

  assert.equal(result.status, 'pending_user_action');
  assert.equal(result.escalation?.requiredAction, '3ds');
});
