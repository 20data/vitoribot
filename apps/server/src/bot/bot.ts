import { Bot, session } from 'grammy';
import { conversations } from '@grammyjs/conversations';
import type { BotContext, SessionData } from './types.js';
import { RedisSessionStorage, getRedis } from '../lib/redis.js';
import { guard } from './middleware/guard.js';
import { purchaseConversation, chargeConversation } from './conversations/purchase.js';
import { newTicketConversation, replyTicketConversation } from './conversations/tickets.js';
import {
  balanceChangeConversation,
  broadcastConversation,
  directMessageConversation,
  rejectReasonConversation,
} from './conversations/admin.js';
import { registerStart } from './handlers/start.js';
import { registerNavigation } from './handlers/navigation.js';
import { registerBuy } from './handlers/buy.js';
import { registerServices } from './handlers/services.js';
import { registerProfile } from './handlers/profile.js';
import { registerTickets } from './handlers/tickets.js';
import { registerReceipts } from './handlers/receipts.js';
import { registerAdmin } from './handlers/admin.js';
import { registerTextState } from './handlers/textState.js';

export function createBot(token: string): Bot<BotContext> {
  const bot = new Bot<BotContext>(token);

  // Session (Redis-backed) must come before conversations.
  bot.use(
    session({
      initial: (): SessionData => ({}),
      storage: new RedisSessionStorage<SessionData>(getRedis()),
    }),
  );

  // Multi-step flows.
  bot.use(conversations());
  bot.use(purchaseConversation);
  bot.use(chargeConversation);
  bot.use(newTicketConversation);
  bot.use(replyTicketConversation);
  bot.use(rejectReasonConversation);
  bot.use(balanceChangeConversation);
  bot.use(broadcastConversation);
  bot.use(directMessageConversation);

  // Terms + force-join + maintenance guard.
  bot.use(guard());

  // Handlers (business logic lives in services/, not here).
  registerStart(bot);
  registerNavigation(bot);
  registerBuy(bot);
  registerServices(bot);
  registerProfile(bot);
  registerTickets(bot);
  registerReceipts(bot);
  registerAdmin(bot);
  registerTextState(bot);

  bot.catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Bot error:', err.error);
  });

  return bot;
}

/** Register the Telegram webhook (best-effort: logs and continues on failure). */
export async function setupWebhook(bot: Bot<BotContext>): Promise<void> {
  const url = process.env['BOT_WEBHOOK_URL'] ?? '';
  const secret = process.env['WEBHOOK_SECRET'] ?? '';
  if (!url) return;
  try {
    await bot.api.setWebhook(url, { secret_token: secret || undefined });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('setWebhook failed (continuing):', (err as Error).message);
  }
}
