# گزارش قبل/بعد پایدارسازی renderer مرمید

تاریخ اجرا: ۱۴۰۵/۰۵/۱۲
محیط: Windows، نسخهٔ جاری مخزن، Mermaid 11.16، Electron برای آزمون‌های UI خودکار و Tauri dev برای smoke واقعی renderer ایزوله.

## خلاصهٔ نتیجه

| شاخص | قبل | بعد | روش اعتبارسنجی |
|---|---:|---:|---|
| محل اجرای render سنگین | WebView اصلی | WebView مخفی و قابل destroy در Tauri | smoke واقعی Tauri |
| توقف پردازش timeout | فقط reject شدن Promise | destroy و ساخت context تازه | unit با transport کنترل‌شده |
| مهلت timeout | ۵۰۰۰ ms، بدون توقف context | ۵۰۰۰ ms با restart | unit |
| ادامه پس از ۱۰ timeout | تضمین نداشت | render سالم بدون reload | unit |
| SVG داخلی در DOM اصلی | یک درخت SVG کامل برای هر نمودار mount‌شده | صفر؛ فقط یک `img` | Playwright، اسناد ۸/۲۰/۵۰ نموداری |
| سطح‌های نمودار mount‌شده در سند stress | تا ۲۶ | peak برابر ۸؛ پایدار برابر ۲ | Tauri + CDP |
| تغییر ارتفاع پس از virtualization | اندازه‌گیری نشده | صفر پیکسل | Tauri + Playwright |
| حافظهٔ cache | دو cache مستقل، هر کدام ۸۰ entry و بدون سقف byte | یک LRU با سقف سخت ۲۸ MiB | unit و بازبینی آمار cache |
| ورودی هنگام render سنگین در Tauri | امکان block به‌اندازهٔ کل render | render در thread/WebView اصلی اجرا نمی‌شود | جداسازی process context + smoke Tauri |
| pan/zoom | setState و render React در هر حرکت | یک transform مستقیم در هر frame؛ sync محدود state | unit viewport و بازبینی پیاده‌سازی |
| بیشینهٔ latency حلقهٔ اصلی Tauri | بدون کران مستقل از render | ۷۹٫۸ تا ۹۵٫۱ ms؛ صفر long-task بالای ۱۰۰ ms | Tauri سرد، دو تم |
| FPS pan/zoom | بدون تضمین | ۵۹٫۵ FPS | Tauri، نمودار بزرگ سند stress |
| رشد heap اصلی در اجرای سرد | اندازه‌گیری نشده | حداکثر ۲۴٫۹ MiB | WebView اصلی Tauri |

## زمان render و راه‌اندازی

- build تولیدی در اجرای نهایی: موفق؛ حدود ۱۶ ثانیه برای پنج مرحلهٔ vinext.
- آزمون end-to-end برابری ۲۹ نمونه، شامل render در Studio و سند: ۱٫۱ دقیقه و بدون اختلاف خروجی.
- سه سناریوی سند ۸، ۲۰ و ۵۰ نموداری، بدون پرش ارتفاع و با حداکثر ۱۰ سطح فعال، موفق شدند.
- فایل `MERMAID_ULTIMATE_STRESS_TEST_FA.md` شامل ۲۶ نمودار واقعی است؛ fence تو‌در‌توی نمونه عمداً نمودار نیست. همهٔ ۲۶ نمودار در تم روشن و تیره بدون خطای parser، بدون SVG ناامن و با ابعاد تصویر معتبر رندر شدند.
- اجرای سرد Tauri در دو تم، میانگین زمان آماده‌شدن هر نمودار را بین ۱۵۷ تا ۲۹۷ ms ثبت کرد. کندترین نمودار در نخستین اجرای سرد ۱۵۱۲ ms بود.
- markهای `rendererStartup`، `parse`، `layoutRender`، `sanitize`، `transfer`، `display` و `total` برای اندازه‌گیری تکرارپذیر در development اضافه شده‌اند.

## input latency و FPS

قبل از تغییر، `mermaid.render` و pan/zoom هر دو در حلقهٔ اصلی رابط اجرا می‌شدند؛ بنابراین latency ورودی کران مستقلی از زمان render نداشت. بعد از تغییر، render سنگین Tauri در context مخفی انجام می‌شود و pointermove فقط یک transform تجمیع‌شده در `requestAnimationFrame` اعمال می‌کند. در نتیجه React به ازای هر pointermove دوباره render نمی‌شود.

در اجرای واقعی Tauri، probe تایمری بیشینهٔ latency برابر ۹۵٫۱ ms در تم روشن و ۷۹٫۸ ms در تم تیره ثبت کرد و `PerformanceObserver` هیچ long-task بالای ۱۰۰ ms ندید. pan/zoom نمودار بزرگ با ۱۲۰ حرکت pointer، به‌ترتیب ۵۹٫۵ و ۵۹٫۵ FPS ثبت شد؛ بالاتر از معیار پذیرش ۵۰ FPS.

## حافظه و DOM

بودجهٔ cache اکنون بر حسب byte واقعی UTF-8 محاسبه می‌شود، نه تعداد نمودار. entry فعال pin می‌شود و پس از unpin، LRU تا سقف ۲۸ MiB تخلیه می‌شود. آمار hit، miss، eviction، total bytes و restart count در development در `window.__RAAVI_MERMAID_DEBUG__` قابل مشاهده است.

Blob URL مالکیت component دارد و هنگام تغییر یا unmount revoke می‌شود. در سند stress هیچ SVG داخلی در DOM نبود؛ peak سطح‌های فعال در Tauri برابر ۸، مقدار پایدار برابر ۲، اختلاف ارتفاع صفر و cache نهایی بین ۱٫۳۷ تا ۱٫۴۰ MiB بود. رشد heap WebView اصلی در اجراهای سرد حداکثر ۲۴٫۹ MiB ثبت شد.

در حالت تمام‌صفحه، نمودار اکنون به‌صورت `interactive` pin می‌شود؛ بنابراین observer و timer خروج از viewport نمی‌توانند تصویر را حذف کنند. این رفتار در Electron، Tauri و نسخهٔ زندهٔ پورت ۳۰۰۱ پس از انتظار بیشتر از زمان unmount بررسی شد.

## آزمون‌های اجراشده

- priority، deduplication، latest-wins و stale result
- timeout و شروع job بعدی؛ crash و restart؛ بازیابی بعد از ۱۰ timeout متوالی
- LRU byte budget، pin و آزادسازی Blob URL
- complexity guard برای نمودار متراکم در برابر متن بلند ساده
- sanitizer، فارسی، RTL، accessibility و محاسبات viewport
- برابری کامل ۲۹ نمونهٔ Mermaid میان Studio و سند
- virtualization اسناد ۸، ۲۰ و ۵۰ نموداری
- رندر ۲۶ نمودار سند stress در هر دو تم و تست regression تمام‌صفحه
- build وب، build فرانت Tauri و `cargo check`
- اجرای نهایی `npm test`: ۸۵ unit، ۸ سرور، ۲۰ Playwright اصلی و ۶ Playwright موبایل؛ همگی موفق

## نحوهٔ مشاهدهٔ داده‌های توسعه

در build توسعه، `window.__RAAVI_MERMAID_DEBUG__` آخرین زمان‌های مرحله‌ای، آمار cache، complexity و تعداد restartها را نگه می‌دارد. هیچ telemetry خارجی یا محتوای سند ارسال نمی‌شود.
