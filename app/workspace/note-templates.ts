export type NoteTemplateId =
  | "blank"
  | "quick-note"
  | "daily-journal"
  | "meeting-notes"
  | "meeting-minutes"
  | "todo-list"
  | "project-plan"
  | "research-notes"
  | "brainstorming"
  | "financial-report"
  | "weekly-review"
  | "decision-log";

export type NoteTemplate = {
  id: NoteTemplateId;
  title: string;
  description: string;
  suggestedBaseName: string;
  keywords: readonly string[];
  content: string;
};

const TODAY_TOKEN = "{{date}}";

export const NOTE_TEMPLATES: readonly NoteTemplate[] = [
  {
    id: "blank",
    title: "یادداشت خالی",
    description: "شروع با یک صفحهٔ خالی",
    suggestedBaseName: "یادداشت تازه",
    keywords: ["خالی", "ساده"],
    content: "",
  },
  {
    id: "quick-note",
    title: "یادداشت سریع",
    description: "ثبت فوری نکته، لینک و پیگیری",
    suggestedBaseName: "یادداشت سریع",
    keywords: ["سریع", "ایده", "لینک"],
    content: "# یادداشت سریع\n\n## نکته\n\n\n## پیگیری\n\n- [ ] \n",
  },
  {
    id: "daily-journal",
    title: "یادداشت روزانه",
    description: "رویدادها، حال‌وهوا و یادگیری‌های امروز",
    suggestedBaseName: "یادداشت روزانه",
    keywords: ["روزانه", "ژورنال", "امروز"],
    content:
      `# یادداشت روزانه — ${TODAY_TOKEN}\n\n## تمرکز امروز\n\n- \n\n## رویدادها\n\n- \n\n## آموخته‌ها\n\n- \n\n## فردا\n\n- [ ] \n`,
  },
  {
    id: "meeting-notes",
    title: "یادداشت جلسه",
    description: "دستور جلسه، تصمیم‌ها و اقدام‌های بعدی",
    suggestedBaseName: "یادداشت جلسه",
    keywords: ["جلسه", "تصمیم", "اقدام"],
    content:
      `# یادداشت جلسه — ${TODAY_TOKEN}\n\n## حاضران\n\n- \n\n## دستور جلسه\n\n1. \n\n## گفت‌وگوها\n\n- \n\n## تصمیم‌ها\n\n- \n\n## اقدام‌های بعدی\n\n- [ ] کار — مسئول — موعد\n`,
  },
  {
    id: "meeting-minutes",
    title: "صورت‌جلسه رسمی",
    description: "مصوبات، مسئولان و مهلت‌های قابل پیگیری",
    suggestedBaseName: "صورت جلسه",
    keywords: ["صورت جلسه", "مصوبه", "رسمی"],
    content:
      `# صورت‌جلسه — ${TODAY_TOKEN}\n\n| موضوع | شرح |\n| --- | --- |\n| زمان و مکان |  |\n| دبیر جلسه |  |\n| حاضران |  |\n\n## مصوبات\n\n| ردیف | مصوبه | مسئول | مهلت | وضعیت |\n| ---: | --- | --- | --- | --- |\n| ۱ |  |  |  | باز |\n`,
  },
  {
    id: "todo-list",
    title: "فهرست کارها",
    description: "کارهای امروز و پیگیری وضعیت",
    suggestedBaseName: "فهرست کارها",
    keywords: ["کار", "تودو", "پیگیری"],
    content:
      `# فهرست کارها — ${TODAY_TOKEN}\n\n## مهم و فوری\n\n- [ ] \n\n## در حال انجام\n\n- [ ] \n\n## بعداً\n\n- [ ] \n`,
  },
  {
    id: "project-plan",
    title: "برنامهٔ پروژه",
    description: "هدف، دامنه، زمان‌بندی و ریسک‌ها",
    suggestedBaseName: "برنامه پروژه",
    keywords: ["پروژه", "برنامه", "ریسک"],
    content:
      "# برنامهٔ پروژه\n\n## هدف\n\n\n## دامنه\n\n### داخل دامنه\n\n- \n\n### خارج از دامنه\n\n- \n\n## نقاط عطف\n\n| نقطهٔ عطف | مسئول | موعد | وضعیت |\n| --- | --- | --- | --- |\n|  |  |  | برنامه‌ریزی |\n\n## ریسک‌ها\n\n| ریسک | احتمال | اثر | اقدام کاهشی |\n| --- | --- | --- | --- |\n|  |  |  |  |\n",
  },
  {
    id: "research-notes",
    title: "یادداشت پژوهش",
    description: "پرسش، شواهد، منابع و جمع‌بندی",
    suggestedBaseName: "یادداشت پژوهش",
    keywords: ["پژوهش", "منبع", "مطالعه"],
    content:
      "# یادداشت پژوهش\n\n## پرسش اصلی\n\n\n## فرضیه‌ها\n\n- \n\n## شواهد\n\n- \n\n## منابع\n\n1. \n\n## جمع‌بندی و محدودیت‌ها\n\n",
  },
  {
    id: "brainstorming",
    title: "بارش فکری",
    description: "ایده‌ها بدون قضاوت و سپس دسته‌بندی",
    suggestedBaseName: "بارش فکری",
    keywords: ["ایده", "خلاقیت", "بارش فکری"],
    content:
      "# بارش فکری\n\n## مسئله\n\n\n## ایده‌های خام\n\n- \n- \n- \n\n## دسته‌بندی\n\n### شدنی در کوتاه‌مدت\n\n- \n\n### نیازمند بررسی\n\n- \n\n## سه انتخاب برتر\n\n1. \n2. \n3. \n",
  },
  {
    id: "financial-report",
    title: "گزارش مالی",
    description: "درآمد، هزینه، مانده و توضیحات",
    suggestedBaseName: "گزارش مالی",
    keywords: ["مالی", "درآمد", "هزینه", "گزارش"],
    content:
      `# گزارش مالی — ${TODAY_TOKEN}\n\n## خلاصه\n\n| شاخص | مبلغ | تغییر |\n| --- | ---: | ---: |\n| درآمد | ۰ | ۰٪ |\n| هزینه | ۰ | ۰٪ |\n| مانده | ۰ | ۰٪ |\n\n## جزئیات\n\n| تاریخ | شرح | دسته | ورودی | خروجی |\n| --- | --- | --- | ---: | ---: |\n|  |  |  | ۰ | ۰ |\n\n## نکات و ریسک‌ها\n\n- \n`,
  },
  {
    id: "weekly-review",
    title: "مرور هفتگی",
    description: "دستاوردها، موانع و تمرکز هفتهٔ بعد",
    suggestedBaseName: "مرور هفتگی",
    keywords: ["هفتگی", "مرور", "دستاورد"],
    content:
      "# مرور هفتگی\n\n## دستاوردها\n\n- \n\n## کارهای ناتمام\n\n- [ ] \n\n## موانع و آموخته‌ها\n\n- \n\n## سه تمرکز هفتهٔ بعد\n\n1. \n2. \n3. \n",
  },
  {
    id: "decision-log",
    title: "دفتر تصمیم‌ها",
    description: "زمینه، گزینه‌ها، تصمیم و پیامدها",
    suggestedBaseName: "تصمیم",
    keywords: ["تصمیم", "گزینه", "پیامد"],
    content:
      `# تصمیم — ${TODAY_TOKEN}\n\n## زمینه\n\n\n## گزینه‌های بررسی‌شده\n\n1. \n2. \n\n## تصمیم نهایی\n\n\n## دلیل\n\n\n## پیامدها و زمان بازبینی\n\n- پیامد: \n- تاریخ بازبینی: \n`,
  },
] as const;

export function resolveTemplateContent(
  template: NoteTemplate,
  date = new Date(),
) {
  const persianDate = new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
  return template.content.replaceAll(TODAY_TOKEN, persianDate);
}

export function findNoteTemplate(id: string) {
  return NOTE_TEMPLATES.find((template) => template.id === id) ?? null;
}
