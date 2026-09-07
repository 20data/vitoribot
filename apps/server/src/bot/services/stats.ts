import { prisma } from '@vitoribot/db';

export interface DashboardStats {
  totalUsers: number;
  today: number;
  week: number;
  month: number;
  activeSubscriptions: number;
  totalBalance: string;
  sales30d: string;
  count30d: number;
  conversionRate: number;
}

/** Gather admin dashboard statistics. All business logic lives here, not in handlers. */
export async function getDashboardStats(now = new Date()): Promise<DashboardStats> {
  const dayAgo = new Date(now.getTime() - 24 * 3600 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const monthAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);

  const [totalUsers, today, week, month, activeSubscriptions] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: dayAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
    prisma.subscription.count({ where: { status: 'ACTIVE' } }),
  ]);

  const balanceAgg = await prisma.user.aggregate({ _sum: { balance: true } });
  const sales = await prisma.transaction.aggregate({
    _sum: { amount: true },
    _count: true,
    where: { status: 'CONFIRMED', type: 'PURCHASE', createdAt: { gte: monthAgo } },
  });
  const buyers = await prisma.transaction.groupBy({
    by: ['userId'],
    where: { status: 'CONFIRMED', type: 'PURCHASE' },
  });

  const conversionRate =
    totalUsers > 0 ? Math.round((buyers.length / totalUsers) * 100) : 0;

  return {
    totalUsers,
    today,
    week,
    month,
    activeSubscriptions,
    totalBalance: balanceAgg._sum.balance?.toString() ?? '0',
    sales30d: sales._sum.amount?.toString() ?? '0',
    count30d: sales._count,
    conversionRate,
  };
}
