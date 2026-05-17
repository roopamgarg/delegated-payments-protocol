import { createHash } from 'node:crypto';
import { canonicalJsonStringify } from './core/canonical-json.js';
import { transition } from './core/state-machine.js';
import {
  ARTIFACT_TYPE,
  DPP_ERROR_CODE,
  DPP_VERSION,
  DIGEST_ALG,
  INTENT_EVENT,
  INTENT_STATE,
  RAIL_CLASS,
  type IntentEvent,
} from './constants.js';
import { DPPError } from './errors.js';
import { getIntentStore } from './intent-store.js';
import type { DPPWalletIssuer } from './issuer.js';
import type { PaymentIntentInput, PaymentIntentRecord } from './types.js';

export function buildDigestPayload(intent: PaymentIntentInput): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    dpp: DPP_VERSION,
    typ: ARTIFACT_TYPE.PAYMENT_INTENT,
    intentId: intent.intentId,
    idempotencyKey: intent.idempotencyKey,
    amount: { currency: intent.amount.currency, value: intent.amount.value },
    merchantId: intent.merchantId,
    rail: intent.rail,
    railClass: intent.railClass,
  };
  if (intent.mandateId !== undefined) {
    payload.mandateId = intent.mandateId;
  }
  if (intent.metadata !== undefined) {
    payload.metadata = { ...intent.metadata };
  }
  return payload;
}

export function computeIntentDigest(intent: PaymentIntentInput): string {
  const canonical = canonicalJsonStringify(buildDigestPayload(intent));
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

function nowIso(): string {
  return new Date().toISOString();
}

function toRecord(payload: PaymentIntentInput): PaymentIntentRecord {
  const timestamp = nowIso();
  const digestValue = computeIntentDigest(payload);
  return {
    ...payload,
    dpp: DPP_VERSION,
    typ: ARTIFACT_TYPE.PAYMENT_INTENT,
    digest: { alg: DIGEST_ALG.SHA256, value: digestValue },
    state: INTENT_STATE.CREATED,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function getRecordOrThrow(issuer: DPPWalletIssuer, intentId: string): PaymentIntentRecord {
  const record = getIntentStore(issuer).get(intentId);
  if (!record) {
    throw new DPPError(DPP_ERROR_CODE.INTENT_NOT_FOUND, `Intent not found: ${intentId}`, {
      intentId,
    });
  }
  return record;
}

function saveRecord(issuer: DPPWalletIssuer, record: PaymentIntentRecord): PaymentIntentRecord {
  getIntentStore(issuer).set(record.intentId, record);
  return record;
}

function applyEvent(
  issuer: DPPWalletIssuer,
  record: PaymentIntentRecord,
  event: IntentEvent,
): PaymentIntentRecord {
  const { state } = transition(record.state, event);
  return saveRecord(issuer, {
    ...record,
    state,
    updatedAt: nowIso(),
  });
}

function applyEvents(
  issuer: DPPWalletIssuer,
  record: PaymentIntentRecord,
  events: ReadonlyArray<IntentEvent>,
): PaymentIntentRecord {
  return events.reduce((current, event) => applyEvent(issuer, current, event), record);
}

function validateForSubmit(record: PaymentIntentRecord): IntentEvent {
  if (record.railClass === RAIL_CLASS.C && record.mandateId === undefined) {
    return INTENT_EVENT.VALIDATION_FAILED;
  }
  const recomputed = computeIntentDigest(record);
  if (recomputed !== record.digest.value) {
    return INTENT_EVENT.VALIDATION_FAILED;
  }
  return INTENT_EVENT.VALIDATION_PASSED;
}

function railOutcomeEvent(record: PaymentIntentRecord): IntentEvent {
  if (record.railClass === RAIL_CLASS.A) {
    return INTENT_EVENT.RAIL_SUCCEEDED;
  }
  if (
    record.railClass === RAIL_CLASS.B ||
    record.railClass === RAIL_CLASS.C ||
    record.railClass === RAIL_CLASS.D
  ) {
    return INTENT_EVENT.RAIL_REQUIRES_ACTION;
  }
  return INTENT_EVENT.RAIL_ERROR;
}

export async function createIntent(
  issuer: DPPWalletIssuer,
  payload: PaymentIntentInput,
): Promise<PaymentIntentRecord> {
  const store = getIntentStore(issuer);
  const existing = store.get(payload.intentId);
  if (existing) {
    if (existing.idempotencyKey === payload.idempotencyKey) {
      return existing;
    }
    throw new DPPError(
      DPP_ERROR_CODE.INVALID_TOKEN,
      `Intent id already exists with different idempotency key: ${payload.intentId}`,
      { intentId: payload.intentId },
    );
  }
  return saveRecord(issuer, toRecord(payload));
}

export async function submitIntent(
  issuer: DPPWalletIssuer,
  intentId: string,
): Promise<PaymentIntentRecord> {
  let record = getRecordOrThrow(issuer, intentId);
  if (record.state !== INTENT_STATE.CREATED) {
    throw new DPPError(
      DPP_ERROR_CODE.INVALID_STATE_TRANSITION,
      `submitIntent requires state ${INTENT_STATE.CREATED}`,
      { intentId, state: record.state },
    );
  }

  record = applyEvents(issuer, record, [INTENT_EVENT.SUBMIT]);

  const validationEvent = validateForSubmit(record);
  record = applyEvents(issuer, record, [validationEvent]);
  if (record.state === INTENT_STATE.REJECTED) {
    return record;
  }

  return applyEvents(issuer, record, [railOutcomeEvent(record)]);
}

export async function getIntentStatus(
  issuer: DPPWalletIssuer,
  intentId: string,
): Promise<PaymentIntentRecord> {
  return getRecordOrThrow(issuer, intentId);
}

export async function resumeAfterUserAction(
  issuer: DPPWalletIssuer,
  intentId: string,
): Promise<PaymentIntentRecord> {
  const record = getRecordOrThrow(issuer, intentId);
  if (record.state !== INTENT_STATE.PENDING_USER_ACTION) {
    throw new DPPError(
      DPP_ERROR_CODE.INVALID_STATE_TRANSITION,
      `resumeAfterUserAction requires state ${INTENT_STATE.PENDING_USER_ACTION}`,
      { intentId, state: record.state },
    );
  }
  return applyEvents(issuer, record, [INTENT_EVENT.USER_COMPLETED]);
}
