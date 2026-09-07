export interface TimeWindow {
  key: '6h' | '1d' | '3d';
  templateKey: string;
  from: Date;
  to: Date;
}

const HOUR_MS = 3600_000;
const DAY_MS = 24 * HOUR_MS;
const TOLERANCE_MS = 30 * 60_000;

/**
 * Subscriptions expiring "in exactly" 6h / 1d / 3d, with ±30min tolerance
 * so hourly runs never miss a subscription.
 */
export function expiryWindows(now: Date): TimeWindow[] {
  const t = now.getTime();
  return [
    { key: '6h', templateKey: 'expiry_6h', from: new Date(t + 6 * HOUR_MS - TOLERANCE_MS), to: new Date(t + 6 * HOUR_MS + TOLERANCE_MS) },
    { key: '1d', templateKey: 'expiry_1d', from: new Date(t + DAY_MS - TOLERANCE_MS), to: new Date(t + DAY_MS + TOLERANCE_MS) },
    { key: '3d', templateKey: 'expiry_3d', from: new Date(t + 3 * DAY_MS - TOLERANCE_MS), to: new Date(t + 3 * DAY_MS + TOLERANCE_MS) },
  ];
}

/** Usage percent from raw byte counters and plan size in GB. */
export function usagePercent(usedBytes: number, totalGB: number): number {
  if (totalGB <= 0) return 0;
  const totalBytes = totalGB * 1_073_741_824;
  return Math.min(100, Math.max(0, (usedBytes / totalBytes) * 100));
}

/** Remaining GB from raw byte counters and plan size in GB. */
export function remainingGB(usedBytes: number, totalGB: number): number {
  const remaining = totalGB - usedBytes / 1_073_741_824;
  return Math.max(0, Math.round(remaining * 10) / 10);
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/** Map with bounded concurrency, preserving input order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    for (;;) {
      const i = next;
      next += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i] as T, i);
    }
  });
  await Promise.all(workers);
  return results;
}
