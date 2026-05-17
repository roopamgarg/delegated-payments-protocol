import type { DPPWalletIssuer } from './issuer.js';
import type { AgentProfile } from './types.js';
import { notImplemented } from './not-implemented.js';

export async function registerAgent(
  _issuer: DPPWalletIssuer,
  _profile: AgentProfile,
): Promise<AgentProfile> {
  notImplemented('registerAgent');
}

export async function revokeAgent(_issuer: DPPWalletIssuer, _agentSub: string): Promise<void> {
  notImplemented('revokeAgent');
}
