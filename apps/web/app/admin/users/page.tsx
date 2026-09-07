import { apiJson } from '@/lib/api';
import { Card, PageTitle } from '@/components/ui';
import { UsersTable } from './UsersTable';

export const dynamic = 'force-dynamic';

export default async function UsersPage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string };
}): Promise<JSX.Element> {
  const page = searchParams.page ?? '1';
  const q = searchParams.search ? `&search=${encodeURIComponent(searchParams.search)}` : '';
  const data = await apiJson<{
    items: Array<{
      id: string;
      telegramId: string;
      username: string | null;
      firstName: string;
      balance: string;
      role: string;
      isBlocked: boolean;
      createdAt: string;
      _count: { subscriptions: number };
    }>;
    total: number;
  }>(`/api/admin/users?page=${page}&pageSize=20${q}`);

  return (
    <div>
      <PageTitle>کاربران</PageTitle>
      <form method="get" className="mb-3 flex gap-2">
        <input
          name="search"
          defaultValue={searchParams.search ?? ''}
          placeholder="جستجو: شناسه، یوزرنیم، نام..."
          className="flex-1 rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button className="rounded bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900">🔍</button>
      </form>
      <Card>
        <UsersTable users={data.items} />
      </Card>
    </div>
  );
}
