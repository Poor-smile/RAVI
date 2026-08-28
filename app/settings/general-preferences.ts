export type StartupView = "recent" | "workspace" | "blank";

export type GeneralPreferences = {
  startupView: StartupView;
};

export const GENERAL_PREFERENCES_STORAGE_KEY =
  "raavi:general-preferences:v1";

export const DEFAULT_GENERAL_PREFERENCES: GeneralPreferences = {
  startupView: "recent",
};

export function parseGeneralPreferences(
  stored: string | null | undefined,
): GeneralPreferences {
  if (!stored) return { ...DEFAULT_GENERAL_PREFERENCES };
  try {
    const value = JSON.parse(stored) as Partial<GeneralPreferences> | null;
    return {
      startupView:
        value?.startupView === "workspace" || value?.startupView === "blank"
          ? value.startupView
          : DEFAULT_GENERAL_PREFERENCES.startupView,
    };
  } catch {
    return { ...DEFAULT_GENERAL_PREFERENCES };
  }
}
