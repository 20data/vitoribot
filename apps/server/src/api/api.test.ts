import { describe, expect, it } from 'vitest';
import { currentTotp, generateTotpSecret, totpProvisionUrl, verifyTotp } from '../lib/totp.js';
import { detectMime } from './middleware/upload.js';
import { purchaseSchema } from '@vitoribot/types';

describe('totp', () => {
  it('round-trips a generated secret', () => {
    const secret = generateTotpSecret();
    const code = currentTotp(secret);
    expect(verifyTotp(secret, code)).toBe(true);
  });
  it('rejects wrong codes and malformed input', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, '000000')).toBe(false);
    expect(verifyTotp(secret, 'abc')).toBe(false);
    expect(verifyTotp('!!!', '123456')).toBe(false);
  });
  it('builds an otpauth URL', () => {
    const url = totpProvisionUrl('JBSWY3DPEHPK3PXP', 'admin');
    expect(url.startsWith('otpauth://totp/')).toBe(true);
    expect(url).toContain('JBSWY3DPEHPK3PXP');
  });
});

describe('upload mime detection', () => {
  it('detects jpeg/png magic bytes, rejects others', () => {
    expect(detectMime(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(detectMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe('image/png');
    expect(detectMime(Buffer.from('GIF89a'))).toBeNull();
  });
});

describe('shared schemas', () => {
  it('purchase schema strips nothing but rejects unknown fields', () => {
    const bad = purchaseSchema.safeParse({
      productId: '12345678-1234-4234-8234-123456789012',
      hacker: true,
    });
    expect(bad.success).toBe(false);
  });
});
