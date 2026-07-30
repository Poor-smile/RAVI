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
  | "annotation"
  | "window";

export type CommandId =
  | "file.open"
  | "file.save"
  | "file.saveAs"
  | "file.new"
  | "help.shortcuts"
  | "edit.bold"
  | "edit.italic"
  | "edit.code"
  | "edit.link"
  | "edit.quote"
  | "view.reading"
  | "focus.editor"
  | "focus.preview"
  | "focus.library"
  | "focus.annotations"
  | "view.text.decrease"
  | "view.text.increase"
  | "annotation.highlight"
  | "annotation.comment"
  | "annotation.margin"
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
};

export type CommandDefinition = {
  id: CommandId;
  title: string;
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
  { id: "view", title: "نما و تمرکز" },
  { id: "annotation", title: "یادداشت‌گذاری" },
  { id: "window", title: "پنجره‌ها" },
];

export const COMMAND_REGISTRY: CommandDefinition[] = [
  {
    id: "file.open",
    title: "بازکردن فایل",
    group: "file",
    bindings: [{ code: "KeyO", primary: true }],
    allowInEditable: ["editor"],
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
    id: "edit.link",
    title: "افزودن پیوند",
    group: "edit",
    bindings: [{ code: "KeyK", primary: true }],
    allowInEditable: ["editor"],
    showInHelp: true,
    contextLabel: "فقط در ویرایشگر",
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
    id: "view.reading",
    title: "حالت مطالعه",
    group: "view",
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
    title: "پنل یادداشت‌ها",
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
    group: "view",
    bindings: [{ code: "BracketLeft", alt: true }],
    allowInEditable: false,
    repeatable: true,
    showInHelp: true,
    contextLabel: "در پیش‌نمایش یا حالت مطالعه",
  },
  {
    id: "view.text.increase",
    title: "افزایش اندازه متن",
    group: "view",
    bindings: [{ code: "BracketRight", alt: true }],
    allowInEditable: false,
    repeatable: true,
    showInHelp: true,
    contextLabel: "در پیش‌نمایش یا حالت مطالعه",
  },
  {
    id: "annotation.highlight",
    title: "هایلایت انتخاب",
    group: "annotation",
    bindings: [{ code: "KeyH", primary: true, shift: true }],
    allowInEditable: false,
    showInHelp: true,
    contextLabel: "پس از انتخاب متن",
  },
  {
    id: "annotation.comment",
    title: "کامنت برای انتخاب",
    group: "annotation",
    bindings: [
      {
        code: "KeyM",
        ctrl: true,
        alt: true,
        platforms: ["windows", "linux"],
      },
    ],
    allowInEditable: false,
    showInHelp: true,
    contextLabel: "پس از انتخاب متن",
  },
  {
    id: "annotation.margin",
    title: "حاشیه برای انتخاب",
    group: "annotation",
    bindings: [
      {
        code: "KeyN",
        ctrl: true,
        alt: true,
        platforms: ["windows", "linux"],
      },
    ],
    allowInEditable: false,
    showInHelp: true,
    contextLabel: "پس از انتخاب متن",
  },
  {
    id: "annotation.submit",
    title: "ثبت یادداشت",
    group: "annotation",
    bindings: [{ code: "Enter", primary: true }],
    allowInEditable: ["composer"],
    showInHelp: true,
    contextLabel: "هنگام نوشتن یادداشت",
  },
  {
    id: "help.shortcuts",
    title: "راهنمای میان‌برها",
    group: "window",
    bindings: [
      { code: "Slash", primary: true },
      { code: "F1", surfaces: ["electron"] },
    ],
    allowInEditable: true,
    showInHelp: true,
  },
  {
    id: "layer.dismiss",
    title: "بستن لایه فعال",
    group: "window",
    bindings: [{ code: "Escape" }],
    allowInEditable: true,
    showInHelp: true,
    contextLabel: "بالاترین لایه باز",
  },
];

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
