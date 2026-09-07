import { apiJson } from '@/lib/api';
import { jalaliTime } from '@/lib/format';
import { Card, PageTitle } from '@/components/ui';
import { TicketReply } from './TicketReply';

export const dynamic = 'force-dynamic';

export default async function TicketPage({ params }: { params: { id: string } }): Promise<JSX.Element> {
  const ticket = await apiJson<{
    id: string;
    subject: string;
    status: string;
    department: { name: string };
    user: { firstName: string };
    messages: Array<{ id: string; senderRole: string; message: string; createdAt: string }>;
  }>(`/api/admin/tickets/${params.id}`);

  return (
    <div>
      <PageTitle>{ticket.subject}</PageTitle>
      <Card>
        <p className="mb-3 text-sm text-zinc-500">📂 {ticket.department.name} — 👤 {ticket.user.firstName} — {ticket.status}</p>
        <div className="space-y-2">
          {ticket.messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg p-3 text-sm ${m.senderRole === 'USER' ? 'bg-zinc-100 dark:bg-zinc-800' : 'bg-blue-50 dark:bg-blue-950'}`}
            >
              <p className="mb-1 text-xs text-zinc-500">{m.senderRole === 'USER' ? '👤 کاربر' : '🛠️ پشتیبانی'} — {jalaliTime(m.createdAt)}</p>
              <p>{m.message}</p>
            </div>
          ))}
        </div>
        <TicketReply id={ticket.id} closed={ticket.status === 'CLOSED'} />
      </Card>
    </div>
  );
}
