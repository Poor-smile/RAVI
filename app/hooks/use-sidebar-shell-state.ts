"use client";

import {
  useEffect,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  clampSidebarWidth,
  parseSidebarPreferences,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_STORAGE_KEY,
  type SidebarView,
} from "../sidebar-state";

export const SIDEBAR_DRAWER_MEDIA_QUERY = "(max-width: 1240px)";

export type SidebarDestination =
  | "library"
  | "search"
  | "history"
  | "versions"
  | "ai"
  | "persian"
  | "outline"
  | "highlights"
  | "comments";

function destinationForView(view: SidebarView): SidebarDestination {
  if (view === "search") return "search";
  if (view === "ai") return "ai";
  if (view === "outline") return "outline";
  if (view === "annotations") return "comments";
  if (view === "history") return "history";
  if (view === "versions") return "versions";
  return "library";
}

export function useSidebarShellState() {
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [sidebarView, setSidebarView] = useState<SidebarView>("files");
  const [sidebarDestination, setSidebarDestination] =
    useState<SidebarDestination>("library");
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [sidebarCollapsedPreference, setSidebarCollapsedPreference] =
    useState(false);
  const [sidebarPreferencesHydrated, setSidebarPreferencesHydrated] =
    useState(false);
  const [sidebarResizing, setSidebarResizing] = useState(false);
  const [libraryIsModal, setLibraryIsModal] = useState(false);

  useEffect(() => {
    let hydrationFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      let preferences = parseSidebarPreferences(null);
      try {
        preferences = parseSidebarPreferences(
          window.localStorage.getItem(SIDEBAR_STORAGE_KEY),
        );
      } catch {
        // Storage can be unavailable in strict privacy modes.
      }
      setSidebarView(preferences.view);
      setSidebarDestination(destinationForView(preferences.view));
      setSidebarWidth(preferences.width);
      setSidebarCollapsedPreference(preferences.collapsed);
      setLibraryOpen(
        !preferences.collapsed &&
          !window.matchMedia(SIDEBAR_DRAWER_MEDIA_QUERY).matches,
      );
      hydrationFrame = window.requestAnimationFrame(() =>
        setSidebarPreferencesHydrated(true),
      );
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(hydrationFrame);
    };
  }, []);

  useEffect(() => {
    if (!sidebarPreferencesHydrated) return;
    if (window.matchMedia(SIDEBAR_DRAWER_MEDIA_QUERY).matches) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          SIDEBAR_STORAGE_KEY,
          JSON.stringify({
            view: sidebarView,
            width: sidebarWidth,
            collapsed: sidebarCollapsedPreference,
          }),
        );
      } catch {
        // Spatial memory is optional; the current session remains fully usable.
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [
    sidebarCollapsedPreference,
    sidebarPreferencesHydrated,
    sidebarView,
    sidebarWidth,
  ]);

  const resizeSidebarFromPointer = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    if (libraryIsModal) return;
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sidebarWidth;
    setSidebarResizing(true);
    event.currentTarget.setPointerCapture(event.pointerId);

    const handleMove = (moveEvent: PointerEvent) => {
      setSidebarWidth(
        clampSidebarWidth(startWidth + startX - moveEvent.clientX),
      );
    };
    const finish = () => {
      setSidebarResizing(false);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const resizeSidebarFromKeyboard = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    let nextWidth = sidebarWidth;
    if (event.key === "ArrowLeft") nextWidth += 16;
    else if (event.key === "ArrowRight") nextWidth -= 16;
    else if (event.key === "Home") nextWidth = SIDEBAR_MIN_WIDTH;
    else if (event.key === "End") nextWidth = SIDEBAR_MAX_WIDTH;
    else return;
    event.preventDefault();
    setSidebarWidth(clampSidebarWidth(nextWidth));
  };

  return [
    [libraryOpen, setLibraryOpen],
    [sidebarView, setSidebarView],
    [sidebarDestination, setSidebarDestination],
    [sidebarWidth, setSidebarWidth],
    [sidebarCollapsedPreference, setSidebarCollapsedPreference],
    sidebarPreferencesHydrated,
    sidebarResizing,
    [libraryIsModal, setLibraryIsModal],
    resizeSidebarFromPointer,
    resizeSidebarFromKeyboard,
  ] as const;
}
