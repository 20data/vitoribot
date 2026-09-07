import type { Bot } from 'grammy';
import { Queue, Worker, type Job } from 'bullmq';
import { QUEUE_NAMES, type BroadcastJob, type QueueName } from '@vitoribot/queue';
import type { BotContext } from '../bot/types.js';
import { getRedis } from '../lib/redis.js';
import { runExpiryNotifier } from './expiry-notifier.js';
import { runTrafficNotifier } from './traffic-notifier.js';
import { runPanelHealthCheck } from './panel-health.js';
import { runReceiptReminder } from './receipt-reminder.js';
import { runExpiryHandler } from './expiry-handler.js';
import { processBroadcast } from './broadcast-worker.js';

export interface JobHandles {
  close: () => Promise<void>;
}

interface Schedule {
  queue: QueueName;
  schedulerId: string;
  everyMs: number;
}

const SCHEDULES: Schedule[] = [
  { queue: QUEUE_NAMES.expiryNotifier, schedulerId: 'hourly', everyMs: 3600_000 },
  { queue: QUEUE_NAMES.trafficNotifier, schedulerId: 'every-2h', everyMs: 2 * 3600_000 },
  { queue: QUEUE_NAMES.panelHealth, schedulerId: 'every-3m', everyMs: 3 * 60_000 },
  { queue: QUEUE_NAMES.receiptReminder, schedulerId: 'every-30m', everyMs: 30 * 60_000 },
  { queue: QUEUE_NAMES.expiryHandler, schedulerId: 'hourly', everyMs: 3600_000 },
];

/** Start all BullMQ schedulers + workers. Call once at boot; close on shutdown. */
export async function startJobs(bot: Bot<BotContext>): Promise<JobHandles> {
  const connection = getRedis();
  const queues: Queue[] = [];

  for (const s of SCHEDULES) {
    const queue = new Queue(s.queue, { connection });
    await queue.upsertJobScheduler(s.schedulerId, { every: s.everyMs });
    queues.push(queue);
  }
  // Broadcast queue has no scheduler (jobs are enqueued on demand).
  const broadcastQueue = new Queue(QUEUE_NAMES.broadcast, { connection });
  queues.push(broadcastQueue);

  const workers: Worker[] = [
    new Worker(QUEUE_NAMES.expiryNotifier, () => runExpiryNotifier(bot), { connection }),
    new Worker(QUEUE_NAMES.trafficNotifier, () => runTrafficNotifier(bot), { connection }),
    new Worker(QUEUE_NAMES.panelHealth, () => runPanelHealthCheck(bot), { connection }),
    new Worker(QUEUE_NAMES.receiptReminder, () => runReceiptReminder(bot), { connection }),
    new Worker(QUEUE_NAMES.expiryHandler, () => runExpiryHandler(), { connection }),
    new Worker(
      QUEUE_NAMES.broadcast,
      (job: Job<BroadcastJob>) => processBroadcast(job.data, bot),
      {
        connection,
        concurrency: 1,
        // Respect Telegram flood limits: max 20 messages/second.
        limiter: { max: 20, duration: 1000 },
      },
    ),
  ];
  for (const w of workers) {
    w.on('failed', (job, err) => {
      // eslint-disable-next-line no-console
      console.warn(`Job ${job?.queueName}/${job?.id} failed:`, (err as Error).message);
    });
  }

  return {
    close: async () => {
      await Promise.all(workers.map((w) => w.close()));
      await Promise.all(queues.map((q) => q.close()));
    },
  };
}
