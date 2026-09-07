import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { getRedis } from '../../lib/redis.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface AccessClaims {
  userId: string;
  role: string;
}

function privateKey(): string {
  return (process.env['JWT_PRIVATE_KEY'] ?? '').replace(/\\n/g, '\n');
}

function publicKey(): string {
  return (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
}

const ACCESS_TTL = '15m';
const REFRESH_TTL_SECONDS = 30 * 24 * 3600;

/** Issue a JWT pair. Refresh tokens rotate within a family for theft detection. */
export async function issuePair(userId: string, role: string, familyId?: string): Promise<TokenPair> {
  const family = familyId ?? crypto.randomUUID();
  const jti = crypto.randomUUID();
  const accessToken = jwt.sign({ userId, role } satisfies AccessClaims, privateKey(), {
    algorithm: 'RS256',
    expiresIn: ACCESS_TTL,
  });
  const refreshToken = jwt.sign({ userId, role, jti, family }, privateKey(), {
    algorithm: 'RS256',
    expiresIn: `${REFRESH_TTL_SECONDS}s`,
  });
  const redis = getRedis();
  await redis.set(`refresh:${jti}`, JSON.stringify({ userId, role, family }), 'EX', REFRESH_TTL_SECONDS);
  await redis.sadd(`family:${family}`, jti);
  await redis.expire(`family:${family}`, REFRESH_TTL_SECONDS);
  return { accessToken, refreshToken };
}

interface RefreshClaims {
  userId: string;
  role: string;
  jti: string;
  family: string;
}

/**
 * Rotate a refresh token: single-use; reuse of a spent token revokes the
 * entire family (theft detection). Returns a fresh pair.
 */
export async function rotatePair(refreshToken: string): Promise<TokenPair> {
  let claims: RefreshClaims;
  try {
    claims = jwt.verify(refreshToken, publicKey(), { algorithms: ['RS256'] }) as RefreshClaims;
  } catch {
    throw new Error('Invalid refresh token');
  }
  if (!claims.jti || !claims.family) throw new Error('Invalid refresh token');

  const redis = getRedis();
  const revoked = await redis.get(`family:${claims.family}:revoked`);
  if (revoked) throw new Error('Token family revoked');

  const stored = await redis.get(`refresh:${claims.jti}`);
  if (!stored) {
    // Possible reuse of an already-rotated token → revoke the whole family.
    await redis.set(`family:${claims.family}:revoked`, '1', 'EX', REFRESH_TTL_SECONDS);
    const members = await redis.smembers(`family:${claims.family}`);
    if (members.length > 0) {
      const pipe = redis.pipeline();
      for (const m of members) pipe.del(`refresh:${m}`);
      pipe.del(`family:${claims.family}`);
      await pipe.exec();
    }
    throw new Error('Token reuse detected');
  }

  await redis.del(`refresh:${claims.jti}`);
  return issuePair(claims.userId, claims.role, claims.family);
}

/** Verify an access token and return its claims. */
export function verifyAccess(token: string): AccessClaims {
  return jwt.verify(token, publicKey(), { algorithms: ['RS256'] }) as AccessClaims;
}

/** Short-lived token for the admin 2FA step (5 minutes). */
export function issueTemp2fa(userId: string): string {
  return jwt.sign({ userId, purpose: '2fa' }, privateKey(), {
    algorithm: 'RS256',
    expiresIn: '5m',
  });
}

export function verifyTemp2fa(token: string): string {
  const payload = jwt.verify(token, publicKey(), { algorithms: ['RS256'] }) as {
    userId: string;
    purpose: string;
  };
  if (payload.purpose !== '2fa' || !payload.userId) throw new Error('Invalid 2FA token');
  return payload.userId;
}
