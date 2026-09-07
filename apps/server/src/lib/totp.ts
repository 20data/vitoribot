import crypto from 'node:crypto';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const char of clean) {
    const idx = BASE32.indexOf(char);
    if (idx < 0) throw new Error('Invalid base32 secret');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Generate a random base32 TOTP secret (160-bit). */
export function generateTotpSecret(): string {
  const bytes = crypto.randomBytes(20);
  let out = '';
  let bits = 0;
  let value = 0;
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

/** Build the otpauth:// URL for QR provisioning in authenticator apps. */
export function totpProvisionUrl(secret: string, account: string, issuer = 'VitoriBot'): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

function hotp(secret: Buffer, counter: bigint): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(counter);
  const hmac = crypto.createHmac('sha1', secret).update(msg).digest();
  const offset = hmac[hmac.length - 1]! & 0x0f;
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    (hmac[offset + 1]! << 16) |
    (hmac[offset + 2]! << 8) |
    hmac[offset + 3]!;
  return (code % 1_000_000).toString().padStart(6, '0');
}

/**
 * Verify a 6-digit TOTP code (RFC 6238, SHA1, 30s step, ±1 step window).
 * Uses timing-safe comparison.
 */
export function verifyTotp(secret: string, code: string, nowMs = Date.now()): boolean {
  if (!/^\d{6}$/.test(code)) return false;
  let key: Buffer;
  try {
    key = base32Decode(secret);
  } catch {
    return false;
  }
  const step = Math.floor(nowMs / 30_000);
  for (const delta of [-1, 0, 1]) {
    const expected = hotp(key, BigInt(step + delta));
    const a = Buffer.from(expected);
    const b = Buffer.from(code);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** Compute the current TOTP code (used in tests). */
export function currentTotp(secret: string, nowMs = Date.now()): string {
  const step = Math.floor(nowMs / 30_000);
  return hotp(base32Decode(secret), BigInt(step));
}
