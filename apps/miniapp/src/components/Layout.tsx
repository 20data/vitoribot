import { NavLink, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { haptic } from '../telegram';

// RTL visual order right-to-left: profile … home.
const TABS = [
  { to: '/profile', label: '👤 پروفایل' },
  { to: '/tickets', label: '🎫 تیکت' },
  { to: '/services', label: '📋 سرویس‌ها' },
  { to: '/buy', label: '🛒 خرید' },
  { to: '/', label: '🏠 خانه' },
];

export function Layout(): JSX.Element {
  return (
    <div className="mx-auto min-h-screen max-w-md pb-24">
      <main className="p-4">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 mx-auto flex max-w-md border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            onClick={() => haptic('light')}
            className={({ isActive }) =>
              `flex-1 py-3 text-center text-xs ${isActive ? 'font-bold text-blue-500' : 'text-zinc-500'}`
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Toaster position="bottom-center" toastOptions={{ style: { direction: 'rtl' } }} />
    </div>
  );
}
