/**
 * In-memory payment intent store for the demo server.
 * Replaced by dpp-wallet-sdk intent FSM when AGE-37 implementation ships in the package.
 */

const intents = new Map();

const TERMINAL = new Set(['succeeded', 'failed', 'rejected', 'expired']);

export function submitDemoIntent({ paymentIntent, capabilityToken }) {
  if (!paymentIntent?.intentId) {
    throw Object.assign(new Error('paymentIntent.intentId is required'), { code: 'invalid_request' });
  }
  if (!capabilityToken) {
    throw Object.assign(new Error('capabilityToken is required'), { code: 'invalid_request' });
  }

  const existing = intents.get(paymentIntent.intentId);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const record = {
    ...paymentIntent,
    dpp: paymentIntent.dpp ?? '0.1',
    typ: paymentIntent.typ ?? 'payment_intent',
    state: 'validating',
    capabilityToken,
    createdAt: now,
    updatedAt: now,
  };

  // Demo rail: instant success after accept (no OTP path).
  record.state = 'succeeded';
  record.updatedAt = new Date().toISOString();
  intents.set(record.intentId, record);
  return record;
}

export function getDemoIntent(intentId) {
  const record = intents.get(intentId);
  if (!record) {
    throw Object.assign(new Error(`intent not found: ${intentId}`), {
      code: 'intent_not_found',
    });
  }
  return record;
}

export function cancelDemoIntent(intentId) {
  const record = getDemoIntent(intentId);
  if (TERMINAL.has(record.state)) {
    throw Object.assign(new Error(`intent already terminal: ${record.state}`), {
      code: 'invalid_state_transition',
    });
  }
  record.state = 'rejected';
  record.updatedAt = new Date().toISOString();
  intents.set(intentId, record);
  return record;
}
