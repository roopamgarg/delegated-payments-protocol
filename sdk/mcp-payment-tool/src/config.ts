import type { McpPaymentConfig } from './types.js';

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function envOptional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

/** Load MCP payment server config from environment (demo defaults for local stack). */
export function loadConfigFromEnv(): McpPaymentConfig {
  const walletBaseUrl = envOptional('DPP_WALLET_BASE_URL', 'http://127.0.0.1:3350');
  const merchantBaseUrl = envOptional('DPP_MERCHANT_BASE_URL', 'http://127.0.0.1:3340');
  const walletIssuer = envOptional('DPP_WALLET_ISSUER', `${walletBaseUrl.replace(/\/$/, '')}/issuer`);

  return {
    walletBaseUrl: walletBaseUrl.replace(/\/$/, ''),
    merchantBaseUrl: merchantBaseUrl.replace(/\/$/, ''),
    walletIssuer,
    oauth: {
      clientId: env('DPP_OAUTH_CLIENT_ID'),
      agentSub: env('DPP_MCP_AGENT_SUB'),
      redirectUri: envOptional('DPP_OAUTH_REDIRECT_URI', 'http://127.0.0.1:8765/oauth/callback'),
      scopes: envOptional(
        'DPP_OAUTH_SCOPES',
        'dpp:delegation:read dpp:delegation:issue',
      ).split(/\s+/),
    },
    vaultMasterKey: env('DPP_VAULT_MASTER_KEY'),
    defaultMerchantId: envOptional('DPP_DEFAULT_MERCHANT_ID', 'merchant:example_com'),
    oauthCallbackHost: envOptional('DPP_OAUTH_CALLBACK_HOST', '127.0.0.1'),
    oauthCallbackPort: Number(envOptional('DPP_OAUTH_CALLBACK_PORT', '8765')),
  };
}
