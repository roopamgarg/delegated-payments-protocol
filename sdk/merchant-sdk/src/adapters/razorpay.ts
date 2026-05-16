import type { CreatePaymentParams, PSPAdapter, PSPPaymentResult, WebhookEvent } from './types.js';
import { DPPError } from '../errors.js';

export type RazorpayAdapterConfig = {
  readonly keyId: string;
  readonly keySecret: string;
  readonly webhookSecret?: string;
  /** Injected Razorpay client (tests). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly razorpay?: any;
};

type RazorpayOrder = {
  id: string;
  status: string;
  amount: number;
  currency: string;
  notes?: Record<string, string>;
};

function minorUnits(value: string): number {
  const [whole, frac = ''] = value.split('.');
  const sub = (frac + '00').slice(0, 2);
  return Number(whole) * 100 + Number(sub);
}

function mapOrderStatus(order: RazorpayOrder): PSPPaymentResult['status'] {
  if (order.status === 'paid') return 'succeeded';
  if (order.status === 'attempted') return 'pending_user_action';
  if (order.status === 'created') return 'executing';
  return 'failed';
}

function toResult(order: RazorpayOrder): PSPPaymentResult {
  const status = mapOrderStatus(order);
  const base: PSPPaymentResult = {
    pspPaymentId: order.id,
    status,
    raw: order,
  };

  if (status === 'pending_user_action') {
    const intentId = order.notes?.dppIntentId ?? order.id;
    return {
      ...base,
      escalation: {
        escalationId: `esc_razorpay_${order.id}`,
        intentId,
        status: 'pending_user_action',
        requiredAction: 'otp',
        userChannel: 'wallet_app',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        resumeHint: 'poll_intent',
      },
    };
  }

  return base;
}

type RazorpayClient = {
  orders: {
    create(params: Record<string, unknown>): Promise<RazorpayOrder>;
    fetch(id: string): Promise<RazorpayOrder>;
  };
};

async function loadRazorpay(config: RazorpayAdapterConfig): Promise<RazorpayClient> {
  if (config.razorpay) return config.razorpay as RazorpayClient;
  try {
    const mod = await import('razorpay');
    const Razorpay = mod.default;
    return new Razorpay({
      key_id: config.keyId,
      key_secret: config.keySecret,
    }) as unknown as RazorpayClient;
  } catch {
    throw new DPPError(
      'psp_not_configured',
      'Install the optional peer dependency `razorpay` to use RazorpayAdapter',
    );
  }
}

export class RazorpayAdapter implements PSPAdapter {
  readonly name = 'razorpay';
  private readonly client: Promise<RazorpayClient>;
  private readonly webhookSecret?: string;

  constructor(config: RazorpayAdapterConfig) {
    this.client = loadRazorpay(config);
    this.webhookSecret = config.webhookSecret;
  }

  async createPayment(params: CreatePaymentParams): Promise<PSPPaymentResult> {
    const razorpay = await this.client;
    const pi = params.paymentIntent;

    const order = (await razorpay.orders.create({
      amount: minorUnits(pi.amount.value),
      currency: pi.amount.currency,
      receipt: pi.idempotencyKey,
      notes: {
        dppIntentId: pi.intentId,
        dppMerchantId: pi.merchantId,
        ...(pi.mandateId ? { dppMandateId: pi.mandateId } : {}),
        ...params.metadata,
      },
    })) as RazorpayOrder;

    return toResult(order);
  }

  async confirmPayment(pspPaymentId: string): Promise<PSPPaymentResult> {
    const razorpay = await this.client;
    const order = (await razorpay.orders.fetch(pspPaymentId)) as RazorpayOrder;
    return toResult(order);
  }

  async getPaymentStatus(pspPaymentId: string): Promise<PSPPaymentResult> {
    return this.confirmPayment(pspPaymentId);
  }

  async cancelPayment(_pspPaymentId: string): Promise<void> {
    throw new DPPError('psp_error', 'Razorpay order cancellation is not supported in v0.2 alpha');
  }

  async parseWebhook(payload: Buffer, signature: string): Promise<WebhookEvent> {
    if (!this.webhookSecret) {
      throw new DPPError('psp_error', 'Razorpay webhookSecret is required to parse webhooks');
    }

    const crypto = await import('node:crypto');
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    if (expected !== signature) {
      throw new DPPError('psp_error', 'Invalid Razorpay webhook signature');
    }

    const body = JSON.parse(payload.toString('utf8')) as {
      event: string;
      payload?: { order?: { entity: RazorpayOrder } };
    };

    const order = body.payload?.order?.entity;
    if (!order) {
      return { type: body.event, pspPaymentId: 'unknown', status: 'executing' };
    }

    const mapped = toResult(order);
    return {
      type: body.event,
      pspPaymentId: order.id,
      status: mapped.status,
      intentId: order.notes?.dppIntentId,
    };
  }
}
