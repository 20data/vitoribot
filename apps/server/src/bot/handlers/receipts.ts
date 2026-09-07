import type { Bot } from 'grammy';
import { InputFile } from 'grammy';
import QRCode from 'qrcode';
import { prisma } from '@vitoribot/db';
import { formatToman, toJalali } from '@vitoribot/persian';
import type { BotContext } from '../types.js';
import { adminOnly } from '../middleware/admin.js';
import { approveReceipt } from '../services/receipts.js';
import { render } from '../renderer.js';

/** Admin approve/reject receipt callbacks (also used by auto-notifications). */
export function registerReceipts(bot: Bot<BotContext>): void {
  bot.callbackQuery(/^receipt:approve:(.+)$/, adminOnly(), async (ctx) => {
    const txId = ctx.match?.[1];
    if (!txId) return;
    await ctx.answerCallbackQuery('⏳ در حال پردازش...');
    const adminId = ctx.session.dbUserId;
    if (!adminId) return;
    try {
      const result = await approveReceipt(txId, adminId, async (panelId, err) => {
        await ctx.reply(`⚠️ اتصال به پنل ناموفق بود (پنل آفلاین شد): ${panelId}`);
        void err;
      });
      try {
        await ctx.editMessageCaption({ caption: '✅ رسید تایید شد.' });
      } catch {
        // ignore edit failures
      }
      const tx = await prisma.transaction.findUnique({
        where: { id: txId },
        include: { user: true },
      });
      if (tx) {
        const userMsg = result.subLink
          ? await render('purchase_success', {
              subLink: result.subLink,
              expiry: result.expiresAt ? toJalali(result.expiresAt) : 'بدون انقضا',
              traffic: '—',
            })
          : `✅ کیف پول شما به مبلغ ${formatToman(tx.amount.toString())} تومان شارژ شد.`;
        try {
          await ctx.api.sendMessage(Number(tx.user.telegramId), userMsg);
          if (result.subLink) {
            const buf = await QRCode.toBuffer(result.subLink, { width: 400 });
            await ctx.api.sendPhoto(Number(tx.user.telegramId), new InputFile(buf, 'qr.png'), {
              caption: '📷 کد QR اتصال',
            });
          }
        } catch {
          // ignore delivery failures
        }
      }
    } catch (err) {
      await ctx.reply(`❌ خطا: ${(err as Error).message}`);
    }
  });

  bot.callbackQuery(/^receipt:reject:(.+)$/, adminOnly(), async (ctx) => {
    const txId = ctx.match?.[1];
    if (!txId) return;
    await ctx.answerCallbackQuery();
    ctx.session.adminRejectTxId = txId;
    await ctx.conversation.enter('reject-reason');
  });
}
