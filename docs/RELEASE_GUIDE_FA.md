# راهنمای انتشار عمومی راوی

این سند، مسیر مرجع انتشار عمومی نسخهٔ Windows راوی است. در هر انتشار، مقدار
`X.Y.Z` را با نسخهٔ جدید جایگزین کنید. ترتیب مراحل این سند بخشی از گیت انتشار
است؛ به‌خصوص `stable.json` باید همیشه آخرین فایل منتشرشده باشد.

مخزن پروژه:

```text
https://github.com/Poor-smile/RAVI
```

## 1. معماری انتشار

| نوع فایل | محل نگهداری | آدرس عمومی |
| --- | --- | --- |
| نصب‌کنندهٔ حجیم Windows | هاست دانلود، زیر `public_html/raavi/stable/X.Y.Z/` | `https://dl2.gptt.ir/raavi/stable/X.Y.Z/Raavi-Setup-X.Y.Z-x64.exe` |
| manifest سبک | هاست اصلی، `ravi.poorsmile.ir/updates/stable.json` | `https://ravi.poorsmile.ir/updates/stable.json` |
| یادداشت نسخه | هاست اصلی، `ravi.poorsmile.ir/updates/releases/X.Y.Z.json` | `https://ravi.poorsmile.ir/updates/releases/X.Y.Z.json` |
| آرشیو عمومی انتشار | GitHub Release با tag، changelog، Installer و checksum | `https://github.com/Poor-smile/RAVI/releases/tag/vX.Y.Z` |

قواعد ثابت:

- فایل‌های حجیم، از جمله Installer، نباید روی هاست `ravi.poorsmile.ir` قرار بگیرند.
- هر نسخهٔ عمومی باید علاوه بر هاست اختصاصی، یک GitHub Release کامل داشته باشد.
  GitHub آرشیو عمومی و مسیر دانلود دستی جایگزین است؛ منبع اصلی updater داخلی نیست،
  مگر اینکه URL آن صریحاً به `mirrors` اضافه شود.
- فایل نصب‌کننده در هاست دانلود باید نسخه‌بندی‌شده و immutable باشد؛ نسخهٔ جدید
  نباید روی پوشهٔ نسخهٔ قبلی overwrite شود.
- مسیر FTP با ریشهٔ وب یکی نیست. فایل عمومی باید زیر `public_html` قرار بگیرد؛
  آپلود در `/raavi/...` ریشهٔ FTP، URL عمومی نمی‌سازد.
- `stable.json` تنها سوئیچ فعال‌سازی عمومی نسخه است و باید بعد از اعتبارسنجی کامل
  Installer منتشر شود.
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
   assetهای Installer و SHA-256 باید روی GitHub قابل مشاهده و دانلود باشند.

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

## 6. ساخت بستهٔ امضاشدهٔ بروزرسانی

mirrorهای فعال را مشخص و بستهٔ انتشار را تولید کنید:

```powershell
$env:RAAVI_UPDATE_MIRRORS='https://dl2.gptt.ir'
npm run release:update:prepare
Remove-Item Env:RAAVI_UPDATE_MIRRORS
```

برای چند mirror، base URLها را با ویرگول و به‌ترتیب اولویت وارد کنید:

```powershell
$env:RAAVI_UPDATE_MIRRORS='https://dl2.gptt.ir,https://download-backup.example.com'
```

خروجی‌های مورد انتظار:

```text
artifacts/update-publish/heavy/raavi/stable/X.Y.Z/Raavi-Setup-X.Y.Z-x64.exe
artifacts/update-publish/lightweight/updates/stable.json
artifacts/update-publish/lightweight/updates/releases/X.Y.Z.json
```

`stable.json` شامل نسخه، اندازه، SHA-512، امضای Ed25519، مسیر artifact و mirrorهاست.
کلید عمومی داخل `build/update-public-key.pem` قرار دارد. کلید خصوصی باید خارج از
مخزن و فقط روی دستگاه انتشار نگهداری شود.

بعد از تولید بسته، دوباره تست امضا و fallback را اجرا کنید:

```powershell
npm run test:update
```

نکتهٔ مهم: هنگام آپلود Installer، دوباره `release:update:prepare` را اجرا نکنید؛
بازنویسی هم‌زمان فایل staging می‌تواند فایل آپلودشده را خراب کند. اگر لازم است بسته
دوباره تولید شود، ابتدا upload را متوقف و سپس از اول شروع کنید.

## 7. کنترل artifactهای محلی

manifest محلی را بخوانید و با فایل حجیم تطبیق دهید:

```powershell
$manifestPath = 'artifacts\update-publish\lightweight\updates\stable.json'
$artifactPath = 'artifacts\update-publish\heavy\raavi\stable\X.Y.Z\Raavi-Setup-X.Y.Z-x64.exe'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$artifact = Get-Item -LiteralPath $artifactPath
$sha512 = (Get-FileHash -LiteralPath $artifactPath -Algorithm SHA512).Hash.ToLowerInvariant()

if ($artifact.Length -ne $manifest.artifact.size) { throw 'Artifact size mismatch' }
if ($sha512 -ne $manifest.artifact.sha512) { throw 'Artifact SHA-512 mismatch' }
```

کنترل کنید که:

- `version` برابر `X.Y.Z` است.
- اولین `baseUrl` برابر `https://dl2.gptt.ir` است.
- `artifact.path` برابر مسیر نسخه‌بندی‌شدهٔ Installer است.
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

Remove-Item Env:RAAVI_FTP_HOST
Remove-Item Env:RAAVI_FTP_USER
```

قبل از ادامه، مطمئن شوید upload با exit code صفر تمام شده است. اگر upload لغو یا
قطع شد، فایل ناقص را جایگزین کنید و به اندازهٔ نمایش‌داده‌شده در پنل اعتماد نکنید؛
اعتبارسنجی کامل مرحلهٔ بعد الزامی است.

## 9. اعتبارسنجی لینک عمومی Installer

ابتدا status، اندازه و پشتیبانی Range را بررسی کنید:

```powershell
$installerUrl = 'https://dl2.gptt.ir/raavi/stable/X.Y.Z/Raavi-Setup-X.Y.Z-x64.exe'
curl.exe -sS -I --max-time 30 $installerUrl
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

const manifest = validateUpdateManifest(JSON.parse(
  await readFile('artifacts/update-publish/lightweight/updates/stable.json', 'utf8'),
));
const publicKey = await readFile('build/update-public-key.pem');
await verifyDownloadedUpdate({
  filePath: path.resolve('.artifacts/verify-Raavi-Setup-X.Y.Z-x64.exe'),
  manifest,
  publicKey,
});
console.log('PUBLIC_INSTALLER_SIGNATURE_VERIFIED');
'@ | node --input-type=module -
```

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
- [ ] Installer هاست دانلود به‌طور کامل دانلود و اندازه، SHA-512 و امضای آن تایید شده است.
- [ ] release notes سبک روی دامنهٔ اصلی منتشر و خوانده شده است.

در آخر، و فقط بعد از پاس شدن همهٔ موارد بالا، این فایل را با overwrite آپلود کنید:

```text
Local:  artifacts/update-publish/lightweight/updates/stable.json
Remote: /home3/hpoorsma/ravi.poorsmile.ir/updates/stable.json
```

آپلود `stable.json` نسخه را برای کاربران عمومی فعال می‌کند. پیش از آن اعلان انتشار
ارسال نکنید و صفحهٔ دانلود را روی نسخهٔ جدید نبرید.

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
$notes.version
```

انتظار می‌رود:

- نسخهٔ manifest و notes برابر `X.Y.Z` باشد.
- mirror اصلی `https://dl2.gptt.ir` باشد.
- Installer عمومی همچنان با `HTTP 200` و اندازهٔ صحیح پاسخ دهد.
- یک نسخهٔ قدیمی راوی، وضعیت `available` برای `X.Y.Z` دریافت کند.
- با دکمهٔ «بررسی بروزرسانی»، بنر پایین راست ظاهر شود.
- مسیرهای `available → downloading → paused/resumed → ready` کار کنند.
- بعد از نصب روی نسخهٔ قبلی، مخزن و تنظیمات کاربر حفظ شوند.
- بروزرسانی به‌تنهایی First Run را دوباره باز نکند؛ First Run فقط وقتی نمایش داده
  شود که اتصال ChatGPT/Codex یا حداقل یک سرویس بکاپ هنوز کامل نشده است.

## 12. صفحهٔ معرفی و نسخهٔ وب

صفحهٔ معرفی را با نسخه، حجم، SHA-256، تغییرات و لینک مستقیم هاست دانلود بروزرسانی
کنید. بستهٔ landing نباید Installer را در خود داشته باشد.

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

صفحهٔ عمومی زیر باید باز شود و هر دو asset قابل دانلود باشند:

```text
https://github.com/Poor-smile/RAVI/releases/tag/vX.Y.Z
```

انتشار GitHub الزامی است، اما manifest پیش‌فرض همچنان به هاست دانلود اختصاصی اشاره
می‌کند. GitHub را بدون طراحی مسیر asset ثابت، HTTPS مستقیم و تست fallback وارد
`RAAVI_UPDATE_MIRRORS` نکنید.

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
- وضعیت صفحهٔ معرفی و نسخهٔ وب، در صورت انتشار
- شناسهٔ commit روی `main` و tag انتشار
- لینک GitHub Release و وضعیت دانلود Installer و checksum آن
- وضعیت نگهداری سه نسخه
- هر blocker، rollback یا نکتهٔ باقی‌مانده
