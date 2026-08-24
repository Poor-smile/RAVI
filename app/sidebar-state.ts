export const SIDEBAR_STORAGE_KEY = "raavi:sidebar:v1";
export const SIDEBAR_MIN_WIDTH = 240;
export const SIDEBAR_MAX_WIDTH = 420;
export const SIDEBAR_DEFAULT_WIDTH = 304;

export const SIDEBAR_VIEWS = [
  "files",
  "search",
  "history",
  "versions",
  "ai",
  "outline",
  "annotations",
] as const;

export type SidebarView = (typeof SIDEBAR_VIEWS)[number];

export type SidebarPreferences = {
  view: SidebarView;
  width: number;
  collapsed: boolean;
};

export const DEFAULT_SIDEBAR_PREFERENCES: SidebarPreferences = {
  view: "files",
  width: SIDEBAR_DEFAULT_WIDTH,
  collapsed: true,
};

export function clampSidebarWidth(value: number) {
  if (!Number.isFinite(value)) return SIDEBAR_DEFAULT_WIDTH;
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(value)));
}

export function isSidebarView(value: unknown): value is SidebarView {
  return typeof value === "string" && SIDEBAR_VIEWS.includes(value as SidebarView);
}

export function parseSidebarPreferences(raw: string | null): SidebarPreferences {
  if (!raw) return DEFAULT_SIDEBAR_PREFERENCES;

  try {
    const parsed = JSON.parse(raw) as Partial<SidebarPreferences> & {
      activeView?: unknown;
      panelWidth?: unknown;
      isCollapsed?: unknown;
    };
    const storedView = parsed.view ?? parsed.activeView;
    const view =
      storedView === "library"
        ? "files"
        : storedView === "recent" || storedView === "pins"
          ? "history"
          : storedView;
    const width = parsed.width ?? parsed.panelWidth;
    const collapsed = parsed.collapsed ?? parsed.isCollapsed;
    return {
      view: isSidebarView(view) ? view : DEFAULT_SIDEBAR_PREFERENCES.view,
      width:
        typeof width === "number"
          ? clampSidebarWidth(width)
          : DEFAULT_SIDEBAR_PREFERENCES.width,
      collapsed:
        typeof collapsed === "boolean"
          ? collapsed
          : DEFAULT_SIDEBAR_PREFERENCES.collapsed,
    };
  } catch {
    return DEFAULT_SIDEBAR_PREFERENCES;
  }
}
