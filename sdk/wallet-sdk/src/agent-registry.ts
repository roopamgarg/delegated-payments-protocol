import type { DPPWalletIssuer } from './issuer.js';
import type { AgentProfile } from './types.js';
import { DPP_ERROR_CODE } from './constants.js';
import { DPPError } from './errors.js';
import { newClientId } from './internal/ids.js';
import { getIssuerState, userAgentKey, type RegisteredAgent } from './internal/issuer-state.js';
import {
  assertNonEmpty,
  validateAgentSub,
  validateRedirectUri,
} from './internal/validate.js';

function requireActiveAgent(agent: RegisteredAgent | undefined, agentSub: string): RegisteredAgent {
  if (!agent) {
    throw new DPPError(DPP_ERROR_CODE.AGENT_NOT_REGISTERED, `agent is not registered: ${agentSub}`, {
      agentSub,
    });
  }
  if (agent.status === 'revoked') {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, `agent registration is revoked: ${agentSub}`, {
      agentSub,
    });
  }
  return agent;
}

export function getRegisteredAgent(
  issuer: DPPWalletIssuer,
  agentSub: string,
): RegisteredAgent | undefined {
  return getIssuerState(issuer).agentsBySub.get(agentSub);
}

export async function registerAgent(
  issuer: DPPWalletIssuer,
  profile: AgentProfile,
): Promise<AgentProfile> {
  assertNonEmpty(profile.displayName, 'displayName');
  validateAgentSub(profile.sub);
  if (profile.redirectUris.length === 0) {
    throw new DPPError(DPP_ERROR_CODE.INVALID_CONFIG, 'redirectUris MUST contain at least one URI');
  }
  for (const uri of profile.redirectUris) {
    validateRedirectUri(uri);
  }

  const state = getIssuerState(issuer);
  if (state.agentsBySub.has(profile.sub)) {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, `agentSub already registered: ${profile.sub}`, {
      agentSub: profile.sub,
    });
  }

  const clientId = profile.clientId ?? newClientId();
  if (state.agentsByClientId.has(clientId)) {
    throw new DPPError(DPP_ERROR_CODE.OAUTH_ERROR, `clientId already registered: ${clientId}`, {
      clientId,
    });
  }

  const registered: RegisteredAgent = {
    sub: profile.sub,
    displayName: profile.displayName,
    redirectUris: [...profile.redirectUris],
    clientId,
    status: 'active',
    registeredAt: new Date().toISOString(),
  };

  state.agentsBySub.set(registered.sub, registered);
  state.agentsByClientId.set(registered.clientId, registered);

  return {
    sub: registered.sub,
    displayName: registered.displayName,
    redirectUris: registered.redirectUris,
    clientId: registered.clientId,
  };
}

export async function revokeAgent(issuer: DPPWalletIssuer, agentSub: string): Promise<void> {
  const state = getIssuerState(issuer);
  const agent = state.agentsBySub.get(agentSub);
  if (!agent) {
    throw new DPPError(DPP_ERROR_CODE.AGENT_NOT_REGISTERED, `agent is not registered: ${agentSub}`, {
      agentSub,
    });
  }

  const revoked: RegisteredAgent = { ...agent, status: 'revoked' };
  state.agentsBySub.set(agentSub, revoked);
  state.agentsByClientId.set(agent.clientId, revoked);

  for (const delegation of state.delegations.values()) {
    if (delegation.agentSub === agentSub) {
      delegation.revoked = true;
      state.revokedUserAgent.add(userAgentKey(delegation.userId, agentSub));
    }
  }
}

export { requireActiveAgent };
