import express from 'express';
import * as jose from 'jose';
import {
  createWalletIssuer,
  DPPError,
  DPP_OAUTH_SCOPE,
  issueAuthorizationCode,
} from 'dpp-wallet-sdk';
import { demoAgentProfile, sampleCapabilityInput, samplePaymentIntent } from './fixtures.mjs';
import { cancelDemoIntent, getDemoIntent, submitDemoIntent } from './demo-intent-store.mjs';

const PORT = Number(process.env.PORT ?? 3350);
const ISSUER = process.env.DPP_ISSUER ?? `https://127.0.0.1:${PORT}/issuer`;
const DEMO_USER_ID = process.env.DPP_DEMO_USER_ID ?? 'user_demo_01';
const OPERATOR_TOKEN = process.env.DPP_OPERATOR_TOKEN ?? 'dev-operator-token';
const AGENT_REGISTRATION_ENABLED = process.env.DPP_AGENT_REGISTRATION !== '0';

let wallet;
let registeredAgent;

async function bootstrap() {
  const { privateKey } = await jose.generateKeyPair('ES256', { extractable: true });
  const privateJwk = await jose.exportJWK(privateKey);

  wallet = createWalletIssuer({
    issuer: ISSUER,
    signingKey: {
      type: 'local',
      kid: 'demo-wallet-key',
      privateJwk: { ...privateJwk, alg: 'ES256', use: 'sig' },
    },
    defaultCapabilityTtlSeconds: 600,
  });

  registeredAgent = await wallet.registerAgent(demoAgentProfile(PORT));
}

function requireOperator(req, res) {
  const auth = req.headers.authorization ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== OPERATOR_TOKEN) {
    res.status(401).json({ error: 'unauthorized', message: 'Operator Bearer token required' });
    return false;
  }
  return true;
}

function sendDppError(res, err) {
  if (err instanceof DPPError) {
    const status =
      err.code === 'oauth_error' || err.code === 'agent_not_registered'
        ? 400
        : err.code === 'delegation_revoked'
          ? 403
          : err.code === 'intent_not_found'
            ? 404
            : err.code === 'invalid_state_transition'
              ? 409
              : 500;
    res.status(status).json({ error: err.code, message: err.message, details: err.details });
    return;
  }
  if (err?.code === 'invalid_request') {
    res.status(400).json({ error: err.code, message: err.message });
    return;
  }
  if (err?.code === 'intent_not_found') {
    res.status(404).json({ error: err.code, message: err.message });
    return;
  }
  if (err?.code === 'invalid_state_transition') {
    res.status(409).json({ error: err.code, message: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'internal_error' });
}

function issuerOrigin() {
  return new URL(ISSUER).origin;
}

function oauthMetadata() {
  const origin = issuerOrigin();
  return {
    issuer: ISSUER,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    code_challenge_methods_supported: ['S256'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    response_types_supported: ['code'],
    scopes_supported: Object.values(DPP_OAUTH_SCOPE),
  };
}

function parseOAuthAuthorizeQuery(query) {
  const scope = (query.scope ?? '').split(' ').filter(Boolean);
  return {
    clientId: query.client_id,
    redirectUri: query.redirect_uri,
    scope,
    state: query.state,
    codeChallenge: query.code_challenge,
    codeChallengeMethod: query.code_challenge_method,
    agentSub: query.dpp_agent_sub,
    resource: query.resource,
  };
}

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, issuer: ISSUER, agentSub: registeredAgent?.sub });
});

app.get('/.well-known/jwks.json', async (_req, res) => {
  try {
    const jwks = await wallet.exportJwks();
    res.json(jwks);
  } catch (err) {
    sendDppError(res, err);
  }
});

app.get('/.well-known/oauth-authorization-server', (_req, res) => {
  res.json(oauthMetadata());
});

app.get('/oauth/authorize', async (req, res) => {
  try {
    const request = parseOAuthAuthorizeQuery(req.query);
    const { url } = await wallet.createAuthorizationUrl(request);

    if (req.accepts('html') && process.env.DPP_DEMO_AUTO_CONSENT !== '1') {
      res.type('html').send(`<!DOCTYPE html>
<html><body>
  <h1>DPP wallet demo — link agent</h1>
  <p>Agent: <code>${request.agentSub ?? ''}</code></p>
  <form method="post" action="/demo/oauth/consent">
    <input type="hidden" name="client_id" value="${request.clientId ?? ''}" />
    <input type="hidden" name="redirect_uri" value="${request.redirectUri ?? ''}" />
    <input type="hidden" name="scope" value="${request.scope.join(' ')}" />
    <input type="hidden" name="state" value="${request.state ?? ''}" />
    <input type="hidden" name="code_challenge" value="${request.codeChallenge ?? ''}" />
    <input type="hidden" name="code_challenge_method" value="${request.codeChallengeMethod ?? 'S256'}" />
    <input type="hidden" name="dpp_agent_sub" value="${request.agentSub ?? ''}" />
    <button type="submit">Approve delegation (demo)</button>
  </form>
  <p>Authorize URL (SDK): <a href="${url}">${url}</a></p>
</body></html>`);
      return;
    }

    const { code } = await issueAuthorizationCode(wallet, {
      clientId: request.clientId,
      redirectUri: request.redirectUri,
      agentSub: request.agentSub,
      scope: request.scope,
      state: request.state,
      codeChallenge: request.codeChallenge,
      codeChallengeMethod: 'S256',
      userId: DEMO_USER_ID,
    });

    const redirect = new URL(request.redirectUri);
    redirect.searchParams.set('code', code);
    redirect.searchParams.set('state', request.state);
    res.redirect(302, redirect.toString());
  } catch (err) {
    sendDppError(res, err);
  }
});

app.post('/demo/oauth/consent', express.urlencoded({ extended: false }), async (req, res) => {
  try {
    const scope = (req.body.scope ?? '').split(' ').filter(Boolean);
    const { code } = await issueAuthorizationCode(wallet, {
      clientId: req.body.client_id,
      redirectUri: req.body.redirect_uri,
      agentSub: req.body.dpp_agent_sub,
      scope,
      state: req.body.state,
      codeChallenge: req.body.code_challenge,
      codeChallengeMethod: 'S256',
      userId: DEMO_USER_ID,
    });
    const redirect = new URL(req.body.redirect_uri);
    redirect.searchParams.set('code', code);
    redirect.searchParams.set('state', req.body.state);
    res.redirect(302, redirect.toString());
  } catch (err) {
    sendDppError(res, err);
  }
});

app.post('/oauth/token', async (req, res) => {
  try {
    const grantType = req.body.grant_type;
    if (grantType !== 'authorization_code') {
      res.status(400).json({ error: 'unsupported_grant_type' });
      return;
    }

    const tokens = await wallet.exchangeCode({
      code: req.body.code,
      redirectUri: req.body.redirect_uri,
      codeVerifier: req.body.code_verifier,
      clientId: req.body.client_id,
    });

    res.json({
      access_token: tokens.accessToken,
      token_type: tokens.tokenType,
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: tokens.scope,
      dpp_delegation_id: tokens.delegationId,
      dpp_agent_sub: registeredAgent.sub,
    });
  } catch (err) {
    sendDppError(res, err);
  }
});

app.post('/oauth/revoke', async (req, res) => {
  try {
    await wallet.revokeDelegation(DEMO_USER_ID, registeredAgent.sub);
    res.status(200).end();
  } catch (err) {
    sendDppError(res, err);
  }
});

app.post('/v1/agents', async (req, res) => {
  if (!AGENT_REGISTRATION_ENABLED) {
    res.status(404).json({ error: 'not_found', message: 'Agent registration is disabled' });
    return;
  }
  if (!requireOperator(req, res)) return;
  try {
    const profile = await wallet.registerAgent(req.body);
    res.status(201).json({
      agentId: profile.sub,
      clientId: profile.clientId ?? req.body.clientId,
      agentSub: profile.sub,
      status: 'active',
    });
  } catch (err) {
    sendDppError(res, err);
  }
});

app.post('/demo/capability', async (_req, res) => {
  try {
    const issued = await wallet.issueCapability(
      sampleCapabilityInput(registeredAgent.sub),
    );
    res.json({
      capabilityToken: issued.compactJws,
      expiresAt: issued.expiresAt,
      paymentIntent: samplePaymentIntent(),
    });
  } catch (err) {
    sendDppError(res, err);
  }
});

app.post('/v1/intents', async (req, res) => {
  try {
    const { paymentIntent, capabilityToken } = req.body ?? {};
    const record = submitDemoIntent({ paymentIntent, capabilityToken });
    res.status(201).json({
      intentId: record.intentId,
      state: record.state,
      paymentIntent: record,
    });
  } catch (err) {
    sendDppError(res, err);
  }
});

app.get('/v1/intents/:intentId', async (req, res) => {
  try {
    const record = getDemoIntent(req.params.intentId);
    res.json({
      intentId: record.intentId,
      state: record.state,
      paymentIntent: record,
    });
  } catch (err) {
    sendDppError(res, err);
  }
});

app.post('/v1/intents/:intentId/cancel', async (req, res) => {
  try {
    cancelDemoIntent(req.params.intentId);
    res.status(204).end();
  } catch (err) {
    sendDppError(res, err);
  }
});

await bootstrap();
app.listen(PORT, () => {
  console.log(`DPP express-wallet-issuer demo listening on http://127.0.0.1:${PORT}`);
  console.log(`Issuer: ${ISSUER}`);
});
