import { Redis } from 'ioredis';
import type { StorageAdapter } from 'grammy';

let client: Redis | null = null;

/** Shared Redis connection (lazy singleton). */
export function getRedis(): Redis {
  if (!client) {
    client = new Redis(process.env['REDIS_URL'] ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
  }
  return client;
}

/** Close the shared Redis connection (graceful shutdown). */
export async function closeRedis(): Promise<void> {
  if (client) {
    client.disconnect();
    client = null;
  }
}

/** grammy session storage backed by Redis with per-key TTL. */
export class RedisSessionStorage<T> implements StorageAdapter<T> {
  constructor(
    private readonly redis: Redis,
    private readonly ttlSeconds = 7 * 24 * 3600,
  ) {}

  async read(key: string): Promise<T | undefined> {
    try {
      const raw = await this.redis.get(`grammy:session:${key}`);
      if (!raw) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async write(key: string, value: T): Promise<void> {
    try {
      await this.redis.set(
        `grammy:session:${key}`,
        JSON.stringify(value),
        'EX',
        this.ttlSeconds,
      );
    } catch {
      // Session persistence is best-effort; bot must stay responsive.
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(`grammy:session:${key}`);
    } catch {
      // ignore
    }
  }
}

/** Generic cached getter: returns cached JSON or loads + caches it. */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const redis = getRedis();
  try {
    const hit = await redis.get(key);
    if (hit) return JSON.parse(hit) as T;
  } catch {
    // fall through to loader
  }
  const value = await loader();
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch {
    // ignore cache write failures
  }
  return value;
}

/** Delete a cached key (e.g. after BotMessage edit). */
export async function invalidate(key: string): Promise<void> {
  try {
    await getRedis().del(key);
  } catch {
    // ignore
  }
}
