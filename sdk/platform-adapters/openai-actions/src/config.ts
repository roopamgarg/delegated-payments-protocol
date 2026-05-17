import type { McpPaymentConfig } from 'dpp-mcp-payment-tool';
import { loadConfigFromEnv as loadMcpConfigFromEnv } from 'dpp-mcp-payment-tool';

function envOptional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export type OpenAiActionsConfig = {
  readonly mcp: McpPaymentConfig;
  readonly actionsPort: number;
  readonly actionsApiKey: string;
  readonly publicBaseUrl: string;
};

/** Actions adapter config: MCP payment stack + ChatGPT-facing HTTP settings. */
export function loadActionsConfigFromEnv(): OpenAiActionsConfig {
  const actionsPort = Number(envOptional('DPP_ACTIONS_PORT', '8780'));
  const publicBaseUrl = envOptional('DPP_ACTIONS_PUBLIC_URL', `http://127.0.0.1:${actionsPort}`).replace(
    /\/$/,
    '',
  );

  if (!process.env.DPP_OAUTH_CALLBACK_HOST) {
    process.env.DPP_OAUTH_CALLBACK_HOST = '127.0.0.1';
  }
  if (!process.env.DPP_OAUTH_CALLBACK_PORT) {
    process.env.DPP_OAUTH_CALLBACK_PORT = '8765';
  }
  const oauthCbHost = process.env.DPP_OAUTH_CALLBACK_HOST;
  const oauthCbPort = process.env.DPP_OAUTH_CALLBACK_PORT;
  if (!process.env.DPP_OAUTH_REDIRECT_URI) {
    process.env.DPP_OAUTH_REDIRECT_URI = `http://${oauthCbHost}:${oauthCbPort}/oauth/callback`;
  }

  const actionsApiKey = process.env.DPP_ACTIONS_API_KEY;
  if (!actionsApiKey) {
    throw new Error('Missing required environment variable: DPP_ACTIONS_API_KEY');
  }

  return {
    mcp: loadMcpConfigFromEnv(),
    actionsPort,
    actionsApiKey,
    publicBaseUrl,
  };
}
