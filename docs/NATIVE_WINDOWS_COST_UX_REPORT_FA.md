# گزارش ارزیابی نسخهٔ Native ویندوز برای راوی

**تاریخ ارزیابی:** ۱۲ مرداد ۱۴۰۵ / ۳ اوت ۲۰۲۶
**دامنه:** مقایسهٔ ادامهٔ Tauri 2 با نسخهٔ Native ویندوز، با تمرکز ویژه بر Mermaid سنگین، SVG/وکتور، روانی رابط، هزینهٔ توسعه و هزینهٔ نگه‌داری

## خلاصهٔ مدیریتی

نتیجهٔ اصلی این بررسی این است که **بازنویسی کامل راوی به Native ویندوز در وضعیت فعلی توجیه اقتصادی ندارد**؛ مگر اینکه ویندوز عملاً تنها پلتفرم محصول باشد، بارهای Mermaid بزرگ جزء سناریوی روزمره و درآمدزا باشند، و بودجهٔ حداقل **۱۸ تا ۳۰ نفرـماه** برای رسیدن دوباره به برابری امکانات موجود فراهم باشد.

Native شدن پوسته به‌تنهایی مشکل Mermaid را حل نمی‌کند. Tauri در ویندوز از WebView2 استفاده می‌کند و Mermaid نیز یک کتابخانهٔ JavaScript است که layout را محاسبه و SVG تولید می‌کند. اگر یک برنامهٔ WinUI 3 یا WPF همچنان Mermaid را در WebView2 اجرا و همان SVG را در همان موتور نمایش دهد، بهبود رندر سنگین معمولاً **صفر تا ۱۰ درصد** خواهد بود؛ در عوض هزینهٔ مهاجرت و ریسک رگرسیون بالا می‌رود.

بهبود جدی زمانی رخ می‌دهد که **مسیر رندر** تغییر کند، نه فقط پوسته:

1. محاسبهٔ Mermaid از thread رابط جدا شود؛
2. صف رندر قابلیت لغو و اولویت‌بندی داشته باشد؛
3. SVGهای خارج از viewport از DOM خارج شوند؛
4. نمودار بزرگ به‌صورت image/scene یا canvas رسم شود، نه هزاران node در DOM؛
5. pan و zoom بدون render مجدد React در هر حرکت pointer انجام شود؛
6. برای نمودارهای بسیار بزرگ، LOD، tile و حالت preview کم‌هزینه وجود داشته باشد.

بخش بزرگی از این اصلاحات در Tauri فعلی قابل انجام است. برآورد می‌شود یک برنامهٔ هدفمند **۳ تا ۵ نفرـماه** برای بهینه‌سازی Tauri بتواند ۶۰ تا ۸۵ درصد مسئلهٔ ادراک‌شدهٔ «قفل‌شدن رابط» را برطرف کند. یک راهکار Hybrid Native حدود **۹ تا ۱۶ نفرـماه** و بازنویسی Native با برابری امکانات حدود **۱۸ تا ۳۰ نفرـماه** هزینه دارد. بازنویسی خود موتور Mermaid و layout به Native، دامنه را به حدود **۳۰ تا ۵۵ نفرـماه** می‌رساند و همچنان ریسک ناسازگاری با syntaxهای Mermaid را دارد.

### پاسخ کوتاه به دو سؤال اصلی

| سؤال | پاسخ برآوردی |
|---|---|
| Native کامل هزینهٔ ساخت همین محصول را نسبت به ساخت دوباره با Tauri چقدر بالا می‌برد؟ | حدود **۷۰ تا ۱۲۰٪** در سناریوی greenfield با feature parity یکسان |
| تصمیم Native از وضعیت فعلی، نسبت به بهینه‌سازی محصول موجود، چقدر سرمایهٔ بیشتری می‌خواهد؟ | حدود **۴ تا ۷ برابر**؛ ۱۸–۳۰ نفرـماه در برابر ۳–۵ نفرـماه |
| اگر نسخهٔ وب/Tauri نیز نگه داشته شود، هزینهٔ جاری تیم چقدر بالا می‌رود؟ | حدود **۳۵ تا ۷۰٪** در کل مهندسی محصول و **۷۰ تا ۱۲۰٪** در کارهای UI مشترک |
| Native shell با WebView2 فعلی تجربه را چقدر بهتر می‌کند؟ | معمولاً **۵ تا ۱۵٪** در حس عمومی و **۰ تا ۱۰٪** در Mermaid سنگین |
| Native UI همراه با renderer جدا و canvas واقعی چقدر بهتر می‌شود؟ | حدود **۲۰ تا ۴۵٪** در حس عمومی؛ کاهش **۶۰ تا ۹۰٪** قفل‌شدن رابط؛ pan/zoom بالقوه **۲ تا ۵ برابر** روان‌تر |
| آیا اعداد performance تضمین‌شده‌اند؟ | خیر؛ بازه‌های مهندسی هستند و باید با prototype و benchmark روی سخت‌افزار هدف تثبیت شوند |

## وضعیت فعلی راوی و علت پرهزینه‌بودن بازنویسی

این ارزیابی بر یک پروژهٔ ساده یا پوستهٔ خالی بنا نشده است. ممیزی مخزن فعلی نشان می‌دهد:

- حدود **۱۸٬۴۱۷ خط** TypeScript/React در ۲۶ فایل اصلی برنامه؛
- حدود **۸٬۹۱۱ خط CSS**؛
- حدود **۵٬۱۴۴ خط تست** TypeScript/Playwright؛
- حدود **۹۲۶ خط Rust** در backend نسخهٔ Tauri؛
- `app/page.tsx` به‌تنهایی حدود ۸٬۷۰۹ خط و `app/globals.css` حدود ۸٬۹۱۱ خط است؛
- زیرسامانهٔ Mermaid شامل renderer، سازگارساز فارسی، viewport، استودیو، فرم ساده و مدل ۲۹ نوع نمودار است؛
- خروجی واقعی نسخهٔ 1.3.1 شامل installer حدود **۳٫۵۲ MB** و executable قابل‌حمل حدود **۱۱٫۲۴ MB** است.

امکاناتی که در مهاجرت باید دوباره پیاده و آزمون شوند فقط ظاهر پنجره نیستند: ویرایش CodeMirror و فرمان‌های صفحه‌کلید، پیش‌نمایش Markdown، RTL/LTR و BiDi فارسی، annotation، حالت مطالعه و بازیابی موقعیت، کتابخانه و تاریخچه، مدیریت فایل و association، حالت dark/light، استودیو Mermaid، سازگارسازی فارسی، sanitizer امنیتی SVG، zoom/pan/fullscreen، تست‌های دسترس‌پذیری و رفتارهای چندلایهٔ modal.

در یک مهاجرت Native، بخش عمدهٔ CSS/React قابل استفادهٔ مستقیم نیست. قواعد محصول و نمونه‌های تست قابل انتقال‌اند، اما UI، binding، focus، keyboard، automation و بخش مهمی از تست‌های end-to-end باید بازنویسی شوند. بنابراین «درصد reuse کد» برای Native کامل احتمالاً فقط **۱۰ تا ۲۵٪** است؛ reuse دانش محصول بالاتر، اما reuse اجرایی پایین است.

## تشخیص گلوگاه Mermaid در معماری فعلی

مسیر فعلی تقریباً چنین است:

`Mermaid source → Persian adapter → mermaid.parse → mermaid.render → SVG string → sanitizer → innerHTML → SVG DOM → CSS transform`

در این مسیر چند نقطهٔ فشار دیده می‌شود:

### ۱. صف سری و مشکل head-of-line blocking

در `app/mermaid/renderer.ts` یک `renderQueue` سراسری وجود دارد و همهٔ نمودارها پشت سر هم پردازش می‌شوند. این طراحی جلوی تداخل Mermaid را می‌گیرد، اما یک نمودار سنگین تمام درخواست‌های بعدی را معطل می‌کند. درخواست تازه‌تر، نمودار visible یا کاری که کاربر اکنون ویرایش می‌کند اولویت ویژه ندارد.

### ۲. timeout فعلی محاسبه را واقعاً متوقف نمی‌کند

مهلت ۵ ثانیه promise کاربر را reject می‌کند، اما کار `mermaid.render` زیرین لغو نمی‌شود و صف نیز تا پایان همان محاسبه اشغال می‌ماند. در نتیجه پیام «timeout» لزوماً به معنی آزادشدن CPU یا thread رابط نیست. این یکی از مهم‌ترین نقاط اصلاح فوری است.

### ۳. تولید و نگه‌داری SVG به‌صورت DOM

خروجی sanitizer با `dangerouslySetInnerHTML` وارد DOM می‌شود. یک نمودار بزرگ می‌تواند هزاران `path`، `text`، `tspan`، marker و group بسازد. مرورگر علاوه بر حافظهٔ رشتهٔ SVG، هزینهٔ parse XML/HTML، style، layout، paint، hit testing و نگه‌داری tree را می‌پردازد.

برای نموداری که تعامل node-level ندارد، نمایش همان SVG با `<img>` یا یک scene/canvas می‌تواند tree داخلی را از DOM برنامه حذف کند و هزینهٔ React/DOM را به‌طور محسوسی کاهش دهد، در حالی‌که کیفیت وکتور در حالت SVG image حفظ می‌شود.

### ۴. lazy render محدود است، اما unloading وجود ندارد

در حالت مطالعه، `IntersectionObserver` رندر را تا نزدیک‌شدن نمودار به viewport عقب می‌اندازد. این اقدام درست است؛ با این حال پس از رندر، نمودارهای دورشده از viewport همچنان در DOM می‌مانند. در نمای غیرمطالعه نیز رندر بلافاصله درخواست می‌شود. برای سندی با ده‌ها نمودار بزرگ، حافظه و scene complexity به‌تدریج جمع می‌شود.

### ۵. cache بر اساس تعداد entry است، نه بودجهٔ حافظه

دو cache مستقل، هرکدام با سقف ۸۰ خروجی SVG، وجود دارد. یک entry کوچک و یک SVG چندمگابایتی وزن یکسان دارند. علاوه بر رشته‌های cache، نسخهٔ parseشده در DOM نیز وجود دارد. cache باید بر پایهٔ byte budget، complexity و recency مدیریت شود.

### ۶. pan/zoom از state React عبور می‌کند

در `use-mermaid-viewport.ts` هر `pointermove` باعث `setState` و render مجدد component می‌شود. CSS transform و compositing انتخاب خوبی است، اما قرارگرفتن React در مسیر هر frame برای نمودار سنگین overhead قابل اجتناب ایجاد می‌کند. transform باید با `requestAnimationFrame` مستقیماً روی element اعمال و state نمایشی با نرخ پایین‌تری sync شود.

### ۷. معیار محدودیت با پیچیدگی واقعی هم‌بستگی کامل ندارد

سقف ۴۰ هزار نویسه و ۱۰۰۰ خط از ورودی‌های بسیار بزرگ جلوگیری می‌کند، اما زمان layout بیشتر به تعداد node/edge، نوع نمودار، عمق، crossing و الگوریتم layout وابسته است. یک نمودار کوتاه ولی dense ممکن است بسیار گران‌تر از یک متن بلند ساده باشد.

### ۸. parse جداگانه قبل از render باید profile شود

کد ابتدا `mermaid.parse` و سپس `mermaid.render` را صدا می‌زند. با توجه به اینکه render نیز باید نمودار را تفسیر کند، احتمال کار تکراری وجود دارد. این مورد باید روی Mermaid 11.16 با profiler یا بررسی سورس همان نسخه تأیید شود و سپس مسیر validate/render یکی شود.

## Native دقیقاً کدام بخش را بهتر می‌کند؟

لازم است چهار سطح متفاوت از «Native» تفکیک شوند.

### سطح A — Native shell، همان React و WebView2

در این مدل Tauri با WinUI 3/WPF عوض می‌شود، اما صفحهٔ اصلی React داخل WebView2 باقی می‌ماند.

**بهبود محتمل:** integration بهتر با window chrome، tray، dialog، file picker، accessibility پوسته و splash سریع‌تر.
**اثر بر Mermaid:** تقریباً هیچ؛ موتور JavaScript، renderer Chromium و SVG DOM همان‌ها هستند.
**نتیجه:** هزینه بدون رفع مسئلهٔ اصلی؛ توصیه نمی‌شود.

### سطح B — پوسته و بخش‌های فهرستی Native، editor/Mermaid در WebView2

کتابخانه، تنظیمات، dialogها و navigation Native می‌شوند؛ CodeMirror و Mermaid در WebView2 می‌مانند.

**بهبود محتمل:** startup ادراک‌شده بهتر، focus و keyboard طبیعی‌تر، مصرف کمتر در screenهای بدون WebView.
**اثر بر Mermaid:** اگر renderer در همان WebView باشد کم؛ اگر WebView/renderer مستقل باشد، freeze رابط می‌تواند شدیداً کمتر شود.
**ریسک:** مرزهای متعدد IPC، sync انتخاب متن، theme، clipboard، focus و accessibility.

### سطح C — Native UI و native vector viewer؛ Mermaid.js فقط generator

Mermaid source در یک process یا WebView پشتیبان به SVG/layout تبدیل می‌شود، اما نمایش و تعامل با نمودار در یک canvas مبتنی بر Win2D/Direct2D یا visual tree فشرده انجام می‌شود.

**بهبود محتمل:** رابط هنگام layout responsive می‌ماند؛ pan/zoom و hit testing قابل کنترل و سریع‌تر می‌شود؛ LOD و tile قابل پیاده‌سازی است.
**محدودیت:** زمان تولید اولیهٔ layout تا وقتی Mermaid.js حفظ شده فقط اندکی بهتر می‌شود؛ مزیت بزرگ در isolation و نمایش است.
**نتیجه:** اگر Native لازم شود، این متعادل‌ترین معماری است.

### سطح D — parser، layout و renderer کاملاً Native

در این مدل syntaxهای Mermaid در C#/C++/Rust parse و layout می‌شوند و خروجی با Direct2D/Win2D رسم می‌شود.

**بهبود بالقوه:** کنترل کامل بر multi-threading، memory، LOD، tile و GPU.
**هزینه:** بسیار زیاد. Mermaid فقط flowchart نیست؛ راوی اکنون ۲۹ نوع نمودار، syntaxهای آزمایشی، تم، فارسی، accessibility و edge caseهای متعدد را پوشش می‌دهد. رسیدن به parity و دنبال‌کردن نسخه‌های بعدی Mermaid خود یک محصول مستقل است.
**نتیجه:** توصیه نمی‌شود، مگر اینکه «موتور نمودار» به محصول اصلی و مستقل شرکت تبدیل شود.

## برآورد هزینه و زمان

واحد اصلی این گزارش **نفرـماه (Person-Month)** است. برای تبدیل به پول، عدد جدول را در هزینهٔ ترکیبی ماهانهٔ یک مهندس شامل حقوق، بیمه، مدیریت، QA، ابزار و سربار ضرب کنید. برای نمونه اگر این عدد `R` باشد، هزینهٔ ۱۸ تا ۳۰ نفرـماه برابر `18R` تا `30R` است.

| سناریو | effort | زمان تقویمی واقع‌بینانه | reuse اجرایی | ریسک |
|---|---:|---:|---:|---|
| بهینه‌سازی عمیق Tauri فعلی | ۳–۵ نفرـماه | ۶–۱۰ هفته با ۲ مهندس | بیش از ۹۰٪ | کم تا متوسط |
| Native shell با React/WebView موجود | ۳–۶ نفرـماه | ۲–۴ ماه | ۸۵–۹۵٪ | متوسط؛ ارزش کم |
| Hybrid Native با renderer جدا و native canvas | ۹–۱۶ نفرـماه | ۵–۸ ماه | ۳۵–۵۵٪ | متوسط تا زیاد |
| Native کامل UI با Mermaid.js پشتیبان | ۱۸–۳۰ نفرـماه | ۸–۱۴ ماه | ۱۰–۲۵٪ | زیاد |
| Native کامل به‌علاوهٔ موتور Mermaid بومی | ۳۰–۵۵ نفرـماه | ۱۲–۲۴ ماه | کمتر از ۱۵٪ | بسیار زیاد |

### شکستن effort نسخهٔ Native کامل

| جریان کار | نفرـماه |
|---|---:|
| معماری، prototype و design system Native | ۱–۲ |
| windowing، lifecycle، single-instance، file association و installer | ۱٫۵–۲٫۵ |
| editor، selection، undo/redo، search و command system | ۳–۵ |
| Markdown، RTL/BiDi، typography، preview و export | ۳–۵ |
| کتابخانه، نسخه‌ها، annotation و reading continuity | ۳–۵ |
| استودیو و فرم‌های Mermaid و سازگارسازی فارسی | ۳–۵ |
| renderer جدا، native vector scene، pan/zoom و cache | ۳–۶ |
| accessibility، migration، telemetry، تست و performance QA | ۳–۵ |
| **جمع با هم‌پوشانی کارها** | **۱۸–۳۰** |

این بازه برای تیمی است که هم React/Tauri فعلی را می‌شناسد و هم حداقل یک عضو باتجربه در C#/.NET و XAML/graphics دارد. نبود تجربهٔ Native، کار تک‌نفره یا الزام feature freeze نداشتن می‌تواند ۲۵ تا ۵۰ درصد به زمان تقویمی اضافه کند.

## برآورد اثر بر تجربهٔ کاربری

اعداد زیر «فرضیهٔ benchmark» هستند، نه نتیجهٔ تست A/B نسخه‌ای که هنوز ساخته نشده است.

| شاخص | Tauri بهینه | Native shell فقط | Hybrid/native canvas | Native کامل |
|---|---:|---:|---:|---:|
| cold start نسبت به امروز | ۱۵–۳۵٪ بهتر | ۱۰–۲۵٪ بهتر | ۲۰–۴۵٪ بهتر | ۳۰–۶۰٪ بهتر |
| idle memory نسبت به امروز | ۱۰–۳۰٪ کمتر | ۰–۱۵٪ کمتر | ۲۰–۴۵٪ کمتر | ۳۰–۶۰٪ کمتر |
| زمان خام تولید Mermaid | ۲۰–۴۵٪ بهتر | ۰–۱۰٪ بهتر | ۰–۲۵٪ بهتر | ۰–۳۰٪ بهتر، اگر Mermaid.js بماند |
| قفل‌شدن UI هنگام رندر | ۶۰–۸۵٪ کمتر | ۰–۱۵٪ کمتر | ۶۰–۹۰٪ کمتر | ۷۰–۹۵٪ کمتر |
| pan/zoom نمودار بزرگ | ۴۰–۷۵٪ بهتر | ۰–۱۰٪ بهتر | ۲–۵ برابر ظرفیت بیشتر | ۲–۵ برابر ظرفیت بیشتر |
| حس Native ویندوز، focus و integration | اندکی بهتر | ۱۵–۳۰٪ بهتر | ۲۵–۵۰٪ بهتر | ۳۵–۶۰٪ بهتر |

دو نکته در تفسیر جدول مهم‌اند:

1. **زمان خام layout** با عوض‌کردن shell معجزه نمی‌کند. اگر Mermaid.js همان کد را اجرا کند، CPU work تقریباً همان است؛ مزیت isolation این است که کاربر دیگر هزینه را به‌صورت freeze کل برنامه حس نمی‌کند.
2. **روانی تعامل وکتور** می‌تواند واقعاً بهتر شود، به شرط آنکه viewer Native یک scene فشرده، drawing command یا tile باشد. اگر هر node نمودار به یک XAML control جدا تبدیل شود، Native نیز با visual tree بزرگ دچار افت خواهد شد.

## مزایای واقعی Native برای راوی

- startup و first paint بدون هزینهٔ بالا آمدن UI کامل WebView2؛
- رفتار طبیعی‌تر پنجره، DPI، focus، keyboard، drag/drop، file picker و accessibility؛
- virtualized listهای Native برای کتابخانه و تاریخچه؛
- امکان renderer thread/process مستقل با crash containment روشن؛
- canvas مبتنی بر GPU و کنترل مستقیم بر LOD، tile، hit testing و memory budget؛
- integration بهتر با Windows App SDK برای lifecycle، notification، windowing و deployment؛
- امکان UI Automation دقیق‌تر برای کنترل‌های استاندارد.

## هزینه‌ها و معایب پنهان Native

- از دست‌رفتن اشتراک مستقیم UI میان وب، Electron/Tauri و Windows؛
- دو design system و دو مسیر bug fix در صورت باقی‌ماندن نسخهٔ وب؛
- دشواری بازسازی editor در حد CodeMirror، به‌خصوص selection، IME فارسی، syntax highlighting و متن‌های طولانی؛
- نبود renderer بومی Mermaid با parity کامل؛
- نیاز به تست جداگانهٔ DPI، چند نمایشگر، touch، pen، IME، high contrast و accessibility؛
- پیچیدگی deployment در WinUI 3: انتخاب framework-dependent یا self-contained، امضای کد و update؛
- احتمال بزرگ‌ترشدن بستهٔ self-contained نسبت به installer فعلی ۳٫۵ MB؛
- افزایش هزینهٔ استخدام و bus factor اگر تیم فعلی عمدتاً TypeScript/Rust باشد؛
- دورهٔ طولانی feature freeze یا توسعهٔ موازی و خطر واگرایی دو محصول.

## انتخاب تکنولوژی در صورت تصمیم Native

### پیشنهاد اول: C# + WinUI 3 + Win2D

برای یک محصول جدید و Windows-first، WinUI 3 انتخاب رسمی مایکروسافت برای Native desktop است و Windows App SDK روی Windows 10 نسخهٔ 1809 به بعد قابل استفاده است. برای نمودار، استفاده از Win2D/Direct2D به‌صورت custom canvas مناسب‌تر از ساخت هزاران XAML element است.

این stack برای ظاهر مدرن، touch، DPI، windowing و آیندهٔ Windows مناسب است؛ اما تیم باید deployment Windows App SDK و جزئیات کنترل custom graphics را بپذیرد.

### گزینهٔ کم‌ریسک‌تر اجرایی: C# + WPF

WPF بالغ‌تر است، rendering وکتوری retained-mode دارد و ecosystem دسکتاپی آن برای editor و document UI شناخته‌شده‌تر است. برای راوی که editor و سند پیچیده دارد، ممکن است زمان رسیدن به feature parity را کمتر کند. در عوض ظاهر Fluent مدرن به styling بیشتری نیاز دارد و WPF انتخاب مدرن اصلی مایکروسافت برای پروژهٔ جدید نیست.

اگر معیار اصلی «کمترین ریسک مهاجرت وکتور/editor» باشد WPF ارزش prototype دارد؛ اگر معیار «تجربهٔ مدرن Windows و سرمایه‌گذاری بلندمدت» باشد WinUI 3 مقدم است.

### C++/Win32/Direct2D

فقط زمانی توجیه دارد که prototype C#/Win2D نتواند KPIهای performance را برآورده کند. این مسیر احتمالاً ۳۰ تا ۶۰ درصد effort بیشتری نسبت به C# Native می‌خواهد و هزینهٔ ownership را بالا می‌برد.

## معماری پیشنهادی، اگر Hybrid یا Native انتخاب شود

1. **Document model مستقل از UI:** فایل `.md`/`.ravi`، annotation و revision در یک core قابل تست نگه داشته شود.
2. **Mermaid source مرجع اصلی بماند:** خروجی SVG یا scene cache است و نباید جای source را بگیرد.
3. **Renderer service جدا:** generation در process/WebView مستقل با cancellation، timeout واقعی، memory cap و restart انجام شود.
4. **Priority queue:** نمودار visible و preview جاری بالاتر از prefetch قرار گیرد؛ درخواست قدیمی هنگام edit لغو شود.
5. **Native viewer:** scene یک‌بار parse و flatten شود؛ pan/zoom با matrix، drawing مستقیم و spatial index انجام شود.
6. **Adaptive representation:** inline کوچک SVG/image؛ نمودار بزرگ preview کم‌جزئیات؛ fullscreen scene کامل؛ export همچنان SVG باکیفیت.
7. **Bounded caches:** cache بر پایهٔ bytes، node count و GPU budget باشد، نه فقط تعداد entry.
8. **Crash isolation:** خرابی renderer نباید سند یا shell را ببندد؛ آخرین خروجی معتبر نمایش داده شود.
9. **Telemetry محلی و privacy-safe:** زمان parse/layout/sanitize/display و peak memory جداگانه اندازه‌گیری شود.

## برنامهٔ پیشنهادی پیش از هر بازنویسی

### فاز صفر — baseline قابل اعتماد، ۱ تا ۲ هفته

چهار dataset ثابت بسازید:

- کوچک: کمتر از ۱۰۰ node/edge؛
- متوسط: ۱۰۰ تا ۳۰۰؛
- بزرگ: ۳۰۰ تا ۸۰۰؛
- extreme: بیش از ۸۰۰ یا چند نمودار بزرگ در یک سند.

روی حداقل سه سطح سخت‌افزار Windows 10/11 این KPIها ثبت شوند:

- cold start و time-to-editable؛
- زمان parse، layout، sanitize و DOM/display به‌صورت جدا؛
- P50/P95 input latency هنگام رندر؛
- longest main-thread task؛
- FPS و frame time در pan/zoom؛
- working set، private bytes و GPU memory؛
- زمان بازشدن سند ۸، ۲۰ و ۵۰ نموداری؛
- تعداد timeout، crash و recovery.

### فاز یک — اصلاح مسیر فعلی Tauri، ۶ تا ۱۰ هفته

اولویت‌ها:

1. renderer مستقل یا process/WebView جدا؛
2. timeout و cancellation واقعی با kill/restart renderer؛
3. priority queue و حذف درخواست‌های superseded؛
4. نمایش SVG غیرتعاملی با image/blob و نه DOM داخلی؛
5. virtualization و unload نمودارهای دور از viewport؛
6. cache بر پایهٔ byte budget؛
7. pan/zoom مستقیم با `requestAnimationFrame` و خارج از render React؛
8. node/edge complexity guard و حالت preview برای extreme؛
9. profile کردن parse+render و حذف کار تکراری؛
10. prefetch کنترل‌شده فقط در زمان idle.

### فاز دو — spike مقایسه‌ای Native، ۲ تا ۳ هفته

یک prototype عمودی بسازید، نه کل برنامه:

- یک نمودار بزرگ ثابت؛
- همان خروجی در WebView SVG DOM، SVG image و Win2D canvas؛
- pan/zoom، text Persian، DPI 100/150/200٪ و dark mode؛
- اندازه‌گیری CPU، memory، P95 frame time و fidelity؛
- یک editor کوچک یا bridge با CodeMirror برای سنجش IME/focus.

Native فقط زمانی وارد roadmap اصلی شود که prototype حداقل یکی از این تفاوت‌های پایدار را نشان دهد:

- حداقل **۲ برابر** ظرفیت pan/zoom در P95؛
- حداقل **۴۰٪** کاهش working set در workload هدف؛
- P95 input latency زیر **۱۰۰ ms** در زمان رندر سنگین، در حالی‌که Tauri بهینه از آن عبور می‌کند؛
- یا وجود یک الزام تجاری Windows-only که با Tauri قابل رفع نیست.

## معیار Go/No-Go برای Native

### Go، اگر بیشتر این شروط برقرار باشند

- بیش از ۸۰٪ کاربران و درآمد آینده روی Windows هستند؛
- cross-platform/web دیگر مزیت راهبردی نیست یا تیم جدا دارد؛
- نمودارهای ۳۰۰ تا ۸۰۰ گره‌ای سناریوی روزمره‌اند، نه edge case؛
- پس از فاز بهینه‌سازی، KPIهای latency/FPS هنوز رد می‌شوند؛
- بودجهٔ ۱۸–۳۰ نفرـماه و حداقل ۲۰٪ contingency موجود است؛
- تیم حداقل یک متخصص .NET/XAML/graphics دارد؛
- محصول افق نگه‌داری بیش از سه سال دارد.

### No-Go، اگر هرکدام از این شرایط مهم باشد

- مشکل عمدتاً freeze هنگام `mermaid.render` است و هنوز renderer جدا آزمایش نشده؛
- نسخهٔ وب و دسکتاپ باید با یک تیم کوچک هم‌زمان توسعه یابند؛
- بیشتر اسناد کمتر از ۱۰۰ node در هر نمودار دارند؛
- زمان ورود قابلیت‌های جدید مهم‌تر از integration عمیق Windows است؛
- هدف فقط «حس Native» یا کم‌کردن installer است؛ Tauri فعلی از نظر اندازه همین حالا بسیار رقابتی است.

## ماتریس تصمیم پیشنهادی

امتیاز ۱ ضعیف و ۵ قوی است.

| معیار | وزن | Tauri بهینه | Hybrid Native | Native کامل |
|---|---:|---:|---:|---:|
| حل freeze و Mermaid سنگین | ۳۰٪ | ۴٫۰ | ۴٫۵ | ۴٫۷ |
| هزینه و زمان تحویل | ۲۵٪ | ۵٫۰ | ۲٫۸ | ۱٫۵ |
| حفظ feature parity | ۱۵٪ | ۵٫۰ | ۳٫۵ | ۲٫۵ |
| تجربه و integration ویندوز | ۱۵٪ | ۳٫۰ | ۴٫۳ | ۵٫۰ |
| نگه‌داری و اشتراک با وب | ۱۵٪ | ۵٫۰ | ۲٫۸ | ۱٫۵ |
| **امتیاز وزنی** | **۱۰۰٪** | **۴٫۴۵** | **۳٫۶۸** | **۳٫۰۹** |

## تصمیم نهایی پیشنهادی

1. **اکنون بازنویسی کامل Native آغاز نشود.**
2. ابتدا فاز baseline و بهینه‌سازی Tauri با بودجهٔ ۳ تا ۵ نفرـماه اجرا شود.
3. هم‌زمان فقط یک spike محدود WinUI 3/Win2D یا WPF/DrawingVisual برای viewer سنگین ساخته شود.
4. اگر KPIها پس از بهینه‌سازی هنوز شکست خوردند، به مسیر **Hybrid Native با Mermaid.js به‌عنوان generator و native canvas به‌عنوان viewer** بروید.
5. بازنویسی parser/layout Mermaid به Native از scope خارج بماند، مگر اینکه موتور نمودار به یک محصول مستقل تبدیل شود.

به زبان اقتصادی: Native کامل احتمالاً بهترین تجربهٔ نهایی Windows را می‌سازد، اما برای مشکل فعلی Mermaid **گران‌ترین راهِ رسیدن به بهبودهایی است که بخش عمده‌شان در معماری موجود قابل دستیابی‌اند**. تصمیم منطقی فعلی «بهینه‌سازی و اندازه‌گیری، سپس Native مشروط» است.

## منابع رسمی

- [معماری Tauri و استفاده از HTML در WebView همراه Rust](https://v2.tauri.app/concept/architecture/)
- [گزینه‌های نصب WebView2 در Tauri ویندوز](https://v2.tauri.app/distribute/windows-installer/)
- [مدل چندپردازهٔ WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/process-model)
- [راهنمای رسمی performance در WebView2](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/performance)
- [Windows App SDK و WinUI برای برنامه‌های Native ویندوز](https://learn.microsoft.com/en-us/windows/apps/windows-app-sdk/)
- [راهنمای انتخاب framework ویندوز](https://learn.microsoft.com/en-us/windows/apps/)
- [گرافیک Windows و Win2D مبتنی بر GPU](https://learn.microsoft.com/en-us/windows/apps/develop/graphics)
- [WPF و موتور وکتوری resolution-independent](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/overview/)
- [مرور معماری وکتوری WPF](https://learn.microsoft.com/en-us/dotnet/desktop/wpf/graphics-multimedia/wpf-graphics-rendering-overview)
- [مدل‌های deployment در Windows App SDK](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/)
- [API رسمی Mermaid و تولید خروجی SVG](https://mermaid.js.org/config/usage.html)

## محدودیت‌های این برآورد

- benchmark مستقیم یک implementation Native انجام نشده؛ اعداد performance باید با spike تثبیت شوند.
- هزینهٔ نفرـماه به مهارت تیم، کیفیت مورد انتظار، نیاز به ادامهٔ نسخهٔ وب و سطح parity وابسته است.
- شمارش خطوط کد شاخص کامل پیچیدگی نیست؛ فقط برای تعیین مرتبهٔ دامنه استفاده شده است.
- تغییر نسخهٔ Mermaid، Windows App SDK یا WebView2 می‌تواند بخشی از نتایج را تغییر دهد؛ به همین دلیل تصمیم نهایی باید به KPI و prototype متصل بماند.
