import crypto from 'node:crypto';
import type { Bot } from 'grammy';
import { prisma } from '@vitoribot/db';
import { decrypt, encrypt } from '../../lib/encryption.js';
import { generateTotpSecret, totpProvisionUrl, verifyTotp } from '../../lib/totp.js';
import { getRedis } from '../../lib/redis.js';
import { issuePair, issueTemp2fa, verifyTemp2fa, type TokenPair } from './tokens.js';
import type { BotContext } from '../../bot/types.js';

const CODE_TTL_SECONDS = 300;

function randomCode(): string {
  return crypto.randomInt(100_000, 1_000_000).toString();
}

/** Send a one-time login code to a staff member via the bot. */
export async function requestLoginCode(bot: Bot<BotContext>, telegramId: bigint): Promise<void> {
  const user = await prisma.user.findUnique({ where: { telegramId } });
  // Generic path: do not reveal whether the account exists or is staff.
  if (!user || (user.role !== 'SUPPORT' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    return;
  }
  if (user.isBlocked) return;
  const code = randomCode();
  await getRedis().set(`login:code:${telegramId}`, code, 'EX', CODE_TTL_SECONDS);
  try {
    await bot.api.sendMessage(
      Number(telegramId),
      `🔐 کد ورود شما: \`${code}\`\n⏱ این کد ۵ دقیقه معتبر است\\.`,
      { parse_mode: 'MarkdownV2' },
    );
  } catch {
    // Delivery failure surfaces as "invalid code" at login; do not leak details.
  }
}

export type LoginResult =
  | { need2fa: true; tempToken: string }
  | { need2fa: false; tokens: TokenPair };

/** Verify a login code; issues tokens or a 2FA challenge when TOTP is enabled. */
export async function verifyLoginCode(telegramId: bigint, code: string): Promise<LoginResult> {
  const user = await prisma.user.findUnique({ where: { telegramId } });
  if (!user || user.isBlocked) throw new Error('کد نامعتبر است.');
  const stored = await getRedis().get(`login:code:${telegramId}`);
  if (!stored) throw new Error('کد منقضی شده است. کد جدید بگیرید.');
  const a = Buffer.from(stored);
  const b = Buffer.from(code.trim());
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('کد نامعتبر است.');
  }
  await getRedis().del(`login:code:${telegramId}`);
  if (user.totpSecret) {
    return { need2fa: true, tempToken: issueTemp2fa(user.id) };
  }
  const tokens = await issuePair(user.id, user.role);
  return { need2fa: false, tokens };
}

/** Complete the 2FA step with a TOTP code. */
export async function verify2fa(tempToken: string, totp: string): Promise<TokenPair> {
  const userId = verifyTemp2fa(tempToken);
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.totpSecret || user.isBlocked) throw new Error('احراز هویت نامعتبر است.');
  const secret = decrypt(user.totpSecret);
  if (!verifyTotp(secret, totp.trim())) throw new Error('کد یکبارمصرف نامعتبر است.');
  return issuePair(user.id, user.role);
}

/** Provision a TOTP secret for a staff member (SUPER_ADMIN only). Returns otpauth URL. */
export async function provisionTotp(userId: string): Promise<{ otpauthUrl: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');
  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: encrypt(secret) } });
  const account = user.username ?? user.telegramId.toString();
  return { otpauthUrl: totpProvisionUrl(secret, account) };
}

/** Disable TOTP for a staff member. */
export async function disableTotp(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { totpSecret: null } });
}
