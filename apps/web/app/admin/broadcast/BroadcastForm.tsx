'use client';

import { useState } from 'react';
import { broadcastSendAction } from '../actions';

export function BroadcastForm(): JSX.Element {
  const [target, setTarget] = useState('ALL');
  const [message, setMessage] = useState('');
  const [done, setDone] = useState(false);
  const targets: Array<[string, string]> = [
    ['ALL', 'همه'],
    ['ACTIVE', 'دارای سرویس فعال'],
    ['INACTIVE', 'بدون سرویس فعال'],
  ];
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {targets.map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTarget(v)}
            className={`rounded px-3 py-1 text-sm ${target === v ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-zinc-200 dark:bg-zinc-700'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        placeholder="متن پیام گروهی..."
        className="w-full rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
      />
      <button
        disabled={!message}
        onClick={() => broadcastSendAction(target, message).then(() => { setMessage(''); setDone(true); })}
        className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
      >
        📢 ارسال (فقط سوپر ادمین)
      </button>
      {done && <p className="text-sm text-green-600">✅ در صف ارسال قرار گرفت.</p>}
    </div>
  );
}
