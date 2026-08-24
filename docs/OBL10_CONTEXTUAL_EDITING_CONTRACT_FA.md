# قرارداد OBL-10 — ابزار ویرایش contextual راوی

## تصمیم محصول

راوی یک میز تک‌سندی می‌ماند. قدرت Markdown به جای ردیف ۱۸ آیکنی در سه فاصله از متن توزیع می‌شود: هفت عمل روزمره در نوار ثابت، عمل‌های وابسته به selection یا خط در منوی نزدیک، و فرمان‌های کم‌تکرار در «بیشتر»، Palette و slash command. این معماری از فشردگی Obsidian الهام می‌گیرد اما ظاهر IDE، افزونه‌پذیری عمومی یا چندسندی را وارد راوی نمی‌کند.

## سطح‌های دسترسی

| سطح | وظیفه | فرمان‌ها |
|---|---|---|
| نوار ثابت | کارهای روزمره | تیتر، پررنگ، مورب، پیوند، فهرست، کار، بیشتر |
| selection | تغییر متن انتخابی | پررنگ، مورب، یادداشت، پیوند |
| خط فعال | تبدیل block | تیتر، فهرست، کار، شماره‌ای، نقل‌قول، کد، Callout، جدول، تصویر، Mermaid |
| بیشتر | capability کامل و گروه‌بندی‌شده | ساختار، ویرایش و نما |
| Palette و `/` | مسیر keyboard-first | همان Command IDها با جست‌وجوی فارسی/انگلیسی |

هیچ مسیر بالا handler اختصاصی ندارد. `command-registry` نام، توضیح، alias، آیکن و availability را مالک است و `page.tsx` فقط handlerهای واحد را به transactionهای CodeMirror متصل می‌کند.

## قرارداد داده و history

- Markdown تنها منبع حقیقت است.
- درج و قالب‌بندی با `replaceRange` و transaction CodeMirror انجام می‌شود.
- انتخاب چندخطی دقیقاً یک history event می‌سازد و undo/redo همان source را بازیابی می‌کند.
- active state درون‌خطی از syntax tree و نوع block از syntax/context خط فعال استخراج می‌شود.
- helper، widget و popover حق فراخوانی مستقیم `setContent` برای تغییر ویرایشی ندارند.

## تعامل و دسترس‌پذیری

- نوار ثابت بیش از هفت دکمه ندارد.
- هر کنترل نام فارسی و state غیررنگی (`aria-pressed` یا `aria-checked`) دارد.
- منوی خط و overflow با keyboard قابل پیمایش‌اند؛ Escape می‌بندد و focus را برمی‌گرداند.
- popoverهای link/table/image non-modal هستند، نخستین فیلد را focus می‌کنند و با کلیک بیرون یا Escape بسته می‌شوند.
- در touch، target همهٔ مسیرهای اصلی حداقل ۴۴×۴۴px است.
- جای منوی selection و block به مرز pane clamp می‌شود و در عرض کوچک helper به sheet پایین صفحه تبدیل می‌شود.

## helperهای سبک

- **پیوند:** URL امن را می‌گیرد؛ متن انتخاب‌شده عنوان پیوند می‌شود.
- **جدول:** ۲ تا ۶ ستون و ۱ تا ۶ ردیف؛ خروجی GFM قابل‌حمل است.
- **تصویر:** فایل محلی `.ravi` یا URL مستقیم `http/https`؛ خطا در همان popover و قابل اقدام نمایش داده می‌شود.

## آزمون پذیرش

تست واحد context نحوی heading/emphasis/link/task/callout/table/Mermaid و fuzzy فارسی/انگلیسی را پوشش می‌دهد. Playwright تعداد هفت عمل، قالب‌بندی چندخطی و undo، درج پیوند، منوی خط، helperهای جدول/تصویر، slash فارسی/انگلیسی، Escape/focus restoration و target موبایل را می‌سنجد. corpus قبلی OBL-07 تا OBL-09 نیز باید بدون regression سبز بماند.
