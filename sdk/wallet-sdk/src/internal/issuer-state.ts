import type { DPPWalletIssuer } from '../issuer.js';
import type { AgentProfile } from '../types.js';

export type RegisteredAgent = AgentProfile & {
  readonly clientId: string;
  readonly status: 'active' | 'revoked';
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
  readonly codeChallengeMethod: 'S256';
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
