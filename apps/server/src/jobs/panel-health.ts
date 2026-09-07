import type { Bot } from 'grammy';
import { prisma } from '@vitoribot/db';
import type { BotContext } from '../bot/types.js';
import { dropPanelClient, markPanelOffline, markPanelOnline } from '../bot/services/panels.js';
import { getRedis } from '../lib/redis.js';
import { escapeMarkdown } from '@vitoribot/persian';

const FAIL_THRESHOLD = 3;
const FAIL_KEY_TTL_SECONDS = 600;

async function notifySuperAdmins(bot: Bot<BotContext>, text: string): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: 'SUPER_ADMIN', isBlocked: false },
      select: { telegramId: true },
    });
    for (const a of admins) {
      try {
        await bot.api.sendMessage(Number(a.telegramId), text, { parse_mode: 'MarkdownV2' });
      } catch {
        // ignore per-recipient failures
      }
    }
  } catch {
    // notification failures must never break the job
  }
}

/** Every 3 min: ping active panels; 3 consecutive failures → offline + alert. */
export async function runPanelHealthCheck(bot: Bot<BotContext>): Promise<void> {
  const redis = getRedis();
  const panels = await prisma.panel.findMany({ where: { isActive: true } });
  for (const panel of panels) {
    const failKey = `panel:fail:${panel.id}`;
    try {
      // Fresh client (bypass pool) so a stale session never masks an outage.
      dropPanelClient(panel.id);
      const { ThreeXUIClient } = await import('@vitoribot/3xui');
      const { decrypt } = await import('../lib/encryption.js');
      const client = new ThreeXUIClient(panel.id, panel.url, panel.username, decrypt(panel.encryptedPass), {
        get: async (k: string) => redis.get(k),
        set: async (k: string, v: string, ttl: number) =>
          void (await redis.set(k, v, 'EX', ttl)),
      });
      await client.getInbounds();
      try {
        await redis.del(failKey);
      } catch {
        // ignore
      }
      if (!panel.isOnline) {
        await markPanelOnline(panel.id);
        await notifySuperAdmins(
          bot,
          `✅ پنل ${escapeMarkdown(panel.name)} دوباره آنلاین شد\\.`,
        );
      }
    } catch {
      let fails = 1;
      try {
        fails = await redis.incr(failKey);
        await redis.expire(failKey, FAIL_KEY_TTL_SECONDS);
      } catch {
        // without Redis, treat every failure as threshold breach
        fails = FAIL_THRESHOLD;
      }
      if (fails >= FAIL_THRESHOLD && panel.isOnline) {
        await markPanelOffline(panel.id);
        await notifySuperAdmins(
          bot,
          `🔴 پنل ${escapeMarkdown(panel.name)} آفلاین شد \\(۳ خطای متوالی\\)\\.`,
        );
      }
    }
  }
}
