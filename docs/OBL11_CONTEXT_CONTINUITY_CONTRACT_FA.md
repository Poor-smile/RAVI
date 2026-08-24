# قرارداد پیوستگی context در OBL-11

## اصل محصول

راوی یک سند فعال و سه سطح هماهنگ دارد: «ویرایش روان»، «متن خام» و «نمونه‌خوانی دوبرگی». «مطالعه» همان preview در chrome آرام‌تر است، نه renderer یا سندی جدا. تغییر سطح نباید cursor، selection، block در حال خواندن یا موقعیت معنایی کاربر را از بین ببرد.

## anchor مشترک

- مبنای اصلی جابه‌جایی `sourceOffset` ساختار Markdown است؛ درصد scroll فقط fallback سندهای فاقد block قابل نگاشت است.
- CodeMirror موقعیت block نزدیک ۴۲٪ viewport را به offset ابتدای خط تبدیل می‌کند.
- Preview روی heading، paragraph، list item، quote، code، table و blockهای progressive مقدار `data-source-offset` دارد.
- restore نزدیک‌ترین block را انتخاب می‌کند، offset دیداری آن نسبت به probe را نگه می‌دارد و سپس selection مستقل editor را بازمی‌گرداند.
- تغییر mode بدون edit حق ایجاد diff، transaction یا history entry ندارد.

## فهرست سند

فهرست فقط view «فهرست سند» در sidebar چپ است. Reading outline جدا، right sidebar یا preview دوم ممنوع است. انتخاب تیتر به surface فعال می‌رود: editor در حالت ویرایش، preview در نمونه‌خوانی/مطالعه؛ در split، selection متناظر editor نیز بدون ربودن focus به‌روز می‌شود.

در عرض کمتر از ۸۲۰px همین sidebar یک dialog modal با scrim است. main و topbar زیر آن inert هستند، focus داخل drawer محصور می‌شود، Escape/Back آن را می‌بندد و focus به trigger «فهرست» بازمی‌گردد. drawer هنگام ورود به Reading در موبایل بسته است.

## Reading chrome

سطح دائم Reading فقط نام فایل، فهرست، ابزار مطالعه و «بازگشت به میز» است. اندازهٔ متن و حاشیه‌ها در reveal «ابزار» قرار دارند. pane header و toolbar annotation در حالت عادی نمایش داده نمی‌شوند؛ composer انتخاب متن همچنان هنگام نیاز ظاهر می‌شود. پیام resume کوچک، غیرmodal و پس از ۸ ثانیه خودکار بسته می‌شود.

## حذف annotation

حذف annotation ابتدا soft-delete است. رکورد کامل، index، anchor خواندن و focus origin برای ۹ ثانیه نگهداری می‌شود. «واگرد» annotation را در index پیشین برمی‌گرداند، position را با anchor بازیابی و focus را به کارت بازسازی‌شده منتقل می‌کند. حذف یا واگرد حق پراندن viewport یا تغییر متن Markdown را ندارد.

## gate

- تغییر هر mode باید نزدیک همان block بماند.
- کلیک outline باید همان heading را در surface فعال focus کند.
- موبایل: drawer پیش‌فرض بسته، modal و focus-safe باشد و ابتدای viewport عمدتاً مقاله بماند.
- حذف/واگرد annotation باید scroll را در tolerance دو پیکسل حفظ کند.
- split resize، collapse و scroll sync موجود باید بدون regression بمانند.
