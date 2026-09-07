import { z } from 'zod';
import crypto from 'node:crypto';
import type { Bot } from 'grammy';
import { Queue } from 'bullmq';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@vitoribot/db';
import { QUEUE_NAMES } from '@vitoribot/queue';
import { paginationSchema } from '@vitoribot/types';
import type { BotContext } from '../../bot/types.js';
import { jwtAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getRedis } from '../../lib/redis.js';

const ticketQuery = paginationSchema
  .extend({ status: z.enum(['OPEN', 'ANSWERED', 'CLOSED']).optional() })
  .strict();
const replySchema = z.object({ message: z.string().min(1).max(4000) }).strict();
const deptSchema = z.object({ name: z.string().min(1).max(100), isActive: z.boolean().optional() }).strict();
const discountSchema = z
  .object({
    code: z.string().regex(/^[A-Z0-9]{4,32}$/),
    type: z.enum(['PERCENT', 'FIXED_AMOUNT']),
    value: z.number().positive(),
    maxUses: z.number().int().positive().nullable().optional(),
    applicableTo: z.enum(['ALL', 'NEW_PURCHASE', 'RENEWAL', 'FIRST_PURCHASE']).default('ALL'),
  })
  .strict();
const giftSchema = z
  .object({
    code: z.string().regex(/^[A-Z0-9]{4,32}$/),
    amount: z.number().positive(),
    maxUses: z.number().int().positive().nullable().optional(),
  })
  .strict();
const broadcastSchema = z
  .object({ target: z.enum(['ALL', 'ACTIVE', 'INACTIVE']), message: z.string().min(1).max(4000) })
  .strict();

function randomCode(): string {
  return crypto.randomBytes(6).toString('hex').toUpperCase().slice(0, 8);
}

/** Admin tickets, departments, discount/gift codes, broadcasts. */
export async function adminSupportRoutes(app: FastifyInstance, bot: Bot<BotContext>): Promise<void> {
  const guard = [jwtAuth, requireRole('ADMIN')] as const;

  // ─── Tickets ───
  app.get('/api/admin/tickets', { preHandler: [...guard, validate(ticketQuery, 'query')] }, async (request) => {
    const { page, pageSize, status } = request.query as z.infer<typeof ticketQuery>;
    const where: Record<string, unknown> = {};
    if (status) where['status'] = status;
    const [items, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { department: true, user: { select: { firstName: true, username: true } } },
      }),
      prisma.ticket.count({ where }),
    ]);
    return { items, total, page, pageSize };
  });

  app.get('/api/admin/tickets/:id', { preHandler: [...guard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const ticket = await prisma.ticket.findUnique({
      where: { id },
      include: { messages: { orderBy: { createdAt: 'asc' } }, department: true, user: true },
    });
    if (!ticket) {
      await reply.code(404).send({ error: 'تیکت یافت نشد.' });
      return;
    }
    await reply.send(ticket);
  });

  app.post('/api/admin/tickets/:id/reply', { preHandler: [...guard, validate(replySchema)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { message } = request.body as { message: string };
    const admin = (request as unknown as { user: { userId: string } }).user;
    const ticket = await prisma.ticket.findUnique({ where: { id }, include: { user: true } });
    if (!ticket) {
      await reply.code(404).send({ error: 'تیکت یافت نشد.' });
      return;
    }
    const sender = await prisma.user.findUnique({ where: { id: admin.userId } });
    await prisma.ticketMessage.create({
      data: { ticketId: id, senderId: admin.userId, senderRole: sender?.role ?? 'ADMIN', message },
    });
    await prisma.ticket.update({ where: { id }, data: { status: 'ANSWERED' } });
    try {
      await bot.api.sendMessage(Number(ticket.user.telegramId), `💬 پاسخ جدید در تیکت «${ticket.subject}» دریافت شد.`);
    } catch {
      // ignore
    }
    await reply.send({ ok: true });
  });

  app.post('/api/admin/tickets/:id/close', { preHandler: [...guard] }, async (request) => {
    const { id } = request.params as { id: string };
    await prisma.ticket.update({ where: { id }, data: { status: 'CLOSED' } });
    return { ok: true };
  });

  app.post('/api/admin/tickets/:id/reopen', { preHandler: [...guard] }, async (request) => {
    const { id } = request.params as { id: string };
    await prisma.ticket.update({ where: { id }, data: { status: 'OPEN' } });
    return { ok: true };
  });

  // ─── Departments ───
  app.get('/api/admin/departments', { preHandler: [...guard] }, async () => {
    return prisma.department.findMany({ orderBy: { createdAt: 'asc' } });
  });

  app.post('/api/admin/departments', { preHandler: [...guard, validate(deptSchema)] }, async (request, reply) => {
    const created = await prisma.department.create({ data: request.body as z.infer<typeof deptSchema> });
    await reply.code(201).send(created);
  });

  app.patch('/api/admin/departments/:id', { preHandler: [...guard, validate(deptSchema.partial())] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await reply.send(await prisma.department.update({ where: { id }, data: request.body as object }));
    } catch {
      await reply.code(404).send({ error: 'دپارتمان یافت نشد.' });
    }
  });

  // ─── Discount codes ───
  app.get('/api/admin/discounts', { preHandler: [...guard] }, async () => {
    return prisma.discountCode.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  });

  app.post('/api/admin/discounts', { preHandler: [...guard, validate(discountSchema)] }, async (request, reply) => {
    const created = await prisma.discountCode.create({ data: request.body as z.infer<typeof discountSchema> });
    await reply.code(201).send(created);
  });

  app.get('/api/admin/discounts/generate', { preHandler: [...guard] }, async () => {
    return { code: randomCode() };
  });

  app.post('/api/admin/discounts/deactivate-expired', { preHandler: [...guard] }, async () => {
    const res = await prisma.discountCode.updateMany({
      where: { isActive: true, validTo: { lt: new Date() } },
      data: { isActive: false },
    });
    return { deactivated: res.count };
  });

  app.delete('/api/admin/discounts/:id', { preHandler: [...guard] }, async (request) => {
    const { id } = request.params as { id: string };
    await prisma.discountCode.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  });

  // ─── Gift codes ───
  app.get('/api/admin/gifts', { preHandler: [...guard] }, async () => {
    return prisma.giftCode.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
  });

  app.post('/api/admin/gifts', { preHandler: [...guard, validate(giftSchema)] }, async (request, reply) => {
    const created = await prisma.giftCode.create({ data: request.body as z.infer<typeof giftSchema> });
    await reply.code(201).send(created);
  });

  app.delete('/api/admin/gifts/:id', { preHandler: [...guard] }, async (request) => {
    const { id } = request.params as { id: string };
    await prisma.giftCode.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  });

  // ─── Broadcast (SUPER_ADMIN) ───
  app.post(
    '/api/admin/broadcast',
    { preHandler: [jwtAuth, requireRole('SUPER_ADMIN'), validate(broadcastSchema)] },
    async (request, reply) => {
      const { target, message } = request.body as z.infer<typeof broadcastSchema>;
      const admin = (request as unknown as { user: { userId: string } }).user;
      const broadcast = await prisma.broadcast.create({
        data: { target, message, createdById: admin.userId },
      });
      const queue = new Queue(QUEUE_NAMES.broadcast, { connection: getRedis() });
      try {
        await queue.add('send', { broadcastId: broadcast.id, target, message });
      } finally {
        await queue.close();
      }
      await prisma.adminLog.create({
        data: {
          adminId: admin.userId, action: 'BROADCAST_SEND', targetType: 'Broadcast', targetId: broadcast.id,
          metadata: { target }, ipAddress: request.ip, userAgent: request.headers['user-agent'],
        },
      });
      await reply.code(201).send(broadcast);
    },
  );

  app.get('/api/admin/broadcast', { preHandler: [...guard] }, async () => {
    return prisma.broadcast.findMany({ orderBy: { createdAt: 'desc' }, take: 50 });
  });
}
