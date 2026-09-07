import { prisma } from '@vitoribot/db';

/**
 * Bootstrap the first SUPER_ADMINs from BOOTSTRAP_ADMIN_IDS
 * (comma-separated Telegram IDs). Runs once at boot; only promotes
 * existing users that already started the bot.
 */
export async function bootstrapAdmins(): Promise<number> {
  const raw = process.env['BOOTSTRAP_ADMIN_IDS'] ?? '';
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^\d+$/.test(s));
  if (ids.length === 0) return 0;
  let promoted = 0;
  for (const id of ids) {
    try {
      const res = await prisma.user.updateMany({
        where: { telegramId: BigInt(id), role: 'USER' },
        data: { role: 'SUPER_ADMIN' },
      });
      promoted += res.count;
    } catch {
      // Best-effort: never block boot.
    }
  }
  return promoted;
}
