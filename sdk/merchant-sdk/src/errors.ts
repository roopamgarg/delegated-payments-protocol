import { DPP_ERROR_CLASS_NAME, DPP_ERROR_CODE, type DPPErrorCode } from './constants.js';

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
    this.name = DPP_ERROR_CLASS_NAME;
    this.code = code;
    this.details = details;
  }
}

export { DPP_ERROR_CODE };
