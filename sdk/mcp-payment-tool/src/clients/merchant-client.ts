import type { McpPaymentConfig } from '../types.js';

export type DelegatePaymentResult = {
  readonly status: string;
  readonly verdict?: string;
  readonly pspPaymentId?: string;
  readonly clientSecret?: string;
  readonly escalation?: unknown;
};

export type PaymentStatusResult = {
  readonly status: string;
  readonly pspPaymentId?: string;
  readonly escalation?: unknown;
};

export async function delegatePayment(
  config: McpPaymentConfig,
  input: {
    capabilityToken: string;
    paymentIntent: Record<string, unknown>;
    metadata?: Record<string, string>;
  },
): Promise<DelegatePaymentResult> {
  const res = await fetch(`${config.merchantBaseUrl}/payments/delegate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      capabilityToken: input.capabilityToken,
      paymentIntent: input.paymentIntent,
      metadata: input.metadata,
    }),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new MerchantHttpError(res.status, String(body.code ?? body.error ?? 'payment_failed'), body);
  }
  return {
    status: String(body.status),
    verdict: body.verdict ? String(body.verdict) : undefined,
    pspPaymentId: body.pspPaymentId ? String(body.pspPaymentId) : undefined,
    clientSecret: body.clientSecret ? String(body.clientSecret) : undefined,
    escalation: body.escalation,
  };
}

export async function getPaymentStatus(
  config: McpPaymentConfig,
  pspPaymentId: string,
): Promise<PaymentStatusResult> {
  const res = await fetch(`${config.merchantBaseUrl}/payments/${encodeURIComponent(pspPaymentId)}/status`);
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new MerchantHttpError(res.status, String(body.code ?? body.error ?? 'status_failed'), body);
  }
  return {
    status: String(body.status ?? 'unknown'),
    pspPaymentId: body.pspPaymentId ? String(body.pspPaymentId) : pspPaymentId,
    escalation: body.escalation,
  };
}

export class MerchantHttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, details: unknown) {
    super(`Merchant HTTP ${status}: ${code}`);
    this.name = 'MerchantHttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
