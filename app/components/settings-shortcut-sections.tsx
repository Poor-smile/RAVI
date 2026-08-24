"use client";

import {
  formatBinding,
  type CommandEnvironment,
  type KeyBinding,
} from "../keyboard/command-registry";

type SettingsShortcutRow = {
  id: string;
  title: string;
  description: string;
  shortcut: (environment: CommandEnvironment) => string;
  contextDependent?: boolean;
};

type SettingsShortcutSection = {
  id: string;
  title: string;
  rows: SettingsShortcutRow[];
};

const binding = (environment: CommandEnvironment, value: KeyBinding) =>
  formatBinding(value, environment.platform);

const alternateModifier = (environment: CommandEnvironment) =>
  environment.platform === "mac" ? "Option" : "Alt";

const SETTINGS_SHORTCUT_SECTIONS: SettingsShortcutSection[] = [
  {
    id: "blocks",
    title: "ساخت و مدیریت بلاک",
    rows: [
      {
        id: "block-insert-after",
        title: "ثبت و ساخت Text Block بعدی",
        description: "Enter در List Block برای آیتم داخلی آزاد می‌ماند.",
        shortcut: (environment) =>
          binding(environment, { code: "Enter", primary: true }),
      },
      {
        id: "block-duplicate",
        title: "تکثیر کامل بلاک",
        description:
          "نسخه بعد از بلاک فعلی ساخته و focus به نسخه منتقل می‌شود.",
        shortcut: (environment) =>
          binding(environment, { code: "KeyD", primary: true }),
      },
      {
        id: "block-reorder",
        title: "جابه‌جایی کامل بلاک",
        description:
          "همان reorder engine مربوط به Drag Handle را استفاده می‌کند.",
        shortcut: (environment) => {
          const modifier = alternateModifier(environment);
          return `${modifier}+↑ / ${modifier}+↓`;
        },
      },
    ],
  },
  {
    id: "block-menu",
    title: "منوی / و انتخاب نوع",
    rows: [
      {
        id: "slash-open",
        title: "باز کردن منوی نوع",
        description: "alias هر نوع کنار همان ردیف دیده می‌شود.",
        shortcut: () => "/ روی Empty Block",
      },
      {
        id: "slash-move",
        title: "حرکت در گزینه‌ها",
        description: "Focus حلقوی و قابل مشاهده است.",
        shortcut: () => "↑/↓ · Home/End",
      },
      {
        id: "slash-accept-dismiss",
        title: "انتخاب یا خروج",
        description: "Enter نوع را انتخاب و Escape focus را برمی‌گرداند.",
        shortcut: () => "Enter · Escape",
      },
    ],
  },
  {
    id: "selection",
    title: "قالب‌بندی Selection",
    rows: [
      {
        id: "selection-toolbar-focus",
        title: "ورود به نوار شناور",
        description:
          "Selection حفظ می‌شود؛ ←/→ و Home/End حرکت می‌کنند.",
        shortcut: (environment) =>
          binding(environment, { code: "F10", alt: true }),
      },
      {
        id: "selection-format",
        title: "پررنگ، مورب، زیرخط، Code",
        description:
          "Link هنگام Selection با Ctrl/Cmd+K زمینه‌ای است.",
        shortcut: (environment) =>
          [
            { code: "KeyB", primary: true },
            { code: "KeyI", primary: true },
            { code: "KeyU", primary: true },
            { code: "Backquote", ctrl: true },
          ]
            .map((value) => binding(environment, value))
            .join(" · "),
        contextDependent: true,
      },
      {
        id: "selection-toolbar-action",
        title: "اعمال یا بازگشت",
        description:
          "اعمال قالب یا بازگشت به editor بدون حذف Selection.",
        shortcut: () => "Enter/Space · Escape",
      },
    ],
  },
];

export function SettingsShortcutSections({
  environment,
}: {
  environment: CommandEnvironment;
}) {
  return (
    <section
      className="shortcut-settings-shortcuts"
      aria-label={`میان‌برهای ${
        environment.platform === "mac" ? "macOS" : "Windows / Linux"
      }`}
    >
      {SETTINGS_SHORTCUT_SECTIONS.map((section) => (
        <section
          key={section.id}
          className="settings-shortcut-section"
          aria-labelledby={`settings-shortcut-${section.id}`}
        >
          <h3 id={`settings-shortcut-${section.id}`}>{section.title}</h3>
          <ul>
            {section.rows.map((row) => (
              <li
                key={row.id}
                data-settings-shortcut-id={row.id}
                data-context-dependent={row.contextDependent || undefined}
              >
                <span className="settings-shortcut-copy">
                  <strong>{row.title}</strong>
                  <span>{row.description}</span>
                </span>
                <code className="settings-shortcut-key" dir="ltr">
                  {row.shortcut(environment)}
                </code>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
