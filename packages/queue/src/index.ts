import { Queue, Worker, type JobsOptions, type Processor } from 'bullmq';
import type { Redis } from 'ioredis';

export const QUEUE_NAMES = {
  broadcast: 'broadcast',
  expiryNotifier: 'expiry-notifier',
  trafficNotifier: 'traffic-notifier',
  panelHealth: 'panel-health-check',
  receiptReminder: 'receipt-reminder',
  expiryHandler: 'expiry-handler',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface BroadcastJob {
  broadcastId: string;
  target: 'ALL' | 'ACTIVE' | 'INACTIVE';
  message: string;
  photoPath?: string;
}

export function createQueue(name: QueueName, connection: Redis): Queue {
  return new Queue(name, { connection });
}

export function createWorker<T>(
  name: QueueName,
  connection: Redis,
  processor: Processor<T>,
  opts?: { concurrency?: number },
): Worker<T> {
  return new Worker<T>(name, processor, {
    connection,
    concurrency: opts?.concurrency ?? 5,
  });
}

export const DEFAULT_JOB_OPTS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 5000 },
  removeOnComplete: 100,
  removeOnFail: 500,
};
