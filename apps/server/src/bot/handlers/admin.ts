import type { Bot } from 'grammy';
import { InlineKeyboard } from 'grammy';
import { prisma } from '@vitoribot/db';
import { ThreeXUIClient } from '@vitoribot/3xui';
import { formatToman, toFaDigits, toJalali } from '@vitoribot/persian';
import type { BotContext } from '../types.js';
import { adminOnly, superAdminOnly } from '../middleware/admin.js';
import { getDashboardStats } from '../services/stats.js';
import { formatDashboard } from '../services/receipts.js';
import { receiptReviewKeyboard, userManageKeyboard } from '../keyboards.js';
import { getRedis } from '../../lib/redis.js';

/** Admin bot panel: dashboard, receipts, users, broadcast, panels, settings. */
export function registerAdmin(bot: Bot<BotContext>): void {
  bot.hears('📊 داشبورد', async (ctx) => {
    const stats = await getDashboardStats();
    await ctx.reply(formatDashboard(stats));
  });

  bot.hears('🧾 رسیدهای در انتظار', async (ctx) => {
    const pending = await prisma.paymentReceipt.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 5,
      include: { transaction: { include: { user: true } } },
    });
    if (pending.length === 0) {
      await ctx.reply('✅ رسید در انتظاری وجود ندارد.');
      return;
    }
    for (const r of pending) {
      const caption =
        `🧾 رسید پرداخت\n` +
        `👤 کاربر: ${r.transaction.user.firstName} (@${r.transaction.user.username ?? '—'})\n` +
        `💰 مبلغ: ${formatToman(r.transaction.amount.toString())} تومان\n` +
        `📅 ${toJalali(r.createdAt)}`;
      try {
        if (r.imageTelegramFileId) {
          await ctx.api.sendPhoto(ctx.chat!.id, r.imageTelegramFileId, {
            caption,
            reply_markup: receiptReviewKeyboard(r.transactionId),
          });
        } else {
          await ctx.reply(`${caption}\n\nفایل: ${r.imageStoragePath}`, {
            reply_markup: receiptReviewKeyboard(r.transactionId),
          });
        }
      } catch {
        // ignore per-item failures
      }
    }
  });

  bot.hears('👥 کاربران', async (ctx) => {
    await ctx.reply('🔍 برای جستجوی کاربر از دستور زیر استفاده کنید:\n`/user <شناسه تلگرام یا یوزرنیم یا نام>`', {
      parse_mode: 'MarkdownV2',
    });
  });

  bot.command('user', async (ctx) => {
    const query = ctx.match.trim();
    if (!query) {
      await ctx.reply('🔍 مثال: /user 123456789');
      return;
    }
    const numeric = /^-?\d+$/.test(query) ? BigInt(query) : null;
    const user = numeric
      ? await prisma.user.findUnique({ where: { telegramId: numeric } })
      : await prisma.user.findFirst({
          where: {
            OR: [
              { username: query.replace('@', '') },
              { firstName: { contains: query } },
              { lastName: { contains: query } },
            ],
          },
        });
    if (!user) {
      await ctx.reply('❌ کاربر یافت نشد.');
      return;
    }
    const subs = await prisma.subscription.count({
      where: { userId: user.id, status: 'ACTIVE' },
    });
    await ctx.reply(
      `👤 ${user.firstName} ${user.lastName ?? ''} (@${user.username ?? '—'})\n` +
        `🆔 ${user.telegramId}\n💰 موجودی: ${formatToman(user.balance.toString())} تومان\n` +
        `📦 سرویس‌های فعال: ${toFaDigits(subs)}\n📅 عضویت: ${toJalali(user.createdAt)}\n` +
        `وضعیت: ${user.isBlocked ? '🚫 مسدود' : '✅ عادی'} | نقش: ${user.role}`,
      { reply_markup: userManageKeyboard(user.id, user.isBlocked) },
    );
  });

  bot.callbackQuery(/^admin:block:(.+)$/, adminOnly(), async (ctx) => {
    const userId = ctx.match?.[1];
    if (!userId) return;
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) return;
    const adminId = ctx.session.dbUserId;
    if (!adminId) return;
    await prisma.user.update({ where: { id: userId }, data: { isBlocked: !target.isBlocked } });
    await prisma.adminLog.create({
      data: {
        adminId,
        action: target.isBlocked ? 'USER_UNBLOCK' : 'USER_BLOCK',
        targetType: 'User',
        targetId: userId,
        ipAddress: 'bot',
        userAgent: 'telegram-bot',
      },
    });
    await ctx.answerCallbackQuery(target.isBlocked ? '✅ رفع بلاک شد' : '🚫 بلاک شد');
  });

  bot.callbackQuery(/^admin:balance-add:(.+)$/, adminOnly(), async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.adminTargetUserId = ctx.match?.[1];
    ctx.session.adminBalanceMode = 'add';
    await ctx.conversation.enter('balance-change');
  });

  bot.callbackQuery(/^admin:balance-sub:(.+)$/, adminOnly(), async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.adminTargetUserId = ctx.match?.[1];
    ctx.session.adminBalanceMode = 'sub';
    await ctx.conversation.enter('balance-change');
  });

  bot.callbackQuery(/^admin:msg:(.+)$/, adminOnly(), async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.adminMsgUserId = ctx.match?.[1];
    await ctx.conversation.enter('direct-message');
  });

  bot.callbackQuery(/^admin:services:(.+)$/, adminOnly(), async (ctx) => {
    await ctx.answerCallbackQuery();
    const subs = await prisma.subscription.findMany({
      where: { userId: ctx.match?.[1] },
      include: { product: true },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    if (subs.length === 0) {
      await ctx.reply('📋 سرویسی ندارد.');
      return;
    }
    await ctx.reply(
      subs.map((s) => `• ${s.product.name} — ${s.status} — ${s.clientEmail}`).join('\n'),
    );
  });

  bot.callbackQuery(/^admin:txns:(.+)$/, adminOnly(), async (ctx) => {
    await ctx.answerCallbackQuery();
    const txns = await prisma.transaction.findMany({
      where: { userId: ctx.match?.[1] },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });
    if (txns.length === 0) {
      await ctx.reply('📜 تراکنشی ندارد.');
      return;
    }
    await ctx.reply(
      txns
        .map((t) => `• ${formatToman(t.amount.toString())} — ${t.type} — ${t.status}`)
        .join('\n'),
    );
  });

  // Broadcast target selection (SUPER_ADMIN only at entry to conversation).
  bot.hears('📢 پیام گروهی', async (ctx) => {
    const kb = new InlineKeyboard()
      .text('همه کاربران', 'broadcast:ALL')
      .text('دارای سرویس فعال', 'broadcast:ACTIVE')
      .row()
      .text('بدون سرویس فعال', 'broadcast:INACTIVE');
    await ctx.reply('📢 مخاطب پیام گروهی را انتخاب کنید:', { reply_markup: kb });
  });

  bot.callbackQuery(/^broadcast:(ALL|ACTIVE|INACTIVE)$/, superAdminOnly(), async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.broadcastTarget = ctx.match?.[1] as 'ALL' | 'ACTIVE' | 'INACTIVE';
    await ctx.conversation.enter('broadcast');
  });

  bot.hears('🏷️ محصولات', async (ctx) => {
    const products = await prisma.product.findMany({
      include: { panel: true },
      orderBy: { sortOrder: 'asc' },
      take: 30,
    });
    if (products.length === 0) {
      await ctx.reply('🏷️ محصولی ثبت نشده است. از پنل وب اضافه کنید.');
      return;
    }
    await ctx.reply(
      products
        .map(
          (p) =>
            `${p.isActive ? '🟢' : '⚪'} ${p.groupName} — ${p.name} — ${formatToman(p.price.toString())} تومان — ${p.panel.name}`,
        )
        .join('\n'),
    );
  });

  bot.hears('⚙️ تنظیمات', async (ctx) => {
    const kb = new InlineKeyboard()
      .text('💳 تنظیمات پرداخت', 'settings:payment')
      .text('🛠️ حالت تعمیر', 'settings:maintenance')
      .row()
      .text('📣 کانال‌های اجباری', 'settings:channels')
      .text('🖥️ مدیریت پنل‌ها', 'settings:panels');
    await ctx.reply('⚙️ تنظیمات:', { reply_markup: kb });
  });

  bot.callbackQuery('settings:payment', adminOnly(), async (ctx) => {
    await ctx.answerCallbackQuery();
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['payment.card_number', 'payment.card_holder', 'payment.card_bank'] } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const kb = new InlineKeyboard()
      .text('✏️ شماره کارت', 'settings:edit-card_number')
      .text('✏️ صاحب حساب', 'settings:edit-card_holder')
      .row()
      .text('✏️ بانک', 'settings:edit-card_bank');
    await ctx.reply(
      `💳 تنظیمات پرداخت:\nشماره کارت: ${map.get('payment.card_number') ?? '—'}\nصاحب حساب: ${map.get('payment.card_holder') ?? '—'}\nبانک: ${map.get('payment.card_bank') ?? '—'}`,
      { reply_markup: kb },
    );
  });

  bot.callbackQuery(/^settings:edit-(card_number|card_holder|card_bank)$/, adminOnly(), async (ctx) => {
    await ctx.answerCallbackQuery();
    const field = ctx.match?.[1];
    ctx.session.awaitingSetting = `payment.${field}`;
    await ctx.reply('✏️ مقدار جدید را وارد کنید:');
  });

  bot.callbackQuery('settings:maintenance', adminOnly(), async (ctx) => {
    const row = await prisma.setting.findUnique({ where: { key: 'bot.maintenance_mode' } });
    const next = row?.value === 'true' ? 'false' : 'true';
    await prisma.setting.upsert({
      where: { key: 'bot.maintenance_mode' },
      update: { value: next },
      create: { key: 'bot.maintenance_mode', value: next },
    });
    await ctx.answerCallbackQuery(next === 'true' ? '🛠️ حالت تعمیر فعال شد' : '✅ حالت تعمیر غیرفعال شد');
  });

  bot.callbackQuery('settings:channels', adminOnly(), async (ctx) => {
    await ctx.answerCallbackQuery();
    const channels = await prisma.forceJoinChannel.findMany({ where: { isActive: true } });
    const kb = new InlineKeyboard();
    for (const c of channels) {
      kb.text(`❌ ${c.channelTitle}`, `channel:del:${c.id}`).row();
    }
    kb.text('➕ افزودن کانال', 'channel:add');
    await ctx.reply(
      channels.length === 0
        ? '📣 کانال اجباری ثبت نشده است.'
        : `📣 کانال‌های اجباری:\n${channels.map((c) => `• ${c.channelTitle} (@${c.channelUsername})`).join('\n')}`,
      { reply_markup: kb },
    );
  });

  bot.callbackQuery('channel:add', adminOnly(), async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.awaitingChannel = true;
    await ctx.reply('📣 اطلاعات کانال را با این قالب بفرستید:\n`@username, -1001234567890, عنوان کانال`', {
      parse_mode: 'MarkdownV2',
    });
  });

  bot.callbackQuery(/^channel:del:(.+)$/, adminOnly(), async (ctx) => {
    const id = ctx.match?.[1];
    if (!id) return;
    await prisma.forceJoinChannel.update({ where: { id }, data: { isActive: false } });
    await ctx.answerCallbackQuery('✅ حذف شد');
  });

  bot.callbackQuery('settings:panels', adminOnly(), async (ctx) => {
    await ctx.answerCallbackQuery();
    const panels = await prisma.panel.findMany();
    const kb = new InlineKeyboard().text('➕ افزودن پنل', 'panel:add');
    await ctx.reply(
      panels.length === 0
        ? '🖥️ پلی ثبت نشده است.'
        : `🖥️ پنل‌ها:\n${panels.map((p) => `• ${p.name} — ${p.isOnline ? '🟢 آنلاین' : '🔴 آفلاین'} — ${p.url}`).join('\n')}`,
      { reply_markup: kb },
    );
  });

  bot.callbackQuery('panel:add', adminOnly(), async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.adminPanelStep = 0;
    ctx.session.adminPanelDraft = {};
    await ctx.reply('🖥️ نام نمایشی پنل را وارد کنید:');
  });

  bot.callbackQuery(/^panel:test:(.+)$/, adminOnly(), async (ctx) => {
    const panelId = ctx.match?.[1];
    if (!panelId) return;
    await ctx.answerCallbackQuery('⏳ در حال تست...');
    const panel = await prisma.panel.findUnique({ where: { id: panelId } });
    if (!panel) return;
    try {
      const { decrypt } = await import('../../lib/encryption.js');
      const client = new ThreeXUIClient(panel.id, panel.url, panel.username, decrypt(panel.encryptedPass), {
        get: async (k: string) => getRedis().get(k),
        set: async (k: string, v: string, ttl: number) => void (await getRedis().set(k, v, 'EX', ttl)),
      });
      await client.login();
      await ctx.reply(`✅ اتصال به ${panel.name} موفق بود.`);
    } catch (err) {
      await ctx.reply(`❌ اتصال ناموفق: ${(err as Error).message}`);
    }
  });
}
