import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  createMerchant,
  generateTestKeyPair,
  signCapabilityForTest,
  DPPError,
} from 'dpp-merchant-sdk';
import { ISSUER, sampleCapabilityClaims, samplePaymentIntent } from './fixtures.mjs';
import { createMockStripe } from './mock-stripe.mjs';
import { loadEnvLocal, resolveStripePspMode } from './stripe-key-guard.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
loadEnvLocal(__dirname);

const PORT = Number(process.env.PORT ?? 3340);
const HOST = process.env.DPP_BIND_HOST ?? '127.0.0.1';
const { mode: pspMode, useStripe } = resolveStripePspMode(process.env.STRIPE_SECRET_KEY);
const sandboxUiEnabled =
  process.env.NODE_ENV !== 'production' && process.env.DPP_SANDBOX_UI !== '0';
const sandboxDir = join(__dirname, 'public', 'sandbox');

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
    useStripe ? undefined : createMockStripe(mockMode === 'requires_action' ? 'requires_action' : 'succeeded');

  dpp = createMerchant({
    psp: 'stripe',
    trust: {
      jwks,
      issuerAllowlist: [ISSUER],
      allowInsecureTrustConfig: true,
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

if (sandboxUiEnabled) {
  app.use('/sandbox', express.static(sandboxDir, { index: 'index.html' }));
} else {
  app.get('/sandbox', (_req, res) => {
    res.status(404).json({ error: 'sandbox_ui_disabled' });
  });
  app.get('/sandbox/*splat', (_req, res) => {
    res.status(404).json({ error: 'sandbox_ui_disabled' });
  });
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    pspMode,
  });
});

/** Dev helper: mint a signed capability for the sample payment intent. */
app.post('/demo/capability', async (_req, res) => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const paymentIntent = samplePaymentIntent({
    intentId: `pi_demo_${suffix}`,
    idempotencyKey: `idem_demo_${suffix}`,
  });
  const capabilityToken = await signCapabilityForTest(
    sampleCapabilityClaims({ nonce: `nonce_demo_${suffix}` }),
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
    res.status(status).json({
      code: err.code,
      message: err.message,
      details: err.details,
    });
    return;
  }
  console.error(err);
  res.status(500).json({ code: 'internal_error', message: 'An unexpected error occurred' });
}

await bootstrap();
app.listen(PORT, HOST, () => {
  console.log(`DPP express-merchant demo listening on http://${HOST}:${PORT}`);
  const pspLabel =
    pspMode === 'stripe_test' ? 'Stripe Test Mode' : 'in-memory mock Stripe';
  console.log(`PSP mode: ${pspLabel} (${pspMode})`);
  if (sandboxUiEnabled) {
    console.log(`Sandbox console: http://${HOST}:${PORT}/sandbox`);
  }
});
