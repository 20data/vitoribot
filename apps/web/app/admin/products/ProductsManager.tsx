'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { fa } from '@/lib/format';
import { productDeleteAction, productSaveAction } from '../actions';

const schema = z.object({
  panelId: z.string().uuid('پنل معتبر نیست'),
  groupName: z.string().min(1, 'الزامی'),
  name: z.string().min(1, 'الزامی'),
  inboundId: z.coerce.number().int().positive('عدد مثبت'),
  trafficGB: z.coerce.number().int().positive('عدد مثبت'),
  durationDays: z.coerce.number().int().positive('عدد مثبت'),
  price: z.coerce.number().nonnegative('عدد نامعتبر'),
});

interface Product {
  id: string;
  panelId: string;
  groupName: string;
  name: string;
  inboundId: number;
  trafficGB: number;
  durationDays: number;
  price: string;
  isActive: boolean;
}

export function ProductsManager({
  products,
  panels,
}: {
  products: Product[];
  panels: Array<{ id: string; name: string }>;
}): JSX.Element {
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  return (
    <div className="space-y-4">
      <form
        onSubmit={form.handleSubmit(async (v) => {
          await productSaveAction(v);
          form.reset();
        })}
        className="grid grid-cols-2 gap-2 rounded-xl border border-zinc-200 p-4 md:grid-cols-4 dark:border-zinc-800"
      >
        <select {...form.register('panelId')} className="rounded border p-2 dark:bg-zinc-800">
          <option value="">پنل...</option>
          {panels.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <input {...form.register('groupName')} placeholder="نام گروه" className="rounded border p-2 dark:bg-zinc-800" />
        <input {...form.register('name')} placeholder="نام محصول" className="rounded border p-2 dark:bg-zinc-800" />
        <input {...form.register('inboundId')} placeholder="inbound ID" inputMode="numeric" className="rounded border p-2 dark:bg-zinc-800" />
        <input {...form.register('trafficGB')} placeholder="ترافیک (گیگ)" inputMode="numeric" className="rounded border p-2 dark:bg-zinc-800" />
        <input {...form.register('durationDays')} placeholder="مدت (روز)" inputMode="numeric" className="rounded border p-2 dark:bg-zinc-800" />
        <input {...form.register('price')} placeholder="قیمت (تومان)" inputMode="numeric" className="rounded border p-2 dark:bg-zinc-800" />
        <button className="rounded bg-zinc-900 p-2 text-white dark:bg-zinc-100 dark:text-zinc-900">➕ افزودن</button>
      </form>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-right text-zinc-500">
            <th className="p-2">گروه</th>
            <th className="p-2">نام</th>
            <th className="p-2">ترافیک/مدت</th>
            <th className="p-2">قیمت</th>
            <th className="p-2">عملیات</th>
          </tr>
        </thead>
        <tbody>
          {products.map((p) => (
            <tr key={p.id} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="p-2">{p.groupName}</td>
              <td className="p-2">{p.name}</td>
              <td className="p-2">{fa(p.trafficGB)} گیگ / {fa(p.durationDays)} روز</td>
              <td className="p-2">{fa(p.price)}</td>
              <td className="p-2">
                <button
                  onClick={() => productSaveAction({ isActive: !p.isActive }, p.id)}
                  className="ml-2 rounded bg-yellow-100 px-2 py-1 text-xs text-yellow-800"
                >
                  {p.isActive ? 'غیرفعال' : 'فعال'}
                </button>
                <button
                  onClick={() => confirm('حذف شود؟') && productDeleteAction(p.id)}
                  className="rounded bg-red-100 px-2 py-1 text-xs text-red-800"
                >
                  حذف
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
