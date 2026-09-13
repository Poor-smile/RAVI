"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { flushSync } from "react-dom";

const MATERIALIZE = "raavi:materialize-reading";

// Once visited, a chunk stays mounted so selections, comments and media keep
// their DOM identity. Unvisited predecessors need not parse before a jump.
export function DeferredMarkdownChunk({ children, start, index, length, force }: {
  children: ReactNode; start: number; index: number; length: number; force: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [visited, setVisited] = useState(force);
  if (force && !visited) setVisited(true);
  const visible = force || visited;
  useEffect(() => {
    if (visible || !ref.current) return;
    const section = ref.current;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) setVisited(true);
    }, { rootMargin: "900px 0px" });
    observer.observe(section);
    const materialize = (event: Event) => {
      const range = (event as CustomEvent<Range | null>).detail;
      if (!range || range.intersectsNode(section)) setVisited(true);
    };
    window.addEventListener(MATERIALIZE, materialize);
    return () => { observer.disconnect(); window.removeEventListener(MATERIALIZE, materialize); };
  }, [visible]);
  return <section ref={ref} className="markdown-render-chunk" data-markdown-chunk={index}
    data-source-start={start} data-chunk-pending={visible ? undefined : "true"}
    style={visible ? undefined : { minHeight: Math.max(320, Math.min(50_000, length * 0.38)) }}>
    {visible ? children : <div aria-label="بخش سند در حال آماده‌سازی" />}
  </section>;
}

export function useReadingMaterialization(article: RefObject<HTMLElement | null>, onSelectAll: () => void) {
  useEffect(() => {
    const selectedRange = () => {
      const selection = window.getSelection();
      if (!selection?.rangeCount || selection.isCollapsed) return null;
      const range = selection.getRangeAt(0);
      return article.current?.contains(range.commonAncestorContainer) ? range : null;
    };
    const selectionChanged = () => {
      const range = selectedRange();
      if (range) window.dispatchEvent(new CustomEvent(MATERIALIZE, { detail: range }));
    };
    const copy = () => {
      const range = selectedRange();
      if (range) flushSync(() => window.dispatchEvent(new CustomEvent(MATERIALIZE, { detail: range })));
    };
    const selectAll = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "a") return;
      const target = event.target;
      if (!(target instanceof Node) || (!article.current?.contains(target) && !article.current?.contains(window.getSelection()?.anchorNode ?? null))) return;
      flushSync(() => { onSelectAll(); window.dispatchEvent(new CustomEvent(MATERIALIZE, { detail: null })); });
    };
    document.addEventListener("selectionchange", selectionChanged);
    document.addEventListener("copy", copy, true);
    document.addEventListener("keydown", selectAll, true);
    return () => {
      document.removeEventListener("selectionchange", selectionChanged);
      document.removeEventListener("copy", copy, true);
      document.removeEventListener("keydown", selectAll, true);
    };
  }, [article, onSelectAll]);
}
