'use server';

const BACKEND = process.env['BACKEND_URL'] ?? 'http://localhost:3001';

async function postJson(path: string, body: unknown): Promise<{ status: number; data: unknown }> {
  const res = await fetch(`${BACKEND}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }
  return { status: res.status, data };
}

/** Step 1: ask the backend to DM a login code to the staff member. */
export async function requestCodeAction(telegramId: string): Promise<{ ok: boolean }> {
  await postJson('/api/auth/admin/request-code', { telegramId });
  return { ok: true };
}

export type VerifyResult =
  | { need2fa: true; tempToken: string }
  | { need2fa: false; accessToken: string; refreshToken: string; role: string; userId: string }
  | { error: string };

/** Step 2: verify the code; returns tokens or a 2FA challenge. */
export async function verifyCodeAction(telegramId: string, code: string): Promise<VerifyResult> {
  const { data } = await postJson('/api/auth/admin/login', { telegramId, code });
  const d = data as Record<string, unknown>;
  if (typeof d['error'] === 'string') return { error: d['error'] };
  if (d['need2fa'] === true && typeof d['tempToken'] === 'string') {
    return { need2fa: true, tempToken: d['tempToken'] };
  }
  const tokens = d as { accessToken?: string; refreshToken?: string };
  if (typeof tokens.accessToken !== 'string' || typeof tokens.refreshToken !== 'string') {
    return { error: 'خطای سرور' };
  }
  // Decode role/userId from the JWT payload (no verification — authorize() verifies).
  const payload = JSON.parse(
    Buffer.from(tokens.accessToken.split('.')[1] ?? '', 'base64').toString(),
  ) as { userId?: string; role?: string };
  return {
    need2fa: false,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    role: payload.role ?? 'USER',
    userId: payload.userId ?? '',
  };
}

/** Step 3 (optional): verify the TOTP code. */
export async function verifyTotpAction(tempToken: string, totp: string): Promise<VerifyResult> {
  const { data } = await postJson('/api/auth/admin/2fa', { tempToken, totp });
  const d = data as Record<string, unknown>;
  if (typeof d['error'] === 'string') return { error: d['error'] };
  const tokens = d as { accessToken?: string; refreshToken?: string };
  if (typeof tokens.accessToken !== 'string' || typeof tokens.refreshToken !== 'string') {
    return { error: 'خطای سرور' };
  }
  const payload = JSON.parse(
    Buffer.from(tokens.accessToken.split('.')[1] ?? '', 'base64').toString(),
  ) as { userId?: string; role?: string };
  return {
    need2fa: false,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    role: payload.role ?? 'USER',
    userId: payload.userId ?? '',
  };
}
