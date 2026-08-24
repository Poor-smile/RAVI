import type {
  CommandEnvironment,
  KeyBinding,
} from "./command-registry";

export type ShortcutGuideKey = {
  binding: KeyBinding;
  label?: string;
};

export type ShortcutGuideItem = {
  id: string;
  title: string;
  description: string;
  context?: string;
  keys: ShortcutGuideKey[];
};

export type ShortcutGuideSection = {
  id: string;
  title: string;
  items: ShortcutGuideItem[];
};

const key = (binding: KeyBinding, label?: string): ShortcutGuideKey => ({
  binding,
  label,
});

export const SHORTCUT_GUIDE_SECTIONS: ShortcutGuideSection[] = [
  {
    id: "blocks",
    title: "ساخت و مدیریت بلاک",
    items: [
      {
        id: "block-enter",
        title: "ادامهٔ نوشتن داخل ساختار فعلی",
        description:
          "در متن، خط تازه‌ای داخل همان بلاک می‌سازد؛ در List Block یک آیتم هم‌سطح اضافه می‌کند.",
        context: "داخل ویرایشگر",
        keys: [key({ code: "Enter" })],
      },
      {
        id: "list-soft-break",
        title: "ساخت خط تازه داخل آیتم",
        description:
          "بدون ساخت آیتم جدید، یک خط دیگر به متن همان آیتم لیست اضافه می‌کند.",
        context: "داخل آیتم List Block",
        keys: [key({ code: "Enter", shift: true })],
      },
      {
        id: "list-indent",
        title: "تغییر سطح آیتم و زیرمجموعه‌ها",
        description:
          "Tab آیتم را زیر آیتم هم‌سطح قبلی می‌برد و Shift+Tab آن را یک سطح بیرون می‌آورد.",
        context: "داخل آیتم List Block",
        keys: [
          key({ code: "Tab" }),
          key({ code: "Tab", shift: true }),
        ],
      },
      {
        id: "list-item-reorder",
        title: "جابه‌جایی آیتم و زیرمجموعه‌ها",
        description:
          "با دستگیره یا Alt+بالا/پایین، آیتم فعال را همراه زیرمجموعه‌ها میان آیتم‌های هم‌سطح جابه‌جا می‌کند.",
        context: "داخل آیتم List Block",
        keys: [
          key({ code: "ArrowUp", alt: true }, "Alt+↑"),
          key({ code: "ArrowDown", alt: true }, "Alt+↓"),
        ],
      },
      {
        id: "block-insert-after",
        title: "ثبت بلاک و ساخت Text Block بعدی",
        description:
          "از کل بلاک فعلی خارج می‌شود و نشانگر را به یک بلاک متن مستقل می‌برد.",
        context: "داخل بلاک فعال",
        keys: [key({ code: "Enter", primary: true })],
      },
      {
        id: "block-duplicate",
        title: "تکثیر کامل بلاک",
        description:
          "محتوا و فراداده را یک‌جا کپی می‌کند و تمرکز را به نسخهٔ جدید می‌برد.",
        context: "بلاک فعال یا انتخاب‌شده",
        keys: [key({ code: "KeyD", primary: true })],
      },
      {
        id: "block-reorder",
        title: "جابه‌جایی کامل بلاک",
        description:
          "همان خروجی Drag را دارد و در ابتدا یا انتهای سند بدون تغییر می‌ماند.",
        context: "خارج از آیتم لیست؛ بلاک فعال یا انتخاب‌شده",
        keys: [
          key({ code: "ArrowUp", alt: true }, "Alt+↑"),
          key({ code: "ArrowDown", alt: true }, "Alt+↓"),
        ],
      },
    ],
  },
  {
    id: "block-menu",
    title: "منوی / و انتخاب نوع",
    items: [
      {
        id: "slash-open",
        title: "بازکردن منوی نوع بلاک",
        description:
          "با ادامهٔ تایپ، جست‌وجوی فارسی یا انگلیسی داخل همان منو انجام می‌شود.",
        context: "فقط ابتدای Empty Block",
        keys: [key({ code: "Slash" }, "/")],
      },
      {
        id: "slash-move",
        title: "حرکت میان گزینه‌ها",
        description: "فلش‌ها یک ردیف و Home/End ابتدا یا انتهای فهرست را انتخاب می‌کنند.",
        context: "وقتی منوی / باز است",
        keys: [
          key({ code: "ArrowUp" }, "↑"),
          key({ code: "ArrowDown" }, "↓"),
          key({ code: "Home" }),
          key({ code: "End" }),
        ],
      },
      {
        id: "slash-accept-dismiss",
        title: "انتخاب یا بستن منو",
        description:
          "Enter نوع بلاک را انتخاب می‌کند؛ Escape منو را می‌بندد و تمرکز را به بلاک خالی برمی‌گرداند.",
        context: "وقتی منوی / باز است",
        keys: [key({ code: "Enter" }), key({ code: "Escape" })],
      },
    ],
  },
  {
    id: "selection",
    title: "قالب‌بندی Selection",
    items: [
      {
        id: "selection-toolbar-focus",
        title: "ورود به نوار ابزار انتخاب",
        description:
          "انتخاب متن حفظ می‌شود؛ فلش چپ و راست و Home/End میان اعمال حرکت می‌کنند.",
        context: "پس از انتخاب متن",
        keys: [key({ code: "F10", alt: true })],
      },
      {
        id: "selection-format",
        title: "قالب‌بندی مستقیم",
        description: "پررنگ، مورب، زیرخط و Inline Code را روی متن انتخاب‌شده اعمال می‌کند.",
        context: "پس از انتخاب متن",
        keys: [
          key({ code: "KeyB", primary: true }),
          key({ code: "KeyI", primary: true }),
          key({ code: "KeyU", primary: true }),
          key({ code: "Backquote", ctrl: true }),
        ],
      },
      {
        id: "selection-link",
        title: "ساخت پیوند",
        description:
          "همین کلید بدون انتخاب متن، مرکز فرمان راوی را باز می‌کند.",
        context: "Ctrl/Cmd+K وابسته به Context",
        keys: [key({ code: "KeyK", primary: true })],
      },
      {
        id: "selection-toolbar-action",
        title: "اجرای عمل یا بازگشت به متن",
        description:
          "Enter یا Space عمل فعال را اجرا می‌کند؛ Escape با حفظ Selection به ویرایشگر برمی‌گردد.",
        context: "وقتی نوار ابزار فعال است",
        keys: [
          key({ code: "Enter" }),
          key({ code: "Space" }),
          key({ code: "Escape" }),
        ],
      },
    ],
  },
];

export function shortcutPlatformLabel(environment: CommandEnvironment) {
  return environment.platform === "mac" ? "macOS" : "Windows / Linux";
}

export function shortcutPrimaryLabel(environment: CommandEnvironment) {
  return environment.platform === "mac" ? "Cmd" : "Ctrl";
}
