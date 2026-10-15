# Academy
طراحی دوم آکادمی پایه

## ارسال گزارش روزانهٔ مطالعه

گزارش‌ها پس از زدن «اتمام» در صف می‌مانند. برای ارسال خودکار به مشاور در ساعت ۰۰:۰۰ به وقت تهران، زمان‌بند میزبان باید هر شب فرمان زیر را اجرا کند:

```cron
CRON_TZ=Asia/Tehran
0 0 * * * cd /path/to/Academy/backend && /path/to/Academy/backend/venv/bin/python manage.py send_daily_study_reports
```

مسیرها را با مسیر نصب پروژه جایگزین کنید. پیش از اجرا، مهاجرت‌های Django را با `python manage.py migrate` اعمال کنید. فرمان ارسال تکرارپذیر است و گزارش هر تایمر را فقط یک بار ثبت می‌کند.
