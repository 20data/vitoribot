import type { Bot } from 'grammy';
import { createConversation, type Conversation } from '@grammyjs/conversations';
import { prisma } from '@vitoribot/db';
import type { BotContext } from '../types.js';
import { notifySupport } from '../notify.js';

type Ctx = BotContext;
type Conv = Conversation<Ctx, Ctx>;

async function newTicketBuilder(conversation: Conv, ctx: Ctx): Promise<void> {
  const dbUserId = ctx.session.dbUserId;
  const deptId = ctx.session.ticketDeptId;
  if (!dbUserId || !deptId) {
    await ctx.reply('❌ خطایی رخ داد. لطفاً دوباره تلاش کنید.');
    return;
  }

  await ctx.reply('📝 موضوع تیکت را وارد کنید:');
  const subjectText = await conversation.form.text();
  const subject = subjectText.trim().slice(0, 200);
  if (subject.length === 0) {
    await ctx.reply('❌ موضوع نامعتبر است. عملیات لغو شد.');
    return;
  }

  await ctx.reply('💬 متن پیام خود را وارد کنید:');
  const messageText = await conversation.form.text();
  const message = messageText.trim().slice(0, 4000);
  if (message.length === 0) {
    await ctx.reply('❌ متن پیام نامعتبر است. عملیات لغو شد.');
    return;
  }

  const ticket = await conversation.external(async () => {
    const t = await prisma.ticket.create({
      data: {
        userId: dbUserId,
        departmentId: deptId,
        subject,
        messages: {
          create: { senderId: dbUserId, senderRole: 'USER', message },
        },
      },
      include: { department: true },
    });
    return t;
  });

  await conversation.external(() =>
    notifySupport(
      ctx as unknown as Bot<Ctx>,
      `🎫 تیکت جدید\n📂 دپارتمان: ${ticket.department.name}\n📝 موضوع: ${subject}\n👤 کاربر: ${ctx.from?.first_name ?? ''}`,
    ),
  );

  ctx.session.ticketDeptId = undefined;
  await ctx.reply('✅ تیکت شما ثبت شد. کارشناسان به‌زودی پاسخ می‌دهند.');
}

async function replyTicketBuilder(conversation: Conv, ctx: Ctx): Promise<void> {
  const dbUserId = ctx.session.dbUserId;
  const ticketId = ctx.session.replyTicketId;
  if (!dbUserId || !ticketId) {
    await ctx.reply('❌ خطایی رخ داد. لطفاً دوباره تلاش کنید.');
    return;
  }

  await ctx.reply('↩️ پاسخ خود را وارد کنید:');
  const replyText = await conversation.form.text();
  const message = replyText.trim().slice(0, 4000);
  if (message.length === 0) {
    await ctx.reply('❌ متن نامعتبر است. عملیات لغو شد.');
    return;
  }

  await conversation.external(async () => {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { user: true },
    });
    if (!ticket) throw new Error('Ticket not found');
    const senderRole =
      ticket.userId === dbUserId
        ? 'USER'
        : ((await prisma.user.findUnique({ where: { id: dbUserId } }))?.role ?? 'USER');
    await prisma.ticketMessage.create({
      data: { ticketId, senderId: dbUserId, senderRole, message },
    });
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: senderRole === 'USER' ? 'OPEN' : 'ANSWERED' },
    });
    // Notify the other side.
    const targetTelegramId =
      ticket.userId === dbUserId
        ? (
            await prisma.user.findMany({
              where: { role: { in: ['SUPPORT', 'ADMIN', 'SUPER_ADMIN'] } },
              select: { telegramId: true },
              take: 1,
            })
          )[0]?.telegramId
        : ticket.user.telegramId;
    if (targetTelegramId) {
      try {
        await ctx.api.sendMessage(
          Number(targetTelegramId),
          '💬 پاسخ جدید در تیکت دریافت شد.',
        );
      } catch {
        // ignore delivery failures
      }
    }
  });

  ctx.session.replyTicketId = undefined;
  await ctx.reply('✅ پاسخ شما ثبت شد.');
}

export const newTicketConversation = createConversation(newTicketBuilder, 'new-ticket');
export const replyTicketConversation = createConversation(replyTicketBuilder, 'reply-ticket');
