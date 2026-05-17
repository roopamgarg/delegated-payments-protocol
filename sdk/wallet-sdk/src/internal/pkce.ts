import { createHash } from 'node:crypto';

const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

export function isValidCodeVerifier(codeVerifier: string): boolean {
  return CODE_VERIFIER_PATTERN.test(codeVerifier);
}

export function isValidCodeChallenge(codeChallenge: string): boolean {
  return CODE_CHALLENGE_PATTERN.test(codeChallenge);
}

export function verifyPkceS256(codeVerifier: string, codeChallenge: string): boolean {
  if (!isValidCodeVerifier(codeVerifier) || !isValidCodeChallenge(codeChallenge)) {
    return false;
  }
  const digest = createHash('sha256').update(codeVerifier).digest('base64url');
  return digest === codeChallenge;
}
