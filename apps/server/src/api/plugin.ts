import type { Bot } from 'grammy';
import type { FastifyInstance } from 'fastify';
import type { BotContext } from '../bot/types.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { shopRoutes } from './routes/shop.js';
import { adminDashboardRoutes } from './routes/adminDashboard.js';
import { adminUserRoutes } from './routes/adminUsers.js';
import { adminCatalogRoutes } from './routes/adminCatalog.js';
import { adminSubRoutes } from './routes/adminSubs.js';
import { adminFinanceRoutes } from './routes/adminFinance.js';
import { adminSupportRoutes } from './routes/adminSupport.js';
import { adminSystemRoutes } from './routes/adminSystem.js';

/** Register every REST route (web panel + mini app). */
export async function registerApi(app: FastifyInstance, bot: Bot<BotContext>): Promise<void> {
  await authRoutes(app, bot);
  await meRoutes(app);
  await shopRoutes(app, bot);
  await adminDashboardRoutes(app);
  await adminUserRoutes(app, bot);
  await adminSubRoutes(app, bot);
  await adminCatalogRoutes(app);
  await adminFinanceRoutes(app, bot);
  await adminSupportRoutes(app, bot);
  await adminSystemRoutes(app);
}
