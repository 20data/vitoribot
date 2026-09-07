import { z } from 'zod';
import type { Bot } from 'grammy';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@vitoribot/db';
import { paginationSchema } from '@vitoribot/types';
import type { BotContext } from '../../bot/types.js';
import { jwtAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { approveReceipt, rejectReceipt } from '../../bot/services/receipts.js';
import { render } from '../../bot/renderer.js';

const listQuery = paginationSchema
  .extend({
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  })
  .strict();

const txnQuery = paginationSchema
  .extend({
    userId: z.string().uuid().optional(),
    type: z.enum(['CHARGE', 'PURCHASE', 'REFUND', 'GIFT', 'DISCOUNT']).optional(),
    status: z.enum(['PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED']).optional(),
    format: z.enum(['json', 'csv']).default('json'),
  })
  .strict();

const reviewSchema = z.object({ approve: z.boolean(), reason: z.string().max(500).optional() }).strict();

function toCsv(rows: Array<Record<string, unknown>>): string {
  const cols = ['id', 'userId', 'amount', 'type', 'status', 'description', 'createdAt'];
  const esc = (v: unknown): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}

/** Admin finance: receipt review, transaction history + CSV export. */
export async function adminFinanceRoutes(app: FastifyInstance, bot: Bot<BotContext>): Promise<void> {
  const guard = [jwtAuth, requireRole('ADMIN')] as const;

  app.get('/api/admin/receipts', { preHandler: [...guard, validate(listQuery, 'query')] }, async (request) => {
    const { page, pageSize, status } = request.query as z.infer<typeof listQuery>;
    const where: Record<string, unknown> = {};
    if (status) where['status'] = status;
    const [items, total] = await Promise.all([
      prisma.paymentReceipt.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { transaction: { include: { user: { select: { firstName: true, username: true } } } } },
      }),
      prisma.paymentReceipt.count({ where }),
    ]);
    return { items, total, page, pageSize };
  });

  app.post(
    '/api/admin/receipts/:txId/review',
    { preHandler: [...guard, validate(reviewSchema)] },
    async (request, reply) => {
      const { txId } = request.params as { txId: string };
      const { approve, reason } = request.body as z.infer<typeof reviewSchema>;
      const admin = (request as unknown as { user: { userId: string } }).user;
      try {
        if (approve) {
          const result = await approveReceipt(txId, admin.userId);
          const tx = await prisma.transaction.findUnique({
            where: { id: txId },
            include: { user: true },
          });
          if (tx) {
            try {
              const msg = result.subLink
                ? await render('purchase_success', { subLink: result.subLink, expiry: result.expiresAt?.toISOString() ?? '', traffic: '' })
                : '✅ پرداخت شما تایید و کیف پول شارژ شد.';
              await bot.api.sendMessage(Number(tx.user.telegramId), msg);
            } catch {
              // ignore delivery failures
            }
          }
        } else {
          await rejectReceipt(txId, admin.userId, reason ?? 'بدون دلیل');
          const tx = await prisma.transaction.findUnique({
            where: { id: txId },
            include: { user: true },
          });
          if (tx) {
            try {
              await bot.api.sendMessage(
                Number(tx.user.telegramId),
                await render('receipt_rejected', { reason: reason ?? '—' }),
              );
            } catch {
              // ignore
            }
          }
        }
        await reply.send({ ok: true });
      } catch (err) {
        await reply.code(400).send({ error: (err as Error).message });
      }
    },
  );

  app.get('/api/admin/transactions', { preHandler: [...guard, validate(txnQuery, 'query')] }, async (request, reply) => {
    const { page, pageSize, userId, type, status, format } = request.query as z.infer<typeof txnQuery>;
    const where: Record<string, unknown> = {};
    if (userId) where['userId'] = userId;
    if (type) where['type'] = type;
    if (status) where['status'] = status;
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { user: { select: { firstName: true, username: true } } },
      }),
      prisma.transaction.count({ where }),
    ]);
    if (format === 'csv') {
      await reply.header('Content-Type', 'text/csv; charset=utf-8');
      await reply.header('Content-Disposition', 'attachment; filename="transactions.csv"');
      await reply.send('﻿' + toCsv(items.map((t) => ({ ...t, amount: t.amount.toString() }))));
      return;
    }
    await reply.send({ items, total, page, pageSize });
  });
}
