import { prisma } from '@vitoribot/db';
import { getPanelClient } from '../bot/services/panels.js';

const RETENTION_MS = 7 * 24 * 3600_000;

/**
 * Hourly: mark past-expiry ACTIVE subscriptions as EXPIRED (configs are kept
 * for 7 days for possible renewal), then delete long-expired clients
 * from the 3x-ui panel and clean up our records.
 */
export async function runExpiryHandler(now = new Date()): Promise<void> {
  const newlyExpired = await prisma.subscription.updateMany({
    where: { status: 'ACTIVE', expiresAt: { lt: now } },
    data: { status: 'EXPIRED' },
  });
  void newlyExpired;

  const stale = await prisma.subscription.findMany({
    where: { status: 'EXPIRED', expiresAt: { lt: new Date(now.getTime() - RETENTION_MS) } },
    take: 100,
  });
  for (const sub of stale) {
    try {
      const client = await getPanelClient(sub.panelId);
      await client.deleteClient(sub.inboundId, sub.clientUuid);
    } catch {
      // Panel unreachable — keep our record and retry on the next run.
      continue;
    }
    await prisma.subscription.delete({ where: { id: sub.id } });
  }
}
