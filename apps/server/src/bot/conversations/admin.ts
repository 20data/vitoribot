import { createConversation, type Conversation } from '@grammyjs/conversations';
import { Queue } from 'bullmq';
import { prisma } from '@vitoribot/db';
import { QUEUE_NAMES } from '@vitoribot/queue';
import type { BotContext } from '../types.js';
import { rejectReceipt } from '../services/receipts.js';
import { getRedis } from '../../lib/redis.js';
import { render } from '../renderer.js';

type Ctx = BotContext;
type Conv = Conversation<Ctx, Ctx>;

/** Ask admin for a rejection reason, then reject the receipt and notify the user. */
async function rejectReasonBuilder(conversation: Conv, ctx: Ctx): Promise<void> {
  const txId = ctx.session.adminRejectTxId;
  const adminId = ctx.session.dbUserId;
  if (!txId || !adminId) {
    await ctx.reply('❌ خطایی رخ داد.');
    return;
  }
  await ctx.reply('❌ دلیل رد رسید را وارد کنید:');
  const reason = (await conversation.form.text()).trim().slice(0, 500);

  const userTelegramId = await conversation.external(async () => {
    await rejectReceipt(txId, adminId, reason);
    const tx = await prisma.transaction.findUnique({
      where: { id: txId },
      include: { user: true },
    });
    return tx?.user.telegramId.toString() ?? null;
  });

  if (userTelegramId) {
    try {
      await ctx.api.sendMessage(
        Number(userTelegramId),
        await render('receipt_rejected', { reason }),
      );
    } catch {
      // ignore
    }
  }
  ctx.session.adminRejectTxId = undefined;
  await ctx.reply('✅ رسید رد شد و به کاربر اطلاع داده شد.');
}

/** Ask admin for amount + reason, then adjust user balance. */
async function balanceChangeBuilder(conversation: Conv, ctx: Ctx): Promise<void> {
  const targetId = ctx.session.adminTargetUserId;
  const mode = ctx.session.adminBalanceMode;
  const adminId = ctx.session.dbUserId;
  if (!targetId || !mode || !adminId) {
    await ctx.reply('❌ خطایی رخ داد.');
    return;
  }

  await ctx.reply('💰 مبلغ را به تومان وارد کنید:');
  const amountText = await conversation.form.text();
  const amount = Number(amountText.replace(/[٬, ]/g, ''));
  if (!Number.isFinite(amount) || amount <= 0) {
    await ctx.reply('❌ مبلغ نامعتبر است. عملیات لغو شد.');
    return;
  }
  await ctx.reply('📝 دلیل تغییر موجودی را وارد کنید:');
  const changeReason = (await conversation.form.text()).trim().slice(0, 500);

  await conversation.external(async () => {
    const delta = mode === 'add' ? amount : -amount;
    await prisma.user.update({
      where: { id: targetId },
      data: { balance: { increment: delta } },
    });
    await prisma.transaction.create({
      data: {
        userId: targetId,
        amount: delta,
        type: 'CHARGE',
        status: 'CONFIRMED',
        description: changeReason,
        confirmedAt: new Date(),
        confirmedById: adminId,
      },
    });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: 'USER_BALANCE_CHANGE',
        targetType: 'User',
        targetId,
        metadata: { amount: delta, reason: changeReason },
        ipAddress: 'bot',
        userAgent: 'telegram-bot',
      },
    });
  });

  ctx.session.adminTargetUserId = undefined;
  ctx.session.adminBalanceMode = undefined;
  await ctx.reply('✅ موجودی کاربر به‌روزرسانی شد.');
}

/** Compose a broadcast message and queue it in BullMQ. */
async function broadcastBuilder(conversation: Conv, ctx: Ctx): Promise<void> {
  const target = ctx.session.broadcastTarget;
  const adminId = ctx.session.dbUserId;
  if (!target || !adminId) {
    await ctx.reply('❌ خطایی رخ داد.');
    return;
  }

  await ctx.reply('📢 متن پیام گروهی را وارد کنید:');
  const message = (await conversation.form.text()).trim().slice(0, 4000);

  const count = await conversation.external(async () => {
    if (target === 'ALL') return prisma.user.count({ where: { isBlocked: false } });
    if (target === 'ACTIVE') {
      return prisma.user.count({
        where: { isBlocked: false, subscriptions: { some: { status: 'ACTIVE' } } },
      });
    }
    return prisma.user.count({
      where: { isBlocked: false, subscriptions: { none: { status: 'ACTIVE' } } },
    });
  });

  await ctx.reply(`پیام به ${count} کاربر ارسال خواهد شد. تایید؟ (بله / خیر)`);
  const confirmText = await conversation.form.text();
  if (confirmText.trim() !== 'بله') {
    await ctx.reply('❌ ارسال لغو شد.');
    return;
  }

  await conversation.external(async () => {
    const broadcast = await prisma.broadcast.create({
      data: { target, message, totalCount: count, createdById: adminId },
    });
    const queue = new Queue(QUEUE_NAMES.broadcast, { connection: getRedis() });
    try {
      await queue.add('send', { broadcastId: broadcast.id, target, message });
    } finally {
      await queue.close();
    }
  });

  ctx.session.broadcastTarget = undefined;
  await ctx.reply('✅ پیام گروهی در صف ارسال قرار گرفت.');
}

/** Admin sends a direct message to a user. */
async function directMessageBuilder(conversation: Conv, ctx: Ctx): Promise<void> {
  const targetId = ctx.session.adminMsgUserId;
  if (!targetId) {
    await ctx.reply('❌ خطایی رخ داد.');
    return;
  }
  await ctx.reply('📩 متن پیام را وارد کنید:');
  const directText = (await conversation.form.text()).trim().slice(0, 4000);

  const sent = await conversation.external(async () => {
    const user = await prisma.user.findUnique({ where: { id: targetId } });
    if (!user) return false;
    try {
      await ctx.api.sendMessage(Number(user.telegramId), directText);
      return true;
    } catch {
      return false;
    }
  });

  ctx.session.adminMsgUserId = undefined;
  await ctx.reply(sent ? '✅ پیام ارسال شد.' : '❌ ارسال پیام ناموفق بود.');
}

export const rejectReasonConversation = createConversation(rejectReasonBuilder, 'reject-reason');
export const balanceChangeConversation = createConversation(balanceChangeBuilder, 'balance-change');
export const broadcastConversation = createConversation(broadcastBuilder, 'broadcast');
export const directMessageConversation = createConversation(directMessageBuilder, 'direct-message');
