import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    role?: string;
    error?: string;
  }
  interface User {
    accessToken?: string;
    refreshToken?: string;
    role?: string;
  }
}

interface TokenShape {
  accessToken?: string;
  refreshToken?: string;
  role?: string;
  userId?: string;
  accessExp?: number;
  error?: string;
}

const BACKEND = process.env['BACKEND_URL'] ?? 'http://localhost:3001';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        accessToken: { label: 'accessToken', type: 'text' },
        refreshToken: { label: 'refreshToken', type: 'text' },
        userId: { label: 'userId', type: 'text' },
        role: { label: 'role', type: 'text' },
      },
      authorize: async (creds) => {
        const accessToken = creds?.['accessToken'];
        if (typeof accessToken !== 'string' || !accessToken) return null;
        // Verify the backend token and read the role server-side.
        try {
          const res = await fetch(`${BACKEND}/api/me`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            cache: 'no-store',
          });
          if (!res.ok) return null;
        } catch {
          return null;
        }
        const role = creds?.['role'];
        const userId = creds?.['userId'];
        if (typeof userId !== 'string' || typeof role !== 'string') return null;
        if (role !== 'SUPER_ADMIN' && role !== 'ADMIN' && role !== 'SUPPORT') return null;
        return {
          id: userId,
          role,
          accessToken,
          refreshToken: typeof creds?.['refreshToken'] === 'string' ? creds?.['refreshToken'] : undefined,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user }) => {
      const t = token as unknown as TokenShape;
      if (user) {
        t.accessToken = user.accessToken;
        t.refreshToken = user.refreshToken;
        t.role = user.role;
        t.userId = user.id;
        t.accessExp = Date.now() + 14 * 60_000;
        return token;
      }
      // Rotate the access token when it is about to expire.
      if (t.accessToken && t.accessExp && Date.now() < t.accessExp) {
        return token;
      }
      if (!t.refreshToken) return token;
      try {
        const res = await fetch(`${BACKEND}/api/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: t.refreshToken }),
        });
        if (!res.ok) throw new Error('refresh failed');
        const pair = (await res.json()) as { accessToken: string; refreshToken: string };
        t.accessToken = pair.accessToken;
        t.refreshToken = pair.refreshToken;
        t.accessExp = Date.now() + 14 * 60_000;
        delete t.error;
      } catch {
        t.error = 'RefreshFailed';
      }
      return token;
    },
    session: ({ session, token }) => {
      const t = token as unknown as TokenShape;
      return {
        ...session,
        accessToken: t.accessToken,
        role: t.role,
        error: t.error,
      };
    },
  },
});
