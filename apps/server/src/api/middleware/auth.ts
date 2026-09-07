import type { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  role: string;
}

function getPublicKey(): string {
  return (process.env['JWT_PUBLIC_KEY'] ?? '').replace(/\\n/g, '\n');
}

/** Verify Bearer JWT and attach user to request. */
export async function jwtAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      await reply.code(401).send({ error: 'Unauthorized' });
      return;
    }
    const token = header.slice('Bearer '.length);
    const payload = jwt.verify(token, getPublicKey(), { algorithms: ['RS256'] }) as JwtPayload;
    (request as FastifyRequest & { user?: JwtPayload }).user = payload;
  } catch {
    await reply.code(401).send({ error: 'Unauthorized' });
  }
}

/** Route-level role guard: requires minimum role in hierarchy. */
const RANK: Record<string, number> = { USER: 0, SUPPORT: 1, ADMIN: 2, SUPER_ADMIN: 3 };

export function requireRole(minRole: keyof typeof RANK) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const user = (request as FastifyRequest & { user?: JwtPayload }).user;
    const rank = user ? (RANK[user.role] ?? -1) : -1;
    if (rank < RANK[minRole]!) {
      await reply.code(403).send({ error: 'Forbidden' });
    }
  };
}
