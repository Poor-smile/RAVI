"use client";

import "./reading-highlights-pane.css";

import { Search, Trash2, X } from "@/app/icons/material-symbols";
import type { RaaviAnnotation } from "@/app/raavi";
import {
  formatReadingAnnotationTime,
  normalizeReadingAnnotationQuery,
  quoteReadingAnnotation,
} from "./reading-annotation-utils";
import {
  useEffect,
  useMemo,
  useRef,
  type KeyboardEvent,
  type RefObject,
} from "react";

export function ReadingHighlightsPane({
  panelId = "reading-highlights-pane",
  highlights,
  activeId,
  searchOpen,
  searchQuery,
  searchInputRef,
  panelRef,
  getLocation,
  onSearchQueryChange,
  onSearchClose,
  onActivate,
  onDelete,
  onDismiss,
}: {
  panelId?: string;
  highlights: readonly RaaviAnnotation[];
  activeId: string;
  searchOpen: boolean;
  searchQuery: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  getLocation: (highlight: RaaviAnnotation) => string;
  onSearchQueryChange: (value: string) => void;
  onSearchClose: () => void;
  onActivate: (highlight: RaaviAnnotation) => void;
  onDelete: (id: string) => void;
  onDismiss: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const normalizedQuery = normalizeReadingAnnotationQuery(searchQuery);
  const visibleHighlights = useMemo(
    () =>
      normalizedQuery
        ? highlights.filter((highlight) => {
            const searchable = `${highlight.quote} ${getLocation(highlight)}`;
            return normalizeReadingAnnotationQuery(searchable).includes(
              normalizedQuery,
            );
          })
        : highlights,
    [getLocation, highlights, normalizedQuery],
  );

  useEffect(() => {
    if (!activeId) return;
    listRef.current
      ?.querySelector<HTMLElement>(`#annotation-card-${CSS.escape(activeId)}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeId, visibleHighlights]);

  const moveRowFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLButtonElement)) return;
    if (!target.classList.contains("reading-highlight-row-main")) return;
    const rows = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        ".reading-highlight-row-main",
      ),
    );
    const currentIndex = rows.indexOf(target);
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
      ref={panelRef}
      id={panelId}
      className="sidebar-annotations-view reading-highlights-pane"
      aria-labelledby="sidebar-pane-title"
      tabIndex={-1}
      onKeyDownCapture={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onDismiss();
      }}
    >
      {searchOpen && (
        <label className="reading-sidebar-filter-control reading-highlights-search-control">
          <Search size={18} aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="جست‌وجو در هایلایت‌ها…"
            aria-label="جست‌وجو در هایلایت‌های سند"
            autoComplete="off"
            spellCheck={false}
            dir="auto"
          />
          <button
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
              searchQuery
                ? "پاک‌کردن جست‌وجوی هایلایت‌ها"
                : "بستن جست‌وجوی هایلایت‌ها"
            }
            title={searchQuery ? "پاک‌کردن جست‌وجو" : "بستن جست‌وجو"}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </label>
      )}

      <p className="reading-highlights-summary">
        هایلایت‌ها · {highlights.length.toLocaleString("fa-IR")} مورد
      </p>

      {highlights.length ? (
        visibleHighlights.length ? (
          <div
            ref={listRef}
            className="reading-highlights-list"
            role="list"
            aria-label="هایلایت‌های همین سند"
            onKeyDown={moveRowFocus}
          >
            {visibleHighlights.map((highlight) => {
              const active = highlight.id === activeId;
              const location = getLocation(highlight);
              return (
                <article
                  id={`annotation-card-${highlight.id}`}
                  className={`reading-highlight-row ${active ? "is-active" : ""}`}
                  role="listitem"
                  key={highlight.id}
                >
                  <button
                    className="reading-highlight-row-main"
                    type="button"
                    onClick={() => onActivate(highlight)}
                    onKeyDown={(event) => {
                      if (event.key !== "Delete" && event.key !== "Backspace") {
                        return;
                      }
                      event.preventDefault();
                      onDelete(highlight.id);
                    }}
                    aria-current={active ? "location" : undefined}
                    aria-label={`رفتن به هایلایت: ${highlight.quote}`}
                    title="رفتن به متن هایلایت‌شده"
                  >
                    <span className="reading-highlight-row-copy">
                      <strong dir="auto">
                        {quoteReadingAnnotation(highlight.quote)}
                      </strong>
                      <span dir="auto">{location}</span>
                    </span>
                    <time
                      dateTime={highlight.createdAt}
                      suppressHydrationWarning
                    >
                      {formatReadingAnnotationTime(highlight.createdAt)}
                    </time>
                  </button>
                  <button
                    className="reading-highlight-row-delete"
                    type="button"
                    onClick={() => onDelete(highlight.id)}
                    aria-label={`حذف هایلایت: ${highlight.quote}`}
                    title="حذف هایلایت"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="reading-highlights-empty" role="status">
            <strong>هایلایت مطابق جست‌وجو پیدا نشد</strong>
            <span>عبارت دیگری را امتحان کنید.</span>
          </div>
        )
      ) : (
        <div className="reading-highlights-empty" role="status">
          <strong>هنوز هایلایتی ندارید</strong>
          <span>متنی را انتخاب کنید و «هایلایت» را بزنید.</span>
        </div>
      )}
    </section>
  );
}
