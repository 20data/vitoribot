'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useUiStore } from '@/lib/store';

const LINKS = [
  { href: '/admin/dashboard', label: '📊 داشبورد' },
  { href: '/admin/users', label: '👥 کاربران' },
  { href: '/admin/subscriptions', label: '📦 اشتراک‌ها' },
  { href: '/admin/products', label: '🏷️ محصولات' },
  { href: '/admin/panels', label: '🖥️ پنل‌ها' },
  { href: '/admin/finance', label: '💰 مالی' },
  { href: '/admin/tickets', label: '🎫 تیکت‌ها' },
  { href: '/admin/discounts', label: '🎁 تخفیف‌ها' },
  { href: '/admin/broadcast', label: '📢 پیام گروهی' },
  { href: '/admin/settings', label: '⚙️ تنظیمات' },
];

export function Sidebar(): JSX.Element {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useUiStore();
  return (
    <aside className={`${sidebarOpen ? 'w-56' : 'w-14'} shrink-0 border-l border-zinc-200 bg-white transition-all dark:border-zinc-800 dark:bg-zinc-900`}>
      <div className="flex items-center justify-between p-3">
        {sidebarOpen && <span className="font-bold">ویتی‌بات</span>}
        <button onClick={toggleSidebar} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="toggle">
          {sidebarOpen ? '◀' : '▶'}
        </button>
      </div>
      <nav className="space-y-1 p-2">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`block truncate rounded px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
              pathname === l.href ? 'bg-zinc-100 font-bold dark:bg-zinc-800' : ''
            }`}
          >
            {sidebarOpen ? l.label : l.label.slice(0, 2)}
          </Link>
        ))}
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="block w-full rounded px-3 py-2 text-start text-sm text-red-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          {sidebarOpen ? '🚪 خروج' : '🚪'}
        </button>
      </nav>
    </aside>
  );
}
