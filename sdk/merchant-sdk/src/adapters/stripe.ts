// Stripe is an optional peer dependency; types come from devDependency at build time.
import type Stripe from 'stripe';
import type { CreatePaymentParams, PSPAdapter, PSPPaymentResult, WebhookEvent } from './types.js';
import { DPPError } from '../errors.js';

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
    case 'succeeded':
      return 'succeeded';
    case 'canceled':
      return 'failed';
    case 'requires_action':
    case 'requires_confirmation':
      return 'pending_user_action';
    case 'processing':
      return 'executing';
    default:
      return 'executing';
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

  if (status === 'pending_user_action') {
    const dppIntentId = intent.metadata?.dppIntentId ?? intent.id;
    return {
      ...base,
      escalation: {
        escalationId: `esc_stripe_${intent.id}`,
        intentId: dppIntentId,
        status: 'pending_user_action',
        requiredAction: '3ds',
        userChannel: 'card_issuer',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        resumeHint: 'webhook',
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
      'psp_not_configured',
      'Install the optional peer dependency `stripe` to use StripeAdapter',
    );
  }
}

export class StripeAdapter implements PSPAdapter {
  readonly name = 'stripe';
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
          dppIntentId: pi.intentId,
          dppIdempotencyKey: pi.idempotencyKey,
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
      throw new DPPError('psp_error', 'Stripe webhookSecret is required to parse webhooks');
    }
    const stripe = await this.stripe;
    const event = stripe.webhooks.constructEvent(payload, signature, this.webhookSecret);

    if (event.type.startsWith('payment_intent.')) {
      const intent = event.data.object as Stripe.PaymentIntent;
      const mapped = toResult(intent);
      return {
        type: event.type,
        pspPaymentId: intent.id,
        status: mapped.status,
        intentId: intent.metadata?.dppIntentId,
      };
    }

    return {
      type: event.type,
      pspPaymentId: 'unknown',
      status: 'executing',
    };
  }
}
