// Stripe is an optional peer dependency; types come from devDependency at build time.
import type Stripe from 'stripe';
import type { CreatePaymentParams, PSPAdapter, PSPPaymentResult, WebhookEvent } from './types.js';
import { DPPError } from '../errors.js';
import {
  DPP_ERROR_CODE,
  ESCALATION_ID_PREFIX,
  ESCALATION_TTL_MS,
  INTENT_STATE,
  METADATA_KEY,
  PSP_NAME,
  REQUIRED_ACTION,
  RESUME_HINT,
  STRIPE_PAYMENT_INTENT_STATUS,
  USER_CHANNEL,
  WEBHOOK,
} from '../constants.js';

export type StripeAdapterConfig = {
  readonly secretKey: string;
  readonly webhookSecret?: string;
  /** Injected Stripe client (tests). */
  readonly stripe?: Stripe;
};

function minorUnits(value: string): number {
  const [whole, frac = ''] = value.split('.');
  const cents = (frac + '00').slice(0, 2);
  return Number(whole) * 100 + Number(cents);
}

function mapStripeStatus(intent: Stripe.PaymentIntent): PSPPaymentResult['status'] {
  switch (intent.status) {
    case STRIPE_PAYMENT_INTENT_STATUS.SUCCEEDED:
      return INTENT_STATE.SUCCEEDED;
    case STRIPE_PAYMENT_INTENT_STATUS.CANCELED:
      return INTENT_STATE.FAILED;
    case STRIPE_PAYMENT_INTENT_STATUS.REQUIRES_ACTION:
    case STRIPE_PAYMENT_INTENT_STATUS.REQUIRES_CONFIRMATION:
      return INTENT_STATE.PENDING_USER_ACTION;
    case STRIPE_PAYMENT_INTENT_STATUS.PROCESSING:
      return INTENT_STATE.EXECUTING;
    default:
      return INTENT_STATE.EXECUTING;
  }
}

function toResult(intent: Stripe.PaymentIntent): PSPPaymentResult {
  const status = mapStripeStatus(intent);
  const base: PSPPaymentResult = {
    pspPaymentId: intent.id,
    status,
    clientSecret: intent.client_secret ?? undefined,
    raw: intent,
  };

  if (status === INTENT_STATE.PENDING_USER_ACTION) {
    const dppIntentId = intent.metadata?.[METADATA_KEY.DPP_INTENT_ID] ?? intent.id;
    return {
      ...base,
      escalation: {
        escalationId: `${ESCALATION_ID_PREFIX.STRIPE}${intent.id}`,
        intentId: dppIntentId,
        status: INTENT_STATE.PENDING_USER_ACTION,
        requiredAction: REQUIRED_ACTION.THREE_DS,
        userChannel: USER_CHANNEL.CARD_ISSUER,
        expiresAt: new Date(Date.now() + ESCALATION_TTL_MS).toISOString(),
        resumeHint: RESUME_HINT.WEBHOOK,
      },
    };
  }

  return base;
}

async function loadStripe(config: StripeAdapterConfig): Promise<Stripe> {
  if (config.stripe) return config.stripe;
  try {
    const mod = await import('stripe');
    return new mod.default(config.secretKey);
  } catch {
    throw new DPPError(
      DPP_ERROR_CODE.PSP_NOT_CONFIGURED,
      'Install the optional peer dependency `stripe` to use StripeAdapter',
    );
  }
}

export class StripeAdapter implements PSPAdapter {
  readonly name = PSP_NAME.STRIPE;
  private readonly stripe: Promise<Stripe>;
  private readonly webhookSecret?: string;

  constructor(config: StripeAdapterConfig) {
    this.stripe = loadStripe(config);
    this.webhookSecret = config.webhookSecret;
  }

  async createPayment(params: CreatePaymentParams): Promise<PSPPaymentResult> {
    const stripe = await this.stripe;
    const pi = params.paymentIntent;

    const intent = await stripe.paymentIntents.create(
      {
        amount: minorUnits(pi.amount.value),
        currency: pi.amount.currency.toLowerCase(),
        metadata: {
          [METADATA_KEY.DPP_INTENT_ID]: pi.intentId,
          [METADATA_KEY.DPP_IDEMPOTENCY_KEY]: pi.idempotencyKey,
          ...params.metadata,
        },
        automatic_payment_methods: { enabled: true },
      },
      { idempotencyKey: params.idempotencyKey },
    );

    return toResult(intent);
  }

  async confirmPayment(pspPaymentId: string): Promise<PSPPaymentResult> {
    const stripe = await this.stripe;
    const intent = await stripe.paymentIntents.retrieve(pspPaymentId);
    return toResult(intent);
  }

  async getPaymentStatus(pspPaymentId: string): Promise<PSPPaymentResult> {
    return this.confirmPayment(pspPaymentId);
  }

  async cancelPayment(pspPaymentId: string): Promise<void> {
    const stripe = await this.stripe;
    await stripe.paymentIntents.cancel(pspPaymentId);
  }

  async parseWebhook(payload: Buffer, signature: string): Promise<WebhookEvent> {
    if (!this.webhookSecret) {
      throw new DPPError(DPP_ERROR_CODE.PSP_ERROR, 'Stripe webhookSecret is required to parse webhooks');
    }
    const stripe = await this.stripe;
    const event = stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);

    if (event.type.startsWith(WEBHOOK.STRIPE_PAYMENT_INTENT_PREFIX)) {
      const intent = event.data.object as Stripe.PaymentIntent;
      const mapped = toResult(intent);
      return {
        type: event.type,
        pspPaymentId: intent.id,
        status: mapped.status,
        intentId: intent.metadata?.[METADATA_KEY.DPP_INTENT_ID],
      };
    }

    return {
      type: event.type,
      pspPaymentId: WEBHOOK.UNKNOWN_PSP_PAYMENT_ID,
      status: INTENT_STATE.EXECUTING,
    };
  }
}
