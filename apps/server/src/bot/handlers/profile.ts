import type { Bot } from 'grammy';
import { prisma } from '@vitoribot/db';
import { formatToman, toFaDigits, toJalali } from '@vitoribot/persian';
import type { BotContext } from '../types.js';
import { profileKeyboard } from '../keyboards.js';

/** Show profile + wallet. Exported for menu reuse. */
export async function showProfile(ctx: BotContext): Promise<void> {
  const dbUserId = ctx.session.dbUserId;
  if (!dbUserId) return;
  const user = await prisma.user.findUnique({
    where: { id: dbUserId },
    include: { _count: { select: { subscriptions: { where: { status: 'ACTIVE' } } } } },
  });
  if (!user) return;
  const text =
    `👤 پروفایل شما\n\n` +
    `🆔 شناسه: ${toFaDigits(user.telegramId.toString())}\n` +
    `💰 موجودی کیف پول: ${formatToman(user.balance.toString())} تومان\n` +
    `📦 سرویس‌های فعال: ${toFaDigits(user._count.subscriptions)}\n` +
    `📅 عضویت از: ${toJalali(user.createdAt)}`;
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { reply_markup: profileKeyboard() });
  } else {
    await ctx.reply(text, { reply_markup: profileKeyboard() });
  }
}

export function registerProfile(bot: Bot<BotContext>): void {
  bot.callbackQuery('wallet:charge', async (ctx) => {
    await ctx.answerCallbackQuery();
    try {
      await ctx.deleteMessage();
    } catch {
      // ignore
    }
    await ctx.conversation.enter('charge');
  });

  bot.callbackQuery('wallet:gift', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.awaitingGift = true;
    await ctx.reply('🎁 کد هدیه خود را وارد کنید:');
  });

  bot.callbackQuery('wallet:history', async (ctx) => {
    await ctx.answerCallbackQuery();
    const dbUserId = ctx.session.dbUserId;
    if (!dbUserId) return;
    const txns = await prisma.transaction.findMany({
      where: { userId: dbUserId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    if (txns.length === 0) {
      await ctx.reply('📜 تراکنشی ثبت نشده است.');
      return;
    }
    const typeFa: Record<string, string> = {
      CHARGE: 'شارژ',
      PURCHASE: 'خرید',
      REFUND: 'بازگشت',
      GIFT: 'هدیه',
      DISCOUNT: 'تخفیف',
    };
    const statusFa: Record<string, string> = {
      PENDING: '⏳ در انتظار',
      CONFIRMED: '✅ تایید شده',
      REJECTED: '❌ رد شده',
      CANCELLED: '⚪ لغو شده',
    };
    const lines = txns.map(
      (t) =>
        `• ${formatToman(t.amount.toString())} تومان — ${typeFa[t.type] ?? t.type} — ${statusFa[t.status] ?? t.status} — ${toJalali(t.createdAt)}`,
    );
    await ctx.reply(`📜 آخرین تراکنش‌ها:\n\n${lines.join('\n')}`);
  });
}
