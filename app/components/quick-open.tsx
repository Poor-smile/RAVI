"use client";

import { Search, X } from "@/app/icons/material-symbols";
import { useEffect, useMemo, useState, type RefObject } from "react";
import {
  rankQuickOpenCandidates,
  type QuickOpenCandidate,
} from "../search/local-index";
import { FileSuggestionRow, type FileSuggestion } from "./file-suggestion-row";

export type QuickOpenFile = FileSuggestion & QuickOpenCandidate;

export function QuickOpen({
  files,
  activeKey,
  inputRef,
  onOpen,
  onClose,
}: {
  files: QuickOpenFile[];
  activeKey: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onOpen: (file: QuickOpenFile) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const ranked = useMemo(
    () => rankQuickOpenCandidates(files, query).slice(0, 60),
    [files, query],
  );

  useEffect(() => {
    document
      .getElementById(`quick-open-${selectedIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const commit = (index: number) => {
    const file = ranked[index];
    if (!file) return;
    onOpen(file);
  };

  return (
    <div className="quick-open-shell">
      <div className="quick-open-header">
        <div>
          <span className="quick-open-kicker">قفسهٔ محلی</span>
          <h2 id="quick-open-title">بازکردن سریع</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="بستن بازکردن سریع">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <label className="quick-open-search">
        <Search size={18} aria-hidden="true" />
        <span className="visually-hidden">نام فایل</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setSelectedIndex((current) => Math.min(ranked.length - 1, current + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setSelectedIndex((current) => Math.max(0, current - 1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              commit(selectedIndex);
            } else if (event.key === "Escape") {
              event.preventDefault();
              onClose();
            }
          }}
          placeholder="نام فایل را بنویسید…"
          dir="auto"
          role="combobox"
          aria-expanded="true"
          aria-controls="quick-open-list"
          aria-activedescendant={ranked[selectedIndex] ? `quick-open-${selectedIndex}` : undefined}
          aria-autocomplete="list"
        />
        <kbd>Esc</kbd>
      </label>
      <div
        id="quick-open-list"
        className="quick-open-list"
        role="listbox"
        aria-label="فایل‌های قفسه"
      >
        {ranked.length ? (
          ranked.map((candidate, index) => {
            const file = candidate;
            return (
              <FileSuggestionRow
                key={file.key}
                file={file}
                active={file.key === activeKey}
                selected={index === selectedIndex}
                optionId={`quick-open-${index}`}
                optionRole
                meta={file.pinned ? "سنجاق" : file.openCount ? "اخیر" : undefined}
                onOpen={() => commit(index)}
              />
            );
          })
        ) : (
          <div className="quick-open-empty">
            <strong>فایلی پیدا نشد</strong>
            <span>نام دیگری را امتحان کنید.</span>
          </div>
        )}
      </div>
      <div className="quick-open-footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> حرکت</span>
        <span><kbd>Enter</kbd> بازکردن در همین سند</span>
      </div>
    </div>
  );
}
