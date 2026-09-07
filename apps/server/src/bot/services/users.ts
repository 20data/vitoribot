import { prisma } from '@vitoribot/db';

/** Insert or update a Telegram user. Returns the DB record. */
export async function upsertUser(data: {
  telegramId: bigint;
  username?: string;
  firstName: string;
  lastName?: string;
}): Promise<{ id: string; role: string; isBlocked: boolean; isTermsAccepted: boolean }> {
  const user = await prisma.user.upsert({
    where: { telegramId: data.telegramId },
    update: {
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
    },
    create: {
      telegramId: data.telegramId,
      username: data.username,
      firstName: data.firstName,
      lastName: data.lastName,
    },
    select: { id: true, role: true, isBlocked: true, isTermsAccepted: true },
  });
  return user;
}

export async function acceptTerms(dbUserId: string): Promise<void> {
  await prisma.user.update({
    where: { id: dbUserId },
    data: { isTermsAccepted: true },
  });
}

export async function getDbUserByTelegramId(telegramId: bigint) {
  return prisma.user.findUnique({ where: { telegramId } });
}

export function isAdminRole(role: string): boolean {
  return role === 'ADMIN' || role === 'SUPER_ADMIN';
}

export function isSupportRole(role: string): boolean {
  return role === 'SUPPORT' || isAdminRole(role);
}
