import { apiJson } from '@/lib/api';
import { jalali } from '@/lib/format';
import { Badge, Card, PageTitle } from '@/components/ui';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; color: 'green' | 'red' | 'yellow' }> = {
  OPEN: { label: 'باز', color: 'red' },
  ANSWERED: { label: 'پاسخ داده شده', color: 'yellow' },
  CLOSED: { label: 'بسته', color: 'green' },
};

export default async function TicketsPage(): Promise<JSX.Element> {
  const data = await apiJson<{
    items: Array<{
      id: string;
      subject: string;
      status: string;
      createdAt: string;
      department: { name: string };
      user: { firstName: string };
    }>;
  }>('/api/admin/tickets?page=1&pageSize=20');

  return (
    <div>
      <PageTitle>تیکت‌ها</PageTitle>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-zinc-500">
              <th className="p-2">موضوع</th>
              <th className="p-2">دپارتمان</th>
              <th className="p-2">کاربر</th>
              <th className="p-2">وضعیت</th>
              <th className="p-2">تاریخ</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((t) => (
              <tr key={t.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="p-2">
                  <a href={`/admin/tickets/${t.id}`} className="text-blue-600">{t.subject}</a>
                </td>
                <td className="p-2">{t.department.name}</td>
                <td className="p-2">{t.user.firstName}</td>
                <td className="p-2">
                  <Badge color={STATUS[t.status]?.color ?? 'yellow'}>{STATUS[t.status]?.label ?? t.status}</Badge>
                </td>
                <td className="p-2">{jalali(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
