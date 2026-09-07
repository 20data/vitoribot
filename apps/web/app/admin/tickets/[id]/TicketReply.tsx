'use client';

import { useState } from 'react';
import { ticketReplyAction, ticketStatusAction } from '../../actions';

export function TicketReply({ id, closed }: { id: string; closed: boolean }): JSX.Element {
  const [message, setMessage] = useState('');
  return (
    <div className="mt-4 space-y-2">
      <div className="flex gap-2">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="پاسخ..."
          disabled={closed}
          className="flex-1 rounded border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button
          disabled={closed || !message}
          onClick={() => ticketReplyAction(id, message).then(() => setMessage(''))}
          className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          ارسال پاسخ
        </button>
      </div>
      <button
        onClick={() => ticketStatusAction(id, closed)}
        className="rounded bg-zinc-200 px-3 py-1 text-sm dark:bg-zinc-700"
      >
        {closed ? 'بازگشایی تیکت' : 'بستن تیکت'}
      </button>
    </div>
  );
}
