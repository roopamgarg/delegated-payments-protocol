import { test } from 'node:test';
import assert from 'node:assert/strict';
import { StripeAdapter } from '../dist/adapters/stripe.js';
import {
  ARTIFACT_TYPE,
  DPP_VERSION,
  INTENT_STATE,
  PAYMENT_RAIL,
  RAIL_CLASS,
  REQUIRED_ACTION,
  DIGEST_ALG,
  STRIPE_PAYMENT_INTENT_STATUS,
} from '../dist/constants.js';

test('StripeAdapter maps requires_action to pending_user_action', async () => {
  const mockStripe = {
    paymentIntents: {
      create: async () => ({
        id: 'pi_mock',
        status: STRIPE_PAYMENT_INTENT_STATUS.REQUIRES_ACTION,
        client_secret: 'sec_mock',
        metadata: { dppIntentId: 'pi_dpp_1' },
      }),
    },
  };

  const adapter = new StripeAdapter({ secretKey: 'sk_test', stripe: mockStripe });
  const result = await adapter.createPayment({
    paymentIntent: {
      dpp: DPP_VERSION,
      typ: ARTIFACT_TYPE.PAYMENT_INTENT,
      intentId: 'pi_dpp_1',
      idempotencyKey: 'idem_1',
      amount: { value: '10.00', currency: 'USD' },
      merchantId: 'merchant:example_com',
      rail: PAYMENT_RAIL.CARD,
      railClass: RAIL_CLASS.B,
      digest: { alg: DIGEST_ALG.SHA256, value: 'abc' },
    },
  });

  assert.equal(result.status, INTENT_STATE.PENDING_USER_ACTION);
  assert.equal(result.escalation?.requiredAction, REQUIRED_ACTION.THREE_DS);
});
