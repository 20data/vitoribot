import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { Button, Card, Sheet, Skeleton } from '../components/ui';
import { haptic, notifyHaptic } from '../telegram';

interface Ticket {
  id: string;
  subject: string;
  status: string;
  department: { name: string };
  messages: Array<{ senderRole: string; message: string }>;
}

interface Faq {
  key: string;
  content: string;
}

export function Tickets(): JSX.Element {
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [creating, setCreating] = useState(false);
  const [depts, setDepts] = useState<Array<{ id: string; name: string }>>([]);
  const [deptId, setDeptId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get('/api/my/tickets').then((r) => setTickets(r.data as Ticket[])).catch(() => toast.error('خطا'));
    api.get('/api/tutorials').then((r) => setFaqs((r.data as Faq[]).filter((f) => f.key.startsWith('faq.')))).catch(() => undefined);
    api.get('/api/departments').then((r) => {
      const list = r.data as Array<{ id: string; name: string }>;
      setDepts(list);
      if (list[0]) setDeptId(list[0].id);
    }).catch(() => undefined);
  }, []);

  async function create(): Promise<void> {
    if (!deptId || !subject.trim() || !message.trim()) {
      toast.error('همه فیلدها الزامی است.');
      return;
    }
    try {
      await api.post('/api/my/tickets', { departmentId: deptId, subject, message });
    } catch {
      notifyHaptic('error');
      toast.error('ثبت تیکت ناموفق بود.');
      return;
    }
    notifyHaptic('success');
    toast.success('تیکت ثبت شد ✅');
    setCreating(false);
    setSubject('');
    setMessage('');
    api.get('/api/my/tickets').then((r) => setTickets(r.data as Ticket[])).catch(() => undefined);
  }

  if (tickets === null) return <Skeleton />;

  return (
    <div className="space-y-3">
      {tickets.map((t) => (
        <Card key={t.id}>
          <button onClick={() => { setSelected(t); haptic(); }} className="w-full text-right">
            <p className="font-bold">{t.subject}</p>
            <p className="text-sm text-zinc-500">{t.department.name} — {t.status}</p>
          </button>
        </Card>
      ))}

      <Button onClick={() => { setCreating(true); haptic(); }}>➕ تیکت جدید</Button>

      <p className="pt-2 font-bold">❓ سوالات متداول</p>
      {faqs.map((f) => (
        <Card key={f.key}>
          <button onClick={() => { setOpenFaq(openFaq === f.key ? null : f.key); haptic(); }} className="w-full text-right text-sm font-bold">
            {f.content.split('\n')[0]}
          </button>
          {openFaq === f.key && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{f.content}</p>}
        </Card>
      ))}

      {selected && (
        <Sheet onClose={() => setSelected(null)}>
          <p className="mb-2 font-bold">{selected.subject}</p>
          <div className="space-y-2">
            {selected.messages.map((m, i) => (
              <p key={i} className={`rounded-lg p-2 text-sm ${m.senderRole === 'USER' ? 'bg-zinc-100 dark:bg-zinc-800' : 'bg-blue-50 dark:bg-blue-950'}`}>
                {m.message}
              </p>
            ))}
          </div>
        </Sheet>
      )}

      {creating && (
        <Sheet onClose={() => setCreating(false)}>
          <div className="space-y-3">
            <p className="font-bold">➕ تیکت جدید</p>
            <select value={deptId} onChange={(e) => setDeptId(e.target.value)} className="w-full rounded-xl border p-2 dark:bg-zinc-800">
              {depts.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="موضوع" className="w-full rounded-xl border p-2 dark:bg-zinc-800" />
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="متن پیام" rows={4} className="w-full rounded-xl border p-2 dark:bg-zinc-800" />
            <Button onClick={create}>ارسال</Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
