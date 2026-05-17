import { randomUUID } from 'node:crypto';
import { createAgentVault, type AgentVault } from 'dpp-agent-vault';
import { defaultDelegationPolicy } from './policy/defaults.js';
import type { DelegationPolicy } from './policy/types.js';
import type { McpPaymentConfig, PaymentPreviewRecord } from './types.js';

export class McpPaymentSession {
  readonly config: McpPaymentConfig;
  readonly vault: AgentVault;
  readonly #previews = new Map<string, PaymentPreviewRecord>();
  readonly #paymentsByPreview = new Map<string, string>();
  readonly #delegationPolicies = new Map<string, DelegationPolicy>();

  constructor(config: McpPaymentConfig) {
    this.config = config;
    this.vault = createAgentVault({ masterKey: config.vaultMasterKey });
  }

  get sessionUserId(): string {
    return this.config.sessionUserId;
  }

  createPreviewId(): string {
    return `prev_${randomUUID().replace(/-/g, '')}`;
  }

  savePreview(record: PaymentPreviewRecord): void {
    this.#previews.set(record.previewId, record);
  }

  getPreview(previewId: string): PaymentPreviewRecord | undefined {
    return this.#previews.get(previewId);
  }

  deletePreview(previewId: string): void {
    this.#previews.delete(previewId);
  }

  rememberPayment(previewId: string, pspPaymentId: string): void {
    this.#paymentsByPreview.set(previewId, pspPaymentId);
  }

  getPaymentIdForPreview(previewId: string): string | undefined {
    return this.#paymentsByPreview.get(previewId);
  }

  bindDelegationPolicy(delegationId: string, policy?: DelegationPolicy): void {
    this.#delegationPolicies.set(delegationId, policy ?? defaultDelegationPolicy(this.config));
  }

  getDelegationPolicy(delegationId: string): DelegationPolicy | undefined {
    return this.#delegationPolicies.get(delegationId);
  }
}
