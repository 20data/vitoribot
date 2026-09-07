import type { Bot } from 'grammy';
import { prisma } from '@vitoribot/db';
import { toFaDigits } from '@vitoribot/persian';
import type { BotContext } from '../bot/types.js';
import { notifyAdmins } from '../bot/notify.js';

/** Every 30 min: remind admins about receipts pending longer than 30 minutes. */
export async function runReceiptReminder(bot: Bot<BotContext>, now = new Date()): Promise<void> {
  const cutoff = new Date(now.getTime() - 30 * 60_000);
  const count = await prisma.paymentReceipt.count({
    where: { status: 'PENDING', createdAt: { lt: cutoff } },
  });
  if (count === 0) return;
  await notifyAdmins(
    bot,
    `🧾 ${toFaDigits(count)} رسید در انتظار بررسی است\\. لطفاً رسیدگی کنید\\.`,
  );
}
