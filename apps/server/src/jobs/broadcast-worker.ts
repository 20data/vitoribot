import type { Bot } from 'grammy';
import { InputFile } from 'grammy';
import { prisma } from '@vitoribot/db';
import type { BroadcastJob } from '@vitoribot/queue';
import type { BotContext } from '../bot/types.js';

/**
 * Broadcast sender: delivers to the target audience at ~20 msg/sec
 * (BullMQ limiter on the worker), tracking success/fail counts.
 */
export async function processBroadcast(job: BroadcastJob, bot: Bot<BotContext>): Promise<void> {
  const broadcast = await prisma.broadcast.findUnique({ where: { id: job.broadcastId } });
  if (!broadcast) return;

  await prisma.broadcast.update({
    where: { id: broadcast.id },
    data: { status: 'SENDING' },
  });

  let recipients: bigint[] = [];
  if (job.target === 'ALL') {
    const users = await prisma.user.findMany({
      where: { isBlocked: false },
      select: { telegramId: true },
    });
    recipients = users.map((u) => u.telegramId);
  } else if (job.target === 'ACTIVE') {
    const users = await prisma.user.findMany({
      where: { isBlocked: false, subscriptions: { some: { status: 'ACTIVE' } } },
      select: { telegramId: true },
    });
    recipients = users.map((u) => u.telegramId);
  } else {
    const users = await prisma.user.findMany({
      where: { isBlocked: false, subscriptions: { none: { status: 'ACTIVE' } } },
      select: { telegramId: true },
    });
    recipients = users.map((u) => u.telegramId);
  }

  let sent = 0;
  let failed = 0;
  for (const telegramId of recipients) {
    try {
      const chatId = Number(telegramId);
      if (job.photoPath) {
        await bot.api.sendPhoto(chatId, new InputFile(job.photoPath), { caption: job.message });
      } else {
        await bot.api.sendMessage(chatId, job.message);
      }
      sent += 1;
    } catch {
      failed += 1;
    }
    // Checkpoint progress every 50 deliveries so restarts resume stats.
    if ((sent + failed) % 50 === 0) {
      await prisma.broadcast.update({
        where: { id: broadcast.id },
        data: { sentCount: sent, failedCount: failed },
      });
    }
  }

  await prisma.broadcast.update({
    where: { id: broadcast.id },
    data: { sentCount: sent, failedCount: failed, status: 'DONE', finishedAt: new Date() },
  });
}
