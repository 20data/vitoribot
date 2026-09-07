import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof paginationSchema>;

export const roleSchema = z.enum(['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'USER']);
export type Role = z.infer<typeof roleSchema>;

export const createPanelSchema = z
  .object({
    name: z.string().min(1).max(100),
    url: z.string().url(),
    username: z.string().min(1).max(100),
    password: z.string().min(1).max(200),
    remarkPrefix: z.string().max(32).default(''),
  })
  .strict();
export type CreatePanelInput = z.infer<typeof createPanelSchema>;

export const updatePanelSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    url: z.string().url().optional(),
    username: z.string().min(1).max(100).optional(),
    password: z.string().min(1).max(200).optional(),
    remarkPrefix: z.string().max(32).optional(),
    isActive: z.boolean().optional(),
  })
  .strict();
export type UpdatePanelInput = z.infer<typeof updatePanelSchema>;

export const createProductSchema = z
  .object({
    panelId: z.string().uuid(),
    groupName: z.string().min(1).max(100),
    name: z.string().min(1).max(150),
    inboundId: z.number().int().positive(),
    trafficGB: z.number().int().positive(),
    durationDays: z.number().int().positive(),
    price: z.number().nonnegative(),
    sortOrder: z.number().int().default(0),
  })
  .strict();
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const purchaseSchema = z
  .object({
    productId: z.string().uuid(),
    discountCode: z.string().max(32).optional(),
  })
  .strict();
export type PurchaseInput = z.infer<typeof purchaseSchema>;

export const reviewReceiptSchema = z
  .object({
    transactionId: z.string().uuid(),
    approve: z.boolean(),
    reason: z.string().max(500).optional(),
  })
  .strict();
export type ReviewReceiptInput = z.infer<typeof reviewReceiptSchema>;

export const createTicketSchema = z
  .object({
    departmentId: z.string().uuid(),
    subject: z.string().min(1).max(200),
    message: z.string().min(1).max(4000),
  })
  .strict();
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const replyTicketSchema = z
  .object({
    message: z.string().min(1).max(4000),
  })
  .strict();
export type ReplyTicketInput = z.infer<typeof replyTicketSchema>;

export const createDiscountSchema = z
  .object({
    code: z.string().regex(/^[A-Z0-9]{4,32}$/),
    type: z.enum(['PERCENT', 'FIXED_AMOUNT']),
    value: z.number().positive(),
    maxUses: z.number().int().positive().nullable().optional(),
    validFrom: z.string().datetime().nullable().optional(),
    validTo: z.string().datetime().nullable().optional(),
    applicableTo: z.enum(['ALL', 'NEW_PURCHASE', 'RENEWAL', 'FIRST_PURCHASE']),
  })
  .strict();
export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;

export const createGiftSchema = z
  .object({
    code: z.string().regex(/^[A-Z0-9]{4,32}$/),
    amount: z.number().positive(),
    maxUses: z.number().int().positive().nullable().optional(),
  })
  .strict();
export type CreateGiftInput = z.infer<typeof createGiftSchema>;

export const redeemGiftSchema = z
  .object({
    code: z.string().min(1).max(32),
  })
  .strict();
export type RedeemGiftInput = z.infer<typeof redeemGiftSchema>;

export const broadcastSchema = z
  .object({
    target: z.enum(['ALL', 'ACTIVE', 'INACTIVE']),
    message: z.string().min(1).max(4000),
  })
  .strict();
export type BroadcastInput = z.infer<typeof broadcastSchema>;

export const miniappAuthSchema = z
  .object({
    initData: z.string().min(1),
  })
  .strict();
export type MiniappAuthInput = z.infer<typeof miniappAuthSchema>;

export const updateUserSchema = z
  .object({
    balance: z.number().optional(),
    balanceReason: z.string().max(500).optional(),
    role: roleSchema.optional(),
    isBlocked: z.boolean().optional(),
  })
  .strict();
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  ENCRYPTION_KEY: z.string().length(64),
  JWT_PRIVATE_KEY: z.string().min(1),
  JWT_PUBLIC_KEY: z.string().min(1),
  BOT_TOKEN: z.string().min(1),
  WEBHOOK_SECRET: z.string().min(16),
  BOT_WEBHOOK_URL: z.string().url(),
  MINIAPP_URL: z.string().url(),
  STORAGE_TYPE: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().default('/app/uploads'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.string().default('info'),
  API_PORT: z.coerce.number().default(3001),
  WEB_PORT: z.coerce.number().default(3000),
});
export type Env = z.infer<typeof envSchema>;
