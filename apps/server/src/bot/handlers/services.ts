import type { Bot } from 'grammy';
import { InputFile } from 'grammy';
import QRCode from 'qrcode';
import { prisma } from '@vitoribot/db';
import { toJalali } from '@vitoribot/persian';
import type { BotContext } from '../types.js';
import { backKeyboard, serviceKeyboard } from '../keyboards.js';
import { getPanelClient } from '../services/panels.js';
import { BYTES_PER_GB } from '../services/panels.js';

const STATUS_FA: Record<string, string> = {
  ACTIVE: '🟢 فعال',
  EXPIRED: '⚪ منقضی',
  SUSPENDED: '🔴 معلق',
};

async function trafficGB(panelId: string, email: string): Promise<{ used: number } | null> {
  try {
    const client = await getPanelClient(panelId);
    const t = await client.getClientTraffic(email);
    if (!t) return null;
    return { used: (t.up + t.down) / BYTES_PER_GB };
  } catch {
    return null;
  }
}

/** Show the user's subscriptions with live traffic. Exported for menu reuse. */
export async function showMyServices(ctx: BotContext): Promise<void> {
  const dbUserId = ctx.session.dbUserId;
  if (!dbUserId) return;
  const subs = await prisma.subscription.findMany({
    where: { userId: dbUserId, status: 'ACTIVE' },
    include: { product: true },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  if (subs.length === 0) {
    const text = '📋 سرویس فعالی ندارید. از بخش خرید، سرویس جدید بگیرید.';
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, { reply_markup: backKeyboard('menu:home') });
    } else {
      await ctx.reply(text, { reply_markup: backKeyboard('menu:home') });
    }
    return;
  }
  for (const s of subs) {
    const live = await trafficGB(s.panelId, s.clientEmail);
    const totalGB = s.product.trafficGB;
    const used = live ? Math.max(0, Math.min(totalGB, live.used)) : 0;
    const percent = totalGB > 0 ? Math.round((used / totalGB) * 100) : 0;
    const text =
      `📦 ${s.product.name}\n` +
      `📊 مصرف: ${used.toFixed(1)} از ${totalGB} گیگابایت (${percent}٪)\n` +
      `📅 انقضا: ${s.expiresAt ? toJalali(s.expiresAt) : 'بدون انقضا'}\n` +
      `🔘 وضعیت: ${STATUS_FA[s.status] ?? s.status}`;
    await ctx.reply(text, { reply_markup: serviceKeyboard(s.id) });
  }
}

export function registerServices(bot: Bot<BotContext>): void {
  bot.callbackQuery(/^svc:link:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const sub = await prisma.subscription.findUnique({ where: { id: ctx.match?.[1] } });
    if (!sub) {
      await ctx.reply('❌ سرویس یافت نشد.');
      return;
    }
    await ctx.reply(`🔗 لینک اتصال:\n\`${sub.subLink}\``, { parse_mode: 'MarkdownV2' });
  });

  bot.callbackQuery(/^svc:qr:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const sub = await prisma.subscription.findUnique({ where: { id: ctx.match?.[1] } });
    if (!sub) {
      await ctx.reply('❌ سرویس یافت نشد.');
      return;
    }
    try {
      const buf = await QRCode.toBuffer(sub.subLink, { width: 400 });
      await ctx.replyWithPhoto(new InputFile(buf, 'qr.png'), { caption: '📷 کد QR اتصال' });
    } catch {
      await ctx.reply('❌ تولید QR ناموفق بود.');
    }
  });

  bot.callbackQuery(/^svc:renew:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const sub = await prisma.subscription.findUnique({ where: { id: ctx.match?.[1] } });
    if (!sub) {
      await ctx.reply('❌ سرویس یافت نشد.');
      return;
    }
    ctx.session.purchaseProductId = sub.productId;
    ctx.session.discountCode = undefined;
    await ctx.conversation.enter('purchase');
  });

  bot.callbackQuery(/^svc:topup:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.reply('⬆️ برای افزایش حجم، یک محصول جدید خریداری کنید. (به بخش خرید بروید)');
  });
}
