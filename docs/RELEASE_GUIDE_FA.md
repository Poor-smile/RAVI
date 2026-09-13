# راهنمای انتشار عمومی راوی

این سند، مسیر مرجع انتشار عمومی نسخه‌های Windows و macOS راوی است. در هر انتشار، مقدار
`X.Y.Z` را با نسخهٔ جدید جایگزین کنید. ترتیب اجرایی بخش صفر، بخشی از گیت انتشار
است؛ به‌خصوص `stable.json` باید همیشه آخرین فایل منتشرشده باشد.

مخزن پروژه:

```text
https://github.com/Poor-smile/RAVI
```

## 0. ترتیب اجرایی غیرقابل جابه‌جایی

شمارهٔ بخش‌های این سند برای مراجعه است؛ ترتیب واقعی هر انتشار دقیقاً این است:

1. نسخه، `README.md`، `CHANGELOG.md` و متن‌های سایت را روی همان commit هماهنگ کنید.
2. گیت تست و ساخت Windows را پاس کنید و Installer همان نسخه را بسازید.
3. Installer حجیم Windows را روی هاست دانلود آپلود و با دانلود کامل، اندازه و
   SHA-512 اعتبارسنجی کنید؛ `stable.json` را هنوز نسازید یا منتشر نکنید.
4. release notes سبک را روی دامنهٔ اصلی قرار دهید، اما `stable.json` را هنوز
   overwrite نکنید.
5. commit انتشار را روی `main`، tag را روی همان commit و GitHub Release عمومی را
   همراه Installer و checksum ثبت کنید.
6. Workflow ساخت macOS را برای همان tag کامل کنید؛ هر دو معماری، DMG، ZIP، گزارش
   ساخت و فایل SHA-256 باید در همان GitHub Release حاضر باشند.
7. DMG هر دو معماری را از همان GitHub Release دریافت کنید، manifest چندسکویی را
   بسازید و هر سه artifact بروزرسانی Windows، Apple Silicon و Intel را روی هاست
   دانلود قرار دهید. اندازه، SHA-512 و امضای Ed25519 هر سه باید کنترل شود.
8. لینک‌های Windows و macOS، حجم، معماری، checksum و وضعیت امضا را در landing
   نهایی کنید و سایت را منتشر و آنلاین کنترل کنید.
9. فقط پس از کامل‌شدن همهٔ گیت‌های بالا، `stable.json` را منتشر کنید تا بروزرسانی
   داخلی Windows و macOS هم‌زمان فعال شود.
10. دانلود عمومی و بنر بروزرسانی را روی Windows، Apple Silicon و Intel کنترل
    کنید؛ سپس اعلان عمومی را بفرستید.

اگر macOS عمداً در یک انتشار ارائه نمی‌شود، این محدودیت باید پیش از مرحلهٔ ۵ در
`CHANGELOG.md`، `README.md`، متن GitHub Release و landing نوشته شود؛ حذف خاموش این
مرحله مجاز نیست.

## 1. معماری انتشار

| نوع فایل | محل نگهداری | آدرس عمومی |
| --- | --- | --- |
| نصب‌کنندهٔ حجیم Windows | هاست دانلود، زیر `public_html/raavi/stable/X.Y.Z/` | `https://dl2.gptt.ir/raavi/stable/X.Y.Z/Raavi-Setup-X.Y.Z-x64.exe` |
| DMG بروزرسانی macOS برای Apple Silicon و Intel | هاست دانلود، کنار Installer Windows | `https://dl2.gptt.ir/raavi/stable/X.Y.Z/` |
| DMG و ZIP جایگزین macOS برای دانلود دستی | GitHub Release همان tag | `https://github.com/Poor-smile/RAVI/releases/tag/vX.Y.Z` |
| manifest سبک | هاست اصلی، `ravi.poorsmile.ir/updates/stable.json` | `https://ravi.poorsmile.ir/updates/stable.json` |
| یادداشت نسخه | هاست اصلی، `ravi.poorsmile.ir/updates/releases/X.Y.Z.json` | `https://ravi.poorsmile.ir/updates/releases/X.Y.Z.json` |
| آرشیو عمومی انتشار | GitHub Release با tag، changelog، Installer و checksum | `https://github.com/Poor-smile/RAVI/releases/tag/vX.Y.Z` |

قواعد ثابت:

- فایل‌های حجیم، از جمله Installer Windows و DMGهای macOS، نباید روی هاست
  `ravi.poorsmile.ir` قرار بگیرند.
- هر نسخهٔ عمومی باید علاوه بر هاست اختصاصی، یک GitHub Release کامل داشته باشد.
  GitHub آرشیو عمومی و مسیر دانلود دستی جایگزین است؛ منبع اصلی updater داخلی نیست،
  مگر اینکه URL آن صریحاً به `mirrors` اضافه شود.
- خروجی macOS فقط روی Runner واقعی macOS ساخته می‌شود. `arm64` روی Runner
  اپل‌سیلیکون و `x64` روی Runner Intel ساخته می‌شود؛ ساخت DMG معتبر روی Windows
  جزو فرایند انتشار نیست.
- فایل macOS بدون امضای Developer ID باید در نام خود `unsigned` داشته باشد. انتشار
  خودکار فایل unsigned ممنوع است و تنها اجرای دستی با تأیید صریح
  `allow_unsigned=true` می‌تواند آن را به Release پیوست کند.
- landing فقط پس از پایان موفق هر دو job ساخت macOS و job انتشار assetها مجاز است
  لینک نسخهٔ جدید را نمایش دهد. دکمهٔ macOS نباید به asset ناقص یا Workflow در حال
  اجرا اشاره کند.
- فایل نصب‌کننده در هاست دانلود باید نسخه‌بندی‌شده و immutable باشد؛ نسخهٔ جدید
  نباید روی پوشهٔ نسخهٔ قبلی overwrite شود.
- مسیر FTP با ریشهٔ وب یکی نیست. فایل عمومی باید زیر `public_html` قرار بگیرد؛
  آپلود در `/raavi/...` ریشهٔ FTP، URL عمومی نمی‌سازد.
- `stable.json` تنها سوئیچ فعال‌سازی عمومی نسخه است و باید بعد از اعتبارسنجی کامل
  هر سه artifact بروزرسانی منتشر شود. schema 2 باید کلیدهای `win32-x64`،
  `darwin-arm64` و `darwin-x64` را داشته باشد؛ فیلد قدیمی `artifact` برای سازگاری
  updaterهای Windows قبلی حفظ می‌شود.
- ترتیب `mirrors` در manifest ترتیب تلاش برنامه است. منبع فعال فعلی
  `https://dl2.gptt.ir` است. برای افزودن یا تعویض هاست، فقط base URLها را با
  `RAAVI_UPDATE_MIRRORS` تغییر دهید؛ مسیر artifact روی همهٔ mirrorها باید یکسان
  باشد.
- رمز FTP و کلید خصوصی امضای انتشار نباید داخل Git، فایل MD، اسکریپت، خروجی ترمینال
  یا command history ذخیره شوند.

## 2. گیت غیرقابل حذف: README، CHANGELOG و GitHub Release

این سه مورد مهم‌ترین بخش هر انتشار عمومی هستند و برای هیچ نسخه‌ای قابل حذف یا
موکول‌کردن به بعد نیستند:

1. **بروزرسانی `CHANGELOG.md`:** نسخه، تاریخ انتشار، تغییرات کاربرمحور، اصلاحات،
   تغییرات ناسازگار، نیاز احتمالی به migration و مشکلات شناخته‌شده را ثبت کنید.
2. **بروزرسانی `README.md`:** امکانات، روش نصب و بروزرسانی، فرمان‌های ساخت، پلتفرم‌های
   پشتیبانی‌شده، لینک دانلود عمومی و هر پیش‌نیازی که در نسخه تغییر کرده است باید با
   رفتار واقعی همان نسخه هماهنگ شود. مرور بدون تغییر README قابل قبول نیست؛ نتیجهٔ
   مرور باید در commit انتشار ثبت شود.
3. **ثبت GitHub Release عمومی:** commit روی `main`، tag همان نسخه، متن release و
   assetهای Windows و macOS به‌همراه SHA-256 باید روی GitHub قابل مشاهده و دانلود
   باشند. اگر نسخه عمداً فقط برای یک پلتفرم منتشر می‌شود، این محدودیت باید در
   `CHANGELOG.md` و متن Release صریح ثبت شود.

هر سه خروجی باید به یک نسخه و یک commit اشاره کنند. متن GitHub Release باید خلاصهٔ
همان ورودی `CHANGELOG.md` باشد و README نباید لینک یا فرمان مربوط به نسخهٔ قبلی را
نمایش دهد.

تا وقتی این گیت کامل نشده است:

- `stable.json` را روی هاست اصلی overwrite نکنید.
- اعلان انتشار نفرستید.
- نسخه را در landing به‌عنوان نسخهٔ جاری معرفی نکنید.

جزئیات Git و GitHub در بخش ۱۳ آمده است، اما باید پیش از فعال‌سازی عمومی بخش ۱۰ کامل
شوند.

## 3. پیش‌بررسی

- وضعیت Git و شاخهٔ فعال را ببینید:

```powershell
git status --short --branch
```

- تغییرات باز کاربر را بدون هماهنگی revert نکنید.
- مطمئن شوید نسخهٔ نامزد انتشار روی همین checkout ساخته می‌شود.
- فضای هاست دانلود، دسترسی FTP و پاسخ HTTPS دامنهٔ `dl2.gptt.ir` را بررسی کنید.
- مسیر فایل‌های سبک در cPanel اصلی را بررسی کنید:

```text
/home3/hpoorsma/ravi.poorsmile.ir/updates
/home3/hpoorsma/ravi.poorsmile.ir/updates/releases
```

- اگر File Manager یا FTP روی مسیر دیگری است، انتشار را متوقف کنید.
- از `stable.json` عمومی فعلی یک کپی محلی با نام نسخهٔ قبلی نگه دارید تا rollback
  سریع ممکن باشد.

## 4. بروزرسانی نسخه و متن انتشار

نسخه را بدون ساخت commit یا tag خودکار افزایش دهید:

```powershell
npm version X.Y.Z --no-git-tag-version
```

این فایل‌ها را با نسخهٔ جدید هماهنگ کنید:

- `package.json`
- `package-lock.json`
- `CHANGELOG.md`
- `README.md`
- `landing/CHANGELOG.md`
- `landing/README.md`
- `app/components/about-dialog.tsx`
- صفحهٔ معرفی و لینک دانلود در `landing/`

در landing برای macOS این موارد الزامی‌اند:

- دو انتخاب صریح `Apple Silicon (arm64)` و `Intel (x64)`؛
- لینک مستقیم DMG و لینک جایگزین ZIP از همان GitHub Release؛
- نسخه، حجم و SHA-256 واقعی هر DMG؛
- وضعیت Developer ID و notarization؛ فایل unsigned باید در نام و میکروکپی صفحه
  بدون ابهام مشخص باشد؛
- توضیح آپدیتر داخلی مشترک Windows و macOS، انتخاب خودکار معماری و اعتبارسنجی
  SHA-512 و Ed25519؛
- GitHub Release به‌عنوان مسیر دانلود دستی جایگزین؛ اگر یک نسخهٔ قدیمی پیش از
  اضافه‌شدن آپدیتر macOS ساخته شده، این محدودیت باید کنار همان نسخه صریح بماند.

در صفحهٔ معرفی، لینک Installer باید مستقیم به هاست دانلود اشاره کند:

```text
https://dl2.gptt.ir/raavi/stable/X.Y.Z/Raavi-Setup-X.Y.Z-x64.exe
```

از لینک نسبی `./downloads/...` برای Installer عمومی استفاده نکنید و فایل EXE را
داخل بستهٔ landing قرار ندهید.

بعد از ویرایش، نبودن لینک و نسخهٔ قدیمی را بررسی کنید:

```powershell
rg -n "OLD_VERSION|Raavi-Setup-OLD_VERSION|ravi\.poorsmile\.ir/downloads" README.md CHANGELOG.md landing
rg -n "X.Y.Z|dl2\.gptt\.ir/raavi/stable/X.Y.Z" README.md CHANGELOG.md landing
```

## 5. گیت تست و ساخت Windows

گیت کامل انتشار را اجرا کنید:

```powershell
npm run release:gate
```

این فرمان همان ممیزی جامع `audit:release` است: قفل وابستگی‌ها، lint، TypeScript،
ساخت و بودجهٔ حجم، تمام آزمون‌های واحد، تمام سناریوهای کاربردی رابط، ممیزی
وابستگی‌ها و ساخت آزمایشی Electron را اجرا می‌کند. شکست یک مرحلهٔ مستقل، اجرای
بقیه را قطع نمی‌کند؛ نتیجهٔ نهایی در صورت هر شکست یا مرحلهٔ مسدود، ناموفق است.
لاگ هر مرحله و `stages.json` در پوشهٔ مجزای ممیزی ذخیره می‌شوند؛ مسیر را می‌توان
با `RAAVI_AUDIT_DIR` تعیین کرد. این فرمان چیزی منتشر نمی‌کند.

اصلاحات شهریور ۲۰۲۶ نیز جزء اجباری همین گیت‌اند:

آزمون `tests/table-focus-stability.spec.ts` در مرحلهٔ عمومی اجرا می‌شود: ثبات خود
جدول و ارتفاع آن هنگام تغییر تم و فوکوس هدر در ویرایش روان و نمای دوبرگی، حفظ
ویرایش سلول، واگرد/انجام دوباره، ثابت‌ماندن متن فایل بدون ویرایش، و ورود صریح به
Markdown جدول و خروج با Escape. آزمون قالب‌بندی سلول در `rich-blocks.spec.ts`
نیز باید فوکوس و پیش‌نمایش پررنگ را پس از ثبت تغییر حفظ کند. اجرای مستقل:
`npx playwright test --config tests/table-focus-stability.config.ts`.
آزمون `table-focus-native.spec.ts` نیز در مرحلهٔ native، همین ثبات را در Electron
و ذخیرهٔ واقعی ویرایش سلول در فایل محلی بررسی می‌کند. برای بستهٔ آماده، متغیر
`RAAVI_RELEASE_EXECUTABLE` را روی مسیر همان `Raavi.exe` قرار دهید و config
`tests/table-focus-native.config.ts` را اجرا کنید؛ پروفایل آزمون مستقل است.

| مرحله | پوشش لازم پیش از ریلیز |
|---|---|
| corrective | اعمال/بازگردانی و تعارض AI، زمینهٔ جدول، سری‌های XY، فهرست، نظر، ذخیره، دو تم و مسیر خروجی؛ کنتراست کنترل‌های PDF، فوکوس و ثابت‌ماندن کاغذ هنگام تغییر تم |
| fidelity | ۲۰ سناریو در چهار ترکیب روشن/تیره و لپ‌تاپ/عریض؛ زمینه و keycap، انتخاب هم‌وزن فرمت و پیش‌نمایش |
| reading-search | ۱۲ سناریوی رابط و آزمون‌های واحد؛ انتهای رندرنشده، سند حجیم، تایپ سریع، تغییر تب و ویرایش همراه پاسخ کهنه |
| native-pdf | سند کوتاه، جدول عریض و سند بلند با ۱۲ نمودار/۶ فرمول، در دو جهت؛ برابری بایت‌های پیش‌نمایش و ذخیره |
| word-artifact / word-render | تولید ۱۰۸ فرمول بومی و کنترل هشدار؛ بازکردن، رندر و ویرایش واقعی در Microsoft Word |

آزمون `tests/about-entry-points.spec.ts` نیز به‌صورت خودکار در مرحلهٔ عمومی اجرا
می‌شود: بازکردن «دربارهٔ راوی» از نام هدر و منوی «…»، عملکرد Enter و Escape،
بازگشت فوکوس و حفظ متن ویرایش‌شده در دو تم و عرض‌های ۱۰۲۴ و ۱۲۸۰ پیکسل دسکتاپ.

فایل سند بلند در `tests/fixtures/corrective-large-current.md` نگهداری می‌شود؛
این آزمون‌ها به پوشهٔ خروجی یک اجرای قبلی وابسته نیستند. سناریوهای جدول بالا با
config اختصاصی اجرا می‌شوند و از پروژهٔ عمومی حذف شده‌اند تا تنظیمات اندازه و
زمان اجرا از دست نروند یا آزمون تکراری اجرا نشود. کل آزمون‌های واحد همچنان با
کشف خودکار فایل‌های `*.test.ts` و `*.test.mjs` انتخاب می‌شوند.

آزمون R10 نیز به‌طور پیش‌فرض از سند فشار Mermaid داخل مخزن استفاده می‌کند؛
دیگر به‌علت تنظیم‌نبودن `RAAVI_STRESS_FIXTURE` بی‌صدا رد نمی‌شود. مقدار این متغیر
همچنان برای ورودی اختصاصی قابل تعیین است و مسیر نامعتبر باعث شکست آزمون می‌شود.
در ورودی پیش‌فرض، بلوک معماری از سند استخراج می‌شود تا مجازی‌سازی فهرست نمودارها
باعث انتخاب نمودار دیگری نشود؛ آزمون سند کامل جداگانه همهٔ نمودارها را پوشش می‌دهد.
پروژهٔ `native` مهلت ۱۸۰ ثانیهٔ تنظیمات اصلی آزمون‌های ایمنی و بازیابی بومی را حفظ می‌کند.

برای اجرای مستقل همین اصلاحات:

```powershell
npm run test:corrective-release
```

مرحلهٔ رندر واقعی Word به Windows، Microsoft Word و Python دارای `pywin32`
نیاز دارد؛ `RAAVI_WORD_PYTHON` مسیر مفسر را تغییر می‌دهد. نبود این پیش‌نیاز، موفقیت
محسوب نمی‌شود. کنترل نصب/ارتقا در ماشین تمیز و ساخت/امضای macOS مراحل جداگانهٔ
همین راهنمای انتشار باقی می‌مانند.

مرورگر Playwright باید نصب باشد (`npx playwright install chromium`). برای اجرا
با Chrome نصب‌شده می‌توان `RAAVI_TEST_BROWSER_CHANNEL=chrome` تعیین کرد؛ نام و
نسخهٔ مرورگر استفاده‌شده باید در گزارش اجرا ثبت شود.

حداقل کنترل‌های اختصاصی سیستم بروزرسانی:

```powershell
npm run typecheck
npm run test:update
npm run smoke:electron
```

نسخهٔ رسمی Windows با Electron و NSIS ساخته می‌شود:

```powershell
npm run desktop:pack
```

خروجی‌های اصلی:

- `release/Raavi-Setup-X.Y.Z-x64.exe`
- `release/win-unpacked/Raavi.exe`
- فایل `.blockmap`، فقط اگر electron-builder آن را تولید کرده باشد

Tauri و فایل Portable بخشی از مسیر رسمی انتشار Windows نسخهٔ ۲ نیستند.

هش دستی Installer را ثبت کنید:

```powershell
Get-FileHash release\Raavi-Setup-X.Y.Z-x64.exe -Algorithm SHA256
Get-FileHash release\Raavi-Setup-X.Y.Z-x64.exe -Algorithm SHA512
```

### آزمون نصب و ارتقای واقعی Windows

Workflow دستی `.github/workflows/verify-windows-install.yml` روی ماشین موقت
`windows-latest` با دسترسی مدیر، نصب تازه، حذف، نصب نسخهٔ قبلی و ارتقای واقعی را
اجرا می‌کند. قرارداد `tests/fixtures/windows-release-2.4.5.json` هویت فایل‌های آزمون
را با نسخه و SHA-256 نصب‌کننده‌ها و SHA-256 دقیق `app.asar` کنترل می‌کند؛ برای
انتشار بعدی، قرارداد و انتخاب فایل در Workflow باید با نامزد همان انتشار هماهنگ شوند.

اسکریپت `scripts/test-windows-install-upgrade.ps1` در حالت پیش‌فرض امضای معتبر
Authenticode می‌خواهد. برای نسخه‌ای که صریحاً بدون امضا منتشر می‌شود، اجرای دستی
با `allow_unsigned=true` تنها وضعیت `NotSigned` را نیز برای آزمون نصب می‌پذیرد؛
امضای خراب یا نامعتبر پذیرفته نمی‌شود و نتیجه هرگز امضای معتبر Windows محسوب نمی‌شود.
این گزینه فایل نصب یا سیاست امنیتی سیستم‌عامل را تغییر نمی‌دهد.

شواهد آزمون شامل وضعیت مدیر، امضای واقعی، رجیستری، میان‌برها، حفظ داده و تطابق
بستهٔ نصب‌شده است. اسکریپت را روی دستگاه روزمره یا سیستمی که راوی و دادهٔ شخصی
دارد اجرا نکنید؛ برای این کار، پیش‌شرط ماشین و پروفایل پاک را کنترل می‌کند.

### 5.1. گیت ساخت macOS روی GitHub Actions

ساخت عمومی macOS با Workflow زیر انجام می‌شود:

```text
.github/workflows/release-macos.yml
```

این Workflow در دو حالت اجرا می‌شود:

- پس از `published` شدن GitHub Release؛
- اجرای دستی `workflow_dispatch` برای یک Release موجود، مانند `vX.Y.Z`.

هر دو build دقیقاً tag انتشار را checkout می‌کنند، نه آخرین وضعیت شاخه را. خروجی‌ها:

```text
Raavi-X.Y.Z-macOS-arm64.dmg
Raavi-X.Y.Z-macOS-arm64.zip
Raavi-X.Y.Z-macOS-x64.dmg
Raavi-X.Y.Z-macOS-x64.zip
Raavi-X.Y.Z-macOS-SHA256SUMS.txt
Raavi-X.Y.Z-macOS-arm64-build-report.txt
Raavi-X.Y.Z-macOS-x64-build-report.txt
```

اگر گواهی Apple تنظیم نشده باشد، `-unsigned` پیش از پسوند فایل اضافه می‌شود.
Workflow معماری باینری را با `lipo`، سلامت DMG را با `hdiutil` و ساختار ZIP و
`.app` را پیش از انتشار بررسی می‌کند.

این مرحله زمانی کامل است که Workflow موفق شده و فهرست assetهای Release شامل هر
هفت خروجی بالا باشد. تا آن زمان:

- landing را روی نسخهٔ جدید macOS منتشر نکنید؛
- `stable.json` را فعال نکنید؛
- اعلان عمومی نفرستید.

برای امضا و notarization عمومی، این Secretها را در GitHub repository ثبت کنید:

```text
MAC_CSC_LINK
MAC_CSC_KEY_PASSWORD
APPLE_ID
APPLE_APP_SPECIFIC_PASSWORD
APPLE_TEAM_ID
```

`MAC_CSC_LINK` باید محتوای base64 گواهی `Developer ID Application` با فرمت
`.p12` باشد. رمز Apple ID عادی را ثبت نکنید؛ فقط app-specific password مجاز است.
برای CI بلندمدت، مهاجرت به App Store Connect API Key ارجح است. Secretها نباید در
log، Markdown، Git یا artifact قرار بگیرند.

ساخت Universal محلی همچنان با فرمان زیر روی macOS ممکن است:

```bash
npm run desktop:pack:mac
```

برای ساخت بومی هر معماری:

```bash
npm run desktop:pack:mac:arm64
npm run desktop:pack:mac:x64
```

## 6. ساخت بستهٔ امضاشدهٔ بروزرسانی

پس از کامل‌شدن Workflow macOS، هر دو DMG را از GitHub Release به پوشهٔ `release`
دریافت کنید. نام فایل می‌تواند امضاشده یا دارای پسوند `-unsigned` باشد، اما معماری
باید دقیقاً در نام مشخص باشد. سپس mirrorهای فعال را مشخص و manifest چندسکویی را
تولید کنید:

```powershell
$env:RAAVI_UPDATE_MIRRORS='https://dl2.gptt.ir'
$env:RAAVI_MAC_ARM64_ARTIFACT=(Resolve-Path 'release\Raavi-X.Y.Z-macOS-arm64.dmg')
$env:RAAVI_MAC_X64_ARTIFACT=(Resolve-Path 'release\Raavi-X.Y.Z-macOS-x64.dmg')
npm run release:update:prepare
Remove-Item Env:RAAVI_UPDATE_MIRRORS,Env:RAAVI_MAC_ARM64_ARTIFACT,Env:RAAVI_MAC_X64_ARTIFACT
```

برای چند mirror، base URLها را با ویرگول و به‌ترتیب اولویت وارد کنید:

```powershell
$env:RAAVI_UPDATE_MIRRORS='https://dl2.gptt.ir,https://download-backup.example.com'
```

خروجی‌های مورد انتظار:

```text
artifacts/update-publish/heavy/raavi/stable/X.Y.Z/Raavi-Setup-X.Y.Z-x64.exe
artifacts/update-publish/heavy/raavi/stable/X.Y.Z/Raavi-X.Y.Z-macOS-arm64.dmg
artifacts/update-publish/heavy/raavi/stable/X.Y.Z/Raavi-X.Y.Z-macOS-x64.dmg
artifacts/update-publish/lightweight/updates/stable.json
artifacts/update-publish/lightweight/updates/releases/X.Y.Z.json
```

`stable.json` شامل نسخه، سه artifact پلتفرمی، اندازه، SHA-512، امضای Ed25519، مسیر
و mirrorهاست. updater با `process.platform` و `process.arch` فقط artifact بومی
دستگاه را انتخاب می‌کند؛ platform و arch نیز داخل payload امضا هستند تا جایگزینی
متقاطع فایل ممکن نباشد. فیلد legacy `artifact` نسخهٔ Windows را برای کلاینت‌های
قدیمی حفظ می‌کند.
کلید عمومی داخل `build/update-public-key.pem` قرار دارد. کلید خصوصی باید خارج از
مخزن و فقط روی دستگاه انتشار نگهداری شود.

بعد از تولید بسته، دوباره تست امضا و fallback را اجرا کنید:

```powershell
npm run test:update
```

نکتهٔ مهم: هنگام آپلود artifactها، دوباره `release:update:prepare` را اجرا نکنید؛
بازنویسی هم‌زمان فایل staging می‌تواند فایل آپلودشده را خراب کند. اگر لازم است بسته
دوباره تولید شود، ابتدا upload را متوقف و سپس از اول شروع کنید.

## 7. کنترل artifactهای محلی

manifest محلی را بخوانید و با هر سه فایل حجیم تطبیق دهید:

```powershell
$manifestPath = 'artifacts\update-publish\lightweight\updates\stable.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$heavyRoot = 'artifacts\update-publish\heavy\raavi\stable\X.Y.Z'

foreach ($key in 'win32-x64','darwin-arm64','darwin-x64') {
  $entry = $manifest.artifacts.$key
  if (-not $entry) { throw "Missing manifest artifact: $key" }
  $artifactPath = Join-Path $heavyRoot ([IO.Path]::GetFileName($entry.path))
  $artifact = Get-Item -LiteralPath $artifactPath
  $sha512 = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA512).Hash.ToLowerInvariant()
  if ($artifact.Length -ne $entry.size) { throw "Artifact size mismatch: $key" }
  if ($sha512 -ne $entry.sha512) { throw "Artifact SHA-512 mismatch: $key" }
}
```

کنترل کنید که:

- `version` برابر `X.Y.Z` است.
- اولین `baseUrl` برابر `https://dl2.gptt.ir` است.
- کلیدهای `win32-x64`، `darwin-arm64` و `darwin-x64` حاضرند و path هرکدام به
  artifact نسخه‌بندی‌شدهٔ همان پلتفرم اشاره می‌کند.
- `artifact.path` legacy با `artifacts.win32-x64.path` یکسان است.
- `notesUrl` به دامنهٔ اصلی اشاره می‌کند.
- هیچ URL با پروتکل `http` داخل manifest وجود ندارد.

## 8. آپلود فایل حجیم روی FTP هاست دانلود

پیشنهاد اصلی، استفاده از session ذخیره‌شده در WinSCP یا Credential Manager ویندوز
است. رمز را داخل دستور ننویسید. در نمونهٔ زیر نام کاربری و میزبان از محیط گرفته
می‌شوند و `curl` رمز را به‌صورت تعاملی درخواست می‌کند:

```powershell
$env:RAAVI_FTP_HOST='<FTP_HOST>'
$env:RAAVI_FTP_USER='<FTP_USER>'

curl.exe --fail --ftp-create-dirs `
  --user $env:RAAVI_FTP_USER `
  --upload-file "artifacts\update-publish\heavy\raavi\stable\X.Y.Z\Raavi-Setup-X.Y.Z-x64.exe" `
  "ftp://$env:RAAVI_FTP_HOST/public_html/raavi/stable/X.Y.Z/Raavi-Setup-X.Y.Z-x64.exe"

curl.exe --fail --ftp-create-dirs `
  --user $env:RAAVI_FTP_USER `
  --upload-file "artifacts\update-publish\heavy\raavi\stable\X.Y.Z\Raavi-X.Y.Z-macOS-arm64.dmg" `
  "ftp://$env:RAAVI_FTP_HOST/public_html/raavi/stable/X.Y.Z/Raavi-X.Y.Z-macOS-arm64.dmg"

curl.exe --fail --ftp-create-dirs `
  --user $env:RAAVI_FTP_USER `
  --upload-file "artifacts\update-publish\heavy\raavi\stable\X.Y.Z\Raavi-X.Y.Z-macOS-x64.dmg" `
  "ftp://$env:RAAVI_FTP_HOST/public_html/raavi/stable/X.Y.Z/Raavi-X.Y.Z-macOS-x64.dmg"

Remove-Item Env:RAAVI_FTP_HOST
Remove-Item Env:RAAVI_FTP_USER
```

قبل از ادامه، مطمئن شوید upload با exit code صفر تمام شده است. اگر upload لغو یا
قطع شد، فایل ناقص را جایگزین کنید و به اندازهٔ نمایش‌داده‌شده در پنل اعتماد نکنید؛
اعتبارسنجی کامل مرحلهٔ بعد الزامی است.

## 9. اعتبارسنجی لینک‌های عمومی updater

ابتدا status، اندازه و پشتیبانی Range را بررسی کنید:

```powershell
$urls = @(
  'https://dl2.gptt.ir/raavi/stable/X.Y.Z/Raavi-Setup-X.Y.Z-x64.exe',
  'https://dl2.gptt.ir/raavi/stable/X.Y.Z/Raavi-X.Y.Z-macOS-arm64.dmg',
  'https://dl2.gptt.ir/raavi/stable/X.Y.Z/Raavi-X.Y.Z-macOS-x64.dmg'
)
$installerUrl = $urls[0]
$urls | ForEach-Object { curl.exe -sS -I --max-time 30 $_ }
```

پاسخ باید این ویژگی‌ها را داشته باشد:

- `HTTP 200`
- `Content-Length` برابر `manifest.artifact.size`
- `Accept-Ranges: bytes`

سپس همان فایل عمومی را کامل دانلود کنید؛ بررسی HEAD به‌تنهایی کافی نیست:

```powershell
$verifiedDownload = '.artifacts\verify-Raavi-Setup-X.Y.Z-x64.exe'
curl.exe --fail --location --output $verifiedDownload $installerUrl
```

اندازه، SHA-512 و امضای فایل عمومی را با manifest محلی بررسی کنید:

```powershell
$manifest = Get-Content -LiteralPath 'artifacts\update-publish\lightweight\updates\stable.json' -Raw | ConvertFrom-Json
$download = Get-Item -LiteralPath $verifiedDownload
$downloadSha512 = (Get-FileHash -LiteralPath $verifiedDownload -Algorithm SHA512).Hash.ToLowerInvariant()

if ($download.Length -ne $manifest.artifact.size) { throw 'Public size mismatch' }
if ($downloadSha512 -ne $manifest.artifact.sha512) { throw 'Public SHA-512 mismatch' }
```

اعتبارسنجی امضای Ed25519 با همان کد برنامه:

```powershell
@'
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateUpdateManifest, verifyDownloadedUpdate } from './desktop/software-update.mjs';

const rawManifest = JSON.parse(
  await readFile('artifacts/update-publish/lightweight/updates/stable.json', 'utf8'),
);
const manifest = validateUpdateManifest(rawManifest, {
  platform: 'win32',
  arch: 'x64',
});
const publicKey = await readFile('build/update-public-key.pem');
await verifyDownloadedUpdate({
  filePath: path.resolve('.artifacts/verify-Raavi-Setup-X.Y.Z-x64.exe'),
  manifest,
  publicKey,
});
console.log('PUBLIC_INSTALLER_SIGNATURE_VERIFIED');
'@ | node --input-type=module -
```

همین دانلود کامل و `verifyDownloadedUpdate` را برای `darwin-arm64` و `darwin-x64`
نیز با DMG متناظر تکرار کنید؛ HEAD یا checksum موجود در GitHub به‌تنهایی جایگزین
کنترل artifact روی هاست دانلود نیست.

اگر هر کدام از این کنترل‌ها fail شد:

1. `stable.json` را منتشر نکنید.
2. فایل خراب روی FTP را با artifact ثابت و صحیح جایگزین کنید.
3. دانلود کامل و اعتبارسنجی را از ابتدا تکرار کنید.

## 10. انتشار فایل‌های سبک روی هاست اصلی

پس از پاس شدن فایل حجیم، فایل یادداشت نسخه را آپلود کنید:

```text
Local:  artifacts/update-publish/lightweight/updates/releases/X.Y.Z.json
Remote: /home3/hpoorsma/ravi.poorsmile.ir/updates/releases/X.Y.Z.json
```

URL عمومی آن را بررسی کنید:

```text
https://ravi.poorsmile.ir/updates/releases/X.Y.Z.json
```

### فعال‌سازی عمومی — همیشه آخرین مرحله

پیش از فعال‌سازی، این چک‌لیست باید کامل باشد:

- [ ] `README.md` برای همین نسخه مرور و در commit انتشار بروزرسانی شده است.
- [ ] `CHANGELOG.md` ورودی کامل `X.Y.Z` را دارد.
- [ ] commit انتشار روی `origin/main` قرار دارد.
- [ ] tag `vX.Y.Z` روی همان commit ثبت و push شده است.
- [ ] GitHub Release عمومی است و Installer و فایل SHA-256 آن دانلود می‌شوند.
- [ ] Workflow macOS برای همان tag موفق شده و DMG، ZIP، گزارش ساخت و checksum هر
      دو معماری در GitHub Release دانلود می‌شوند؛ یا نبود macOS در همهٔ اسناد
      انتشار صریح اعلام شده است.
- [ ] DMG بروزرسانی هر دو معماری روی هاست دانلود قرار دارد و artifactهای
      `darwin-arm64` و `darwin-x64` در manifest با اندازه، SHA-512 و امضای مستقل
      ثبت شده‌اند.
- [ ] landing با لینک، نسخه، حجم، SHA-256 و وضعیت امضای واقعی Windows و macOS
      منتشر و آنلاین کنترل شده است.
- [ ] Installer هاست دانلود به‌طور کامل دانلود و اندازه، SHA-512 و امضای آن تایید شده است.
- [ ] release notes سبک روی دامنهٔ اصلی منتشر و خوانده شده است.

در آخر، و فقط بعد از پاس شدن همهٔ موارد بالا، این فایل را با overwrite آپلود کنید:

```text
Local:  artifacts/update-publish/lightweight/updates/stable.json
Remote: /home3/hpoorsma/ravi.poorsmile.ir/updates/stable.json
```

آپلود `stable.json` نسخه را برای کاربران عمومی Windows و macOS فعال می‌کند. پیش
از آن اعلان انتشار ارسال نکنید و صفحهٔ دانلود را روی نسخهٔ جدید نبرید.

## 11. کنترل آنلاین پس از فعال‌سازی

manifest و یادداشت نسخه را بدون cache بخوانید:

```powershell
$manifest = Invoke-RestMethod `
  -Uri 'https://ravi.poorsmile.ir/updates/stable.json' `
  -Headers @{'Cache-Control'='no-cache'}
$notes = Invoke-RestMethod `
  -Uri 'https://ravi.poorsmile.ir/updates/releases/X.Y.Z.json' `
  -Headers @{'Cache-Control'='no-cache'}

$manifest.version
$manifest.mirrors[0].baseUrl
$manifest.artifact.path
$manifest.artifact.size
$manifest.artifacts.'darwin-arm64'.path
$manifest.artifacts.'darwin-x64'.path
$notes.version
```

انتظار می‌رود:

- نسخهٔ manifest و notes برابر `X.Y.Z` باشد.
- mirror اصلی `https://dl2.gptt.ir` باشد.
- Installer عمومی همچنان با `HTTP 200` و اندازهٔ صحیح پاسخ دهد.
- DMG بروزرسانی arm64 و x64 با `HTTP 200` و اندازهٔ صحیح پاسخ دهند.
- یک نسخهٔ قدیمی راوی روی هر سه هدف، وضعیت `available` برای `X.Y.Z` دریافت کند.
- با دکمهٔ «بررسی بروزرسانی»، بنر پایین راست ظاهر شود.
- مسیرهای `available → downloading → paused/resumed → ready` کار کنند.
- روی macOS، برنامه artifact همان معماری را انتخاب کند و پس از اعتبارسنجی DMG،
  دکمهٔ نصب همان فایل را با ابزار استاندارد macOS باز کند.
- بعد از نصب روی نسخهٔ قبلی، مخزن و تنظیمات کاربر حفظ شوند.
- بروزرسانی به‌تنهایی First Run را دوباره باز نکند؛ First Run فقط وقتی نمایش داده
  شود که اتصال ChatGPT/Codex یا حداقل یک سرویس بکاپ هنوز کامل نشده است.

## 12. صفحهٔ معرفی و نسخهٔ وب

صفحهٔ معرفی را با نسخه، حجم، SHA-256، تغییرات و لینک مستقیم هاست دانلود Windows و
لینک‌های GitHub Release برای Apple Silicon و Intel بروزرسانی کنید. بستهٔ landing
نباید Installer، DMG یا ZIP را در خود داشته باشد.

ترتیب نمایش و وضعیت‌ها:

- Windows: لینک Installer هاست دانلود، وضعیت «آمادهٔ دانلود» و checksum واقعی؛
- macOS: دو دکمهٔ معماری، لینک جایگزین ZIP، checksum واقعی و وضعیت امضا؛
- Windows و macOS: پیشنهاد و دانلود داخلی از manifest مشترک؛
- macOS: انتخاب خودکار Apple Silicon یا Intel و باقی‌ماندن GitHub Release به‌عنوان
  مسیر دستی جایگزین؛
- نسخه‌ای که پیش از زیرساخت macOS updater ساخته شده باید محدودیت خود را صریح نشان
  دهد و نباید به‌عنوان دارای updater معرفی شود؛
- روند انتشار عمومی: test/tag، ساخت بومی، کنترل اصالت و انتشار نهایی؛ سایت باید
  روشن کند که همهٔ خروجی‌ها از یک tag مشترک آمده‌اند.

پیش از بسته‌بندی، لینک همهٔ فایل‌های macOS را با `HTTP 200` کنترل کنید و نام asset
نمایش‌داده‌شده در سایت را با نام موجود در GitHub Release تطبیق دهید.

```powershell
Copy-Item CHANGELOG.md landing\CHANGELOG.md -Force
node scripts/package-landing.mjs
python scripts\write_zip.py .deploy-raavi-publish raavi-landing-wordpress.zip
```

خروجی:

- `raavi-landing-wordpress.zip`

در صورت انتشار نسخهٔ وب:

```powershell
npm run build:web-static
```

خروجی:

- `raavi-web-cpanel.zip`

مسیرهای cPanel:

```text
صفحه معرفی: /home3/hpoorsma/ravi.poorsmile.ir
نسخه وب:    /home3/hpoorsma/raviweb.poorsmile.ir
```

فقط zipهای مربوط به صفحه و نسخهٔ وب را در این مسیرها آپلود و extract کنید. EXE
نباید داخل zip یا هاست اصلی باشد.

کنترل آنلاین:

```powershell
Invoke-WebRequest -Uri "https://ravi.poorsmile.ir/?v=X.Y.Z" -UseBasicParsing
Invoke-WebRequest -Uri "https://raviweb.poorsmile.ir/?v=X.Y.Z" -UseBasicParsing
```

## 13. Git و GitHub — الزامی

فقط فایل‌های منبع مرتبط با انتشار را stage کنید. کلید خصوصی، رمز، فایل‌های موقت،
خروجی دانلودشده برای verification و پوشه‌های build غیرلازم را commit نکنید.

پیش از ساخت GitHub Release، کد نسخه باید در شاخهٔ عمومی مقصد قرار گرفته باشد:

```powershell
git status --short --branch
git commit -m "Release version X.Y.Z"
git push origin HEAD
```

اگر شاخهٔ فعلی `main` نیست، تغییرات را طبق سیاست مخزن به `main` merge و push کنید.
نام یک شاخهٔ feature ثابت را داخل دستورالعمل انتشار hard-code نکنید. سپس کنترل کنید
که commit انتشار روی `origin/main` وجود دارد:

```powershell
git fetch origin
git branch --contains HEAD
git branch -r --contains HEAD
```

tag annotated انتشار را روی همان commit بسازید و push کنید:

```powershell
git tag -a vX.Y.Z -m "Release version X.Y.Z"
git push origin vX.Y.Z
git ls-remote --tags origin vX.Y.Z
```

برای جلوگیری از انتشار tag روی commit اشتباه، این دو شناسه باید به commit انتشار
برسند:

```powershell
git rev-parse HEAD
git rev-list -n 1 vX.Y.Z
```

GitHub Release را با خلاصهٔ همان نسخه از `CHANGELOG.md` بسازید و Installer را به
همراه فایل checksum پیوست کنید. ابتدا checksum قابل انتشار بسازید:

```powershell
$installer = 'release\Raavi-Setup-X.Y.Z-x64.exe'
$sha256 = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
"$sha256  Raavi-Setup-X.Y.Z-x64.exe" | Set-Content `
  -LiteralPath 'release\Raavi-Setup-X.Y.Z-x64.exe.sha256' `
  -Encoding ascii
```

اگر GitHub CLI نصب و لاگین است:

```powershell
gh release create vX.Y.Z `
  release\Raavi-Setup-X.Y.Z-x64.exe `
  release\Raavi-Setup-X.Y.Z-x64.exe.sha256 `
  --repo Poor-smile/RAVI `
  --title "Raavi X.Y.Z" `
  --notes-file CHANGELOG.md `
  --verify-tag
```

اگر Release از رابط وب ساخته می‌شود، همین دو asset و خلاصهٔ تغییرات باید دستی
بارگذاری شوند. Release نباید Draft یا Pre-release باقی بماند، مگر اینکه نسخه عمداً
آزمایشی باشد.

کنترل نهایی GitHub:

```powershell
gh release view vX.Y.Z `
  --repo Poor-smile/RAVI `
  --json url,isDraft,isPrerelease,tagName,assets
```

انتشار Release رویداد ساخت macOS را فعال می‌کند. در صورت نیاز به اجرای دوباره یا
افزودن خروجی macOS به Release موجود، از تب Actions، Workflow
`Build macOS release assets` را با `release_tag=vX.Y.Z` اجرا کنید. گزینهٔ
`publish_release` باید فقط زمانی فعال باشد که Release عمومی موجود و متن آن نهایی
است. گزینهٔ `allow_unsigned` در انتشار عادی باید خاموش بماند.

پس از پایان Workflow کنترل کنید که هر دو معماری، هر دو قالب و فایل checksum حاضرند:

```powershell
gh release view vX.Y.Z `
  --repo Poor-smile/RAVI `
  --json assets `
  --jq '.assets[].name'
```

برای نسخهٔ امضاشده، گزارش هر معماری باید `signing=developer-id` را نشان دهد. برای
نسخهٔ notarized نیز `notarization=requested` و گیت `spctl` باید موفق باشند. وجود
فقط یک معماری، DMG بدون ZIP یا فایل فاقد checksum انتشار macOS کامل محسوب نمی‌شود.

پس از کامل‌شدن assetهای macOS، `README.md`، متن Release و landing را یک بار دیگر
با نام، اندازه، checksum و وضعیت امضای خروجی واقعی تطبیق دهید. این بازبینی یک
مرحلهٔ مستقل انتشار است و با موفق‌شدن Workflow به‌تنهایی جایگزین نمی‌شود.

صفحهٔ عمومی زیر باید باز شود و هر دو asset قابل دانلود باشند:

```text
https://github.com/Poor-smile/RAVI/releases/tag/vX.Y.Z
```

انتشار GitHub الزامی است، اما manifest پیش‌فرض هر سه artifact را از هاست دانلود
اختصاصی می‌گیرد. GitHub مسیر دریافت دستی و آرشیو عمومی جایگزین است؛ آن را بدون
طراحی مسیر asset ثابت، HTTPS مستقیم و تست fallback وارد `RAAVI_UPDATE_MIRRORS`
نکنید.

## 14. نگهداری سه نسخه و rollback

- روی هاست دانلود، نسخهٔ جاری و دو نسخهٔ عمومی قبلی را نگه دارید.
- نسخهٔ جدید را فقط بعد از حداقل یک دور دانلود و نصب موفق وارد چرخهٔ سه‌نسخه‌ای کنید.
- هرگز پوشه‌ای را که `stable.json` فعلی به آن اشاره می‌کند حذف نکنید.
- پیش از حذف نسخهٔ چهارم، لینک آن را از landing، notes و هر manifest آرشیوی بررسی کنید.
- حذف فقط باید روی مسیر دقیق نسخه انجام شود؛ از wildcard یا مسیر محاسبه‌شدهٔ تاییدنشده
  استفاده نکنید.

اگر بعد از انتشار مشکل بحرانی پیدا شد:

1. `stable.json` نسخهٔ قبلیِ از قبل ذخیره‌شده را روی هاست اصلی برگردانید.
2. صحت URL و امضای Installer نسخهٔ قبلی را دوباره بررسی کنید.
3. فایل نسخهٔ مشکل‌دار را برای بررسی نگه دارید، اما manifest عمومی نباید به آن اشاره کند.
4. علت rollback و نسخهٔ جایگزین را در `CHANGELOG.md` ثبت کنید.

## 15. پیام آماده انتشار

```text
راوی X.Y.Z منتشر شد.

در این نسخه:
- ...
- ...
- ...

نسخه وب:
https://raviweb.poorsmile.ir/

دانلود Windows:
https://dl2.gptt.ir/raavi/stable/X.Y.Z/Raavi-Setup-X.Y.Z-x64.exe

دانلود macOS برای Apple Silicon:
MAC_ARM64_DMG_URL

دانلود macOS برای Intel:
MAC_X64_DMG_URL

وضعیت امضای macOS:
SIGNED_AND_NOTARIZED یا UNSIGNED_WITH_DISCLOSURE

صفحه معرفی و تغییرات:
https://ravi.poorsmile.ir/

SHA256:
NEW_HASH
```

## 16. گزارش نهایی انتشار

گزارش نهایی باید شامل این موارد باشد:

- نسخه و زمان انتشار
- لینک commit انتشار روی `main`
- وضعیت بروزرسانی `README.md`
- وضعیت و ورودی نسخه در `CHANGELOG.md`
- هماهنگی متن GitHub Release با CHANGELOG و release notes
- نتیجهٔ `release:gate`، `test:update`، typecheck و smoke Electron
- مسیر و اندازهٔ Installer محلی
- URL عمومی Installer روی هاست دانلود
- نتیجهٔ دانلود کامل، SHA-512 و امضای Ed25519
- URL و نسخهٔ `stable.json`
- کلید و URL artifactهای `win32-x64`، `darwin-arm64` و `darwin-x64` و نتیجهٔ
  انتخاب معماری در آزمون updater
- وضعیت صفحهٔ معرفی و نسخهٔ وب، در صورت انتشار
- شناسهٔ commit روی `main` و tag انتشار
- لینک GitHub Release و وضعیت دانلود Installer و checksum آن
- وضعیت Workflow macOS، Runner هر معماری، DMG و ZIPهای Apple Silicon و Intel،
  checksumها و وضعیت Developer ID/notarization
- تطبیق لینک‌ها، حجم‌ها، checksumها و میکروکپی unsigned در landing با assetهای
  واقعی GitHub Release
- وضعیت نگهداری سه نسخه
- هر blocker، rollback یا نکتهٔ باقی‌مانده


### قرارداد جدید دسترسی دستگاه — ۲۱ شهریور ۱۴۰۵

ویرایشگر موبایل بازنشسته شده است. `tests/desktop-access.spec.ts` به‌صورت اجباری
در پروژهٔ `device-access` گیت عمومی اجرا می‌شود: iPhone، Android، iPad، تبلت Android
و iPad با شناسهٔ دسکتاپ، در هر دو تم باید فقط پیام فارسی ورود با رایانه را نشان دهند.
ورود، بارگذاری مجدد و تغییر جهت/اندازه نباید ویرایشگر یا API سند را اجرا کند یا وضعیت
ذخیره‌شدهٔ سند را تغییر دهد. رایانهٔ لمسی و پنجرهٔ باریک باید مجاز بمانند و حالت دوبرگی
در تغییر اندازه حفظ شود. سناریوی کامل ویرایش/مطالعه/ذخیره/Word/بازیابی در دسکتاپ اجرا می‌شود.

اجرای مستقل: `npm run test:desktop-access` (در این محیط با `RAAVI_TEST_BROWSER_CHANNEL=chrome`).
آزمون‌های قدیمی تب موبایل، sheet موبایل و Back اختصاصی موبایل جایگزین شده‌اند؛
نتایج گزارش قبلی تاریخی‌اند و حذف یک قابلیت به معنی رفع خطاهای مستقل باقی‌ماندهٔ انتشار نیست.
