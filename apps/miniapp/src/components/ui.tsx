import type { ReactNode } from 'react';

export function Card({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {children}
    </div>
  );
}

export function Button({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}): JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full rounded-xl bg-zinc-900 p-3 font-bold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
    >
      {children}
    </button>
  );
}

export function Skeleton(): JSX.Element {
  return (
    <div className="animate-pulse space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-20 rounded-2xl bg-zinc-200 dark:bg-zinc-800" />
      ))}
    </div>
  );
}

export function Sheet({ children, onClose }: { children: ReactNode; onClose: () => void }): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-4 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
