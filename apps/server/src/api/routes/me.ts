import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@vitoribot/db';
import { paginationSchema } from '@vitoribot/types';
import { jwtAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getPanelClient } from '../../bot/services/panels.js';
import { redeemGiftCode } from '../../bot/services/pricing.js';

const giftSchema = z.object({ code: z.string().min(1).max(32) }).strict();

interface Authed {
  user?: { userId: string; role: string };
}

/** Mini-app self-service routes (Bearer JWT from /api/miniapp/auth). */
export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/me', { preHandler: [jwtAuth] }, async (request) => {
    const { userId } = (request as unknown as Authed).user!;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { _count: { select: { subscriptions: { where: { status: 'ACTIVE' } } } } },
    });
    if (!user) throw new Error('User not found');
    return {
      balance: user.balance.toString(),
      activeCount: user._count.subscriptions,
      firstName: user.firstName,
      joinedAt: user.createdAt,
    };
  });

  app.get('/api/my/subscriptions', { preHandler: [jwtAuth] }, async (request) => {
    const { userId } = (request as unknown as Authed).user!;
    const subs = await prisma.subscription.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
    const out = [];
    for (const s of subs) {
      let usedGB: number | null = null;
      try {
        const client = await getPanelClient(s.panelId);
        const t = await client.getClientTraffic(s.clientEmail);
        if (t) usedGB = Math.round(((t.up + t.down) / 1_073_741_824) * 10) / 10;
      } catch {
        // live traffic best-effort
      }
      out.push({
        id: s.id,
        productName: s.product.name,
        totalGB: s.product.trafficGB,
        usedGB,
        expiresAt: s.expiresAt,
        status: s.status,
        subLink: s.subLink,
      });
    }
    return out;
  });

  app.get('/api/my/transactions', { preHandler: [jwtAuth, validate(paginationSchema, 'query')] }, async (request) => {
    const { userId } = (request as unknown as Authed).user!;
    const { page, pageSize } = request.query as { page: number; pageSize: number };
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.transaction.count({ where: { userId } }),
    ]);
    return { items, total, page, pageSize };
  });

  app.get('/api/my/tickets', { preHandler: [jwtAuth] }, async (request) => {
    const { userId } = (request as unknown as Authed).user!;
    return prisma.ticket.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: { department: true, messages: { orderBy: { createdAt: 'asc' } } },
    });
  });

  app.post('/api/my/tickets', { preHandler: [jwtAuth] }, async (request, reply) => {
    const { userId } = (request as unknown as Authed).user!;
    const schema = z
      .object({
        departmentId: z.string().uuid(),
        subject: z.string().min(1).max(200),
        message: z.string().min(1).max(4000),
      })
      .strict();
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      await reply.code(400).send({ error: 'ورودی نامعتبر است' });
      return;
    }
    const ticket = await prisma.ticket.create({
      data: {
        userId,
        departmentId: parsed.data.departmentId,
        subject: parsed.data.subject,
        messages: { create: { senderId: userId, senderRole: 'USER', message: parsed.data.message } },
      },
    });
    await reply.code(201).send(ticket);
  });

  app.post('/api/gift/redeem', { preHandler: [jwtAuth, validate(giftSchema)] }, async (request, reply) => {
    const { userId } = (request as unknown as Authed).user!;
    const { code } = request.body as { code: string };
    try {
      const amount = await redeemGiftCode(code, userId);
      await reply.send({ amount });
    } catch (err) {
      await reply.code(400).send({ error: (err as Error).message });
    }
  });

  app.get('/api/tutorials', { preHandler: [jwtAuth] }, async () => {
    const rows = await prisma.botMessage.findMany({
      where: { OR: [{ key: { startsWith: 'tutorial.' } }, { key: { startsWith: 'faq.' } }] },
      orderBy: { key: 'asc' },
    });
    return rows;
  });

  app.get('/api/departments', { preHandler: [jwtAuth] }, async () => {
    return prisma.department.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    });
  });
}
