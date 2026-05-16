import type { PaymentIntentPayload } from '../types.js';
import type { IntentState } from '../core/state-machine.js';

export type PaymentStatus = IntentState;

export type EscalationHandle = {
  readonly escalationId: string;
  readonly intentId: string;
  readonly status: 'pending_user_action';
  readonly requiredAction: 'otp' | 'sca' | 'approval' | '3ds';
  readonly userChannel: string;
  readonly expiresAt: string;
  readonly resumeHint: 'poll_intent' | 'webhook';
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
