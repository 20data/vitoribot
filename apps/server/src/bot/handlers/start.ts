import type { Bot } from 'grammy';
import { getDbUserByTelegramId, isAdminRole } from '../services/users.js';
import { adminReplyKeyboard, mainMenuKeyboard, removeReplyKeyboard } from '../keyboards.js';
import { render } from '../renderer.js';
import type { BotContext } from '../types.js';

/** /start — terms → force-join → main menu (guard does the heavy lifting). */
export function registerStart(bot: Bot<BotContext>): void {
  bot.command('start', async (ctx) => {
    const from = ctx.from;
    if (!from) return;
    const dbUser = await getDbUserByTelegramId(BigInt(from.id));

    // Show persistent admin keyboard for staff.
    if (dbUser && isAdminRole(dbUser.role)) {
      await ctx.reply('🛠️ پنل مدیریت فعال شد.', { reply_markup: adminReplyKeyboard() });
    } else {
      await ctx.reply('👋 خوش آمدید!', { reply_markup: removeReplyKeyboard() });
    }
    await ctx.reply(await render('welcome', { name: from.first_name }), {
      reply_markup: mainMenuKeyboard(),
    });
  });
}
