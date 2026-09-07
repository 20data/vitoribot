# ویتی‌بات — راهنمای نصب و اجرا

سیستم مدیریت و فروش VPN فارسی: ربات تلگرام + پنل وب ادمین + مینی‌اپ، متصل به پنل‌های 3x-ui.

## پیش‌نیازها

- Node.js نسخه ۲۰ به بالا و npm نسخه ۱۰ به بالا
- PostgreSQL نسخه ۱۵ و Redis نسخه ۷ (یا داکر)
- توکن ربات تلگرام (از [@BotFather](https://t.me/BotFather))

## نصب محلی (بدون داکر)

```bash
npm install
cp .env.example .env
# سپس .env را ویرایش کنید: DATABASE_URL ،REDIS_URL ،BOT_TOKEN ،ENCRYPTION_KEY
# (یک رشته hex شصت‌وچهار کاراکتری) ،JWT_PRIVATE_KEY و JWT_PUBLIC_KEY

npx prisma migrate dev --schema packages/db/prisma/schema.prisma
npm run db:seed --workspace=@vitoribot/db
npm run dev
```

## ساخت ادمین اول

۱. با اکانت تلگرام خود ربات را `/start` کنید.
۲. شناسه عددی تلگرام خود را در `.env` بگذارید:

```env
BOOTSTRAP_ADMIN_IDS="123456789"
```

۳. سرور را اجرا کنید — نقش شما خودکار `SUPER_ADMIN` می‌شود.

## اجرا با داکر (توسعه)

```bash
cp .env.example .env
docker compose up --build
```

- پنل وب: http://localhost:3000
- بک‌اند: http://localhost:3001
- مینی‌اپ: http://localhost:3002

## اجرا در سرور واقعی (پروداکشن)

۱. سه زیردامنه بسازید: `panel` ،`bot` ،`miniapp` روی دامنه خود.
۲. فایل `docker/nginx/sites/*.conf` را با دامنه واقعی جایگزین کنید.
۳. `.env` را کامل کنید (رمزها، توکن‌ها، `NEXTAUTH_SECRET`).
۴. اجرا:

```bash
docker compose -f docker-compose.prod.yml up --build -d
# صدور گواهی اول (به‌ازای هر دامنه):
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot -w /var/www/certbot -d panel.yourdomain.com
```

۵. در تلگرام وبهوک را ست کنید — سرور موقع بالا آمدن خودکار `setWebhook`
را با `BOT_WEBHOOK_URL` و `WEBHOOK_SECRET` انجام می‌دهد.
۶. دکمه منوی ربات را به آدرس مینی‌اپ وصل کنید (`MINIAPP_URL`).

## اسکریپت‌های مهم

| دستور | کار |
|---|---|
| `npm run dev` | اجرای همه اپ‌ها |
| `npm run typecheck` | بررسی تایپ |
| `npm run test` | تست‌ها |
| `npm run build` | بیلد همه |

## عیب‌یابی

- **پنل آفلاین شد:** ربات به سوپرادمین‌ها خبر می‌دهد؛ اتصال و رمز پنل را در تنظیمات بررسی کنید.
- **جاب‌ها کار نمی‌کنند:** بدون Redis سرور بالا می‌آید ولی جاب‌ها غیرفعال‌اند (لاگ را ببینید).
- **لاگین وب:** کد ورود ۵ دقیقه اعتبار دارد و از طریق ربات ارسال می‌شود.
