import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ARTIFACT_TYPE,
  computeIntentDigest,
  createWalletIssuer,
  DPP_ERROR_CODE,
  DPP_VERSION,
  DPPError,
  INTENT_EVENT,
  INTENT_STATE,
  PAYMENT_RAIL,
  RAIL_CLASS,
  canTransition,
  transition,
} from '../dist/index.js';

const devConfig = {
  issuer: 'https://wallet.example/issuer',
  signingKey: {
    type: 'local',
    kid: 'dev-1',
    privateJwk: { kty: 'EC', crv: 'P-256', d: 'test' },
  },
};

const baseIntent = {
  intentId: 'pi_01HABC',
  idempotencyKey: 'idem_001',
  amount: { value: '10.00', currency: 'USD' },
  merchantId: 'merchant:example_com',
  rail: PAYMENT_RAIL.CARD,
  railClass: RAIL_CLASS.B,
};

const merchantDigest = 'fa1183e76b890f5cea60ea03d76bd8f2e6f32fee72f47e25669d68ae84b360db';

describe('computeIntentDigest', () => {
  it('matches merchant-sdk verify fixture', () => {
    assert.equal(computeIntentDigest(baseIntent), merchantDigest);
  });
});

describe('intent FSM', () => {
  it('exposes verification-flows transitions', () => {
    assert.equal(canTransition(INTENT_STATE.CREATED, INTENT_EVENT.SUBMIT), true);
    assert.equal(
      transition(INTENT_STATE.EXECUTING, INTENT_EVENT.RAIL_REQUIRES_ACTION).state,
      INTENT_STATE.PENDING_USER_ACTION,
    );
  });

  it('rejects invalid transitions with DPPError', () => {
    assert.throws(
      () => transition(INTENT_STATE.SUCCEEDED, INTENT_EVENT.SUBMIT),
      (err) =>
        err instanceof DPPError && err.code === DPP_ERROR_CODE.INVALID_STATE_TRANSITION,
    );
  });
});

describe('intent lifecycle', () => {
  it('class A submit succeeds without user action', async () => {
    const wallet = createWalletIssuer(devConfig);
    const created = await wallet.createIntent({
      ...baseIntent,
      intentId: 'pi_class_a',
      idempotencyKey: 'idem_a',
      railClass: RAIL_CLASS.A,
    });
    assert.equal(created.state, INTENT_STATE.CREATED);
    assert.equal(created.digest.value, computeIntentDigest(created));

    const submitted = await wallet.submitIntent('pi_class_a');
    assert.equal(submitted.state, INTENT_STATE.SUCCEEDED);
  });

  it('class B submit escalates then resumes', async () => {
    const wallet = createWalletIssuer(devConfig);
    await wallet.createIntent({ ...baseIntent, intentId: 'pi_class_b', idempotencyKey: 'idem_b' });

    const pending = await wallet.submitIntent('pi_class_b');
    assert.equal(pending.state, INTENT_STATE.PENDING_USER_ACTION);

    const done = await wallet.resumeAfterUserAction('pi_class_b');
    assert.equal(done.state, INTENT_STATE.SUCCEEDED);
  });

  it('class C without mandate is rejected', async () => {
    const wallet = createWalletIssuer(devConfig);
    await wallet.createIntent({
      ...baseIntent,
      intentId: 'pi_class_c',
      idempotencyKey: 'idem_c',
      railClass: RAIL_CLASS.C,
    });

    const rejected = await wallet.submitIntent('pi_class_c');
    assert.equal(rejected.state, INTENT_STATE.REJECTED);
  });

  it('createIntent is idempotent on idempotencyKey', async () => {
    const wallet = createWalletIssuer(devConfig);
    const first = await wallet.createIntent({
      ...baseIntent,
      intentId: 'pi_idem',
      idempotencyKey: 'idem_same',
    });
    const second = await wallet.createIntent({
      ...baseIntent,
      intentId: 'pi_idem',
      idempotencyKey: 'idem_same',
    });
    assert.equal(first.createdAt, second.createdAt);
  });

  it('getIntentStatus returns stored record', async () => {
    const wallet = createWalletIssuer(devConfig);
    const created = await wallet.createIntent({
      ...baseIntent,
      intentId: 'pi_status',
      idempotencyKey: 'idem_status',
    });
    const fetched = await wallet.getIntentStatus('pi_status');
    assert.equal(fetched.typ, ARTIFACT_TYPE.PAYMENT_INTENT);
    assert.equal(fetched.dpp, DPP_VERSION);
    assert.equal(fetched.state, created.state);
  });
});
