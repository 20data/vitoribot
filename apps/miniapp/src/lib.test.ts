import { describe, expect, it } from 'vitest';
import { fa, jalali } from './lib';

describe('miniapp lib', () => {
  it('formats Persian digits', () => {
    expect(fa(150000)).toBe('۱۵۰٬۰۰۰');
  });
  it('formats Jalali dates', () => {
    const out = jalali('2026-09-06T12:00:00Z');
    expect(out).not.toBe('2026-09-06T12:00:00Z');
    expect(out.length).toBeGreaterThan(0);
  });
});
