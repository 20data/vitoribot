import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from './encryption.js';
import { validateInitData } from './telegram-init.js';

describe('encryption', () => {
  it('round-trips a panel password', () => {
    process.env['ENCRYPTION_KEY'] =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const cipher = encrypt('s3cr3t-panel-pass');
    expect(cipher).not.toContain('s3cr3t-panel-pass');
    expect(decrypt(cipher)).toBe('s3cr3t-panel-pass');
  });
});

describe('telegram initData', () => {
  it('rejects tampered data', () => {
    expect(() => validateInitData('auth_date=999&hash=bad', 'token')).toThrow();
  });
});
