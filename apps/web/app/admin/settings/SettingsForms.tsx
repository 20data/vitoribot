'use client';

import { useState } from 'react';
import {
  adminAddAction,
  adminRemoveAction,
  adminRoleAction,
  channelAddAction,
  channelDeleteAction,
  saveMessageAction,
  saveSettingsAction,
  totpProvisionAction,
} from '../actions';

export function PaymentSettings({ initial }: { initial: Record<string, string> }): JSX.Element {
  const [form, setForm] = useState({
    'payment.card_number': initial['payment.card_number'] ?? '',
    'payment.card_holder': initial['payment.card_holder'] ?? '',
    'payment.card_bank': initial['payment.card_bank'] ?? '',
  });
  return (
    <div className="space-y-2">
      <p className="font-bold">💳 تنظیمات پرداخت</p>
      {Object.entries(form).map(([k, v]) => (
        <input
          key={k}
          value={v}
          onChange={(e) => setForm((s) => ({ ...s, [k]: e.target.value }))}
          placeholder={k}
          className="w-full rounded border p-2 dark:bg-zinc-800"
        />
      ))}
      <button onClick={() => saveSettingsAction(form)} className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
        ذخیره
      </button>
    </div>
  );
}

export function MessageEditor({ messages }: { messages: Array<{ key: string; content: string }> }): JSX.Element {
  const [selected, setSelected] = useState(messages[0]?.key ?? '');
  const [content, setContent] = useState(messages[0]?.content ?? '');
  return (
    <div className="space-y-2">
      <p className="font-bold">📝 پیام‌های ربات</p>
      <select
        value={selected}
        onChange={(e) => {
          setSelected(e.target.value);
          setContent(messages.find((m) => m.key === e.target.value)?.content ?? '');
        }}
        className="w-full rounded border p-2 dark:bg-zinc-800"
      >
        {messages.map((m) => (
          <option key={m.key} value={m.key}>{m.key}</option>
        ))}
      </select>
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} className="w-full rounded border p-2 dark:bg-zinc-800" />
      <button onClick={() => saveMessageAction(selected, content)} className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
        ذخیره پیام
      </button>
    </div>
  );
}

export function ChannelManager({ channels }: { channels: Array<{ id: string; channelUsername: string; channelTitle: string }> }): JSX.Element {
  const [form, setForm] = useState({ channelId: '', channelUsername: '', channelTitle: '' });
  return (
    <div className="space-y-2">
      <p className="font-bold">📣 کانال‌های اجباری</p>
      {channels.map((c) => (
        <div key={c.id} className="flex items-center justify-between rounded border p-2">
          <span>{c.channelTitle} (@{c.channelUsername})</span>
          <button onClick={() => channelDeleteAction(c.id)} className="text-sm text-red-600">حذف</button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <input value={form.channelUsername} onChange={(e) => setForm((s) => ({ ...s, channelUsername: e.target.value }))} placeholder="@username" className="rounded border p-2 dark:bg-zinc-800" dir="ltr" />
        <input value={form.channelId} onChange={(e) => setForm((s) => ({ ...s, channelId: e.target.value }))} placeholder="-100..." className="rounded border p-2 dark:bg-zinc-800" dir="ltr" />
        <input value={form.channelTitle} onChange={(e) => setForm((s) => ({ ...s, channelTitle: e.target.value }))} placeholder="عنوان" className="rounded border p-2 dark:bg-zinc-800" />
        <button onClick={() => channelAddAction(form).then(() => setForm({ channelId: '', channelUsername: '', channelTitle: '' }))} className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
          ➕
        </button>
      </div>
    </div>
  );
}

export function AdminManager({
  admins,
}: {
  admins: Array<{ id: string; telegramId: string; username: string | null; firstName: string; role: string }>;
}): JSX.Element {
  const [telegramId, setTelegramId] = useState('');
  const [otpauth, setOtpauth] = useState('');
  return (
    <div className="space-y-2">
      <p className="font-bold">👑 ادمین‌ها (سوپر ادمین)</p>
      {admins.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded border p-2">
          <span>{a.firstName} (@{a.username ?? '—'}) — {a.role}</span>
          <div className="flex gap-2">
            <select
              value={a.role}
              onChange={(e) => adminRoleAction(a.id, e.target.value)}
              className="rounded border p-1 text-sm dark:bg-zinc-800"
            >
              {['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'USER'].map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <button onClick={() => totpProvisionAction(a.id).then(setOtpauth)} className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
              🔑 2FA
            </button>
            <button onClick={() => adminRemoveAction(a.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">
              حذف
            </button>
          </div>
        </div>
      ))}
      {otpauth && <p className="break-all rounded bg-zinc-100 p-2 text-xs dark:bg-zinc-800" dir="ltr">{otpauth}</p>}
      <div className="flex gap-2">
        <input value={telegramId} onChange={(e) => setTelegramId(e.target.value)} placeholder="شناسه تلگرام" inputMode="numeric" className="rounded border p-2 dark:bg-zinc-800" />
        <button onClick={() => adminAddAction(telegramId, 'ADMIN').then(() => setTelegramId(''))} className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">
          ➕ افزودن ادمین
        </button>
      </div>
    </div>
  );
}
