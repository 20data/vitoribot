import type { ReactNode } from 'react';
import { Sidebar } from '@/components/Sidebar';

export default function AdminLayout({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
