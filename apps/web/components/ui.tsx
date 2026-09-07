import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }): JSX.Element {
  return (
    <div className={`rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      {children}
    </div>
  );
}

export function Badge({ children, color = 'zinc' }: { children: ReactNode; color?: 'green' | 'red' | 'yellow' | 'zinc' | 'blue' }): JSX.Element {
  const colors: Record<string, string> = {
    green: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    red: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    zinc: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200',
  };
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${colors[color]}`}>{children}</span>;
}

export function PageTitle({ children }: { children: ReactNode }): JSX.Element {
  return <h1 className="mb-4 text-2xl font-bold">{children}</h1>;
}
