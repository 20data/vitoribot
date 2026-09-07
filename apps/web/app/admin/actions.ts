'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

const BACKEND = process.env['BACKEND_URL'] ?? 'http://localhost:3001';

async function backend(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const session = await auth();
  const res = await fetch(`${BACKEND}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });
  if (!res.ok) {
    let message = `خطا ${res.status}`;
    try {
      const b = (await res.json()) as { error?: string };
      if (b.error) message = b.error;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function revalidate(): void {
  revalidatePath('/admin', 'layout');
}

export async function updateUserAction(id: string, data: { role?: string; isBlocked?: boolean; balance?: number; balanceReason?: string }): Promise<void> {
  await backend(`/api/admin/users/${id}`, 'PATCH', data);
  revalidate();
}

export async function sendUserMessageAction(id: string, message: string): Promise<void> {
  await backend(`/api/admin/users/${id}/message`, 'POST', { message });
  revalidate();
}

export async function subAction(id: string, action: 'suspend' | 'restore' | 'reset' | 'delete'): Promise<void> {
  await backend(`/api/admin/subscriptions/${id}/${action}`, 'POST');
  revalidate();
}

export async function reviewReceiptAction(txId: string, approve: boolean, reason?: string): Promise<void> {
  await backend(`/api/admin/receipts/${txId}/review`, 'POST', { approve, reason });
  revalidate();
}

export async function productSaveAction(data: Record<string, unknown>, id?: string): Promise<void> {
  if (id) await backend(`/api/admin/products/${id}`, 'PATCH', data);
  else await backend('/api/admin/products', 'POST', data);
  revalidate();
}

export async function productDeleteAction(id: string): Promise<void> {
  await backend(`/api/admin/products/${id}`, 'DELETE');
  revalidate();
}

export async function panelSaveAction(data: Record<string, unknown>, id?: string): Promise<void> {
  if (id) await backend(`/api/admin/panels/${id}`, 'PATCH', data);
  else await backend('/api/admin/panels', 'POST', data);
  revalidate();
}

export async function panelDeleteAction(id: string): Promise<void> {
  await backend(`/api/admin/panels/${id}`, 'DELETE');
  revalidate();
}

export async function panelTestAction(id: string): Promise<string> {
  await backend(`/api/admin/panels/${id}/test`, 'POST');
  return 'اتصال موفق بود ✅';
}

export async function ticketReplyAction(id: string, message: string): Promise<void> {
  await backend(`/api/admin/tickets/${id}/reply`, 'POST', { message });
  revalidate();
}

export async function ticketStatusAction(id: string, open: boolean): Promise<void> {
  await backend(`/api/admin/tickets/${id}/${open ? 'reopen' : 'close'}`, 'POST');
  revalidate();
}

export async function deptSaveAction(data: { name: string; isActive?: boolean }, id?: string): Promise<void> {
  if (id) await backend(`/api/admin/departments/${id}`, 'PATCH', data);
  else await backend('/api/admin/departments', 'POST', data);
  revalidate();
}

export async function discountCreateAction(data: Record<string, unknown>): Promise<void> {
  await backend('/api/admin/discounts', 'POST', data);
  revalidate();
}

export async function discountDeleteAction(id: string): Promise<void> {
  await backend(`/api/admin/discounts/${id}`, 'DELETE');
  revalidate();
}

export async function giftCreateAction(data: Record<string, unknown>): Promise<void> {
  await backend('/api/admin/gifts', 'POST', data);
  revalidate();
}

export async function giftDeleteAction(id: string): Promise<void> {
  await backend(`/api/admin/gifts/${id}`, 'DELETE');
  revalidate();
}

export async function broadcastSendAction(target: string, message: string): Promise<void> {
  await backend('/api/admin/broadcast', 'POST', { target, message });
  revalidate();
}

export async function saveSettingsAction(data: Record<string, string>): Promise<void> {
  await backend('/api/admin/settings', 'PUT', data);
  revalidate();
}

export async function saveMessageAction(key: string, content: string): Promise<void> {
  await backend(`/api/admin/messages/${encodeURIComponent(key)}`, 'PUT', { content });
  revalidate();
}

export async function channelAddAction(data: { channelId: string; channelUsername: string; channelTitle: string }): Promise<void> {
  await backend('/api/admin/channels', 'POST', data);
  revalidate();
}

export async function channelDeleteAction(id: string): Promise<void> {
  await backend(`/api/admin/channels/${id}`, 'DELETE');
  revalidate();
}

export async function adminAddAction(telegramId: string, role: string): Promise<void> {
  await backend('/api/admin/admins', 'POST', { telegramId, role });
  revalidate();
}

export async function adminRoleAction(id: string, role: string): Promise<void> {
  await backend(`/api/admin/admins/${id}`, 'PATCH', { role });
  revalidate();
}

export async function adminRemoveAction(id: string): Promise<void> {
  await backend(`/api/admin/admins/${id}`, 'DELETE');
  revalidate();
}

export async function totpProvisionAction(id: string): Promise<string> {
  const res = (await backend(`/api/admin/admins/${id}/totp`, 'POST')) as { otpauthUrl: string };
  return res.otpauthUrl;
}
