"use client";

import "./recent-files-panel.css";

import type {
  KeyboardEvent,
  RefObject,
} from "react";
import {
  FileText,
  NotebookPen,
  Search,
  X,
} from "@/app/icons/material-symbols";

export type RecentFilePanelEntry = {
  key: string;
  path: string;
  name: string;
  documentType: "markdown" | "ravi";
  openedAt: string;
  lastModified?: number;
  active?: boolean;
  opening?: boolean;
};

type RecentFileGroup = {
  key: string;
  label: string;
  entries: RecentFilePanelEntry[];
};

const PERSIAN_SEARCH_CHARACTERS: Record<string, string> = {
  "ي": "ی",
  "ى": "ی",
  "ك": "ک",
  "ؤ": "و",
  "إ": "ا",
  "أ": "ا",
  "ة": "ه",
};

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[يىكؤإأة]/g, (character) =>
      PERSIAN_SEARCH_CHARACTERS[character] ?? character,
    )
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("fa-IR");
}

function startOfLocalDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function recentDayLabel(value: Date, todayStart: number) {
  const dayStart = startOfLocalDay(value);
  const difference = Math.round((todayStart - dayStart) / 86_400_000);
  if (difference === 0) return "امروز";
  if (difference === 1) return "دیروز";
  return value.toLocaleDateString("fa-IR", {
    day: "numeric",
    month: "long",
  });
}

function groupRecentFiles(entries: RecentFilePanelEntry[]): RecentFileGroup[] {
  const groups = new Map<string, RecentFileGroup>();
  const todayStart = startOfLocalDay(new Date());

  for (const entry of entries) {
    const openedAt = new Date(entry.openedAt);
    if (Number.isNaN(openedAt.getTime())) continue;
    const key = `${openedAt.getFullYear()}-${openedAt.getMonth()}-${openedAt.getDate()}`;
    const group = groups.get(key) ?? {
      key,
      label: recentDayLabel(openedAt, todayStart),
      entries: [],
    };
    group.entries.push(entry);
    groups.set(key, group);
  }

  return [...groups.values()];
}

function splitFileName(name: string) {
  const extensionMatch = name.match(/(\.[^.]+)$/u);
  if (!extensionMatch || extensionMatch.index === undefined) {
    return { stem: name, extension: "" };
  }
  return {
    stem: name.slice(0, extensionMatch.index),
    extension: extensionMatch[1],
  };
}

function focusRecentRow(
  event: KeyboardEvent<HTMLButtonElement>,
  direction: "next" | "previous" | "first" | "last",
) {
  const panel = event.currentTarget.closest<HTMLElement>("#recent-files-panel");
  const rows = panel
    ? [...panel.querySelectorAll<HTMLButtonElement>("[data-recent-row]")]
    : [];
  const currentIndex = rows.indexOf(event.currentTarget);
  if (currentIndex < 0 || rows.length === 0) return;

  const nextIndex =
    direction === "first"
      ? 0
      : direction === "last"
        ? rows.length - 1
        : direction === "next"
          ? Math.min(currentIndex + 1, rows.length - 1)
          : Math.max(currentIndex - 1, 0);
  if (nextIndex === currentIndex) return;
  event.preventDefault();
  rows[nextIndex]?.focus();
}

export function RecentFilesPanel({
  entries,
  query,
  searchOpen,
  searchInputRef,
  onQueryChange,
  onSearchClose,
  onOpen,
}: {
  entries: RecentFilePanelEntry[];
  query: string;
  searchOpen: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onQueryChange: (query: string) => void;
  onSearchClose: () => void;
  onOpen: (entry: RecentFilePanelEntry) => void;
}) {
  const normalizedQuery = normalizeSearchValue(query);
  const visibleEntries = normalizedQuery
    ? entries.filter((entry) =>
        normalizeSearchValue(`${entry.name} ${entry.path}`).includes(
          normalizedQuery,
        ),
      )
    : entries;
  const groups = groupRecentFiles(visibleEntries);

  return (
    <section
      className="recent-files-panel"
      id="recent-files-panel"
      role="region"
      aria-labelledby="sidebar-pane-title"
    >
      {searchOpen && (
        <div className="recent-files-search" role="search">
          <Search size={18} aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              onSearchClose();
            }}
            placeholder="جست‌وجو در فایل‌های اخیر"
            aria-label="جست‌وجو در فایل‌های اخیر"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            onClick={onSearchClose}
            aria-label="بستن جست‌وجوی فایل‌های اخیر"
            title="بستن جست‌وجو"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="recent-files-scroll" aria-live="polite">
        {groups.length > 0 ? (
          groups.map((group) => (
            <section className="recent-files-group" key={group.key}>
              <h3>{group.label}</h3>
              <div className="recent-files-list">
                {group.entries.map((entry) => {
                  const FileIcon =
                    entry.documentType === "ravi" ? NotebookPen : FileText;
                  const typeLabel =
                    entry.documentType === "ravi" ? "سند قدیمی" : "Markdown";
                  const displayName = splitFileName(entry.name);
                  return (
                    <button
                      className={`recent-files-row ${entry.active ? "is-active" : ""}`}
                      key={entry.key}
                      type="button"
                      data-recent-row
                      data-document-type={entry.documentType}
                      onClick={() => onOpen(entry)}
                      onKeyDown={(event) => {
                        if (event.key === "ArrowDown") {
                          focusRecentRow(event, "next");
                        } else if (event.key === "ArrowUp") {
                          focusRecentRow(event, "previous");
                        } else if (event.key === "Home") {
                          focusRecentRow(event, "first");
                        } else if (event.key === "End") {
                          focusRecentRow(event, "last");
                        }
                      }}
                      aria-current={entry.active ? "page" : undefined}
                      aria-busy={entry.opening || undefined}
                      title={`${entry.name} — ${entry.path}`}
                    >
                      <span
                        className="recent-files-type"
                        aria-label={typeLabel}
                        title={typeLabel}
                      >
                        <FileIcon size={18} aria-hidden="true" />
                      </span>
                      <span className="recent-files-name">
                        <bdi dir="auto">{displayName.stem}</bdi>
                        <bdi className="recent-files-extension" dir="ltr">
                          {displayName.extension}
                        </bdi>
                      </span>
                      <time className="recent-files-time" dateTime={entry.openedAt}>
                        {entry.opening
                          ? "…"
                          : new Date(entry.openedAt).toLocaleTimeString("fa-IR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                      </time>
                    </button>
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="recent-files-empty">
            <FileText size={24} aria-hidden="true" />
            <strong>
              {entries.length === 0
                ? "هنوز فایلی باز نشده است"
                : "فایلی پیدا نشد"}
            </strong>
            <span>
              {entries.length === 0
                ? "فایل‌های بازشده به‌ترتیب زمان اینجا نمایش داده می‌شوند."
                : "عبارت دیگری را برای جست‌وجو امتحان کنید."}
            </span>
          </div>
        )}
      </div>

      <footer className="recent-files-privacy">
        فقط روی این دستگاه · فایل‌ها به اینترنت ارسال نمی‌شوند
      </footer>
    </section>
  );
}
