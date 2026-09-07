import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@vitoribot/db';
import { jwtAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { invalidateTemplate } from '../../bot/renderer.js';
import { provisionTotp, disableTotp } from '../services/adminAuth.js';

const settingSchema = z.record(z.string().max(100), z.string().max(5000));
const messageSchema = z.object({ content: z.string().min(1).max(4000) }).strict();
const channelSchema = z
  .object({
    channelId: z.coerce.bigint(),
    channelUsername: z.string().min(1).max(100),
    channelTitle: z.string().min(1).max(100),
  })
  .strict();
const adminAddSchema = z
  .object({ telegramId: z.coerce.bigint(), role: z.enum(['ADMIN', 'SUPPORT']) })
  .strict();
const adminRoleSchema = z.object({ role: z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'USER']) }).strict();

/** Admin settings, bot messages, channels, admins, audit log. */
export async function adminSystemRoutes(app: FastifyInstance): Promise<void> {
  const guard = [jwtAuth, requireRole('ADMIN')] as const;

  // ─── Settings ───
  app.get('/api/admin/settings', { preHandler: [...guard] }, async () => {
    const rows = await prisma.setting.findMany();
    return Object.fromEntries(rows.map((r) => [r.key, r.value]));
  });

  app.put('/api/admin/settings', { preHandler: [...guard, validate(settingSchema)] }, async (request, reply) => {
    const body = request.body as Record<string, string>;
    const admin = (request as unknown as { user: { userId: string } }).user;
    for (const [key, value] of Object.entries(body)) {
      await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
    await prisma.adminLog.create({
      data: {
        adminId: admin.userId, action: 'SETTINGS_CHANGE', targetType: 'Setting',
        metadata: { keys: Object.keys(body) }, ipAddress: request.ip, userAgent: request.headers['user-agent'],
      },
    });
    await reply.send({ ok: true });
  });

  // ─── Bot messages ───
  app.get('/api/admin/messages', { preHandler: [...guard] }, async () => {
    return prisma.botMessage.findMany({ orderBy: { key: 'asc' } });
  });

  app.put('/api/admin/messages/:key', { preHandler: [...guard, validate(messageSchema)] }, async (request) => {
    const { key } = request.params as { key: string };
    const { content } = request.body as { content: string };
    const saved = await prisma.botMessage.upsert({
      where: { key },
      update: { content },
      create: { key, content },
    });
    await invalidateTemplate(key);
    return saved;
  });

  // ─── Force-join channels ───
  app.get('/api/admin/channels', { preHandler: [...guard] }, async () => {
    return prisma.forceJoinChannel.findMany({ where: { isActive: true } });
  });

  app.post('/api/admin/channels', { preHandler: [...guard, validate(channelSchema)] }, async (request, reply) => {
    const body = request.body as z.infer<typeof channelSchema>;
    const created = await prisma.forceJoinChannel.create({
      data: { channelId: body.channelId, channelUsername: body.channelUsername.replace('@', ''), channelTitle: body.channelTitle },
    });
    try {
      const { getRedis } = await import('../../lib/redis.js');
      await getRedis().del('forcejoin:channels');
    } catch {
      // ignore
    }
    await reply.code(201).send(created);
  });

  app.delete('/api/admin/channels/:id', { preHandler: [...guard] }, async (request) => {
    const { id } = request.params as { id: string };
    await prisma.forceJoinChannel.update({ where: { id }, data: { isActive: false } });
    return { ok: true };
  });

  // ─── Admins (SUPER_ADMIN) ───
  const superGuard = [jwtAuth, requireRole('SUPER_ADMIN')] as const;

  app.get('/api/admin/admins', { preHandler: [...superGuard] }, async () => {
    const admins = await prisma.user.findMany({
      where: { role: { in: ['SUPER_ADMIN', 'ADMIN', 'SUPPORT'] } },
      select: { id: true, telegramId: true, username: true, firstName: true, role: true, createdAt: true },
    });
    return admins.map((a) => ({ ...a, telegramId: a.telegramId.toString() }));
  });

  app.post('/api/admin/admins', { preHandler: [...superGuard, validate(adminAddSchema)] }, async (request, reply) => {
    const { telegramId, role } = request.body as z.infer<typeof adminAddSchema>;
    const admin = (request as unknown as { user: { userId: string } }).user;
    const user = await prisma.user.findUnique({ where: { telegramId } });
    if (!user) {
      await reply.code(404).send({ error: 'کاربر ابتدا باید ربات را استارت کرده باشد.' });
      return;
    }
    await prisma.user.update({ where: { id: user.id }, data: { role } });
    await prisma.adminLog.create({
      data: {
        adminId: admin.userId, action: 'ADMIN_ADD', targetType: 'User', targetId: user.id,
        metadata: { role }, ipAddress: request.ip, userAgent: request.headers['user-agent'],
      },
    });
    await reply.send({ ok: true });
  });

  app.patch('/api/admin/admins/:id', { preHandler: [...superGuard, validate(adminRoleSchema)] }, async (request) => {
    const { id } = request.params as { id: string };
    const { role } = request.body as { role: 'SUPER_ADMIN' | 'ADMIN' | 'SUPPORT' | 'USER' };
    await prisma.user.update({ where: { id }, data: { role } });
    return { ok: true };
  });

  app.delete('/api/admin/admins/:id', { preHandler: [...superGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const admin = (request as unknown as { user: { userId: string } }).user;
    if (id === admin.userId) {
      await reply.code(400).send({ error: 'نمی‌توانید خودتان را حذف کنید.' });
      return;
    }
    await prisma.user.update({ where: { id }, data: { role: 'USER' } });
    await prisma.adminLog.create({
      data: {
        adminId: admin.userId, action: 'ADMIN_REMOVE', targetType: 'User', targetId: id,
        ipAddress: request.ip, userAgent: request.headers['user-agent'],
      },
    });
    await reply.send({ ok: true });
  });

  app.post('/api/admin/admins/:id/totp', { preHandler: [...superGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      await reply.send(await provisionTotp(id));
    } catch {
      await reply.code(404).send({ error: 'کاربر یافت نشد.' });
    }
  });

  app.delete('/api/admin/admins/:id/totp', { preHandler: [...superGuard] }, async (request) => {
    const { id } = request.params as { id: string };
    await disableTotp(id);
    return { ok: true };
  });

  // ─── Audit log ───
  app.get('/api/admin/audit', { preHandler: [...superGuard] }, async (request) => {
    const query = request.query as { adminId?: string; action?: string; page?: string; pageSize?: string };
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
    const where: Record<string, unknown> = {};
    if (query.adminId) where['adminId'] = query.adminId;
    if (query.action) where['action'] = query.action;
    const [items, total] = await Promise.all([
      prisma.adminLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
      prisma.adminLog.count({ where }),
    ]);
    return { items, total, page, pageSize };
  });
}
