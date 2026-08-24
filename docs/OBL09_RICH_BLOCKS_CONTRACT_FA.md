# قرارداد بلوک‌های غنی OBL-09

وضعیت: اجراشده در شاخهٔ `codex/obsiadian-like`

## اصل معماری

Markdown تنها منبع حقیقت است. widgetها فقط `Decoration`های CodeMirror هستند و هیچ HTML، SVG یا مقدار فرم به‌عنوان سند ذخیره نمی‌شود. ورود selection به محدودهٔ هر بلوک، همان source را آشکار می‌کند؛ بنابراین ذخیره، Undo/Redo، copy و export از مسیر transactionهای معمول editor عبور می‌کنند.

بلوک‌های چندخطی از `StateField` ارائه می‌شوند، چون CodeMirror اجازه نمی‌دهد decoration جایگزین‌کنندهٔ line break از `ViewPlugin` بیاید. یک driver مبتنی بر viewport فقط محدودهٔ فعال و یک overscan کوچک را می‌سازد؛ هنگام تغییر مجموعهٔ decoration نیز scroll قبلی صریحاً بازیابی می‌شود.

## بلوک‌های پشتیبانی‌شده

- کد fenced: برچسب زبان، کپی، source edit، جهت LTR و پیمایش افقی مستقل.
- جدول GFM: جدول semantic با header، alignment، region قابل پیمایش و برگشت مستقیم به Markdown.
- تصویر: URLهای `http/https`، مسیر نسبی امن و تصویر همراه `.ravi`؛ scheme ناامن و `file:` مسدود می‌شود. تصویر با `loading=lazy`، نسبت موقت و state خطای فارسی نمایش داده می‌شود.
- Callout: فقط `NOTE`، `TIP`، `IMPORTANT` و `WARNING` با syntax قابل‌حمل `> [!TYPE]`.
- پاورقی: reference و definition به هم jump می‌کنند؛ نبودن مقصد source را مخفی یا تغییر نمی‌دهد.
- Mermaid: renderer و cache فعلی راوی، Blob امن، آخرین SVG سالم، پیام اصلاح‌پذیر، متن جایگزین و مسیر مستقیم به Studio.

## امنیت و lifecycle

- HTML خام، iframe، script، plugin widget و scheme فعال اجرا نمی‌شوند.
- Mermaid به‌صورت تصویر Blob نمایش داده و URL آن در `destroy()` آزاد می‌شود.
- image source هنگام teardown حذف می‌شود؛ data URL فقط برای MIMEهای تصویری محدود پذیرفته است.
- Mermaid نامعتبر آخرین خروجی سالم همان anchor را نگه می‌دارد؛ cache محلی حداکثر ۳۲ anchor دارد.

## دسترس‌پذیری و واکنش‌گرایی

هر widget یک نام گروهی، دکمهٔ «ویرایش متن Markdown» و مسیر keyboard دارد. نمودار representation متنی بازشدنی دارد؛ جدول یک region با توضیح پیمایش افقی است. کنترل‌ها در موبایل حداقل ۴۴px هستند و code/table/diagram در عرض ۳۲۰px و zoom 200٪ داخل surface خود scroll یا reflow می‌شوند، نه در کل صفحه.

## پوشش آزمون

fixture فارسی `tests/fixtures/live-edit-rich-blocks.fa.md` شامل کد، جدول ترکیبی، تصویر، Callout، پاورقی، Mermaid سالم و Mermaid نامعتبر است. تست‌ها round-trip، copy، source reveal، Studio، حفظ آخرین SVG، viewport budget، scroll continuity و ۳۲۰px/۲۰۰٪ را پوشش می‌دهند.
