import { VAULT_ERROR_CLASS_NAME, VAULT_ERROR_CODE, type VaultErrorCode } from './constants.js';

export type { VaultErrorCode };

export class DPPVaultError extends Error {
  readonly code: VaultErrorCode;
  readonly details?: Readonly<Record<string, unknown>>;

  constructor(
    code: VaultErrorCode,
    message: string,
    details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
    this.name = VAULT_ERROR_CLASS_NAME;
    this.code = code;
    this.details = details;
  }
}

export { VAULT_ERROR_CODE };
