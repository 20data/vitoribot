import { api } from '@/lib/api';

/** Proxy CSV export through the web server (keeps the backend token server-side). */
export async function GET(): Promise<Response> {
  const upstream = await api('/api/admin/transactions?page=1&pageSize=100&format=csv');
  const text = await upstream.text();
  return new Response(text, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="transactions.csv"',
    },
  });
}
