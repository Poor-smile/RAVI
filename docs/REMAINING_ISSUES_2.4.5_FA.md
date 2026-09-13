# مشکلات باقی‌ماندهٔ راوی پیش از انتشار عمومی

> این سند سابقهٔ ممیزی ۵ سپتامبر است و فهرست جاری تسک‌های باز نیست.
> نتیجهٔ انتشار 2.4.5 در [گزارش انتشار](RELEASE_EXECUTION_2.4.5_FA.md)، اصلاحات بعدی
> در [گزارش اصلاحات](REM_IMPLEMENTATION_2026-09-12_FA.md) و ممیزی checkout فعلی
> در [گیت ۱۲ سپتامبر](RELEASE_GATE_2026-09-12_FA.md) ثبت می‌شوند.

نسخهٔ بررسی‌شده: **2.4.5**  
مبنای شواهد: ممیزی **۲۰۲۶/۰۹/۰۵** روی Windows x64  
وضعیت: **آمادگی انتشار عمومی هنوز تأیید نشده است.**

این سند فقط کارهای بازِ ممیزی را ثبت می‌کند. برای تهیهٔ آن آزمون جدیدی اجرا نشده است. آخرین نتیجهٔ هر سناریو از چند اجرای جداگانه: **۲۳۳ موفق، ۳۲ ناموفق و یک اجرا‌نشده از ۲۶۶ سناریو**. این آمار حاصل یک اجرای کاملِ نهایی نیست؛ ۳۲ شکست نیز الزاماً ۳۲ اشکال مستقل محصول نیست.

«تأییدشده» یعنی شاهد اجرایی داریم؛ «بازبینی کد» یعنی خطر دیده شده ولی خرابی آن بازتولید نشده؛ «نیازمند تشخیص» یعنی باید مشکل محصول را از اشکال آزمون جدا کرد. P1 اولویت رسیدگی پیش از انتشار است و با درجهٔ رسمی آسیب‌پذیری یکسان نیست.

## ۱. موانع اصلی انتشار

### R-01 — P1 — ازکارافتادن پردازش Mermaid با سند معیوب

- **وضعیت:** تأییدشده در parser کتابخانهٔ نصب‌شده.
- **شاهد:** Mermaid نسخهٔ `11.16.0` با ورودی XY دارای ابتدا و انتهای یکسان محور، در فرایند آزمایشی جدا با خطای اتمام حافظه و کد ۱۳۴ متوقف شد. کنترل سالم موفق بود.
- **اثر:** پردازش نمودار در Electron و وب در همان محیط رابط اجرا می‌شود؛ مسیر `restart()` محلی قابلیت قطع پردازش همگام را ندارد. توقف عمدی رابط واقعی کاربر با این ورودی انجام نشد.
- **اقدام:** ارتقای سازگار Mermaid به نسخهٔ اصلاح‌شده، حداقل `11.16.1` برای این advisory؛ فراهم‌کردن قطع و بازیابی مستقل رندر در Electron.
- **معیار بسته‌شدن:** کنترل سالم و ورودی معیوب در فرایند محدود بدون توقف سرویس مدیریت شوند؛ نمونه‌های Studio و سندهای سنگین نیز موفق باشند.
- **شواهد:** [نتیجهٔ ورودی معیوب](C:/Users/poorsmile/Documents/RAVI/.artifacts/public-release-audit-2026-09-05/mermaid-dos-result.json)، [کنترل سالم](C:/Users/poorsmile/Documents/RAVI/.artifacts/public-release-audit-2026-09-05/mermaid-dos-control.json)، [مسیر رندر](C:/Users/poorsmile/Documents/RAVI/app/mermaid/render-service.ts:28)، [اعلان رسمی Mermaid](https://github.com/mermaid-js/mermaid/security/advisories/GHSA-2v8p-3f2j-5mp7).

### R-02 — P1 — ناهماهنگی وابستگی‌ها و آسیب‌پذیری‌های باز

- **وضعیت:** اختلاف نسخه و هشدارهای وابستگی تأیید شده‌اند؛ بهره‌برداری از تمام هشدارها در محصول اثبات نشده است.
- **شاهد:** ۱۳۳ اختلاف نسخه با `package-lock.json` و ۳۷ مسیر غیر optional غایب. غیبت مسیر ممکن است از چیدمان مدیر بسته ناشی شود و به‌تنهایی خطای زمان اجرا نیست.
- **audit:** قفل npm دارای ۲۶ مدخل آسیب‌پذیر است: ۱۴ high، ۱۱ moderate و یک low. گزارش pnpm شمارش متفاوتی دارد و نباید با این عدد جمع شود.
- **موارد مشخص:** `react-server-dom-webpack@19.2.6` در دامنهٔ advisory توقف سرویس است؛ اصلاح همان شاخه `19.2.8` است. `vite@8.0.13` نیز advisory مسیرهای Windows دارد؛ اصلاح شاخهٔ ۸ در `8.0.16` آمده است.
- **حد اثر:** exploit روی endpoint عمومی RSC اجرا نشد. advisory یادشدهٔ Vite به dev server در دسترس از شبکه وابسته است و معادل نفوذ مستقیم به نصب‌کننده نیست.
- **اقدام:** تعیین مدیر بسته و قفل مرجع، ارتقای امنیتی سازگار با React/Vinext، سپس نصب از قفل در checkout پاک و اجرای کل آزمون‌ها.
- **معیار بسته‌شدن:** ساخت دقیق از قفل بازتولید شود؛ هشدارهای مرتبط رفع یا عدم تأثیر هر کدام مستند شود؛ نتیجهٔ آزمون با همان وابستگی‌های بستهٔ تحویلی منطبق باشد.
- **شواهد:** [اختلاف قفل](C:/Users/poorsmile/Documents/RAVI/.artifacts/public-release-audit-2026-09-05/dependency-lock-gate.json)، [npm audit](C:/Users/poorsmile/Documents/RAVI/.artifacts/public-release-audit-2026-09-05/npm-audit.json)، [اعلان React](https://github.com/react/react/security/advisories/GHSA-wx67-qw84-cm4g)، [اعلان Vite](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff).

### R-03 — P1 — شکست‌های بازِ کارکرد محصول و قرارداد آزمون

فهرست زیر گروه‌بندی ۳۲ سناریوی ناموفق است. برخی شکست‌ها در مراحل ابتدایی رخ داده‌اند؛ عملیات بعدی آن سناریوها هنوز تأیید نشده‌اند.

| شناسه | موضوع | مشاهده | اقدام و معیار بسته‌شدن |
|---|---|---|---|
| R-03.1 | پیمایش سند بلند | انتخاب فصل ۱۲ به مقصد مورد انتظار نمی‌رسد؛ در بازآزمایی تکرار شد | تطبیق مقصد معنایی و اسکرول؛ عنوان انتخاب‌شده پس از تثبیت تصاویر و نمودارها در محل صحیح دیده شود |
| R-03.2 | حفظ محل خواندن | رفت‌وبرگشت بین دو فایل هم‌نام و تغییر خارجی محتوا، موقعیت را جابه‌جا می‌کند؛ خطای fallback در بازآزمایی `0.1964` در برابر حد `0.03` بود | بررسی هویت فایل، کلید وضعیت و بازیابی anchor؛ گذشتن هر دو سناریوی continuity بدون افزایش بی‌دلیل حدود |
| R-03.3 | جست‌وجو در خواندن | header جلوی کلیک دکمهٔ نوار کناری را می‌گیرد؛ دو سناریو متوقف می‌شوند | رفع هم‌پوشانی یا اصلاح هدف آزمون براساس رابط معتبر؛ جست‌وجو با ماوس و صفحه‌کلید در دسترس باشد |
| R-03.4 | فهرست سند | پس از جایگزینی متن با متن بدون تیتر، چهار بخش قبلی دیده می‌شود | تشخیص همگام‌سازی مدل در برابر روش ویرایش آزمون؛ متن واقعی سند و outline هر دو به‌روز شوند |
| R-03.5 | جایگزینی متن | شمارش DOM دو جایگزینی می‌بیند، با انتظار یک مورد | بررسی مدل واقعی و خروجی فایل؛ یک replace دقیقاً یک رخداد را عوض کند و undo آن را برگرداند؛ تکرار محتوای DOM به‌تنهایی اثبات خطای متن نیست |
| R-03.6 | استودیو فرمول | ده سناریو هنگام بازکردن slash menu متوقف شدند | اصلاح راه‌اندازی مشترک و اجرای کامل هر ده سناریو؛ فعلاً ده نقص مستقل در موتور فرمول اثبات نشده است |
| R-03.7 | بازیابی خطای ذخیره | آزمون W10 در `getComputedStyle` روی عنصر ناموجود شکست خورد | اصلاح selector/آماده‌سازی و سپس تأیید نمایش خطای پایدار، بستن پیام و retry موفق واقعی |
| R-03.8 | هدف لمسی موبایل | دکمهٔ «بازگشت به میز» اندازهٔ ۳۲×۴۴ دارد | رسیدن به قرارداد داخلی حداقل ۴۴×۴۴ در عرض‌های کوچک، بدون بریدگی رابط |
| R-03.9 | تصاویر خارجی | پس از بازگشت به ویرایشگر یک درخواست ثبت شد، با انتظار دو درخواست | تطبیق آزمون با cache؛ تأیید عدم درخواست پیش از اجازه و رفتار پس از اجازه؛ این اختلاف به‌تنهایی نشت حریم خصوصی نیست |
| R-03.10 | نمایش و بزرگ‌نمایی Mermaid | fit با مقیاس حدود `1.30996` با انتظار حداکثر ۱ ناسازگار است؛ ظاهر focus نیز با مرجع فرق دارد | تعیین قرارداد fit و focus؛ بررسی خوانایی و پیمایش، سپس اصلاح رفتار یا انتظار منسوخ با شاهد |
| R-03.11 | قراردادهای متن و چیدمان | شمار نوار ۴ در برابر ۵، متن محلی قدیمی، اختلاف هندسهٔ تم تاریک، مکان popover و اختلاف یک‌پیکسلی پنجرهٔ خروجی | تطبیق با طراحی پذیرفته‌شده و حفظ آزمون کارکرد؛ صرفاً حذف assertionها کافی نیست |
| R-03.12 | تصویر مرجع Electron | ۲۶۳ پیکسل اختلاف با حد مجاز ۱۰۰ | بازبینی بصری و تعیین تغییر عمدی/رگرسیون؛ تصویر مرجع فقط پس از پذیرش مستند به‌روز شود |

**معیار بسته‌شدن R-03:** هر ۳۲ سناریو تعیین تکلیف و بازآزمایی شود؛ سپس کل مجموعه روی یک وضعیت ثابت source و وابستگی اجرا شود. موفقیت بازآزمایی‌های پراکنده جای این اجرای کامل را نمی‌گیرد.

شواهد: [آخرین وضعیت و تاریخچهٔ سناریوها](C:/Users/poorsmile/Documents/RAVI/.artifacts/public-release-audit-2026-09-05/latest-test-ledger.json)، [بازآزمایی build نهایی](C:/Users/poorsmile/Documents/RAVI/.artifacts/public-release-audit-2026-09-05/final-verification/browser-results.json). فهرست دقیق آزمون‌ها در پیوست همین سند آمده است.

### R-04 — P1 پیش از تضمین حفظ داده — نوشتن غیراتمیک فایل اصلی

- **وضعیت:** یافتهٔ بازبینی کد؛ از دست‌رفتن فایل اصلی در این ممیزی بازتولید نشده است.
- **شاهد:** `saveMarkdown` و `saveCurrentDocument` مستقیماً فایل اصلی را با `writeFile` می‌نویسند.
- **اثر:** قطع فرایند، خطای دیسک یا ذخیره‌های هم‌زمان ممکن است نسخهٔ اصلی را ناقص کنند؛ snapshot/history به‌تنهایی اتمیک‌بودن این نوشتن را تضمین نمی‌کند.
- **اقدام:** صف نوشتن برای هر فایل، فایل موقت روی همان volume، تعویض کنترل‌شده و بازیابی معتبر.
- **معیار بسته‌شدن:** آزمون قطع در میانهٔ نوشتن، دیسک پر، مجوز ردشده، ذخیرهٔ هم‌زمان و اجرای مجدد روی دادهٔ موقت؛ همیشه نسخهٔ سالم قبلی یا جدید قابل بازیابی باشد.
- **محل:** [منطق ذخیره](C:/Users/poorsmile/Documents/RAVI/desktop/main.mjs:1428).

### R-05 — P2 — نبود محدودیت زودهنگام در دریافت به‌روزرسان

- **وضعیت:** یافتهٔ بازبینی کد.
- **شاهد:** اندازهٔ stream پس از اتمام دریافت مقایسه می‌شود؛ هنگام نوشتن chunk سقف زودهنگام وجود ندارد. بررسی نسخه نیز مهلت زمانی صریح ندارد.
- **اثر:** پاسخ بیش‌ازحد یا بی‌پایان می‌تواند دیسک مصرف کند یا انتظار طولانی بسازد. امضای Ed25519 و SHA-512 وجود دارند؛ اجرای artifact دست‌کاری‌شده از این یافته نتیجه نمی‌شود.
- **اقدام:** قطع دریافت هنگام عبور از اندازه، مهلت زمانی/بی‌فعالیتی و اعتبارسنجی Range/Content-Range.
- **معیار بسته‌شدن:** آزمون پاسخ بزرگ‌تر از manifest، stream ناقص، توقف ارسال و resume ناسازگار؛ توقف کنترل‌شده و پاک‌سازی فایل ناقص.
- **محل:** [منطق دریافت](C:/Users/poorsmile/Documents/RAVI/desktop/software-update.mjs:354).

### R-06 — P1 برای تحویل عمومی قابل اعتماد — هویت و اعتبار بسته

- **وضعیت:** اختلاف هویت نسخه و نبود امضا تأیید شده‌اند؛ چرخهٔ نصب واقعی تأیید نشده است.
- **شاهد:** package نسخهٔ `2.4.5`، Tauri نسخهٔ `1.7.2` و README لینک stable نسخهٔ `2.2.1` دارند.
- **شاهد بسته:** فایل اجرایی و نصب‌کنندهٔ تحویلی Windows هر دو `NotSigned` هستند. ساخت نصب‌کننده و اجرای برنامه موفق بوده، ولی نصب/ارتقا/حذف روی VM تمیز انجام نشده است.
- **اقدام:** تعیین مسیر و نسخهٔ پشتیبانی‌شده، یکسان‌کردن اطلاعات انتشار، امضای معتبر بستهٔ نامزد و اجرای چرخهٔ نصب.
- **معیار بسته‌شدن:** نصب تمیز، ارتقا از نسخهٔ عمومی قبلی، بازکردن Markdown از سیستم‌عامل، حذف و حفظ دادهٔ کاربر تأیید شوند؛ SHA بستهٔ آزموده‌شده با بستهٔ تحویلی یکی باشد.
- **شواهد:** [نتیجهٔ بسته](C:/Users/poorsmile/Documents/RAVI/.artifacts/public-release-audit-2026-09-05/packaged-final-result.json)، [بررسی قرارداد نصب‌کننده](C:/Users/poorsmile/Documents/RAVI/.artifacts/public-release-audit-2026-09-05/installer-verification.log).

## ۲. بدهی معماری و کارایی

این موارد ریسک نگه‌داری یا خلأ سنجش‌اند و همگی به‌تنهایی اثبات اشکال اجرایی یا مانع فوری انتشار نیستند.

| شناسه / اولویت | مورد باز | اقدام و معیار رسیدگی |
|---|---|---|
| A-01 / P2 | تمرکز UI، چرخهٔ سند، ذخیره، AI و backup در `app/page.tsx` با حدود ۱۹ هزار خط | جداکردن سرویس چرخهٔ عمر سند و ذخیره از UI با حفاظت آزمون‌های رفتاری؛ تعریف مسئولیت و قرارداد روشن برای ماژول‌ها |
| A-02 / P2 | اختلاف رفتار و پوشش Electron، وب و Tauri؛ اجرای Rust شامل صفر آزمون بود | تعیین سطوح پشتیبانی و آزمون هم‌ارزی adapterها؛ آزمون واقعی پوسته‌های مورد ادعای انتشار |
| A-03 / P2 | chunkهای editor و Mermaid Studio نزدیک سقف‌اند؛ رندرهای سنگین تا حدود ۱٫۳۷ ثانیه ثبت شد | benchmark کنترل‌شده روی دستگاه حداقلی و سند بزرگ؛ تعیین بودجهٔ پاسخ‌گویی و کاهش بار براساس پروفایل |
| A-04 / P2 | در پوشهٔ workflows فقط مسیر ساخت انتشار macOS مشاهده شد | اتصال دروازهٔ آزمون و ساخت بازتولیدپذیر به فرایند پیش از انتشار؛ شکست بررسی لازم باید انتشار را متوقف کند |

## ۳. اعتبارسنجی‌های باقی‌مانده

- [ ] اجرای آزمون stress وابسته به `RAAVI_STRESS_FIXTURE` با ورودی معتبر؛ این مورد در ممیزی skip شد.
- [ ] ورود با حساب آزمایشی، backup/restore واقعی و بازیابی روی دستگاه دوم؛ آزمون mock جایگزین این چرخه نیست.
- [ ] کیفیت، زمان اجرا و مصرف منابع TTS/ASR روی فایل‌های بلند و دستگاه حداقلی.
- [ ] نصب و چرخهٔ به‌روزرسانی سیستم‌عامل‌های مورد پشتیبانی؛ macOS/Linux و notarization در میزبان Windows تأیید نشده‌اند.
- [ ] ممیزی دستی دسترس‌پذیری و فناوری‌های کمکی؛ بررسی axe فقط یک سناریوی مشخص خواندن را پوشش داده است.
- [ ] بررسی بار و مسیرهای عمومی RSC/Cloudflare در محیط آزمایشی مجاز، متناسب با شکل واقعی انتشار.
- [ ] تکمیل بررسی مجوز وابستگی‌ها و مدل‌های همراه پیش از توزیع؛ ممیزی فنی قبلی گواهی حقوقی نیست.
- [ ] اجرای کاملِ نهایی با source ثابت، قفل واحد و بستهٔ قابل ردیابی؛ آمار فعلی از چند اجرا تجمیع شده است.

## ۴. مورد عملیاتی باز مربوط به اجرای اولیهٔ ممیزی

**O-01 — تنظیمات پیش از تست بازیابی نشده‌اند.** پیش از اصلاح جداسازی پروفایل، آزمون اولیه فایل‌های آخرین نشست و تنظیمات را در پروفایل واقعی تغییر داد. نسخهٔ معتبر پیش از اجرا برای بازیابی در دسترس نبود؛ بازیابی حدسی انجام نشد. شواهدی از تغییر فایل‌های اصلی اسناد دیده نشد و زمان تغییر history/library همچنان مربوط به قبل از ممیزی بود. رفع اشکال جداسازی، تنظیمات قبلی را خودکار برنمی‌گرداند.

اقدام باقی‌مانده در صورت نیاز به وضعیت قبلی: استفاده از backup معتبر یا تنظیم مجدد ترجیحات توسط مالک حساب؛ از بازنویسی حدسی نشست پرهیز شود. [ثبت زمان تغییر فایل‌ها](C:/Users/poorsmile/Documents/RAVI/.artifacts/public-release-audit-2026-09-05/profile-side-effect-metadata.json).

## ۵. ترتیب پیشنهادی رسیدگی

1. R-02 و ارتقای امنیتی R-01: قفل واحد و نسخه‌های اصلاح‌شده.
2. R-03.1 تا R-03.8 و R-04: پایداری خواندن، دسترسی به ابزارها، ویرایش و حفظ داده.
3. باقی R-03 و R-05: قراردادهای آزمون/ظاهر و محدودیت دریافت updater.
4. R-06 و آزمون‌های انتشار: هویت، امضا، نصب و خدمات واقعی.
5. اجرای کامل دروازهٔ انتشار روی همان نامزد و ثبت نتیجه؛ بدهی معماری طبق ریسک و پشتیبانی ادعاشده برنامه‌ریزی شود.

دستور موجود برای بازاجرای ممیزی پس از نصب پاک از قفل مرجع:

```powershell
$env:RAAVI_TEST_BROWSER_CHANNEL = 'chromium'
npm run audit:release
```

این فرمان باید پس از اصلاحات اجرا شود؛ وجود فرمان یا موفقیت build به‌تنهایی به‌معنای رفع موارد این سند نیست.

## پیوست: ۳۲ سناریوی ناموفق و یک سناریوی اجرا‌نشده

`full` یعنی آخرین نتیجه از اجرای جامع اول است؛ `final-verification` یعنی سناریو روی build اصلاح‌شده نیز بازآزمایی شده است. خطاهای کامل در فایل JSON شواهد محفوظ‌اند.

| ردیف | آزمون و محل | عنوان سناریو | آخرین اجرا | وضعیت |
|---|---|---|---|---|
| 1 | [identity-baseline.spec.ts:105](C:/Users/poorsmile/Documents/RAVI/tests/identity-baseline.spec.ts:105) | keeps the proofreader desk stable in light and dark themes | `final-verification` | ناموفق |
| 2 | [keyboard-shortcuts.spec.ts:458](C:/Users/poorsmile/Documents/RAVI/tests/keyboard-shortcuts.spec.ts:458) | renders every Studio sample in the document | `full` | ناموفق |
| 3 | [p05-document-outline.spec.ts:20](C:/Users/poorsmile/Documents/RAVI/tests/p05-document-outline.spec.ts:20) | P05 assembles the hierarchical Document Outline panel from Figma | `final-verification` | ناموفق |
| 4 | [p06-highlights.spec.ts:21](C:/Users/poorsmile/Documents/RAVI/tests/p06-highlights.spec.ts:21) | P06 assembles the independent local Highlights panel from Figma | `full` | ناموفق |
| 5 | [p07-comments.spec.ts:17](C:/Users/poorsmile/Documents/RAVI/tests/p07-comments.spec.ts:17) | P07 assembles the independent editable Comments panel from Figma | `full` | ناموفق |
| 6 | [p11-replace.spec.ts:35](C:/Users/poorsmile/Documents/RAVI/tests/p11-replace.spec.ts:35) | P11 matches Replace / Found and replaces locally with one-step undo | `final-verification` | ناموفق |
| 7 | [p12-export-formats.spec.ts:192](C:/Users/poorsmile/Documents/RAVI/tests/p12-export-formats.spec.ts:192) | P12 becomes a mobile sheet with 44px controls and no overflow | `full` | ناموفق |
| 8 | [p18-settings-privacy.spec.ts:76](C:/Users/poorsmile/Documents/RAVI/tests/p18-settings-privacy.spec.ts:76) | P18 external image asks before any network request and external links warn | `full` | ناموفق |
| 9 | [p22-formula-studio.spec.ts:47](C:/Users/poorsmile/Documents/RAVI/tests/p22-formula-studio.spec.ts:47) | P27 builds a nested Expression Tree and inserts one formula block | `full` | ناموفق |
| 10 | [p22-formula-studio.spec.ts:121](C:/Users/poorsmile/Documents/RAVI/tests/p22-formula-studio.spec.ts:121) | P27 resizes matrices, preserves cells, changes delimiters and undoes each action once | `full` | ناموفق |
| 11 | [p22-formula-studio.spec.ts:175](C:/Users/poorsmile/Documents/RAVI/tests/p22-formula-studio.spec.ts:175) | P27 builds and reconfigures common calculus operators entirely through GUI | `full` | ناموفق |
| 12 | [p22-formula-studio.spec.ts:234](C:/Users/poorsmile/Documents/RAVI/tests/p22-formula-studio.spec.ts:234) | P27 searches and inserts multiple symbols with keyboard navigation, recents and undo | `full` | ناموفق |
| 13 | [p22-formula-studio.spec.ts:289](C:/Users/poorsmile/Documents/RAVI/tests/p22-formula-studio.spec.ts:289) | P27 nests Binomial inside a configurable logarithmic function | `full` | ناموفق |
| 14 | [p22-formula-studio.spec.ts:324](C:/Users/poorsmile/Documents/RAVI/tests/p22-formula-studio.spec.ts:324) | P27 nests an Accent inside a configurable Fence | `full` | ناموفق |
| 15 | [p22-formula-studio.spec.ts:342](C:/Users/poorsmile/Documents/RAVI/tests/p22-formula-studio.spec.ts:342) | P27 resizes Cases without losing rows and round-trips the result | `full` | ناموفق |
| 16 | [p22-formula-studio.spec.ts:370](C:/Users/poorsmile/Documents/RAVI/tests/p22-formula-studio.spec.ts:370) | P27 uses the 820×980 compact canvas and non-overlay template sheet | `full` | ناموفق |
| 17 | [p22-formula-studio.spec.ts:478](C:/Users/poorsmile/Documents/RAVI/tests/p22-formula-studio.spec.ts:478) | P27 release gate completes Copy, Paste, Undo, Redo and Apply with keyboard only | `full` | ناموفق |
| 18 | [p22-formula-studio.spec.ts:520](C:/Users/poorsmile/Documents/RAVI/tests/p22-formula-studio.spec.ts:520) | P27 release gate pastes a complex tree and preserves it through Save/Open | `full` | ناموفق |
| 19 | [r01-reading-closed.spec.ts:25](C:/Users/poorsmile/Documents/RAVI/tests/r01-reading-closed.spec.ts:25) | R01 assembles the closed 760px reading surface and four-item rail | `full` | ناموفق |
| 20 | [r02-reading-dark.spec.ts:24](C:/Users/poorsmile/Documents/RAVI/tests/r02-reading-dark.spec.ts:24) | R02 maps Reading Closed to the exact dark Foundation surfaces | `full` | ناموفق |
| 21 | [r03-reading-search.spec.ts:51](C:/Users/poorsmile/Documents/RAVI/tests/r03-reading-search.spec.ts:51) | R03 docks local document search between the reading sheet and four-item rail | `final-verification` | ناموفق |
| 22 | [r03-reading-search.spec.ts:242](C:/Users/poorsmile/Documents/RAVI/tests/r03-reading-search.spec.ts:242) | R03 keeps the live search anchor when the pane closes immediately after navigation | `final-verification` | ناموفق |
| 23 | [r04-reading-outline.spec.ts:93](C:/Users/poorsmile/Documents/RAVI/tests/r04-reading-outline.spec.ts:93) | R04 renders the real hierarchical outline in the docked Reading pane | `full` | ناموفق |
| 24 | [r05-reading-highlights.spec.ts:131](C:/Users/poorsmile/Documents/RAVI/tests/r05-reading-highlights.spec.ts:131) | R05 renders real local highlights in the docked Reading pane | `full` | ناموفق |
| 25 | [r06-reading-comments.spec.ts:136](C:/Users/poorsmile/Documents/RAVI/tests/r06-reading-comments.spec.ts:136) | R06 renders the exact dark Comments pane and keeps comments editable | `full` | ناموفق |
| 26 | [r07-reading-tools.spec.ts:72](C:/Users/poorsmile/Documents/RAVI/tests/r07-reading-tools.spec.ts:72) | R07 matches the exact 232×68 text-size popover from Figma | `full` | ناموفق |
| 27 | [r07-reading-tools.spec.ts:216](C:/Users/poorsmile/Documents/RAVI/tests/r07-reading-tools.spec.ts:216) | R07 keeps the four-item Reading Rail reachable beside the mobile Drawer | `full` | ناموفق |
| 28 | [r09-inline-mermaid.spec.ts:105](C:/Users/poorsmile/Documents/RAVI/tests/r09-inline-mermaid.spec.ts:105) | R09 keeps Inline Mermaid expansive and legible in Reading | `full` | ناموفق |
| 29 | [r10-graph-viewer-stress.spec.ts:8](C:/Users/poorsmile/Documents/RAVI/tests/r10-graph-viewer-stress.spec.ts:8) | R10 fills the Graph Viewer canvas with the supplied Mermaid stress document | `full` | اجرا نشده |
| 30 | [reading-continuity-audit.spec.ts:756](C:/Users/poorsmile/Documents/RAVI/tests/reading-continuity-audit.spec.ts:756) | measures long-document reading interruptions | `final-verification` | ناموفق |
| 31 | [reading-continuity-audit.spec.ts:1467](C:/Users/poorsmile/Documents/RAVI/tests/reading-continuity-audit.spec.ts:1467) | keeps independent locations and survives external content changes | `final-verification` | ناموفق |
| 32 | [w10-save-error.spec.ts:3](C:/Users/poorsmile/Documents/RAVI/tests/w10-save-error.spec.ts:3) | W10 exposes a persistent save failure with dismiss and real retry recovery | `full` | ناموفق |
| 33 | [mobile-layout-regression.spec.ts:199](C:/Users/poorsmile/Documents/RAVI/tests/mobile-layout-regression.spec.ts:199) | compact states keep every UI target at 44px and prevent viewport clipping | `final-verification` | ناموفق |

منبع: [گزارش کامل ممیزی](C:/Users/poorsmile/Documents/RAVI/docs/PUBLIC_RELEASE_AUDIT_2026-09-05_FA.md) و [دفتر نتایج](C:/Users/poorsmile/Documents/RAVI/docs/PUBLIC_RELEASE_TEST_LEDGER_2026-09-05_FA.md).
