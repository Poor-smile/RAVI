# قرارداد انتشار OBL-12

این سند gate نهایی شاخهٔ `codex/obsiadian-like` را ثبت می‌کند. هدف، قابل‌اعتمادبودن مسیر تک‌سندی راوی در Web، Windows/Electron و viewportهای موبایل است؛ نه فشرده‌کردن UI دسکتاپ یا افزودن workspace چندسندی.

## قرارداد محصول

- سند فعال همیشه یکتا است؛ open، جست‌وجو و Quick Open همان editor را جایگزین می‌کنند.
- در موبایل، پنج عمل «پررنگ، مورب، پیوند، کار و بیشتر» در نوار پایین با target حداقل ۴۴px قرار دارند. بازکردن فایل و ذخیره در chrome اصلی و حالت خالی مستقیم می‌مانند.
- sidebar و outline زیر ۸۲۰px drawer modal با scrim، Escape/Back، focus containment و focus restoration هستند.
- ارتفاع drawer و toolbar از `visualViewport`، safe area و keyboard inset پیروی می‌کند؛ صفحه زیر صفحه‌کلید مجازی ثابت فرض نمی‌شود.
- inputهای native فایل از accessibility tree حذف شده‌اند و فقط کنترل فارسی نام‌دار آن‌ها را فعال می‌کند.
- reduced motion فقط motion تزئینی/انتقالی را حذف می‌کند؛ state و feedback قابل‌فهم باقی می‌مانند.
- forced colors، focus، active، dirty، pinned و disabled را فقط با رنگ بیان نمی‌کند.

## breakpoint و density

| عرض | قرارداد |
|---:|---|
| ۳۲۰ و ۳۷۵ | تک‌ستون touch-first، نوار پنج‌عملی، drawer تمام‌قد امن |
| ۵۰۰ | تک‌ستون با فضای بیشتر، همان ترتیب فرمان‌ها |
| ۸۲۰ | مرز تبدیل sidebar به drawer؛ هیچ target زیر ۴۴px |
| ۱۰۲۴ و ۱۴۴۰ | shell دسکتاپ، sidebar چپ و toolbar فشردهٔ حداکثر هفت‌عملی |

## بودجه‌های کارایی

بودجه‌ها در `app/release/performance-budgets.ts` منبع واحد دارند:

| سنجه | سقف |
|---|---:|
| آماده‌شدن تعاملی startup | ۳۰۰۰ms |
| آماده‌شدن قفسهٔ ۱۰۰۰ فایل | ۱۵۰۰۰ms |
| پاسخ tree مجازی | ۱۵۰۰ms |
| پاسخ ورودی سند بزرگ | ۲۰۰ms |
| placeholder تصویر | ۱۰۰۰ms |
| رندر سالم Mermaid | ۱۵۰۰۰ms |
| طولانی‌ترین long task | ۲۰۰ms |

اندازه‌گیری stress علاوه بر زمان کل، `maxEventLoopLag` و تعداد long task را ثبت می‌کند تا رندر موفق اما مسدودکننده پذیرفته نشود.

## migration بدون از‌دست‌دادن داده

`app/release/workspace-state.ts` state پراکندهٔ v1 را به `raavi:workspace:v2` منتقل می‌کند: layout pane، عرض/نمای/collapse sidebar و pinned pathها. parser نام‌های legacy را می‌پذیرد، مقدار نامعتبر را clamp می‌کند و کلیدهای v1 حذف نمی‌شوند. اگر v2 موجود و کلید سازگار v1 گم شده باشد، مقدار قابل‌برگشت دوباره ساخته می‌شود. متن سند، فایل و history در این migration دست‌کاری نمی‌شوند.

## gate خودکار

فرمان مرجع `npm run release:gate` به‌ترتیب lint، typecheck، suite قدیمی، file explorer، retrieval، command palette، live edit، سناریوی OBL-12 و smoke packaging را اجرا می‌کند.

پوشش افزوده‌شده شامل این مسیر است:

1. بازکردن فایل؛
2. اتصال پوشه و جست‌وجوی full text؛
3. بازکردن نتیجه در همان سند؛
4. ویرایش، preview و مطالعه؛
5. ذخیرهٔ Markdown و export Word؛
6. ویرایش حل‌نشده، reload و recovery؛
7. صفر خطای runtime console.

تست‌های مستقل breakpointهای ۳۲۰، ۳۷۵، ۵۰۰، ۸۲۰، ۱۰۲۴ و ۱۴۴۰، forced colors، پنج عمل موبایل، حذف native picker از accessibility tree، back-stack drawer و migration را کنترل می‌کنند. baseline تصویری light/dark/overflow/mobile فقط پس از بازبینی انسانی به‌روزرسانی می‌شود.

## smoke بسته‌بندی

- Web: build تولیدی Vinext.
- Electron/Windows: ساخت `win-unpacked` بدون installer و اجرای contractهای desktop.

Electron تنها مسیر دسکتاپ داخل گیت انتشار نسخهٔ ۲ است. Tauri در build، smoke، بسته‌بندی یا دارایی‌های انتشار عمومی اجرا نمی‌شود.

## gate دستی پیش از انتشار عمومی

اتوماسیون جای تست واقعی assistive technology و صفحه‌کلید مجازی را نمی‌گیرد. پیش از برچسب انتشار عمومی، یک تست انسانی کوتاه باید ثبت شود:

- NVDA + Firefox/Chrome در Windows: نام فرمان‌ها، mode، dirty/save، drawer، dialog و announcement خطا؛
- VoiceOver + Safari روی iOS/macOS: rotor heading، drawer، بازگشت focus و خواندن widgetهای Mermaid/تصویر؛
- Android و iOS واقعی: باز/ویرایش/ذخیره با یک دست، بازماندن cursor بالای keyboard و safe area؛
- zoom ۲۰۰٪ و Windows High Contrast: نبود overflow مخرب و باقی‌ماندن focus/active state.

تا ثبت این بررسی انسانی، gate خودکار سبز است اما sign-off دسترس‌پذیری دستگاه واقعی «در انتظار» محسوب می‌شود؛ این وضعیت نباید به‌عنوان failure پنهان یا موفقیت ادعاشده گزارش شود.
