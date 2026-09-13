"use client";

import { useEffect, useRef, useState } from "react";
import {
  migrateWorkspaceState,
  parsePaneLayout,
  persistWorkspaceState,
} from "../release/workspace-state";
import { parseSingleEditorMode, type SingleEditorMode } from "../editor/mode";

export type ScrollPane = "editor" | "preview";
export type DesktopPaneMode = "split" | ScrollPane;

export const PANE_LAYOUT_STORAGE_KEY = "raavi:pane-layout:v1";

export function useWorkspaceLayoutState(liveEditEnabled: boolean) {
  const [focusedPane, setFocusedPane] = useState<ScrollPane>("editor");
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(true);
  const [desktopPaneMode, setDesktopPaneMode] =
    useState<DesktopPaneMode>("editor");
  const [activeSplitPane, setActiveSplitPane] =
    useState<ScrollPane>("editor");
  const [splitWorkspaceActive, setSplitWorkspaceActive] = useState(false);
  const [singleEditorMode, setSingleEditorMode] = useState<SingleEditorMode>(
    liveEditEnabled ? "live" : "source",
  );
  const [previewPanePercent, setPreviewPanePercent] = useState(50);
  const [paneLayoutHydrated, setPaneLayoutHydrated] = useState(false);
  const paneLayoutInteractedRef = useRef(false);
  const lastExpandedPreviewPercentRef = useRef(50);
  const [paneDragging, setPaneDragging] = useState(false);
  const [paneCollapseCandidate, setPaneCollapseCandidate] =
    useState<ScrollPane | null>(null);
  const [modeSwipeTarget, setModeSwipeTarget] = useState<
    "code" | "writing" | null
  >(null);

  useEffect(() => {
    try {
      migrateWorkspaceState(window.localStorage);
    } catch {
      // Private browsing may reject persistence; state remains usable in-session.
    }
  }, []);

  useEffect(() => {
    // Restore layout before mounting a recovered document, even while the native
    // startup view covers the renderer and animation frames are suspended.
    const timer = window.setTimeout(() => {
      try {
        const savedLayout = window.localStorage.getItem(PANE_LAYOUT_STORAGE_KEY);
        if (savedLayout && !paneLayoutInteractedRef.current) {
          const savedLayoutValue = JSON.parse(savedLayout) as Record<
            string,
            unknown
          >;
          const parsed = parsePaneLayout(savedLayoutValue);
          const restoredSplit = parsed.mode === "split";
          const restoredSingleMode =
            parsed.mode === "preview"
              ? "live"
              : parsed.mode === "editor" &&
                  savedLayoutValue.splitWorkspaceActive === true
                ? "source"
                : parseSingleEditorMode(parsed.singleEditorMode);
          setDesktopPaneMode(restoredSplit ? "split" : "editor");
          setSplitWorkspaceActive(restoredSplit);
          setSingleEditorMode(
            liveEditEnabled ? restoredSingleMode : "source",
          );
          lastExpandedPreviewPercentRef.current = parsed.previewPercent;
          setPreviewPanePercent(parsed.previewPercent);
        }
      } catch {
        // The single editor is the safe default when layout storage is invalid.
      } finally {
        setPaneLayoutHydrated(true);
      }
    });
    return () => window.clearTimeout(timer);
  }, [liveEditEnabled]);

  useEffect(() => {
    if (!paneLayoutHydrated) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          PANE_LAYOUT_STORAGE_KEY,
          JSON.stringify({
            mode: desktopPaneMode,
            previewPercent: previewPanePercent,
            singleEditorMode,
            splitWorkspaceActive,
          }),
        );
      } catch {
        // The layout remains usable for this session without persistence.
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [
    desktopPaneMode,
    paneLayoutHydrated,
    previewPanePercent,
    singleEditorMode,
    splitWorkspaceActive,
  ]);

  useEffect(() => {
    if (!modeSwipeTarget) return;
    const timer = window.setTimeout(() => setModeSwipeTarget(null), 220);
    return () => window.clearTimeout(timer);
  }, [modeSwipeTarget]);

  return [
    [focusedPane, setFocusedPane],
    [scrollSyncEnabled, setScrollSyncEnabled],
    [desktopPaneMode, setDesktopPaneMode],
    [activeSplitPane, setActiveSplitPane],
    [splitWorkspaceActive, setSplitWorkspaceActive],
    [singleEditorMode, setSingleEditorMode],
    [previewPanePercent, setPreviewPanePercent],
    paneLayoutHydrated,
    paneLayoutInteractedRef,
    lastExpandedPreviewPercentRef,
    [paneDragging, setPaneDragging],
    [paneCollapseCandidate, setPaneCollapseCandidate],
    [modeSwipeTarget, setModeSwipeTarget],
  ] as const;
}

export function usePersistedWorkspaceState({
  desktopPaneMode,
  paneLayoutHydrated,
  pinnedLibraryHydrated,
  pinnedLibraryKeys,
  previewPanePercent,
  sidebarCollapsed,
  sidebarHydrated,
  sidebarView,
  sidebarWidth,
  singleEditorMode,
}: {
  desktopPaneMode: DesktopPaneMode;
  paneLayoutHydrated: boolean;
  pinnedLibraryHydrated: boolean;
  pinnedLibraryKeys: string[];
  previewPanePercent: number;
  sidebarCollapsed: boolean;
  sidebarHydrated: boolean;
  sidebarView: import("../sidebar-state").SidebarView;
  sidebarWidth: number;
  singleEditorMode: SingleEditorMode;
}) {
  useEffect(() => {
    if (!paneLayoutHydrated || !sidebarHydrated || !pinnedLibraryHydrated) {
      return;
    }
    const timer = window.setTimeout(() => {
      try {
        persistWorkspaceState(window.localStorage, {
          pane: {
            mode: desktopPaneMode,
            previewPercent: previewPanePercent,
            singleEditorMode,
          },
          sidebar: {
            view: sidebarView,
            width: sidebarWidth,
            collapsed: sidebarCollapsed,
          },
          pinnedPaths: pinnedLibraryKeys,
        });
      } catch {
        // The v1 stores remain the rollback-safe source when v2 persistence fails.
      }
    }, 160);
    return () => window.clearTimeout(timer);
  }, [
    desktopPaneMode,
    paneLayoutHydrated,
    pinnedLibraryHydrated,
    pinnedLibraryKeys,
    previewPanePercent,
    sidebarCollapsed,
    sidebarHydrated,
    sidebarView,
    sidebarWidth,
    singleEditorMode,
  ]);
}
