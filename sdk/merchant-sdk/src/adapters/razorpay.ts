import type { CreatePaymentParams, PSPAdapter, PSPPaymentResult, WebhookEvent } from './types.js';
import { DPPError } from '../errors.js';
import {
  DPP_ERROR_CODE,
  ESCALATION_ID_PREFIX,
  ESCALATION_TTL_MS,
  INTENT_STATE,
  METADATA_KEY,
  PSP_NAME,
  RAZORPAY_ORDER_STATUS,
  REQUIRED_ACTION,
  RESUME_HINT,
  USER_CHANNEL,
  WEBHOOK,
} from '../constants.js';

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
  if (order.status === RAZORPAY_ORDER_STATUS.PAID) return INTENT_STATE.SUCCEEDED;
  if (order.status === RAZORPAY_ORDER_STATUS.ATTEMPTED) return INTENT_STATE.PENDING_USER_ACTION;
  if (order.status === RAZORPAY_ORDER_STATUS.CREATED) return INTENT_STATE.EXECUTING;
  return INTENT_STATE.FAILED;
}

function toResult(order: RazorpayOrder): PSPPaymentResult {
  const status = mapOrderStatus(order);
  const base: PSPPaymentResult = {
    pspPaymentId: order.id,
    status,
    raw: order,
  };

  if (status === INTENT_STATE.PENDING_USER_ACTION) {
    const intentId = order.notes?.[METADATA_KEY.DPP_INTENT_ID] ?? order.id;
    return {
      ...base,
      escalation: {
        escalationId: `${ESCALATION_ID_PREFIX.RAZORPAY}${order.id}`,
        intentId,
        status: INTENT_STATE.PENDING_USER_ACTION,
        requiredAction: REQUIRED_ACTION.OTP,
        userChannel: USER_CHANNEL.WALLET_APP,
        expiresAt: new Date(Date.now() + ESCALATION_TTL_MS).toISOString(),
        resumeHint: RESUME_HINT.POLL_INTENT,
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
      DPP_ERROR_CODE.PSP_NOT_CONFIGURED,
      'Install the optional peer dependency `razorpay` to use RazorpayAdapter',
    );
  }
}

export class RazorpayAdapter implements PSPAdapter {
  readonly name = PSP_NAME.RAZORPAY;
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
        [METADATA_KEY.DPP_INTENT_ID]: pi.intentId,
        [METADATA_KEY.DPP_MERCHANT_ID]: pi.merchantId,
        ...(pi.mandateId ? { [METADATA_KEY.DPP_MANDATE_ID]: pi.mandateId } : {}),
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
    throw new DPPError(DPP_ERROR_CODE.PSP_ERROR, 'Razorpay order cancellation is not supported in v0.2 alpha');
  }

  async parseWebhook(payload: Buffer, signature: string): Promise<WebhookEvent> {
    if (!this.webhookSecret) {
      throw new DPPError(DPP_ERROR_CODE.PSP_ERROR, 'Razorpay webhookSecret is required to parse webhooks');
    }

    const crypto = await import('node:crypto');
    const expected = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('hex');

    if (expected !== signature) {
      throw new DPPError(DPP_ERROR_CODE.PSP_ERROR, 'Invalid Razorpay webhook signature');
    }

    const body = JSON.parse(payload.toString('utf8')) as {
      event: string;
      payload?: { order?: { entity: RazorpayOrder } };
    };

    const order = body.payload?.order?.entity;
    if (!order) {
      return { type: body.event, pspPaymentId: WEBHOOK.UNKNOWN_PSP_PAYMENT_ID, status: INTENT_STATE.EXECUTING };
    }

    const mapped = toResult(order);
    return {
      type: body.event,
      pspPaymentId: order.id,
      status: mapped.status,
      intentId: order.notes?.[METADATA_KEY.DPP_INTENT_ID],
    };
  }
}
