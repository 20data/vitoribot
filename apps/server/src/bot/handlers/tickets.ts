import type { Bot } from 'grammy';
import { prisma } from '@vitoribot/db';
import type { BotContext } from '../types.js';
import { departmentsKeyboard, ticketViewKeyboard } from '../keyboards.js';

/** Ticket flows: FAQ, new ticket (departments → conversation), thread view + reply. */
export function registerTickets(bot: Bot<BotContext>): void {
  bot.callbackQuery('ticket:faq', async (ctx) => {
    await ctx.answerCallbackQuery();
    const faqs = await prisma.botMessage.findMany({
      where: { key: { startsWith: 'faq.' } },
      orderBy: { key: 'asc' },
    });
    if (faqs.length === 0) {
      await ctx.reply('❓ سوالات متداولی ثبت نشده است.');
      return;
    }
    for (const f of faqs) {
      await ctx.reply(f.content);
    }
  });

  bot.callbackQuery('ticket:new', async (ctx) => {
    await ctx.answerCallbackQuery();
    const depts = await prisma.department.findMany({ where: { isActive: true } });
    if (depts.length === 0) {
      await ctx.reply('❌ دپارتمانی فعال نیست.');
      return;
    }
    await ctx.editMessageText('📂 دپارتمان را انتخاب کنید:', {
      reply_markup: departmentsKeyboard(depts.map((d) => ({ id: d.id, name: d.name }))),
    });
  });

  bot.callbackQuery(/^ticket:dept:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const deptId = ctx.match?.[1];
    if (!deptId) return;
    ctx.session.ticketDeptId = deptId;
    try {
      await ctx.deleteMessage();
    } catch {
      // ignore
    }
    await ctx.conversation.enter('new-ticket');
  });

  bot.callbackQuery(/^ticket:view:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const ticketId = ctx.match?.[1];
    if (!ticketId) return;
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: 20 }, department: true },
    });
    if (!ticket) {
      await ctx.reply('❌ تیکت یافت نشد.');
      return;
    }
    const thread = ticket.messages
      .map((m) => `${m.senderRole === 'USER' ? '👤 شما' : '🛠️ پشتیبانی'}: ${m.message}`)
      .join('\n\n');
    await ctx.reply(
      `🎫 ${ticket.subject}\n📂 ${ticket.department.name}\nوضعیت: ${ticket.status}\n\n${thread}`,
      { reply_markup: ticketViewKeyboard(ticket.id) },
    );
  });

  bot.callbackQuery(/^ticket:reply:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const ticketId = ctx.match?.[1];
    if (!ticketId) return;
    ctx.session.replyTicketId = ticketId;
    await ctx.conversation.enter('reply-ticket');
  });

  bot.callbackQuery('ticket:more', async (ctx) => {
    await ctx.answerCallbackQuery('⏩ در این نسخه فقط ۱۰ تیکت آخر نمایش داده می‌شود');
  });
}
