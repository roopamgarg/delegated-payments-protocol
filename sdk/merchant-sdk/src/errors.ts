import { DPP_ERROR_CODE, type DPPErrorCode } from './constants.js';

export type { DPPErrorCode };

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

export { DPP_ERROR_CODE };
