#!/usr/bin/env node
import { loadConfigFromEnv, runMcpPaymentStdio } from 'dpp-mcp-payment-tool';

const config = loadConfigFromEnv();
await runMcpPaymentStdio(config);
