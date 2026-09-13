"use client";

import "./reading-document-outline-pane.css";

import { Search, X } from "@/app/icons/material-symbols";
import {
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { SidebarRow } from "./sidebar";

export type ReadingDocumentOutlineHeading = {
  level: number;
  offset: number;
  text: string;
};

type NumberedOutlineHeading = ReadingDocumentOutlineHeading & {
  normalizedLevel: number;
  number: string;
};

function normalizeOutlineQuery(value: string) {
  return value
    .normalize("NFKC")
    .replace(/ي/gu, "ی")
    .replace(/ك/gu, "ک")
    .trim()
    .toLocaleLowerCase("fa-IR");
}

const outlineNumberFormat = new Intl.NumberFormat("fa-IR", { useGrouping: false });
const outlineTopLevelNumberFormat = new Intl.NumberFormat("fa-IR", { minimumIntegerDigits: 2, useGrouping: false });

function numberOutlineHeadings(
  headings: readonly ReadingDocumentOutlineHeading[],
): NumberedOutlineHeading[] {
  const baseLevel = headings.length
    ? Math.min(...headings.map((heading) => heading.level))
    : 1;
  const counters = [0, 0, 0];

  return headings.map((heading) => {
    const normalizedLevel = Math.min(
      3,
      Math.max(1, heading.level - baseLevel + 1),
    );
    for (
      let levelIndex = 0;
      levelIndex < normalizedLevel - 1;
      levelIndex += 1
    ) {
      if (counters[levelIndex] === 0) counters[levelIndex] = 1;
    }
    counters[normalizedLevel - 1] += 1;
    counters.fill(0, normalizedLevel);
    const number = counters
      .slice(0, normalizedLevel)
      .map((value) =>
        (normalizedLevel === 1 ? outlineTopLevelNumberFormat : outlineNumberFormat).format(value),
      )
      .join("٫");
    return { ...heading, normalizedLevel, number };
  });
}

export function ReadingDocumentOutlinePane({
  headings,
  activeOffset,
  searchOpen,
  searchQuery,
  searchInputRef,
  onSearchQueryChange,
  onSearchClose,
  onActivate,
  onDismiss,
  panelId = "reading-document-outline-pane",
}: {
  headings: readonly ReadingDocumentOutlineHeading[];
  activeOffset: number | null;
  searchOpen: boolean;
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onSearchQueryChange: (value: string) => void;
  onSearchClose: () => void;
  onActivate: (heading: ReadingDocumentOutlineHeading) => void;
  onDismiss?: () => void;
  panelId?: string;
}) {
  const listRef = useRef<HTMLElement>(null);
  const numberedHeadings = useMemo(
    () => numberOutlineHeadings(headings),
    [headings],
  );
  const normalizedQuery = normalizeOutlineQuery(searchQuery);
  const visibleHeadings = useMemo(
    () =>
      normalizedQuery
        ? numberedHeadings.filter((heading) =>
            normalizeOutlineQuery(heading.text).includes(normalizedQuery),
          )
        : numberedHeadings,
    [normalizedQuery, numberedHeadings],
  );

  const activeIndex = activeOffset === null ? -1 : visibleHeadings.findIndex(
    (heading) => heading.offset === activeOffset,
  );
  useEffect(() => {
    if (activeIndex < 0) return;
    const activeRow =
      listRef.current?.querySelectorAll<HTMLButtonElement>(".sidebar-row")[
        activeIndex
      ];
    activeRow?.scrollIntoView({ block: "nearest" });
    // Typing before a heading shifts its source offset, but does not move the
    // active row. Only navigation or a changed list needs to reveal it again.
  }, [activeIndex, normalizedQuery, visibleHeadings.length]);

  const moveRowFocus = (event: KeyboardEvent<HTMLElement>) => {
    if (!(event.target instanceof HTMLButtonElement)) return;
    const rows = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(".sidebar-row"),
    );
    const currentIndex = rows.indexOf(event.target);
    if (currentIndex < 0 || !rows.length) return;

    let nextIndex = currentIndex;
    if (event.key === "ArrowDown") nextIndex = (currentIndex + 1) % rows.length;
    else if (event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + rows.length) % rows.length;
    } else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = rows.length - 1;
    else return;

    event.preventDefault();
    rows[nextIndex]?.focus({ preventScroll: true });
    rows[nextIndex]?.scrollIntoView({ block: "nearest" });
  };

  return (
    <section
      id={panelId}
      className="sidebar-outline-view document-outline-pane reading-document-outline-pane"
      aria-labelledby="sidebar-pane-title"
      tabIndex={-1}
      onKeyDownCapture={(event) => {
        if (event.key !== "Escape" || !onDismiss) return;
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
      }}
    >
      {searchOpen && (
        <label className="reading-sidebar-filter-control reading-outline-search-control">
          <Search size={18} aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="جست‌وجو در تیترهای سند…"
            aria-label="جست‌وجو در فهرست سند"
            autoComplete="off"
            spellCheck={false}
            dir="auto"
          />
          <button
            className="reading-outline-search-close"
            type="button"
            onClick={() => {
              if (!searchQuery) {
                onSearchClose();
                return;
              }
              onSearchQueryChange("");
              searchInputRef.current?.focus({ preventScroll: true });
            }}
            aria-label={
              searchQuery ? "پاک‌کردن جست‌وجوی فهرست" : "بستن جست‌وجوی فهرست"
            }
            title={searchQuery ? "پاک‌کردن جست‌وجو" : "بستن جست‌وجو"}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </label>
      )}

      <p className="reading-document-outline-summary">
        ساختار سند · {headings.length.toLocaleString("fa-IR")} بخش
      </p>

      {headings.length ? (
        visibleHeadings.length ? (
          <nav
            ref={listRef}
            id="reading-document-outline-list"
            className="sidebar-outline-list reading-document-outline-list"
            aria-label="تیترهای همین سند"
            onKeyDown={moveRowFocus}
          >
            {visibleHeadings.map((heading, index) => (
              <SidebarRow
                key={`${index}-${heading.text}`}
                label={heading.text}
                meta={heading.number}
                active={heading.offset === activeOffset}
                level={heading.normalizedLevel - 1}
                onClick={() => onActivate(heading)}
              />
            ))}
          </nav>
        ) : (
          <div className="reading-document-outline-empty" role="status">
            <strong>تیتر مطابق جست‌وجو پیدا نشد</strong>
            <span>عبارت دیگری را امتحان کنید.</span>
          </div>
        )
      ) : (
        <div className="reading-document-outline-empty" role="status">
          <strong>این سند هنوز تیتر ندارد</strong>
          <span>با افزودن تیتر، ساختار سند اینجا شکل می‌گیرد.</span>
        </div>
      )}
    </section>
  );
}

export const DocumentOutlinePane = ReadingDocumentOutlinePane;
