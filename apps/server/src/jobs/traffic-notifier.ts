import type { Bot } from 'grammy';
import { prisma } from '@vitoribot/db';
import type { BotContext } from '../bot/types.js';
import { mapWithConcurrency, usagePercent } from './helpers.js';
import { getPanelClient } from '../bot/services/panels.js';
import { render } from '../bot/renderer.js';
import { getRedis } from '../lib/redis.js';

const WARN_TTL_SECONDS = 7 * 24 * 3600;
const PAGE_SIZE = 200;

interface SubRow {
  id: string;
  panelId: string;
  clientEmail: string;
  productName: string;
  productGB: number;
  telegramId: string;
}

/** Every 2h: warn at 80% and 95% traffic usage (Redis-tracked, no repeats). */
export async function runTrafficNotifier(bot: Bot<BotContext>): Promise<void> {
  const redis = getRedis();
  let page = 0;
  for (;;) {
    const subs = await prisma.subscription.findMany({
      where: { status: 'ACTIVE' },
      include: { user: true, product: true },
      orderBy: { id: 'asc' },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    });
    if (subs.length === 0) return;
    page += 1;

    const byPanel = new Map<string, SubRow[]>();
    for (const s of subs) {
      const row: SubRow = {
        id: s.id,
        panelId: s.panelId,
        clientEmail: s.clientEmail,
        productName: s.product.name,
        productGB: s.product.trafficGB,
        telegramId: s.user.telegramId.toString(),
      };
      const list = byPanel.get(s.panelId) ?? [];
      list.push(row);
      byPanel.set(s.panelId, list);
    }

    for (const [, rows] of byPanel) {
      // Concurrent limit: 5 live-traffic calls per panel.
      await mapWithConcurrency(rows, 5, async (row) => {
        let percent: number | null = null;
        try {
          const client = await getPanelClient(row.panelId);
          const traffic = await client.getClientTraffic(row.clientEmail);
          if (traffic) percent = usagePercent(traffic.up + traffic.down, row.productGB);
        } catch {
          return;
        }
        if (percent === null) return;
        const level = percent >= 95 ? 95 : percent >= 80 ? 80 : null;
        if (level === null) return;
        const warnKey = `traffic:warned:${row.id}:${level}`;
        try {
          if (await redis.get(warnKey)) return;
        } catch {
          // proceed without dedupe on cache failure
        }
        const text = await render(level === 95 ? 'traffic_95' : 'traffic_80', {
          productName: row.productName,
          percent: Math.round(percent),
        });
        try {
          await bot.api.sendMessage(Number(row.telegramId), text);
          try {
            await redis.set(warnKey, '1', 'EX', WARN_TTL_SECONDS);
          } catch {
            // ignore
          }
        } catch {
          // ignore per-user failures
        }
      });
    }
  }
}
