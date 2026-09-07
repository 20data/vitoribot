import { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { Button, Card, Sheet, Skeleton } from '../components/ui';
import { fa, jalali, type Service } from '../lib';
import { haptic } from '../telegram';

function Progress({ used, total }: { used: number | null; total: number }): JSX.Element {
  const pct = used === null ? 0 : Math.min(100, Math.round((used / total) * 100));
  const r = 26;
  const circ = 2 * Math.PI * r;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} strokeWidth="8" className="stroke-zinc-200 dark:stroke-zinc-700" fill="none" />
      <circle
        cx="32" cy="32" r={r} strokeWidth="8" fill="none"
        strokeLinecap="round" className="stroke-blue-500"
        strokeDasharray={circ} strokeDashoffset={circ - (circ * pct) / 100}
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="36" textAnchor="middle" fontSize="12" className="fill-current">{fa(pct)}٪</text>
    </svg>
  );
}

export function Services(): JSX.Element {
  const [services, setServices] = useState<Service[] | null>(null);
  const [selected, setSelected] = useState<Service | null>(null);
  const [qr, setQr] = useState('');

  const load = useCallback(() => {
    api
      .get('/api/my/subscriptions')
      .then((r) => setServices(r.data as Service[]))
      .catch(() => toast.error('خطا در بارگذاری'));
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (selected) {
      QRCode.toDataURL(selected.subLink, { width: 300 })
        .then(setQr)
        .catch(() => setQr(''));
    } else {
      setQr('');
    }
  }, [selected]);

  if (services === null) return <Skeleton />;
  if (services.length === 0) return <p className="py-8 text-center text-zinc-500">سرویس فعالی ندارید.</p>;

  return (
    <div className="space-y-3">
      <button onClick={() => { load(); haptic(); }} className="text-sm text-blue-500">↻ به‌روزرسانی</button>
      {services.map((s) => (
        <Card key={s.id}>
          <div className="flex items-center gap-3">
            <Progress used={s.usedGB} total={s.totalGB} />
            <div className="flex-1">
              <p className="font-bold">{s.productName}</p>
              <p className="text-sm text-zinc-500">انقضا: {s.expiresAt ? jalali(s.expiresAt) : 'بدون انقضا'}</p>
            </div>
            <button onClick={() => { setSelected(s); haptic(); }} className="text-sm text-blue-500">جزئیات ←</button>
          </div>
        </Card>
      ))}

      {selected && (
        <Sheet onClose={() => setSelected(null)}>
          <div className="space-y-3">
            <p className="font-bold">{selected.productName}</p>
            <button
              onClick={() => { void navigator.clipboard?.writeText(selected.subLink); toast.success('کپی شد ✅'); haptic(); }}
              className="w-full break-all rounded bg-zinc-100 p-2 text-left text-xs dark:bg-zinc-800"
              dir="ltr"
            >
              {selected.subLink}
            </button>
            {qr && <img src={qr} alt="QR" className="mx-auto h-48 w-48 rounded bg-white p-2" />}
            <Button onClick={() => toast('برای تمدید از بخش خرید اقدام کنید.')}>🔄 تمدید</Button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
