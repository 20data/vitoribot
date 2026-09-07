import { PrismaClient } from '@prisma/client';

// Seed script: BotMessage Persian defaults, Departments, default Settings.
// Run: npm run db:seed --workspace=@vitoribot/db
const prisma = new PrismaClient();

const BOT_MESSAGES: Array<{ key: string; content: string }> = [
  { key: 'welcome', content: '👋 خوش آمدید {{name}}!\n\nبه ویتی‌بات خوش آمدید. از منوی زیر انتخاب کنید.' },
  { key: 'terms', content: '📜 قوانین استفاده از سرویس:\n\n۱. مسئولیت استفاده از سرویس با شماست.\n۲. سوءاستفاده منجر به مسدود شدن حساب می‌شود.\n۳. مبالغ پرداخت‌شده طبق قوانین فروشگاه قابل بازگشت است.\n\nبرای ادامه، قوانین را بپذیرید.' },
  { key: 'main_menu', content: '🏠 منوی اصلی — یک گزینه را انتخاب کنید:' },
  { key: 'force_join', content: '📣 برای استفاده از ربات ابتدا در کانال‌های زیر عضو شوید، سپس دکمه «✅ عضو شدم» را بزنید.' },
  { key: 'force_join_not_joined', content: '❌ هنوز عضویت شما تایید نشد. لطفاً عضو شوید و دوباره تلاش کنید.' },
  { key: 'purchase_success', content: '🎉 سرویس شما فعال شد!\n\n🔗 لینک اشتراک: {{subLink}}\n📅 انقضا: {{expiry}}\n📊 ترافیک: {{traffic}} گیگابایت' },
  { key: 'receipt_received', content: '✅ رسید دریافت شد. پس از تایید ادمین، سرویس فعال می‌شود.' },
  { key: 'receipt_rejected', content: '❌ رسید شما رد شد.\n\nدلیل: {{reason}}' },
  { key: 'expiry_3d', content: '⏰ سرویس {{productName}} تا ۳ روز دیگر منقضی می‌شود.\n📊 باقی‌مانده: {{remaining}} گیگابایت\n\n[🔄 تمدید سرویس]' },
  { key: 'expiry_1d', content: '⏰ سرویس {{productName}} تا ۱ روز دیگر منقضی می‌شود.\n📊 باقی‌مانده: {{remaining}} گیگابایت\n\n[🔄 تمدید سرویس]' },
  { key: 'expiry_6h', content: '⏰ سرویس {{productName}} تا ۶ ساعت دیگر منقضی می‌شود.\n📊 باقی‌مانده: {{remaining}} گیگابایت\n\n[🔄 تمدید سرویس]' },
  { key: 'traffic_80', content: '⚠️ ۸۰٪ از ترافیک سرویس {{productName}} مصرف شده است.' },
  { key: 'traffic_95', content: '⚠️ ۹۵٪ از ترافیک سرویس {{productName}} مصرف شده است. لطفاً افزایش حجم دهید.' },
  { key: 'tutorial.menu', content: '📚 آموزش‌ها — پلتفرم خود را انتخاب کنید:' },
  { key: 'tutorial.windows', content: '🖥️ آموزش ویندوز:\n\n۱. برنامه v2rayN را نصب کنید.\n۲. لینک اشتراک را کپی و در برنامه وارد کنید.\n۳. اتصال را فعال کنید.' },
  { key: 'tutorial.android', content: '📱 آموزش اندروید:\n\n۱. برنامه v2rayNG را نصب کنید.\n۲. لینک اشتراک را وارد کنید.\n۳. اتصال را فعال کنید.' },
  { key: 'tutorial.ios', content: '🍎 آموزش آیفون:\n\n۱. برنامه Streisand یا Shadowrocket را نصب کنید.\n۲. لینک اشتراک را وارد کنید.\n۳. اتصال را فعال کنید.' },
  { key: 'tutorial.macos', content: '💻 آموزش مک:\n\n۱. برنامه Streisand را نصب کنید.\n۲. لینک اشتراک را وارد کنید.' },
  { key: 'tutorial.linux', content: '🐧 آموزش لینوکس:\n\n۱. کلاینت Nekoray را نصب کنید.\n۲. لینک اشتراک را وارد کنید.' },
  { key: 'faq.1', content: 'سوال: سرعت سرویس چقدر است؟\nپاسخ: سرعت به سرور انتخابی و اینترنت شما بستگی دارد.' },
  { key: 'faq.2', content: 'سوال: روی چند دستگاه می‌توانم استفاده کنم؟\nپاسخ: بسته به پلن، معمولاً ۲ دستگاه همزمان.' },
  { key: 'faq.3', content: 'سوال: اگر سرویس قطع شد چه کنم؟\nپاسخ: ابتدا لینک را به‌روزرسانی کنید، سپس تیکت ثبت کنید.' },
];

const DEFAULT_DEPARTMENTS = ['پشتیبانی فنی', 'امور مالی', 'سوالات عمومی'];

const DEFAULT_SETTINGS: Array<{ key: string; value: string }> = [
  { key: 'payment.card_number', value: '' },
  { key: 'payment.card_holder', value: '' },
  { key: 'payment.card_bank', value: '' },
  { key: 'bot.test_account_enabled', value: 'false' },
  { key: 'bot.test_traffic_gb', value: '1' },
  { key: 'bot.test_duration_days', value: '1' },
  { key: 'bot.maintenance_mode', value: 'false' },
  { key: 'store.min_charge_amount', value: '10000' },
  { key: 'store.max_charge_amount', value: '10000000' },
];

async function main(): Promise<void> {
  try {
    for (const m of BOT_MESSAGES) {
      await prisma.botMessage.upsert({
        where: { key: m.key },
        update: {},
        create: { key: m.key, content: m.content },
      });
    }
    for (const name of DEFAULT_DEPARTMENTS) {
      const existing = await prisma.department.findFirst({ where: { name } });
      if (!existing) {
        await prisma.department.create({ data: { name } });
      }
    }
    for (const s of DEFAULT_SETTINGS) {
      await prisma.setting.upsert({
        where: { key: s.key },
        update: {},
        create: { key: s.key, value: s.value },
      });
    }
    console.log('Seed completed successfully.');
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
