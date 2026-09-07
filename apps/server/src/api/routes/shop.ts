import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Bot } from 'grammy';
import type { FastifyInstance } from 'fastify';
import { prisma } from '@vitoribot/db';
import type { BotContext } from '../../bot/types.js';
import { jwtAuth } from '../middleware/auth.js';
import { payRateLimit, validate } from '../middleware/validate.js';
import { assertValidReceiptUpload } from '../middleware/upload.js';
import { attachReceipt, createCharge, createPurchase } from '../services/shop.js';

const purchaseSchema = z
  .object({ productId: z.string().uuid(), discountCode: z.string().max(32).optional() })
  .strict();
const chargeSchema = z.object({ amount: z.number().positive() }).strict();

interface Authed {
  user?: { userId: string; role: string };
}

/** Public catalog + purchase/charge + receipt upload (mini-app clients). */
export async function shopRoutes(app: FastifyInstance, bot: Bot<BotContext>): Promise<void> {
  app.get('/api/products', async () => {
    const products = await prisma.product.findMany({
      where: { isActive: true, panel: { isActive: true } },
      orderBy: [{ groupName: 'asc' }, { sortOrder: 'asc' }],
      include: { panel: { select: { name: true } } },
    });
    return products.map((p) => ({
      id: p.id,
      groupName: p.groupName,
      name: p.name,
      trafficGB: p.trafficGB,
      durationDays: p.durationDays,
      price: p.price.toString(),
      server: p.panel.name,
    }));
  });

  app.post(
    '/api/purchase',
    { preHandler: [jwtAuth, payRateLimit(10), validate(purchaseSchema)] },
    async (request, reply) => {
      const { userId } = (request as unknown as Authed).user!;
      const { productId, discountCode } = request.body as {
        productId: string;
        discountCode?: string;
      };
      try {
        const quote = await createPurchase(userId, productId, discountCode);
        await reply.code(201).send(quote);
      } catch (err) {
        await reply.code(400).send({ error: (err as Error).message });
      }
    },
  );

  app.post(
    '/api/charge',
    { preHandler: [jwtAuth, payRateLimit(10), validate(chargeSchema)] },
    async (request, reply) => {
      const { userId } = (request as unknown as Authed).user!;
      const { amount } = request.body as { amount: number };
      try {
        const quote = await createCharge(userId, amount);
        await reply.code(201).send(quote);
      } catch (err) {
        await reply.code(400).send({ error: (err as Error).message });
      }
    },
  );

  // Multipart receipt upload for a PENDING transaction (camera/file picker).
  app.post(
    '/api/purchase/:id/receipt',
    { preHandler: [jwtAuth, payRateLimit(10)] },
    async (request, reply) => {
      const { userId } = (request as unknown as Authed).user!;
      const { id } = request.params as { id: string };
      let buf: Buffer;
      try {
        buf = await assertValidReceiptUpload(request);
      } catch (err) {
        await reply.code(400).send({ error: (err as Error).message });
        return;
      }
      const base = process.env['STORAGE_LOCAL_PATH'] ?? '/app/uploads';
      const dir = path.join(base, 'receipts');
      await fs.mkdir(dir, { recursive: true });
      const name = `${new Date().toISOString().slice(0, 10)}-${crypto.randomBytes(8).toString('hex')}.jpg`;
      const full = path.join(dir, name);
      await fs.writeFile(full, buf);
      try {
        await attachReceipt(bot, userId, { transactionId: id, storagePath: full });
        await reply.code(201).send({ ok: true });
      } catch (err) {
        await reply.code(400).send({ error: (err as Error).message });
      }
    },
  );
}
