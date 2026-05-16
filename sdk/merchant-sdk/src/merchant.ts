import type { PaymentIntentPayload } from './types.js';
import type { PSPAdapter, PSPPaymentResult } from './adapters/types.js';
import { StripeAdapter, type StripeAdapterConfig } from './adapters/stripe.js';
import { RazorpayAdapter, type RazorpayAdapterConfig } from './adapters/razorpay.js';
import { validateDelegation, type ValidateDelegationResult } from './core/token-validator.js';
import type { JwsTrustConfig } from './crypto/jws.js';
import { transition, type IntentState } from './core/state-machine.js';
import { DPPError } from './errors.js';

export type DPPMerchantConfig =
  | {
      readonly psp: 'stripe';
      readonly trust: JwsTrustConfig;
      readonly credentials: StripeAdapterConfig;
    }
  | {
      readonly psp: 'razorpay';
      readonly trust: JwsTrustConfig;
      readonly credentials: RazorpayAdapterConfig;
    };

export type ProcessPaymentInput = {
  readonly capabilityToken: string;
  readonly paymentIntent: PaymentIntentPayload;
  readonly metadata?: Readonly<Record<string, string>>;
};

export type ProcessPaymentResult = {
  readonly status: IntentState;
  readonly delegation: ValidateDelegationResult;
  readonly psp: PSPPaymentResult;
  readonly escalation?: PSPPaymentResult['escalation'];
};

export type AuditLogEntry = {
  readonly ts: string;
  readonly event: string;
  readonly intentId?: string;
  readonly details?: Readonly<Record<string, unknown>>;
};

export type AuditLogger = (entry: AuditLogEntry) => void;

const defaultAuditLogger: AuditLogger = (entry) => {
  if (process.env.DPP_AUDIT_LOG === '1') {
    console.info(JSON.stringify(entry));
  }
};

export class DPPMerchant {
  private readonly adapter: PSPAdapter;
  private readonly trust: JwsTrustConfig;
  private readonly audit: AuditLogger;

  constructor(config: DPPMerchantConfig, auditLogger: AuditLogger = defaultAuditLogger) {
    this.trust = config.trust;
    this.audit = auditLogger;
    this.adapter =
      config.psp === 'stripe'
        ? new StripeAdapter(config.credentials)
        : new RazorpayAdapter(config.credentials);
  }

  async verify(input: ProcessPaymentInput): Promise<ValidateDelegationResult> {
    return validateDelegation({
      capabilityToken: input.capabilityToken,
      paymentIntent: input.paymentIntent,
      trust: this.trust,
    });
  }

  async processPayment(input: ProcessPaymentInput): Promise<ProcessPaymentResult> {
    let state: IntentState = 'created';
    const { paymentIntent } = input;

    this.audit({
      ts: new Date().toISOString(),
      event: 'payment.submit',
      intentId: paymentIntent.intentId,
    });

    ({ state } = transition(state, 'submit'));

    let delegation: ValidateDelegationResult;
    try {
      delegation = await this.verify(input);
      ({ state } = transition(state, 'validation_passed'));
    } catch (err) {
      ({ state } = transition(state, 'validation_failed'));
      throw err;
    }

    const psp = await this.adapter.createPayment({
      paymentIntent,
      idempotencyKey: paymentIntent.idempotencyKey,
      metadata: input.metadata,
    });

    if (psp.status === 'pending_user_action') {
      ({ state } = transition('executing', 'rail_requires_action'));
      this.audit({
        ts: new Date().toISOString(),
        event: 'payment.escalation',
        intentId: paymentIntent.intentId,
        details: { escalationId: psp.escalation?.escalationId },
      });
    } else if (psp.status === 'succeeded') {
      ({ state } = transition('executing', 'rail_succeeded'));
    } else if (psp.status === 'failed') {
      ({ state } = transition('executing', 'rail_failed'));
    } else {
      state = psp.status;
    }

    return {
      status: state,
      delegation,
      psp,
      escalation: psp.escalation,
    };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const event = await this.adapter.parseWebhook(payload, signature);
    this.audit({
      ts: new Date().toISOString(),
      event: `webhook.${event.type}`,
      intentId: event.intentId,
      details: { pspPaymentId: event.pspPaymentId, status: event.status },
    });
    return event;
  }

  async getStatus(pspPaymentId: string): Promise<PSPPaymentResult> {
    return this.adapter.getPaymentStatus(pspPaymentId);
  }
}

export function createMerchant(config: DPPMerchantConfig, auditLogger?: AuditLogger): DPPMerchant {
  if (!config.trust.jwksUri && !config.trust.jwks) {
    throw new DPPError('invalid_token', 'DPPMerchant requires trust.jwksUri or trust.jwks');
  }
  return new DPPMerchant(config, auditLogger);
}
