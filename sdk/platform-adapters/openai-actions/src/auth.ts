import type express from 'express';

import type { OpenAiActionsConfig } from './config.js';

export type AuthenticatedRequest = express.Request & {
  dppUserId: string;
};

function extractBearerToken(req: express.Request): string | undefined {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return undefined;
  return header.slice('Bearer '.length).trim();
}

/**
 * ChatGPT → Actions API gate. Uses a static API key (stored only in GPT builder, not in prompts).
 * User identity for vault partitioning comes from X-DPP-User-Id (set by your IdP integration in production).
 */
export function createActionsAuthMiddleware(config: OpenAiActionsConfig) {
  return (req: AuthenticatedRequest, res: express.Response, next: express.NextFunction): void => {
    const rawKey = extractBearerToken(req) ?? req.headers['x-api-key'];
    const token = typeof rawKey === 'string' ? rawKey : undefined;
    if (!token || token !== config.actionsApiKey) {
      res.status(401).json({
        status: 'error',
        code: 'unauthorized',
        message: 'Invalid or missing Actions API key.',
      });
      return;
    }

    const headerUid = req.headers['x-dpp-user-id'];
    const userIdFromHeader =
      typeof headerUid === 'string'
        ? headerUid
        : Array.isArray(headerUid)
          ? headerUid[0]
          : undefined;
    const body = req.body as { userId?: unknown } | undefined;
    const userIdFromBody =
      body && typeof body.userId === 'string' ? (body.userId as string) : undefined;

    const userId = userIdFromHeader || userIdFromBody;
    if (!userId) {
      res.status(400).json({
        status: 'error',
        code: 'missing_user_id',
        message:
          'Provide X-DPP-User-Id header (production) or userId in body (local demo). ChatGPT must not invent user ids.',
      });
      return;
    }

    req.dppUserId = userId;
    next();
  };
}
