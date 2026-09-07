import { apiJson } from '@/lib/api';
import { fa, jalali } from '@/lib/format';
import { Badge, Card, PageTitle } from '@/components/ui';
import { SubActions } from './SubActions';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; color: 'green' | 'red' | 'yellow' }> = {
  ACTIVE: { label: 'فعال', color: 'green' },
  EXPIRED: { label: 'منقضی', color: 'yellow' },
  SUSPENDED: { label: 'معلق', color: 'red' },
};

export default async function SubsPage(): Promise<JSX.Element> {
  const data = await apiJson<{
    items: Array<{
      id: string;
      clientEmail: string;
      expiresAt: string | null;
      status: string;
      product: { name: string; trafficGB: number };
      user: { firstName: string; username: string | null };
    }>;
    total: number;
  }>('/api/admin/subscriptions?page=1&pageSize=20');

  return (
    <div>
      <PageTitle>اشتراک‌ها ({fa(data.total)})</PageTitle>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-right text-zinc-500">
              <th className="p-2">کاربر</th>
              <th className="p-2">محصول</th>
              <th className="p-2">انقضا</th>
              <th className="p-2">وضعیت</th>
              <th className="p-2">عملیات</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((s) => (
              <tr key={s.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="p-2">{s.user.firstName}</td>
                <td className="p-2">{s.product.name}</td>
                <td className="p-2">{s.expiresAt ? jalali(s.expiresAt) : 'بدون انقضا'}</td>
                <td className="p-2">
                  <Badge color={STATUS[s.status]?.color ?? 'yellow'}>{STATUS[s.status]?.label ?? s.status}</Badge>
                </td>
                <td className="p-2">
                  <SubActions id={s.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
