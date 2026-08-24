"use client";

import { AlertTriangle, RefreshCw, Search, X } from "@/app/icons/material-symbols";
import type { ChangeEvent, RefObject } from "react";
import type {
  LocalSearchProgress,
  LocalSearchResult,
  SearchScope,
  SearchSort,
} from "../search/local-index";
import { FileSuggestionRow, type FileSuggestion } from "./file-suggestion-row";

export type SearchPaneState = "idle" | "indexing" | "searching" | "ready" | "error";

function HighlightedSnippet({ result }: { result: LocalSearchResult }) {
  const before = result.snippet.slice(0, result.matchStart);
  const match = result.snippet.slice(result.matchStart, result.matchEnd);
  const after = result.snippet.slice(result.matchEnd);
  return (
    <span className="search-result-snippet" dir="auto">
      {before}
      {match ? <mark>{match}</mark> : null}
      {after}
    </span>
  );
}

export function LibrarySearchPane({
  inputRef,
  query,
  scope,
  sort,
  state,
  progress,
  results,
  filesByKey,
  activeKey,
  pinnedKeys,
  error,
  currentFolderAvailable,
  shortcutLabel,
  onQueryChange,
  onScopeChange,
  onSortChange,
  onClear,
  onOpenResult,
  onTogglePin,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  query: string;
  scope: SearchScope;
  sort: SearchSort;
  state: SearchPaneState;
  progress: LocalSearchProgress;
  results: LocalSearchResult[];
  filesByKey: ReadonlyMap<string, FileSuggestion>;
  activeKey: string;
  pinnedKeys: ReadonlySet<string>;
  error: string;
  currentFolderAvailable: boolean;
  shortcutLabel: string;
  onQueryChange: (value: string) => void;
  onScopeChange: (value: SearchScope) => void;
  onSortChange: (value: SearchSort) => void;
  onClear: () => void;
  onOpenResult: (result: LocalSearchResult) => void;
  onTogglePin: (key: string) => void;
}) {
  const busy = state === "indexing" || state === "searching";
  const hasQuery = Boolean(query.trim());
  return (
    <section className="library-search-pane" aria-labelledby="sidebar-pane-title">
      <div className="library-search-control">
        <Search size={17} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="نام فایل یا عبارت درون متن…"
          dir="auto"
          data-editable-kind="librarySearch"
          aria-label="جست‌وجو در قفسه"
          aria-describedby="library-search-status"
        />
        {query && (
          <button type="button" onClick={onClear} aria-label="پاک‌کردن جست‌وجو">
            <X size={15} aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="library-search-options">
        <label>
          <span>محدوده</span>
          <select
            value={scope}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              onScopeChange(event.target.value as SearchScope)
            }
          >
            <option value="all">نام و متن</option>
            <option value="name">فقط نام فایل</option>
            <option value="content">فقط متن</option>
            <option value="folder" disabled={!currentFolderAvailable}>
              پوشهٔ سند فعال
            </option>
          </select>
        </label>
        <label>
          <span>مرتب‌سازی</span>
          <select
            value={sort}
            onChange={(event: ChangeEvent<HTMLSelectElement>) =>
              onSortChange(event.target.value as SearchSort)
            }
          >
            <option value="relevance">ارتباط</option>
            <option value="name">نام</option>
            <option value="modified">آخرین تغییر</option>
          </select>
        </label>
      </div>

      <div
        id="library-search-status"
        className={`library-search-status is-${state}`}
        role="status"
        aria-live="polite"
      >
        {busy && <RefreshCw className="is-spinning" size={14} aria-hidden="true" />}
        {state === "indexing" ? (
          <span>
            نمایه‌سازی محلی {progress.indexed.toLocaleString("fa-IR")} از{" "}
            {progress.total.toLocaleString("fa-IR")}
          </span>
        ) : state === "searching" ? (
          <span>در حال جست‌وجو…</span>
        ) : state === "error" ? (
          <>
            <AlertTriangle size={14} aria-hidden="true" />
            <span>{error}</span>
          </>
        ) : hasQuery ? (
          <span>{results.length.toLocaleString("fa-IR")} نتیجه</span>
        ) : (
          <span>همه‌چیز روی همین دستگاه می‌ماند · بازکردن سریع {shortcutLabel}</span>
        )}
      </div>

      <div className="library-search-results" aria-busy={busy}>
        {hasQuery && results.length > 0 ? (
          results.map((result) => {
            const file = filesByKey.get(result.key);
            if (!file) return null;
            return (
              <FileSuggestionRow
                key={`${result.key}:${result.offset ?? "file"}`}
                file={file}
                active={activeKey === result.key}
                pinned={pinnedKeys.has(result.key)}
                meta={result.line ? `خط ${result.line.toLocaleString("fa-IR")}` : "نام فایل"}
                onOpen={() => onOpenResult(result)}
                onTogglePin={() => onTogglePin(result.key)}
              >
                <HighlightedSnippet result={result} />
              </FileSuggestionRow>
            );
          })
        ) : hasQuery && !busy ? (
          <div className="library-empty search-empty">
            <Search size={28} aria-hidden="true" />
            <strong>نتیجه‌ای پیدا نشد</strong>
            <span>عبارت یا محدودهٔ جست‌وجو را تغییر دهید.</span>
          </div>
        ) : !hasQuery ? (
          <div className="library-empty search-empty">
            <Search size={28} aria-hidden="true" />
            <strong>در نام و متن فایل‌ها جست‌وجو کنید</strong>
            <span>عبارت ساده بنویسید؛ نیازی به عملگر یا الگوی خاص نیست.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
