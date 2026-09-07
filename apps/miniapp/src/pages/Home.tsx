import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api/client';
import { Card, Skeleton } from '../components/ui';
import { fa } from '../lib';
import { haptic, telegramUser } from '../telegram';

interface Me {
  balance: string;
  activeCount: number;
  firstName: string;
}

export function Home(): JSX.Element {
  const [me, setMe] = useState<Me | null>(null);
  const user = telegramUser();

  useEffect(() => {
    api
      .get('/api/me')
      .then((r) => setMe(r.data as Me))
      .catch(() => toast.error('خطا در بارگذاری'));
  }, []);

  if (!me) return <Skeleton />;

  return (
    <div className="space-y-3">
      <Card>
        <p className="text-lg font-bold">خوش آمدید، {user.firstName} 👋</p>
      </Card>
      <Card>
        <p className="text-sm text-zinc-500">موجودی: {fa(me.balance)} تومان</p>
        <Link to="/profile" onClick={() => haptic()} className="text-sm text-blue-500">شارژ کیف پول ←</Link>
      </Card>
      <Card>
        <p className="text-sm">{fa(me.activeCount)} سرویس فعال</p>
        <Link to="/services" onClick={() => haptic()} className="text-sm text-blue-500">مشاهده ←</Link>
      </Card>
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            ['/buy', '🛒 خرید سرویس'],
            ['/services', '📋 سرویس‌هایم'],
            ['/tickets', '🎫 پشتیبانی'],
            ['/profile', '👤 پروفایل'],
          ] as Array<[string, string]>
        ).map(([to, label]) => (
          <Link key={to} to={to} onClick={() => haptic()}>
            <Card>
              <p className="text-center text-sm font-bold">{label}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
