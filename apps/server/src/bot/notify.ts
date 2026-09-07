import type { Bot } from 'grammy';
import { prisma } from '@vitoribot/db';
import type { BotContext } from './types.js';
import { receiptReviewKeyboard } from './keyboards.js';
import { escapeMarkdown } from '@vitoribot/persian';

/** Send a message to all admins with role ADMIN or higher. */
export async function notifyAdmins(
  bot: Bot<BotContext>,
  text: string,
  opts?: { parseMode?: 'MarkdownV2' },
): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isBlocked: false },
      select: { telegramId: true },
    });
    for (const a of admins) {
      try {
        await bot.api.sendMessage(Number(a.telegramId), text, {
          parse_mode: opts?.parseMode ?? 'MarkdownV2',
        });
      } catch {
        // One failed delivery must not block the rest.
      }
    }
  } catch {
    // Notification failures must never break business flows.
  }
}

/** Send a message to SUPPORT staff and above (ticket alerts). */
export async function notifySupport(
  bot: Bot<BotContext>,
  text: string,
): Promise<void> {
  try {
    const staff = await prisma.user.findMany({
      where: { role: { in: ['SUPPORT', 'ADMIN', 'SUPER_ADMIN'] }, isBlocked: false },
      select: { telegramId: true },
    });
    for (const s of staff) {
      try {
        await bot.api.sendMessage(Number(s.telegramId), text, { parse_mode: 'MarkdownV2' });
      } catch {
        // ignore per-recipient failures
      }
    }
  } catch {
    // ignore
  }
}

/** Alert all admins about a new receipt with approve/reject buttons. */
export async function notifyNewReceipt(
  bot: Bot<BotContext>,
  input: {
    transactionId: string;
    name: string;
    username?: string;
    amount: string;
    productName: string;
    photoFileId: string;
  },
): Promise<void> {
  try {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'SUPER_ADMIN'] }, isBlocked: false },
      select: { telegramId: true },
    });
    const caption =
      `🧾 رسید پرداخت جدید\n` +
      `👤 کاربر: ${escapeMarkdown(input.name)}${input.username ? ` \\(@${escapeMarkdown(input.username)}\\)` : ''}\n` +
      `💰 مبلغ: ${escapeMarkdown(input.amount)} تومان\n` +
      `📦 محصول: ${escapeMarkdown(input.productName)}`;
    for (const a of admins) {
      try {
        await bot.api.sendPhoto(Number(a.telegramId), input.photoFileId, {
          caption,
          parse_mode: 'MarkdownV2',
          reply_markup: receiptReviewKeyboard(input.transactionId),
        });
      } catch {
        // ignore per-recipient failures
      }
    }
  } catch {
    // ignore
  }
}
