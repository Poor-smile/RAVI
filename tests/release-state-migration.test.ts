import assert from "node:assert/strict";
import test from "node:test";
import {
  LEGACY_LIBRARY_PINS_KEY,
  LEGACY_PANE_LAYOUT_KEY,
  LEGACY_SIDEBAR_KEY,
  migrateWorkspaceState,
  parsePaneLayout,
  parsePinnedPaths,
  WORKSPACE_STATE_STORAGE_KEY,
} from "../app/release/workspace-state";
import { parseSidebarPreferences } from "../app/sidebar-state";

class MemoryStorage {
  values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

test("legacy layout aliases migrate without losing the selected editor mode", () => {
  assert.deepEqual(
    parsePaneLayout({
      layout: "editor-only",
      splitPercent: 71.17,
      editorMode: "source",
    }),
    { mode: "editor", previewPercent: 71.2, singleEditorMode: "source" },
  );
});

test("a fresh workspace starts in the dominant single-editor surface", () => {
  assert.deepEqual(parsePaneLayout(null), {
    mode: "editor",
    previewPercent: 50,
    singleEditorMode: "live",
  });
});

test("legacy sidebar names and out-of-range widths are normalized", () => {
  assert.deepEqual(
    parseSidebarPreferences(
      JSON.stringify({ activeView: "recent", panelWidth: 999, isCollapsed: true }),
    ),
    { view: "history", width: 420, collapsed: true },
  );
});

test("workspace v2 migration is non-destructive and preserves Unicode pins", () => {
  const storage = new MemoryStorage();
  const paneRaw = JSON.stringify({ mode: "preview", previewPercent: 33 });
  const sidebarRaw = JSON.stringify({ view: "search", width: 312, collapsed: false });
  const pinsRaw = JSON.stringify(["یادداشت‌ها/اول.md", "English folder/two.md"]);
  storage.setItem(LEGACY_PANE_LAYOUT_KEY, paneRaw);
  storage.setItem(LEGACY_SIDEBAR_KEY, sidebarRaw);
  storage.setItem(LEGACY_LIBRARY_PINS_KEY, pinsRaw);

  const migrated = migrateWorkspaceState(storage as unknown as Storage);
  assert.equal(migrated.version, 2);
  assert.deepEqual(migrated.pinnedPaths, parsePinnedPaths(JSON.parse(pinsRaw)));
  assert.equal(storage.getItem(LEGACY_PANE_LAYOUT_KEY), paneRaw);
  assert.equal(storage.getItem(LEGACY_SIDEBAR_KEY), sidebarRaw);
  assert.equal(storage.getItem(LEGACY_LIBRARY_PINS_KEY), pinsRaw);
  assert.ok(storage.getItem(WORKSPACE_STATE_STORAGE_KEY));
});

test("a v2 snapshot restores missing rollback-safe v1 keys", () => {
  const storage = new MemoryStorage();
  storage.setItem(
    WORKSPACE_STATE_STORAGE_KEY,
    JSON.stringify({
      version: 2,
      pane: { mode: "split", previewPercent: 48, singleEditorMode: "live" },
      sidebar: { view: "files", width: 280, collapsed: false },
      pinnedPaths: ["فایل نمونه.md"],
    }),
  );

  migrateWorkspaceState(storage as unknown as Storage);
  assert.ok(storage.getItem(LEGACY_PANE_LAYOUT_KEY));
  assert.ok(storage.getItem(LEGACY_SIDEBAR_KEY));
  assert.ok(storage.getItem(LEGACY_LIBRARY_PINS_KEY));
});
