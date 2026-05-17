#!/usr/bin/env node
import { loadActionsConfigFromEnv, listenOpenAiActions } from '../index.js';

const config = loadActionsConfigFromEnv();
await listenOpenAiActions(config);
