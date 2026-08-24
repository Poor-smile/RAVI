"use client";

import { Search, X } from "@/app/icons/material-symbols";
import type { KeyboardEvent, RefObject } from "react";

export type ReadingDocumentSearchResult = {
  start: number;
  end: number;
  label: string;
};

export function ReadingDocumentSearchPane({
  inputRef,
  query,
  results,
  activeIndex,
  onQueryChange,
  onClear,
  onActivate,
  onDismiss,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  results: readonly ReadingDocumentSearchResult[];
  activeIndex: number;
  onQueryChange: (value: string) => void;
  onClear: () => void;
  onActivate: (index: number) => void;
  onDismiss: () => void;
}) {
  const hasQuery = Boolean(query.trim());
  const resultCount = results.length;

  const activateRelative = (direction: 1 | -1) => {
    if (!resultCount) return;
    const current = activeIndex >= 0 ? activeIndex : direction > 0 ? -1 : 0;
    const next = (current + direction + resultCount) % resultCount;
    onActivate(next);
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      activateRelative(event.shiftKey ? -1 : 1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      activateRelative(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      activateRelative(-1);
    }
  };

  return (
    <section
      className="reading-document-search-pane"
      role="search"
      aria-label="جست‌وجو در متن سند"
      onKeyDownCapture={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
      }}
    >
      <label className="reading-document-search-control">
        <Search size={18} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="جست‌وجو در متن سند…"
          dir="auto"
          autoComplete="off"
          spellCheck={false}
          aria-label="جست‌وجو در متن سند"
          aria-controls="reading-document-search-results"
          aria-describedby="reading-document-search-summary"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              onClear();
              inputRef.current?.focus({ preventScroll: true });
            }}
            aria-label="پاک‌کردن جست‌وجوی متن"
            title="پاک‌کردن جست‌وجو"
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </label>

      <p
        id="reading-document-search-summary"
        className={`reading-document-search-summary ${hasQuery ? "has-query" : "is-idle"}`}
        role="status"
        aria-live="polite"
      >
        {hasQuery
          ? `${resultCount.toLocaleString("fa-IR")} نتیجه در همین سند`
          : "عبارت موردنظر را در همین سند پیدا کنید"}
      </p>

      <ol
        id="reading-document-search-results"
        className="reading-document-search-results"
        aria-label="نتیجه‌های جست‌وجو در سند"
      >
        {results.map((result, index) => (
          <li key={`${result.start}:${result.end}`}>
            <button
              type="button"
              className={index === activeIndex ? "is-active" : undefined}
              aria-current={index === activeIndex ? "location" : undefined}
              onClick={() => onActivate(index)}
              title={result.label}
            >
              <span className="reading-document-search-result-label" dir="auto">
                {result.label}
              </span>
              <span className="reading-document-search-result-index" dir="ltr">
                {(index + 1).toLocaleString("fa-IR")}/
                {resultCount.toLocaleString("fa-IR")}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
