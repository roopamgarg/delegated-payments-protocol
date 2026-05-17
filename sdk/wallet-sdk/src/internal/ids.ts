import { randomBytes } from 'node:crypto';

function randomId(prefix: string): string {
  return `${prefix}_${randomBytes(12).toString('base64url')}`;
}

export function newClientId(): string {
  return randomId('dpp_client');
}

export function newAuthorizationCode(): string {
  return randomId('dpp_code');
}

export function newDelegationId(): string {
  return randomId('dlg');
}

export function newAccessToken(): string {
  return randomId('dpp_at');
}

export function newRefreshToken(): string {
  return randomId('dpp_rt');
}
