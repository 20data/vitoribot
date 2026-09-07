import type { FastifyInstance } from 'fastify';
import { jwtAuth, requireRole } from '../middleware/auth.js';
import { dashboardStats, getDashboardSeries } from '../services/dashboard.js';

/** Admin dashboard: KPI stats + chart series. */
export async function adminDashboardRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/admin/dashboard',
    { preHandler: [jwtAuth, requireRole('ADMIN')] },
    async () => {
      const [stats, series] = await Promise.all([dashboardStats(), getDashboardSeries(30)]);
      return { stats, series };
    },
  );
}
