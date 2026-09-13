import {
  detectMermaidKind,
  MermaidDiagramKind,
  parseMermaidCsvRow,
  toAsciiDigits,
} from "./persian-adapter";

export type SimpleDiagramKind = Exclude<MermaidDiagramKind, "other">;

export type SimpleDiagramMeta = Record<string, string | boolean>;

export type SimpleDiagramRow = {
  id: string;
  first: string;
  second: string;
  value: string;
  meta: SimpleDiagramMeta;
};

export type SimpleDiagramDraft = {
  kind: SimpleDiagramKind;
  title: string;
  orientation: "horizontal" | "vertical";
  rows: SimpleDiagramRow[];
  settings: SimpleDiagramMeta;
};

export type SimpleDiagramIssue = {
  rowId?: string;
  field?: "first" | "second" | "value" | `meta.${string}` | `settings.${string}`;
  message: string;
};

export type SimpleDiagramFields = {
  first: string;
  second?: string;
  value?: string;
  valueInput?: "text" | "number" | "date" | "duration";
  add: string;
};

export type SimpleDiagramOption = {
  kind: SimpleDiagramKind;
  category: "پایه" | "مهندسی" | "برنامه‌ریزی" | "داده" | "ایده";
  title: string;
  description: string;
  showTitle?: boolean;
  fields: SimpleDiagramFields;
};

export const SIMPLE_DIAGRAM_OPTIONS: SimpleDiagramOption[] = [
  {
    kind: "flowchart",
    category: "پایه",
    title: "فرایند",
    description: "مراحل، تصمیم‌ها و مسیر حرکت کار.",
    fields: { first: "از مرحله", second: "به مرحله", value: "نام مسیر", valueInput: "text", add: "افزودن مسیر" },
  },
  {
    kind: "sequence",
    category: "پایه",
    title: "توالی",
    description: "گفت‌وگوهای زمان‌مند میان افراد یا سامانه‌ها.",
    fields: { first: "فرستنده", second: "گیرنده", value: "پیام", valueInput: "text", add: "افزودن پیام" },
  },
  {
    kind: "class",
    category: "مهندسی",
    title: "کلاس",
    description: "کلاس‌ها و رابطهٔ میان اجزای نرم‌افزار.",
    fields: { first: "کلاس اول", second: "کلاس دوم", value: "نوع رابطه", valueInput: "text", add: "افزودن رابطه" },
  },
  {
    kind: "state",
    category: "مهندسی",
    title: "حالت",
    description: "تغییر وضعیت یک فرایند از آغاز تا پایان.",
    fields: { first: "از حالت", second: "به حالت", value: "دلیل تغییر", valueInput: "text", add: "افزودن تغییر حالت" },
  },
  {
    kind: "er",
    category: "مهندسی",
    title: "رابطهٔ موجودیت",
    description: "موجودیت‌های داده و رابطهٔ میان آن‌ها.",
    fields: { first: "موجودیت اول", second: "موجودیت دوم", value: "نام رابطه", valueInput: "text", add: "افزودن رابطه" },
  },
  {
    kind: "requirement",
    category: "مهندسی",
    title: "نیازمندی",
    description: "نیازمندی‌ها و جزء مسئول برآورده‌کردن آن‌ها.",
    fields: { first: "نیازمندی", second: "جزء مرتبط", value: "توضیح", valueInput: "text", add: "افزودن نیازمندی" },
  },
  {
    kind: "architecture",
    category: "مهندسی",
    title: "معماری",
    description: "سرویس‌ها و اتصال‌های اصلی سامانه.",
    fields: { first: "سرویس اول", second: "سرویس دوم", add: "افزودن اتصال" },
  },
  {
    kind: "c4",
    category: "مهندسی",
    title: "زمینهٔ سامانه C4",
    description: "کاربران، سامانه‌ها و نحوهٔ ارتباط آن‌ها.",
    showTitle: true,
    fields: { first: "کاربر یا نقش", second: "سامانه", value: "نوع استفاده", valueInput: "text", add: "افزودن ارتباط" },
  },
  {
    kind: "gantt",
    category: "برنامه‌ریزی",
    title: "گانت",
    description: "کارها، تاریخ شروع و مدت اجرای آن‌ها.",
    showTitle: true,
    fields: { first: "نام کار", second: "تاریخ شروع", value: "مدت؛ مانند ۵d", valueInput: "duration", add: "افزودن کار" },
  },
  {
    kind: "timeline",
    category: "برنامه‌ریزی",
    title: "خط زمانی",
    description: "رویدادها یا مرحله‌ها به ترتیب وقوع.",
    showTitle: true,
    fields: { first: "زمان یا مرحله", second: "رویداد", add: "افزودن رویداد" },
  },
  {
    kind: "kanban",
    category: "برنامه‌ریزی",
    title: "کانبان",
    description: "کارها در ستون‌های وضعیت جریان کار.",
    fields: { first: "نام ستون", second: "نام کار", add: "افزودن کار" },
  },
  {
    kind: "gitgraph",
    category: "برنامه‌ریزی",
    title: "شاخه‌های Git",
    description: "ثبت تغییرها روی شاخه‌های مختلف پروژه.",
    fields: { first: "شاخهٔ جاری", second: "شناسه یا پیام ثبت", value: "شاخه یا ثبت مبدأ", valueInput: "text", add: "افزودن رویداد Git" },
  },
  {
    kind: "pie",
    category: "داده",
    title: "نمودار دایره‌ای",
    description: "سهم هر مورد از یک کل.",
    showTitle: true,
    fields: { first: "عنوان بخش", value: "مقدار", valueInput: "number", add: "افزودن بخش" },
  },
  {
    kind: "xychart",
    category: "داده",
    title: "نمودار XY",
    description: "مقایسهٔ مقدارها روی محور افقی و عمودی.",
    showTitle: true,
    fields: { first: "مقدار محور افقی", second: "مقدار محور عمودی", value: "برچسب نقطه", valueInput: "text", add: "افزودن نقطه" },
  },
  {
    kind: "sankey",
    category: "داده",
    title: "جریان سنکی",
    description: "جریان مقدار میان مبدأها و مقصدها.",
    fields: { first: "از", second: "به", value: "مقدار", valueInput: "number", add: "افزودن مسیر" },
  },
  {
    kind: "mindmap",
    category: "ایده",
    title: "نقشهٔ ذهنی",
    description: "یک موضوع اصلی با شاخه‌ها و نکته‌های مرتبط.",
    showTitle: true,
    fields: { first: "شاخه", second: "نکته", add: "افزودن نکته" },
  },
  {
    kind: "journey",
    category: "ایده",
    title: "سفر کاربر",
    description: "مراحل تجربه و امتیاز رضایت در هر مرحله.",
    showTitle: true,
    fields: { first: "بخش سفر", second: "اقدام کاربر", value: "امتیاز از ۵", valueInput: "number", add: "افزودن مرحله" },
  },
  {
    kind: "quadrant",
    category: "داده",
    title: "چهارخانه",
    description: "جای‌گذاری گزینه‌ها بر اساس دو معیار.",
    showTitle: true,
    fields: { first: "گزینه", second: "مقدار افقی؛ ۰ تا ۱", value: "مقدار عمودی؛ ۰ تا ۱", valueInput: "number", add: "افزودن گزینه" },
  },
  {
    kind: "swimlane",
    category: "پایه",
    title: "مسیر مسئولیت (Swimlane)",
    description: "مراحل فرایند بر اساس فرد، تیم یا سامانهٔ مسئول.",
    showTitle: true,
    fields: { first: "مسئول مرحله", second: "نام مرحله", value: "مرحلهٔ بعد (اختیاری)", valueInput: "text", add: "افزودن مرحله" },
  },
  {
    kind: "block",
    category: "مهندسی",
    title: "نمودار بلوکی",
    description: "اجزای یک سامانه با کنترل مستقیم ستون، اندازه و اتصال بلوک‌ها.",
    showTitle: true,
    fields: { first: "بلوک مبدأ", second: "بلوک مقصد", value: "نام اتصال", valueInput: "text", add: "افزودن اتصال" },
  },
  {
    kind: "packet",
    category: "مهندسی",
    title: "ساختار بسته",
    description: "فیلدهای یک بستهٔ داده با محل شروع و تعداد بیت‌ها.",
    showTitle: true,
    fields: { first: "نام فیلد", second: "بیت شروع (اختیاری)", value: "تعداد بیت", valueInput: "number", add: "افزودن فیلد" },
  },
  {
    kind: "radar",
    category: "داده",
    title: "نمودار رادار",
    description: "مقایسهٔ چند سری روی معیارهای مشترک.",
    showTitle: true,
    fields: { first: "معیار", second: "نام سری", value: "مقدار", valueInput: "number", add: "افزودن مقدار" },
  },
  {
    kind: "eventmodeling",
    category: "مهندسی",
    title: "مدل‌سازی رویداد",
    description: "جریان زمانی رابط، فرمان، رویداد، پردازشگر و مدل خواندن.",
    showTitle: true,
    fields: { first: "نام موجودیت", second: "حوزه یا سامانه (اختیاری)", value: "نمونهٔ داده (اختیاری)", valueInput: "text", add: "افزودن قاب زمانی" },
  },
  {
    kind: "treemap",
    category: "داده",
    title: "نقشهٔ درختی مساحتی",
    description: "سهم بخش‌ها در یک ساختار سلسله‌مراتبی.",
    showTitle: true,
    fields: { first: "نام مورد", second: "مسیر گروه‌ها (اختیاری)", value: "مقدار", valueInput: "number", add: "افزودن مورد" },
  },
  {
    kind: "venn",
    category: "داده",
    title: "نمودار ون",
    description: "مجموعه‌ها، هم‌پوشانی آن‌ها و اندازهٔ هر ناحیه.",
    showTitle: true,
    fields: { first: "نام ناحیه", second: "مجموعه‌های عضو (برای هم‌پوشانی)", value: "اندازه", valueInput: "number", add: "افزودن ناحیه" },
  },
  {
    kind: "ishikawa",
    category: "ایده",
    title: "علت و معلول (ایشیکاوا)",
    description: "دسته‌بندی علت‌های اصلی و ریشه‌ای یک مسئله.",
    showTitle: true,
    fields: { first: "دستهٔ علت", second: "علت", value: "زیرعلت (اختیاری)", valueInput: "text", add: "افزودن علت" },
  },
  {
    kind: "wardley",
    category: "ایده",
    title: "نقشهٔ واردلی",
    description: "جایگاه اجزای زنجیرهٔ ارزش بر اساس دیده‌شدن و بلوغ.",
    showTitle: true,
    fields: { first: "نام جزء", second: "دیده‌شدن؛ ۰ تا ۱", value: "بلوغ؛ ۰ تا ۱", valueInput: "number", add: "افزودن جزء" },
  },
  {
    kind: "cynefin",
    category: "ایده",
    title: "چارچوب کینِفین",
    description: "دسته‌بندی موقعیت‌ها برای انتخاب شیوهٔ تصمیم‌گیری مناسب.",
    showTitle: true,
    fields: { first: "موقعیت یا مسئله", value: "برچسب جابه‌جایی (اختیاری)", valueInput: "text", add: "افزودن موقعیت" },
  },
  {
    kind: "treeview",
    category: "مهندسی",
    title: "نمای درختی",
    description: "ساختار پوشه، فایل یا هر سلسله‌مراتب تو‌در‌تو.",
    showTitle: true,
    fields: { first: "نام گره", second: "مسیر والد (اختیاری)", value: "توضیح (اختیاری)", valueInput: "text", add: "افزودن گره" },
  },
];

const OPTION_BY_KIND = new Map(
  SIMPLE_DIAGRAM_OPTIONS.map((option) => [option.kind, option]),
);

const DIRECTIONAL_KINDS = new Set<SimpleDiagramKind>([
  "flowchart",
  "class",
  "state",
  "er",
  "requirement",
  "architecture",
  "timeline",
  "gitgraph",
  "xychart",
  "swimlane",
]);

const AXIS_GUIDANCE: Partial<
  Record<SimpleDiagramKind, { horizontal: string; vertical: string }>
> = {
  c4: {
    horizontal: "نقش و سامانه، دو سوی هر ارتباط را در عرض می‌سازند.",
    vertical: "ترتیب ردیف‌ها، ارتباط‌ها را در طول مرتب می‌کند.",
  },
  sequence: {
    horizontal: "فرستنده و گیرنده، نقش‌ها را در عرض می‌سازند.",
    vertical: "ترتیب ردیف‌ها، ترتیب پیام‌ها در طول است.",
  },
  gantt: {
    horizontal: "تاریخ شروع و مدت، پهنای زمان را کنترل می‌کنند.",
    vertical: "ترتیب ردیف‌ها، جای کارها را در طول تعیین می‌کند.",
  },
  timeline: {
    horizontal: "مرحله‌ها در امتداد زمان گسترش پیدا می‌کنند.",
    vertical: "هر ردیف یک رویداد تازه به مسیر اضافه می‌کند.",
  },
  kanban: {
    horizontal: "نام ستون، ستون‌های تازه را در عرض می‌سازد.",
    vertical: "کارهای هم‌ستون در طول زیر هم قرار می‌گیرند.",
  },
  gitgraph: {
    horizontal: "نام شاخه، مسیرهای موازی را در عرض می‌سازد.",
    vertical: "ترتیب ردیف‌ها، تاریخچهٔ ثبت‌ها را تعیین می‌کند.",
  },
  xychart: {
    horizontal: "ستون اول مقدار محور افقی است.",
    vertical: "ستون دوم مقدار محور عمودی است.",
  },
  sankey: {
    horizontal: "مبدأ و مقصد، لایه‌های جریان را در عرض می‌سازند.",
    vertical: "مقدارها ضخامت و جای جریان‌ها را تعیین می‌کنند.",
  },
  mindmap: {
    horizontal: "نام شاخه، شاخه‌های موازی را در عرض می‌سازد.",
    vertical: "نکته‌ها عمق هر شاخه را بیشتر می‌کنند.",
  },
  journey: {
    horizontal: "بخش سفر، مرحله‌های اصلی تجربه را جدا می‌کند.",
    vertical: "ترتیب ردیف‌ها، توالی اقدام‌های کاربر است.",
  },
  quadrant: {
    horizontal: "ستون دوم جای گزینه روی محور افقی است.",
    vertical: "ستون سوم جای گزینه روی محور عمودی است.",
  },
  block: {
    horizontal: "تعداد ستون‌ها و پهنای هر بلوک، گسترش نمودار در عرض را کنترل می‌کنند.",
    vertical: "ترتیب ردیف‌ها و شکستن بلوک‌ها میان ستون‌ها، طول نمودار را می‌سازند.",
  },
  packet: {
    horizontal: "بیت شروع و تعداد بیت، پهنای هر فیلد را روی ردیف بسته تعیین می‌کنند.",
    vertical: "تنظیم تعداد بیت هر ردیف، محل شکستن بسته و تعداد سطرها را کنترل می‌کند.",
  },
  radar: {
    horizontal: "نام معیارها، تعداد محورهای پیرامونی نمودار را تعیین می‌کند.",
    vertical: "مقدار هر سری، فاصلهٔ نقطه از مرکز را روی هر محور کنترل می‌کند.",
  },
  eventmodeling: {
    horizontal: "ترتیب قاب‌های زمانی، حرکت رویدادها را در امتداد زمان می‌سازد.",
    vertical: "نوع موجودیت و حوزه، جای آن را در خط‌های مسئولیت تعیین می‌کند.",
  },
  treemap: {
    horizontal: "مقدار هر مورد، سهم مساحت آن را نسبت به هم‌گروه‌ها تعیین می‌کند.",
    vertical: "مسیر گروه‌ها، عمق و تو‌در‌تویی مستطیل‌ها را می‌سازد.",
  },
  venn: {
    horizontal: "تعداد مجموعه‌ها و اندازهٔ آن‌ها، گسترهٔ دایره‌ها را کنترل می‌کند.",
    vertical: "فهرست اعضای هر هم‌پوشانی، ناحیهٔ مشترک و جای برچسب را مشخص می‌کند.",
  },
  ishikawa: {
    horizontal: "دسته‌های علت در امتداد ستون فقرات مسئله پخش می‌شوند.",
    vertical: "علت و زیرعلت، عمق هر شاخه را بیشتر می‌کنند.",
  },
  wardley: {
    horizontal: "مقدار بلوغ، جای جزء را از پیدایش تا کالایی‌شدن تعیین می‌کند.",
    vertical: "مقدار دیده‌شدن، فاصلهٔ جزء از زیرساخت تا کاربر را کنترل می‌کند.",
  },
  cynefin: {
    horizontal: "دامنه‌های پیچیده/کارشناسی و آشوب/روشن در چهار بخش ثابت قرار می‌گیرند.",
    vertical: "تعداد موقعیت‌های هر دامنه و جابه‌جایی‌ها، تراکم محتوای هر بخش را می‌سازد.",
  },
  treeview: {
    horizontal: "مسیر والد، عمق تورفتگی و فاصلهٔ افقی هر گره را تعیین می‌کند.",
    vertical: "ترتیب ردیف‌ها، ترتیب نمایش فایل‌ها و پوشه‌ها در طول درخت است.",
  },
};

export function supportsDiagramOrientation(kind: SimpleDiagramKind) {
  return DIRECTIONAL_KINDS.has(kind);
}

export function diagramAxisGuidance(kind: SimpleDiagramKind) {
  return AXIS_GUIDANCE[kind];
}

export function isSimpleDiagramKind(
  kind: MermaidDiagramKind,
): kind is SimpleDiagramKind {
  return kind !== "other" && OPTION_BY_KIND.has(kind);
}

export function simpleDiagramFields(kind: SimpleDiagramKind) {
  return OPTION_BY_KIND.get(kind)?.fields ?? SIMPLE_DIAGRAM_OPTIONS[0].fields;
}

function row(
  id: string,
  first: string,
  second = "",
  value = "",
  meta: SimpleDiagramMeta = {},
) {
  return { id, first, second, value, meta };
}

const DEFAULT_SETTINGS: Record<SimpleDiagramKind, SimpleDiagramMeta> = {
  flowchart: {},
  sequence: {},
  class: {},
  state: {},
  er: {},
  requirement: {},
  architecture: {},
  c4: {
    c4Level: "context",
    shapesPerRow: "4",
    boundariesPerRow: "2",
  },
  gantt: {
    dateFormat: "YYYY-MM-DD",
    axisFormat: "%Y-%m-%d",
    tickInterval: "1week",
    excludes: "",
    todayMarker: true,
  },
  timeline: { disableMulticolor: false },
  kanban: { ticketBaseUrl: "" },
  gitgraph: {
    mainBranchName: "main",
    showBranches: true,
    showCommitLabel: true,
    rotateCommitLabel: true,
    parallelCommits: false,
  },
  pie: {
    showData: true,
    donutHole: "0",
    legendPosition: "right",
    highlightSlice: "hover",
    textPosition: "0.75",
  },
  xychart: {
    xAxisType: "category",
    xAxisTitle: "",
    yAxisTitle: "",
    xMin: "",
    xMax: "",
    yMin: "",
    yMax: "",
    showDataLabel: false,
    showDataLabelOutsideBar: false,
  },
  sankey: {
    width: "800",
    height: "400",
    linkColor: "gradient",
    nodeAlignment: "justify",
    showValues: true,
    labelStyle: "outlined",
    nodeWidth: "10",
    nodePadding: "12",
  },
  mindmap: {},
  journey: {},
  quadrant: {
    xLeft: "کم",
    xRight: "زیاد",
    yBottom: "کم",
    yTop: "زیاد",
    quadrant1: "اولویت بالا",
    quadrant2: "بررسی بیشتر",
    quadrant3: "اولویت پایین",
    quadrant4: "فرصت بهبود",
    chartWidth: "500",
    chartHeight: "500",
  },
  swimlane: {},
  block: { columns: "3" },
  packet: { bitsPerRow: "32" },
  radar: { min: "0", max: "100", ticks: "5", graticule: "polygon", showLegend: true },
  eventmodeling: {},
  treemap: { showValues: true },
  venn: {},
  ishikawa: {},
  wardley: { width: "1100", height: "700" },
  cynefin: { showDomainDescriptions: true },
  treeview: { showIcons: true },
};

const DEFAULT_DRAFTS: Record<
  SimpleDiagramKind,
  Omit<SimpleDiagramDraft, "kind" | "orientation" | "settings">
> = {
  flowchart: { title: "فرایند تازه", rows: [row("row-1", "شروع", "بازبینی", ""), row("row-2", "بازبینی", "پایان", "تأیید")] },
  sequence: { title: "گفت‌وگو", rows: [row("row-1", "کاربر", "راوی", "فایل را باز کن"), row("row-2", "راوی", "کاربر", "پیش‌نمایش آماده است")] },
  class: { title: "ساختار کلاس‌ها", rows: [row("row-1", "سند", "نمودار", "شامل می‌شود")] },
  state: { title: "چرخهٔ حالت", rows: [row("row-1", "پیش‌نویس", "بازبینی", "ارسال"), row("row-2", "بازبینی", "منتشرشده", "تأیید")] },
  er: { title: "مدل داده", rows: [row("row-1", "سند", "نمودار", "شامل می‌شود")] },
  requirement: { title: "نیازمندی‌ها", rows: [row("row-1", "خوانایی", "پیش‌نمایش", "متن و نمودار خوانا باشند")] },
  architecture: { title: "معماری سامانه", rows: [row("row-1", "ویرایشگر", "پیش‌نمایش")] },
  c4: { title: "زمینهٔ سامانهٔ راوی", rows: [row("row-1", "خواننده", "راوی", "مطالعه و ویرایش سند", { sourceType: "person", targetType: "system", technology: "وب", description: "ویرایشگر Markdown فارسی", boundary: "", boundaryParent: "" })] },
  gantt: { title: "برنامهٔ انتشار", rows: [row("row-1", "نمونهٔ اولیه", "2026-08-01", "۵d", { section: "برنامه", status: "active", dependency: "", milestone: false }), row("row-2", "پیاده‌سازی", "2026-08-06", "۸d", { section: "برنامه", status: "none", dependency: "", milestone: false })] },
  timeline: { title: "مسیر کار", rows: [row("row-1", "شروع", "آغاز کار", "", { section: "مسیر اصلی" }), row("row-2", "پایان", "انتشار نتیجه", "", { section: "مسیر اصلی" })] },
  kanban: { title: "کارها", rows: [row("row-1", "برای انجام", "طراحی نمودار", "", { assigned: "", ticket: "", priority: "" }), row("row-2", "انجام‌شده", "ساخت فایل", "", { assigned: "", ticket: "", priority: "" })] },
  gitgraph: { title: "تاریخچهٔ نسخه", rows: [row("row-1", "main", "شروع", "", { action: "commit", commitType: "NORMAL", tag: "", parent: "" }), row("row-2", "ویژگی", "افزودن نمودار", "", { action: "commit", commitType: "HIGHLIGHT", tag: "", parent: "" })] },
  pie: { title: "تقسیم‌بندی", rows: [row("row-1", "بخش اول", "", "۶۰"), row("row-2", "بخش دوم", "", "۴۰")] },
  xychart: { title: "رشد نسخه‌ها", rows: [row("row-1", "نسخهٔ ۱", "۳", "", { series: "رشد", seriesType: "line", color: "" }), row("row-2", "نسخهٔ ۲", "۷", "", { series: "رشد", seriesType: "line", color: "" }), row("row-3", "نسخهٔ ۳", "۹", "انتشار", { series: "رشد", seriesType: "line", color: "" })] },
  sankey: { title: "جریان مقدار", rows: [row("row-1", "ورودی", "مطالعه", "۸", { sourceColor: "", targetColor: "" }), row("row-2", "مطالعه", "یادداشت", "۳", { sourceColor: "", targetColor: "" })] },
  mindmap: { title: "موضوع اصلی", rows: [row("row-1", "شاخهٔ اول", "نکتهٔ اول", "", { shape: "default", icon: "", color: "" })] },
  journey: { title: "ساخت یک سند", rows: [row("row-1", "شروع", "بازکردن فایل", "۵", { actors: "کاربر" }), row("row-2", "پایان", "ذخیرهٔ نسخه", "۵", { actors: "کاربر" })] },
  quadrant: { title: "اولویت قابلیت‌ها", rows: [row("row-1", "جست‌وجو", "۰٫۷", "۰٫۸", { color: "", radius: "5", strokeColor: "", strokeWidth: "" }), row("row-2", "نمودار", "۰٫۹", "۰٫۶", { color: "", radius: "5", strokeColor: "", strokeWidth: "" })] },
  swimlane: { title: "رسیدگی به درخواست", rows: [row("row-1", "مشتری", "ثبت درخواست", "بررسی درخواست", { targetLane: "پشتیبانی", shape: "stadium", targetShape: "rect", edgeLabel: "ارجاع" }), row("row-2", "پشتیبانی", "بررسی درخواست", "ارسال پاسخ", { targetLane: "پشتیبانی", shape: "rect", targetShape: "rect", edgeLabel: "تأیید" }), row("row-3", "پشتیبانی", "ارسال پاسخ", "", { targetLane: "", shape: "rect", targetShape: "rect", edgeLabel: "" })] },
  block: { title: "اجزای سامانه", rows: [row("row-1", "ویرایشگر", "پیش‌نمایش", "به‌روزرسانی", { sourceShape: "rect", targetShape: "rect", sourceWidth: "1", targetWidth: "1", linkType: "arrow" }), row("row-2", "پیش‌نمایش", "ذخیره‌سازی", "ثبت", { sourceShape: "rect", targetShape: "cylinder", sourceWidth: "1", targetWidth: "1", linkType: "arrow" })] },
  packet: { title: "بستهٔ داده", rows: [row("row-1", "نسخه", "", "۴"), row("row-2", "نوع", "", "۴"), row("row-3", "طول", "", "۸"), row("row-4", "داده", "", "۱۶")] },
  radar: { title: "توانمندی تیم", rows: [row("row-1", "سرعت", "اکنون", "۷۰"), row("row-2", "کیفیت", "اکنون", "۸۰"), row("row-3", "یادگیری", "اکنون", "۶۰"), row("row-4", "سرعت", "هدف", "۹۰"), row("row-5", "کیفیت", "هدف", "۹۰"), row("row-6", "یادگیری", "هدف", "۸۵")] },
  eventmodeling: { title: "جریان ثبت سفارش", rows: [row("row-1", "صفحهٔ سبد", "فروشگاه", "", { entityType: "ui", resetFrame: false }), row("row-2", "ثبت سفارش", "فروشگاه", "", { entityType: "cmd", resetFrame: false }), row("row-3", "سفارش ثبت شد", "فروشگاه", "", { entityType: "evt", resetFrame: false })] },
  treemap: { title: "سهم قابلیت‌ها", rows: [row("row-1", "ویرایشگر", "محصول", "۴۰"), row("row-2", "مطالعه", "محصول", "۳۵"), row("row-3", "نمودار", "محصول", "۲۵")] },
  venn: { title: "هم‌پوشانی مهارت‌ها", rows: [row("row-1", "فنی", "", "۱۲", { regionType: "set" }), row("row-2", "محصول", "", "۱۰", { regionType: "set" }), row("row-3", "مهارت مشترک", "فنی، محصول", "۴", { regionType: "union" })] },
  ishikawa: { title: "کندی انتشار", rows: [row("row-1", "فرایند", "بازبینی دیرهنگام", "تأیید دستی"), row("row-2", "ابزار", "آزمون ناکافی", "پوشش کم")] },
  wardley: { title: "زنجیرهٔ ارزش راوی", rows: [row("row-1", "کاربر", "۰٫۹۵", "۰٫۶۵", { nodeType: "anchor", dependsOn: "row-2", inertia: false, strategy: "", evolveTarget: "" }), row("row-2", "راوی", "۰٫۸", "۰٫۵۵", { nodeType: "component", dependsOn: "row-3", inertia: false, strategy: "build", evolveTarget: "۰٫۷۲" }), row("row-3", "ذخیره‌سازی", "۰٫۴۵", "۰٫۸", { nodeType: "component", dependsOn: "", inertia: false, strategy: "buy", evolveTarget: "" })] },
  cynefin: { title: "تصمیم‌های محصول", rows: [row("row-1", "کشف قابلیت تازه", "", "الگو شناخته شد", { domain: "complex", transitionTo: "complicated" }), row("row-2", "بهینه‌سازی پایگاه داده", "", "", { domain: "complicated", transitionTo: "" }), row("row-3", "انتشار نسخه", "", "", { domain: "clear", transitionTo: "" }), row("row-4", "قطعی سراسری", "", "پایداری اولیه", { domain: "chaotic", transitionTo: "complex" })] },
  treeview: { title: "ساختار پروژه", rows: [row("row-1", "پروژهٔ راوی", "", "", { nodeType: "directory", highlight: false }), row("row-2", "کد منبع", "پروژهٔ راوی", "", { nodeType: "directory", highlight: false }), row("row-3", "ویرایشگر.tsx", "پروژهٔ راوی / کد منبع", "ویرایش متن", { nodeType: "file", highlight: false }), row("row-4", "راهنما.md", "پروژهٔ راوی", "راهنمای کاربر", { nodeType: "file", highlight: true })] },
};

function defaultRowMeta(kind: SimpleDiagramKind): SimpleDiagramMeta {
  const meta: SimpleDiagramMeta = {};
  if (kind === "flowchart") Object.assign(meta, { sourceShape: "rect", targetShape: "rect", linkType: "arrow", sourceGroup: "", targetGroup: "" });
  if (kind === "sequence") Object.assign(meta, { sourceType: "participant", targetType: "participant", messageType: "sync", sourceGroup: "", targetGroup: "", activate: false, deactivate: false, blockType: "none", blockLabel: "", note: "" });
  if (kind === "class") Object.assign(meta, { relationType: "association", sourceCardinality: "", targetCardinality: "", sourceMembers: "", targetMembers: "", sourceStereotype: "", targetStereotype: "", sourceNamespace: "", targetNamespace: "" });
  if (kind === "state") Object.assign(meta, { sourceKind: "normal", targetKind: "normal", sourceParent: "", targetParent: "", note: "" });
  if (kind === "er") Object.assign(meta, { sourceCardinality: "one", targetCardinality: "zero-many", identifying: true, sourceAttribute: "", sourceAttributeType: "string", sourceAttributeKey: "", targetAttribute: "", targetAttributeType: "string", targetAttributeKey: "" });
  if (kind === "requirement") Object.assign(meta, { requirementType: "requirement", risk: "low", verificationMethod: "test", relationship: "satisfies", elementType: "component", docref: "" });
  if (kind === "architecture") Object.assign(meta, { sourceType: "service", targetType: "service", sourceIcon: "server", targetIcon: "server", sourceGroup: "", targetGroup: "", groupParent: "", sourcePort: "R", targetPort: "L", arrow: "forward", align: "none" });
  if (kind === "c4") Object.assign(meta, { sourceType: "Person", targetType: "System", technology: "", description: "", boundary: "", boundaryParent: "" });
  if (kind === "gantt") Object.assign(meta, { section: "برنامه", status: "none", dependency: "", milestone: false });
  if (kind === "timeline") Object.assign(meta, { section: "" });
  if (kind === "kanban") Object.assign(meta, { assigned: "", ticket: "", priority: "" });
  if (kind === "gitgraph") Object.assign(meta, { action: "commit", commitType: "NORMAL", tag: "", parent: "" });
  if (kind === "xychart") Object.assign(meta, { series: "سری ۱", seriesType: "line", color: "" });
  if (kind === "sankey") Object.assign(meta, { sourceColor: "", targetColor: "" });
  if (kind === "mindmap") Object.assign(meta, { shape: "default", icon: "", color: "" });
  if (kind === "journey") Object.assign(meta, { actors: "کاربر" });
  if (kind === "quadrant") Object.assign(meta, { color: "", radius: "5", strokeColor: "", strokeWidth: "" });
  if (kind === "swimlane") Object.assign(meta, { targetLane: "", shape: "rect", targetShape: "rect", edgeLabel: "" });
  if (kind === "block") Object.assign(meta, { sourceShape: "rect", targetShape: "rect", sourceWidth: "1", targetWidth: "1", linkType: "arrow" });
  if (kind === "eventmodeling") Object.assign(meta, { entityType: "evt", resetFrame: false });
  if (kind === "venn") Object.assign(meta, { regionType: "set" });
  if (kind === "wardley") Object.assign(meta, { nodeType: "component", dependsOn: "", inertia: false, strategy: "", evolveTarget: "" });
  if (kind === "cynefin") Object.assign(meta, { domain: "complex", transitionTo: "" });
  if (kind === "treeview") Object.assign(meta, { nodeType: "file", highlight: false });
  return meta;
}

export function createSimpleDiagramDraft(kind: SimpleDiagramKind): SimpleDiagramDraft {
  const source = DEFAULT_DRAFTS[kind];
  return {
    kind,
    title: source.title,
    orientation: "horizontal",
    rows: source.rows.map((item) => ({ ...item, meta: { ...defaultRowMeta(kind), ...item.meta } })),
    settings: { ...DEFAULT_SETTINGS[kind] },
  };
}

export function createSimpleDiagramRow(kind: SimpleDiagramKind, id: string): SimpleDiagramRow {
  return row(id, "", "", "", defaultRowMeta(kind));
}

function cleanLabel(value: string, fallback: string) {
  return value.replace(/[\r\n]+/gu, " ").trim() || fallback;
}

function quotedLabel(value: string, fallback: string) {
  return JSON.stringify(cleanLabel(value, fallback));
}

function safeNumber(value: string, fallback = "0") {
  const normalized = toAsciiDigits(value).trim();
  const number = Number(normalized);
  return Number.isFinite(number) && number >= 0 ? normalized : fallback;
}

function safeFiniteNumber(value: string, fallback = "0") {
  const normalized = toAsciiDigits(value).trim();
  return Number.isFinite(Number(normalized)) ? normalized : fallback;
}

function safePositiveNumber(value: string, fallback = "1") {
  const normalized = toAsciiDigits(value).trim();
  const number = Number(normalized);
  return Number.isFinite(number) && number > 0 ? normalized : fallback;
}

function boundedNumber(value: string, minimum: number, maximum: number) {
  const number = Number(safeNumber(value));
  return Math.min(maximum, Math.max(minimum, number)).toString();
}

function safeDuration(value: string) {
  const normalized = toAsciiDigits(value).trim();
  return /^\d+(?:\.\d+)?[dhw]$/iu.test(normalized) ? normalized : "1d";
}

function safeDate(value: string, fallback: string) {
  const normalized = toAsciiDigits(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/u.test(normalized) ? normalized : fallback;
}

function safeText(value: string, fallback: string) {
  return cleanLabel(value, fallback).replace(/[\[\]{}()"`:|]/gu, " ").trim();
}

function metaText(meta: SimpleDiagramMeta | undefined, key: string, fallback = "") {
  const value = meta?.[key];
  return typeof value === "string" ? value : fallback;
}

function metaFlag(meta: SimpleDiagramMeta | undefined, key: string, fallback = false) {
  const value = meta?.[key];
  return typeof value === "boolean" ? value : fallback;
}

function settingText(draft: SimpleDiagramDraft, key: string, fallback = "") {
  return metaText(draft.settings, key, fallback);
}

function settingFlag(draft: SimpleDiagramDraft, key: string, fallback = false) {
  return metaFlag(draft.settings, key, fallback);
}

function yamlString(value: string) {
  return JSON.stringify(value);
}

function withFrontmatter(code: string, lines: string[]) {
  return lines.length ? ["---", "config:", ...lines, "---", code].join("\n") : code;
}

function validIsoDate(value: string) {
  const normalized = toAsciiDigits(value).trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/u);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function csvField(value: string, fallback: string) {
  const cleaned = cleanLabel(value, fallback);
  return `"${cleaned.replaceAll('"', '""')}"`;
}

function activeRows(draft: SimpleDiagramDraft) {
  return draft.rows.filter(
    (item) => item.first.trim() || item.second.trim() || item.value.trim(),
  );
}

function encodeDraft(draft: SimpleDiagramDraft) {
  try {
    const bytes = new TextEncoder().encode(JSON.stringify(draft));
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
  } catch {
    return "";
  }
}

function decodeDraft(value: string): SimpleDiagramDraft | null {
  try {
    const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as SimpleDiagramDraft;
    if (!isSimpleDiagramKind(parsed.kind) || !Array.isArray(parsed.rows)) return null;
    const defaults = DEFAULT_SETTINGS[parsed.kind];
    const parsedSettings =
      parsed.settings && typeof parsed.settings === "object" ? parsed.settings : {};
    return {
      kind: parsed.kind,
      title: String(parsed.title ?? ""),
      orientation: parsed.orientation === "vertical" ? "vertical" : "horizontal",
      rows: parsed.rows.map((item, index) =>
        row(
          String(item.id || `row-${index + 1}`),
          String(item.first ?? ""),
          String(item.second ?? ""),
          String(item.value ?? ""),
          {
            ...defaultRowMeta(parsed.kind),
            ...(item.meta && typeof item.meta === "object" ? item.meta : {}),
          },
        ),
      ),
      settings: { ...defaults, ...parsedSettings },
    };
  } catch {
    return null;
  }
}

export function validateSimpleDiagramDraft(draft: SimpleDiagramDraft) {
  const issues: SimpleDiagramIssue[] = [];
  const active = activeRows(draft);

  if (!active.length) {
    issues.push({ message: "برای ساخت نمودار دست‌کم یک ردیف کامل کنید." });
    return issues;
  }

  const fields = simpleDiagramFields(draft.kind);
  const kindsWithRequiredValue = new Set<SimpleDiagramKind>([
    "sequence", "gantt", "pie", "sankey", "journey", "quadrant",
    "packet", "radar", "treemap", "venn", "wardley",
  ]);
  const kindsWithOptionalSecond = new Set<SimpleDiagramKind>([
    "packet", "eventmodeling", "treemap", "venn", "treeview",
  ]);
  for (const item of active) {
    if (!item.first.trim()) {
      issues.push({ rowId: item.id, field: "first", message: `${fields.first} را وارد کنید.` });
    }
    if (fields.second && !kindsWithOptionalSecond.has(draft.kind) && !item.second.trim()) {
      issues.push({ rowId: item.id, field: "second", message: `${fields.second} را وارد کنید.` });
    }
    if (fields.value && kindsWithRequiredValue.has(draft.kind) && !item.value.trim()) {
      issues.push({ rowId: item.id, field: "value", message: `${fields.value} را وارد کنید.` });
    }
  }

  const duplicateLabels = new Set<string>();
  const seenLabels = new Set<string>();
  for (const item of active) {
    const normalized = item.first.trim().toLocaleLowerCase("fa-IR");
    if (normalized && seenLabels.has(normalized)) duplicateLabels.add(normalized);
    if (normalized) seenLabels.add(normalized);
  }

  if (draft.kind === "pie") {
    for (const item of active) {
      if (!(Number(safeNumber(item.value, "-1")) > 0)) {
        issues.push({ rowId: item.id, field: "value", message: "مقدار هر بخش باید بزرگ‌تر از صفر باشد." });
      }
      if (duplicateLabels.has(item.first.trim().toLocaleLowerCase("fa-IR"))) {
        issues.push({ rowId: item.id, field: "first", message: "عنوان هر بخش باید یکتا باشد." });
      }
    }
  }

  if (draft.kind === "journey") {
    for (const item of active) {
      const score = Number(toAsciiDigits(item.value));
      if (!Number.isFinite(score) || score < 1 || score > 5) {
        issues.push({ rowId: item.id, field: "value", message: "امتیاز سفر باید عددی بین ۱ تا ۵ باشد." });
      }
      if (!metaText(item.meta, "actors").trim()) {
        issues.push({ rowId: item.id, field: "meta.actors", message: "دست‌کم یک بازیگر برای این اقدام بنویسید." });
      }
    }
  }

  if (draft.kind === "quadrant") {
    for (const item of active) {
      for (const [field, label, value] of [
        ["second", "افقی", item.second],
        ["value", "عمودی", item.value],
      ] as const) {
        const number = Number(toAsciiDigits(value));
        if (!Number.isFinite(number) || number < 0 || number > 1) {
          issues.push({ rowId: item.id, field, message: `مقدار ${label} باید بین ۰ و ۱ باشد.` });
        }
      }
    }
  }

  if (draft.kind === "sankey") {
    for (const item of active) {
      if (!(Number(safeNumber(item.value, "-1")) > 0)) {
        issues.push({ rowId: item.id, field: "value", message: "مقدار جریان باید بزرگ‌تر از صفر باشد." });
      }
      if (item.first.trim() === item.second.trim()) {
        issues.push({ rowId: item.id, field: "second", message: "مبدأ و مقصد یک جریان نباید یکسان باشند." });
      }
    }
  }

  if (draft.kind === "gantt") {
    const rowIds = new Set(draft.rows.map((item) => item.id));
    for (const item of active) {
      const dependency = metaText(item.meta, "dependency");
      if (!dependency && !validIsoDate(item.second)) {
        issues.push({ rowId: item.id, field: "second", message: "تاریخ را به‌شکل ۲۰۲۶-۰۸-۰۱ وارد کنید یا یک وابستگی برگزینید." });
      }
      if (!/^\d+(?:\.\d+)?[dhw]$/iu.test(toAsciiDigits(item.value).trim())) {
        issues.push({ rowId: item.id, field: "value", message: "مدت را مانند ۵d، ۱۲h یا ۲w بنویسید." });
      }
      if (dependency === item.id || (dependency && !rowIds.has(dependency))) {
        issues.push({ rowId: item.id, field: "meta.dependency", message: "کار وابسته باید یک کار دیگر از همین نمودار باشد." });
      }
    }
  }

  if (draft.kind === "xychart") {
    const series = new Map<string, Set<string>>();
    for (const item of active) {
      if (!Number.isFinite(Number(toAsciiDigits(item.second)))) {
        issues.push({ rowId: item.id, field: "second", message: "مقدار محور عمودی باید عدد باشد." });
      }
      const name = cleanLabel(metaText(item.meta, "series"), "سری ۱");
      const points = series.get(name) ?? new Set<string>();
      if (points.has(item.first.trim())) {
        issues.push({ rowId: item.id, field: "first", message: "این مقدار افقی در همین سری تکرار شده است." });
      }
      points.add(item.first.trim());
      series.set(name, points);
    }
    const lengths = new Set(Array.from(series.values(), (points) => points.size));
    const firstPoints = [...(series.values().next().value ?? [])];
    if (lengths.size === 1 && [...series.values()].some(points => firstPoints.some(point => !points.has(point)))) {
      issues.push({ message: "مقدارهای محور افقی سری‌ها باید یکسان باشند؛ نام نقطه‌ها را بررسی کنید." });
    }
    if (lengths.size > 1) {
      const counts = Array.from(series, ([name, points]) => `«${name}»: ${points.size.toLocaleString("fa-IR")} نقطه`).join("، ");
      for (const [name] of series) {
        const item = active.find(row => cleanLabel(metaText(row.meta, "series"), "سری ۱") === name);
        issues.push({ rowId: item?.id, field: "first", message: `${counts}. نقطهٔ سری «${name}» را به سری درست منتقل کنید یا مقدارهای محور افقی مشترک را کامل کنید.` });
      }
    }
  }

  if (draft.kind === "gitgraph") {
    const mainBranch = cleanLabel(settingText(draft, "mainBranchName", "main"), "main");
    const branches = new Set<string>([mainBranch]);
    const commits = new Set<string>();
    for (const item of active) {
      const branch = cleanLabel(item.first, mainBranch);
      const action = metaText(item.meta, "action", "commit");
      branches.add(branch);
      if (action === "commit") {
        const commit = item.second.trim();
        if (commits.has(commit)) {
          issues.push({ rowId: item.id, field: "second", message: "شناسهٔ هر ثبت Git باید یکتا باشد." });
        }
        if (commit) commits.add(commit);
      } else if (action === "merge") {
        const source = item.value.trim();
        if (!branches.has(source)) {
          issues.push({ rowId: item.id, field: "value", message: "شاخهٔ مبدأ باید پیش از ادغام ساخته شده باشد." });
        } else if (source === branch) {
          issues.push({ rowId: item.id, field: "value", message: "یک شاخه را نمی‌توان با خودش ادغام کرد." });
        }
        if (item.second.trim()) commits.add(item.second.trim());
      } else if (action === "cherry-pick" && !commits.has(item.value.trim())) {
        issues.push({ rowId: item.id, field: "value", message: "شناسهٔ ثبت موردنظر باید پیش‌تر در نمودار وجود داشته باشد." });
      }
    }
  }

  if (draft.kind === "c4") {
    for (const item of active) {
      const boundary = metaText(item.meta, "boundary").trim();
      const parent = metaText(item.meta, "boundaryParent").trim();
      if (boundary && boundary === parent) {
        issues.push({ rowId: item.id, field: "meta.boundaryParent", message: "یک مرز نمی‌تواند والد خودش باشد." });
      }
    }
  }

  if (draft.kind === "sequence") {
    for (const item of active) {
      if (metaText(item.meta, "blockType", "none") !== "none" && !metaText(item.meta, "blockLabel").trim()) {
        issues.push({ rowId: item.id, field: "meta.blockLabel", message: "برای بلوک کنترلی یک عنوان ساده بنویسید." });
      }
    }
  }

  if (draft.kind === "state") {
    for (const item of active) {
      if (metaText(item.meta, "sourceParent").trim() === item.first.trim() && item.first.trim()) {
        issues.push({ rowId: item.id, field: "meta.sourceParent", message: "یک حالت نمی‌تواند حالت مادر خودش باشد." });
      }
      if (metaText(item.meta, "targetParent").trim() === item.second.trim() && item.second.trim()) {
        issues.push({ rowId: item.id, field: "meta.targetParent", message: "یک حالت نمی‌تواند حالت مادر خودش باشد." });
      }
    }
  }

  if (draft.kind === "architecture") {
    for (const item of active) {
      const parent = metaText(item.meta, "groupParent").trim();
      if (parent && [metaText(item.meta, "sourceGroup").trim(), metaText(item.meta, "targetGroup").trim()].includes(parent)) {
        issues.push({ rowId: item.id, field: "meta.groupParent", message: "یک گروه نمی‌تواند گروه مادر خودش باشد." });
      }
    }
  }

  if (draft.kind === "mindmap") {
    const edges = new Map<string, string[]>();
    for (const item of active) {
      const parent = cleanLabel(item.first, draft.title);
      const child = cleanLabel(item.second, "گره");
      edges.set(parent, [...(edges.get(parent) ?? []), child]);
      if (parent === child) {
        issues.push({ rowId: item.id, field: "second", message: "گره نمی‌تواند فرزند خودش باشد." });
      }
    }
    const visiting = new Set<string>();
    const visited = new Set<string>();
    const hasCycle = (node: string): boolean => {
      if (visiting.has(node)) return true;
      if (visited.has(node)) return false;
      visiting.add(node);
      const cycle = (edges.get(node) ?? []).some(hasCycle);
      visiting.delete(node);
      visited.add(node);
      return cycle;
    };
    if (Array.from(edges.keys()).some(hasCycle)) {
      issues.push({ message: "ساختار نقشهٔ ذهنی چرخه دارد؛ زنجیرهٔ والد و فرزند باید به موضوع اصلی برسد." });
    }
  }

  if (draft.kind === "packet") {
    const bitsPerRow = Number(toAsciiDigits(settingText(draft, "bitsPerRow", "32")));
    if (!Number.isInteger(bitsPerRow) || bitsPerRow < 1 || bitsPerRow > 256) {
      issues.push({ field: "settings.bitsPerRow", message: "تعداد بیت هر ردیف باید عددی بین ۱ تا ۲۵۶ باشد." });
    }
    for (const item of active) {
      const bits = Number(toAsciiDigits(item.value));
      const start = item.second.trim() ? Number(toAsciiDigits(item.second)) : 0;
      if (!Number.isInteger(bits) || bits < 1) {
        issues.push({ rowId: item.id, field: "value", message: "تعداد بیت باید یک عدد صحیح بزرگ‌تر از صفر باشد." });
      }
      if (item.second.trim() && (!Number.isInteger(start) || start < 0)) {
        issues.push({ rowId: item.id, field: "second", message: "بیت شروع باید یک عدد صحیح صفر یا بزرگ‌تر باشد." });
      }
    }
  }

  if (draft.kind === "radar") {
    const min = Number(toAsciiDigits(settingText(draft, "min", "0")));
    const max = Number(toAsciiDigits(settingText(draft, "max", "100")));
    const ticks = Number(toAsciiDigits(settingText(draft, "ticks", "5")));
    if (!Number.isFinite(min)) issues.push({ field: "settings.min", message: "کمینهٔ مقیاس باید عدد باشد." });
    if (!Number.isFinite(max)) issues.push({ field: "settings.max", message: "بیشینهٔ مقیاس باید عدد باشد." });
    if (Number.isFinite(min) && Number.isFinite(max) && max <= min) issues.push({ field: "settings.max", message: "بیشینه باید از کمینه بزرگ‌تر باشد." });
    if (!Number.isInteger(ticks) || ticks < 1 || ticks > 12) issues.push({ field: "settings.ticks", message: "تعداد حلقه‌ها باید عددی بین ۱ تا ۱۲ باشد." });
    const points = new Set<string>();
    for (const item of active) {
      if (!Number.isFinite(Number(toAsciiDigits(item.value)))) {
        issues.push({ rowId: item.id, field: "value", message: "مقدار هر معیار باید عدد باشد." });
      }
      const point = `${item.first.trim()}\u0000${item.second.trim()}`;
      if (points.has(point)) {
        issues.push({ rowId: item.id, field: "first", message: "هر معیار در هر سری فقط یک مقدار می‌تواند داشته باشد." });
      }
      points.add(point);
    }
  }

  if (draft.kind === "treemap" || draft.kind === "venn") {
    for (const item of active) {
      if (!(Number(toAsciiDigits(item.value)) > 0)) {
        issues.push({ rowId: item.id, field: "value", message: "اندازه باید عددی بزرگ‌تر از صفر باشد." });
      }
    }
  }

  if (draft.kind === "venn") {
    const sets = new Set(active.filter((item) => metaText(item.meta, "regionType", "set") === "set").map((item) => item.first.trim()));
    for (const item of active) {
      if (metaText(item.meta, "regionType", "set") !== "union") continue;
      const members = item.second.split(/[,،]/u).map((member) => member.trim()).filter(Boolean);
      if (members.length < 2) {
        issues.push({ rowId: item.id, field: "second", message: "برای هم‌پوشانی دست‌کم دو مجموعه را با ویرگول جدا کنید." });
      } else if (members.some((member) => !sets.has(member))) {
        issues.push({ rowId: item.id, field: "second", message: "همهٔ اعضای هم‌پوشانی باید پیش‌تر به‌عنوان مجموعه ساخته شده باشند." });
      }
    }
  }

  if (draft.kind === "wardley") {
    for (const [field, label, minimum] of [["width", "عرض", 500], ["height", "ارتفاع", 400]] as const) {
      const size = Number(toAsciiDigits(settingText(draft, field)));
      if (!Number.isFinite(size) || size < minimum) {
        issues.push({ field: `settings.${field}`, message: `${label} نقشه باید دست‌کم ${minimum.toLocaleString("fa-IR")} پیکسل باشد.` });
      }
    }
    const rowIds = new Set(active.map((item) => item.id));
    const labels = new Set<string>();
    for (const item of active) {
      for (const [field, label, value] of [["second", "دیده‌شدن", item.second], ["value", "بلوغ", item.value]] as const) {
        const number = Number(toAsciiDigits(value));
        if (!Number.isFinite(number) || number < 0 || number > 1) {
          issues.push({ rowId: item.id, field, message: `${label} باید عددی بین ۰ و ۱ باشد.` });
        }
      }
      if (labels.has(item.first.trim())) {
        issues.push({ rowId: item.id, field: "first", message: "نام هر جزء در نقشهٔ واردلی باید یکتا باشد." });
      }
      labels.add(item.first.trim());
      const dependency = metaText(item.meta, "dependsOn");
      if (dependency && (dependency === item.id || !rowIds.has(dependency))) {
        issues.push({ rowId: item.id, field: "meta.dependsOn", message: "وابستگی باید یک جزء دیگر از همین نقشه باشد." });
      }
      const evolve = metaText(item.meta, "evolveTarget").trim();
      if (evolve) {
        const number = Number(toAsciiDigits(evolve));
        if (!Number.isFinite(number) || number < 0 || number > 1) {
          issues.push({ rowId: item.id, field: "meta.evolveTarget", message: "بلوغ هدف باید عددی بین ۰ و ۱ باشد." });
        }
      }
    }
  }

  if (draft.kind === "block") {
    const columns = Number(toAsciiDigits(settingText(draft, "columns", "3")));
    if (!Number.isInteger(columns) || columns < 1 || columns > 12) {
      issues.push({ field: "settings.columns", message: "تعداد ستون‌ها باید عددی بین ۱ تا ۱۲ باشد." });
    }
  }

  if (draft.kind === "treeview") {
    for (const item of active) {
      const parents = item.second.split(/[\/›]/u).map((part) => part.trim()).filter(Boolean);
      if (parents.includes(item.first.trim())) {
        issues.push({ rowId: item.id, field: "second", message: "یک گره نمی‌تواند در مسیر والد خودش قرار بگیرد." });
      }
    }
  }

  return issues;
}

function appendMetadata(draft: SimpleDiagramDraft, code: string) {
  const metadata = encodeDraft(draft);
  return metadata ? `${code}\n%% raavi-simple:${metadata}` : code;
}

function relationIds() {
  const ids = new Map<string, string>();
  const idFor = (label: string, prefix: string) => {
    const normalized = cleanLabel(label, "مورد");
    const known = ids.get(normalized);
    if (known) return known;
    const next = `${prefix}${ids.size + 1}`;
    ids.set(normalized, next);
    return next;
  };
  return { ids, idFor };
}

function mermaidQuoted(value: string, fallback: string) {
  return JSON.stringify(cleanLabel(value, fallback));
}

function mermaidSingleQuoted(value: string) {
  return `'${value.replaceAll("'", "’")}'`;
}

const C4_LEVELS = {
  context: "C4Context",
  container: "C4Container",
  component: "C4Component",
  dynamic: "C4Dynamic",
  deployment: "C4Deployment",
} as const;

function c4Macro(type: string, level: keyof typeof C4_LEVELS, target: boolean) {
  const aliases: Record<string, string> = {
    person: "Person",
    person_ext: "Person_Ext",
    system: "System",
    system_ext: "System_Ext",
    system_db: "SystemDb",
    system_db_ext: "SystemDb_Ext",
    system_queue: "SystemQueue",
    system_queue_ext: "SystemQueue_Ext",
    container: "Container",
    container_ext: "Container_Ext",
    container_db: "ContainerDb",
    container_db_ext: "ContainerDb_Ext",
    container_queue: "ContainerQueue",
    container_queue_ext: "ContainerQueue_Ext",
    component: "Component",
    component_ext: "Component_Ext",
    component_db: "ComponentDb",
    component_db_ext: "ComponentDb_Ext",
    component_queue: "ComponentQueue",
    component_queue_ext: "ComponentQueue_Ext",
    deployment_node: "Deployment_Node",
  };
  const normalizedType = aliases[type] ?? type;
  const allowed = new Set([
    "Person",
    "Person_Ext",
    "System",
    "System_Ext",
    "SystemDb",
    "SystemDb_Ext",
    "SystemQueue",
    "SystemQueue_Ext",
    "Container",
    "Container_Ext",
    "ContainerDb",
    "ContainerDb_Ext",
    "ContainerQueue",
    "ContainerQueue_Ext",
    "Component",
    "Component_Ext",
    "ComponentDb",
    "ComponentDb_Ext",
    "ComponentQueue",
    "ComponentQueue_Ext",
    "Deployment_Node",
  ]);
  if (allowed.has(normalizedType)) return normalizedType;
  if (!target) return level === "component" ? "Container" : level === "deployment" ? "Deployment_Node" : "Person";
  if (level === "container" || level === "dynamic") return "Container";
  if (level === "component") return "Component";
  if (level === "deployment") return "Container";
  return "System";
}

function c4ElementLine(
  macro: string,
  id: string,
  label: string,
  technology: string,
  description: string,
) {
  const labelValue = mermaidQuoted(label, "جزء");
  const technologyValue = mermaidQuoted(technology, "");
  const descriptionValue = mermaidQuoted(description, "");
  if (macro === "Person" || macro === "Person_Ext" || macro.startsWith("System")) {
    return `    ${macro}(${id}, ${labelValue}, ${descriptionValue})`;
  }
  return `    ${macro}(${id}, ${labelValue}, ${technologyValue}, ${descriptionValue})`;
}

function c4BoundaryMacro(level: keyof typeof C4_LEVELS) {
  if (level === "context") return "System_Boundary";
  if (level === "container") return "Container_Boundary";
  return "Boundary";
}

function mindmapShape(id: string, label: string, shape: string, className = "") {
  const text = safeText(label, "گره");
  const suffix = className ? `:::${className}` : "";
  if (shape === "square") return `${id}[${text}]${suffix}`;
  if (shape === "rounded") return `${id}(${text})${suffix}`;
  if (shape === "circle") return `${id}((${text}))${suffix}`;
  if (shape === "bang") return `${id}))${text}((${suffix}`;
  if (shape === "cloud") return `${id})${text}(${suffix}`;
  if (shape === "hexagon") return `${id}{{${text}}}${suffix}`;
  return `${id}[${text}]${suffix}`;
}

function flowchartNode(id: string, label: string, shape: string) {
  const text = quotedLabel(label, "مرحله");
  if (shape === "rounded") return `${id}(${text})`;
  if (shape === "stadium") return `${id}([${text}])`;
  if (shape === "circle") return `${id}((${text}))`;
  if (shape === "diamond") return `${id}{${text}}`;
  if (shape === "cylinder") return `${id}[(${text})]`;
  if (shape === "hexagon") return `${id}{{${text}}}`;
  return `${id}[${text}]`;
}

function splitDetailLines(value: string) {
  return value
    .split(/[;\n]+/u)
    .map((line) => line.replace(/[{}]/gu, " ").trim())
    .filter(Boolean);
}

function safeArchitecturePort(value: string, fallback: string) {
  return ["L", "R", "T", "B"].includes(value) ? value : fallback;
}

export function simpleDraftToCode(draft: SimpleDiagramDraft) {
  const rows = activeRows(draft);
  const horizontal = draft.orientation !== "vertical";
  let code = "";

  if (draft.kind === "swimlane") {
    const { idFor: nodeIdFor } = relationIds();
    const { idFor: laneIdFor } = relationIds();
    const nodes = new Map<string, { lane: string; shape: string }>();
    for (const item of rows) {
      const lane = cleanLabel(item.first, "مسئول");
      const source = cleanLabel(item.second, "مرحله");
      nodes.set(source, { lane, shape: metaText(item.meta, "shape", "rect") });
      if (item.value.trim()) {
        const target = cleanLabel(item.value, "مرحلهٔ بعد");
        if (!nodes.has(target)) {
          nodes.set(target, {
            lane: cleanLabel(metaText(item.meta, "targetLane"), lane),
            shape: metaText(item.meta, "targetShape", "rect"),
          });
        }
      }
    }
    const lanes = Array.from(new Set(Array.from(nodes.values(), (node) => node.lane)));
    const laneLines = lanes.flatMap((lane) => [
      `    subgraph ${laneIdFor(lane, "lane")}[${quotedLabel(lane, "مسئول")}]`,
      ...Array.from(nodes).filter(([, node]) => node.lane === lane).map(([label, node]) => `        ${flowchartNode(nodeIdFor(label, "step"), label, node.shape)}`),
      "    end",
    ]);
    const edgeLines = rows.filter((item) => item.value.trim()).map((item) => {
      const label = safeText(metaText(item.meta, "edgeLabel"), "");
      return `    ${nodeIdFor(item.second, "step")} -->${label ? `|${label}|` : ""} ${nodeIdFor(item.value, "step")}`;
    });
    code = [
      `swimlane-beta ${horizontal ? "RL" : "TB"}`,
      `    accTitle: ${safeText(draft.title, "مسیر مسئولیت")}`,
      ...laneLines,
      ...edgeLines,
    ].join("\n");
  } else if (draft.kind === "block") {
    const { ids, idFor } = relationIds();
    const nodes = new Map<string, { shape: string; width: string }>();
    const remember = (label: string, shape: string, width: string) => {
      const cleaned = cleanLabel(label, "بلوک");
      idFor(cleaned, "block");
      if (!nodes.has(cleaned)) nodes.set(cleaned, { shape, width });
    };
    for (const item of rows) {
      remember(item.first, metaText(item.meta, "sourceShape", "rect"), metaText(item.meta, "sourceWidth", "1"));
      remember(item.second, metaText(item.meta, "targetShape", "rect"), metaText(item.meta, "targetWidth", "1"));
    }
    const declarations = Array.from(ids, ([label, id]) => {
      const node = nodes.get(label) ?? { shape: "rect", width: "1" };
      const width = Math.max(1, Math.min(12, Math.trunc(Number(safePositiveNumber(node.width)))));
      return `    ${flowchartNode(id, label, node.shape)}${width > 1 ? `:${width}` : ""}`;
    });
    const links: Record<string, string> = { arrow: "-->", line: "---", dotted: "-.->", thick: "==>" };
    code = [
      "block-beta",
      `    columns ${Math.max(1, Math.min(12, Math.trunc(Number(safePositiveNumber(settingText(draft, "columns", "3"))))))}`,
      ...declarations,
      ...rows.map((item) => {
        const label = safeText(item.value, "");
        const link = links[metaText(item.meta, "linkType", "arrow")] ?? "-->";
        return `    ${idFor(item.first, "block")} ${link}${label ? `|${label}|` : ""} ${idFor(item.second, "block")}`;
      }),
    ].join("\n");
  } else if (draft.kind === "packet") {
    const packetCode = [
      "packet",
      `    title ${safeText(draft.title, "ساختار بسته")}`,
      ...rows.map((item) => {
        const bits = Math.max(1, Math.trunc(Number(safePositiveNumber(item.value))));
        const start = item.second.trim() ? Math.max(0, Math.trunc(Number(safeNumber(item.second)))) : null;
        const range = start === null ? `+${bits}` : bits === 1 ? `${start}` : `${start}-${start + bits - 1}`;
        return `    ${range}: ${quotedLabel(item.first, "فیلد")}`;
      }),
    ].join("\n");
    code = withFrontmatter(packetCode, [
      "  packet:",
      `    bitsPerRow: ${Math.max(1, Math.min(256, Math.trunc(Number(safePositiveNumber(settingText(draft, "bitsPerRow", "32"))))))}`,
    ]);
  } else if (draft.kind === "radar") {
    const { ids: axes, idFor: axisIdFor } = relationIds();
    const { idFor: curveIdFor } = relationIds();
    const series = new Map<string, SimpleDiagramRow[]>();
    for (const item of rows) {
      axisIdFor(item.first, "axis");
      const name = cleanLabel(item.second, "سری");
      series.set(name, [...(series.get(name) ?? []), item]);
    }
    code = [
      "radar-beta",
      `    title ${safeText(draft.title, "نمودار رادار")}`,
      `    axis ${Array.from(axes, ([label, id]) => `${id}[${quotedLabel(label, "معیار")}]`).join(", ")}`,
      ...Array.from(series, ([name, items]) => `    curve ${curveIdFor(name, "curve")}[${quotedLabel(name, "سری")}] { ${items.map((item) => `${axisIdFor(item.first, "axis")}: ${safeFiniteNumber(item.value)}`).join(", ")} }`),
      `    showLegend ${settingFlag(draft, "showLegend", true)}`,
      `    min ${safeFiniteNumber(settingText(draft, "min", "0"))}`,
      `    max ${safeFiniteNumber(settingText(draft, "max", "100"), "100")}`,
      `    graticule ${settingText(draft, "graticule", "polygon") === "circle" ? "circle" : "polygon"}`,
      `    ticks ${Math.max(1, Math.min(12, Math.trunc(Number(safePositiveNumber(settingText(draft, "ticks", "5"))))))}`,
    ].join("\n");
  } else if (draft.kind === "eventmodeling") {
    const labelComments: string[] = [];
    const tokenFor = (label: string, prefix: string, index: number) => {
      const token = `${prefix}${index + 1}`;
      labelComments.push(`%% raavi-label:${token}:${encodeURIComponent(cleanLabel(label, "موجودیت"))}`);
      return token;
    };
    const frameLines = rows.map((item, index) => {
      const entity = tokenFor(item.first, "RAAVI_FA_", index);
      const namespace = item.second.trim() ? `${tokenFor(item.second, "RAAVI_NS_", index)}.` : "";
      const entityTypes = new Set(["ui", "cmd", "evt", "rmo", "pcr"]);
      const entityType = metaText(item.meta, "entityType", "evt");
      const frame = metaFlag(item.meta, "resetFrame") ? "rf" : "tf";
      const data = item.value.trim() ? ` { ${cleanLabel(item.value, "")} }` : "";
      return `    ${frame} ${String(index + 1).padStart(2, "0")} ${entityTypes.has(entityType) ? entityType : "evt"} ${namespace}${entity}${data}`;
    });
    code = [
      "---",
      `title: ${yamlString(cleanLabel(draft.title, "مدل‌سازی رویداد"))}`,
      "---",
      "eventmodeling",
      ...frameLines,
      ...labelComments,
    ].join("\n");
  } else if (draft.kind === "flowchart") {
    const { idFor } = relationIds();
    const { idFor: groupIdFor } = relationIds();
    const nodes = new Map<string, { id: string; shape: string; group: string }>();
    const rememberNode = (label: string, shape: string, group: string) => {
      const cleaned = cleanLabel(label, "مرحله");
      if (!nodes.has(cleaned)) {
        nodes.set(cleaned, {
          id: idFor(cleaned, "n"),
          shape,
          group: cleanLabel(group, ""),
        });
      }
    };
    for (const item of rows) {
      rememberNode(item.first, metaText(item.meta, "sourceShape", "rect"), metaText(item.meta, "sourceGroup"));
      rememberNode(item.second, metaText(item.meta, "targetShape", "rect"), metaText(item.meta, "targetGroup"));
    }
    const nodeLines: string[] = [];
    const groups = Array.from(new Set(Array.from(nodes.values(), (node) => node.group).filter(Boolean)));
    for (const group of groups) {
      nodeLines.push(`    subgraph ${groupIdFor(group, "group")}[${quotedLabel(group, "گروه")}]`);
      for (const [label, node] of nodes) {
        if (node.group === group) nodeLines.push(`        ${flowchartNode(node.id, label, node.shape)}`);
      }
      nodeLines.push("    end");
    }
    for (const [label, node] of nodes) {
      if (!node.group) nodeLines.push(`    ${flowchartNode(node.id, label, node.shape)}`);
    }
    const linkTypes: Record<string, string> = {
      arrow: "-->",
      line: "---",
      dotted: "-.->",
      thick: "==>",
      bidirectional: "<-->",
    };
    code = [
      `flowchart ${horizontal ? "RL" : "TB"}`,
      ...nodeLines,
      ...rows.map((item) => {
        const first = cleanLabel(item.first, "مرحله");
        const second = cleanLabel(item.second, "مرحلهٔ بعد");
        const label = safeText(item.value, "");
        const link = linkTypes[metaText(item.meta, "linkType", "arrow")] ?? "-->";
        return `    ${idFor(first, "n")} ${link}${label ? `|${label}|` : ""} ${idFor(second, "n")}`;
      }),
    ].join("\n");
  } else if (draft.kind === "sequence") {
    const { ids, idFor } = relationIds();
    const participants = new Map<string, { type: string; group: string }>();
    for (const item of rows) {
      const first = cleanLabel(item.first, "فرستنده");
      const second = cleanLabel(item.second, "گیرنده");
      idFor(first, "p");
      idFor(second, "p");
      if (!participants.has(first)) participants.set(first, { type: metaText(item.meta, "sourceType", "participant"), group: metaText(item.meta, "sourceGroup") });
      if (!participants.has(second)) participants.set(second, { type: metaText(item.meta, "targetType", "participant"), group: metaText(item.meta, "targetGroup") });
    }
    const allowedTypes = new Set(["actor", "boundary", "control", "entity", "database", "collections", "queue"]);
    const declarationFor = (label: string, id: string) => {
      const type = participants.get(label)?.type ?? "participant";
      return type === "participant" || !allowedTypes.has(type)
        ? `    participant ${id} as ${safeText(label, "نقش")}`
        : `    participant ${id}@{ "type": "${type}" } as ${safeText(label, "نقش")}`;
    };
    const participantLines: string[] = [];
    const groups = Array.from(new Set(Array.from(participants.values(), (participant) => participant.group).filter(Boolean)));
    for (const group of groups) {
      participantLines.push(`    box ${safeText(group, "گروه")}`);
      for (const [label, id] of ids) {
        if (participants.get(label)?.group === group) participantLines.push(`    ${declarationFor(label, id).trim()}`);
      }
      participantLines.push("    end");
    }
    for (const [label, id] of ids) {
      if (!participants.get(label)?.group) participantLines.push(declarationFor(label, id));
    }
    const messageTypes: Record<string, string> = {
      sync: "->>",
      return: "-->>",
      async: "-)",
      lost: "-x",
      solid: "->",
    };
    const messageLines = rows.flatMap((item) => {
      const sourceId = idFor(item.first, "p");
      const targetId = idFor(item.second, "p");
      const blockType = metaText(item.meta, "blockType", "none");
      const blockLabel = safeText(metaText(item.meta, "blockLabel"), "بخش");
      const lines: string[] = [];
      if (["loop", "opt", "alt", "par", "critical", "break"].includes(blockType)) lines.push(`    ${blockType} ${blockLabel}`);
      lines.push(`    ${sourceId}${messageTypes[metaText(item.meta, "messageType", "sync")] ?? "->>"}${targetId}: ${safeText(item.value, "پیام")}`);
      if (metaFlag(item.meta, "activate")) lines.push(`    activate ${targetId}`);
      const note = metaText(item.meta, "note").trim();
      if (note) lines.push(`    Note right of ${targetId}: ${safeText(note, "یادداشت")}`);
      if (metaFlag(item.meta, "deactivate")) lines.push(`    deactivate ${targetId}`);
      if (["loop", "opt", "alt", "par", "critical", "break"].includes(blockType)) lines.push("    end");
      return lines;
    });
    code = [
      "sequenceDiagram",
      ...participantLines,
      ...messageLines,
    ].join("\n");
  } else if (draft.kind === "class") {
    const { ids, idFor } = relationIds();
    const classes = new Map<string, { members: string[]; stereotype: string; namespace: string }>();
    const rememberClass = (label: string, members: string, stereotype: string, namespace: string) => {
      const cleaned = cleanLabel(label, "کلاس");
      idFor(cleaned, "c");
      if (!classes.has(cleaned)) classes.set(cleaned, { members: splitDetailLines(members), stereotype: safeText(stereotype, ""), namespace: cleanLabel(namespace, "") });
    };
    for (const item of rows) {
      rememberClass(item.first, metaText(item.meta, "sourceMembers"), metaText(item.meta, "sourceStereotype"), metaText(item.meta, "sourceNamespace"));
      rememberClass(item.second, metaText(item.meta, "targetMembers"), metaText(item.meta, "targetStereotype"), metaText(item.meta, "targetNamespace"));
    }
    const declarationFor = (label: string, id: string) => {
      const detail = classes.get(label);
      const content = [...(detail?.stereotype ? [`<<${detail.stereotype}>>`] : []), ...(detail?.members ?? [])];
      if (!content.length) return [`    class ${id}[${quotedLabel(label, "کلاس")}]`];
      return [`    class ${id}[${quotedLabel(label, "کلاس")}] {`, ...content.map((line) => `        ${line}`), "    }"];
    };
    const classLines: string[] = [];
    const { idFor: namespaceIdFor } = relationIds();
    const namespaces = Array.from(new Set(Array.from(classes.values(), (item) => item.namespace).filter(Boolean)));
    for (const namespace of namespaces) {
      classLines.push(`    namespace ${namespaceIdFor(namespace, "namespace")}[${quotedLabel(namespace, "فضای نام")}] {`);
      for (const [label, id] of ids) {
        if (classes.get(label)?.namespace === namespace) classLines.push(...declarationFor(label, id).map((line) => `    ${line.trimStart()}`));
      }
      classLines.push("    }");
    }
    for (const [label, id] of ids) {
      if (!classes.get(label)?.namespace) classLines.push(...declarationFor(label, id));
    }
    const relationTypes: Record<string, string> = {
      inheritance: "<|--",
      composition: "*--",
      aggregation: "o--",
      association: "-->",
      solid: "--",
      dependency: "..>",
      realization: "..|>",
      dashed: "..",
    };
    code = [
      "classDiagram",
      `    direction ${horizontal ? "RL" : "TB"}`,
      ...classLines,
      ...rows.map((item) => {
        const sourceCardinality = safeText(metaText(item.meta, "sourceCardinality"), "");
        const targetCardinality = safeText(metaText(item.meta, "targetCardinality"), "");
        const relation = relationTypes[metaText(item.meta, "relationType", "association")] ?? "-->";
        const label = safeText(item.value, "");
        return `    ${idFor(item.first, "c")}${sourceCardinality ? ` "${sourceCardinality}"` : ""} ${relation}${targetCardinality ? ` "${targetCardinality}"` : ""} ${idFor(item.second, "c")}${label ? ` : ${label}` : ""}`;
      }),
    ].join("\n");
  } else if (draft.kind === "state") {
    const { ids, idFor } = relationIds();
    const states = new Map<string, { kind: string; parent: string }>();
    const rememberState = (label: string, kind: string, parent: string) => {
      if (kind === "start" || kind === "end") return;
      const cleaned = cleanLabel(label, "حالت");
      idFor(cleaned, "s");
      if (!states.has(cleaned)) states.set(cleaned, { kind, parent: cleanLabel(parent, "") });
    };
    for (const item of rows) {
      rememberState(item.first, metaText(item.meta, "sourceKind", "normal"), metaText(item.meta, "sourceParent"));
      rememberState(item.second, metaText(item.meta, "targetKind", "normal"), metaText(item.meta, "targetParent"));
    }
    const stateDeclaration = (label: string, id: string) => {
      const kind = states.get(label)?.kind;
      if (["choice", "fork", "join"].includes(kind ?? "")) return `    state ${id} <<${kind}>>`;
      return `    state ${quotedLabel(label, "حالت")} as ${id}`;
    };
    const stateLines: string[] = [];
    const { idFor: parentIdFor } = relationIds();
    const parents = Array.from(new Set(Array.from(states.values(), (state) => state.parent).filter(Boolean)));
    for (const parent of parents) {
      stateLines.push(`    state ${quotedLabel(parent, "حالت مادر")} as ${parentIdFor(parent, "parent")} {`);
      for (const [label, id] of ids) {
        if (states.get(label)?.parent === parent) stateLines.push(`    ${stateDeclaration(label, id).trimStart()}`);
      }
      stateLines.push("    }");
    }
    for (const [label, id] of ids) {
      if (!states.get(label)?.parent) stateLines.push(stateDeclaration(label, id));
    }
    const stateRef = (label: string, kind: string) => kind === "start" || kind === "end" ? "[*]" : idFor(label, "s");
    const hasExplicitStart = rows.some((item) => metaText(item.meta, "sourceKind") === "start" || metaText(item.meta, "targetKind") === "start");
    const firstState = rows[0] ? stateRef(rows[0].first, metaText(rows[0].meta, "sourceKind", "normal")) : "s1";
    const transitionLines = rows.flatMap((item) => {
      const sourceId = stateRef(item.first, metaText(item.meta, "sourceKind", "normal"));
      const targetKind = metaText(item.meta, "targetKind", "normal");
      const targetId = stateRef(item.second, targetKind);
      const lines = [`    ${sourceId} --> ${targetId}${item.value.trim() ? ` : ${safeText(item.value, "تغییر")}` : ""}`];
      const note = metaText(item.meta, "note").trim();
      if (note && targetId !== "[*]") lines.push(`    note right of ${targetId} : ${safeText(note, "یادداشت")}`);
      return lines;
    });
    code = [
      "stateDiagram-v2",
      `    direction ${horizontal ? "RL" : "TB"}`,
      ...stateLines,
      ...(!hasExplicitStart && firstState !== "[*]" ? [`    [*] --> ${firstState}`] : []),
      ...transitionLines,
    ].join("\n");
  } else if (draft.kind === "er") {
    const { ids, idFor } = relationIds();
    const entities = new Map<string, Array<{ name: string; type: string; key: string }>>();
    const rememberEntity = (label: string, attribute: string, type: string, key: string) => {
      const cleaned = cleanLabel(label, "موجودیت");
      idFor(cleaned, "ENTITY_");
      const current = entities.get(cleaned) ?? [];
      if (attribute.trim() && !current.some((item) => item.name === attribute.trim())) current.push({ name: attribute.trim(), type: safeText(type, "string"), key });
      entities.set(cleaned, current);
    };
    for (const item of rows) {
      rememberEntity(item.first, metaText(item.meta, "sourceAttribute"), metaText(item.meta, "sourceAttributeType", "string"), metaText(item.meta, "sourceAttributeKey"));
      rememberEntity(item.second, metaText(item.meta, "targetAttribute"), metaText(item.meta, "targetAttributeType", "string"), metaText(item.meta, "targetAttributeKey"));
    }
    const entityLines = Array.from(ids).flatMap(([label, id]) => {
      const attributes = entities.get(label) ?? [];
      if (!attributes.length) return [`    ${id}[${quotedLabel(label, "موجودیت")}]`];
      return [
        `    ${id}[${quotedLabel(label, "موجودیت")}] {`,
        ...attributes.map((attribute, index) => `        ${attribute.type} field${index + 1}${["PK", "FK", "UK"].includes(attribute.key) ? ` ${attribute.key}` : ""} ${quotedLabel(attribute.name, "ویژگی")}`),
        "    }",
      ];
    });
    const leftCardinality: Record<string, string> = { one: "||", "zero-one": "|o", "one-many": "}|", "zero-many": "}o" };
    const rightCardinality: Record<string, string> = { one: "||", "zero-one": "o|", "one-many": "|{", "zero-many": "o{" };
    code = [
      "erDiagram",
      `    direction ${horizontal ? "RL" : "TB"}`,
      ...entityLines,
      ...rows.map((item) => {
        const left = leftCardinality[metaText(item.meta, "sourceCardinality", "one")] ?? "||";
        const right = rightCardinality[metaText(item.meta, "targetCardinality", "zero-many")] ?? "o{";
        const relationship = metaFlag(item.meta, "identifying", true) ? "--" : "..";
        return `    ${idFor(item.first, "ENTITY_")} ${left}${relationship}${right} ${idFor(item.second, "ENTITY_")} : ${safeText(item.value, "مرتبط")}`;
      }),
    ].join("\n");
  } else if (draft.kind === "requirement") {
    const requirementTypes = new Set(["requirement", "functionalRequirement", "interfaceRequirement", "performanceRequirement", "physicalRequirement", "designConstraint"]);
    const risks = new Set(["low", "medium", "high"]);
    const verificationMethods = new Set(["analysis", "inspection", "test", "demonstration"]);
    const relationships = new Set(["contains", "copies", "derives", "satisfies", "verifies", "refines", "traces"]);
    code = [
      "requirementDiagram",
      `    direction ${horizontal ? "RL" : "TB"}`,
      ...rows.flatMap((item, index) => {
        const requirementType = metaText(item.meta, "requirementType", "requirement");
        const risk = metaText(item.meta, "risk", "low");
        const verification = metaText(item.meta, "verificationMethod", "test");
        const relationship = metaText(item.meta, "relationship", "satisfies");
        return [
        `    ${requirementTypes.has(requirementType) ? requirementType : "requirement"} req${index + 1} {`,
        `      id: ${index + 1}`,
        `      text: "${safeText(item.value || item.first, "نیازمندی")}"`,
        `      risk: ${risks.has(risk) ? risk : "low"}`,
        `      verifymethod: ${verificationMethods.has(verification) ? verification : "test"}`,
        "    }",
        `    element component${index + 1} {`,
        `      type: "${safeText(metaText(item.meta, "elementType", item.second), "component")}"`,
        ...(metaText(item.meta, "docref").trim() ? [`      docref: "${safeText(metaText(item.meta, "docref"), "سند")}"`] : []),
        "    }",
        `    component${index + 1} - ${relationships.has(relationship) ? relationship : "satisfies"} -> req${index + 1}`,
      ];
      }),
    ].join("\n");
  } else if (draft.kind === "architecture") {
    const { ids, idFor } = relationIds();
    const { ids: groupIds, idFor: groupIdFor } = relationIds();
    const groups = new Map<string, { parent: string }>();
    const nodes = new Map<string, { type: string; icon: string; group: string }>();
    const rememberGroup = (group: string, parent: string) => {
      const cleaned = cleanLabel(group, "");
      if (!cleaned) return;
      const cleanedParent = cleanLabel(parent, "");
      groupIdFor(cleaned, "group");
      if (!groups.has(cleaned)) groups.set(cleaned, { parent: cleanedParent === cleaned ? "" : cleanedParent });
      if (cleanedParent && cleanedParent !== cleaned) {
        groupIdFor(cleanedParent, "group");
        if (!groups.has(cleanedParent)) groups.set(cleanedParent, { parent: "" });
      }
    };
    const rememberNode = (label: string, type: string, icon: string, group: string, parent: string) => {
      const cleaned = cleanLabel(label, "سرویس");
      const cleanedGroup = cleanLabel(group, "");
      idFor(cleaned, "service");
      rememberGroup(cleanedGroup, parent);
      if (!nodes.has(cleaned)) nodes.set(cleaned, { type, icon, group: cleanedGroup });
    };
    for (const item of rows) {
      const parent = metaText(item.meta, "groupParent");
      rememberNode(item.first, metaText(item.meta, "sourceType", "service"), metaText(item.meta, "sourceIcon", "server"), metaText(item.meta, "sourceGroup"), parent);
      rememberNode(item.second, metaText(item.meta, "targetType", "service"), metaText(item.meta, "targetIcon", "server"), metaText(item.meta, "targetGroup"), parent);
    }
    const groupLines = Array.from(groupIds)
      .sort(([first], [second]) => Number(Boolean(groups.get(first)?.parent)) - Number(Boolean(groups.get(second)?.parent)))
      .map(([label, id]) => {
        const parent = groups.get(label)?.parent;
        return `    group ${id}(cloud)[${quotedLabel(label, "گروه")}]${parent ? ` in ${groupIdFor(parent, "group")}` : ""}`;
      });
    const allowedIcons = new Set(["cloud", "database", "disk", "internet", "server"]);
    const serviceLines = Array.from(ids, ([label, id]) => {
      const node = nodes.get(label);
      const group = node?.group ? ` in ${groupIdFor(node.group, "group")}` : "";
      if (node?.type === "junction") return `    junction ${id}${group}`;
      const icon = allowedIcons.has(node?.icon ?? "") ? node?.icon : "server";
      return `    service ${id}(${icon})[${quotedLabel(label, "سرویس")}]${group}`;
    });
    const arrowTypes: Record<string, string> = { none: "--", forward: "-->", backward: "<--", both: "<-->" };
    const connectionLines = rows.flatMap((item) => {
      const defaultSourcePort = horizontal ? "R" : "B";
      const defaultTargetPort = horizontal ? "L" : "T";
      const sourcePortValue = metaText(item.meta, "sourcePort", defaultSourcePort);
      const targetPortValue = metaText(item.meta, "targetPort", defaultTargetPort);
      const sourcePort = safeArchitecturePort(!horizontal && sourcePortValue === "R" ? "B" : sourcePortValue, defaultSourcePort);
      const targetPort = safeArchitecturePort(!horizontal && targetPortValue === "L" ? "T" : targetPortValue, defaultTargetPort);
      const sourceId = idFor(item.first, "service");
      const targetId = idFor(item.second, "service");
      const lines = [`    ${sourceId}:${sourcePort} ${arrowTypes[metaText(item.meta, "arrow", "forward")] ?? "-->"} ${targetPort}:${targetId}`];
      const align = metaText(item.meta, "align", "none");
      if (align === "row" || align === "column") lines.push(`    align ${align} ${sourceId} ${targetId}`);
      return lines;
    });
    code = [
      "architecture-beta",
      ...groupLines,
      ...serviceLines,
      ...connectionLines,
    ].join("\n");
  } else if (draft.kind === "c4") {
    const configuredLevel = settingText(draft, "c4Level", "context");
    const level = configuredLevel in C4_LEVELS
      ? (configuredLevel as keyof typeof C4_LEVELS)
      : "context";
    const shapesPerRow = Math.max(1, Math.round(Number(safeNumber(settingText(draft, "shapesPerRow"), "4"))));
    const boundariesPerRow = Math.max(1, Math.round(Number(safeNumber(settingText(draft, "boundariesPerRow"), "2"))));

    if (level === "deployment") {
      const { idFor } = relationIds();
      const groups = new Map<string, SimpleDiagramRow[]>();
      for (const item of rows) {
        const source = cleanLabel(item.first, "گرهٔ استقرار");
        groups.set(source, [...(groups.get(source) ?? []), item]);
      }
      const declarations: string[] = [];
      const relationships: string[] = [];
      const declaredTargets = new Set<string>();
      let boundarySequence = 0;
      for (const [source, items] of groups) {
        const sourceId = idFor(source, "node");
        declarations.push(`    Deployment_Node(${sourceId}, ${mermaidQuoted(source, "گرهٔ استقرار")}, "", ${mermaidQuoted(metaText(items[0]?.meta, "sourceDescription"), "")}) {`);
        for (const item of items) {
          const target = cleanLabel(item.second, "کانتینر");
          const targetId = idFor(target, "element");
          const nestedLabels = [metaText(item.meta, "boundaryParent"), metaText(item.meta, "boundary")]
            .map((label) => cleanLabel(label, ""))
            .filter((label, index, all) => label && all.indexOf(label) === index);
          nestedLabels.forEach((label, depth) => {
            boundarySequence += 1;
            declarations.push(`${"    ".repeat(depth + 2)}Deployment_Node(deploymentBoundary${boundarySequence}, ${mermaidQuoted(label, "مرز استقرار")}, "", "") {`);
          });
          if (!declaredTargets.has(target)) {
            const targetMacro = c4Macro(metaText(item.meta, "targetType"), level, true);
            declarations.push(
              `${"    ".repeat(nestedLabels.length + 2)}${c4ElementLine(targetMacro === "Deployment_Node" ? "Container" : targetMacro, targetId, target, metaText(item.meta, "technology"), metaText(item.meta, "description")).trim()}`,
            );
            declaredTargets.add(target);
          }
          for (let depth = nestedLabels.length - 1; depth >= 0; depth -= 1) {
            declarations.push(`${"    ".repeat(depth + 2)}}`);
          }
          relationships.push(`    Rel(${sourceId}, ${targetId}, ${mermaidQuoted(item.value, "میزبان")})`);
        }
        declarations.push("    }");
      }
      code = [
        C4_LEVELS[level],
        `    title ${safeText(draft.title, "معماری استقرار")}`,
        ...declarations,
        ...relationships,
        `    UpdateLayoutConfig($c4ShapeInRow="${shapesPerRow}", $c4BoundaryInRow="${boundariesPerRow}")`,
      ].join("\n");
    } else {
    const { idFor } = relationIds();
    const elements = new Map<
      string,
      { line: string; boundary: string; parent: string }
    >();
    const relationships: string[] = [];
    for (const item of rows) {
      const sourceLabel = cleanLabel(item.first, "کاربر");
      const targetLabel = cleanLabel(item.second, "سامانه");
      const sourceId = idFor(sourceLabel, "element");
      const targetId = idFor(targetLabel, "element");
      const sourceMacro = c4Macro(metaText(item.meta, "sourceType"), level, false);
      const targetMacro = c4Macro(metaText(item.meta, "targetType"), level, true);
      if (!elements.has(sourceLabel)) {
        elements.set(sourceLabel, {
          line: c4ElementLine(sourceMacro, sourceId, sourceLabel, "", metaText(item.meta, "sourceDescription")),
          boundary: metaText(item.meta, "sourceBoundary"),
          parent: metaText(item.meta, "sourceBoundaryParent"),
        });
      }
      if (!elements.has(targetLabel)) {
        elements.set(targetLabel, {
          line: c4ElementLine(
            targetMacro,
            targetId,
            targetLabel,
            metaText(item.meta, "technology"),
            metaText(item.meta, "description"),
          ),
          boundary: metaText(item.meta, "boundary"),
          parent: metaText(item.meta, "boundaryParent"),
        });
      }
      relationships.push(
        `    Rel(${sourceId}, ${targetId}, ${mermaidQuoted(item.value, "استفاده می‌کند")})`,
      );
    }

    const boundaries = new Map<
      string,
      { id: string; parent: string; lines: string[] }
    >();
    for (const element of elements.values()) {
      const boundary = cleanLabel(element.boundary, "");
      if (!boundary) continue;
      const known = boundaries.get(boundary) ?? {
        id: `boundary${boundaries.size + 1}`,
        parent: cleanLabel(element.parent, ""),
        lines: [],
      };
      if (!known.parent && element.parent) known.parent = cleanLabel(element.parent, "");
      known.lines.push(element.line.trim());
      boundaries.set(boundary, known);
      if (known.parent && !boundaries.has(known.parent)) {
        boundaries.set(known.parent, {
          id: `boundary${boundaries.size + 1}`,
          parent: "",
          lines: [],
        });
      }
    }
    const renderBoundary = (name: string, depth: number): string[] => {
      const boundary = boundaries.get(name);
      if (!boundary) return [];
      const indent = "    ".repeat(depth);
      const children = Array.from(boundaries)
        .filter(([, child]) => child.parent === name)
        .flatMap(([childName]) => renderBoundary(childName, depth + 1));
      return [
        `${indent}${c4BoundaryMacro(level)}(${boundary.id}, ${mermaidQuoted(name, "مرز")}) {`,
        ...boundary.lines.map((line) => `${indent}    ${line}`),
        ...children,
        `${indent}}`,
      ];
    };
    const globalElements = Array.from(elements.values())
      .filter((element) => !cleanLabel(element.boundary, ""))
      .map((element) => element.line);
    const rootBoundaries = Array.from(boundaries)
      .filter(([name, boundary]) => !boundary.parent || !boundaries.has(boundary.parent) || boundary.parent === name)
      .flatMap(([name]) => renderBoundary(name, 1));
    code = [
      C4_LEVELS[level],
      `    title ${safeText(draft.title, "معماری سامانه")}`,
      ...globalElements,
      ...rootBoundaries,
      ...relationships,
      `    UpdateLayoutConfig($c4ShapeInRow="${shapesPerRow}", $c4BoundaryInRow="${boundariesPerRow}")`,
    ].join("\n");
    }
  } else if (draft.kind === "gantt") {
    const taskIds = new Map(draft.rows.map((item, index) => [item.id, `task${index + 1}`]));
    let currentSection = "";
    const taskLines: string[] = [];
    rows.forEach((item, index) => {
      const section = cleanLabel(metaText(item.meta, "section"), "برنامه");
      if (section !== currentSection) {
        taskLines.push(`    section ${safeText(section, "برنامه")}`);
        currentSection = section;
      }
      const status = metaText(item.meta, "status", "none");
      const tags = [status === "none" ? "" : status, metaFlag(item.meta, "milestone") ? "milestone" : ""].filter(Boolean);
      const dependency = metaText(item.meta, "dependency");
      const start = dependency && taskIds.has(dependency)
        ? `after ${taskIds.get(dependency)}`
        : safeDate(item.second, `2026-08-${String(index + 1).padStart(2, "0")}`);
      const duration = metaFlag(item.meta, "milestone") ? "0d" : safeDuration(item.value);
      taskLines.push(
        `    ${safeText(item.first, "کار")} :${tags.length ? `${tags.join(", ")}, ` : ""}${taskIds.get(item.id) ?? `task${index + 1}`}, ${start}, ${duration}`,
      );
    });
    const ganttLines = [
      "gantt",
      `    title ${safeText(draft.title, "برنامهٔ کار")}`,
      `    dateFormat ${safeText(settingText(draft, "dateFormat", "YYYY-MM-DD"), "YYYY-MM-DD")}`,
      `    axisFormat ${cleanLabel(settingText(draft, "axisFormat", "%Y-%m-%d"), "%Y-%m-%d")}`,
      `    tickInterval ${safeText(settingText(draft, "tickInterval", "1week"), "1week")}`,
      ...(settingText(draft, "excludes").trim()
        ? [`    excludes ${safeText(settingText(draft, "excludes"), "weekends")}`]
        : []),
      `    todayMarker ${settingFlag(draft, "todayMarker", true) ? "on" : "off"}`,
      ...taskLines,
    ];
    code = ganttLines.join("\n");
  } else if (draft.kind === "timeline") {
    let currentSection = "";
    let currentPeriod = "";
    const eventLines: string[] = [];
    for (const item of rows) {
      const section = cleanLabel(metaText(item.meta, "section"), "");
      if (section && section !== currentSection) {
        eventLines.push(`    section ${safeText(section, "بخش")}`);
        currentSection = section;
        currentPeriod = "";
      }
      const period = safeText(item.first, "مرحله");
      if (period === currentPeriod) {
        eventLines.push(`               : ${safeText(item.second, "رویداد")}`);
      } else {
        eventLines.push(`    ${period} : ${safeText(item.second, "رویداد")}`);
        currentPeriod = period;
      }
    }
    code = withFrontmatter([
      `timeline ${horizontal ? "LR" : "TD"}`,
      `    title ${safeText(draft.title, "خط زمانی")}`,
      ...eventLines,
    ].join("\n"), [
      "  timeline:",
      `    disableMulticolor: ${settingFlag(draft, "disableMulticolor")}`,
    ]);
  } else if (draft.kind === "kanban") {
    const groups = new Map<string, SimpleDiagramRow[]>();
    for (const item of rows) {
      const group = cleanLabel(item.first, "ستون");
      groups.set(group, [...(groups.get(group) ?? []), item]);
    }
    let taskIndex = 0;
    const kanbanCode = [
      "kanban",
      ...Array.from(groups).flatMap(([group, tasks], groupIndex) => [
        `    column${groupIndex + 1}[${safeText(group, "ستون")}]`,
        ...tasks.map((task) => {
          taskIndex += 1;
          const metadata = [
            metaText(task.meta, "assigned") ? `assigned: ${mermaidSingleQuoted(metaText(task.meta, "assigned"))}` : "",
            metaText(task.meta, "ticket") ? `ticket: ${mermaidSingleQuoted(metaText(task.meta, "ticket"))}` : "",
            metaText(task.meta, "priority") ? `priority: ${mermaidSingleQuoted(metaText(task.meta, "priority"))}` : "",
          ].filter(Boolean);
          return `      task${taskIndex}[${safeText(task.second, "کار")}]${metadata.length ? `@{ ${metadata.join(", ")} }` : ""}`;
        }),
      ]),
    ].join("\n");
    const ticketBaseUrl = settingText(draft, "ticketBaseUrl").trim();
    code = withFrontmatter(kanbanCode, ticketBaseUrl ? ["  kanban:", `    ticketBaseUrl: ${yamlString(ticketBaseUrl)}`] : []);
  } else if (draft.kind === "gitgraph") {
    const mainBranch = cleanLabel(settingText(draft, "mainBranchName", "main"), "main");
    const branches = new Set<string>([mainBranch]);
    let current = mainBranch;
    const commands: string[] = [];
    for (const item of rows) {
      const branch = cleanLabel(item.first, mainBranch);
      if (!branches.has(branch)) {
        branches.add(branch);
        commands.push(`    branch ${mermaidQuoted(branch, "branch")}`);
        current = branch;
      }
      if (branch !== current) {
        commands.push(`    checkout ${mermaidQuoted(branch, mainBranch)}`);
        current = branch;
      }
      const action = metaText(item.meta, "action", "commit");
      if (action === "merge") {
        const source = cleanLabel(item.value, "");
        if (source && source !== branch) {
          commands.push(`    merge ${mermaidQuoted(source, "branch")}${item.second.trim() ? ` id: ${mermaidQuoted(item.second, "merge")}` : ""}`);
        }
      } else if (action === "cherry-pick") {
        const parent = metaText(item.meta, "parent").trim();
        commands.push(`    cherry-pick id: ${mermaidQuoted(item.value, "commit")}${parent ? ` parent: ${mermaidQuoted(parent, "parent")}` : ""}`);
      } else {
        const commitType = metaText(item.meta, "commitType", "NORMAL");
        const tag = metaText(item.meta, "tag").trim();
        commands.push(
          `    commit id: ${mermaidQuoted(item.second, "تغییر")}${tag ? ` tag: ${mermaidQuoted(tag, "نسخه")}` : ""}${commitType !== "NORMAL" ? ` type: ${commitType}` : ""}`,
        );
      }
    }
    const orientation = draft.orientation === "vertical" ? "TB" : "LR";
    const gitCode = [`gitGraph ${orientation}:`, ...commands].join("\n");
    code = withFrontmatter(gitCode, [
      "  gitGraph:",
      `    mainBranchName: ${yamlString(mainBranch)}`,
      `    showBranches: ${settingFlag(draft, "showBranches", true)}`,
      `    showCommitLabel: ${settingFlag(draft, "showCommitLabel", true)}`,
      `    rotateCommitLabel: ${settingFlag(draft, "rotateCommitLabel", true)}`,
      `    parallelCommits: ${settingFlag(draft, "parallelCommits")}`,
    ]);
  } else if (draft.kind === "pie") {
    const pieCode = [
      `pie${settingFlag(draft, "showData", true) ? " showData" : ""}`,
      `    title ${safeText(draft.title, "نمودار دایره‌ای")}`,
      ...rows.map((item) => `    ${quotedLabel(item.first, "بخش")} : ${safePositiveNumber(item.value)}`),
    ].join("\n");
    code = withFrontmatter(pieCode, [
      "  pie:",
      `    textPosition: ${boundedNumber(settingText(draft, "textPosition", "0.75"), 0, 1)}`,
      `    donutHole: ${boundedNumber(settingText(draft, "donutHole", "0"), 0, 0.9)}`,
      `    legendPosition: ${settingText(draft, "legendPosition", "right")}`,
      `    highlightSlice: ${yamlString(settingText(draft, "highlightSlice", "hover"))}`,
    ]);
  } else if (draft.kind === "xychart") {
    const series = new Map<string, SimpleDiagramRow[]>();
    for (const item of rows) {
      const name = cleanLabel(metaText(item.meta, "series"), "سری ۱");
      series.set(name, [...(series.get(name) ?? []), item]);
    }
    const firstSeries = series.values().next().value as SimpleDiagramRow[] | undefined;
    const xValues = firstSeries ?? rows;
    const xAxisType = settingText(draft, "xAxisType", "category");
    const xAxisTitle = settingText(draft, "xAxisTitle").trim();
    const yAxisTitle = settingText(draft, "yAxisTitle").trim();
    const numericX = rows.map((item) => Number(toAsciiDigits(item.first))).filter(Number.isFinite);
    const numericY = rows.map((item) => Number(toAsciiDigits(item.second))).filter(Number.isFinite);
    const xMin = settingText(draft, "xMin").trim() || String(Math.min(...numericX, 0));
    const xMax = settingText(draft, "xMax").trim() || String(Math.max(...numericX, 1));
    const yMin = settingText(draft, "yMin").trim() || String(Math.min(...numericY, 0));
    const yMax = settingText(draft, "yMax").trim() || String(Math.max(...numericY, 1));
    const xAxis = xAxisType === "numeric"
      ? `    x-axis${xAxisTitle ? ` ${mermaidQuoted(xAxisTitle, "محور افقی")}` : ""} ${safeFiniteNumber(xMin)} --> ${safeFiniteNumber(xMax, "1")}`
      : `    x-axis${xAxisTitle ? ` ${mermaidQuoted(xAxisTitle, "محور افقی")}` : ""} [${xValues.map((item) => mermaidQuoted(item.first, "مقدار")).join(", ")}]`;
    const yAxis = `    y-axis${yAxisTitle ? ` ${mermaidQuoted(yAxisTitle, "محور عمودی")}` : ""} ${safeFiniteNumber(yMin)} --> ${safeFiniteNumber(yMax, "1")}`;
    const seriesLines = Array.from(series, ([, items]) => {
      const type = metaText(items[0]?.meta, "seriesType", "line") === "bar" ? "bar" : "line";
      const orderedItems = xAxisType === "category" ? xValues.map(point => items.find(item => item.first.trim() === point.first.trim())!).filter(Boolean) : items;
      const values = orderedItems.map((item) => {
        const number = safeFiniteNumber(item.second);
        return type === "line" && item.value.trim()
          ? `${number} ${mermaidQuoted(item.value, "رویداد")}`
          : number;
      });
      return `    ${type} [${values.join(", ")}]`;
    });
    const xyCode = [
      `xychart${horizontal ? "" : " horizontal"}`,
      `    title "${safeText(draft.title, "نمودار XY")}"`,
      xAxis,
      yAxis,
      ...seriesLines,
    ].join("\n");
    const palette = Array.from(series.values())
      .map((items, index) => metaText(items[0]?.meta, "color") || ["#2557e5", "#176f3b", "#7756a8"][index % 3])
      .join(",");
    code = withFrontmatter(xyCode, [
      "  xyChart:",
      `    showDataLabel: ${settingFlag(draft, "showDataLabel")}`,
      `    showDataLabelOutsideBar: ${settingFlag(draft, "showDataLabelOutsideBar")}`,
      ...(palette ? ["  themeVariables:", "    xyChart:", `      plotColorPalette: ${yamlString(palette)}`] : []),
    ]);
  } else if (draft.kind === "sankey") {
    const nodeColors = new Map<string, string>();
    for (const item of rows) {
      const sourceColor = metaText(item.meta, "sourceColor").trim();
      const targetColor = metaText(item.meta, "targetColor").trim();
      if (sourceColor) nodeColors.set(cleanLabel(item.first, "مبدأ"), sourceColor);
      if (targetColor) nodeColors.set(cleanLabel(item.second, "مقصد"), targetColor);
    }
    const sankeyCode = [
      "sankey-beta",
      "",
      ...rows.map((item) => `${csvField(item.first, "مبدأ")},${csvField(item.second, "مقصد")},${safePositiveNumber(item.value)}`),
    ].join("\n");
    code = withFrontmatter(sankeyCode, [
      "  sankey:",
      `    width: ${Math.max(200, Number(safeNumber(settingText(draft, "width"), "800")))}`,
      `    height: ${Math.max(160, Number(safeNumber(settingText(draft, "height"), "400")))}`,
      `    linkColor: ${yamlString(settingText(draft, "linkColor", "gradient"))}`,
      `    nodeAlignment: ${yamlString(settingText(draft, "nodeAlignment", "justify"))}`,
      `    showValues: ${settingFlag(draft, "showValues", true)}`,
      `    labelStyle: ${yamlString(settingText(draft, "labelStyle", "outlined"))}`,
      `    nodeWidth: ${Math.max(1, Number(safeNumber(settingText(draft, "nodeWidth"), "10")))}`,
      `    nodePadding: ${Math.max(0, Number(safeNumber(settingText(draft, "nodePadding"), "12")))}`,
      ...(nodeColors.size
        ? ["    nodeColors:", ...Array.from(nodeColors, ([label, color]) => `      ${yamlString(label)}: ${yamlString(color)}`)]
        : []),
    ]);
  } else if (draft.kind === "mindmap") {
    const children = new Map<string, SimpleDiagramRow[]>();
    const childLabels = new Set<string>();
    for (const item of rows) {
      const parent = cleanLabel(item.first, draft.title);
      children.set(parent, [...(children.get(parent) ?? []), item]);
      childLabels.add(cleanLabel(item.second, "گره"));
    }
    const topParents = Array.from(children.keys()).filter(
      (parent) => parent === draft.title || !childLabels.has(parent),
    );
    const nodeIds = new Map<string, string>();
    const idForNode = (label: string) => {
      const known = nodeIds.get(label);
      if (known) return known;
      const next = `node${nodeIds.size + 1}`;
      nodeIds.set(label, next);
      return next;
    };
    const visited = new Set<string>();
    const renderChildren = (parent: string, depth: number): string[] =>
      (children.get(parent) ?? []).flatMap((item) => {
        const label = cleanLabel(item.second, "گره");
        if (visited.has(`${parent}\u0000${label}`)) return [];
        visited.add(`${parent}\u0000${label}`);
        const indent = "  ".repeat(depth);
        const node = `${indent}${mindmapShape(idForNode(label), label, metaText(item.meta, "shape", "default"))}`;
        const icon = metaText(item.meta, "icon").trim();
        return [
          node,
          ...(icon ? [`${indent}::icon(${safeText(icon, "")})`] : []),
          ...renderChildren(label, depth + 1),
        ];
      });
    const treeLines = topParents.flatMap((parent) => {
      if (parent === draft.title) return renderChildren(parent, 2);
      const indent = "    ";
      return [
        `${indent}${mindmapShape(idForNode(parent), parent, "default")}`,
        ...renderChildren(parent, 3),
      ];
    });
    code = ["mindmap", `  root((${safeText(draft.title, "موضوع اصلی")}))`, ...treeLines].join("\n");
  } else if (draft.kind === "journey") {
    const groups = new Map<string, SimpleDiagramRow[]>();
    for (const item of rows) {
      const section = safeText(item.first, "بخش");
      groups.set(section, [...(groups.get(section) ?? []), item]);
    }
    code = [
      "journey",
      `    title ${safeText(draft.title, "سفر کاربر")}`,
      ...Array.from(groups).flatMap(([section, items]) => [
        `    section ${section}`,
        ...items.map((item) => {
          const actors = metaText(item.meta, "actors", "کاربر")
            .split(/[,،]/u)
            .map((actor) => safeText(actor, ""))
            .filter(Boolean)
            .join(", ") || "کاربر";
          return `      ${safeText(item.second, "اقدام")}: ${boundedNumber(item.value, 1, 5)}: ${actors}`;
        }),
      ]),
    ].join("\n");
  } else if (draft.kind === "quadrant") {
    const quadrantCode = [
      "quadrantChart",
      `    title ${safeText(draft.title, "نمودار چهارخانه")}`,
      `    x-axis ${safeText(settingText(draft, "xLeft", "کم"), "کم")} --> ${safeText(settingText(draft, "xRight", "زیاد"), "زیاد")}`,
      `    y-axis ${safeText(settingText(draft, "yBottom", "کم"), "کم")} --> ${safeText(settingText(draft, "yTop", "زیاد"), "زیاد")}`,
      `    quadrant-1 ${safeText(settingText(draft, "quadrant1", "اولویت بالا"), "اولویت بالا")}`,
      `    quadrant-2 ${safeText(settingText(draft, "quadrant2", "بررسی بیشتر"), "بررسی بیشتر")}`,
      `    quadrant-3 ${safeText(settingText(draft, "quadrant3", "اولویت پایین"), "اولویت پایین")}`,
      `    quadrant-4 ${safeText(settingText(draft, "quadrant4", "فرصت بهبود"), "فرصت بهبود")}`,
      ...rows.map((item) => {
        const styles = [
          metaText(item.meta, "color") ? `color: ${metaText(item.meta, "color")}` : "",
          metaText(item.meta, "radius") ? `radius: ${safePositiveNumber(metaText(item.meta, "radius"), "5")}` : "",
          metaText(item.meta, "strokeColor") ? `stroke-color: ${metaText(item.meta, "strokeColor")}` : "",
          metaText(item.meta, "strokeWidth") ? `stroke-width: ${safePositiveNumber(metaText(item.meta, "strokeWidth"), "1")}px` : "",
        ].filter(Boolean);
        return `    ${safeText(item.first, "گزینه")}: [${boundedNumber(item.second, 0, 1)}, ${boundedNumber(item.value, 0, 1)}]${styles.length ? ` ${styles.join(", ")}` : ""}`;
      }),
    ].join("\n");
    code = withFrontmatter(quadrantCode, [
      "  quadrantChart:",
      `    chartWidth: ${Math.max(240, Number(safeNumber(settingText(draft, "chartWidth"), "500")))}`,
      `    chartHeight: ${Math.max(240, Number(safeNumber(settingText(draft, "chartHeight"), "500")))}`,
    ]);
  } else if (draft.kind === "treemap") {
    type HierarchyNode = { label: string; value?: string; children: Map<string, HierarchyNode> };
    const root: HierarchyNode = { label: "", children: new Map() };
    const childFor = (parent: HierarchyNode, label: string) => {
      const cleaned = cleanLabel(label, "گروه");
      const known = parent.children.get(cleaned);
      if (known) return known;
      const child: HierarchyNode = { label: cleaned, children: new Map() };
      parent.children.set(cleaned, child);
      return child;
    };
    for (const item of rows) {
      const parents = item.second.split(/[\/›]/u).map((part) => part.trim()).filter(Boolean);
      let cursor = root;
      for (const parent of parents) cursor = childFor(cursor, parent);
      const leaf = childFor(cursor, item.first);
      leaf.value = safePositiveNumber(item.value);
    }
    const renderHierarchy = (node: HierarchyNode, depth: number): string[] =>
      Array.from(node.children.values()).flatMap((child) => [
        `${"  ".repeat(depth)}${quotedLabel(child.label, "مورد")}${child.value ? `: ${child.value}` : ""}`,
        ...renderHierarchy(child, depth + 1),
      ]);
    code = [
      "---",
      `title: ${yamlString(cleanLabel(draft.title, "نقشهٔ درختی"))}`,
      "config:",
      "  treemap:",
      `    showValues: ${settingFlag(draft, "showValues", true)}`,
      "---",
      "treemap-beta",
      ...renderHierarchy(root, 1),
    ].join("\n");
  } else if (draft.kind === "venn") {
    const { idFor } = relationIds();
    const setRows = rows.filter((item) => metaText(item.meta, "regionType", "set") === "set");
    const unionRows = rows.filter((item) => metaText(item.meta, "regionType", "set") === "union");
    for (const item of setRows) idFor(item.first, "set");
    code = [
      "venn-beta",
      `    title ${safeText(draft.title, "نمودار ون")}`,
      ...setRows.map((item) => `    set ${idFor(item.first, "set")}[${quotedLabel(item.first, "مجموعه")}]: ${safePositiveNumber(item.value)}`),
      ...unionRows.map((item) => {
        const members = item.second.split(/[,،]/u).map((member) => member.trim()).filter(Boolean);
        return `    union ${members.map((member) => idFor(member, "set")).join(",")}[${quotedLabel(item.first, "هم‌پوشانی")}]: ${safePositiveNumber(item.value)}`;
      }),
    ].join("\n");
  } else if (draft.kind === "ishikawa") {
    const groups = new Map<string, SimpleDiagramRow[]>();
    for (const item of rows) {
      const group = cleanLabel(item.first, "دستهٔ علت");
      groups.set(group, [...(groups.get(group) ?? []), item]);
    }
    code = [
      "ishikawa",
      `  ${safeText(draft.title, "مسئله")}`,
      ...Array.from(groups).flatMap(([group, causes]) => [
        `    ${safeText(group, "دستهٔ علت")}`,
        ...causes.flatMap((item) => [
          `      ${safeText(item.second, "علت")}`,
          ...(item.value.trim() ? [`        ${safeText(item.value, "زیرعلت")}`] : []),
        ]),
      ]),
    ].join("\n");
  } else if (draft.kind === "wardley") {
    const rowById = new Map(rows.map((item) => [item.id, item]));
    const nodeLines = rows.map((item) => {
      const type = metaText(item.meta, "nodeType", "component") === "anchor" ? "anchor" : "component";
      const decorators = [
        metaFlag(item.meta, "inertia") ? "(inertia)" : "",
        ["build", "buy", "outsource", "market"].includes(metaText(item.meta, "strategy")) ? `(${metaText(item.meta, "strategy")})` : "",
      ].filter(Boolean).join(" ");
      return `    ${type} ${mermaidQuoted(item.first, "جزء")} [${boundedNumber(item.second, 0, 1)}, ${boundedNumber(item.value, 0, 1)}]${decorators ? ` ${decorators}` : ""}`;
    });
    const links = rows.flatMap((item) => {
      const target = rowById.get(metaText(item.meta, "dependsOn"));
      return target ? [`    ${mermaidQuoted(item.first, "جزء")} -> ${mermaidQuoted(target.first, "وابستگی")}`] : [];
    });
    const evolves = rows.flatMap((item) => {
      const target = metaText(item.meta, "evolveTarget").trim();
      return target ? [`    evolve ${mermaidQuoted(item.first, "جزء")} ${boundedNumber(target, 0, 1)}`] : [];
    });
    code = [
      "wardley-beta",
      `    title ${safeText(draft.title, "نقشهٔ واردلی")}`,
      `    size [${Math.max(500, Math.trunc(Number(safePositiveNumber(settingText(draft, "width", "1100")))))}, ${Math.max(400, Math.trunc(Number(safePositiveNumber(settingText(draft, "height", "700")))))}]`,
      ...nodeLines,
      ...links,
      ...evolves,
    ].join("\n");
  } else if (draft.kind === "cynefin") {
    const domains = ["complex", "complicated", "clear", "chaotic", "confusion"];
    const domainRows = new Map(domains.map((domain) => [domain, [] as SimpleDiagramRow[]]));
    for (const item of rows) {
      const domain = domains.includes(metaText(item.meta, "domain")) ? metaText(item.meta, "domain") : "complex";
      domainRows.get(domain)?.push(item);
    }
    const transitionSet = new Set<string>();
    const transitions = rows.flatMap((item) => {
      const source = domains.includes(metaText(item.meta, "domain")) ? metaText(item.meta, "domain") : "complex";
      const target = metaText(item.meta, "transitionTo");
      const key = `${source}\u0000${target}\u0000${item.value.trim()}`;
      if (!domains.includes(target) || source === target || transitionSet.has(key)) return [];
      transitionSet.add(key);
      return [`    ${source} --> ${target}${item.value.trim() ? ` : ${quotedLabel(item.value, "جابه‌جایی")}` : ""}`];
    });
    const cynefinCode = [
      "cynefin-beta",
      `    title ${safeText(draft.title, "چارچوب کینفین")}`,
      ...domains.flatMap((domain) => [
        `    ${domain}`,
        ...(domainRows.get(domain) ?? []).map((item) => `      ${quotedLabel(item.first, "موقعیت")}`),
      ]),
      ...transitions,
    ].join("\n");
    code = withFrontmatter(cynefinCode, [
      "  cynefin:",
      `    showDomainDescriptions: ${settingFlag(draft, "showDomainDescriptions", true)}`,
    ]);
  } else if (draft.kind === "treeview") {
    type TreeNode = { label: string; type: string; description: string; highlight: boolean; children: Map<string, TreeNode> };
    const root: TreeNode = { label: "", type: "directory", description: "", highlight: false, children: new Map() };
    const childFor = (parent: TreeNode, label: string) => {
      const cleaned = cleanLabel(label, "پوشه");
      const known = parent.children.get(cleaned);
      if (known) return known;
      const child: TreeNode = { label: cleaned, type: "directory", description: "", highlight: false, children: new Map() };
      parent.children.set(cleaned, child);
      return child;
    };
    for (const item of rows) {
      const parents = item.second.split(/[\/›]/u).map((part) => part.trim()).filter(Boolean);
      let cursor = root;
      for (const parent of parents) cursor = childFor(cursor, parent);
      const node = childFor(cursor, item.first);
      node.type = metaText(item.meta, "nodeType", "file");
      node.description = cleanLabel(item.value, "");
      node.highlight = metaFlag(item.meta, "highlight");
    }
    const renderTree = (node: TreeNode, depth: number): string[] =>
      Array.from(node.children.values()).flatMap((child) => {
        const directory = child.type === "directory" || child.children.size > 0;
        const annotations = [child.description ? `## ${safeText(child.description, "")}` : "", child.highlight ? ":::highlight" : ""].filter(Boolean).join(" ");
        return [
          `${"  ".repeat(depth)}${quotedLabel(child.label, "گره")}${directory ? "/" : ""}${annotations ? ` ${annotations}` : ""}`,
          ...renderTree(child, depth + 1),
        ];
      });
    code = [
      "---",
      `title: ${yamlString(cleanLabel(draft.title, "نمای درختی"))}`,
      "config:",
      "  treeView:",
      `    showIcons: ${settingFlag(draft, "showIcons", true)}`,
      "---",
      "treeView-beta",
      ...renderTree(root, 1),
    ].join("\n");
  } else {
    code = [
      "sankey-beta",
      "",
      ...rows.map((item) => `${csvField(item.first, "مبدأ")},${csvField(item.second, "مقصد")},${safeNumber(item.value)}`),
    ].join("\n");
  }

  return appendMetadata(draft, code);
}

function parseGeneratedFlowchart(code: string): SimpleDiagramDraft | null {
  const rows = Array.from(
    code.matchAll(/^\s*n\d+\["((?:[^"\\]|\\.)*)"\]\s*-->(?:\|([^|]*)\|)?\s*n\d+\["((?:[^"\\]|\\.)*)"\]\s*$/gmu),
  ).map((match, index) => row(`row-${index + 1}`, JSON.parse(`"${match[1]}"`) as string, JSON.parse(`"${match[3]}"`) as string, match[2]?.trim() ?? ""));
  const vertical = /^\s*flowchart\s+(?:TB|TD)\b/imu.test(code);
  return rows.length
    ? {
        kind: "flowchart",
        title: "فرایند",
        orientation: vertical ? "vertical" : "horizontal",
        rows,
        settings: { ...DEFAULT_SETTINGS.flowchart },
      }
    : null;
}

export function parseSimpleDiagram(code: string): SimpleDiagramDraft | null {
  const metadata = code.match(/^%% raavi-simple:([A-Za-z0-9_-]+)$/mu)?.[1];
  if (metadata) {
    const parsed = decodeDraft(metadata);
    if (parsed) return parsed;
  }

  const kind = detectMermaidKind(code);
  const lines = code.split(/\r?\n/u);
  if (kind === "flowchart") return parseGeneratedFlowchart(code);
  if (kind === "mindmap") {
    const root = lines.find((line) => /root\(\(/u.test(line));
    if (!root) return null;
    const title = root.match(/root\(\((.*)\)\)/u)?.[1]?.trim() || "موضوع اصلی";
    const rows: SimpleDiagramRow[] = [];
    let branch = "";
    for (const line of lines.slice(lines.indexOf(root) + 1)) {
      const indent = line.match(/^\s*/u)?.[0].length ?? 0;
      const text = line.trim();
      if (!text || text.startsWith("%%")) continue;
      if (indent <= 4) branch = text;
      else if (branch) rows.push(row(`row-${rows.length + 1}`, branch, text));
    }
    return rows.length
      ? { kind: "mindmap", title, orientation: "horizontal", rows, settings: { ...DEFAULT_SETTINGS.mindmap } }
      : null;
  }
  if (kind === "timeline") {
    const title = lines.find((line) => /^\s*title\s+/u.test(line))?.replace(/^\s*title\s+/u, "").trim() || "خط زمانی";
    const rows = lines
      .filter((line) => line.includes(":") && !/^\s*title\b/u.test(line))
      .map((line, index) => {
        const [first, ...rest] = line.split(":");
        return row(`row-${index + 1}`, first.trim(), rest.join(":").trim());
      });
    return rows.length
      ? { kind: "timeline", title, orientation: "horizontal", rows, settings: { ...DEFAULT_SETTINGS.timeline } }
      : null;
  }
  if (kind === "pie") {
    const title = lines.find((line) => /^\s*title\s+/u.test(line))?.replace(/^\s*title\s+/u, "").trim() || "نمودار دایره‌ای";
    const rows = Array.from(code.matchAll(/^\s*"([^"]+)"\s*:\s*(.+)$/gmu)).map((match, index) => row(`row-${index + 1}`, match[1], "", match[2].trim()));
    return rows.length
      ? { kind: "pie", title, orientation: "horizontal", rows, settings: { ...DEFAULT_SETTINGS.pie } }
      : null;
  }
  if (kind === "sankey") {
    const rows = lines.slice(1).flatMap((line) => {
      if (!line.trim() || line.trimStart().startsWith("%%")) return [];
      const fields = parseMermaidCsvRow(line);
      if (!fields || fields.length !== 3) return [];
      return [row("", fields[0], fields[1], fields[2])];
    });
    rows.forEach((item, index) => {
      item.id = `row-${index + 1}`;
    });
    return rows.length
      ? { kind: "sankey", title: "جریان مقدار", orientation: "horizontal", rows, settings: { ...DEFAULT_SETTINGS.sankey } }
      : null;
  }
  return null;
}
