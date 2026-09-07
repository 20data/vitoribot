import type { Bot } from 'grammy';
import { prisma } from '@vitoribot/db';
import { formatToman, toFaDigits } from '@vitoribot/persian';
import type { BotContext } from '../types.js';
import {
  backKeyboard,
  discountAskKeyboard,
  payMethodKeyboard,
  productsKeyboard,
} from '../keyboards.js';

/** Purchase flow: group → product → discount → payment → receipt conversation. */
export function registerBuy(bot: Bot<BotContext>): void {
  bot.callbackQuery(/^buy:group:(\d+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const index = Number(ctx.match?.[1]);
    const groups = await prisma.product.findMany({
      where: { isActive: true, panel: { isActive: true } },
      select: { groupName: true },
      distinct: ['groupName'],
      orderBy: { groupName: 'asc' },
    });
    const group = groups[index]?.groupName;
    if (!group) {
      await ctx.reply('❌ گروه نامعتبر است.');
      return;
    }
    const products = await prisma.product.findMany({
      where: { groupName: group, isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    await ctx.editMessageText(`🌍 گروه ${group} — محصول را انتخاب کنید:`, {
      reply_markup: productsKeyboard(
        products.map((p) => ({
          id: p.id,
          label: `${p.name} | ${toFaDigits(p.trafficGB)} گیگ ${toFaDigits(p.durationDays)} روزه | ${formatToman(p.price.toString())} تومان`,
        })),
      ),
    });
  });

  bot.callbackQuery(/^buy:product:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const productId = ctx.match?.[1];
    if (!productId) return;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product || !product.isActive) {
      await ctx.reply('❌ محصول نامعتبر است.');
      return;
    }
    await ctx.editMessageText(
      `📦 ${product.name}\n📊 ${toFaDigits(product.trafficGB)} گیگابایت | 📅 ${toFaDigits(product.durationDays)} روز\n💰 ${formatToman(product.price.toString())} تومان\n\nکد تخفیف یا هدیه دارید؟`,
      { reply_markup: discountAskKeyboard(product.id) },
    );
  });

  bot.callbackQuery(/^buy:discount-yes:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const productId = ctx.match?.[1];
    if (!productId) return;
    ctx.session.awaitingDiscount = productId;
    await ctx.reply('🏷️ کد تخفیف یا هدیه خود را وارد کنید:');
  });

  bot.callbackQuery(/^buy:discount-no:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const productId = ctx.match?.[1];
    if (!productId) return;
    ctx.session.discountCode = undefined;
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) return;
    await ctx.editMessageText(
      `📦 ${product.name} — ${formatToman(product.price.toString())} تومان\n\nروش پرداخت را انتخاب کنید:`,
      { reply_markup: payMethodKeyboard(product.id) },
    );
  });

  bot.callbackQuery(/^buy:pay-card:(.+)$/, async (ctx) => {
    await ctx.answerCallbackQuery();
    const productId = ctx.match?.[1];
    if (!productId) return;
    ctx.session.purchaseProductId = productId;
    try {
      await ctx.deleteMessage();
    } catch {
      // ignore
    }
    await ctx.conversation.enter('purchase');
  });

  bot.callbackQuery('buy:cancel', async (ctx) => {
    await ctx.answerCallbackQuery();
    ctx.session.purchaseProductId = undefined;
    ctx.session.discountCode = undefined;
    ctx.session.awaitingDiscount = undefined;
    await ctx.editMessageText('❌ خرید لغو شد.', { reply_markup: backKeyboard('menu:home') });
  });
}
