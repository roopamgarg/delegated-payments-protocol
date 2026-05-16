export type DPPErrorCode =
  | 'invalid_token'
  | 'token_replay'
  | 'invalid_signature'
  | 'untrusted_issuer'
  | 'delegation_invalid'
  | 'forbidden_claim'
  | 'psp_error'
  | 'psp_not_configured'
  | 'invalid_state_transition'
  | 'payment_not_found';

export class DPPError extends Error {
  readonly code: DPPErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: DPPErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = 'DPPError';
    this.code = code;
    this.details = details;
  }
}
