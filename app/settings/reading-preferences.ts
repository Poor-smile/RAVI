export type ReadingTextSize = "small" | "normal" | "large";
export type ReadingLineSpacing = "compact" | "normal" | "open";
export type ReadingTextWidth = "narrow" | "balanced" | "wide";

export type ReadingPreferences = {
  textSize: ReadingTextSize;
  lineSpacing: ReadingLineSpacing;
  textWidth: ReadingTextWidth;
  rememberPosition: boolean;
  autoHideHeader: boolean;
  openOutlineOnEnter: boolean;
};

export const READING_PREFERENCES_STORAGE_KEY =
  "raavi:reading-preferences:v1";

export const DEFAULT_READING_PREFERENCES: ReadingPreferences = {
  textSize: "normal",
  lineSpacing: "normal",
  textWidth: "balanced",
  rememberPosition: true,
  autoHideHeader: true,
  openOutlineOnEnter: false,
};

export const READING_TEXT_SIZE_PX: Record<ReadingTextSize, number> = {
  small: 16,
  normal: 18,
  large: 20,
};

export const READING_LINE_HEIGHT: Record<ReadingLineSpacing, number> = {
  compact: 1.7,
  normal: 2,
  open: 2.25,
};

export const READING_TEXT_WIDTH_PX: Record<ReadingTextWidth, number> = {
  narrow: 640,
  balanced: 760,
  wide: 880,
};

function isTextSize(value: unknown): value is ReadingTextSize {
  return value === "small" || value === "normal" || value === "large";
}

function isLineSpacing(value: unknown): value is ReadingLineSpacing {
  return value === "compact" || value === "normal" || value === "open";
}

function isTextWidth(value: unknown): value is ReadingTextWidth {
  return value === "narrow" || value === "balanced" || value === "wide";
}

export function parseReadingPreferences(
  value: string | null | undefined,
): ReadingPreferences {
  if (!value) return { ...DEFAULT_READING_PREFERENCES };
  try {
    const parsed = JSON.parse(value) as Partial<ReadingPreferences> | null;
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_READING_PREFERENCES };
    }
    return {
      textSize: isTextSize(parsed.textSize)
        ? parsed.textSize
        : DEFAULT_READING_PREFERENCES.textSize,
      lineSpacing: isLineSpacing(parsed.lineSpacing)
        ? parsed.lineSpacing
        : DEFAULT_READING_PREFERENCES.lineSpacing,
      textWidth: isTextWidth(parsed.textWidth)
        ? parsed.textWidth
        : DEFAULT_READING_PREFERENCES.textWidth,
      rememberPosition:
        typeof parsed.rememberPosition === "boolean"
          ? parsed.rememberPosition
          : DEFAULT_READING_PREFERENCES.rememberPosition,
      autoHideHeader:
        typeof parsed.autoHideHeader === "boolean"
          ? parsed.autoHideHeader
          : DEFAULT_READING_PREFERENCES.autoHideHeader,
      openOutlineOnEnter:
        typeof parsed.openOutlineOnEnter === "boolean"
          ? parsed.openOutlineOnEnter
          : DEFAULT_READING_PREFERENCES.openOutlineOnEnter,
    };
  } catch {
    return { ...DEFAULT_READING_PREFERENCES };
  }
}
