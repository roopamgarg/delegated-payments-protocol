/**
 * Manual sandbox console — wallet / agent / merchant columns.
 */
import {
  el,
  state,
  pretty,
  normalizeApiError,
  clearErrorPanel,
  showErrorPanel,
  capabilityForRequest,
  api,
  buildIntentFromForm,
  loadHealth,
  submitDelegate,
  mintCapability,
  sanitizePayload,
  setBadge,
  paymentBadgeKind,
} from './harness.mjs';

el('btn-dismiss-error').addEventListener('click', clearErrorPanel);

el('btn-mint').addEventListener('click', async () => {
  el('btn-mint').disabled = true;
  try {
    await mintCapability(buildIntentFromForm());
  } catch (err) {
    showErrorPanel(normalizeApiError(err, 'Mint capability'));
    el('capability-preview').textContent = 'Mint failed — see error panel';
  } finally {
    el('btn-mint').disabled = false;
  }
});

el('btn-delegate').addEventListener('click', async () => {
  el('btn-delegate').disabled = true;
  try {
    await submitDelegate();
  } catch (err) {
    const normalized = normalizeApiError(err, 'Submit payment');
    showErrorPanel(normalized);
    setBadge(el('payment-badge'), normalized.code, 'err');
    el('delegate-response').textContent = pretty({
      code: normalized.code,
      message: normalized.message,
      details: normalized.details,
    });
    el('escalation-panel').hidden = true;
  } finally {
    el('btn-delegate').disabled = false;
  }
});

el('btn-verify').addEventListener('click', async () => {
  el('btn-verify').disabled = true;
  clearErrorPanel();
  try {
    const data = await api('/delegation/verify', {
      method: 'POST',
      body: JSON.stringify({
        capabilityToken: capabilityForRequest(),
        paymentIntent: state.paymentIntent,
      }),
    });
    el('verify-response').textContent = pretty(sanitizePayload(data));
    setBadge(
      el('verdict-badge'),
      data.verdict ?? '—',
      data.verdict === 'delegation_valid' ? 'ok' : 'warn',
    );
    el('verify-note').hidden = false;
  } catch (err) {
    const normalized = normalizeApiError(err, 'Verify only (no charge)');
    showErrorPanel(normalized);
    el('verify-response').textContent = pretty({
      code: normalized.code,
      message: normalized.message,
      details: normalized.details,
    });
    el('verify-note').hidden = true;
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
    el('poll-response').textContent = pretty(sanitizePayload(data));
    if (data.status) {
      setBadge(el('payment-badge'), data.status, paymentBadgeKind(data.status));
    }
  } catch (err) {
    showErrorPanel(normalizeApiError(err, 'Poll PSP status'));
    el('poll-response').textContent = pretty(
      sanitizePayload(normalizeApiError(err, 'Poll PSP status')),
    );
  } finally {
    el('btn-poll').disabled = false;
  }
});

loadHealth().catch((err) => {
  el('psp-mode').textContent = `Error: ${err.message}`;
  showErrorPanel(normalizeApiError(err, 'Load /health'));
});
