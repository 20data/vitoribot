'use client';

import { useQuery } from '@tanstack/react-query';

interface Txn {
  id: string;
  amount: string;
  type: string;
  status: string;
  createdAt: string;
  user?: { firstName: string; username: string | null };
}

/** Live transaction table with 30s refetch (uses the admin list endpoint). */
export function RecentTxns({ initial, token }: { initial: Txn[]; token: string }): JSX.Element {
  const { data } = useQuery({
    queryKey: ['recent-txns'],
    queryFn: async (): Promise<Txn[]> => {
      const res = await fetch(
        `${process.env['NEXT_PUBLIC_BACKEND_URL'] ?? 'http://localhost:3001'}/api/admin/transactions?page=1&pageSize=10`,
        { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
      );
      if (!res.ok) throw new Error('fetch failed');
      const body = (await res.json()) as { items: Txn[] };
      return body.items;
    },
    initialData: initial,
    refetchInterval: 30_000,
  });
  return (
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
        {(data ?? []).map((t) => (
          <tr key={t.id} className="border-t border-zinc-100 dark:border-zinc-800">
            <td className="p-2">{Number(t.amount).toLocaleString('fa-IR')}</td>
            <td className="p-2">{t.type}</td>
            <td className="p-2">{t.status}</td>
            <td className="p-2">{t.createdAt.slice(0, 10)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
