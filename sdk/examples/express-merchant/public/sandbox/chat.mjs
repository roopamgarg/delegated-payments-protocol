/**
 * Sandbox chat agent — demo NL → PaymentIntent preview → explicit confirm.
 * No external LLM; rule-based parser for local sandbox only.
 */
import {
  pretty,
  buildPaymentIntent,
  mintCapability,
  submitDelegate,
  normalizeApiError,
  showErrorPanel,
  clearErrorPanel,
} from './harness.mjs';

const chatLog = document.getElementById('chat-log');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatPreview = document.getElementById('chat-preview');
const chatPreviewJson = document.getElementById('chat-preview-json');
const btnChatConfirm = document.getElementById('btn-chat-confirm');
const btnChatCancel = document.getElementById('btn-chat-cancel');

/** @type {object | null} */
let pendingIntent = null;

const HELP_TEXT = `Try: "Pay $10 to merchant:example_com" or "Pay 25 dollars for merchant:example_com"`;

/**
 * @param {string} text
 * @returns {{ amount: string, merchantId: string } | null}
 */
export function parsePaymentRequest(text) {
  const t = text.trim();
  if (!t) return null;

  const withMerchant =
    /pay\s+\$?(\d+(?:\.\d{1,2})?)\s*(?:usd|dollars?)?\s+(?:to|for)\s+(merchant:[\w.:-]+)/i.exec(t);
  if (withMerchant) {
    return { amount: withMerchant[1], merchantId: withMerchant[2] };
  }

  const amountOnly = /pay\s+\$?(\d+(?:\.\d{1,2})?)\s*(?:usd|dollars?)?/i.exec(t);
  if (amountOnly) {
    return { amount: amountOnly[1], merchantId: 'merchant:example_com' };
  }

  return null;
}

function appendMessage(role, body, extraClass = '') {
  const row = document.createElement('div');
  row.className = `chat-msg chat-msg-${role} ${extraClass}`.trim();
  const label = document.createElement('span');
  label.className = 'chat-role';
  label.textContent = role === 'user' ? 'You' : 'Demo agent';
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = body;
  row.append(label, bubble);
  chatLog.append(row);
  chatLog.scrollTop = chatLog.scrollHeight;
}

function hidePreview() {
  pendingIntent = null;
  chatPreview.hidden = true;
  btnChatConfirm.disabled = true;
}

function showPreview(intent) {
  pendingIntent = intent;
  chatPreview.hidden = false;
  chatPreviewJson.textContent = pretty(intent);
  btnChatConfirm.disabled = false;
}

chatForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';
  appendMessage('user', text);

  const lower = text.toLowerCase();
  if (lower === 'help' || lower === '?') {
    appendMessage('agent', HELP_TEXT);
    return;
  }

  const parsed = parsePaymentRequest(text);
  if (!parsed) {
    appendMessage(
      'agent',
      `I could not parse a payment request. ${HELP_TEXT}`,
      'chat-msg-warn',
    );
    hidePreview();
    return;
  }

  const intent = buildPaymentIntent(parsed);
  appendMessage(
    'agent',
    `I can request $${intent.amount.value} to ${intent.merchantId}. Review the preview below and click Confirm payment — chat alone never charges.`,
  );
  showPreview(intent);
});

btnChatCancel.addEventListener('click', () => {
  hidePreview();
  appendMessage('agent', 'Payment request cancelled.');
});

btnChatConfirm.addEventListener('click', async () => {
  if (!pendingIntent) return;
  btnChatConfirm.disabled = true;
  btnChatCancel.disabled = true;
  clearErrorPanel();
  try {
    appendMessage('agent', 'Minting capability and submitting delegated payment…');
    await mintCapability(pendingIntent);
    const result = await submitDelegate();
    hidePreview();
    appendMessage(
      'agent',
      `Payment submitted: status=${result.status}, verdict=${result.verdict}. See Agent / Merchant panels for JSON.`,
      result.status === 'succeeded' ? 'chat-msg-ok' : 'chat-msg-warn',
    );
  } catch (err) {
    const normalized = normalizeApiError(err, 'Chat confirm payment');
    showErrorPanel(normalized);
    appendMessage('agent', `Failed: ${normalized.code} — ${normalized.message}`, 'chat-msg-err');
    btnChatConfirm.disabled = false;
  } finally {
    btnChatCancel.disabled = false;
  }
});

appendMessage(
  'agent',
  'Demo sandbox agent — not a production payment authority. ' + HELP_TEXT,
);

document.querySelectorAll('[data-view-tab]').forEach((tab) => {
  tab.addEventListener('click', () => {
    const view = tab.dataset.viewTab;
    document.querySelectorAll('[data-view-tab]').forEach((t) => {
      t.classList.toggle('active', t === tab);
      t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
    });
    document.getElementById('view-manual').hidden = view !== 'manual';
    document.getElementById('view-chat').hidden = view !== 'chat';
  });
});
