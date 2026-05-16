/** Payment intent states per docs/protocol/verification-flows.md §4. */
export type IntentState =
  | 'created'
  | 'validating'
  | 'rejected'
  | 'executing'
  | 'pending_user_action'
  | 'succeeded'
  | 'failed'
  | 'expired';

export type IntentEvent =
  | 'submit'
  | 'validation_failed'
  | 'validation_passed'
  | 'rail_error'
  | 'rail_requires_action'
  | 'rail_succeeded'
  | 'rail_failed'
  | 'user_completed'
  | 'user_denied'
  | 'ttl_expired';

const TERMINAL: ReadonlySet<IntentState> = new Set([
  'rejected',
  'succeeded',
  'failed',
  'expired',
]);

const TRANSITIONS: Readonly<Record<IntentState, Readonly<Partial<Record<IntentEvent, IntentState>>>>> =
  {
    created: { submit: 'validating' },
    validating: {
      validation_failed: 'rejected',
      validation_passed: 'executing',
      rail_error: 'failed',
    },
    rejected: {},
    executing: {
      rail_requires_action: 'pending_user_action',
      rail_succeeded: 'succeeded',
      rail_failed: 'failed',
      rail_error: 'failed',
    },
    pending_user_action: {
      user_completed: 'succeeded',
      user_denied: 'failed',
      rail_failed: 'failed',
      ttl_expired: 'expired',
    },
    succeeded: {},
    failed: {},
    expired: {},
  };

export function isTerminalState(state: IntentState): boolean {
  return TERMINAL.has(state);
}

export function canTransition(from: IntentState, event: IntentEvent): boolean {
  return TRANSITIONS[from][event] !== undefined;
}

export function transition(
  from: IntentState,
  event: IntentEvent,
): { readonly state: IntentState; readonly terminal: boolean } {
  const next = TRANSITIONS[from][event];
  if (next === undefined) {
    throw new Error(`invalid_state_transition:${from}:${event}`);
  }
  return { state: next, terminal: isTerminalState(next) };
}
