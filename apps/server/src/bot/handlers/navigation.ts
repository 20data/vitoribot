import type { Bot } from 'grammy';
import { prisma } from '@vitoribot/db';
import type { BotContext } from '../types.js';
import {
  backKeyboard,
  groupsKeyboard,
  mainMenuKeyboard,
  ticketListKeyboard,
  tutorialsKeyboard,
} from '../keyboards.js';
import { loadTemplate } from '../renderer.js';
import { toFaDigits } from '@vitoribot/persian';
import { showProfile } from './profile.js';
import { showMyServices } from './services.js';

/** Main-menu navigation callbacks shared by all entry points. */
export function registerNavigation(bot: Bot<BotContext>): void {
  bot.callbackQuery('menu:home', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(await loadTemplate('main_menu'), {
      reply_markup: mainMenuKeyboard(),
    });
  });

  bot.callbackQuery('menu:buy', async (ctx) => {
    await ctx.answerCallbackQuery();
    const groups = await prisma.product.findMany({
      where: { isActive: true, panel: { isActive: true } },
      select: { groupName: true },
      distinct: ['groupName'],
      orderBy: { groupName: 'asc' },
    });
    if (groups.length === 0) {
      await ctx.editMessageText('❌ در حال حاضر محصولی موجود نیست.', {
        reply_markup: backKeyboard('menu:home'),
      });
      return;
    }
    // Cache group order in Redis? Keep simple: re-query on selection.
    await ctx.editMessageText('🌍 گروه سرور را انتخاب کنید:', {
      reply_markup: groupsKeyboard(groups.map((g) => g.groupName)),
    });
  });

  bot.callbackQuery('menu:my', async (ctx) => {
    await ctx.answerCallbackQuery();
    await showMyServices(ctx);
  });

  bot.callbackQuery('menu:tutorials', async (ctx) => {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(await loadTemplate('tutorial.menu'), {
      reply_markup: tutorialsKeyboard(),
    });
  });

  bot.callbackQuery('menu:tickets', async (ctx) => {
    await ctx.answerCallbackQuery();
    const dbUserId = ctx.session.dbUserId;
    if (!dbUserId) return;
    const tickets = await prisma.ticket.findMany({
      where: { userId: dbUserId },
      orderBy: { updatedAt: 'desc' },
      take: 10,
    });
    if (tickets.length === 0) {
      await ctx.editMessageText('🎫 تیکت فعالی ندارید. تیکت جدید بسازید:', {
        reply_markup: ticketListKeyboard([], false),
      });
      return;
    }
    const lines = tickets
      .map(
        (t, i) =>
          `${toFaDigits(i + 1)}. ${t.subject} — ${t.status === 'OPEN' ? '🔴 باز' : t.status === 'ANSWERED' ? '🟡 پاسخ داده شده' : '⚪ بسته'}`,
      )
      .join('\n');
    await ctx.editMessageText(`🎫 تیکت‌های شما:\n\n${lines}`, {
      reply_markup: ticketListKeyboard(
        tickets.map((t) => ({ id: t.id, subject: t.subject.slice(0, 30) })),
        false,
      ),
    });
  });

  bot.callbackQuery('menu:profile', async (ctx) => {
    await ctx.answerCallbackQuery();
    await showProfile(ctx);
  });

  // Tutorial pages (static content from BotMessage table).
  const pages: Array<{ data: string; key: string }> = [
    { data: 'tut:windows', key: 'tutorial.windows' },
    { data: 'tut:android', key: 'tutorial.android' },
    { data: 'tut:ios', key: 'tutorial.ios' },
    { data: 'tut:macos', key: 'tutorial.macos' },
    { data: 'tut:linux', key: 'tutorial.linux' },
  ];
  for (const p of pages) {
    bot.callbackQuery(p.data, async (ctx) => {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(await loadTemplate(p.key), {
        reply_markup: backKeyboard('menu:tutorials'),
      });
    });
  }
}
