import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, isTerminalState, transition } from '../dist/core/state-machine.js';
import { INTENT_EVENT, INTENT_STATE } from '../dist/constants.js';

test('validating to executing on validation_passed', () => {
  assert.equal(canTransition(INTENT_STATE.VALIDATING, INTENT_EVENT.VALIDATION_PASSED), true);
  const next = transition(INTENT_STATE.VALIDATING, INTENT_EVENT.VALIDATION_PASSED);
  assert.equal(next.state, INTENT_STATE.EXECUTING);
  assert.equal(next.terminal, false);
});

test('executing to pending_user_action on rail_requires_action', () => {
  const next = transition(INTENT_STATE.EXECUTING, INTENT_EVENT.RAIL_REQUIRES_ACTION);
  assert.equal(next.state, INTENT_STATE.PENDING_USER_ACTION);
});

test('terminal states', () => {
  assert.equal(isTerminalState(INTENT_STATE.SUCCEEDED), true);
  assert.equal(isTerminalState(INTENT_STATE.EXECUTING), false);
});
