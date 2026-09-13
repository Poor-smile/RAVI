"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

// Stable event delegates keep memoized renderers current without invalidating
// every Markdown subtree when a parent's event-handler closure changes.
export function useStableAction<T extends (...args: never[]) => unknown>(action: T): T {
  const latest = useRef(action);
  useLayoutEffect(() => { latest.current = action; });
  return useCallback((...args: Parameters<T>) => latest.current(...args), []) as T;
}
