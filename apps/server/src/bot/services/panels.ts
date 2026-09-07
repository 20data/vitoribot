import { prisma } from '@vitoribot/db';
import { ThreeXUIClient } from '@vitoribot/3xui';
import { decrypt } from '../../lib/encryption.js';
import { getRedis } from '../../lib/redis.js';

const pool = new Map<string, ThreeXUIClient>();

/** Get (or create) a 3x-ui client for a panel. Passwords are AES-256-GCM encrypted at rest. */
export async function getPanelClient(panelId: string): Promise<ThreeXUIClient> {
  const existing = pool.get(panelId);
  if (existing) return existing;

  const panel = await prisma.panel.findUnique({ where: { id: panelId } });
  if (!panel) throw new Error('Panel not found');
  if (!panel.isActive) throw new Error('Panel is disabled');

  const password = decrypt(panel.encryptedPass);
  const redis = getRedis();
  const client = new ThreeXUIClient(panel.id, panel.url, panel.username, password, {
    get: async (key: string) => redis.get(key),
    set: async (key: string, value: string, ttlSeconds: number) =>
      void (await redis.set(key, value, 'EX', ttlSeconds)),
  });
  pool.set(panelId, client);
  return client;
}

/** Drop a pooled client (e.g. after credential change). */
export function dropPanelClient(panelId: string): void {
  pool.delete(panelId);
}

/** Mark a panel offline after connection failure. Caller notifies admins. */
export async function markPanelOffline(panelId: string): Promise<void> {
  await prisma.panel.update({
    where: { id: panelId },
    data: { isOnline: false, lastCheckedAt: new Date() },
  });
  dropPanelClient(panelId);
}

export async function markPanelOnline(panelId: string): Promise<void> {
  await prisma.panel.update({
    where: { id: panelId },
    data: { isOnline: true, lastCheckedAt: new Date() },
  });
}

/** Build a unique, URL-safe client email (max 32 chars). */
export function buildClientEmail(productCode: string, userIdShort: string, rand: string): string {
  return `${productCode}-${userIdShort}-${rand}`.slice(0, 32);
}

export const BYTES_PER_GB = 1_073_741_824;
export const MS_PER_DAY = 86_400_000;

/** Compute 3x-ui expiryTime in ms (0 = never expires). */
export function computeExpiryMs(durationDays: number, now = Date.now()): number {
  if (durationDays <= 0) return 0;
  return now + durationDays * MS_PER_DAY;
}
