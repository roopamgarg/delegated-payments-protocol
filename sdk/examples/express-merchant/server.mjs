import express from 'express';
import {
  createMerchant,
  generateTestKeyPair,
  signCapabilityForTest,
  DPPError,
} from '@dpp/merchant-sdk';
import { ISSUER, sampleCapabilityClaims, samplePaymentIntent } from './fixtures.mjs';
import { createMockStripe } from './mock-stripe.mjs';

const PORT = Number(process.env.PORT ?? 3340);
const useLiveStripe = Boolean(process.env.STRIPE_SECRET_KEY);

let testKeys;
let jwks;
let dpp;

async function bootstrap() {
  testKeys = await generateTestKeyPair();
  jwks = {
    keys: [{ ...testKeys.publicJwk, kid: 'test-key', alg: 'ES256', use: 'sig' }],
  };

  const mockMode = process.env.DPP_MOCK_STRIPE_MODE ?? 'succeeded';
  const stripe =
    useLiveStripe ? undefined : createMockStripe(mockMode === 'requires_action' ? 'requires_action' : 'succeeded');

  dpp = createMerchant({
    psp: 'stripe',
    trust: {
      jwks,
      issuerAllowlist: [ISSUER],
    },
    credentials: {
      secretKey: process.env.STRIPE_SECRET_KEY ?? 'demo-stripe-secret-not-a-real-key',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
      stripe,
    },
  });
}

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    pspMode: useLiveStripe ? 'stripe_live' : 'stripe_mock',
  });
});

/** Dev helper: mint a signed capability for the sample payment intent. */
app.post('/demo/capability', async (_req, res) => {
  const paymentIntent = samplePaymentIntent();
  const capabilityToken = await signCapabilityForTest(
    sampleCapabilityClaims(),
    testKeys.privateKey,
  );
  res.json({ capabilityToken, paymentIntent });
});

/** Verify delegation only (no PSP charge). */
app.post('/delegation/verify', async (req, res) => {
  try {
    const { capabilityToken, paymentIntent } = req.body;
    const delegation = await dpp.verify({ capabilityToken, paymentIntent });
    res.json(delegation);
  } catch (err) {
    sendDppError(res, err);
  }
});

/** Full flow: verify + PSP createPayment. */
app.post('/payments/delegate', async (req, res) => {
  try {
    const { capabilityToken, paymentIntent, metadata } = req.body;
    const result = await dpp.processPayment({
      capabilityToken,
      paymentIntent,
      metadata,
    });
    const httpStatus = result.status === 'pending_user_action' ? 202 : 200;
    res.status(httpStatus).json({
      status: result.status,
      verdict: result.delegation.verdict,
      pspPaymentId: result.psp.pspPaymentId,
      clientSecret: result.psp.clientSecret,
      escalation: result.escalation,
    });
  } catch (err) {
    sendDppError(res, err);
  }
});

app.get('/payments/:pspPaymentId/status', async (req, res) => {
  try {
    const psp = await dpp.getStatus(req.params.pspPaymentId);
    res.json(psp);
  } catch (err) {
    sendDppError(res, err);
  }
});

app.post(
  '/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      const signature = req.headers['stripe-signature'];
      if (!signature) {
        res.status(400).json({ error: 'missing_stripe_signature' });
        return;
      }
      const event = await dpp.handleWebhook(req.body, signature);
      res.json(event);
    } catch (err) {
      sendDppError(res, err);
    }
  },
);

function sendDppError(res, err) {
  if (err instanceof DPPError) {
    const status =
      err.code === 'delegation_invalid'
        ? 422
        : err.code === 'untrusted_issuer' || err.code === 'forbidden_claim'
          ? 403
          : err.code === 'invalid_signature' || err.code === 'invalid_token'
            ? 401
            : 500;
    res.status(status).json({ code: err.code, message: err.message, details: err.details });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
}

await bootstrap();
app.listen(PORT, () => {
  console.log(`DPP express-merchant demo listening on http://127.0.0.1:${PORT}`);
  console.log(`PSP mode: ${useLiveStripe ? 'live Stripe' : 'mock Stripe'}`);
});
