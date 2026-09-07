import { z } from 'zod';
import type { Bot } from 'grammy';
import type { FastifyInstance } from 'fastify';
import type { BotContext } from '../../bot/types.js';
import { validate } from '../middleware/validate.js';
import { validateInitData } from '../../lib/telegram-init.js';
import { upsertUser } from '../../bot/services/users.js';
import { issuePair, rotatePair } from '../services/tokens.js';
import { requestLoginCode, verify2fa, verifyLoginCode } from '../services/adminAuth.js';

const miniappAuthSchema = z.object({ initData: z.string().min(1) }).strict();
const refreshSchema = z.object({ refreshToken: z.string().min(1) }).strict();
const requestCodeSchema = z.object({ telegramId: z.coerce.bigint() }).strict();
const loginSchema = z.object({ telegramId: z.coerce.bigint(), code: z.string().length(6) }).strict();
const twofaSchema = z.object({ tempToken: z.string().min(1), totp: z.string().length(6) }).strict();

/** Auth routes: mini-app login, token refresh, admin code login + 2FA. */
export async function authRoutes(app: FastifyInstance, bot: Bot<BotContext>): Promise<void> {
  // Mini App: exchange Telegram initData for a JWT pair.
  app.post(
    '/api/miniapp/auth',
    {
      preHandler: validate(miniappAuthSchema),
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { initData } = request.body as { initData: string };
      let parsed: Record<string, string>;
      try {
        parsed = validateInitData(initData, process.env['BOT_TOKEN'] ?? '');
      } catch {
        await reply.code(401).send({ error: 'احراز هویت نامعتبر است.' });
        return;
      }
      let tgUser: { id: number; first_name: string; last_name?: string; username?: string };
      try {
        tgUser = JSON.parse(parsed['user'] ?? '') as typeof tgUser;
      } catch {
        await reply.code(401).send({ error: 'احراز هویت نامعتبر است.' });
        return;
      }
      const dbUser = await upsertUser({
        telegramId: BigInt(tgUser.id),
        username: tgUser.username,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name,
      });
      if (dbUser.isBlocked) {
        await reply.code(403).send({ error: 'حساب شما مسدود است.' });
        return;
      }
      const full = await import('@vitoribot/db').then((m) =>
        m.prisma.user.findUnique({ where: { id: dbUser.id } }),
      );
      const tokens = await issuePair(dbUser.id, full?.role ?? 'USER');
      await reply.send(tokens);
    },
  );

  app.post(
    '/api/auth/refresh',
    {
      preHandler: validate(refreshSchema),
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { refreshToken } = request.body as { refreshToken: string };
      try {
        const tokens = await rotatePair(refreshToken);
        await reply.send(tokens);
      } catch {
        await reply.code(401).send({ error: 'توکن نامعتبر است.' });
      }
    },
  );

  // Admin: bot-delivered login code.
  app.post(
    '/api/auth/admin/request-code',
    {
      preHandler: validate(requestCodeSchema),
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { telegramId } = request.body as { telegramId: bigint };
      await requestLoginCode(bot, telegramId);
      // Always respond identically to avoid account enumeration.
      await reply.send({ ok: true });
    },
  );

  app.post(
    '/api/auth/admin/login',
    {
      preHandler: validate(loginSchema),
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { telegramId, code } = request.body as { telegramId: bigint; code: string };
      try {
        const result = await verifyLoginCode(telegramId, code);
        await reply.send(result);
      } catch (err) {
        await reply.code(401).send({ error: (err as Error).message });
      }
    },
  );

  app.post(
    '/api/auth/admin/2fa',
    {
      preHandler: validate(twofaSchema),
      config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
    },
    async (request, reply) => {
      const { tempToken, totp } = request.body as { tempToken: string; totp: string };
      try {
        const tokens = await verify2fa(tempToken, totp);
        await reply.send(tokens);
      } catch (err) {
        await reply.code(401).send({ error: (err as Error).message });
      }
    },
  );
}
