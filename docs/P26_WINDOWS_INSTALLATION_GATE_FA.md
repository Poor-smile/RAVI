# P26 — گیت نصب و ارتقای Windows

تاریخ ممیزی: 2026-08-24

نسخهٔ نامزد انتشار: 2.0.0 (Windows x64، Electron)

## نتیجه

گیت ساخت Installer و قرارداد Upgrade/Uninstall برای نسخهٔ ۲ اجرا می‌شود. نصب تمیز، Upgrade و Uninstall تعاملی روی یک Windows VM تازه هنوز برای امضای انتشار عمومی لازم است؛ این سه عمل روی میزبان فعلی اجرا نمی‌شوند تا نصب فعال و داده‌های کاربر تغییر نکنند.

## شواهد پاس‌شده

- `appId` پایدار: `ir.raavi.markdown`
- نسخهٔ RC از 1.7.3 به 2.0.0 افزایش یافت تا تغییر مسیر انتشار Windows و قابلیت‌های اصلی محصول شمارهٔ مستقل داشته باشند.
- Installer assisted، x64 و per-machine ساخته شد.
- payload، blockmap، `app.asar` و PEهای Windows با گیت `verify:installer` بررسی شدند.
- NSIS فقط برای `.md` و `.markdown` association تولید می‌کند.
- فرمان Open هر association مسیر فایل را با `"%1"` به `Raavi.exe` می‌دهد.
- منطق Uninstaller و `APP_UNASSOCIATE` در خروجی packager حاضر است.
- مسیرهای single-instance، `second-instance` و `open-file` در Electron حاضرند.
- اجرای `MERMAID_ULTIMATE_STRESS_TEST_FA.md` با payload نسخهٔ ۲ باید پیش از انتشار نهایی پاس شود.
- نصب موجود 1.7.3 دارای Uninstaller و associationهای رسمی است؛ هیچ تغییری روی آن انجام نمی‌شود.

## یافتهٔ مهاجرتی

یک ورودی قدیمی 1.4.1 با مسیر `C:\Program Files\راوی` در Uninstall ویندوز باقی مانده است. این ورودی به نصب فعلی `C:\Program Files\Raavi` تعلق ندارد و حذف خودکار آن بدون آزمون مهاجرت روی VM انجام نشد.

## گیت باقی‌مانده برای انتشار عمومی

1. Snapshot یک Windows VM تمیز.
2. نصب 1.7.3 و ایجاد سند/تنظیم نمونه.
3. Upgrade با Installer 2.0.0 و بررسی حفظ سند و تنظیمات.
4. بازکردن `.md` و `.markdown` از Windows Explorer.
5. اجرای Uninstall و بررسی حذف shortcutها، ProgIDها و فایل‌های برنامه بدون حذف اسناد کاربر.
6. بازگردانی snapshot و تکرار نصب تمیز 2.0.0.
7. امضای Authenticode و بازآزمایی SmartScreen/Signature.

## فرمان‌های گیت

```powershell
npm run desktop:pack
npm run verify:installer
```
