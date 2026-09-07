import { describe, expect, it } from 'vitest';
import { chunk, expiryWindows, mapWithConcurrency, remainingGB, usagePercent } from './helpers.js';

describe('expiryWindows', () => {
  it('targets 6h, 1d and 3d with tolerance', () => {
    const now = new Date('2026-09-06T12:00:00Z');
    const windows = expiryWindows(now);
    expect(windows.map((w) => w.key)).toEqual(['6h', '1d', '3d']);
    const six = windows[0]!;
    expect(six.to.getTime() - six.from.getTime()).toBe(60 * 60_000);
    expect(six.from.getTime()).toBeLessThan(now.getTime() + 6 * 3600_000);
    expect(six.to.getTime()).toBeGreaterThan(now.getTime() + 6 * 3600_000);
  });
});

describe('usage math', () => {
  it('computes percent and remaining GB', () => {
    const totalGB = 30;
    const used = 15 * 1_073_741_824;
    expect(usagePercent(used, totalGB)).toBe(50);
    expect(remainingGB(used, totalGB)).toBe(15);
    expect(usagePercent(0, 0)).toBe(0);
  });
});

describe('chunk + mapWithConcurrency', () => {
  it('chunks arrays', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it('maps with bounded concurrency preserving order', async () => {
    let active = 0;
    let peak = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10]);
    expect(peak).toBeLessThanOrEqual(2);
  });
});
