'use client';

import { useState } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { fa, jalali } from '@/lib/format';
import { Badge } from '@/components/ui';
import { sendUserMessageAction, updateUserAction } from '../actions';

interface UserRow {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string;
  balance: string;
  role: string;
  isBlocked: boolean;
  createdAt: string;
  _count: { subscriptions: number };
}

const col = createColumnHelper<UserRow>();

const columns = [
  col.accessor('firstName', { header: 'نام' }),
  col.accessor('username', { header: 'یوزرنیم', cell: (c) => c.getValue() ?? '—' }),
  col.accessor('balance', { header: 'موجودی', cell: (c) => fa(c.getValue()) }),
  col.accessor('_count.subscriptions', { header: 'سرویس‌ها', cell: (c) => fa(c.getValue()) }),
  col.accessor('createdAt', { header: 'عضویت', cell: (c) => jalali(c.getValue()) }),
  col.accessor('isBlocked', {
    header: 'وضعیت',
    cell: (c) => <Badge color={c.getValue() ? 'red' : 'green'}>{c.getValue() ? 'مسدود' : 'عادی'}</Badge>,
  }),
];

export function UsersTable({ users }: { users: UserRow[] }): JSX.Element {
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [message, setMessage] = useState('');
  const table = useReactTable({ data: users, columns, getCoreRowModel: getCoreRowModel() });

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id} className="text-right text-zinc-500">
              {hg.headers.map((h) => (
                <th key={h.id} className="p-2">
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
              <th className="p-2">عملیات</th>
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-800">
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="p-2">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
              <td className="p-2">
                <button onClick={() => setSelected(row.original)} className="rounded bg-zinc-200 px-2 py-1 text-xs dark:bg-zinc-700">
                  جزئیات
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {selected && (
        <div className="mt-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="mb-2 font-bold">👤 {selected.firstName} (@{selected.username ?? '—'}) — 🆔 {fa(selected.telegramId)}</p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => updateUserAction(selected.id, { isBlocked: !selected.isBlocked }).then(() => setSelected(null))}
              className="rounded bg-red-100 px-3 py-1 text-sm text-red-700"
            >
              {selected.isBlocked ? '✅ رفع بلاک' : '🚫 بلاک'}
            </button>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="ارسال پیام به کاربر..."
              className="flex-1 rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <button
              onClick={() => sendUserMessageAction(selected.id, message).then(() => setMessage(''))}
              className="rounded bg-zinc-900 px-3 py-1 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              ارسال
            </button>
          </div>
          <button onClick={() => setSelected(null)} className="mt-2 text-sm text-zinc-500">بستن</button>
        </div>
      )}
    </div>
  );
}
