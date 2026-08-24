export type AiWritingCommandCategory =
  | "selection"
  | "document"
  | "persian"
  | "structured";

export type AiWritingCommand = {
  id: string;
  category: AiWritingCommandCategory;
  title: string;
  prompt: string;
  keywords: readonly string[];
};

export const AI_WRITING_COMMAND_CATEGORIES = {
  selection: {
    label: "کار روی متن انتخاب‌شده",
    icon: "text_fields",
  },
  document: {
    label: "بازبینی کل سند",
    icon: "fact_check",
  },
  persian: {
    label: "ویرایش تخصصی فارسی",
    icon: "spellcheck",
  },
  structured: {
    label: "ساختاردهی محتوا",
    icon: "account_tree",
  },
} as const;

const command = (
  id: string,
  category: AiWritingCommandCategory,
  title: string,
  prompt: string,
  keywords: readonly string[] = [],
): AiWritingCommand => ({ id, category, title, prompt, keywords });

export const AI_WRITING_COMMANDS: readonly AiWritingCommand[] = [
  command("selection.summary", "selection", "خلاصه‌سازی کوتاه، متوسط یا تفصیلی", "این محتوا را خلاصه کن. طول مناسب را با توجه به حجم و ساختار متن انتخاب کن.", ["خلاصه", "summary"]),
  command("selection.simplify", "selection", "ساده‌نویسی برای مخاطب عمومی", "این محتوا را برای مخاطب عمومی ساده، روشن و روان بازنویسی کن.", ["ساده", "روان"]),
  command("selection.tone", "selection", "رسمی یا دوستانه‌کردن لحن", "لحن این محتوا را متناسب با درخواست من رسمی‌تر یا دوستانه‌تر کن و معنا را حفظ کن.", ["لحن", "رسمی", "دوستانه"]),
  command("selection.proofread", "selection", "اصلاح املا، نگارش و نشانه‌گذاری فارسی", "املا، نگارش و نشانه‌گذاری فارسی این محتوا را اصلاح کن و معنای آن را تغییر نده.", ["غلط", "ویرایش", "نشانه"]),
  command("selection.normalize-glyphs", "selection", "اصلاح نیم‌فاصله و نویسه‌های عربی", "نیم‌فاصله‌ها و نویسه‌های عربی ی و ک را در این محتوا استاندارد کن.", ["نیم فاصله", "ی", "ک"]),
  command("selection.shorten", "selection", "حذف تکرار و کوتاه‌کردن متن", "تکرارها و عبارت‌های زائد را حذف کن و نسخه‌ای کوتاه‌تر با حفظ نکات اصلی بده.", ["کوتاه", "تکرار"]),
  command("selection.explain-terms", "selection", "توضیح اصطلاحات تخصصی", "اصطلاحات تخصصی این محتوا را شناسایی و به زبان ساده توضیح بده.", ["اصطلاح", "تخصصی"]),
  command("selection.translate", "selection", "ترجمهٔ فارسی و انگلیسی", "این محتوا را با حفظ لحن، اصطلاحات فنی و قالب‌بندی میان فارسی و انگلیسی ترجمه کن.", ["ترجمه", "translate"]),
  command("selection.key-points", "selection", "استخراج نکات کلیدی", "نکات کلیدی این محتوا را به‌صورت فهرستی کوتاه و دقیق استخراج کن.", ["نکته", "کلیدی"]),
  command("selection.entities", "selection", "استخراج ادعاها، اعداد، تاریخ‌ها و نام‌ها", "ادعاها، اعداد، تاریخ‌ها و نام‌های مهم این محتوا را دسته‌بندی و استخراج کن.", ["عدد", "تاریخ", "نام", "ادعا"]),
  command("selection.restructure", "selection", "تبدیل متن به فهرست، جدول یا چک‌لیست", "این محتوا را در مناسب‌ترین قالب میان فهرست، جدول یا چک‌لیست بازساخت کن.", ["فهرست", "جدول", "چک لیست"]),
  command("selection.headings", "selection", "ساخت عنوان و زیرعنوان", "برای این محتوا یک عنوان روشن و زیرعنوان‌های منظم و متناسب پیشنهاد بده.", ["عنوان", "زیرعنوان"]),
  command("selection.qa", "selection", "ساخت سؤال و جواب از متن", "از این محتوا مجموعه‌ای دقیق از سؤال و جواب بساز.", ["سوال", "جواب", "پرسش"]),
  command("selection.actions", "selection", "استخراج تصمیم‌ها و کارهای بعدی", "تصمیم‌ها، مسئولیت‌ها و کارهای بعدی را از این محتوا استخراج کن.", ["تصمیم", "اقدام", "کار بعدی"]),

  command("document.executive-summary", "document", "ساخت خلاصهٔ مدیریتی", "از کل سند یک خلاصهٔ مدیریتی کوتاه و تصمیم‌محور تهیه کن.", ["مدیریتی", "خلاصه"]),
  command("document.heading-structure", "document", "پیشنهاد ساختار بهتر برای عنوان‌ها", "ساختار عنوان‌ها و زیرعنوان‌های کل سند را بررسی و نسخهٔ منظم‌تری پیشنهاد کن.", ["ساختار", "عنوان"]),
  command("document.repetitions", "document", "شناسایی بخش‌های تکراری", "بخش‌های تکراری یا هم‌پوشان سند را مشخص کن و راه ادغام آن‌ها را پیشنهاد بده.", ["تکراری", "تکرار"]),
  command("document.contradictions", "document", "پیداکردن تناقض‌ها", "تناقض‌های درونی سند را با اشارهٔ روشن به بخش‌های درگیر پیدا کن.", ["تناقض", "ناسازگار"]),
  command("document.narrative-gaps", "document", "تشخیص پرش‌های روایی", "پرش‌های روایی و پیوندهای گمشده میان بخش‌های سند را شناسایی کن.", ["روایت", "پرش", "گسست"]),
  command("document.terminology", "document", "یکدست‌کردن اصطلاحات", "کاربرد اصطلاحات را در کل سند بررسی و موارد ناهماهنگ را برای یکدست‌سازی فهرست کن.", ["اصطلاح", "یکدست"]),
  command("document.ambiguity", "document", "شناسایی جمله‌های مبهم", "جمله‌های مبهم سند را مشخص کن و برای هرکدام بازنویسی روشن‌تری پیشنهاد بده.", ["مبهم", "ابهام"]),
  command("document.intro-conclusion", "document", "بررسی تطابق مقدمه و نتیجه‌گیری", "بررسی کن که مقدمه، بدنه و نتیجه‌گیری سند از نظر وعده و نتیجه با هم سازگار باشند.", ["مقدمه", "نتیجه"]),
  command("document.title", "document", "پیشنهاد عنوان مناسب", "با توجه به محتوای کامل سند چند عنوان دقیق و غیرشعاری پیشنهاد بده.", ["عنوان"]),
  command("document.toc", "document", "ساخت فهرست مطالب", "از ساختار فعلی سند یک فهرست مطالب منظم و قابل استفاده بساز.", ["فهرست مطالب"]),
  command("document.abstract-keywords", "document", "استخراج چکیده و کلیدواژه", "برای کل سند یک چکیده و مجموعه‌ای از کلیدواژه‌های دقیق تهیه کن.", ["چکیده", "کلیدواژه"]),
  command("document.reader-questions", "document", "تولید پرسش‌های احتمالی خواننده", "پرسش‌های مهمی را که ممکن است پس از خواندن سند برای مخاطب ایجاد شود استخراج کن.", ["خواننده", "پرسش"]),
  command("document.tables-lists", "document", "بررسی کیفیت جدول‌ها و فهرست‌ها", "جدول‌ها و فهرست‌های سند را از نظر وضوح، کامل‌بودن و قالب‌بندی بررسی کن.", ["جدول", "فهرست", "کیفیت"]),

  command("persian.yeh-kaf", "persian", "اصلاح ی و ک عربی", "تمام نویسه‌های ی و ک عربی را بدون تغییر بخش‌های کد به نویسه‌های استاندارد فارسی تبدیل کن.", ["عربی", "فارسی"]),
  command("persian.half-space", "persian", "مدیریت نیم‌فاصله", "نیم‌فاصله‌های این محتوا را طبق نگارش معیار فارسی اصلاح کن.", ["نیم فاصله"]),
  command("persian.mixed-direction", "persian", "جلوگیری از به‌هم‌ریختن متن ترکیبی", "چیدمان متن ترکیبی فارسی و انگلیسی را اصلاح کن تا خوانایی راست‌به‌چپ و چپ‌به‌راست حفظ شود.", ["راست به چپ", "انگلیسی"]),
  command("persian.protect-code", "persian", "نگه‌داشتن واژه‌های انگلیسی داخل کد", "ویرایش فارسی را انجام بده اما محتوای قطعه‌کد و واژه‌های انگلیسی داخل کد را تغییر نده.", ["کد", "code"]),
  command("persian.punctuation", "persian", "اصلاح جای نشانه‌ها کنار عبارات انگلیسی", "جای نشانه‌های نگارشی کنار عبارت‌های انگلیسی را در متن فارسی اصلاح کن.", ["نشانه", "انگلیسی"]),
  command("persian.digits", "persian", "یکسان‌سازی اعداد فارسی و انگلیسی", "شیوهٔ نمایش اعداد فارسی و انگلیسی را متناسب با بافت سند یکسان کن.", ["عدد", "رقم"]),
  command("persian.protect-technical", "persian", "حفظ قطعه‌کد، نشانی و نام فایل", "متن فارسی را ویرایش کن اما قطعه‌کدها، نشانی‌ها و نام فایل‌ها را دقیقاً حفظ کن.", ["آدرس", "فایل", "کد"]),
  command("persian.rtl-tables", "persian", "اصلاح جدول‌های راست‌به‌چپ", "جدول‌های فارسی را از نظر ترتیب ستون‌ها، جهت و خوانایی راست‌به‌چپ اصلاح کن.", ["جدول", "راست به چپ"]),
  command("persian.bilingual-terms", "persian", "پیشنهاد معادل فارسی همراه اصطلاح اصلی", "برای اصطلاحات تخصصی معادل فارسی پیشنهاد بده و اصطلاح اصلی را نیز در پرانتز حفظ کن.", ["معادل", "اصطلاح"]),

  command("structured.table", "structured", "تبدیل متن به جدول", "این محتوا را به یک جدول Markdown دقیق با ستون‌های مناسب تبدیل کن.", ["جدول", "table"]),
  command("structured.checklist", "structured", "تبدیل متن به چک‌لیست", "این محتوا را به یک چک‌لیست Markdown روشن و قابل اقدام تبدیل کن.", ["چک لیست", "وظیفه"]),
  command("structured.callout", "structured", "تبدیل متن به Callout", "این محتوا را به یک Callout کوتاه و برجسته با عنوان مناسب تبدیل کن.", ["کال اوت", "هشدار"]),
  command("structured.faq", "structured", "تبدیل متن به پرسش‌های متداول", "این محتوا را به مجموعهٔ پرسش‌های متداول و پاسخ‌های کوتاه تبدیل کن.", ["سوالات متداول", "faq"]),
  command("structured.minutes", "structured", "تبدیل متن به صورت‌جلسه", "این محتوا را به صورت‌جلسه‌ای شامل موضوع، حاضران، تصمیم‌ها و اقدام‌های بعدی تبدیل کن.", ["جلسه", "صورت جلسه"]),
  command("structured.report", "structured", "تبدیل متن به گزارش", "این محتوا را به گزارشی ساختاریافته با خلاصه، یافته‌ها و نتیجه تبدیل کن.", ["گزارش"]),
  command("structured.steps", "structured", "تبدیل متن به راهنمای مرحله‌ای", "این محتوا را به راهنمای مرحله‌به‌مرحلهٔ واضح و قابل اجرا تبدیل کن.", ["راهنما", "مرحله"]),
  command("structured.daily-note", "structured", "تبدیل متن به یادداشت روزانه", "این محتوا را به یادداشت روزانه‌ای منظم با تاریخ، نکات و پیگیری‌ها تبدیل کن.", ["روزانه", "یادداشت"]),
  command("structured.project-plan", "structured", "تبدیل متن به برنامهٔ پروژه", "این محتوا را به برنامهٔ پروژه شامل هدف، مراحل، مسئولیت‌ها و خروجی‌ها تبدیل کن.", ["پروژه", "برنامه"]),
  command("structured.decision", "structured", "تبدیل متن به شناسنامهٔ تصمیم", "این محتوا را به شناسنامهٔ تصمیم شامل زمینه، گزینه‌ها، تصمیم و پیامدها تبدیل کن.", ["تصمیم", "شناسنامه"]),
  command("structured.json", "structured", "تبدیل متن به دادهٔ ساختاریافتهٔ JSON", "این محتوا را به JSON معتبر، کمینه و دارای کلیدهای معنادار تبدیل کن.", ["json", "داده"]),
] as const;

export function normalizeAiCommandQuery(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("fa")
    .replaceAll("ي", "ی")
    .replaceAll("ك", "ک")
    .replace(/[\u200c\s_-]+/g, " ");
}

export function filterAiWritingCommands(query: string) {
  const normalizedQuery = normalizeAiCommandQuery(query);
  if (!normalizedQuery) return [...AI_WRITING_COMMANDS];

  return AI_WRITING_COMMANDS.filter((item) => {
    const category = AI_WRITING_COMMAND_CATEGORIES[item.category].label;
    return normalizeAiCommandQuery(
      [item.title, category, ...item.keywords].join(" "),
    ).includes(normalizedQuery);
  });
}

export function getSuggestedAiWritingCommands(
  contextKind: "document" | "block" | "selection",
) {
  const ids =
    contextKind === "document"
      ? [
          "document.executive-summary",
          "document.repetitions",
          "document.ambiguity",
          "document.heading-structure",
        ]
      : [
          "selection.summary",
          "selection.proofread",
          "persian.half-space",
          "structured.table",
        ];

  return ids.flatMap((id) => {
    const item = AI_WRITING_COMMANDS.find((candidate) => candidate.id === id);
    return item ? [item] : [];
  });
}
