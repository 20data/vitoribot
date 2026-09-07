import { InlineKeyboard, Keyboard } from 'grammy';

// All labels Persian (RTL). Callback data English with prefixes.

// ─── Main menu (also mirrored as a grammy Menu in handlers/menu.ts) ──
export function mainMenuKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🛒 خرید سرویس جدید', 'menu:buy')
    .text('📋 سرویس‌های من', 'menu:my')
    .row()
    .text('📚 آموزش‌ها', 'menu:tutorials')
    .text('🎫 تیکت پشتیبانی', 'menu:tickets')
    .row()
    .text('👤 پروفایل و کیف پول', 'menu:profile');
}

export function termsKeyboard(): InlineKeyboard {
  return new InlineKeyboard().text('✅ قوانین را می‌پذیرم و ادامه می‌دهم', 'terms:accept');
}

export function forceJoinKeyboard(channels: Array<{ username: string; title: string }>): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const c of channels) {
    kb.url(`عضویت در ${c.title}`, `https://t.me/${c.username}`).row();
  }
  return kb.text('✅ عضو شدم (بررسی)', 'forcejoin:check');
}

export function backKeyboard(target: string): InlineKeyboard {
  return new InlineKeyboard().text('🔙 بازگشت', target);
}

export function groupsKeyboard(groups: string[]): InlineKeyboard {
  const kb = new InlineKeyboard();
  groups.forEach((g, i) => {
    kb.text(g, `buy:group:${i}`);
    if (i % 2 === 1) kb.row();
  });
  if (groups.length % 2 === 1) kb.row();
  return kb.text('🔙 بازگشت', 'menu:home');
}

export function productsKeyboard(products: Array<{ id: string; label: string }>): InlineKeyboard {
  const kb = new InlineKeyboard();
  products.forEach((p) => {
    kb.text(`📦 ${p.label}`, `buy:product:${p.id}`).row();
  });
  return kb.text('🔙 بازگشت', 'menu:buy');
}

export function discountAskKeyboard(productId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ بله، وارد می‌کنم', `buy:discount-yes:${productId}`)
    .text('❌ خیر، ادامه', `buy:discount-no:${productId}`);
}

export function payMethodKeyboard(productId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('💳 کارت به کارت', `buy:pay-card:${productId}`)
    .row()
    .text('🔙 بازگشت', 'menu:buy');
}

export function receiptReviewKeyboard(transactionId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ تایید', `receipt:approve:${transactionId}`)
    .text('❌ رد', `receipt:reject:${transactionId}`);
}

export function serviceKeyboard(subscriptionId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('🔗 لینک اتصال', `svc:link:${subscriptionId}`)
    .text('📷 کد QR', `svc:qr:${subscriptionId}`)
    .row()
    .text('🔄 تمدید', `svc:renew:${subscriptionId}`)
    .text('⬆️ افزایش حجم', `svc:topup:${subscriptionId}`)
    .row()
    .text('🔙 بازگشت', 'menu:my');
}

export function tutorialsKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('🖥️ ویندوز', 'tut:windows')
    .text('📱 اندروید', 'tut:android')
    .row()
    .text('🍎 آیفون', 'tut:ios')
    .text('💻 مک', 'tut:macos')
    .row()
    .text('🐧 لینوکس', 'tut:linux')
    .row()
    .text('🔙 بازگشت', 'menu:home');
}

export function ticketListKeyboard(
  tickets: Array<{ id: string; subject: string }>,
  hasMore: boolean,
): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const t of tickets) {
    kb.text(`🎫 ${t.subject}`, `ticket:view:${t.id}`).row();
  }
  kb.text('➕ تیکت جدید', 'ticket:new').text('❓ سوالات متداول', 'ticket:faq').row();
  if (hasMore) kb.text('⏩ بیشتر', 'ticket:more').row();
  return kb.text('🔙 بازگشت', 'menu:home');
}

export function ticketViewKeyboard(ticketId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('↩️ پاسخ', `ticket:reply:${ticketId}`)
    .row()
    .text('🔙 بازگشت', 'menu:tickets');
}

export function departmentsKeyboard(depts: Array<{ id: string; name: string }>): InlineKeyboard {
  const kb = new InlineKeyboard();
  for (const d of depts) {
    kb.text(d.name, `ticket:dept:${d.id}`).row();
  }
  return kb.text('🔙 بازگشت', 'menu:tickets');
}

export function profileKeyboard(): InlineKeyboard {
  return new InlineKeyboard()
    .text('💰 شارژ کیف پول', 'wallet:charge')
    .text('🎁 کد هدیه', 'wallet:gift')
    .row()
    .text('📜 تاریخچه تراکنش‌ها', 'wallet:history')
    .row()
    .text('🔙 بازگشت', 'menu:home');
}

export function userManageKeyboard(userId: string, blocked: boolean): InlineKeyboard {
  return new InlineKeyboard()
    .text('➕ افزایش موجودی', `admin:balance-add:${userId}`)
    .text('➖ کاهش موجودی', `admin:balance-sub:${userId}`)
    .row()
    .text(blocked ? '✅ رفع بلاک' : '🚫 بلاک کردن', `admin:block:${userId}`)
    .text('📩 ارسال پیام', `admin:msg:${userId}`)
    .row()
    .text('📋 سرویس‌ها', `admin:services:${userId}`)
    .text('📜 تراکنش‌ها', `admin:txns:${userId}`);
}

export function confirmKeyboard(action: string): InlineKeyboard {
  return new InlineKeyboard()
    .text('✅ تایید', `${action}:yes`)
    .text('❌ انصراف', `${action}:no`);
}

/** Persistent admin reply keyboard (admins only). */
export function adminReplyKeyboard(): Keyboard {
  return new Keyboard()
    .text('📊 داشبورد')
    .text('👥 کاربران')
    .row()
    .text('🧾 رسیدهای در انتظار')
    .text('📢 پیام گروهی')
    .row()
    .text('🏷️ محصولات')
    .text('⚙️ تنظیمات')
    .resized();
}

export function removeReplyKeyboard(): { remove_keyboard: true } {
  return { remove_keyboard: true };
}
