import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { prisma } from '@vitoribot/db';
import type { BotContext } from '../bot/types.js';
import { expiryWindows, remainingGB } from './helpers.js';
import { getPanelClient } from '../bot/services/panels.js';
import { render } from '../bot/renderer.js';
import { getRedis } from '../lib/redis.js';

const WARN_TTL_SECONDS = 4 * 24 * 3600;

/** Hourly: warn users whose subscription expires in ~6h / ~1d / ~3d. */
export async function runExpiryNotifier(bot: Bot<BotContext>, now = new Date()): Promise<void> {
  const redis = getRedis();
  for (const window of expiryWindows(now)) {
    const subs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { gte: window.from, lte: window.to },
      },
      include: { user: true, product: true },
      take: 500,
    });
    for (const sub of subs) {
      const warnKey = `expiry:warned:${sub.id}:${window.key}`;
      try {
        if (await redis.get(warnKey)) continue;
      } catch {
        // proceed without dedupe on cache failure
      }
      let remaining = sub.product.trafficGB;
      try {
        const client = await getPanelClient(sub.panelId);
        const traffic = await client.getClientTraffic(sub.clientEmail);
        if (traffic) {
          remaining = remainingGB(traffic.up + traffic.down, sub.product.trafficGB);
        }
      } catch {
        // live traffic is best-effort; still send the expiry warning
      }
      const text = await render(window.templateKey, {
        productName: sub.product.name,
        remaining,
      });
      try {
        await bot.api.sendMessage(Number(sub.user.telegramId), text, {
          reply_markup: new InlineKeyboard().text('🔄 تمدید سرویس', `svc:renew:${sub.id}`),
        });
        try {
          await redis.set(warnKey, '1', 'EX', WARN_TTL_SECONDS);
        } catch {
          // ignore
        }
      } catch {
        // per-user delivery failures must not stop the batch
      }
    }
  }
}
