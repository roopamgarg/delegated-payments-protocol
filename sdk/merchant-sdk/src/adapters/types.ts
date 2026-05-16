import type { PaymentIntentPayload } from '../types.js';
import type { IntentState } from '../constants.js';
import {
  INTENT_STATE,
  type RequiredAction,
  type ResumeHint,
} from '../constants.js';

export type PaymentStatus = IntentState;

export type EscalationHandle = {
  readonly escalationId: string;
  readonly intentId: string;
  readonly status: typeof INTENT_STATE.PENDING_USER_ACTION;
  readonly requiredAction: RequiredAction;
  readonly userChannel: string;
  readonly expiresAt: string;
  readonly resumeHint: ResumeHint;
};

export type PSPPaymentResult = {
  readonly pspPaymentId: string;
  readonly status: PaymentStatus;
  readonly escalation?: EscalationHandle;
  readonly clientSecret?: string;
  readonly raw?: unknown;
};

export type CreatePaymentParams = {
  readonly paymentIntent: PaymentIntentPayload;
  readonly idempotencyKey: string;
  readonly metadata?: Readonly<Record<string, string>>;
};

export type WebhookEvent = {
  readonly type: string;
  readonly pspPaymentId: string;
  readonly status: PaymentStatus;
  readonly intentId?: string;
};

export interface PSPAdapter {
  readonly name: string;
  createPayment(params: CreatePaymentParams): Promise<PSPPaymentResult>;
  confirmPayment(pspPaymentId: string): Promise<PSPPaymentResult>;
  parseWebhook(payload: Buffer, signature: string): Promise<WebhookEvent>;
  getPaymentStatus(pspPaymentId: string): Promise<PSPPaymentResult>;
  cancelPayment(pspPaymentId: string): Promise<void>;
}
