import {
  DPP_ERROR_CODE,
  INTENT_EVENT,
  INTENT_STATE,
  type IntentEvent,
  type IntentState,
} from '../constants.js';
import { DPPError } from '../errors.js';

export type { IntentEvent, IntentState };

const TERMINAL: ReadonlySet<IntentState> = new Set([
  INTENT_STATE.REJECTED,
  INTENT_STATE.SUCCEEDED,
  INTENT_STATE.FAILED,
  INTENT_STATE.EXPIRED,
]);

const TRANSITIONS: Readonly<Record<IntentState, Readonly<Partial<Record<IntentEvent, IntentState>>>>> =
  {
    [INTENT_STATE.CREATED]: { [INTENT_EVENT.SUBMIT]: INTENT_STATE.VALIDATING },
    [INTENT_STATE.VALIDATING]: {
      [INTENT_EVENT.VALIDATION_FAILED]: INTENT_STATE.REJECTED,
      [INTENT_EVENT.VALIDATION_PASSED]: INTENT_STATE.EXECUTING,
      [INTENT_EVENT.RAIL_ERROR]: INTENT_STATE.FAILED,
    },
    [INTENT_STATE.REJECTED]: {},
    [INTENT_STATE.EXECUTING]: {
      [INTENT_EVENT.RAIL_REQUIRES_ACTION]: INTENT_STATE.PENDING_USER_ACTION,
      [INTENT_EVENT.RAIL_SUCCEEDED]: INTENT_STATE.SUCCEEDED,
      [INTENT_EVENT.RAIL_FAILED]: INTENT_STATE.FAILED,
      [INTENT_EVENT.RAIL_ERROR]: INTENT_STATE.FAILED,
    },
    [INTENT_STATE.PENDING_USER_ACTION]: {
      [INTENT_EVENT.USER_COMPLETED]: INTENT_STATE.SUCCEEDED,
      [INTENT_EVENT.USER_DENIED]: INTENT_STATE.FAILED,
      [INTENT_EVENT.RAIL_FAILED]: INTENT_STATE.FAILED,
      [INTENT_EVENT.TTL_EXPIRED]: INTENT_STATE.EXPIRED,
    },
    [INTENT_STATE.SUCCEEDED]: {},
    [INTENT_STATE.FAILED]: {},
    [INTENT_STATE.EXPIRED]: {},
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
    throw new DPPError(
      DPP_ERROR_CODE.INVALID_STATE_TRANSITION,
      `Cannot apply ${event} in state ${from}`,
      { from, event },
    );
  }
  return { state: next, terminal: isTerminalState(next) };
}
