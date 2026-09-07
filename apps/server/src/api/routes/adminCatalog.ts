import { z } from 'zod';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@vitoribot/db';
import { ThreeXUIClient } from '@vitoribot/3xui';
import { jwtAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { decrypt, encrypt } from '../../lib/encryption.js';
import { getRedis } from '../../lib/redis.js';
import { dropPanelClient, getPanelClient } from '../../bot/services/panels.js';

const productSchema = z
  .object({
    panelId: z.string().uuid(),
    groupName: z.string().min(1).max(100),
    name: z.string().min(1).max(150),
    inboundId: z.number().int().positive(),
    trafficGB: z.number().int().positive(),
    durationDays: z.number().int().positive(),
    price: z.number().nonnegative(),
    sortOrder: z.number().int().default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

const productUpdateSchema = productSchema.partial().strict();

const panelSchema = z
  .object({
    name: z.string().min(1).max(100),
    url: z.string().url(),
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(200),
    remarkPrefix: z.string().max(32).optional(),
  })
  .strict();

const panelUpdateSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    url: z.string().url().optional(),
    username: z.string().min(1).max(100).optional(),
    password: z.string().min(1).max(200).optional(),
    remarkPrefix: z.string().max(32).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

/** Admin product + panel catalog management. */
export async function adminCatalogRoutes(app: FastifyInstance): Promise<void> {
  const guard = [jwtAuth, requireRole('ADMIN')] as const;

  // ─── Products ───
  app.get('/api/admin/products', { preHandler: [...guard] }, async () => {
    return prisma.product.findMany({
      include: { panel: { select: { name: true, isOnline: true } } },
      orderBy: [{ groupName: 'asc' }, { sortOrder: 'asc' }],
    });
  });

  app.post('/api/admin/products', { preHandler: [...guard, validate(productSchema)] }, async (request, reply) => {
    const body = request.body as z.infer<typeof productSchema>;
    const admin = (request as unknown as { user: { userId: string } }).user;
    const created = await prisma.product.create({ data: { ...body, price: body.price } });
    await prisma.adminLog.create({
      data: {
        adminId: admin.userId, action: 'PRODUCT_CREATE', targetType: 'Product', targetId: created.id,
        ipAddress: request.ip, userAgent: request.headers['user-agent'],
      },
    });
    await reply.code(201).send(created);
  });

  app.patch('/api/admin/products/:id', { preHandler: [...guard, validate(productUpdateSchema)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as z.infer<typeof productUpdateSchema>;
    const admin = (request as unknown as { user: { userId: string } }).user;
    try {
      const updated = await prisma.product.update({ where: { id }, data: body });
      await prisma.adminLog.create({
        data: {
          adminId: admin.userId, action: 'PRODUCT_EDIT', targetType: 'Product', targetId: id,
          ipAddress: request.ip, userAgent: request.headers['user-agent'],
        },
      });
      await reply.send(updated);
    } catch {
      await reply.code(404).send({ error: 'محصول یافت نشد.' });
    }
  });

  app.delete('/api/admin/products/:id', { preHandler: [...guard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const admin = (request as unknown as { user: { userId: string } }).user;
    try {
      await prisma.product.delete({ where: { id } });
      await prisma.adminLog.create({
        data: {
          adminId: admin.userId, action: 'PRODUCT_DELETE', targetType: 'Product', targetId: id,
          ipAddress: request.ip, userAgent: request.headers['user-agent'],
        },
      });
      await reply.send({ ok: true });
    } catch {
      await reply.code(404).send({ error: 'محصول یافت نشد.' });
    }
  });

  // ─── Panels ───
  app.get('/api/admin/panels', { preHandler: [...guard] }, async () => {
    const panels = await prisma.panel.findMany({
      include: { _count: { select: { products: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return panels.map(({ encryptedPass: _e, ...rest }) => rest);
  });

  app.post('/api/admin/panels', { preHandler: [...guard, validate(panelSchema)] }, async (request, reply) => {
    const body = request.body as z.infer<typeof panelSchema>;
    const admin = (request as unknown as { user: { userId: string } }).user;
    // Test connection before saving.
    const redis = getRedis();
    const probe = new ThreeXUIClient('probe', body.url, body.username, body.password, {
      get: async (k: string) => redis.get(k),
      set: async (k: string, v: string, ttl: number) => void (await redis.set(k, v, 'EX', ttl)),
    });
    try {
      await probe.login();
    } catch (err) {
      await reply.code(502).send({ error: `اتصال به پنل ناموفق بود: ${(err as Error).message}` });
      return;
    }
    const created = await prisma.panel.create({
      data: {
        name: body.name,
        url: body.url,
        username: body.username,
        encryptedPass: encrypt(body.password),
        remarkPrefix: body.remarkPrefix ?? '',
      },
    });
    await prisma.adminLog.create({
      data: {
        adminId: admin.userId, action: 'PANEL_ADD', targetType: 'Panel', targetId: created.id,
        ipAddress: request.ip, userAgent: request.headers['user-agent'],
      },
    });
    const { encryptedPass: _e, ...safe } = created;
    await reply.code(201).send(safe);
  });

  app.patch('/api/admin/panels/:id', { preHandler: [...guard, validate(panelUpdateSchema)] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as z.infer<typeof panelUpdateSchema>;
    const admin = (request as unknown as { user: { userId: string } }).user;
    const { password, ...rest } = body;
    try {
      const updated = await prisma.panel.update({
        where: { id },
        data: { ...rest, ...(password ? { encryptedPass: encrypt(password) } : {}) },
      });
      dropPanelClient(id);
      await prisma.adminLog.create({
        data: {
          adminId: admin.userId, action: 'PANEL_EDIT', targetType: 'Panel', targetId: id,
          ipAddress: request.ip, userAgent: request.headers['user-agent'],
        },
      });
      const { encryptedPass: _e, ...safe } = updated;
      await reply.send(safe);
    } catch {
      await reply.code(404).send({ error: 'پنل یافت نشد.' });
    }
  });

  app.delete('/api/admin/panels/:id', { preHandler: [...guard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const active = await prisma.subscription.count({ where: { panelId: id, status: 'ACTIVE' } });
    if (active > 0) {
      await reply.code(400).send({ error: 'پنل دارای اشتراک فعال است و قابل حذف نیست.' });
      return;
    }
    const admin = (request as unknown as { user: { userId: string } }).user;
    try {
      await prisma.panel.delete({ where: { id } });
      dropPanelClient(id);
      await prisma.adminLog.create({
        data: {
          adminId: admin.userId, action: 'PANEL_DELETE', targetType: 'Panel', targetId: id,
          ipAddress: request.ip, userAgent: request.headers['user-agent'],
        },
      });
      await reply.send({ ok: true });
    } catch {
      await reply.code(404).send({ error: 'پنل یافت نشد.' });
    }
  });

  // Fetch live inbounds from a panel and cache them in Redis.
  app.post('/api/admin/panels/:id/sync', { preHandler: [...guard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const client = await getPanelClient(id);
      const inbounds = await client.getInbounds();
      await getRedis().set(`panel:inbounds:${id}`, JSON.stringify(inbounds), 'EX', 300);
      await reply.send({ count: inbounds.length, inbounds });
    } catch (err) {
      await reply.code(502).send({ error: `دریافت اینباندها ناموفق بود: ${(err as Error).message}` });
    }
  });

  app.post('/api/admin/panels/:id/test', { preHandler: [...guard] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const panel = await prisma.panel.findUnique({ where: { id } });
    if (!panel) {
      await reply.code(404).send({ error: 'پنل یافت نشد.' });
      return;
    }
    const redis = getRedis();
    const client = new ThreeXUIClient(panel.id, panel.url, panel.username, decrypt(panel.encryptedPass), {
      get: async (k: string) => redis.get(k),
      set: async (k: string, v: string, ttl: number) => void (await redis.set(k, v, 'EX', ttl)),
    });
    try {
      await client.login();
      await reply.send({ ok: true });
    } catch (err) {
      await reply.code(502).send({ error: (err as Error).message });
    }
  });
}
