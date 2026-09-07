import { auth } from '@/auth';
import { apiJson } from '@/lib/api';
import { fa } from '@/lib/format';
import { Badge, Card, PageTitle } from '@/components/ui';
import { RevenueChart, UsersChart, GroupDonut, SubsChart } from './charts';
import { RecentTxns } from './RecentTxns';

export const dynamic = 'force-dynamic';

interface DashboardData {
  stats: {
    totalUsers: number;
    today: number;
    week: number;
    month: number;
    activeSubscriptions: number;
    totalBalance: string;
    sales30d: string;
    count30d: number;
    conversionRate: number;
  };
  series: {
    revenue: Array<{ date: string; value: number }>;
    newUsers: Array<{ date: string; value: number }>;
    subscriptions: Array<{ date: string; value: number }>;
    revenueByGroup: Array<{ group: string; total: number }>;
  };
}

export default async function DashboardPage(): Promise<JSX.Element> {
  const session = await auth();
  const data = await apiJson<DashboardData>('/api/admin/dashboard');
  const panels = await apiJson<Array<{ id: string; name: string; isOnline: boolean }>>('/api/admin/panels');
  const txns = await apiJson<{ items: Array<{ id: string; amount: string; type: string; status: string; createdAt: string }> }>(
    '/api/admin/transactions?page=1&pageSize=10',
  );
  const s = data.stats;

  const kpis = [
    { label: 'کل کاربران', value: fa(s.totalUsers) },
    { label: 'سرویس‌های فعال', value: fa(s.activeSubscriptions) },
    { label: 'درآمد این ماه', value: `${fa(s.sales30d)} تومان` },
    { label: 'نرخ تبدیل', value: `${fa(s.conversionRate)}٪` },
  ];

  return (
    <div>
      <PageTitle>داشبورد</PageTitle>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <p className="text-sm text-zinc-500">{k.label}</p>
            <p className="text-xl font-bold">{k.value}</p>
          </Card>
        ))}
      </div>
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <Card>
          <p className="mb-2 font-bold">درآمد روزانه</p>
          <RevenueChart data={data.series.revenue} />
        </Card>
        <Card>
          <p className="mb-2 font-bold">کاربران جدید</p>
          <UsersChart data={data.series.newUsers} />
        </Card>
        <Card>
          <p className="mb-2 font-bold">درآمد بر اساس گروه</p>
          <GroupDonut data={data.series.revenueByGroup} />
        </Card>
        <Card>
          <p className="mb-2 font-bold">روند اشتراک‌ها</p>
          <SubsChart data={data.series.subscriptions} />
        </Card>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <p className="mb-2 font-bold">آخرین تراکنش‌ها</p>
          <RecentTxns initial={txns.items} token={session?.accessToken ?? ''} />
        </Card>
        <Card>
          <p className="mb-2 font-bold">وضعیت پنل‌ها</p>
          <div className="space-y-2">
            {panels.map((p) => (
              <div key={p.id} className="flex items-center justify-between">
                <span>{p.name}</span>
                <Badge color={p.isOnline ? 'green' : 'red'}>{p.isOnline ? 'آنلاین' : 'آفلاین'}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
