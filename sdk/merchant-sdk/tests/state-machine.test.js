import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canTransition, isTerminalState, transition } from '../dist/core/state-machine.js';

test('validating to executing on validation_passed', () => {
  assert.equal(canTransition('validating', 'validation_passed'), true);
  const next = transition('validating', 'validation_passed');
  assert.equal(next.state, 'executing');
  assert.equal(next.terminal, false);
});

test('executing to pending_user_action on rail_requires_action', () => {
  const next = transition('executing', 'rail_requires_action');
  assert.equal(next.state, 'pending_user_action');
});

test('terminal states', () => {
  assert.equal(isTerminalState('succeeded'), true);
  assert.equal(isTerminalState('executing'), false);
});
