import { prisma } from '@vitoribot/db';
import { getDashboardStats } from '../../bot/services/stats.js';

export interface SeriesPoint {
  date: string;
  value: number;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Dashboard chart data. Buckets computed in code (UTC days); x-axis labels
 * are rendered as Jalali dates on the client.
 */
export async function getDashboardSeries(days = 30): Promise<{
  revenue: SeriesPoint[];
  newUsers: SeriesPoint[];
  subscriptions: SeriesPoint[];
  revenueByGroup: Array<{ group: string; total: number }>;
}> {
  const since = new Date(Date.now() - days * 24 * 3600_000);
  const buckets = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 3600_000);
    buckets.set(dayKey(d), 0);
  }

  const revenue = new Map(buckets);
  const txns = await prisma.transaction.findMany({
    where: { status: 'CONFIRMED', type: 'PURCHASE', createdAt: { gte: since } },
    select: { amount: true, createdAt: true, metadata: true },
  });
  const byGroup = new Map<string, number>();
  const productCache = new Map<string, string>();
  for (const t of txns) {
    const key = dayKey(t.createdAt);
    if (revenue.has(key)) revenue.set(key, (revenue.get(key) ?? 0) + Number(t.amount));
    const meta = (t.metadata ?? {}) as { productId?: string };
    if (meta.productId) {
      let group = productCache.get(meta.productId);
      if (group === undefined) {
        const p = await prisma.product.findUnique({
          where: { id: meta.productId },
          select: { groupName: true },
        });
        group = p?.groupName ?? undefined;
        if (group) productCache.set(meta.productId, group);
      }
      if (group) byGroup.set(group, (byGroup.get(group) ?? 0) + Number(t.amount));
    }
  }

  const users = new Map(buckets);
  const newbies = await prisma.user.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  });
  for (const u of newbies) {
    const key = dayKey(u.createdAt);
    if (users.has(key)) users.set(key, (users.get(key) ?? 0) + 1);
  }

  // Active-subscription trend: cumulative created minus cumulative expired (approx).
  const subs = new Map(buckets);
  const created = await prisma.subscription.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  });
  for (const s of created) {
    const key = dayKey(s.createdAt);
    if (subs.has(key)) subs.set(key, (subs.get(key) ?? 0) + 1);
  }

  const toSeries = (m: Map<string, number>): SeriesPoint[] =>
    [...m.entries()].map(([date, value]) => ({ date, value }));

  return {
    revenue: toSeries(revenue),
    newUsers: toSeries(users),
    subscriptions: toSeries(subs),
    revenueByGroup: [...byGroup.entries()]
      .map(([group, total]) => ({ group, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6),
  };
}

export const dashboardStats = getDashboardStats;
