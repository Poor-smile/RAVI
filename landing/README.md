# لندینگ راوی 2.4.6

این پوشه صفحهٔ ایستای معرفی و دانلود راوی است. بسته‌های حجیم Windows و DMG مک روی
هاست دانلود مستقل و ZIPهای مک در GitHub Release نگهداری می‌شوند؛ داخل بستهٔ سایت
یا هاست اصلی نصب‌کننده قرار نمی‌گیرد.

## فایل‌های دانلود

- [Windows x64 — 122.6 MB](https://dl2.gptt.ir/raavi/stable/2.4.6/Raavi-Setup-2.4.6-x64.exe)
  SHA-256: `fe22c1988a5caff2225c5ec88f231fc0e78422b1d4e463845645f45285e28cfb`
- [macOS Apple Silicon · arm64 — 156.9 MB](https://dl2.gptt.ir/raavi/stable/2.4.6/Raavi-2.4.6-macOS-arm64-unsigned.dmg) · [ZIP](https://github.com/Poor-smile/RAVI/releases/download/v2.4.6/Raavi-2.4.6-macOS-arm64-unsigned.zip)
  SHA-256: `41a4abc0828dcb24ae29f62c8ff1972451a1c8112fdb54e97ba6ab5b16c9337a`
- [macOS Intel · x64 — 161.8 MB](https://dl2.gptt.ir/raavi/stable/2.4.6/Raavi-2.4.6-macOS-x64-unsigned.dmg) · [ZIP](https://github.com/Poor-smile/RAVI/releases/download/v2.4.6/Raavi-2.4.6-macOS-x64-unsigned.zip)
  SHA-256: `d661ee34608de9598203c04c30d55995181b7f21cf6841da5dcd0e5e7e710ffc`

[GitHub Release و گزارش ساخت](https://github.com/Poor-smile/RAVI/releases/tag/v2.4.6) · [SHA-256 مک](https://github.com/Poor-smile/RAVI/releases/download/v2.4.6/Raavi-2.4.6-macOS-SHA256SUMS.txt)

Windows امضای Authenticode ندارد؛ macOS بدون Developer ID و notarization با پسوند
`unsigned` ارائه می‌شود. Ed25519 به‌روزرسان، امضای Windows یا اپل نیست. آزمون‌های واحد و بررسی‌های منتخب موفق بودند؛ به درخواست مالک، ادامهٔ مجموعهٔ جامع و نصب/ارتقای نهایی Windows اجرا نشد.
[گزارش اعتبارسنجی](https://github.com/Poor-smile/RAVI/blob/main/docs/RELEASE_EXECUTION_2.4.6_FA.md). Linux
برای نسخهٔ 2.4.6 ارائه نشده و دکمهٔ آن غیرفعال است.

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
