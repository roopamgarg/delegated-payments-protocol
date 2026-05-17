/**
 * DPP sandbox console — local manual verification only.
 * No card/OTP fields; secrets stay server-side.
 */

const base = window.location.origin;
const SAMPLE_DIGEST =
  'fa1183e76b890f5cea60ea03d76bd8f2e6f32fee72f47e25669d68ae84b360db';

/** @type {{ capabilityToken?: string, paymentIntent?: object }} */
const state = {};

const el = (id) => document.getElementById(id);

const PSP_LABELS = {
  stripe_test: 'Stripe Test Mode',
  stripe_mock: 'In-memory mock PSP',
};

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

function setBadge(node, text, kind) {
  node.textContent = text;
  node.className = `badge badge-${kind}`;
}

async function api(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.message ?? body.error ?? res.statusText);
    err.code = body.code;
    err.details = body;
    err.status = res.status;
    throw err;
  }
  return body;
}

function applyBanner(pspMode) {
  const banner = el('banner');
  const text = el('banner-text');
  const sub = el('banner-sub');
  banner.hidden = false;
  banner.classList.toggle('mock', pspMode === 'stripe_mock');

  if (pspMode === 'stripe_test') {
    text.textContent = 'SANDBOX ONLY — Stripe Test Mode';
    sub.textContent = 'Real test PaymentIntents; no live money. Complete 3DS outside this UI.';
  } else {
    text.textContent = 'SANDBOX ONLY — mock PSP';
    sub.textContent = 'Offline fallback — not real Stripe sandbox behavior. Set sk_test_ for board demos.';
  }
}

function paymentBadgeKind(status) {
  if (status === 'succeeded') return 'ok';
  if (status === 'pending_user_action' || status === 'executing') return 'warn';
  if (status === 'failed' || status === 'delegation_invalid') return 'err';
  return 'idle';
}

function showEscalation(data) {
  const panel = el('escalation-panel');
  const needsAction = data.status === 'pending_user_action';
  panel.hidden = !needsAction;
  if (!needsAction) return;

  const meta = el('escalation-meta');
  meta.replaceChildren();
  const rows = [
    ['Required action', data.escalation?.requiredAction ?? 'three_ds'],
    ['User channel', data.escalation?.userChannel ?? 'card_issuer'],
    ['PSP payment ID', data.pspPaymentId ?? '—'],
    ['Resume hint', data.escalation?.resumeHint ?? 'webhook'],
  ];
  for (const [label, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = String(value);
    meta.append(dt, dd);
  }
}

function setMinted(mint) {
  state.capabilityToken = mint.capabilityToken;
  state.paymentIntent = mint.paymentIntent;
  el('capability-preview').textContent = mint.capabilityToken;
  el('intent-preview').textContent = pretty(mint.paymentIntent);
  el('btn-delegate').disabled = false;
  el('btn-verify').disabled = false;
  setBadge(el('payment-badge'), 'idle', 'idle');
  setBadge(el('verdict-badge'), '—', 'idle');
  el('escalation-panel').hidden = true;
  el('delegate-response').textContent = '—';
}

function buildIntentFromForm() {
  const form = el('intent-form');
  const amount = form.amount.value.trim() || '10.00';
  const merchantId = form.merchantId.value.trim() || 'merchant:example_com';
  return {
    dpp: '0.1',
    typ: 'payment_intent',
    intentId: `pi_ui_${Date.now()}`,
    idempotencyKey: `idem_ui_${Date.now()}`,
    amount: { value: amount, currency: 'USD' },
    merchantId,
    rail: 'card',
    railClass: 'B',
    digest: { alg: 'sha-256', value: SAMPLE_DIGEST },
  };
}

async function loadHealth() {
  el('base-url').textContent = base;
  const health = await api('/health');
  const mode = health.pspMode ?? 'stripe_mock';
  el('psp-mode').textContent = PSP_LABELS[mode] ?? mode;
  applyBanner(mode);
}

el('btn-mint').addEventListener('click', async () => {
  el('btn-mint').disabled = true;
  try {
    const mint = await api('/demo/capability', { method: 'POST' });
    const intent = buildIntentFromForm();
    mint.paymentIntent = { ...mint.paymentIntent, ...intent };
    setMinted(mint);
  } catch (err) {
    el('capability-preview').textContent = err.message;
  } finally {
    el('btn-mint').disabled = false;
  }
});

el('btn-delegate').addEventListener('click', async () => {
  if (!state.capabilityToken) return;
  el('btn-delegate').disabled = true;
  try {
    const data = await api('/payments/delegate', {
      method: 'POST',
      body: JSON.stringify({
        capabilityToken: state.capabilityToken,
        paymentIntent: state.paymentIntent,
      }),
    });
    el('delegate-response').textContent = pretty(data);
    setBadge(el('payment-badge'), data.status, paymentBadgeKind(data.status));
    setBadge(
      el('verdict-badge'),
      data.verdict ?? '—',
      data.verdict === 'delegation_valid' ? 'ok' : 'warn',
    );
    showEscalation(data);
    if (data.pspPaymentId) {
      el('poll-id').value = data.pspPaymentId;
      el('btn-poll').disabled = false;
    }
    if (data.clientSecret) {
      el('client-secret-hint').hidden = false;
    }
  } catch (err) {
    setBadge(el('payment-badge'), err.code ?? 'error', 'err');
    el('delegate-response').textContent = pretty(err.details ?? { message: err.message });
    el('escalation-panel').hidden = true;
  } finally {
    el('btn-delegate').disabled = false;
  }
});

el('btn-verify').addEventListener('click', async () => {
  if (!state.capabilityToken) return;
  el('btn-verify').disabled = true;
  try {
    const data = await api('/delegation/verify', {
      method: 'POST',
      body: JSON.stringify({
        capabilityToken: state.capabilityToken,
        paymentIntent: state.paymentIntent,
      }),
    });
    el('verify-response').textContent = pretty(data);
    setBadge(
      el('verdict-badge'),
      data.verdict ?? '—',
      data.verdict === 'delegation_valid' ? 'ok' : 'warn',
    );
  } catch (err) {
    el('verify-response').textContent = pretty(err.details ?? { message: err.message });
  } finally {
    el('btn-verify').disabled = false;
  }
});

el('btn-poll').addEventListener('click', async () => {
  const id = el('poll-id').value.trim();
  if (!id) return;
  el('btn-poll').disabled = true;
  try {
    const data = await api(`/payments/${encodeURIComponent(id)}/status`);
    el('poll-response').textContent = pretty(data);
    if (data.status) {
      setBadge(el('payment-badge'), data.status, paymentBadgeKind(data.status));
    }
  } catch (err) {
    el('poll-response').textContent = pretty(err.details ?? { message: err.message });
  } finally {
    el('btn-poll').disabled = false;
  }
});

loadHealth().catch((err) => {
  el('psp-mode').textContent = `Error: ${err.message}`;
});
