import { randomUUID } from 'node:crypto';
import { assertSafeForLlmContext, sanitizeForLlm } from 'dpp-agent-vault';
import { PAYMENT_RAIL, RAIL_CLASS, computeIntentDigest } from 'dpp-wallet-sdk';
import { buildPaymentIntentRecord } from '../clients/wallet-client.js';
import {
  evaluatePreviewPaymentPolicy,
  policyDeniedToolPayload,
} from '../policy/engine.js';
import type { McpPaymentSession } from '../session.js';

export async function handlePreviewPayment(
  session: McpPaymentSession,
  input: {
    delegationId: string;
    amountValue: string;
    currency: string;
    merchantId?: string;
    rail?: string;
    idempotencyKey?: string;
  },
): Promise<Record<string, unknown>> {
  let meta;
  try {
    meta = session.vault.getMeta(input.delegationId);
  } catch {
    return {
      status: 'error',
      code: 'delegation_not_found',
      message: 'Link wallet first (link_wallet).',
    };
  }

  const policy = session.getDelegationPolicy(input.delegationId);
  if (!policy) {
    return {
      status: 'error',
      code: 'delegation_not_found',
      message: 'Link wallet first (link_wallet).',
    };
  }

  const merchantId = input.merchantId ?? session.config.defaultMerchantId;
  const intentInput = {
    intentId: `pi_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    idempotencyKey: input.idempotencyKey ?? `idem_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
    amount: { value: input.amountValue, currency: input.currency },
    merchantId,
    rail: (input.rail ?? PAYMENT_RAIL.CARD) as (typeof PAYMENT_RAIL)[keyof typeof PAYMENT_RAIL],
    railClass: RAIL_CLASS.B,
  };

  const policyDecision = evaluatePreviewPaymentPolicy({
    policy,
    delegation: meta,
    intent: intentInput,
  });
  if (!policyDecision.allowed) {
    return policyDeniedToolPayload(policyDecision);
  }

  const digestHex = computeIntentDigest(intentInput);
  const paymentIntent = buildPaymentIntentRecord(intentInput);
  const previewId = session.createPreviewId();

  session.savePreview({
    previewId,
    delegationId: input.delegationId,
    userId: meta.userId,
    agentSub: meta.agentSub,
    intentInput,
    digestHex,
    paymentIntent,
    createdAt: new Date().toISOString(),
  });

  const safe = {
    status: 'preview_ready',
    previewId,
    delegation: sanitizeForLlm(meta),
    payment: {
      amount: intentInput.amount,
      merchantId,
      rail: intentInput.rail,
      railClass: intentInput.railClass,
      intentId: intentInput.intentId,
      digestAlg: 'sha-256',
      digestPreview: `${digestHex.slice(0, 8)}…`,
    },
    policyNote:
      'Server policy passed. No capability token is issued until confirm_payment.',
  };

  assertSafeForLlmContext(safe);
  return safe;
}
