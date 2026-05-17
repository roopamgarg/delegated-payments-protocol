import { PAYMENT_RAIL } from 'dpp-wallet-sdk';
import type { McpPaymentConfig } from '../types.js';
import {
  POLICY_DEFAULT_CURRENCY,
  POLICY_DEFAULT_MAX_AMOUNT_VALUE,
  POLICY_DEFAULT_PREVIEW_MAX_AGE_SECONDS,
} from './constants.js';
import type { DelegationPolicy } from './types.js';

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

  const paymentMethods = (input.paymentMethods ?? PAYMENT_RAIL.CARD)
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);

  const previewMaxAgeSeconds = Number(
    input.previewMaxAgeSeconds ?? POLICY_DEFAULT_PREVIEW_MAX_AGE_SECONDS,
  );

  return {
    maxAmount: {
      value: input.maxAmountValue ?? POLICY_DEFAULT_MAX_AMOUNT_VALUE,
      currency: input.maxAmountCurrency ?? POLICY_DEFAULT_CURRENCY,
    },
    merchantAllowlist: merchants.length > 0 ? merchants : [input.defaultMerchantId],
    paymentMethods,
    previewMaxAgeSeconds:
      Number.isFinite(previewMaxAgeSeconds) && previewMaxAgeSeconds > 0
        ? previewMaxAgeSeconds
        : POLICY_DEFAULT_PREVIEW_MAX_AGE_SECONDS,
  };
}
