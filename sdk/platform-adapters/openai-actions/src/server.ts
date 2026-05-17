import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import {
  McpPaymentSession,
  handleConfirmPayment,
  handleGetPaymentStatus,
  handleLinkWallet,
  handlePreviewPayment,
} from 'dpp-mcp-payment-tool';

import { createActionsAuthMiddleware, type AuthenticatedRequest } from './auth.js';
import type { OpenAiActionsConfig } from './config.js';

function jsonSafe(payload: unknown, res: express.Response): void {
  res.json(payload);
}

export function createOpenAiActionsApp(config: OpenAiActionsConfig): express.Express {
  const session = new McpPaymentSession(config.mcp);
  const app = express();

  app.use(express.json({ limit: '32kb' }));

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      adapter: 'dpp-openai-actions',
      publicBaseUrl: config.publicBaseUrl,
      walletBaseUrl: config.mcp.walletBaseUrl,
    });
  });

  const openApiPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'openapi.yaml');
  app.get('/openapi.yaml', (_req, res) => {
    res.type('text/yaml').send(readFileSync(openApiPath, 'utf8'));
  });

  const authedMw = createActionsAuthMiddleware(config);
  const v1 = express.Router();
  v1.use(authedMw as express.RequestHandler);

  v1.post('/link-wallet/start', async (req, res) => {
    const { dppUserId } = req as AuthenticatedRequest;
    const waitForCallbackSeconds =
      typeof req.body?.waitForCallbackSeconds === 'number' ? req.body.waitForCallbackSeconds : undefined;
    const result = await handleLinkWallet(session, {
      userId: dppUserId,
      waitForCallbackSeconds,
    });
    jsonSafe(result, res);
  });

  v1.post('/link-wallet/complete', async (req, res) => {
    const { dppUserId } = req as AuthenticatedRequest;
    const authorizationCode =
      typeof req.body?.authorizationCode === 'string' ? req.body.authorizationCode : undefined;
    const state = typeof req.body?.state === 'string' ? req.body.state : undefined;
    if (!authorizationCode || !state) {
      res.status(400).json({
        status: 'error',
        code: 'invalid_request',
        message: 'authorizationCode and state are required.',
      });
      return;
    }
    const result = await handleLinkWallet(session, {
      userId: dppUserId,
      authorizationCode,
      state,
    });
    jsonSafe(result, res);
  });

  v1.post('/payments/preview', async (req, res) => {
    const delegationId = typeof req.body?.delegationId === 'string' ? req.body.delegationId : undefined;
    const amountValue = typeof req.body?.amountValue === 'string' ? req.body.amountValue : undefined;
    const currency = typeof req.body?.currency === 'string' ? req.body.currency : undefined;
    if (!delegationId || !amountValue || !currency) {
      res.status(400).json({
        status: 'error',
        code: 'invalid_request',
        message: 'delegationId, amountValue, and currency are required.',
      });
      return;
    }
    const result = await handlePreviewPayment(session, {
      delegationId,
      amountValue,
      currency,
      merchantId: typeof req.body?.merchantId === 'string' ? req.body.merchantId : undefined,
      rail: typeof req.body?.rail === 'string' ? req.body.rail : undefined,
      idempotencyKey:
        typeof req.body?.idempotencyKey === 'string' ? req.body.idempotencyKey : undefined,
    });
    jsonSafe(result, res);
  });

  v1.post('/payments/confirm', async (req, res) => {
    const previewId = typeof req.body?.previewId === 'string' ? req.body.previewId : undefined;
    if (!previewId) {
      res.status(400).json({
        status: 'error',
        code: 'invalid_request',
        message: 'previewId is required.',
      });
      return;
    }
    const result = await handleConfirmPayment(session, { previewId });
    jsonSafe(result, res);
  });

  v1.get('/payments/status', async (req, res) => {
    const pspPaymentId =
      typeof req.query.pspPaymentId === 'string' ? req.query.pspPaymentId : undefined;
    const previewId = typeof req.query.previewId === 'string' ? req.query.previewId : undefined;
    const result = await handleGetPaymentStatus(session, { pspPaymentId, previewId });
    jsonSafe(result, res);
  });

  app.use('/v1', v1);

  return app;
}

export async function listenOpenAiActions(config: OpenAiActionsConfig): Promise<void> {
  const app = createOpenAiActionsApp(config);
  await new Promise<void>((resolve) => {
    app.listen(config.actionsPort, () => resolve());
  });
  console.error(
    `dpp-openai-actions listening on ${config.publicBaseUrl} (import openapi.yaml in ChatGPT builder)`,
  );
}
