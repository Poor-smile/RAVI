export type CommandPlatform = "windows" | "mac" | "linux";
export type CommandSurface = "web" | "electron";
export type EditableKind =
  | "editor"
  | "composer"
  | "annotationBody"
  | "librarySearch"
  | "saveName"
  | "generic";

export type CommandGroup =
  | "file"
  | "edit"
  | "view"
  | "reading";

export type CommandIcon =
  | "about"
  | "annotation"
  | "bold"
  | "code"
  | "command"
  | "export"
  | "file-new"
  | "file-open"
  | "find"
  | "focus"
  | "heading"
  | "image"
  | "italic"
  | "link"
  | "list"
  | "live-edit"
  | "mermaid"
  | "quick-open"
  | "quote"
  | "review"
  | "reading"
  | "redo"
  | "save"
  | "sidebar"
  | "support"
  | "text-size"
  | "theme"
  | "table"
  | "undo";

export type CommandId =
  | "file.open"
  | "file.save"
  | "file.saveAs"
  | "file.new"
  | "file.closeTab"
  | "file.closeOtherTabs"
  | "file.pinTab"
  | "file.reopenClosedTab"
  | "file.quickOpen"
  | "file.export"
  | "help.shortcuts"
  | "help.support"
  | "help.about"
  | "edit.undo"
  | "edit.redo"
  | "edit.find"
  | "edit.replace"
  | "edit.findNext"
  | "edit.findPrevious"
  | "edit.selectAll"
  | "edit.bold"
  | "edit.italic"
  | "edit.underline"
  | "edit.strike"
  | "edit.clearFormatting"
  | "edit.code"
  | "edit.heading"
  | "edit.list"
  | "edit.orderedList"
  | "edit.task"
  | "edit.codeBlock"
  | "edit.callout"
  | "edit.table"
  | "edit.reviewPersian"
  | "edit.link"
  | "edit.image"
  | "edit.quote"
  | "edit.divider"
  | "diagram.mermaid"
  | "view.theme"
  | "view.reading"
  | "view.commandPalette"
  | "view.sidebar"
  | "view.outline"
  | "view.editor.live"
  | "view.editor.source"
  | "view.editor.proof"
  | "focus.editor"
  | "focus.selectionToolbar"
  | "focus.preview"
  | "focus.library"
  | "focus.annotations"
  | "view.text.decrease"
  | "view.text.increase"
  | "annotation.highlight"
  | "annotation.comment"
  | "annotation.submit"
  | "layer.dismiss";

export type KeyBinding = {
  code: string;
  primary?: boolean;
  ctrl?: boolean;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
  platforms?: CommandPlatform[];
  surfaces?: CommandSurface[];
  selection?: "required" | "none";
};

export type CommandDefinition = {
  id: CommandId;
  title: string;
  description: string;
  keywords: string[];
  icon: CommandIcon;
  group: CommandGroup;
  bindings: KeyBinding[];
  allowInEditable: boolean | EditableKind[];
  repeatable?: boolean;
  showInHelp?: boolean;
  contextLabel?: string;
};

export type CommandEnvironment = {
  platform: CommandPlatform;
  surface: CommandSurface;
};

export const COMMAND_GROUPS: Array<{
  id: CommandGroup;
  title: string;
}> = [
  { id: "file", title: "فایل" },
  { id: "edit", title: "ویرایش" },
  { id: "view", title: "نما" },
  { id: "reading", title: "خواندن" },
];

type CommandBaseDefinition = Omit<
  CommandDefinition,
  "description" | "keywords" | "icon"
>;

const BASE_COMMAND_REGISTRY: CommandBaseDefinition[] = [
  {
    id: "file.open",
    title: "بازکردن فایل",
    group: "file",
    bindings: [{ code: "KeyO", primary: true }],
    allowInEditable: ["editor"],
    showInHelp: true,
  },
  {
    id: "file.quickOpen",
    title: "بازکردن سریع از کتابخانه",
    group: "file",
    bindings: [{ code: "KeyP", primary: true }],
    allowInEditable: true,
    showInHelp: true,
    contextLabel: "پس از اتصال پوشه",
  },
  {
    id: "file.export",
    title: "خروجی Word یا PDF",
    group: "file",
    bindings: [{ code: "KeyE", primary: true, shift: true }],
    allowInEditable: true,
    showInHelp: true,
  },
  {
    id: "file.save",
    title: "ذخیره نسخه",
    group: "file",
    bindings: [{ code: "KeyS", primary: true }],
    allowInEditable: ["editor", "annotationBody", "saveName"],
    showInHelp: true,
  },
  {
    id: "file.saveAs",
    title: "ذخیره با نام",
    group: "file",
    bindings: [{ code: "KeyS", primary: true, shift: true }],
    allowInEditable: ["editor", "annotationBody"],
    showInHelp: true,
  },
  {
    id: "file.new",
    title: "سند تازه",
    group: "file",
    bindings: [
      {
        code: "KeyN",
        ctrl: true,
        platforms: ["windows"],
        surfaces: ["electron"],
      },
    ],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "فقط برنامه ویندوز",
  },
  {
    id: "file.closeTab",
    title: "بستن تب فعال",
    group: "file",
    bindings: [{ code: "KeyW", primary: true }],
    allowInEditable: true,
    showInHelp: true,
  },
  {
    id: "file.closeOtherTabs",
    title: "بستن سایر تب‌ها",
    group: "file",
    bindings: [],
    allowInEditable: true,
    showInHelp: false,
  },
  {
    id: "file.pinTab",
    title: "سنجاق یا آزاد کردن تب فعال",
    group: "file",
    bindings: [{ code: "KeyP", alt: true, shift: true }],
    allowInEditable: true,
    showInHelp: true,
  },
  {
    id: "file.reopenClosedTab",
    title: "بازکردن آخرین تب بسته‌شده",
    group: "file",
    bindings: [{ code: "KeyT", primary: true, shift: true }],
    allowInEditable: true,
    showInHelp: true,
  },
  {
    id: "edit.undo",
    title: "واگرد آخرین تغییر",
    group: "edit",
    bindings: [{ code: "KeyZ", primary: true }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "فقط در ویرایشگر",
  },
  {
    id: "edit.redo",
    title: "انجام دوبارهٔ تغییر",
    group: "edit",
    bindings: [
      { code: "KeyZ", primary: true, shift: true },
      {
        code: "KeyY",
        primary: true,
        platforms: ["windows", "linux"],
      },
    ],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "فقط در ویرایشگر",
  },
  {
    id: "edit.find",
    title: "جست‌وجو در سند",
    group: "edit",
    bindings: [{ code: "KeyF", primary: true }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "فقط در ویرایشگر",
  },
  {
    id: "edit.replace",
    title: "جست‌وجو و جایگزینی",
    group: "edit",
    bindings: [
      {
        code: "KeyH",
        ctrl: true,
        platforms: ["windows", "linux"],
      },
      {
        code: "KeyF",
        primary: true,
        alt: true,
        platforms: ["mac"],
      },
    ],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "فقط در ویرایشگر",
  },
  {
    id: "edit.findNext",
    title: "نتیجهٔ بعدی جست‌وجو",
    group: "edit",
    bindings: [{ code: "F3" }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "پس از جست‌وجو",
  },
  {
    id: "edit.findPrevious",
    title: "نتیجهٔ قبلی جست‌وجو",
    group: "edit",
    bindings: [{ code: "F3", shift: true }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "پس از جست‌وجو",
  },
  {
    id: "edit.selectAll",
    title: "انتخاب تمام متن",
    group: "edit",
    bindings: [{ code: "KeyA", primary: true }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "فقط در ویرایشگر",
  },
  {
    id: "edit.bold",
    title: "پررنگ",
    group: "edit",
    bindings: [{ code: "KeyB", primary: true }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "فقط در ویرایشگر",
  },
  {
    id: "edit.italic",
    title: "مورب",
    group: "edit",
    bindings: [{ code: "KeyI", primary: true }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "فقط در ویرایشگر",
  },
  {
    id: "edit.underline",
    title: "زیرخط‌دار",
    group: "edit",
    bindings: [{ code: "KeyU", primary: true }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "فقط در ویرایشگر",
  },
  {
    id: "edit.strike",
    title: "خط‌خورده",
    group: "edit",
    bindings: [{ code: "KeyX", primary: true, shift: true }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "فقط در ویرایشگر",
  },
  {
    id: "edit.clearFormatting",
    title: "پاک‌کردن قالب‌بندی",
    group: "edit",
    bindings: [{ code: "Backslash", primary: true }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "پس از انتخاب متن",
  },
  {
    id: "edit.code",
    title: "کد درون‌خطی",
    group: "edit",
    bindings: [
      { code: "Backquote", ctrl: true, platforms: ["windows", "linux"] },
      { code: "Backquote", ctrl: true, platforms: ["mac"] },
    ],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "فقط در ویرایشگر",
  },
  {
    id: "edit.heading",
    title: "تیتر بخش",
    group: "edit",
    bindings: [],
    allowInEditable: ["editor"],
    showInHelp: false,
    contextLabel: "در ویرایشگر",
  },
  {
    id: "edit.list",
    title: "فهرست بولت‌دار",
    group: "edit",
    bindings: [],
    allowInEditable: ["editor"],
    showInHelp: false,
    contextLabel: "در ویرایشگر",
  },
  {
    id: "edit.orderedList",
    title: "فهرست شماره‌ای",
    group: "edit",
    bindings: [],
    allowInEditable: ["editor"],
    showInHelp: false,
    contextLabel: "در ویرایشگر",
  },
  {
    id: "edit.task",
    title: "چک‌لیست",
    group: "edit",
    bindings: [],
    allowInEditable: ["editor"],
    showInHelp: false,
    contextLabel: "در ویرایشگر",
  },
  {
    id: "edit.codeBlock",
    title: "قطعه‌کد",
    group: "edit",
    bindings: [],
    allowInEditable: ["editor"],
    showInHelp: false,
    contextLabel: "در ویرایشگر",
  },
  {
    id: "edit.callout",
    title: "فراخوان",
    group: "edit",
    bindings: [],
    allowInEditable: ["editor"],
    showInHelp: false,
    contextLabel: "در ویرایشگر",
  },
  {
    id: "edit.table",
    title: "جدول",
    group: "edit",
    bindings: [],
    allowInEditable: ["editor"],
    showInHelp: false,
    contextLabel: "در ویرایشگر",
  },
  {
    id: "edit.reviewPersian",
    title: "اصلاحات فارسی",
    group: "edit",
    bindings: [],
    allowInEditable: ["editor"],
    showInHelp: false,
    contextLabel: "در ویرایشگر",
  },
  {
    id: "edit.link",
    title: "افزودن پیوند",
    group: "edit",
    bindings: [{ code: "KeyK", primary: true, selection: "required" }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "با انتخاب متن در ویرایشگر",
  },
  {
    id: "edit.image",
    title: "افزودن تصویر",
    group: "edit",
    bindings: [{ code: "KeyI", alt: true }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "در ویرایشگر؛ مستقل از زبان صفحه‌کلید",
  },
  {
    id: "edit.quote",
    title: "نقل‌قول",
    group: "edit",
    bindings: [{ code: "Period", primary: true, shift: true }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "فقط در ویرایشگر",
  },
  {
    id: "edit.divider",
    title: "درج جداکننده",
    group: "edit",
    bindings: [{ code: "KeyH", alt: true, shift: true }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "فقط در ویرایشگر",
  },
  {
    id: "diagram.mermaid",
    title: "ساخت نمودار Mermaid",
    group: "edit",
    bindings: [{ code: "KeyM", alt: true }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "در ویرایشگر؛ مستقل از زبان صفحه‌کلید",
  },
  {
    id: "view.theme",
    title: "تغییر تم روشن و تاریک",
    group: "view",
    bindings: [{ code: "KeyT", alt: true }],
    allowInEditable: true,
    showInHelp: true,
  },
  {
    id: "view.commandPalette",
    title: "فرمان‌های راوی",
    group: "view",
    bindings: [{ code: "KeyK", primary: true, selection: "none" }],
    allowInEditable: true,
    showInHelp: true,
    contextLabel: "بدون انتخاب متن",
  },
  {
    id: "view.sidebar",
    title: "باز یا بسته‌کردن نوار کناری",
    group: "view",
    bindings: [],
    allowInEditable: true,
    showInHelp: false,
  },
  {
    id: "view.outline",
    title: "ساختار سند",
    group: "view",
    bindings: [],
    allowInEditable: true,
    showInHelp: false,
  },
  {
    id: "view.editor.live",
    title: "ویرایش روان",
    group: "view",
    bindings: [],
    allowInEditable: true,
    showInHelp: false,
  },
  {
    id: "view.editor.source",
    title: "متن خام",
    group: "view",
    bindings: [],
    allowInEditable: true,
    showInHelp: false,
  },
  {
    id: "view.editor.proof",
    title: "نمونه‌خوانی دوبرگی",
    group: "view",
    bindings: [],
    allowInEditable: true,
    showInHelp: false,
  },
  {
    id: "view.reading",
    title: "حالت مطالعه",
    group: "reading",
    bindings: [{ code: "F9" }],
    allowInEditable: ["editor", "annotationBody"],
    showInHelp: true,
  },
  {
    id: "focus.editor",
    title: "تمرکز روی ویرایشگر",
    group: "view",
    bindings: [
      { code: "Digit1", alt: true, platforms: ["windows", "linux"] },
      { code: "Digit1", ctrl: true, platforms: ["mac"] },
    ],
    allowInEditable: true,
    showInHelp: true,
  },
  {
    id: "focus.selectionToolbar",
    title: "تمرکز روی ابزارهای انتخاب",
    group: "edit",
    bindings: [{ code: "F10", alt: true, selection: "required" }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "پس از انتخاب متن در ویرایشگر",
  },
  {
    id: "focus.preview",
    title: "تمرکز روی پیش‌نمایش",
    group: "view",
    bindings: [
      { code: "Digit2", alt: true, platforms: ["windows", "linux"] },
      { code: "Digit2", ctrl: true, platforms: ["mac"] },
    ],
    allowInEditable: true,
    showInHelp: true,
  },
  {
    id: "focus.library",
    title: "جست‌وجوی کتابخانه",
    group: "view",
    bindings: [
      { code: "Digit3", alt: true, platforms: ["windows", "linux"] },
      { code: "Digit3", ctrl: true, platforms: ["mac"] },
    ],
    allowInEditable: true,
    showInHelp: true,
  },
  {
    id: "focus.annotations",
    title: "پنل نظرات",
    group: "view",
    bindings: [
      { code: "Digit4", alt: true, platforms: ["windows", "linux"] },
      { code: "Digit4", ctrl: true, platforms: ["mac"] },
    ],
    allowInEditable: true,
    showInHelp: true,
  },
  {
    id: "view.text.decrease",
    title: "کاهش اندازه متن",
    group: "reading",
    bindings: [{ code: "BracketLeft", alt: true }],
    allowInEditable: false,
    repeatable: true,
    showInHelp: true,
    contextLabel: "در پیش‌نمایش یا حالت مطالعه",
  },
  {
    id: "view.text.increase",
    title: "افزایش اندازه متن",
    group: "reading",
    bindings: [{ code: "BracketRight", alt: true }],
    allowInEditable: false,
    repeatable: true,
    showInHelp: true,
    contextLabel: "در پیش‌نمایش یا حالت مطالعه",
  },
  {
    id: "annotation.highlight",
    title: "هایلایت انتخاب",
    group: "edit",
    bindings: [{ code: "KeyH", primary: true, shift: true }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "پس از انتخاب متن",
  },
  {
    id: "annotation.comment",
    title: "نظر برای انتخاب",
    group: "edit",
    bindings: [
      {
        code: "KeyM",
        ctrl: true,
        alt: true,
        platforms: ["windows", "linux"],
      },
    ],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "پس از انتخاب متن",
  },
  {
    id: "annotation.submit",
    title: "ثبت نظر",
    group: "edit",
    bindings: [{ code: "Enter", primary: true }],
    allowInEditable: ["composer"],
    showInHelp: true,
    contextLabel: "هنگام نوشتن نظر",
  },
  {
    id: "help.shortcuts",
    title: "راهنمای میان‌برها",
    group: "view",
    bindings: [
      { code: "Slash", primary: true },
      { code: "F1", surfaces: ["electron"] },
    ],
    allowInEditable: true,
    showInHelp: true,
  },
  {
    id: "help.support",
    title: "حمایت از راوی",
    group: "view",
    bindings: [],
    allowInEditable: true,
    showInHelp: false,
  },
  {
    id: "help.about",
    title: "دربارهٔ راوی",
    group: "view",
    bindings: [],
    allowInEditable: true,
    showInHelp: false,
  },
  {
    id: "layer.dismiss",
    title: "بستن لایه فعال",
    group: "view",
    bindings: [{ code: "Escape" }],
    allowInEditable: true,
    showInHelp: true,
    contextLabel: "بالاترین لایه باز",
  },
];

type CommandMetadata = Pick<
  CommandDefinition,
  "description" | "keywords" | "icon"
>;

const COMMAND_METADATA = {
  "file.open": { description: "یک فایل Markdown یا راوی را از دستگاه باز می‌کند.", keywords: ["open", "load", "بازکردن"], icon: "file-open" },
  "file.quickOpen": { description: "فایل را با جست‌وجوی سریع نام از کتابخانه باز می‌کند.", keywords: ["quick open", "switcher", "فایل اخیر", "کتابخانه"], icon: "quick-open" },
  "file.export": { description: "از سند فعال خروجی Word یا PDF می‌سازد.", keywords: ["export", "word", "pdf", "خروجی"], icon: "export" },
  "file.save": { description: "تغییرات سند فعال را ذخیره می‌کند.", keywords: ["save", "ذخیره"], icon: "save" },
  "file.saveAs": { description: "یک نسخه با نام یا قالب تازه ذخیره می‌کند.", keywords: ["save as", "ذخیره با نام", "نسخه"], icon: "save" },
  "file.new": { description: "یک سند خالی تازه برای نوشتن می‌سازد.", keywords: ["new", "document", "سند تازه"], icon: "file-new" },
  "file.closeTab": { description: "تب فعال را می‌بندد؛ برای تغییرهای ذخیره‌نشده امکان ذخیره، کنارگذاشتن یا انصراف دارید.", keywords: ["close tab", "بستن تب"], icon: "focus" },
  "file.closeOtherTabs": { description: "همهٔ تب‌ها به‌جز تب فعال را می‌بندد.", keywords: ["close other tabs", "بستن سایر تب‌ها"], icon: "focus" },
  "file.pinTab": { description: "تب فعال را در ابتدای نوار ثابت می‌کند یا سنجاق آن را برمی‌دارد.", keywords: ["pin tab", "سنجاق تب", "ثابت"], icon: "focus" },
  "file.reopenClosedTab": { description: "آخرین تب بسته‌شده را همراه نشست آن بازمی‌گرداند.", keywords: ["reopen closed tab", "undo close", "بازگردانی تب"], icon: "quick-open" },
  "edit.undo": { description: "آخرین تغییر متن را برمی‌گرداند.", keywords: ["undo", "واگرد"], icon: "undo" },
  "edit.redo": { description: "تغییر واگردشده را دوباره انجام می‌دهد.", keywords: ["redo", "از نو"], icon: "redo" },
  "edit.find": { description: "جست‌وجوی متن را در ویرایشگر باز می‌کند.", keywords: ["find", "search", "جستجو"], icon: "find" },
  "edit.replace": { description: "جست‌وجو و جایگزینی گروهی را در ویرایشگر باز می‌کند.", keywords: ["replace", "replace all", "جایگزینی"], icon: "find" },
  "edit.findNext": { description: "به نتیجهٔ بعدی جست‌وجوی متن می‌رود.", keywords: ["find next", "نتیجه بعد"], icon: "find" },
  "edit.findPrevious": { description: "به نتیجهٔ قبلی جست‌وجوی متن می‌رود.", keywords: ["find previous", "نتیجه قبل"], icon: "find" },
  "edit.selectAll": { description: "تمام متن سند فعال را انتخاب می‌کند.", keywords: ["select all", "انتخاب همه"], icon: "focus" },
  "edit.bold": { description: "انتخاب را پررنگ می‌کند یا متن پررنگ می‌سازد.", keywords: ["bold", "strong", "پررنگ"], icon: "bold" },
  "edit.italic": { description: "انتخاب را مورب می‌کند یا متن مورب می‌سازد.", keywords: ["italic", "emphasis", "مورب"], icon: "italic" },
  "edit.underline": { description: "انتخاب را با HTML امن زیرخط‌دار می‌کند.", keywords: ["underline", "underlined", "زیرخط"], icon: "text-size" },
  "edit.strike": { description: "انتخاب را با قالب GFM خط‌خورده می‌کند.", keywords: ["strike", "strikethrough", "خط خورده"], icon: "text-size" },
  "edit.clearFormatting": { description: "قالب‌بندی‌های درون‌خطی انتخاب را پاک می‌کند.", keywords: ["clear formatting", "remove format", "پاک کردن قالب"], icon: "review" },
  "edit.code": { description: "انتخاب را به کد درون‌خطی تبدیل می‌کند.", keywords: ["inline code", "کد"], icon: "code" },
  "edit.heading": { description: "خط فعال را به تیتر بخش تبدیل می‌کند.", keywords: ["heading", "title", "تیتر", "عنوان"], icon: "heading" },
  "edit.list": { description: "انتخاب یا خط فعال را به فهرست بولت‌دار تبدیل می‌کند.", keywords: ["bullet list", "فهرست", "لیست"], icon: "list" },
  "edit.orderedList": { description: "انتخاب یا خط فعال را شماره‌گذاری می‌کند.", keywords: ["ordered list", "numbered", "شماره‌ای"], icon: "list" },
  "edit.task": { description: "انتخاب یا خط فعال را به چک‌لیست تبدیل می‌کند.", keywords: ["task", "checklist", "کار", "چک لیست"], icon: "list" },
  "edit.codeBlock": { description: "انتخاب را در یک بلوک کد قابل‌حمل قرار می‌دهد.", keywords: ["code block", "fence", "قطعه کد"], icon: "code" },
  "edit.callout": { description: "یک فراخوان Markdown سازگار برای یادداشت می‌سازد.", keywords: ["callout", "note", "فراخوان", "یادداشت"], icon: "quote" },
  "edit.table": { description: "helper کوچک ساخت جدول را باز می‌کند.", keywords: ["table", "grid", "جدول"], icon: "table" },
  "edit.reviewPersian": { description: "پیشنهادهای نگارشی فارسی را نشان می‌دهد.", keywords: ["persian review", "proofread", "بازبینی", "فارسی"], icon: "review" },
  "edit.link": { description: "روی انتخاب یک پیوند Markdown می‌سازد.", keywords: ["link", "url", "پیوند"], icon: "link" },
  "edit.image": { description: "تصویر محلی یا اینترنتی را به سند می‌افزاید.", keywords: ["image", "photo", "تصویر"], icon: "image" },
  "edit.quote": { description: "خط یا انتخاب را به نقل‌قول تبدیل می‌کند.", keywords: ["quote", "blockquote", "نقل قول"], icon: "quote" },
  "edit.divider": { description: "یک خط افقی Markdown میان بخش‌های سند درج می‌کند.", keywords: ["divider", "separator", "horizontal rule", "hr", "جداکننده", "خط افقی"], icon: "text-size" },
  "diagram.mermaid": { description: "استودیوی نمودار Mermaid را باز می‌کند.", keywords: ["mermaid", "diagram", "نمودار"], icon: "mermaid" },
  "view.theme": { description: "میان تم روشن و تاریک جابه‌جا می‌شود.", keywords: ["theme", "dark", "light", "تم"], icon: "theme" },
  "view.commandPalette": { description: "فرمان‌های راوی را جست‌وجو و اجرا می‌کند.", keywords: ["command palette", "commands", "فرمان"], icon: "command" },
  "view.sidebar": { description: "نوار کناری فایل‌ها و فهرست سند را باز یا جمع می‌کند.", keywords: ["sidebar", "files", "نوار کناری"], icon: "sidebar" },
  "view.outline": { description: "فهرست تیترها و ساختار سند را نشان می‌دهد.", keywords: ["outline", "headings", "ساختار", "فهرست سند"], icon: "heading" },
  "view.editor.live": { description: "ویرایش روان متن را در همان نمای سند فعال می‌کند.", keywords: ["live edit", "live preview", "ویرایش روان"], icon: "live-edit" },
  "view.editor.source": { description: "تمام نشانه‌های Markdown را برای ویرایش دقیق نشان می‌دهد.", keywords: ["source mode", "raw markdown", "متن خام"], icon: "code" },
  "view.editor.proof": { description: "متن و نتیجه را در نمای دوبرگی هماهنگ نشان می‌دهد.", keywords: ["proof mode", "split", "نمونه خوانی"], icon: "reading" },
  "view.reading": { description: "سند را بدون ابزار ویرایش برای خواندن باز می‌کند.", keywords: ["reading", "reader", "مطالعه", "خواندن"], icon: "reading" },
  "focus.editor": { description: "تمرکز صفحه‌کلید را به ویرایشگر می‌برد.", keywords: ["focus editor", "ویرایشگر"], icon: "focus" },
  "focus.selectionToolbar": { description: "تمرکز را بدون ازدست‌رفتن انتخاب به ابزارهای قالب‌بندی می‌برد.", keywords: ["selection toolbar", "Alt F10", "ابزار انتخاب"], icon: "focus" },
  "focus.preview": { description: "تمرکز صفحه‌کلید را به پیش‌نمایش می‌برد.", keywords: ["focus preview", "پیش نمایش"], icon: "focus" },
  "focus.library": { description: "نوار کناری را باز و ورودی جست‌وجوی قفسه را فعال می‌کند.", keywords: ["library", "search files", "قفسه"], icon: "sidebar" },
  "focus.annotations": { description: "پنل نظرات سند را فعال می‌کند.", keywords: ["annotations", "comments", "نظر"], icon: "annotation" },
  "view.text.decrease": { description: "اندازهٔ متن پیش‌نمایش یا مطالعه را کم می‌کند.", keywords: ["text smaller", "font size", "کاهش متن"], icon: "text-size" },
  "view.text.increase": { description: "اندازهٔ متن پیش‌نمایش یا مطالعه را زیاد می‌کند.", keywords: ["text larger", "font size", "افزایش متن"], icon: "text-size" },
  "annotation.highlight": { description: "از متن انتخاب‌شده یک هایلایت می‌سازد.", keywords: ["highlight", "نشانگر"], icon: "annotation" },
  "annotation.comment": { description: "برای متن انتخاب‌شده نظر می‌نویسد.", keywords: ["comment", "annotation", "نظر", "کامنت"], icon: "annotation" },
  "annotation.submit": { description: "نظر در حال نوشتن را ثبت می‌کند.", keywords: ["submit annotation", "ثبت نظر"], icon: "annotation" },
  "help.shortcuts": { description: "فهرست میان‌برهای فعال و زمینهٔ استفاده را نشان می‌دهد.", keywords: ["shortcuts", "keyboard", "میان بر"], icon: "command" },
  "help.support": { description: "راه‌های حمایت از توسعهٔ رایگان راوی را نشان می‌دهد.", keywords: ["support", "donate", "حمایت"], icon: "support" },
  "help.about": { description: "نسخه و اطلاعات برنامهٔ راوی را نشان می‌دهد.", keywords: ["about", "version", "درباره"], icon: "about" },
  "layer.dismiss": { description: "بالاترین پنجره یا لایهٔ باز را می‌بندد.", keywords: ["close", "escape", "بستن"], icon: "command" },
} satisfies Record<CommandId, CommandMetadata>;

export const COMMAND_REGISTRY: CommandDefinition[] =
  BASE_COMMAND_REGISTRY.map((command) => ({
    ...command,
    ...COMMAND_METADATA[command.id],
  }));

export const ALL_COMMAND_IDS = COMMAND_REGISTRY.map(
  (command) => command.id,
) as CommandId[];

export function commandById(id: CommandId) {
  const command = COMMAND_REGISTRY.find((candidate) => candidate.id === id);
  if (!command) throw new Error(`Unknown command: ${id}`);
  return command;
}

export function activeBindings(
  command: CommandDefinition,
  environment: CommandEnvironment,
) {
  return command.bindings.filter(
    (binding) =>
      (!binding.platforms ||
        binding.platforms.includes(environment.platform)) &&
      (!binding.surfaces || binding.surfaces.includes(environment.surface)),
  );
}

function keyLabel(code: string) {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return (
    {
      Slash: "/",
      Backquote: "`",
      Period: ">",
      BracketLeft: "[",
      BracketRight: "]",
      Enter: "Enter",
      Escape: "Esc",
      F1: "F1",
      F9: "F9",
    }[code] ?? code
  );
}

export function bindingParts(
  binding: KeyBinding,
  platform: CommandPlatform,
) {
  const parts: string[] = [];
  if (binding.primary) parts.push(platform === "mac" ? "⌘" : "Ctrl");
  if (binding.ctrl) parts.push("Ctrl");
  if (binding.meta) parts.push("⌘");
  if (binding.alt) parts.push(platform === "mac" ? "Option" : "Alt");
  if (binding.shift) parts.push("Shift");
  parts.push(keyLabel(binding.code));
  return parts;
}

export function formatBinding(
  binding: KeyBinding,
  platform: CommandPlatform,
) {
  return bindingParts(binding, platform).join("+");
}

export function ariaShortcut(
  binding: KeyBinding,
  platform: CommandPlatform,
) {
  const parts: string[] = [];
  if (binding.primary) parts.push(platform === "mac" ? "Meta" : "Control");
  if (binding.ctrl) parts.push("Control");
  if (binding.meta) parts.push("Meta");
  if (binding.alt) parts.push("Alt");
  if (binding.shift) parts.push("Shift");
  parts.push(keyLabel(binding.code));
  return parts.join("+");
}
