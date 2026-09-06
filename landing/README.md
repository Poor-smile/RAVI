# لندینگ راوی 2.4.5

این پوشه صفحهٔ ایستای معرفی و دانلود راوی است. بسته‌های حجیم Windows و DMG مک روی
هاست دانلود مستقل و ZIPهای مک در GitHub Release نگهداری می‌شوند؛ داخل بستهٔ سایت
یا هاست اصلی نصب‌کننده قرار نمی‌گیرد.

## فایل‌های دانلود

- [Windows x64 — 105.6 MB](https://dl2.gptt.ir/raavi/stable/2.4.5/Raavi-Setup-2.4.5-x64.exe)
  SHA-256: `8b9d4b4244c96fad834e169173cfc693f1d28a7406e3341e359ebeec29ae02b5`
- [macOS Apple Silicon · arm64 — 134.8 MB](https://dl2.gptt.ir/raavi/stable/2.4.5/Raavi-2.4.5-macOS-arm64-unsigned.dmg) · [ZIP](https://github.com/Poor-smile/RAVI/releases/download/v2.4.5/Raavi-2.4.5-macOS-arm64-unsigned.zip)
  SHA-256: `9c3b0aa6b519f6d568796a805dee22034d90359091e86061f86b454dcdbcbb07`
- [macOS Intel · x64 — 138.7 MB](https://dl2.gptt.ir/raavi/stable/2.4.5/Raavi-2.4.5-macOS-x64-unsigned.dmg) · [ZIP](https://github.com/Poor-smile/RAVI/releases/download/v2.4.5/Raavi-2.4.5-macOS-x64-unsigned.zip)
  SHA-256: `535b9ae45ae0e07b98d4ae03d688dd1c3d189275a87616e784ecca9284085768`

[GitHub Release و گزارش ساخت](https://github.com/Poor-smile/RAVI/releases/tag/v2.4.5) · [SHA-256 مک](https://github.com/Poor-smile/RAVI/releases/download/v2.4.5/Raavi-2.4.5-macOS-SHA256SUMS.txt)

Windows امضای Authenticode ندارد؛ macOS بدون Developer ID و notarization با پسوند
`unsigned` ارائه می‌شود. Ed25519 به‌روزرسان، امضای Windows یا اپل نیست. نصب تازه، حذف و
ارتقای واقعی از 2.2.1 روی Windows آزمایشی مدیر موفق بودند و سند و نظر حفظ شدند.
[گزارش آزمون](https://github.com/Poor-smile/RAVI/actions/runs/34036808090). Linux
برای نسخهٔ 2.4.5 ارائه نشده و دکمهٔ آن غیرفعال است.

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
