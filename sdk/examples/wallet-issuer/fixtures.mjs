/** Demo agent + user fixtures aligned with express-merchant ISSUER allowlist when configured. */

export const DEMO_AGENT = {
  sub: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGJpnn5uSiZuNR',
  displayName: 'DPP Reference MCP Agent',
  redirectUris: ['http://127.0.0.1:8765/oauth/callback'],
};

export const DEMO_USER = {
  userId: 'usr_demo_alice',
  email: 'alice@wallet.local',
  displayName: 'Alice Demo',
};

export const DEFAULT_ISSUER = 'https://127.0.0.1:3350/issuer';
