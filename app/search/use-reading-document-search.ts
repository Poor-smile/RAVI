"use client";

import { useEffect, useRef, useState } from "react";
import type { ReadingDocumentMatch } from "./reading-document-index";

const emptyResults: ReadingDocumentMatch[] = [];

export function useReadingDocumentSearch(content: string, query: string, page: number, enabled: boolean) {
  const workerRef = useRef<Worker | null>(null);
  const sequence = useRef(0);
  const sentContent = useRef<string | null>(null);
  const [state, setState] = useState({
    content: "", query: "", page: 0,
    results: emptyResults, total: 0, busy: false, error: false,
  });
  useEffect(() => () => workerRef.current?.terminate(), []);
  useEffect(() => {
    const id = ++sequence.current;
    if (!enabled || !query.trim()) {
      // A short reopen reuses the index; prolonged inactivity releases its heap.
      if (sentContent.current !== content) {
        workerRef.current?.terminate();
        workerRef.current = null;
        sentContent.current = null;
      }
      const timer = setTimeout(() => setState({ content, query, page, results: emptyResults, total: 0, busy: false, error: false }), 0);
      const release = setTimeout(() => {
        workerRef.current?.terminate();
        workerRef.current = null;
        sentContent.current = null;
      }, 30_000);
      return () => { clearTimeout(timer); clearTimeout(release); };
    }
    const timer = setTimeout(() => {
      setState({ content, query, page, results: emptyResults, total: 0, busy: true, error: false });
      try {
        const worker = workerRef.current ?? new Worker(new URL("./reading-document.worker.ts", import.meta.url), { type: "module" });
        workerRef.current = worker;
        worker.onmessage = event => {
          if (event.data.id !== sequence.current) return;
          setState({ content, query, page, results: event.data.results, total: event.data.total, busy: false, error: Boolean(event.data.error) });
        };
        worker.onerror = () => {
          if (id !== sequence.current) return;
          worker.terminate(); workerRef.current = null;
          sentContent.current = null;
          setState({ content, query, page, results: emptyResults, total: 0, busy: false, error: true });
        };
        worker.postMessage({ id, content: sentContent.current === content ? undefined : content, query, page });
        sentContent.current = content;
      } catch {
        setState({ content, query, page, results: emptyResults, total: 0, busy: false, error: true });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [content, query, page, enabled]);
  if (!enabled || !query.trim()) return { results: emptyResults, total: 0, busy: false, error: false };
  if (state.content !== content || state.query !== query || state.page !== page) {
    return { results: emptyResults, total: 0, busy: true, error: false };
  }
  return state;
}
