'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Badge } from '@/components/ui';
import { panelDeleteAction, panelSaveAction, panelTestAction } from '../actions';

const schema = z.object({
  name: z.string().min(1, 'الزامی'),
  url: z.string().url('آدرس معتبر نیست'),
  username: z.string().min(1, 'الزامی'),
  password: z.string().min(1, 'الزامی'),
});

interface Panel {
  id: string;
  name: string;
  url: string;
  isOnline: boolean;
  isActive: boolean;
}

export function PanelsManager({ panels }: { panels: Panel[] }): JSX.Element {
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  return (
    <div className="space-y-4">
      <form
        onSubmit={form.handleSubmit(async (v) => {
          await panelSaveAction(v);
          form.reset();
        })}
        className="grid gap-2 rounded-xl border border-zinc-200 p-4 md:grid-cols-5 dark:border-zinc-800"
      >
        <input {...form.register('name')} placeholder="نام نمایشی" className="rounded border p-2 dark:bg-zinc-800" />
        <input {...form.register('url')} placeholder="https://panel:2053" className="rounded border p-2 dark:bg-zinc-800" dir="ltr" />
        <input {...form.register('username')} placeholder="نام کاربری" className="rounded border p-2 dark:bg-zinc-800" />
        <input {...form.register('password')} placeholder="رمز عبور" type="password" className="rounded border p-2 dark:bg-zinc-800" />
        <button className="rounded bg-zinc-900 p-2 text-white dark:bg-zinc-100 dark:text-zinc-900">➕ افزودن (با تست اتصال)</button>
      </form>

      <div className="grid gap-3 md:grid-cols-2">
        {panels.map((p) => (
          <div key={p.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="mb-1 flex items-center justify-between">
              <span className="font-bold">{p.name}</span>
              <Badge color={p.isOnline ? 'green' : 'red'}>{p.isOnline ? 'آنلاین' : 'آفلاین'}</Badge>
            </div>
            <p className="mb-3 text-sm text-zinc-500" dir="ltr">{p.url}</p>
            <div className="flex gap-2">
              <button onClick={() => panelTestAction(p.id).then((m) => alert(m)).catch((e: Error) => alert(e.message))} className="rounded bg-blue-100 px-2 py-1 text-xs text-blue-800">
                تست اتصال
              </button>
              <button onClick={() => confirm('حذف شود؟') && panelDeleteAction(p.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">
                حذف
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
