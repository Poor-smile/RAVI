export type ThemePreference = "system" | "light" | "dark";
export type MotionPreference = "normal" | "system" | "reduced";

export type AccentId =
  | "raavi-blue"
  | "turquoise"
  | "forest"
  | "olive"
  | "amber"
  | "orange"
  | "brick"
  | "coral"
  | "raspberry"
  | "purple"
  | "indigo"
  | "walnut"
  | "graphite";

export type AppearancePreferences = {
  theme: ThemePreference;
  accent: AccentId;
  motion: MotionPreference;
};

export const APPEARANCE_PREFERENCES_STORAGE_KEY =
  "raavi:appearance-preferences:v1";
export const LEGACY_THEME_STORAGE_KEY = "raavi:theme:v1";

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  theme: "system",
  accent: "raavi-blue",
  motion: "system",
};

export const ACCENT_OPTIONS: readonly {
  id: AccentId;
  label: string;
  color: string;
}[] = [
  { id: "raavi-blue", label: "آبی راوی", color: "#2557e5" },
  { id: "turquoise", label: "فیروزه‌ای", color: "#007a7a" },
  { id: "forest", label: "جنگلی", color: "#277a4b" },
  { id: "olive", label: "زیتونی", color: "#647117" },
  { id: "amber", label: "کهربایی", color: "#9a5a00" },
  { id: "orange", label: "نارنجی", color: "#a9470b" },
  { id: "brick", label: "آجری", color: "#9f3f32" },
  { id: "coral", label: "مرجانی", color: "#a63e53" },
  { id: "raspberry", label: "تمشکی", color: "#9e2f63" },
  { id: "purple", label: "بنفش", color: "#75419a" },
  { id: "indigo", label: "نیلی", color: "#4656a6" },
  { id: "walnut", label: "گردویی", color: "#75523b" },
  { id: "graphite", label: "گرافیتی", color: "#52616b" },
] as const;

const accentIds = new Set<AccentId>(ACCENT_OPTIONS.map((option) => option.id));

function isThemePreference(value: unknown): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isMotionPreference(value: unknown): value is MotionPreference {
  return value === "normal" || value === "system" || value === "reduced";
}

function isAccentId(value: unknown): value is AccentId {
  return typeof value === "string" && accentIds.has(value as AccentId);
}

export function parseAppearancePreferences(
  value: string | null | undefined,
  legacyTheme?: string | null,
): AppearancePreferences {
  let parsed: Partial<AppearancePreferences> | null = null;
  if (value) {
    try {
      const candidate = JSON.parse(value) as unknown;
      if (candidate && typeof candidate === "object") {
        parsed = candidate as Partial<AppearancePreferences>;
      }
    } catch {
      parsed = null;
    }
  }

  const theme = isThemePreference(parsed?.theme)
    ? parsed.theme
    : isThemePreference(legacyTheme)
      ? legacyTheme
      : DEFAULT_APPEARANCE_PREFERENCES.theme;

  return {
    theme,
    accent: isAccentId(parsed?.accent)
      ? parsed.accent
      : DEFAULT_APPEARANCE_PREFERENCES.accent,
    motion: isMotionPreference(parsed?.motion)
      ? parsed.motion
      : DEFAULT_APPEARANCE_PREFERENCES.motion,
  };
}

export function effectiveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): "light" | "dark" {
  return preference === "system"
    ? systemPrefersDark
      ? "dark"
      : "light"
    : preference;
}
