import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { Button, Card, Sheet, Skeleton } from '../components/ui';
import { fa, type Product } from '../lib';
import { haptic, notifyHaptic } from '../telegram';

interface Quote {
  transactionId: string;
  amount: number;
  card: { number: string; holder: string; bank: string };
}

export function Buy(): JSX.Element {
  const [products, setProducts] = useState<Product[]>([]);
  const [group, setGroup] = useState<string>('همه');
  const [selected, setSelected] = useState<Product | null>(null);
  const [discount, setDiscount] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [done, setDone] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .get('/api/products')
      .then((r) => setProducts(r.data as Product[]))
      .catch(() => toast.error('خطا در بارگذاری محصولات'));
  }, []);

  if (products.length === 0) return <Skeleton />;
  const groups = ['همه', ...new Set(products.map((p) => p.groupName))];
  const list = group === 'همه' ? products : products.filter((p) => p.groupName === group);

  async function startPurchase(): Promise<void> {
    if (!selected) return;
    haptic('medium');
    try {
      const res = await api.post('/api/purchase', {
        productId: selected.id,
        discountCode: discount || undefined,
      });
      setQuote(res.data as Quote);
    } catch {
      notifyHaptic('error');
      toast.error('ثبت سفارش ناموفق بود.');
    }
  }

  async function uploadReceipt(file: File): Promise<void> {
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
      <div className="flex gap-2 overflow-x-auto pb-1">
        {groups.map((g) => (
          <button
            key={g}
            onClick={() => { setGroup(g); haptic(); }}
            className={`shrink-0 rounded-full px-4 py-1 text-sm ${group === g ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-200 dark:bg-zinc-800'}`}
          >
            {g}
          </button>
        ))}
      </div>

      {list.map((p) => (
        <Card key={p.id}>
          <p className="font-bold">{p.name}</p>
          <p className="text-sm text-zinc-500">
            {fa(p.trafficGB)} گیگ • {fa(p.durationDays)} روزه • {p.server}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className="font-bold">{fa(p.price)} تومان</span>
            <button
              onClick={() => { setSelected(p); setQuote(null); setDone(false); haptic(); }}
              className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-bold text-white"
            >
              خرید
            </button>
          </div>
        </Card>
      ))}

      {selected && (
        <Sheet onClose={() => setSelected(null)}>
          {!quote ? (
            <div className="space-y-3">
              <p className="font-bold">{selected.name}</p>
              <p className="text-sm">{fa(selected.price)} تومان</p>
              <input
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                placeholder="کد تخفیف (اختیاری)"
                className="w-full rounded-xl border p-2 dark:bg-zinc-800"
              />
              <Button onClick={startPurchase}>ادامه</Button>
            </div>
          ) : !done ? (
            <div className="space-y-3">
              <p className="text-sm">💳 مبلغ {fa(quote.amount)} تومان به کارت زیر واریز کنید:</p>
              <p className="rounded bg-zinc-100 p-2 text-center font-mono dark:bg-zinc-800" dir="ltr">{quote.card.number}</p>
              <p className="text-sm text-zinc-500">{quote.card.holder} — {quote.card.bank}</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadReceipt(f); }}
              />
              <Button onClick={() => fileRef.current?.click()}>📷 ارسال رسید پرداخت</Button>
            </div>
          ) : (
            <p className="py-4 text-center font-bold">✅ رسید دریافت شد، در انتظار تایید ادمین...</p>
          )}
        </Sheet>
      )}
    </div>
  );
}
