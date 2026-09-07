import crypto from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;

function getKey(): Buffer {
  const hex = process.env['ENCRYPTION_KEY'] ?? '';
  const key = Buffer.from(hex, 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be a 32-byte hex string (64 hex chars)');
  }
  return key;
}

/** Encrypt a secret (e.g. panel password). Returns "iv:tag:cipher" hex string. */
export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

/** Decrypt a value produced by encrypt(). */
export function decrypt(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Invalid encrypted payload');
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}
