import assert from 'node:assert';
import test from 'node:test';

import { createActionsAuthMiddleware } from '../dist/auth.js';

const stubConfig = {
  actionsApiKey: 'integration-test-key',
  actionsPort: 8780,
  publicBaseUrl: 'http://127.0.0.1:8780',
  mcp: {},
};

function captureRes() {
  return {
    statusCode: undefined,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
}

test('Actions auth rejects invalid API key', () => {
  const mw = createActionsAuthMiddleware(stubConfig);
  const req = { headers: { authorization: 'Bearer wrong-key' }, body: {} };
  let nextCalled = false;
  const res = captureRes();
  mw(
    req,
    res,
    () => {
      nextCalled = true;
    },
  );
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 401);
  assert.strictEqual(res.body?.code, 'unauthorized');
});

test('Actions auth rejects missing user id', () => {
  const mw = createActionsAuthMiddleware(stubConfig);
  const req = { headers: { authorization: 'Bearer integration-test-key' }, body: {} };
  let nextCalled = false;
  const res = captureRes();
  mw(
    req,
    res,
    () => {
      nextCalled = true;
    },
  );
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body?.code, 'missing_user_id');
});

test('Actions auth accepts API key plus userId in JSON body', () => {
  const mw = createActionsAuthMiddleware(stubConfig);
  const req = {
    headers: { 'x-api-key': 'integration-test-key' },
    body: { userId: 'user:alice-demo' },
  };
  const res = captureRes();
  let nextCalls = 0;
  mw(req, res, () => {
    nextCalls += 1;
    assert.strictEqual(req.dppUserId, 'user:alice-demo');
  });
  assert.strictEqual(nextCalls, 1);
});
