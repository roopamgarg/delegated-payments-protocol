import type { PaymentIntentPayload } from './types.js';
import type { PSPAdapter, PSPPaymentResult } from './adapters/types.js';
import { StripeAdapter, type StripeAdapterConfig } from './adapters/stripe.js';
import { RazorpayAdapter, type RazorpayAdapterConfig } from './adapters/razorpay.js';
import { validateDelegation, type ValidateDelegationResult } from './core/token-validator.js';
import type { JwsTrustConfig } from './crypto/jws.js';
import { transition } from './core/state-machine.js';
import { DPPError } from './errors.js';
import {
  AUDIT_EVENT,
  DPP_ERROR_CODE,
  ENV,
  INTENT_EVENT,
  INTENT_STATE,
  PSP_NAME,
  type IntentState,
} from './constants.js';

export type DPPMerchantConfig =
  | {
      readonly psp: typeof PSP_NAME.STRIPE;
      readonly trust: JwsTrustConfig;
      readonly credentials: StripeAdapterConfig;
    }
  | {
      readonly psp: typeof PSP_NAME.RAZORPAY;
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
  if (process.env[ENV.AUDIT_LOG] === ENV.AUDIT_LOG_ENABLED) {
    console.info(JSON.stringify(entry));
  }
};

function adapterFor(config: DPPMerchantConfig): PSPAdapter {
  if (config.psp === PSP_NAME.STRIPE) {
    return new StripeAdapter(config.credentials);
  }
  return new RazorpayAdapter(config.credentials);
}

export class DPPMerchant {
  private readonly adapter: PSPAdapter;
  private readonly trust: JwsTrustConfig;
  private readonly audit: AuditLogger;

  constructor(config: DPPMerchantConfig, auditLogger: AuditLogger = defaultAuditLogger) {
    this.trust = config.trust;
    this.audit = auditLogger;
    this.adapter = adapterFor(config);
  }

  async verify(input: ProcessPaymentInput): Promise<ValidateDelegationResult> {
    return validateDelegation({
      capabilityToken: input.capabilityToken,
      paymentIntent: input.paymentIntent,
      trust: this.trust,
    });
  }

  async processPayment(input: ProcessPaymentInput): Promise<ProcessPaymentResult> {
    let state: IntentState = INTENT_STATE.CREATED;
    const { paymentIntent } = input;

    this.audit({
      ts: new Date().toISOString(),
      event: AUDIT_EVENT.PAYMENT_SUBMIT,
      intentId: paymentIntent.intentId,
    });

    ({ state } = transition(state, INTENT_EVENT.SUBMIT));

    let delegation: ValidateDelegationResult;
    try {
      delegation = await this.verify(input);
      ({ state } = transition(state, INTENT_EVENT.VALIDATION_PASSED));
    } catch (err) {
      ({ state } = transition(state, INTENT_EVENT.VALIDATION_FAILED));
      throw err;
    }

    const psp = await this.adapter.createPayment({
      paymentIntent,
      idempotencyKey: paymentIntent.idempotencyKey,
      metadata: input.metadata,
    });

    if (psp.status === INTENT_STATE.PENDING_USER_ACTION) {
      ({ state } = transition(INTENT_STATE.EXECUTING, INTENT_EVENT.RAIL_REQUIRES_ACTION));
      this.audit({
        ts: new Date().toISOString(),
        event: AUDIT_EVENT.PAYMENT_ESCALATION,
        intentId: paymentIntent.intentId,
        details: { escalationId: psp.escalation?.escalationId },
      });
    } else if (psp.status === INTENT_STATE.SUCCEEDED) {
      ({ state } = transition(INTENT_STATE.EXECUTING, INTENT_EVENT.RAIL_SUCCEEDED));
    } else if (psp.status === INTENT_STATE.FAILED) {
      ({ state } = transition(INTENT_STATE.EXECUTING, INTENT_EVENT.RAIL_FAILED));
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
    throw new DPPError(DPP_ERROR_CODE.INVALID_TOKEN, 'DPPMerchant requires trust.jwksUri or trust.jwks');
  }
  return new DPPMerchant(config, auditLogger);
}
