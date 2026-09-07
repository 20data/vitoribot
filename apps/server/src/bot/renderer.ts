import { prisma } from '@vitoribot/db';
import { DEFAULT_MESSAGES, escapeMarkdown, renderTemplate } from '@vitoribot/persian';
import type { TemplateVars } from '@vitoribot/persian';
import { cached, invalidate } from '../lib/redis.js';

const CACHE_TTL_SECONDS = 60;

/** Load a Persian message template (DB first, seed defaults as fallback). */
export async function loadTemplate(key: string): Promise<string> {
  const cachedValue = await cached<string | null>(
    `botmsg:${key}`,
    CACHE_TTL_SECONDS,
    async () => {
      try {
        const row = await prisma.botMessage.findUnique({ where: { key } });
        return row?.content ?? null;
      } catch {
        return null;
      }
    },
  );
  if (cachedValue) return cachedValue;
  return DEFAULT_MESSAGES[key] ?? key;
}

/** Render a template with {{var}} substitution. User values are NOT escaped here. */
export async function render(key: string, vars: TemplateVars = {}): Promise<string> {
  const template = await loadTemplate(key);
  return renderTemplate(template, vars);
}

/** Render with all user-supplied values escaped for MarkdownV2 safety. */
export async function renderSafe(key: string, vars: TemplateVars = {}): Promise<string> {
  const escaped: TemplateVars = {};
  for (const [k, v] of Object.entries(vars)) {
    escaped[k] = typeof v === 'string' ? escapeMarkdown(v) : v;
  }
  return render(key, escaped);
}

/** Invalidate the cached template after an admin edit. */
export async function invalidateTemplate(key: string): Promise<void> {
  await invalidate(`botmsg:${key}`);
}
