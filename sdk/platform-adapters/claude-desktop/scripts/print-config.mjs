#!/usr/bin/env node
import { accessSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const adapterRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mcpBin = path.resolve(adapterRoot, '../../mcp-payment-tool/dist/bin/dpp-mcp-payment.js');
accessSync(mcpBin);

console.log(JSON.stringify({
  mcpServers: {
    'dpp-payments': {
      command: process.execPath,
      args: [mcpBin],
      env: {
        DPP_VAULT_MASTER_KEY: '<openssl rand -base64 32>',
        DPP_OAUTH_CLIENT_ID: '<wallet POST /v1/agents>',
        DPP_MCP_AGENT_SUB: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGJpnn5uSiZuNR',
        DPP_WALLET_BASE_URL: 'http://127.0.0.1:3350',
        DPP_MERCHANT_BASE_URL: 'http://127.0.0.1:3340',
      },
    },
  },
}, null, 2));
