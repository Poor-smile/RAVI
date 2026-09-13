# میزبانی ابزار اتصال ChatGPT راوی

بسته‌های مستقل رسمی OpenAI Codex نسخهٔ `0.154.0` بدون تغییر در هاست دانلود قرار دارند:

| سیستم | لینک |
| --- | --- |
| Windows x64 | [بستهٔ ویندوز](https://dl2.gptt.ir/raavi/runtime/codex/0.154.0/codex-package-x86_64-pc-windows-msvc.tar.gz) |
| macOS Apple Silicon | [بستهٔ ARM64](https://dl2.gptt.ir/raavi/runtime/codex/0.154.0/codex-package-aarch64-apple-darwin.tar.gz) |
| macOS Intel | [بستهٔ x64](https://dl2.gptt.ir/raavi/runtime/codex/0.154.0/codex-package-x86_64-apple-darwin.tar.gz) |

- [فهرست فایل‌ها، اندازه و منبع](https://dl2.gptt.ir/raavi/runtime/codex/0.154.0/manifest.json)
- [SHA256SUMS](https://dl2.gptt.ir/raavi/runtime/codex/0.154.0/SHA256SUMS)
- [مجوز Apache 2.0](https://dl2.gptt.ir/raavi/runtime/codex/0.154.0/LICENSE) و [NOTICE](https://dl2.gptt.ir/raavi/runtime/codex/0.154.0/NOTICE)
- منبع رسمی: https://github.com/openai/codex/releases/tag/rust-v0.154.0

## نتیجهٔ آپلود در ۱۳ سپتامبر ۲۰۲۶

هر سه آرشیو پیش از آپلود با SHA-256 منبع رسمی بررسی شدند؛ سپس دریافت کامل از FTP و
دریافت کامل از آدرس عمومی HTTPS نیز با همان اندازه و SHA-256 تطبیق داشت. فایل‌های
LICENSE، NOTICE، manifest.json، SHA256SUMS و README.txt نیز از لینک عمومی بررسی شدند.
گزارش محلی در `.artifacts/connection-runtime/public-verification.json` است.

بسته‌ها روی سرور اجرا یا نصب نشده‌اند. این بسته‌های بومی شامل فایل اجرایی و ابزارهای
همراه هستند؛ کاربر برای اجرای آن‌ها به Node.js یا npm سراسری نیاز ندارد. اجرای
`codex --version` از بستهٔ Windows در مسیر آزمایشی، با PATH محدود به System32،
نسخهٔ `codex-cli 0.154.0` را برگرداند. آزمون اجرای بومی مک همچنان باید روی runner مک انجام شود.

## قرارداد برنامه

`desktop/managed-codex-manifest.mjs` آدرس HTTPS و هش هر معماری را در کد ثابت می‌کند؛
فهرست عمومی سرور مجوز تغییر خودکار نسخه یا هش را ندارد. دریافت از هاست دانلود انجام
می‌شود و منبع رسمی GitHub مسیر جایگزین است. فقط پس از تطبیق کامل اندازه و SHA-256،
استخراج بسته در پوشهٔ خصوصی tools/codex در پروفایل راوی انجام می‌شود.

انتشار نسخهٔ جدید ابزار باید در پوشهٔ نسخهٔ جدید انجام شود و با تغییر manifest برنامه
همراه باشد؛ فایل‌های نسخهٔ قبلی نباید بازنویسی شوند.

آپلود این ابزارها به معنای انتشار یا تأیید نهایی راوی ۲.۴.۶ نیست. گیت انتشار، آزمون نصب
Windows و ساخت و آزمون macOS همچنان مستقل و لازم‌اند.
