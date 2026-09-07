import type { FastifyReply, FastifyRequest } from 'fastify';
import type { ZodSchema } from 'zod';

type Source = 'body' | 'query' | 'params';

/**
 * Zod validation preHandler. On failure responds 400 with a Persian message.
 * Parsed data replaces the original source object.
 */
export function validate(schema: ZodSchema, source: Source = 'body') {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const parsed = schema.safeParse(request[source]);
    if (!parsed.success) {
      await reply.code(400).send({
        error: 'ورودی نامعتبر است',
        details: parsed.error.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      });
      return;
    }
    (request[source] as unknown) = parsed.data;
  };
}

/** Per-user hourly rate limit (Redis sliding window) for payment routes. */
export function payRateLimit(maxPerHour: number) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = (request as FastifyRequest & { user?: { userId: string } }).user;
    if (!user) return;
    const { getRedis } = await import('../../lib/redis.js');
    const key = `paylimit:${user.userId}`;
    try {
      const count = await getRedis().incr(key);
      if (count === 1) await getRedis().expire(key, 3600);
      if (count > maxPerHour) {
        await reply.code(429).send({ error: 'تعداد درخواست بیش از حد مجاز است. بعداً تلاش کنید.' });
      }
    } catch {
      // Fail open if Redis is down.
    }
  };
}
