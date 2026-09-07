'use client';

import { useState } from 'react';
import { fa, jalaliTime } from '@/lib/format';
import { reviewReceiptAction } from '../actions';

interface Receipt {
  transactionId: string;
  createdAt: string;
  transaction: {
    amount: string;
    user: { firstName: string; username: string | null };
  };
}

export function ReceiptsManager({ receipts }: { receipts: Receipt[] }): JSX.Element {
  const [reason, setReason] = useState<Record<string, string>>({});
  return (
    <div className="space-y-3">
      {receipts.length === 0 && <p className="text-zinc-500">✅ رسید در انتظاری نیست.</p>}
      {receipts.map((r) => (
        <div key={r.transactionId} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
          <p className="mb-1 font-bold">
            {r.transaction.user.firstName} (@{r.transaction.user.username ?? '—'}) — {fa(r.transaction.amount)} تومان
          </p>
          <p className="mb-2 text-xs text-zinc-500">{jalaliTime(r.createdAt)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => reviewReceiptAction(r.transactionId, true)} className="rounded bg-green-600 px-3 py-1 text-sm text-white">
              ✅ تایید
            </button>
            <input
              value={reason[r.transactionId] ?? ''}
              onChange={(e) => setReason((s) => ({ ...s, [r.transactionId]: e.target.value }))}
              placeholder="دلیل رد..."
              className="flex-1 rounded border border-zinc-300 p-1 text-sm dark:border-zinc-700 dark:bg-zinc-800"
            />
            <button
              onClick={() => reviewReceiptAction(r.transactionId, false, reason[r.transactionId] ?? 'بدون دلیل')}
              className="rounded bg-red-600 px-3 py-1 text-sm text-white"
            >
              ❌ رد
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
