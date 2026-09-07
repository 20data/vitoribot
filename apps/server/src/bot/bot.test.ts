import { describe, expect, it } from 'vitest';
import { mainMenuKeyboard, receiptReviewKeyboard, termsKeyboard } from './keyboards.js';
import { buildClientEmail, computeExpiryMs } from './services/panels.js';

describe('keyboards', () => {
  it('main menu has Persian labels', () => {
    const markup = mainMenuKeyboard().inline_keyboard.flat().map((b) => b.text).join(' ');
    expect(markup).toContain('خرید سرویس جدید');
    expect(markup).toContain('سرویس‌های من');
    expect(markup).toContain('پروفایل و کیف پول');
  });
  it('terms keyboard has accept button', () => {
    const markup = termsKeyboard().inline_keyboard.flat().map((b) => b.text).join(' ');
    expect(markup).toContain('قوانین را می‌پذیرم');
  });
  it('receipt keyboard carries transaction id', () => {
    const kb = receiptReviewKeyboard('tx-123');
    const data = kb.inline_keyboard.flat().map((b) => ('callback_data' in b ? b.callback_data : ''));
    expect(data.some((d) => d.includes('tx-123'))).toBe(true);
  });
});

describe('panel helpers', () => {
  it('builds short unique client emails', () => {
    const email = buildClientEmail('prod', 'user', 'a1b2c3d4');
    expect(email.length).toBeLessThanOrEqual(32);
    expect(email).toContain('prod');
  });
  it('computes expiry in ms', () => {
    const now = Date.now();
    expect(computeExpiryMs(30, now)).toBe(now + 30 * 86_400_000);
    expect(computeExpiryMs(0, now)).toBe(0);
  });
});
