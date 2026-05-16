/** In-memory Stripe client for local demo when STRIPE_SECRET_KEY is unset. */

export function createMockStripe(mode = 'succeeded') {
  return {
    paymentIntents: {
      create: async (params) => {
        const intentId = params.metadata?.dppIntentId ?? 'pi_dpp_mock';
        if (mode === 'requires_action') {
          return {
            id: 'pi_mock_action',
            status: 'requires_action',
            client_secret: 'sec_mock_demo',
            metadata: { dppIntentId: intentId },
          };
        }
        return {
          id: 'pi_mock_ok',
          status: 'succeeded',
          client_secret: null,
          metadata: { dppIntentId: intentId },
        };
      },
      retrieve: async (id) => ({
        id,
        status: 'succeeded',
        metadata: { dppIntentId: 'pi_demo_001' },
      }),
    },
    webhooks: {
      constructEvent: (payload, _sig, _secret) => {
        const body = JSON.parse(payload.toString());
        return body;
      },
    },
  };
}
