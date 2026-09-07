import { prisma } from '@vitoribot/db';

export interface PriceQuote {
  finalPrice: number;
  discountAmount: number;
  description: string | null;
}

/** Validate a discount code and compute the final price. Throws with Persian message on failure. */
export async function quoteWithDiscount(
  code: string,
  userId: string,
  basePrice: number,
  transactionIdForCheck?: string,
): Promise<{ quote: PriceQuote; discountCodeId: string }> {
  const normalized = code.trim().toUpperCase();
  const dc = await prisma.discountCode.findUnique({ where: { code: normalized } });
  if (!dc || !dc.isActive) throw new Error('کد تخفیف معتبر نیست.');
  const now = new Date();
  if (dc.validFrom && now < dc.validFrom) throw new Error('کد تخفیف هنوز فعال نشده است.');
  if (dc.validTo && now > dc.validTo) throw new Error('کد تخفیف منقضی شده است.');
  if (dc.maxUses !== null && dc.usedCount >= dc.maxUses) throw new Error('ظرفیت کد تخفیف تکمیل شده است.');
  const already = await prisma.discountCodeUse.findUnique({
    where: { discountCodeId_userId: { discountCodeId: dc.id, userId } },
  });
  if (already) throw new Error('شما قبلاً از این کد استفاده کرده‌اید.');
  void transactionIdForCheck;

  const value = Number(dc.value);
  const discountAmount =
    dc.type === 'PERCENT' ? Math.round((basePrice * value) / 100) : Math.min(value, basePrice);
  return {
    quote: {
      finalPrice: Math.max(0, basePrice - discountAmount),
      discountAmount,
      description: dc.type === 'PERCENT' ? `${value}٪ تخفیف` : `${value} تومان تخفیف`,
    },
    discountCodeId: dc.id,
  };
}

/** Redeem a gift code into the user's wallet. Throws with Persian message on failure. */
export async function redeemGiftCode(code: string, userId: string): Promise<number> {
  const normalized = code.trim().toUpperCase();
  const gift = await prisma.giftCode.findUnique({ where: { code: normalized } });
  if (!gift || !gift.isActive) throw new Error('کد هدیه معتبر نیست.');
  if (gift.maxUses !== null && gift.usedCount >= gift.maxUses) {
    throw new Error('ظرفیت کد هدیه تکمیل شده است.');
  }
  const already = await prisma.giftCodeUse.findUnique({
    where: { giftCodeId_userId: { giftCodeId: gift.id, userId } },
  });
  if (already) throw new Error('شما قبلاً از این کد استفاده کرده‌اید.');

  const amount = Number(gift.amount);
  await prisma.$transaction([
    prisma.giftCodeUse.create({
      data: { giftCodeId: gift.id, userId },
    }),
    prisma.giftCode.update({
      where: { id: gift.id },
      data: { usedCount: { increment: 1 } },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: amount } },
    }),
    prisma.transaction.create({
      data: {
        userId,
        amount,
        type: 'GIFT',
        status: 'CONFIRMED',
        description: `Redeem gift code ${normalized}`,
        confirmedAt: new Date(),
      },
    }),
  ]);
  return amount;
}
