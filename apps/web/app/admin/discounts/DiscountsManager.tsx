'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { fa } from '@/lib/format';
import { discountCreateAction, discountDeleteAction, giftCreateAction, giftDeleteAction } from '../actions';

const discountSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{4,32}$/, 'کد انگلیسی بزرگ'),
  type: z.enum(['PERCENT', 'FIXED_AMOUNT']),
  value: z.coerce.number().positive('عدد مثبت'),
});
const giftSchema = z.object({
  code: z.string().regex(/^[A-Z0-9]{4,32}$/, 'کد انگلیسی بزرگ'),
  amount: z.coerce.number().positive('عدد مثبت'),
});

export function DiscountsManager({
  discounts,
  gifts,
}: {
  discounts: Array<{ id: string; code: string; type: string; value: string; usedCount: number; maxUses: number | null }>;
  gifts: Array<{ id: string; code: string; amount: string; usedCount: number; maxUses: number | null }>;
}): JSX.Element {
  const dForm = useForm<z.infer<typeof discountSchema>>({ resolver: zodResolver(discountSchema) });
  const gForm = useForm<z.infer<typeof giftSchema>>({ resolver: zodResolver(giftSchema) });

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 font-bold">🏷️ کدهای تخفیف</p>
        <form onSubmit={dForm.handleSubmit(async (v) => { await discountCreateAction(v); dForm.reset(); })} className="mb-3 flex flex-wrap gap-2">
          <input {...dForm.register('code')} placeholder="CODE" dir="ltr" className="rounded border p-2 dark:bg-zinc-800" />
          <select {...dForm.register('type')} className="rounded border p-2 dark:bg-zinc-800">
            <option value="PERCENT">درصدی</option>
            <option value="FIXED_AMOUNT">مبلغ ثابت</option>
          </select>
          <input {...dForm.register('value')} placeholder="مقدار" inputMode="numeric" className="rounded border p-2 dark:bg-zinc-800" />
          <button className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">➕</button>
        </form>
        <table className="w-full text-sm">
          <tbody>
            {discounts.map((d) => (
              <tr key={d.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="p-2" dir="ltr">{d.code}</td>
                <td className="p-2">{d.type === 'PERCENT' ? `${fa(d.value)}٪` : `${fa(d.value)} تومان`}</td>
                <td className="p-2">{fa(d.usedCount)}/{d.maxUses === null ? '∞' : fa(d.maxUses)}</td>
                <td className="p-2">
                  <button onClick={() => discountDeleteAction(d.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">غیرفعال</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div>
        <p className="mb-2 font-bold">🎁 کدهای هدیه</p>
        <form onSubmit={gForm.handleSubmit(async (v) => { await giftCreateAction(v); gForm.reset(); })} className="mb-3 flex flex-wrap gap-2">
          <input {...gForm.register('code')} placeholder="CODE" dir="ltr" className="rounded border p-2 dark:bg-zinc-800" />
          <input {...gForm.register('amount')} placeholder="مبلغ (تومان)" inputMode="numeric" className="rounded border p-2 dark:bg-zinc-800" />
          <button className="rounded bg-zinc-900 px-3 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">➕</button>
        </form>
        <table className="w-full text-sm">
          <tbody>
            {gifts.map((g) => (
              <tr key={g.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="p-2" dir="ltr">{g.code}</td>
                <td className="p-2">{fa(g.amount)} تومان</td>
                <td className="p-2">{fa(g.usedCount)}/{g.maxUses === null ? '∞' : fa(g.maxUses)}</td>
                <td className="p-2">
                  <button onClick={() => giftDeleteAction(g.id)} className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">غیرفعال</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
