import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

export function resolveMasterKey(masterKey: Buffer | string): Buffer {
  if (Buffer.isBuffer(masterKey)) {
    if (masterKey.length !== KEY_LENGTH) {
      throw new Error(`masterKey Buffer MUST be ${KEY_LENGTH} bytes`);
    }
    return masterKey;
  }
  if (typeof masterKey === 'string' && masterKey.length > 0) {
    if (/^[A-Za-z0-9+/]+=*$/.test(masterKey) && Buffer.from(masterKey, 'base64').length === KEY_LENGTH) {
      return Buffer.from(masterKey, 'base64');
    }
    return scryptSync(masterKey, 'dpp-agent-vault-v0.1', KEY_LENGTH);
  }
  throw new Error('masterKey MUST be a 32-byte Buffer, base64 key, or non-empty passphrase');
}

export function encryptPayload(plaintext: string, masterKey: Buffer): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, masterKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptPayload(ciphertext: string, masterKey: Buffer): string {
  const buf = Buffer.from(ciphertext, 'base64');
  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('ciphertext too short');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const data = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
