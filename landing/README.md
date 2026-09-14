# لندینگ راوی 2.4.7

این پوشه صفحهٔ ایستای معرفی و دانلود راوی است. بسته‌های حجیم Windows و DMG مک روی
هاست دانلود مستقل و ZIPهای مک در GitHub Release نگهداری می‌شوند؛ داخل بستهٔ سایت
یا هاست اصلی نصب‌کننده قرار نمی‌گیرد.

## فایل‌های دانلود

- [Windows x64 — 122.4 MB](https://dl2.gptt.ir/raavi/stable/2.4.7/Raavi-Setup-2.4.7-x64.exe)
  SHA-256: `3cdf4498286bfb16d31363039cc57ba94c37a2467e1d5e4f167e9b54b6f87b36`
- [macOS Apple Silicon · arm64 — 156.9 MB](https://dl2.gptt.ir/raavi/stable/2.4.7/Raavi-2.4.7-macOS-arm64-unsigned.dmg) · [ZIP](https://github.com/Poor-smile/RAVI/releases/download/v2.4.7/Raavi-2.4.7-macOS-arm64-unsigned.zip)
  SHA-256: `0eced859e64c7a634ffaa46da9b589ef861c555c5882f39f564fdf9837e76fd9`
- [macOS Intel · x64 — 161.8 MB](https://dl2.gptt.ir/raavi/stable/2.4.7/Raavi-2.4.7-macOS-x64-unsigned.dmg) · [ZIP](https://github.com/Poor-smile/RAVI/releases/download/v2.4.7/Raavi-2.4.7-macOS-x64-unsigned.zip)
  SHA-256: `f860daa670eea0c2b1d5133cabec6999be3a761adebd268ec16ba2620a23a7f0`

[GitHub Release و گزارش ساخت](https://github.com/Poor-smile/RAVI/releases/tag/v2.4.7) · [SHA-256 مک](https://github.com/Poor-smile/RAVI/releases/download/v2.4.7/Raavi-2.4.7-macOS-SHA256SUMS.txt)

Windows امضای Authenticode ندارد؛ macOS بدون Developer ID و notarization با پسوند
`unsigned` ارائه می‌شود. Ed25519 به‌روزرسان، امضای Windows یا اپل نیست. ۳۵ آزمون updater موفق‌اند. این نسخه همان قابلیت‌های ۲.۴.۶ را برای آزمون ارتقا دارد؛ نصب روی دستگاه کاربر هنوز تأیید نشده است.
[گزارش اعتبارسنجی](https://github.com/Poor-smile/RAVI/blob/main/docs/RELEASE_EXECUTION_2.4.7_FA.md). Linux
برای نسخهٔ 2.4.7 ارائه نشده و دکمهٔ آن غیرفعال است.

## بارگذاری روی هاست

از `npm run build:landing` برای ساخت بسته استفاده کنید. فایل‌های صفحه و پوشهٔ
`assets` باید مستقیم زیر `/home3/hpoorsma/ravi.poorsmile.ir/` قرار بگیرند.
پوشه‌های `updates`، `privacy` و نسخه‌های قدیمی را حذف نکنید.

انتشار صفحه فقط پس از تکمیل و بررسی هر دو معماری مک مجاز است. `stable.json`
طبق راهنمای انتشار همیشه آخرین فایل فعال‌سازی است.

## ویرایش محتوا

ساختار صفحه در `index.html`، ظاهر در `style.css` و رفتار در `app.js` است.
متن نمونه در `landing.md` نگهداری و هنگام بسته‌بندی داخل HTML نیز قرار می‌گیرد.
تصاویر برنامه در `assets/screens` و فونت‌ها در `assets/fonts` قرار دارند.
فایل `CHANGELOG.md` باید کنار صفحه باقی بماند.
