import { createServer, type Server } from 'node:http';
import type { McpPaymentConfig } from './types.js';

export type OAuthCallbackResult = {
  readonly code: string;
  readonly state: string;
};

type PendingOAuth = {
  readonly codeVerifier: string;
  readonly userId: string;
  readonly resolve: (result: OAuthCallbackResult) => void;
  readonly reject: (err: Error) => void;
};

const pendingByState = new Map<string, PendingOAuth>();
let callbackServer: Server | undefined;
let listenPromise: Promise<void> | undefined;

export function registerPendingOAuth(
  state: string,
  entry: Omit<PendingOAuth, 'resolve' | 'reject'>,
): Promise<OAuthCallbackResult> {
  return new Promise((resolve, reject) => {
    pendingByState.set(state, { ...entry, resolve, reject });
  });
}

export function consumePendingVerifier(state: string): string | undefined {
  const pending = pendingByState.get(state);
  return pending?.codeVerifier;
}

export function clearPendingOAuth(state: string): void {
  pendingByState.delete(state);
}

export async function ensureOAuthCallbackServer(config: McpPaymentConfig): Promise<void> {
  if (listenPromise) {
    await listenPromise;
    return;
  }

  const { oauthCallbackHost, oauthCallbackPort } = config;

  callbackServer = createServer((req, res) => {
    try {
      const url = new URL(req.url ?? '/', `http://${oauthCallbackHost}:${oauthCallbackPort}`);
      if (url.pathname !== '/oauth/callback') {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('Not found');
        return;
      }

      const error = url.searchParams.get('error');
      const state = url.searchParams.get('state') ?? '';
      const pending = pendingByState.get(state);

      if (error) {
        pending?.reject(new Error(`OAuth denied: ${error}`));
        clearPendingOAuth(state);
        res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<h1>Wallet link denied</h1><p>You may close this window.</p>');
        return;
      }

      const code = url.searchParams.get('code');
      if (!code || !pending) {
        res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' });
        res.end('<h1>Invalid callback</h1><p>Missing code or unknown state.</p>');
        return;
      }

      pending.resolve({ code, state });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end('<h1>Wallet linked</h1><p>Return to your agent. You may close this window.</p>');
    } catch (err) {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end('Internal error');
      console.error('OAuth callback error', err);
    }
  });

  listenPromise = new Promise((resolve, reject) => {
    callbackServer!.listen(oauthCallbackPort, oauthCallbackHost, () => resolve());
    callbackServer!.on('error', reject);
  });

  await listenPromise;
}

export async function closeOAuthCallbackServer(): Promise<void> {
  if (!callbackServer) return;
  await new Promise<void>((resolve, reject) => {
    callbackServer!.close((err) => (err ? reject(err) : resolve()));
  });
  callbackServer = undefined;
  listenPromise = undefined;
}
