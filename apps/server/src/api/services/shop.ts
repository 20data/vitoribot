import type { Bot } from 'grammy';
import { prisma } from '@vitoribot/db';
import type { BotContext } from '../../bot/types.js';
import { quoteWithDiscount, redeemGiftCode } from '../../bot/services/pricing.js';
import { notifyNewReceipt } from '../../bot/notify.js';
import { formatToman } from '@vitoribot/persian';

export interface PurchaseQuote {
  transactionId: string;
  amount: number;
  card: { number: string; holder: string; bank: string };
}

async function cardInfo(): Promise<PurchaseQuote['card']> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['payment.card_number', 'payment.card_holder', 'payment.card_bank'] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    number: map.get('payment.card_number') ?? '',
    holder: map.get('payment.card_holder') ?? '',
    bank: map.get('payment.card_bank') ?? '',
  };
}

/** Create a PENDING purchase transaction (mini app). Receipt is attached separately. */
export async function createPurchase(
  userId: string,
  productId: string,
  discountCode?: string,
): Promise<PurchaseQuote> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { panel: true },
  });
  if (!product || !product.isActive || !product.panel.isActive) {
    throw new Error('محصول فعال نیست.');
  }
  let finalPrice = Number(product.price);
  let discountCodeId: string | undefined;
  if (discountCode) {
    try {
      const res = await quoteWithDiscount(discountCode, userId, finalPrice);
      finalPrice = res.quote.finalPrice;
      discountCodeId = res.discountCodeId;
    } catch {
      // Maybe a gift code → redeem to wallet, continue at full price.
      await redeemGiftCode(discountCode, userId);
    }
  }
  const tx = await prisma.transaction.create({
    data: {
      userId,
      amount: finalPrice,
      type: 'PURCHASE',
      status: 'PENDING',
      description: `Purchase ${product.name} (miniapp)`,
      metadata: { productId, discountCodeId, kind: 'PURCHASE' },
    },
  });
  if (discountCodeId) {
    await prisma.discountCodeUse.create({
      data: { discountCodeId, userId, transactionId: tx.id },
    });
    await prisma.discountCode.update({
      where: { id: discountCodeId },
      data: { usedCount: { increment: 1 } },
    });
  }
  return { transactionId: tx.id, amount: finalPrice, card: await cardInfo() };
}

/** Create a PENDING wallet charge (mini app). */
export async function createCharge(userId: string, amount: number): Promise<PurchaseQuote> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['store.min_charge_amount', 'store.max_charge_amount'] } },
  });
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const min = Number(map.get('store.min_charge_amount') ?? 10000);
  const max = Number(map.get('store.max_charge_amount') ?? 10000000);
  if (!Number.isFinite(amount) || amount < min || amount > max) {
    throw new Error('مبلغ نامعتبر است.');
  }
  const tx = await prisma.transaction.create({
    data: {
      userId,
      amount,
      type: 'CHARGE',
      status: 'PENDING',
      description: 'Wallet charge (miniapp)',
      metadata: { kind: 'CHARGE' },
    },
  });
  return { transactionId: tx.id, amount, card: await cardInfo() };
}

export interface ReceiptAttach {
  transactionId: string;
  storagePath: string;
  telegramFileId?: string;
}

/** Attach an uploaded receipt image to a PENDING transaction and alert admins. */
export async function attachReceipt(
  bot: Bot<BotContext>,
  userId: string,
  input: ReceiptAttach,
): Promise<void> {
  const tx = await prisma.transaction.findUnique({
    where: { id: input.transactionId },
    include: { user: true, paymentReceipt: true },
  });
  if (!tx || tx.userId !== userId) throw new Error('تراکنش یافت نشد.');
  if (tx.status !== 'PENDING') throw new Error('تراکنش قابل پرداخت نیست.');
  if (tx.paymentReceipt) throw new Error('رسید قبلاً ثبت شده است.');
  await prisma.paymentReceipt.create({
    data: {
      transactionId: tx.id,
      userId,
      imageStoragePath: input.storagePath,
      imageTelegramFileId: input.telegramFileId,
    },
  });
  const meta = (tx.metadata ?? {}) as { productId?: string };
  let productName = 'شارژ کیف پول';
  if (meta.productId) {
    const p = await prisma.product.findUnique({ where: { id: meta.productId } });
    if (p) productName = p.name;
  }
  const user = tx.user;
  await notifyNewReceipt(bot, {
    transactionId: tx.id,
    name: `${user.firstName} ${user.lastName ?? ''}`.trim(),
    username: user.username ?? undefined,
    amount: formatToman(tx.amount.toString()),
    productName,
    photoFileId: input.telegramFileId ?? '',
  });
}
