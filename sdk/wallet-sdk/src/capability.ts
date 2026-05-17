import type { DPPWalletIssuer } from './issuer.js';
import type { CapabilityClaimsInput, IssueCapabilityResult } from './types.js';
import { notImplemented } from './not-implemented.js';

export async function issueCapability(
  _issuer: DPPWalletIssuer,
  _input: CapabilityClaimsInput,
): Promise<IssueCapabilityResult> {
  notImplemented('issueCapability');
}
