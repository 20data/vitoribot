import type { Bot } from 'grammy';
import { prisma } from '@vitoribot/db';
import { ThreeXUIClient } from '@vitoribot/3xui';
import { formatToman } from '@vitoribot/persian';
import type { BotContext } from '../types.js';
import { payMethodKeyboard } from '../keyboards.js';
import { quoteWithDiscount, redeemGiftCode } from '../services/pricing.js';
import { getRedis } from '../../lib/redis.js';
import { encrypt } from '../../lib/encryption.js';

/** Plain-text state machine for short multi-step inputs outside conversations. */
export function registerTextState(bot: Bot<BotContext>): void {
  bot.on(':text', async (ctx, next) => {
    const text = ctx.message?.text?.trim() ?? '';
    if (text.startsWith('/')) {
      await next();
      return;
    }
    const dbUserId = ctx.session.dbUserId;
    if (!dbUserId) {
      await next();
      return;
    }

    // Discount/gift code during purchase.
    if (ctx.session.awaitingDiscount) {
      const productId = ctx.session.awaitingDiscount;
      ctx.session.awaitingDiscount = undefined;
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        await next();
        return;
      }
      try {
        const res = await quoteWithDiscount(text, dbUserId, Number(product.price));
        ctx.session.discountCode = text.trim().toUpperCase();
        await ctx.reply(
          `✅ ${res.quote.description} اعمال شد.\n💰 مبلغ نهایی: ${formatToman(res.quote.finalPrice)} تومان\n\nروش پرداخت را انتخاب کنید:`,
          { reply_markup: payMethodKeyboard(product.id) },
        );
        return;
      } catch {
        // Fall through: maybe a gift code.
      }
      try {
        const amount = await redeemGiftCode(text, dbUserId);
        await ctx.reply(
          `🎁 کد هدیه اعمال شد: ${formatToman(amount)} تومان به کیف پول اضافه شد.\n\nروش پرداخت را انتخاب کنید:`,
          { reply_markup: payMethodKeyboard(product.id) },
        );
        return;
      } catch (err) {
        await ctx.reply(
          `❌ ${(err as Error).message}\nبدون کد ادامه می‌دهیم — روش پرداخت را انتخاب کنید:`,
          { reply_markup: payMethodKeyboard(product.id) },
        );
        return;
      }
    }

    // Gift code redeem from profile.
    if (ctx.session.awaitingGift) {
      ctx.session.awaitingGift = undefined;
      try {
        const amount = await redeemGiftCode(text, dbUserId);
        await ctx.reply(`🎁 ${formatToman(amount)} تومان به کیف پول شما اضافه شد. ✅`);
      } catch (err) {
        await ctx.reply(`❌ ${(err as Error).message}`);
      }
      return;
    }

    // Admin payment setting edit.
    if (ctx.session.awaitingSetting) {
      const key = ctx.session.awaitingSetting;
      ctx.session.awaitingSetting = undefined;
      await prisma.setting.upsert({
        where: { key },
        update: { value: text },
        create: { key, value: text },
      });
      await prisma.adminLog.create({
        data: {
          adminId: dbUserId,
          action: 'SETTINGS_CHANGE',
          targetType: 'Setting',
          targetId: key,
          metadata: { key },
          ipAddress: 'bot',
          userAgent: 'telegram-bot',
        },
      });
      await ctx.reply('✅ تنظیمات ذخیره شد.');
      return;
    }

    // Admin force-join channel add: "@username, -100123, Title".
    if (ctx.session.awaitingChannel) {
      ctx.session.awaitingChannel = undefined;
      const parts = text.split(',').map((p) => p.trim());
      if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
        await ctx.reply('❌ قالب نامعتبر است. مثال: `@channel, -1001234567890, کانال اصلی`');
        return;
      }
      const username = parts[0].replace('@', '');
      const channelId = BigInt(parts[1].replace(/[^0-9-]/g, ''));
      await prisma.forceJoinChannel.create({
        data: { channelId, channelUsername: username, channelTitle: parts[2] as string },
      });
      await ctx.reply('✅ کانال اجباری اضافه شد.');
      return;
    }

    // Admin panel add wizard.
    if (ctx.session.adminPanelStep !== undefined) {
      const step = ctx.session.adminPanelStep;
      const draft = ctx.session.adminPanelDraft ?? {};
      if (step === 0) {
        draft.name = text.slice(0, 100);
        ctx.session.adminPanelDraft = draft;
        ctx.session.adminPanelStep = 1;
        await ctx.reply('🔗 آدرس پنل را وارد کنید (مثل https://panel.example.com:2053):');
        return;
      }
      if (step === 1) {
        try {
          const u = new URL(text);
          if (!u.protocol.startsWith('http')) throw new Error('bad');
          draft.url = text.replace(/\/+$/, '');
        } catch {
          await ctx.reply('❌ آدرس نامعتبر است. دوباره وارد کنید:');
          return;
        }
        ctx.session.adminPanelDraft = draft;
        ctx.session.adminPanelStep = 2;
        await ctx.reply('👤 نام کاربری پنل را وارد کنید:');
        return;
      }
      if (step === 2) {
        draft.username = text.slice(0, 100);
        ctx.session.adminPanelDraft = draft;
        ctx.session.adminPanelStep = 3;
        await ctx.reply('🔑 رمز عبور پنل را وارد کنید:');
        return;
      }
      // step 3: password → test connection → save encrypted.
      ctx.session.adminPanelStep = undefined;
      ctx.session.adminPanelDraft = undefined;
      await ctx.reply('⏳ در حال تست اتصال به پنل...');
      try {
        const client = new ThreeXUIClient('new', draft.url ?? '', draft.username ?? '', text, {
          get: async (k: string) => getRedis().get(k),
          set: async (k: string, v: string, ttl: number) =>
            void (await getRedis().set(k, v, 'EX', ttl)),
        });
        await client.login();
        await prisma.panel.create({
          data: {
            name: draft.name ?? 'پنل جدید',
            url: draft.url ?? '',
            username: draft.username ?? '',
            encryptedPass: encrypt(text),
          },
        });
        await prisma.adminLog.create({
          data: {
            adminId: dbUserId,
            action: 'PANEL_ADD',
            targetType: 'Panel',
            metadata: { name: draft.name },
            ipAddress: 'bot',
            userAgent: 'telegram-bot',
          },
        });
        await ctx.reply('✅ پنل با موفقیت اضافه شد.');
      } catch (err) {
        await ctx.reply(`❌ اتصال به پنل ناموفق بود: ${(err as Error).message}`);
      }
      return;
    }

    await next();
  });
}
