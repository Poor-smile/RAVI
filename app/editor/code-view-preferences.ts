export type CodeViewLineDirection = "auto" | "rtl" | "ltr";

export type CodeViewPreferences = {
  toolbarVisible: boolean;
  contextualHintsVisible: boolean;
  lineDirection: CodeViewLineDirection;
};

export const CODE_VIEW_PREFERENCES_STORAGE_KEY =
  "raavi:code-view-preferences:v1";

export const DEFAULT_CODE_VIEW_PREFERENCES: CodeViewPreferences = {
  toolbarVisible: true,
  contextualHintsVisible: true,
  lineDirection: "auto",
};

function isCodeViewLineDirection(
  value: unknown,
): value is CodeViewLineDirection {
  return value === "auto" || value === "rtl" || value === "ltr";
}

export function parseCodeViewPreferences(
  value: string | null | undefined,
): CodeViewPreferences {
  if (!value) return { ...DEFAULT_CODE_VIEW_PREFERENCES };

  try {
    const parsed = JSON.parse(value) as Partial<CodeViewPreferences> | null;
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_CODE_VIEW_PREFERENCES };
    }
    return {
      toolbarVisible:
        typeof parsed.toolbarVisible === "boolean"
          ? parsed.toolbarVisible
          : DEFAULT_CODE_VIEW_PREFERENCES.toolbarVisible,
      contextualHintsVisible:
        typeof parsed.contextualHintsVisible === "boolean"
          ? parsed.contextualHintsVisible
          : DEFAULT_CODE_VIEW_PREFERENCES.contextualHintsVisible,
      lineDirection: isCodeViewLineDirection(parsed.lineDirection)
        ? parsed.lineDirection
        : DEFAULT_CODE_VIEW_PREFERENCES.lineDirection,
    };
  } catch {
    return { ...DEFAULT_CODE_VIEW_PREFERENCES };
  }
}
