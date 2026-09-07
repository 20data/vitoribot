import type { MiddlewareFn } from 'grammy';
import { prisma } from '@vitoribot/db';
import type { BotContext } from '../types.js';
import { acceptTerms, upsertUser } from '../services/users.js';
import { forceJoinKeyboard, mainMenuKeyboard, termsKeyboard } from '../keyboards.js';
import { loadTemplate } from '../renderer.js';
import { cached } from '../../lib/redis.js';

interface JoinChannel {
  id: string;
  username: string;
  title: string;
}

async function getActiveChannels(): Promise<JoinChannel[]> {
  return cached<JoinChannel[]>('forcejoin:channels', 30, async () => {
    try {
      const rows = await prisma.forceJoinChannel.findMany({
        where: { isActive: true },
        select: { channelId: true, channelUsername: true, channelTitle: true },
      });
      return rows.map((r) => ({
        id: r.channelId.toString(),
        username: r.channelUsername,
        title: r.channelTitle,
      }));
    } catch {
      return [];
    }
  });
}

/**
 * Global guard: upserts user, enforces block, terms acceptance and force-join.
 * Skips checks for the accept/recheck callbacks themselves.
 */
export function guard(): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const from = ctx.from;
    if (!from || from.is_bot) {
      await next();
      return;
    }

    const dbUser = await upsertUser({
      telegramId: BigInt(from.id),
      username: from.username,
      firstName: from.first_name,
      lastName: from.last_name,
    });
    ctx.session.dbUserId = dbUser.id;

    if (dbUser.isBlocked) {
      await ctx.reply('🚫 حساب شما مسدود شده است. برای پیگیری تیکت ثبت کنید.');
      return;
    }

    const data = ctx.callbackQuery?.data ?? '';

    // Terms acceptance callback.
    if (data === 'terms:accept') {
      await acceptTerms(dbUser.id);
      await ctx.answerCallbackQuery('✅ قوانین پذیرفته شد');
      try {
        await ctx.deleteMessage();
      } catch {
        // ignore
      }
      await ctx.reply(await loadTemplate('main_menu'), { reply_markup: mainMenuKeyboard() });
      return;
    }

    if (!dbUser.isTermsAccepted) {
      // Avoid spamming: only prompt on /start or plain messages, not every callback.
      if (ctx.hasCommand('start') || ctx.has(':text') || ctx.has(':photo') || data === 'forcejoin:check') {
        await ctx.reply(await loadTemplate('terms'), { reply_markup: termsKeyboard() });
      } else {
        await ctx.answerCallbackQuery('⚠️ ابتدا قوانین را بپذیرید');
      }
      return;
    }

    // Force-join check.
    const channels = await getActiveChannels();
    if (channels.length > 0 && data !== 'forcejoin:check') {
      const missing: JoinChannel[] = [];
      for (const c of channels) {
        try {
          const member = await ctx.api.getChatMember(Number(c.id), from.id);
          if (member.status === 'left' || member.status === 'kicked') missing.push(c);
        } catch {
          missing.push(c);
        }
      }
      if (missing.length > 0) {
        await ctx.reply(await loadTemplate('force_join'), {
          reply_markup: forceJoinKeyboard(missing),
        });
        return;
      }
    }
    if (data === 'forcejoin:check') {
      await ctx.answerCallbackQuery('✅ عضویت تایید شد');
      try {
        await ctx.deleteMessage();
      } catch {
        // ignore
      }
      await ctx.reply(await loadTemplate('main_menu'), { reply_markup: mainMenuKeyboard() });
      return;
    }

    // Maintenance mode: regular users cannot buy while enabled.
    if (dbUser.role === 'USER' && (data.startsWith('buy:') || data.startsWith('wallet:charge'))) {
      const mode = await cached<string | null>('setting:maintenance', 30, async () => {
        try {
          const row = await prisma.setting.findUnique({ where: { key: 'bot.maintenance_mode' } });
          return row?.value ?? null;
        } catch {
          return null;
        }
      });
      if (mode === 'true') {
        await ctx.answerCallbackQuery('🛠️ فروشگاه در حالت تعمیر است. لطفاً بعداً تلاش کنید.');
        return;
      }
    }

    await next();
  };
}
