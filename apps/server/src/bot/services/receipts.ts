import crypto from 'node:crypto';
import { prisma } from '@vitoribot/db';
import { formatToman, toFaDigits, toJalali } from '@vitoribot/persian';
import { BYTES_PER_GB, computeExpiryMs, getPanelClient, markPanelOffline } from './panels.js';

export interface ApprovalResult {
  subLink: string;
  expiresAt: Date | null;
}

/**
 * Approve a card-to-card receipt: mark transaction confirmed,
 * provision the client on the correct 3x-ui panel, create subscription.
 */
export async function approveReceipt(
  transactionId: string,
  adminDbId: string,
  onPanelError?: (panelId: string, err: unknown) => Promise<void>,
): Promise<ApprovalResult> {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { paymentReceipt: true },
  });
  if (!tx) throw new Error('Transaction not found');
  if (tx.status !== 'PENDING') throw new Error('Transaction already processed');

  const meta = (tx.metadata ?? {}) as { productId?: string; kind?: string };
  const now = new Date();

  await prisma.transaction.update({
    where: { id: tx.id },
    data: { status: 'CONFIRMED', confirmedAt: now, confirmedById: adminDbId },
  });
  if (tx.paymentReceipt) {
    await prisma.paymentReceipt.update({
      where: { id: tx.paymentReceipt.id },
      data: { status: 'APPROVED', reviewedById: adminDbId, reviewedAt: now },
    });
  }
  await prisma.adminLog.create({
    data: {
      adminId: adminDbId,
      action: 'RECEIPT_APPROVE',
      targetType: 'Transaction',
      targetId: tx.id,
      ipAddress: 'bot',
      userAgent: 'telegram-bot',
    },
  });

  // Wallet top-up: no 3x-ui provisioning needed.
  if (meta.kind === 'CHARGE' || !meta.productId) {
    await prisma.user.update({
      where: { id: tx.userId },
      data: { balance: { increment: tx.amount } },
    });
    return { subLink: '', expiresAt: null };
  }

  const product = await prisma.product.findUnique({
    where: { id: meta.productId },
    include: { panel: true },
  });
  if (!product) throw new Error('Product not found');

  const clientUuid = crypto.randomUUID();
  const subId = crypto.randomBytes(8).toString('hex');
  const rand = crypto.randomBytes(4).toString('hex').slice(0, 8);
  const email = `${product.panel.remarkPrefix}${product.id.slice(0, 4)}-${tx.userId.slice(0, 4)}-${rand}`.slice(0, 32);
  const expiryMs = computeExpiryMs(product.durationDays);
  const totalGB = product.trafficGB * BYTES_PER_GB;

  let subLink: string;
  try {
    const client = await getPanelClient(product.panelId);
    await client.addClient(product.inboundId, {
      uuid: clientUuid,
      email,
      totalGB,
      expiryTime: expiryMs,
      enable: true,
      subId,
    });
    subLink = client.getSubLink(subId);
  } catch (err) {
    await markPanelOffline(product.panelId);
    if (onPanelError) await onPanelError(product.panelId, err);
    throw new Error('Panel connection failed — panel marked offline');
  }

  const expiresAt = expiryMs === 0 ? null : new Date(expiryMs);
  await prisma.subscription.create({
    data: {
      userId: tx.userId,
      productId: product.id,
      panelId: product.panelId,
      inboundId: product.inboundId,
      clientUuid,
      clientEmail: email,
      subId,
      subLink,
    },
  });
  if (expiresAt) {
    await prisma.subscription.updateMany({
      where: { clientUuid },
      data: { expiresAt },
    });
  }
  return { subLink, expiresAt };
}

/** Reject a receipt with a reason. */
export async function rejectReceipt(
  transactionId: string,
  adminDbId: string,
  reason: string,
): Promise<void> {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { paymentReceipt: true },
  });
  if (!tx) throw new Error('Transaction not found');
  if (tx.status !== 'PENDING') throw new Error('Transaction already processed');

  const now = new Date();
  await prisma.transaction.update({
    where: { id: tx.id },
    data: { status: 'REJECTED', confirmedById: adminDbId, confirmedAt: now },
  });
  if (tx.paymentReceipt) {
    await prisma.paymentReceipt.update({
      where: { id: tx.paymentReceipt.id },
      data: { status: 'REJECTED', rejectionReason: reason, reviewedById: adminDbId, reviewedAt: now },
    });
  }
  await prisma.adminLog.create({
    data: {
      adminId: adminDbId,
      action: 'RECEIPT_REJECT',
      targetType: 'Transaction',
      targetId: tx.id,
      metadata: { reason },
      ipAddress: 'bot',
      userAgent: 'telegram-bot',
    },
  });
}

/** Human-readable service summary line (Persian). */
export function describeService(input: {
  productName: string;
  usedGB: number;
  totalGB: number;
  expiresAt: Date | null;
  status: string;
}): string {
  const percent = input.totalGB > 0 ? Math.round((input.usedGB / input.totalGB) * 100) : 0;
  const expiry = input.expiresAt ? toJalali(input.expiresAt) : 'بدون انقضا';
  return (
    `📦 ${input.productName}\n` +
    `📊 مصرف: ${toFaDigits(input.usedGB.toFixed(1))} از ${toFaDigits(input.totalGB)} گیگابایت (${toFaDigits(percent)}٪)\n` +
    `📅 انقضا: ${expiry}\n` +
    `🔘 وضعیت: ${input.status}`
  );
}

export function formatDashboard(input: {
  totalUsers: number;
  today: number;
  week: number;
  month: number;
  activeSubscriptions: number;
  totalBalance: string;
  sales30d: string;
  count30d: number;
  conversionRate: number;
}): string {
  return (
    `📊 داشبورد\n\n` +
    `👥 کل کاربران: ${toFaDigits(input.totalUsers)}\n` +
    `🆕 امروز: ${toFaDigits(input.today)} | هفته: ${toFaDigits(input.week)} | ماه: ${toFaDigits(input.month)}\n` +
    `📦 سرویس‌های فعال: ${toFaDigits(input.activeSubscriptions)}\n` +
    `💰 موجودی کل کیف‌پول‌ها: ${formatToman(input.totalBalance)} تومان\n` +
    `💵 فروش ۳۰ روز: ${formatToman(input.sales30d)} تومان (${toFaDigits(input.count30d)} سرویس)\n` +
    `📈 نرخ تبدیل: ${toFaDigits(input.conversionRate)}٪`
  );
}
