import type { MiddlewareFn } from 'grammy';
import { getDbUserByTelegramId } from '../services/users.js';
import type { BotContext } from '../types.js';

async function roleOf(ctx: BotContext): Promise<string> {
  if (ctx.session.dbUserId) {
    // Fast path is not available; fall back to DB lookup by telegram id.
  }
  const from = ctx.from;
  if (!from) return 'USER';
  const user = await getDbUserByTelegramId(BigInt(from.id));
  return user?.role ?? 'USER';
}

/** Allow only ADMIN and SUPER_ADMIN. */
export function adminOnly(): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const role = await roleOf(ctx);
    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      await ctx.answerCallbackQuery('⛔ دسترسی ندارید');
      return;
    }
    await next();
  };
}

/** Allow only SUPER_ADMIN. */
export function superAdminOnly(): MiddlewareFn<BotContext> {
  return async (ctx, next) => {
    const role = await roleOf(ctx);
    if (role !== 'SUPER_ADMIN') {
      const isCallback = Boolean(ctx.callbackQuery);
      if (isCallback) await ctx.answerCallbackQuery('⛔ فقط سوپر ادمین');
      else await ctx.reply('⛔ فقط سوپر ادمین.');
      return;
    }
    await next();
  };
}

/** Get current DB role of the sender (for handlers). */
export async function currentRole(ctx: BotContext): Promise<string> {
  return roleOf(ctx);
}
