import { apiJson } from '@/lib/api';
import { fa, jalali } from '@/lib/format';
import { Card, PageTitle } from '@/components/ui';
import { BroadcastForm } from './BroadcastForm';

export const dynamic = 'force-dynamic';

export default async function BroadcastPage(): Promise<JSX.Element> {
  const history = await apiJson<
    Array<{ id: string; target: string; message: string; totalCount: number; sentCount: number; failedCount: number; status: string; createdAt: string }>
  >('/api/admin/broadcast');

  return (
    <div className="space-y-4">
      <PageTitle>پیام گروهی</PageTitle>
      <Card>
        <BroadcastForm />
      </Card>
      <Card>
        <p className="mb-2 font-bold">تاریخچه</p>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-zinc-500">
              <th className="p-2">مخاطب</th>
              <th className="p-2">پیام</th>
              <th className="p-2">ارسال/کل</th>
              <th className="p-2">وضعیت</th>
              <th className="p-2">تاریخ</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="p-2">{h.target}</td>
                <td className="p-2">{h.message.slice(0, 60)}</td>
                <td className="p-2">{fa(h.sentCount)}/{fa(h.totalCount)}</td>
                <td className="p-2">{h.status}</td>
                <td className="p-2">{jalali(h.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
