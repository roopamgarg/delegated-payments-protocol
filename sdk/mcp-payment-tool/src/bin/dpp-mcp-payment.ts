#!/usr/bin/env node
import { loadConfigFromEnv } from '../config.js';
import { runMcpPaymentStdio } from '../server.js';

const config = loadConfigFromEnv();
await runMcpPaymentStdio(config);
