import { z } from 'zod';
import type { Bot } from 'grammy';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@vitoribot/db';
import { paginationSchema } from '@vitoribot/types';
import type { BotContext } from '../../bot/types.js';
import { jwtAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getPanelClient } from '../../bot/services/panels.js';

const listQuery = paginationSchema
  .extend({
    panelId: z.string().uuid().optional(),
    productId: z.string().uuid().optional(),
    status: z.enum(['ACTIVE', 'EXPIRED', 'SUSPENDED']).optional(),
    userId: z.string().uuid().optional(),
  })
  .strict();

/** Admin subscription management with live 3x-ui actions. */
export async function adminSubRoutes(app: FastifyInstance, bot: Bot<BotContext>): Promise<void> {
  const guard = [jwtAuth, requireRole('ADMIN')] as const;
  void bot;

  app.get('/api/admin/subscriptions', { preHandler: [...guard, validate(listQuery, 'query')] }, async (request) => {
    const { page, pageSize, panelId, productId, status, userId } = request.query as z.infer<typeof listQuery>;
    const where: Record<string, unknown> = {};
    if (panelId) where['panelId'] = panelId;
    if (productId) where['productId'] = productId;
    if (status) where['status'] = status;
    if (userId) where['userId'] = userId;
    const [items, total] = await Promise.all([
      prisma.subscription.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { product: true, user: { select: { firstName: true, username: true, telegramId: true } } },
      }),
      prisma.subscription.count({ where }),
    ]);
    return { items, total, page, pageSize };
  });

  async function panelAction(
    id: string,
    action: 'suspend' | 'restore' | 'reset' | 'delete',
    adminId: string,
  ): Promise<void> {
    const sub = await prisma.subscription.findUnique({ where: { id } });
    if (!sub) throw new Error('اشتراک یافت نشد.');
    const client = await getPanelClient(sub.panelId);
    if (action === 'suspend') {
      await client.updateClient(sub.inboundId, sub.clientUuid, { enable: false });
      await prisma.subscription.update({ where: { id }, data: { status: 'SUSPENDED' } });
      await prisma.adminLog.create({
        data: { adminId, action: 'SUBSCRIPTION_SUSPEND', targetType: 'Subscription', targetId: id, ipAddress: 'api', userAgent: 'web-panel' },
      });
    } else if (action === 'restore') {
      await client.updateClient(sub.inboundId, sub.clientUuid, { enable: true });
      await prisma.subscription.update({ where: { id }, data: { status: 'ACTIVE' } });
      await prisma.adminLog.create({
        data: { adminId, action: 'SUBSCRIPTION_RESTORE', targetType: 'Subscription', targetId: id, ipAddress: 'api', userAgent: 'web-panel' },
      });
    } else if (action === 'reset') {
      await client.resetClientTraffic(sub.clientEmail);
    } else {
      await client.deleteClient(sub.inboundId, sub.clientUuid);
      await prisma.subscription.delete({ where: { id } });
      await prisma.adminLog.create({
        data: { adminId, action: 'SUBSCRIPTION_DELETE', targetType: 'Subscription', targetId: id, ipAddress: 'api', userAgent: 'web-panel' },
      });
    }
  }

  for (const action of ['suspend', 'restore', 'reset', 'delete'] as const) {
    app.post(`/api/admin/subscriptions/:id/${action}`, { preHandler: [...guard] }, async (request, reply) => {
      const { id } = request.params as { id: string };
      const admin = (request as unknown as { user: { userId: string } }).user;
      try {
        await panelAction(id, action, admin.userId);
        await reply.send({ ok: true });
      } catch (err) {
        await reply.code(502).send({ error: (err as Error).message });
      }
    });
  }

  app.get('/api/admin/subscriptions/:id/traffic', { preHandler: [...guard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const sub = await prisma.subscription.findUnique({ where: { id }, include: { product: true } });
    if (!sub) {
      await reply.code(404).send({ error: 'اشتراک یافت نشد.' });
      return;
    }
    try {
      const client = await getPanelClient(sub.panelId);
      const t = await client.getClientTraffic(sub.clientEmail);
      await reply.send({ ...t, totalGB: sub.product.trafficGB });
    } catch (err) {
      await reply.code(502).send({ error: (err as Error).message });
    }
  });
}
