import { parseSingleEditorMode, type SingleEditorMode } from "../editor/mode";
import {
  parseSidebarPreferences,
  type SidebarPreferences,
} from "../sidebar-state";

export const WORKSPACE_STATE_STORAGE_KEY = "raavi:workspace:v2";
export const LEGACY_PANE_LAYOUT_KEY = "raavi:pane-layout:v1";
export const LEGACY_SIDEBAR_KEY = "raavi:sidebar:v1";
export const LEGACY_LIBRARY_PINS_KEY = "raavi:library-pins:v1";

export type PersistedPaneLayout = {
  mode: "split" | "editor" | "preview";
  previewPercent: number;
  singleEditorMode: SingleEditorMode;
};

export type WorkspaceStateV2 = {
  version: 2;
  pane: PersistedPaneLayout;
  sidebar: SidebarPreferences;
  pinnedPaths: string[];
};

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const DEFAULT_PANE: PersistedPaneLayout = {
  mode: "editor",
  previewPercent: 50,
  singleEditorMode: "live",
};

function parseJson(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parsePaneLayout(value: unknown): PersistedPaneLayout {
  const parsed =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const rawMode = parsed.mode ?? parsed.layout;
  const mode =
    rawMode === "editor" || rawMode === "editor-only"
      ? "editor"
      : rawMode === "preview" || rawMode === "preview-only"
        ? "preview"
        : rawMode === "split"
          ? "split"
          : DEFAULT_PANE.mode;
  const rawPercent = parsed.previewPercent ?? parsed.splitPercent;
  const previewPercent =
    typeof rawPercent === "number" && Number.isFinite(rawPercent)
      ? Math.min(90, Math.max(10, Math.round(rawPercent * 10) / 10))
      : DEFAULT_PANE.previewPercent;

  return {
    mode,
    previewPercent,
    singleEditorMode: parseSingleEditorMode(
      parsed.singleEditorMode ?? parsed.editorMode,
    ),
  };
}

export function parsePinnedPaths(value: unknown): string[] {
  const candidate = Array.isArray(value)
    ? value
    : value && typeof value === "object"
      ? (value as { paths?: unknown }).paths
      : [];
  if (!Array.isArray(candidate)) return [];
  return [...new Set(candidate.filter((path): path is string => typeof path === "string" && path.trim().length > 0))];
}

export function parseWorkspaceState(raw: string | null): WorkspaceStateV2 | null {
  const value = parseJson(raw);
  if (!value || typeof value !== "object") return null;
  const parsed = value as Record<string, unknown>;
  if (parsed.version !== 2) return null;

  return {
    version: 2,
    pane: parsePaneLayout(parsed.pane),
    sidebar: parseSidebarPreferences(JSON.stringify(parsed.sidebar ?? null)),
    pinnedPaths: parsePinnedPaths(parsed.pinnedPaths),
  };
}

/**
 * Creates a non-destructive v2 snapshot and restores missing v1 keys for the
 * current UI. Legacy keys are intentionally retained so rollback never loses
 * layout or shelf preferences.
 */
export function migrateWorkspaceState(storage: StorageLike): WorkspaceStateV2 {
  const current = parseWorkspaceState(storage.getItem(WORKSPACE_STATE_STORAGE_KEY));
  const state =
    current ??
    ({
      version: 2,
      pane: parsePaneLayout(parseJson(storage.getItem(LEGACY_PANE_LAYOUT_KEY))),
      sidebar: parseSidebarPreferences(storage.getItem(LEGACY_SIDEBAR_KEY)),
      pinnedPaths: parsePinnedPaths(
        parseJson(storage.getItem(LEGACY_LIBRARY_PINS_KEY)),
      ),
    } satisfies WorkspaceStateV2);

  if (!storage.getItem(LEGACY_PANE_LAYOUT_KEY)) {
    storage.setItem(LEGACY_PANE_LAYOUT_KEY, JSON.stringify(state.pane));
  }
  if (!storage.getItem(LEGACY_SIDEBAR_KEY)) {
    storage.setItem(LEGACY_SIDEBAR_KEY, JSON.stringify(state.sidebar));
  }
  if (!storage.getItem(LEGACY_LIBRARY_PINS_KEY)) {
    storage.setItem(LEGACY_LIBRARY_PINS_KEY, JSON.stringify(state.pinnedPaths));
  }
  storage.setItem(WORKSPACE_STATE_STORAGE_KEY, JSON.stringify(state));
  return state;
}

export function persistWorkspaceState(
  storage: StorageLike,
  state: Omit<WorkspaceStateV2, "version">,
) {
  storage.setItem(
    WORKSPACE_STATE_STORAGE_KEY,
    JSON.stringify({ version: 2, ...state } satisfies WorkspaceStateV2),
  );
}
