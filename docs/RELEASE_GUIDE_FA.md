# راهنمای انتشار راوی

این فایل چک‌لیست ثابت انتشار راوی است. در هر انتشار، مقدار `X.Y.Z` را با نسخه جدید جایگزین کنید.

مخزن GitHub پروژه:

```text
https://github.com/Poor-smile/RAVI
```

## 1. پیش‌بررسی

- وضعیت Git را بررسی کنید:

```powershell
git status --short --branch
```

- مطمئن شوید روی شاخه درست هستید و تصمیم بگیرید انتشار باید روی `main` هم push شود یا فقط روی شاخه فعلی.
- تغییرات باز کاربر را بدون هماهنگی revert نکنید.
- مسیرهای cPanel را قبل از آپلود چک کنید:
  - صفحه معرفی و دانلود: `/home3/hpoorsma/ravi.poorsmile.ir`
  - نسخه وب: `/home3/hpoorsma/raviweb.poorsmile.ir`
- اگر File Manager روی مسیر دیگری است، آپلود را متوقف کنید و مسیر درست را باز کنید.

## 2. بروزرسانی نسخه

- نسخه بسته را بدون commit/tag خودکار بروزرسانی کنید:

```powershell
npm version X.Y.Z --no-git-tag-version
```

- این فایل‌ها را برای نسخه جدید بررسی و بروزرسانی کنید:
  - `package.json`
  - `package-lock.json`
  - `CHANGELOG.md`
  - `landing/CHANGELOG.md`
  - `app/components/about-dialog.tsx`
  - لینک دانلود در `app/page.tsx`
  - فایل‌های صفحه معرفی در `landing/`

## 3. ساخت نسخه وب

```powershell
npm run build:web-static
```

خروجی مورد انتظار:

- `raavi-web-cpanel.zip`

پس از ساخت، مطمئن شوید فایل zip شامل فایل‌های لازم نسخه وب است، مثل:

- `index.html`
- `assets/`
- `fonts/`

## 4. ساخت نسخه دسکتاپ

نسخهٔ رسمی Windows با Electron و نصب‌کنندهٔ NSIS ساخته می‌شود:

```powershell
npm run desktop:pack
```

خروجی‌های اصلی مورد انتظار:

- `release/Raavi-Setup-X.Y.Z-x64.exe`
- `release/Raavi-Setup-X.Y.Z-x64.exe.blockmap`
- `release/win-unpacked/Raavi.exe`

فرمان `desktop:pack` آیکون برنامه و فایل Markdown را می‌سازد، build تولیدی را
انجام می‌دهد، Installer را تولید می‌کند و قرارداد NSIS را نیز بررسی می‌کند.
Tauri و فایل Portable بخشی از مسیر انتشار نسخهٔ ۲ نیستند.

فایل‌های نهایی دانلود را در این مسیرها هم کپی کنید:

- `landing/downloads/`
- `.deploy-raavi-publish/downloads/`

هش فایل‌ها را بگیرید:

```powershell
Get-FileHash release\Raavi-Setup-X.Y.Z-x64.exe -Algorithm SHA256
```

## 5. بروزرسانی صفحه معرفی و CHANGELOG

- نسخه، لینک دانلود، حجم فایل، SHA256 و cache-busting query را در فایل‌های landing بروزرسانی کنید.
- لینک دانلود اصلی باید به این فرم باشد:

```text
./downloads/Raavi-Setup-X.Y.Z-x64.exe
```

- فایل‌های متنی معرفی را هم هم‌راستا کنید:
  - `landing/README.md`
  - `landing/homepage-copy.md`

- CHANGELOG اصلی را داخل landing کپی کنید:

```powershell
Copy-Item CHANGELOG.md landing\CHANGELOG.md -Force
```

- بسته صفحه معرفی را بسازید:

```powershell
node scripts/package-landing.mjs
python scripts\write_zip.py .deploy-raavi-publish raavi-landing-wordpress.zip
```

خروجی مورد انتظار:

- `raavi-landing-wordpress.zip`

## 6. کنترل قبل از آپلود

نمونه جستجو برای پیدا کردن نسخه یا هش قدیمی:

```powershell
rg -n "Raavi-Setup-OLD|OLD_HASH|نسخهٔ <bdi dir=`"ltr`">OLD"
```

نمونه جستجو برای تایید نسخه جدید:

```powershell
rg -n "Raavi-Setup-X.Y.Z|X.Y.Z|NEW_HASH" CHANGELOG.md landing app package.json desktop build
```

## 7. آپلود در cPanel

### صفحه معرفی

- فایل `raavi-landing-wordpress.zip` را در مسیر زیر آپلود کنید:

```text
/home3/hpoorsma/ravi.poorsmile.ir
```

- گزینه overwrite را فعال کنید.
- zip را داخل همین مسیر extract کنید.
- بعد از extract وجود این فایل‌ها را بررسی کنید:
  - `index.html`
  - `CHANGELOG.md`
  - `downloads/Raavi-Setup-X.Y.Z-x64.exe`

### نسخه وب

- فایل `raavi-web-cpanel.zip` را در مسیر زیر آپلود کنید:

```text
/home3/hpoorsma/raviweb.poorsmile.ir
```

- گزینه overwrite را فعال کنید.
- zip را داخل همین مسیر extract کنید.
- بعد از extract وجود این فایل‌ها را بررسی کنید:
  - `index.html`
  - `assets/`
  - `fonts/`

## 8. کنترل آنلاین

بعد از آپلود، آدرس‌ها را با نسخه جدید بررسی کنید:

```powershell
$ProgressPreference='SilentlyContinue'
Invoke-WebRequest -Uri "https://ravi.poorsmile.ir/?v=X.Y.Z" -UseBasicParsing
Invoke-WebRequest -Uri "https://raviweb.poorsmile.ir/?v=X.Y.Z" -UseBasicParsing
Invoke-WebRequest -Uri "https://ravi.poorsmile.ir/downloads/Raavi-Setup-X.Y.Z-x64.exe" -UseBasicParsing
```

در صفحه معرفی باید نسخه، لینک دانلود و هش جدید دیده شود. در نسخه وب، ممکن است لینک‌ها داخل bundle جاوااسکریپت باشند و مستقیما در `index.html` دیده نشوند.

## 9. تست‌ها

حداقل تست‌های پیشنهادی برای انتشار:

```powershell
npx eslint app tests scripts desktop playwright.config.ts playwright.reading-audit.config.ts --ignore-pattern dist --ignore-pattern .next --ignore-pattern .deploy-raavi-publish --ignore-pattern .deploy-raavi-web --ignore-pattern release
node --import tsx --test tests/mermaid-blocks.test.ts tests/mermaid-samples.test.ts tests/mermaid-viewport.test.ts tests/mermaid-persian-adapter.test.ts tests/mermaid-simple-builder.test.ts tests/reading-position.test.ts tests/raavi-assets.test.ts
node --test tests/rendered-html.test.mjs tests/desktop-server.test.mjs
npx playwright test tests/keyboard-shortcuts.spec.ts tests/mermaid-persian-studio.spec.ts
npx playwright test --config=playwright.reading-audit.config.ts
```

نکته شناخته‌شده: اگر تست scroll sync در `tests/keyboard-shortcuts.spec.ts` دوباره fail شد، بررسی کنید رویداد scroll در تست با `{ bubbles: true }` شبیه‌سازی شده باشد تا React آن را دریافت کند.

## 10. بروزرسانی Git

- وضعیت نهایی را ببینید:

```powershell
git status --short --branch
```

- فقط فایل‌های مرتبط با انتشار را stage کنید. خروجی‌های موقت، لاگ‌ها، پوشه‌های build غیرلازم و artifactهای اشتباه cPanel را stage نکنید.
- commit انتشار:

```powershell
git commit -m "Release version X.Y.Z"
```

- tag انتشار:

```powershell
git tag -a vX.Y.Z -m "Release version X.Y.Z"
```

- push شاخه، main و tag:

```powershell
git push origin feature/persian-md-editor-polish
git push origin HEAD:main
git push origin vX.Y.Z
git fetch origin main:refs/remotes/origin/main
git branch -f main origin/main
```

- کنترل نهایی remote:

```powershell
git ls-remote --heads origin main feature/persian-md-editor-polish
git ls-remote --tags origin vX.Y.Z
```

اگر شاخه انتشار تغییر کرد، نام شاخه را در دستورها جایگزین کنید.

## 11. ساخت GitHub Release

بعد از push شدن tag، برای نسخه جدید در بخش Releases مخزن هم یک release بسازید:

```text
https://github.com/Poor-smile/RAVI/releases
```

مشخصات پیشنهادی:

- Tag: `vX.Y.Z`
- Title: `Raavi X.Y.Z`
- Description: خلاصه تغییرات همان نسخه از `CHANGELOG.md`
- Assets:
  - `release/Raavi-Setup-X.Y.Z-x64.exe`
  - در صورت نیاز `raavi-web-cpanel.zip`
  - در صورت نیاز `raavi-landing-wordpress.zip`

اگر GitHub CLI روی سیستم نصب و لاگین است، می‌توانید release را با این دستور بسازید:

```powershell
gh release create vX.Y.Z `
  release\Raavi-Setup-X.Y.Z-x64.exe `
  --repo Poor-smile/RAVI `
  --title "Raavi X.Y.Z" `
  --notes-file CHANGELOG.md
```

بعد از ساخت release، صفحه زیر را باز کنید و مطمئن شوید assetها قابل دانلود هستند:

```text
https://github.com/Poor-smile/RAVI/releases/tag/vX.Y.Z
```

## 12. پیام آماده تلگرام

```text
راوی X.Y.Z منتشر شد.

در این نسخه:
- ...
- ...
- ...

نسخه وب:
https://raviweb.poorsmile.ir/

دانلود Windows:
https://ravi.poorsmile.ir/downloads/Raavi-Setup-X.Y.Z-x64.exe

صفحه معرفی و تغییرات:
https://ravi.poorsmile.ir/

SHA256:
NEW_HASH
```

## 13. گزارش نهایی انتشار

در پایان انتشار، گزارش کوتاه باید شامل این موارد باشد:

- نسخه بروزرسانی‌شده
- وضعیت CHANGELOG
- وضعیت build نسخه وب
- وضعیت build نسخه دسکتاپ
- وضعیت آپلود صفحه معرفی
- وضعیت آپلود نسخه وب
- لینک دانلود Windows
- لینک نسخه وب
- commit و tag Git
- لینک GitHub Release
- نتیجه تست‌ها
- هر blocker یا نکته باقی‌مانده
