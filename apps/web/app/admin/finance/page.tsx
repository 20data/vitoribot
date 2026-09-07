import { apiJson } from '@/lib/api';
import { fa, jalali } from '@/lib/format';
import { Card, PageTitle } from '@/components/ui';
import { ReceiptsManager } from './ReceiptsManager';

export const dynamic = 'force-dynamic';

export default async function FinancePage(): Promise<JSX.Element> {
  const [receipts, txns] = await Promise.all([
    apiJson<{ items: Array<{ transactionId: string; createdAt: string; transaction: { amount: string; user: { firstName: string; username: string | null } } }> }>(
      '/api/admin/receipts?status=PENDING&page=1&pageSize=20',
    ),
    apiJson<{ items: Array<{ id: string; amount: string; type: string; status: string; createdAt: string }> }>(
      '/api/admin/transactions?page=1&pageSize=20',
    ),
  ]);

  return (
    <div className="space-y-4">
      <PageTitle>مالی</PageTitle>
      <Card>
        <p className="mb-2 font-bold">🧾 رسیدهای در انتظار</p>
        <ReceiptsManager receipts={receipts.items} />
      </Card>
      <Card>
        <div className="mb-2 flex items-center justify-between">
          <p className="font-bold">📜 تاریخچه تراکنش‌ها</p>
          <a href="/api/export/transactions" className="text-sm text-blue-600">⬇️ خروجی CSV</a>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-zinc-500">
              <th className="p-2">مبلغ</th>
              <th className="p-2">نوع</th>
              <th className="p-2">وضعیت</th>
              <th className="p-2">تاریخ</th>
            </tr>
          </thead>
          <tbody>
            {txns.items.map((t) => (
              <tr key={t.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="p-2">{fa(t.amount)}</td>
                <td className="p-2">{t.type}</td>
                <td className="p-2">{t.status}</td>
                <td className="p-2">{jalali(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
