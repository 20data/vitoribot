import { z } from 'zod';
import type { Bot } from 'grammy';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@vitoribot/db';
import { paginationSchema } from '@vitoribot/types';
import type { BotContext } from '../../bot/types.js';
import { jwtAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const listQuery = paginationSchema
  .extend({
    search: z.string().max(100).optional(),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'USER']).optional(),
    blocked: z.coerce.boolean().optional(),
  })
  .strict();

const updateSchema = z
  .object({
    balance: z.number().optional(),
    balanceReason: z.string().max(500).optional(),
    role: z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'USER']).optional(),
    isBlocked: z.boolean().optional(),
  })
  .strict();

const messageSchema = z.object({ message: z.string().min(1).max(4000) }).strict();

/** Admin user management. */
export async function adminUserRoutes(app: FastifyInstance, bot: Bot<BotContext>): Promise<void> {
  const guard = [jwtAuth, requireRole('ADMIN')] as const;

  app.get('/api/admin/users', { preHandler: [...guard, validate(listQuery, 'query')] }, async (request) => {
    const { page, pageSize, search, role, blocked } = request.query as z.infer<typeof listQuery>;
    const where: Record<string, unknown> = {};
    if (role) where['role'] = role;
    if (blocked !== undefined) where['isBlocked'] = blocked;
    if (search) {
      const numeric = /^-?\d+$/.test(search);
      where['OR'] = numeric
        ? [{ telegramId: BigInt(search) }]
        : [
            { username: { contains: search } },
            { firstName: { contains: search } },
            { lastName: { contains: search } },
          ];
    }
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { subscriptions: { where: { status: 'ACTIVE' } } } } },
      }),
      prisma.user.count({ where }),
    ]);
    return {
      items: items.map((u) => ({ ...u, telegramId: u.telegramId.toString() })),
      total,
      page,
      pageSize,
    };
  });

  app.get('/api/admin/users/:id', { preHandler: [...guard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        subscriptions: { include: { product: true }, orderBy: { createdAt: 'desc' }, take: 20 },
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!user) {
      await reply.code(404).send({ error: 'کاربر یافت نشد.' });
      return;
    }
    await reply.send({ ...user, telegramId: user.telegramId.toString() });
  });

  app.patch('/api/admin/users/:id', { preHandler: [...guard, validate(updateSchema)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const admin = (request as unknown as { user: { userId: string } }).user;
    const body = request.body as z.infer<typeof updateSchema>;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      await reply.code(404).send({ error: 'کاربر یافت نشد.' });
      return;
    }
    if (body.balance !== undefined) {
      const delta = body.balance - Number(user.balance);
      await prisma.user.update({ where: { id }, data: { balance: body.balance } });
      await prisma.transaction.create({
        data: {
          userId: id,
          amount: delta,
          type: 'CHARGE',
          status: 'CONFIRMED',
          description: body.balanceReason ?? 'Admin balance edit',
          confirmedAt: new Date(),
          confirmedById: admin.userId,
        },
      });
      await prisma.adminLog.create({
        data: {
          adminId: admin.userId,
          action: 'USER_BALANCE_CHANGE',
          targetType: 'User',
          targetId: id,
          metadata: { amount: delta, reason: body.balanceReason ?? null },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      });
    }
    if (body.role !== undefined || body.isBlocked !== undefined) {
      await prisma.user.update({
        where: { id },
        data: { role: body.role, isBlocked: body.isBlocked },
      });
      await prisma.adminLog.create({
        data: {
          adminId: admin.userId,
          action: body.isBlocked === true ? 'USER_BLOCK' : body.isBlocked === false ? 'USER_UNBLOCK' : 'USER_ROLE_CHANGE',
          targetType: 'User',
          targetId: id,
          metadata: { role: body.role ?? null, isBlocked: body.isBlocked ?? null },
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      });
    }
    const updated = await prisma.user.findUnique({ where: { id } });
    await reply.send(updated ? { ...updated, telegramId: updated.telegramId.toString() } : null);
  });

  app.post(
    '/api/admin/users/:id/message',
    { preHandler: [...guard, validate(messageSchema)] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { message } = request.body as { message: string };
      const admin = (request as unknown as { user: { userId: string } }).user;
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        await reply.code(404).send({ error: 'کاربر یافت نشد.' });
        return;
      }
      try {
        await bot.api.sendMessage(Number(user.telegramId), message);
      } catch {
        await reply.code(502).send({ error: 'ارسال پیام ناموفق بود.' });
        return;
      }
      await prisma.adminLog.create({
        data: {
          adminId: admin.userId,
          action: 'MESSAGE_SEND',
          targetType: 'User',
          targetId: id,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'],
        },
      });
      await reply.send({ ok: true });
    },
  );
}
