# ADR: مرز هویت مسیر Obsidian-inspired راوی

- وضعیت: پذیرفته‌شده برای branch `codex/obsiadian-like`
- تاریخ: ۱۴ اوت ۲۰۲۶
- تصمیم‌گیر: مالک محصول راوی
- دامنه: shell، editor، preview، reading، navigation و design system

## زمینه

راوی یک میز محلی برای مطالعه و ویرایش Markdown فارسی است. ارزش اصلی آن از یک سند فعال، نمایش صحیح متن ترکیبی، نمونه‌خوانی دوبرگی، annotation، حالت مطالعه و مالکیت فایل می‌آید. Obsidian چند الگوی تعاملی موفق دارد—content-first shell، sidebar پایدار، commandهای قابل جست‌وجو و Live Preview روی source واحد—اما مدل بنیادی آن یک workspace چندسندی و توسعه‌پذیر است.

این ADR مشخص می‌کند کدام اصول قابل انتقال‌اند و چه مرزهایی نباید در تسک‌های بعدی شکسته شوند.

## تصمیم

راوی از منطق تعامل Obsidian الهام می‌گیرد، ولی implementation، زبان بصری، نام‌گذاری و معماری محصول مستقل می‌مانند.

### Invariantهای غیرقابل مذاکره

1. **یک سند فعال:** در سطح اصلی فقط یک فایل برای ویرایش/مطالعه فعال است. sidebar می‌تواند فایل دیگری را پیدا کند، اما tab یا workspace چندسندی نمی‌سازد.
2. **فایل منبع حقیقت:** Markdown قابل حمل منبع حقیقت است. preview، decoration، widget، annotation و حالت مطالعه نباید متن را بی‌اجازه به قالب بسته تبدیل کنند.
3. **round-trip امن:** بازکردن، تعویض mode و ذخیره بدون ویرایش باید diff صفر داشته باشد.
4. **هویت برگه‌ای:** کاغذ سرد، مرکب زغالی، آبی proof، folio، spine و زبان نمونه‌خوانی مرجع بصری باقی می‌مانند.
5. **فارسی‌محوری:** prose فارسی RTL، code/path/URL واقعاً لاتین LTR و سند ترکیبی در سطح block/line تصمیم می‌گیرد.
6. **قانون جهت واحد:** سند دارای حروف عربی/فارسی RTL است؛ سند فقط لاتین LTR است. در سند RTL، block یا line فقط با سهم لاتین **بیشتر از ۷۰٪** LTR می‌شود. fenced code همیشه LTR است.
7. **preview مستقل باقی می‌ماند:** Live Edit آینده جای preview را حذف نمی‌کند. «نمونه‌خوانی دوبرگی» مسیر بررسی دقیق source/result است.
8. **local-first:** فایل، index، recent و تنظیمات اصلی روی دستگاه می‌مانند و کار پایه به حساب یا اینترنت وابسته نیست.
9. **دسترسی پایه است:** کار حیاتی فقط با icon، hover، right-click، drag یا رنگ بیان نمی‌شود. keyboard، focus، accessible name، zoom و touch از قرارداد feature هستند.
10. **پیشرفت تدریجی:** `page.tsx` و `globals.css` به‌صورت مرحله‌ای و همراه regression test تفکیک می‌شوند؛ بازنویسی بزرگ یک‌مرحله‌ای ممنوع است.

### Anti-goalها

- tab bar، stacked tabs، چند سند هم‌زمان یا layoutهای workspace نام‌دار
- plugin shell، marketplace، ribbon قابل توسعه یا API تزریق view
- Graph، Canvas، Bases یا backlink به‌عنوان بخشی از مسیر اصلی
- تقلید accent بنفش، خاکستری‌های default، اندازه/شکل دقیق کنترل‌ها یا assetهای Obsidian
- استفاده از نام‌های `vault`، `leaf`، `backlink` و اصطلاحات اکوسیستم Obsidian برای کاربر عمومی
- WYSIWYG بسته، `contenteditable` موازی با source یا ذخیرهٔ HTML به‌جای Markdown
- انتقال مستقیم density دسکتاپ به موبایل

## پیامدهای معماری

- یک utility مشترک در `app/markdown/text-direction.ts` مالک تصمیم bidi است و editor/preview نباید regex یا threshold جدا تعریف کنند.
- commandها باید registry واحد داشته باشند؛ UI فقط command را نمایش یا اجرا می‌کند.
- sidebar contextمحور است و مالک سند نیست؛ بازکردن فایل، سند فعال را جایگزین می‌کند.
- Live Edit با CodeMirror state/transaction و decoration ساخته می‌شود؛ DOM رندرشده منبع داده نیست.
- tokenهای معنایی design system تنها مسیر رنگ، تایپ، radius و elevation هستند.
- هر قابلیت ویرایشی جدید باید corpus round-trip و حالت Source fallback داشته باشد.

## کیفیت پایهٔ لازم پیش از تغییر shell/editor

- label تعاملی: حداقل ۱۲px در دسکتاپ و ۱۳px روی موبایل/ورودی لمسی
- contrast متن عادی: حداقل `4.5:1` در light/dark
- touch target: حداقل ۴۴×۴۴px در موبایل و pointer coarse
- direction boundary tests: ۶۹٪، ۷۰٪ و ۷۱٪ لاتین
- lint/typecheck فایل‌های touched: صفر error
- fixtureهای فارسی، لاتین و ترکیبی با screenshot baseline روشن/تیره

## گزینه‌های ردشده

### ساخت یک Obsidian کوچک‌تر

رد شد؛ زیرا complexity و مدل چندسندی را وارد محصولی می‌کند که مزیتش تمرکز و مطالعهٔ فارسی است.

### حفظ split به‌عنوان تنها روش دیدن نتیجه

رد شد؛ زیرا برای اصلاح‌های روزمره رفت‌وبرگشت بصری زیادی ایجاد می‌کند. split باقی می‌ماند، اما Live Edit مسیر سریع‌تر خواهد بود.

### حذف preview پس از ساخت Live Edit

رد شد؛ زیرا preview و annotation بخشی از هویت نمونه‌خوانی راوی‌اند و برای بررسی دقیق rendering مستقل ارزش دارند.

### thresholdهای جدا برای editor و preview

رد شد؛ زیرا نتیجهٔ ناهمسان اعتماد به تمایز اصلی محصول را از بین می‌برد.

## آزمون پایبندی تسک‌های آینده

پیش از merge هر feature مرتبط، پاسخ این پرسش‌ها باید «بله» باشد:

1. آیا همچنان فقط یک سند فعال است؟
2. آیا source Markdown بدون تغییر ناخواسته باقی می‌ماند؟
3. آیا feature با token و grammar راوی قابل تشخیص است؟
4. آیا مسیر keyboard/touch/screen reader دارد؟
5. آیا feature بدون plugin shell، tab یا workspace جدید قابل ساخت است؟
6. آیا حالت Source و preview مستقل همچنان مسیر بازیابی‌اند؟

اگر پاسخ پرسش ۱، ۲ یا ۳ منفی باشد، feature با این ADR ناسازگار است و باید redesign شود.
