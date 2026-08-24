import type { MarkdownBlockKind } from "./block-types";
import type { CommandPlatform } from "../keyboard/command-registry";

export type ContextualShortcutHint = {
  keys: string;
  label: string;
};

export type ContextualShortcutContext = {
  blockKind: MarkdownBlockKind;
  platform: CommandPlatform;
  rendered?: boolean;
  structuralSelection?: boolean;
  textSelection?: boolean;
};

function modifier(platform: CommandPlatform) {
  return platform === "mac" ? "Cmd" : "Ctrl";
}

export function contextualShortcutsFor({
  blockKind,
  platform,
  rendered = false,
  structuralSelection = false,
  textSelection = false,
}: ContextualShortcutContext): readonly ContextualShortcutHint[] {
  const primary = modifier(platform);

  if (structuralSelection) {
    return [
      { keys: "Esc", label: "لغو انتخاب بلاک" },
      { keys: `${primary}+D`, label: "تکثیر بلاک" },
      { keys: "Alt+↑/↓", label: "جابه‌جایی بلاک" },
    ];
  }

  const selectionHint = textSelection
    ? [{ keys: "Alt+F10", label: "نوار قالب‌بندی" }]
    : [];

  if (rendered && blockKind !== "table") {
    return [{ keys: `${primary}+Enter`, label: "بلاک جدید" }];
  }

  if (blockKind === "blank") {
    return [
      { keys: `${primary}+Enter`, label: "بلاک جدید" },
      { keys: "/", label: "فهرست بلاک‌ها" },
      { keys: "Alt+↑/↓", label: "جابه‌جایی بلاک" },
      { keys: `${primary}+D`, label: "تکثیر بلاک" },
    ];
  }

  if (blockKind === "list") {
    return [
      ...selectionHint,
      { keys: "Enter", label: "آیتم هم‌سطح" },
      { keys: "Shift+Enter", label: "خط جدید در آیتم" },
      { keys: "Tab / Shift+Tab", label: "تورفتگی / بیرون‌رفتگی" },
      { keys: `${primary}+Enter`, label: "بلاک جدید" },
      { keys: "Alt+↑/↓", label: "جابه‌جایی آیتم" },
      { keys: `${primary}+D`, label: "تکثیر بلاک" },
    ];
  }

  if (blockKind === "table") {
    return [
      ...selectionHint,
      { keys: `${primary}+A`, label: "انتخاب محتوای سلول" },
      { keys: "Tab / Shift+Tab", label: "حرکت افقی" },
      { keys: "↑ / ↓", label: "حرکت عمودی؛ خروج در مرز" },
      { keys: "← / →", label: "حرکت افقی در مرز متن" },
      { keys: "Shift+جهت‌ها", label: "انتخاب محدوده" },
      { keys: `${primary}+Enter`, label: "بلاک جدید" },
    ];
  }

  if (["code", "mermaid", "image", "formula"].includes(blockKind)) {
    return [{ keys: `${primary}+Enter`, label: "بلاک جدید" }];
  }

  return [
    ...selectionHint,
    { keys: "Enter", label: "خط جدید در همین بلاک" },
    { keys: `${primary}+Enter`, label: "بلاک جدید" },
    { keys: "Alt+↑/↓", label: "جابه‌جایی بلاک" },
    { keys: `${primary}+D`, label: "تکثیر بلاک" },
  ];
}
