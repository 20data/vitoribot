import { auth } from '@/auth';

const BACKEND = process.env['BACKEND_URL'] ?? 'http://localhost:3001';

/** Backend fetch with the session JWT. Throws with Persian message on failure. */
export async function api(path: string, init?: RequestInit): Promise<Response> {
  const session = await auth();
  const res = await fetch(`${BACKEND}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  return res;
}

export async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await api(path, init);
  if (!res.ok) {
    let message = 'خطای سرور';
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // keep generic message
    }
    throw new Error(`${res.status}: ${message}`);
  }
  return (await res.json()) as T;
}

/** Backend URL for client components (public, same-origin proxy not needed in dev). */
export const BACKEND_URL = process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001';
