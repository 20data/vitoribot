import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api, useAuth } from '../api/client';
import { Button, Card, Sheet, Skeleton } from '../components/ui';
import { fa, jalali } from '../lib';
import { haptic, notifyHaptic, telegramUser } from '../telegram';

interface Txn {
  id: string;
  amount: string;
  type: string;
  status: string;
  createdAt: string;
}

export function Profile(): JSX.Element {
  const [txns, setTxns] = useState<Txn[] | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [balance, setBalance] = useState('0');
  const [gift, setGift] = useState('');
  const [charging, setCharging] = useState(false);
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<{ transactionId: string; amount: number; card: { number: string; holder: string; bank: string } } | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useAuth();
  const user = telegramUser();

  function loadTxns(p: number): void {
    api
      .get(`/api/my/transactions?page=${p}&pageSize=10`)
      .then((r) => {
        const items = (r.data as { items: Txn[] }).items;
        setTxns((prev) => (p === 1 ? items : [...(prev ?? []), ...items]));
        if (items.length < 10) setHasMore(false);
      })
      .catch(() => toast.error('خطا'));
  }

  useEffect(() => {
    api.get('/api/me').then((r) => setBalance((r.data as { balance: string }).balance)).catch(() => undefined);
    loadTxns(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function redeem(): Promise<void> {
    try {
      const res = await api.post('/api/gift/redeem', { code: gift });
      notifyHaptic('success');
      toast.success(`${fa((res.data as { amount: number }).amount)} تومان اضافه شد ✅`);
      setGift('');
    } catch {
      notifyHaptic('error');
      toast.error('کد هدیه معتبر نیست.');
    }
  }

  async function startCharge(): Promise<void> {
    try {
      const res = await api.post('/api/charge', { amount: Number(amount) });
      setQuote(res.data as { transactionId: string; amount: number; card: { number: string; holder: string; bank: string } });
      setDone(false);
    } catch {
      toast.error('مبلغ نامعتبر است.');
    }
  }

  async function upload(file: File): Promise<void> {
    if (!quote) return;
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post(`/api/purchase/${quote.transactionId}/receipt`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      notifyHaptic('success');
      setDone(true);
    } catch {
      notifyHaptic('error');
      toast.error('ارسال رسید ناموفق بود.');
    }
  }

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex items-center gap-3">
          {user.photoUrl ? (
            <img src={user.photoUrl} alt="" className="h-12 w-12 rounded-full" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-300 font-bold dark:bg-zinc-700">
              {user.firstName.slice(0, 1)}
            </div>
          )}
          <div>
            <p className="font-bold">{user.firstName}</p>
            <p className="text-sm text-zinc-500">موجودی: {fa(balance)} تومان</p>
          </div>
        </div>
      </Card>

      <Card>
        <p className="mb-2 font-bold">💰 شارژ کیف پول</p>
        <div className="flex gap-2">
          <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="مبلغ (تومان)" inputMode="numeric" className="flex-1 rounded-xl border p-2 dark:bg-zinc-800" />
          <button onClick={() => { setCharging(true); haptic(); }} className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-bold text-white">ادامه</button>
        </div>
      </Card>

      <Card>
        <p className="mb-2 font-bold">🎁 کد هدیه</p>
        <div className="flex gap-2">
          <input value={gift} onChange={(e) => setGift(e.target.value)} placeholder="کد هدیه" className="flex-1 rounded-xl border p-2 dark:bg-zinc-800" />
          <button onClick={redeem} className="rounded-xl bg-green-600 px-4 py-2 text-sm font-bold text-white">ثبت</button>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <p className="font-bold">تم: {theme === 'dark' ? '☀️ روشن' : theme === 'light' ? '🌙 تیره' : '📱 خودکار'}</p>
          <button
            onClick={() => { setTheme(theme === 'dark' ? 'light' : theme === 'light' ? 'auto' : 'dark'); haptic(); }}
            className="rounded-xl bg-zinc-200 px-3 py-1 text-sm dark:bg-zinc-700"
          >
            تغییر
          </button>
        </div>
      </Card>

      <p className="font-bold">📜 تراکنش‌ها</p>
      {txns === null ? (
        <Skeleton />
      ) : (
        txns.map((t) => (
          <Card key={t.id}>
            <div className="flex justify-between text-sm">
              <span>{fa(t.amount)} تومان — {t.type}</span>
              <span className="text-zinc-500">{jalali(t.createdAt)}</span>
            </div>
          </Card>
        ))
      )}
      {hasMore && txns !== null && (
        <Button onClick={() => { const p = page + 1; setPage(p); loadTxns(p); }}>موارد بیشتر</Button>
      )}

      {charging && (
        <Sheet onClose={() => { setCharging(false); setQuote(null); }}>
          {!quote ? (
            <div className="space-y-3">
              <p className="font-bold">مبلغ: {fa(amount)} تومان</p>
              <Button onClick={startCharge}>ادامه</Button>
            </div>
          ) : !done ? (
            <div className="space-y-3">
              <p className="text-sm">💳 به کارت زیر واریز کنید:</p>
              <p className="rounded bg-zinc-100 p-2 text-center font-mono dark:bg-zinc-800" dir="ltr">{quote.card.number}</p>
              <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); }} />
              <Button onClick={() => fileRef.current?.click()}>📷 ارسال رسید</Button>
            </div>
          ) : (
            <p className="py-4 text-center font-bold">✅ رسید دریافت شد.</p>
          )}
        </Sheet>
      )}
    </div>
  );
}
