export type EditorMode = "live" | "source" | "proof";
export type SingleEditorMode = Exclude<EditorMode, "proof">;

export const EDITOR_MODE_STORAGE_VERSION = 1;

export const EDITOR_MODES: Array<{
  id: EditorMode;
  title: string;
  description: string;
}> = [
  {
    id: "live",
    title: "ویرایش روان",
    description: "نتیجه را همان‌جا ببینید؛ نشانه‌ها کنار نشانگر آشکار می‌شوند.",
  },
  {
    id: "source",
    title: "متن خام",
    description: "همهٔ نشانه‌های Markdown را بدون پنهان‌سازی ویرایش کنید.",
  },
  {
    id: "proof",
    title: "نمونه‌خوانی دوبرگی",
    description: "متن خام و نتیجه را کنار هم و هماهنگ بررسی کنید.",
  },
];

export function parseSingleEditorMode(value: unknown): SingleEditorMode {
  return value === "source" ? "source" : "live";
}

export function liveEditFeatureEnabled(value: unknown) {
  if (typeof value !== "string") return true;
  return !["0", "false", "off", "disabled"].includes(
    value.trim().toLocaleLowerCase("en"),
  );
}

export function effectiveEditorMode({
  paneMode,
  singleMode,
}: {
  paneMode: "split" | "editor" | "preview";
  singleMode: SingleEditorMode;
}): EditorMode {
  return paneMode === "editor" ? singleMode : "proof";
}
