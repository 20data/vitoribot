import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import cookie from '@fastify/cookie';
import { prisma } from '@vitoribot/db';
import { loadEnv } from './lib/env.js';
import { closeRedis } from './lib/redis.js';
import { jwtAuth, requireRole } from './api/middleware/auth.js';
import { createBot, setupWebhook } from './bot/bot.js';
import { startJobs, type JobHandles } from './jobs/index.js';
import { registerApi } from './api/plugin.js';
import { bootstrapAdmins } from './lib/bootstrap.js';

async function build(): Promise<void> {
  loadEnv();

  const app = Fastify({
    logger:
      process.env['NODE_ENV'] === 'production'
        ? { level: process.env['LOG_LEVEL'] ?? 'info' }
        : {
            level: process.env['LOG_LEVEL'] ?? 'debug',
            transport: { target: 'pino-pretty' },
          },
    bodyLimit: 100 * 1024,
  });

  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https://api.telegram.org'],
        frameAncestors: ["'none'"],
      },
    },
  });
  await app.register(cors, { origin: process.env['MINIAPP_URL'] ?? true });
  await app.register(rateLimit, { max: 200, timeWindow: '15 minutes' });
  await app.register(multipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  await app.register(cookie);

  const bot = createBot(process.env['BOT_TOKEN'] ?? '');

  app.get('/health', async () => ({ ok: true }));

  // Example protected route (role-gated admin ping).
  app.get(
    '/api/admin/ping',
    { preHandler: [jwtAuth, requireRole('ADMIN')] },
    async () => ({ ok: true }),
  );

  await registerApi(app, bot);

  // Telegram webhook — validates secret token, then hands the update to grammy.
  app.post('/webhook', async (request, reply) => {
    const secret = request.headers['x-telegram-bot-api-secret-token'];
    if (secret !== process.env['WEBHOOK_SECRET']) {
      await reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
    try {
      await bot.handleUpdate(request.body as Parameters<typeof bot.handleUpdate>[0]);
    } catch (err) {
      request.log.error({ err }, 'bot update failed');
    }
    await reply.send({ ok: true });
  });

  const port = Number(process.env['API_PORT'] ?? 3001);
  await app.listen({ port, host: '0.0.0.0' });
  await setupWebhook(bot);

  try {
    const promoted = await bootstrapAdmins();
    if (promoted > 0) app.log.info(`Bootstrapped ${promoted} super admin(s)`);
  } catch (err) {
    app.log.warn({ err }, 'admin bootstrap failed (continuing)');
  }

  // Background jobs (best-effort: API stays up even if Redis is down).
  let jobs: JobHandles | null = null;
  try {
    jobs = await startJobs(bot);
  } catch (err) {
    app.log.warn({ err }, 'background jobs unavailable (continuing without them)');
  }

  const shutdown = async (): Promise<void> => {
    try {
      if (jobs) await jobs.close();
    } catch {
      // ignore
    }
    try {
      await bot.stop();
    } catch {
      // ignore
    }
    try {
      await app.close();
    } finally {
      await prisma.$disconnect();
      await closeRedis();
      process.exit(0);
    }
  };
  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}

build().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
