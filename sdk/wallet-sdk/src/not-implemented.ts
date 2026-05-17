import { DPP_ERROR_CODE } from './constants.js';
import { DPPError } from './errors.js';

export function notImplemented(feature: string): never {
  throw new DPPError(
    DPP_ERROR_CODE.NOT_IMPLEMENTED,
    `${feature} is not implemented in dpp-wallet-sdk@0.1.0-alpha.0 scaffold. See docs/rfc/dpp-wallet-sdk-api.md and child issues AGE-36–AGE-38.`,
    { feature },
  );
}
