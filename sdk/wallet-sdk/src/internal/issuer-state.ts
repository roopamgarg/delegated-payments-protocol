import type { AgentStatus, OAuthPkceMethod } from '../constants.js';
import type { DPPWalletIssuer } from '../issuer.js';
import type { AgentProfile } from '../types.js';

/**
 * v0.1 alpha: per-issuer in-process state for unit tests and wallet MVP scaffolding.
 *
 * This is not production-durable — state is lost on restart and does not replicate across
 * instances. Wallet services (AGE-40) MUST persist agents, authorization codes, and delegations
 * to a shared store (e.g. Postgres,
 * Redis) before production deploy. A pluggable persistence port can wrap these helpers in a
 * follow-up without changing the public OAuth API surface.
 */
export type RegisteredAgent = AgentProfile & {
  readonly clientId: string;
  readonly status: AgentStatus;
  readonly registeredAt: string;
};

export type PendingAuthorizationCode = {
  readonly code: string;
  readonly clientId: string;
  readonly redirectUri: string;
  readonly agentSub: string;
  readonly scope: ReadonlyArray<string>;
  readonly state: string;
  readonly codeChallenge: string;
  readonly codeChallengeMethod: OAuthPkceMethod;
  readonly userId: string;
  readonly expiresAt: number;
  used: boolean;
};

export type ActiveDelegation = {
  readonly delegationId: string;
  readonly userId: string;
  readonly agentSub: string;
  readonly clientId: string;
  readonly scope: ReadonlyArray<string>;
  readonly accessToken: string;
  readonly refreshToken?: string;
  readonly expiresAt: number;
  revoked: boolean;
};

export type IssuerRuntimeState = {
  agentsBySub: Map<string, RegisteredAgent>;
  agentsByClientId: Map<string, RegisteredAgent>;
  authorizationCodes: Map<string, PendingAuthorizationCode>;
  delegations: Map<string, ActiveDelegation>;
  delegationsByAccessToken: Map<string, ActiveDelegation>;
  revokedUserAgent: Set<string>;
};

const issuerStates = new WeakMap<DPPWalletIssuer, IssuerRuntimeState>();

export function getIssuerState(issuer: DPPWalletIssuer): IssuerRuntimeState {
  let state = issuerStates.get(issuer);
  if (!state) {
    state = {
      agentsBySub: new Map(),
      agentsByClientId: new Map(),
      authorizationCodes: new Map(),
      delegations: new Map(),
      delegationsByAccessToken: new Map(),
      revokedUserAgent: new Set(),
    };
    issuerStates.set(issuer, state);
  }
  return state;
}

export function userAgentKey(userId: string, agentSub: string): string {
  return `${userId}\0${agentSub}`;
}
