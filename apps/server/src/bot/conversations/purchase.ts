import type { Bot } from 'grammy';
import { createConversation, type Conversation } from '@grammyjs/conversations';
import { prisma } from '@vitoribot/db';
import { formatToman } from '@vitoribot/persian';
import type { BotContext } from '../types.js';
import { quoteWithDiscount } from '../services/pricing.js';
import { storeTelegramPhoto } from '../services/storage.js';
import { notifyNewReceipt } from '../notify.js';
import { loadTemplate } from '../renderer.js';

type Ctx = BotContext;
type Conv = Conversation<Ctx, Ctx>;

const RECEIPT_TIMEOUT_MS = 15 * 60 * 1000;

async function getCardSettings(): Promise<{ number: string; holder: string; bank: string }> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['payment.card_number', 'payment.card_holder', 'payment.card_bank'] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    number: map.get('payment.card_number') ?? '—',
    holder: map.get('payment.card_holder') ?? '—',
    bank: map.get('payment.card_bank') ?? '—',
  };
}

function cardMessage(amount: string, card: { number: string; holder: string; bank: string }): string {
  return (
    `💳 برای پرداخت مبلغ ${amount} تومان به شماره کارت زیر واریز کنید:\n` +
    `\`${card.number}\`\n` +
    `به نام: ${card.holder} — ${card.bank}\n\n` +
    `⏱ لطفاً در ۱۵ دقیقه پس از واریز، تصویر رسید را ارسال کنید.\n` +
    `برای انصراف /cancel را بفرستید.`
  );
}

/** Wait for a receipt photo; returns file_id or null on cancel/timeout. */
async function waitForPhoto(conversation: Conv, ctx: Ctx): Promise<string | null> {
  for (;;) {
    let update;
    try {
      update = await conversation.waitFor([':photo', ':text'], {
        maxMilliseconds: RECEIPT_TIMEOUT_MS,
      });
    } catch {
      await ctx.reply('⏱ زمان ارسال رسید به پایان رسید. سفارش لغو شد.');
      return null;
    }
    if (!update) {
      await ctx.reply('⏱ زمان ارسال رسید به پایان رسید. سفارش لغو شد.');
      return null;
    }
    if (update.message?.text === '/cancel') {
      await ctx.reply('❌ سفارش لغو شد.');
      return null;
    }
    const photos = update.message?.photo;
    if (photos && photos.length > 0) {
      const best = photos[photos.length - 1];
      if (best) return best.file_id;
    }
    await ctx.reply('📷 لطفاً تصویر رسید پرداخت را ارسال کنید.');
  }
}

async function purchaseBuilder(conversation: Conv, ctx: Ctx): Promise<void> {
  const productId = ctx.session.purchaseProductId;
  const dbUserId = ctx.session.dbUserId;
  if (!productId || !dbUserId) {
    await ctx.reply('❌ خطایی رخ داد. لطفاً دوباره تلاش کنید.');
    return;
  }

  const product = await conversation.external(async () => {
    const p = await prisma.product.findUnique({
      where: { id: productId },
      include: { panel: true },
    });
    const card = await getCardSettings();
    return { product: p, card };
  });
  if (!product.product || !product.product.isActive) {
    await ctx.reply('❌ این محصول در حال حاضر فعال نیست.');
    return;
  }
  const basePrice = Number(product.product.price);

  let finalPrice = basePrice;
  let discountCodeId: string | undefined;
  const code = ctx.session.discountCode;
  if (code) {
    try {
      const res = await conversation.external(() =>
        quoteWithDiscount(code, dbUserId, basePrice),
      );
      finalPrice = res.quote.finalPrice;
      discountCodeId = res.discountCodeId;
      await ctx.reply(`✅ ${res.quote.description} اعمال شد.`);
    } catch (err) {
      await ctx.reply(`⚠️ ${(err as Error).message} بدون تخفیف ادامه می‌دهیم.`);
    }
  }

  await ctx.reply(cardMessage(formatToman(finalPrice), product.card), {
    parse_mode: 'MarkdownV2',
  });

  const fileId = await waitForPhoto(conversation, ctx);
  if (!fileId) return;

  const result = await conversation.external(async () => {
    const stored = await storeTelegramPhoto(
      async (fid: string) => {
        const f = await ctx.api.getFile(fid);
        return f.file_path ?? '';
      },
      fileId,
      'receipts',
    );
    const tx = await prisma.transaction.create({
      data: {
        userId: dbUserId,
        amount: finalPrice,
        type: 'PURCHASE',
        status: 'PENDING',
        description: `Purchase ${product.product!.name}`,
        metadata: { productId, discountCodeId, kind: 'PURCHASE' },
        paymentReceipt: {
          create: { userId: dbUserId, imageStoragePath: stored, imageTelegramFileId: fileId },
        },
      },
    });
    if (discountCodeId) {
      await prisma.discountCodeUse.create({
        data: { discountCodeId, userId: dbUserId, transactionId: tx.id },
      });
      await prisma.discountCode.update({
        where: { id: discountCodeId },
        data: { usedCount: { increment: 1 } },
      });
    }
    return tx.id;
  });

  await conversation.external(() =>
    notifyNewReceipt(ctx as unknown as Bot<Ctx>, {
      transactionId: result,
      name: ctx.from?.first_name ?? '',
      username: ctx.from?.username,
      amount: formatToman(finalPrice),
      productName: product.product!.name,
      photoFileId: fileId,
    }),
  );

  ctx.session.purchaseProductId = undefined;
  ctx.session.discountCode = undefined;
  await ctx.reply(await loadTemplate('receipt_received'));
}

async function chargeBuilder(conversation: Conv, ctx: Ctx): Promise<void> {
  const dbUserId = ctx.session.dbUserId;
  if (!dbUserId) {
    await ctx.reply('❌ خطایی رخ داد. لطفاً دوباره تلاش کنید.');
    return;
  }

  const limits = await conversation.external(async () => {
    const rows = await prisma.setting.findMany({
      where: { key: { in: ['store.min_charge_amount', 'store.max_charge_amount'] } },
    });
    const map = new Map(rows.map((r) => [r.key, r.value]));
    const card = await getCardSettings();
    return {
      min: Number(map.get('store.min_charge_amount') ?? 10000),
      max: Number(map.get('store.max_charge_amount') ?? 10000000),
      card,
    };
  });

  await ctx.reply(
    `💰 مبلغ شارژ را به تومان وارد کنید (بین ${formatToman(limits.min)} تا ${formatToman(limits.max)}):`,
  );
  const amountText = await conversation.form.text();
  const amount = Number(amountText.replace(/[٬, ]/g, ''));
  if (!Number.isFinite(amount) || amount < limits.min || amount > limits.max) {
    await ctx.reply('❌ مبلغ نامعتبر است. عملیات لغو شد.');
    return;
  }

  await ctx.reply(cardMessage(formatToman(amount), limits.card), { parse_mode: 'MarkdownV2' });
  const fileId = await waitForPhoto(conversation, ctx);
  if (!fileId) return;

  const txId = await conversation.external(async () => {
    const stored = await storeTelegramPhoto(
      async (fid: string) => {
        const f = await ctx.api.getFile(fid);
        return f.file_path ?? '';
      },
      fileId,
      'receipts',
    );
    const tx = await prisma.transaction.create({
      data: {
        userId: dbUserId,
        amount,
        type: 'CHARGE',
        status: 'PENDING',
        description: 'Wallet charge',
        metadata: { kind: 'CHARGE' },
        paymentReceipt: {
          create: { userId: dbUserId, imageStoragePath: stored, imageTelegramFileId: fileId },
        },
      },
    });
    return tx.id;
  });

  await conversation.external(() =>
    notifyNewReceipt(ctx as unknown as Bot<Ctx>, {
      transactionId: txId,
      name: ctx.from?.first_name ?? '',
      username: ctx.from?.username,
      amount: formatToman(amount),
      productName: 'شارژ کیف پول',
      photoFileId: fileId,
    }),
  );
  await ctx.reply(await loadTemplate('receipt_received'));
}

export const purchaseConversation = createConversation(purchaseBuilder, 'purchase');
export const chargeConversation = createConversation(chargeBuilder, 'charge');
