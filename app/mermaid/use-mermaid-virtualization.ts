"use client";

import { RefObject, useEffect, useRef, useState } from "react";
import type { MermaidRenderPriority } from "./scheduler";

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export function useMermaidVirtualization(
  figureRef: RefObject<HTMLElement | null>,
  readingMode: boolean,
  pinned = false,
) {
  const [mounted, setMounted] = useState(false);
  const [priority, setPriority] =
    useState<MermaidRenderPriority>("prefetch");
  const leaveTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const figure = figureRef.current;
    if (pinned) {
      if (leaveTimerRef.current !== null) {
        window.clearTimeout(leaveTimerRef.current);
        leaveTimerRef.current = null;
      }
      const pinTimer = window.setTimeout(() => {
        setMounted(true);
        setPriority("interactive");
      }, 0);
      return () => window.clearTimeout(pinTimer);
    }
    if (!figure || typeof IntersectionObserver === "undefined") {
      const fallbackTimer = window.setTimeout(() => {
        setMounted(true);
        setPriority("visible");
      }, 0);
      return () => window.clearTimeout(fallbackTimer);
    }
    const scrollRoot = readingMode
      ? figure.closest<HTMLElement>(".workspace--reading")
      : figure.closest<HTMLElement>(".preview-scroll");
    let idleHandle: number | null = null;
    const idleWindow = window as IdleWindow;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (leaveTimerRef.current !== null) {
          window.clearTimeout(leaveTimerRef.current);
          leaveTimerRef.current = null;
        }
        if (entry.isIntersecting) {
          const root = entry.rootBounds;
          const rect = entry.boundingClientRect;
          const actuallyVisible = root
            ? rect.bottom >= root.top && rect.top <= root.bottom
            : rect.bottom >= 0 && rect.top <= window.innerHeight;
          setPriority(actuallyVisible ? "visible" : "prefetch");
          if (actuallyVisible) setMounted(true);
          else {
            const mount = () => setMounted(true);
            idleHandle = idleWindow.requestIdleCallback
              ? idleWindow.requestIdleCallback(mount, { timeout: 700 })
              : window.setTimeout(mount, 120);
          }
          return;
        }
        leaveTimerRef.current = window.setTimeout(() => {
          setMounted(false);
          setPriority("prefetch");
        }, 750);
      },
      { root: scrollRoot, rootMargin: "50% 0px" },
    );
    observer.observe(figure);
    return () => {
      observer.disconnect();
      if (leaveTimerRef.current !== null) window.clearTimeout(leaveTimerRef.current);
      if (idleHandle !== null) {
        if (idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(idleHandle);
        else window.clearTimeout(idleHandle);
      }
    };
  }, [figureRef, pinned, readingMode]);

  return { mounted, priority };
}
