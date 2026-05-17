import type { McpPaymentConfig } from '../types.js';
import type { DelegationPolicy } from './types.js';

const DEFAULT_PREVIEW_MAX_AGE_SECONDS = 300;

export function defaultDelegationPolicy(config: McpPaymentConfig): DelegationPolicy {
  return loadDelegationPolicyFromConfig(config);
}

export function loadDelegationPolicyFromConfig(config: McpPaymentConfig): DelegationPolicy {
  const policy = config.policy;
  return {
    maxAmount: policy.maxAmount,
    merchantAllowlist: policy.merchantAllowlist,
    paymentMethods: policy.paymentMethods,
    previewMaxAgeSeconds: policy.previewMaxAgeSeconds,
  };
}

export function buildPolicyFromEnv(input: {
  defaultMerchantId: string;
  maxAmountValue?: string;
  maxAmountCurrency?: string;
  merchantAllowlist?: string;
  paymentMethods?: string;
  previewMaxAgeSeconds?: string;
}): DelegationPolicy {
  const merchants = (input.merchantAllowlist ?? input.defaultMerchantId)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  const paymentMethods = (input.paymentMethods ?? 'card')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  const previewMaxAgeSeconds = Number(input.previewMaxAgeSeconds ?? DEFAULT_PREVIEW_MAX_AGE_SECONDS);

  return {
    maxAmount: {
      value: input.maxAmountValue ?? '25.00',
      currency: input.maxAmountCurrency ?? 'USD',
    },
    merchantAllowlist: merchants.length > 0 ? merchants : [input.defaultMerchantId],
    paymentMethods,
    previewMaxAgeSeconds:
      Number.isFinite(previewMaxAgeSeconds) && previewMaxAgeSeconds > 0
        ? previewMaxAgeSeconds
        : DEFAULT_PREVIEW_MAX_AGE_SECONDS,
  };
}
