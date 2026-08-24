"use client";

import "./versions-panel.css";

import { useEffect, useRef } from "react";
import {
  AlertTriangle,
  Check,
  FileArchive,
  History,
  LoaderCircle,
  Save,
  Sparkles,
} from "@/app/icons/material-symbols";

export type VersionPanelEntry = {
  key: string;
  number: number;
  savedAt: string;
  kind: "autosave" | "manual" | "ai";
};

type VersionGroup = {
  key: string;
  label: string;
  entries: VersionPanelEntry[];
};

function startOfLocalDay(value: Date) {
  return new Date(
    value.getFullYear(),
    value.getMonth(),
    value.getDate(),
  ).getTime();
}

function dayDifference(value: Date, today = new Date()) {
  return Math.round(
    (startOfLocalDay(today) - startOfLocalDay(value)) / 86_400_000,
  );
}

function versionDayLabel(value: Date) {
  const difference = dayDifference(value);
  if (difference === 0) return "امروز";
  if (difference === 1) return "دیروز";
  return value.toLocaleDateString("fa-IR", { day: "numeric", month: "long" });
}

function versionTitle(value: Date) {
  const difference = dayDifference(value);
  const time = value.toLocaleTimeString("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  if (difference === 0) return `امروز، ${time}`;
  if (difference === 1) return `دیروز، ${time}`;
  return `${value.toLocaleDateString("fa-IR", {
    day: "numeric",
    month: "long",
  })}، ${time}`;
}

function elapsedLabel(value: Date, now = new Date()) {
  const elapsedMinutes = Math.max(
    0,
    Math.floor((now.getTime() - value.getTime()) / 60_000),
  );
  if (elapsedMinutes < 1) return "همین حالا";
  if (elapsedMinutes < 60) {
    return `${elapsedMinutes.toLocaleString("fa-IR")} دقیقه پیش`;
  }
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `${elapsedHours.toLocaleString("fa-IR")} ساعت پیش`;
  }
  return "";
}

function groupVersions(entries: VersionPanelEntry[]): VersionGroup[] {
  const groups = new Map<string, VersionGroup>();
  for (const entry of entries) {
    const savedAt = new Date(entry.savedAt);
    if (Number.isNaN(savedAt.getTime())) continue;
    const key = `${savedAt.getFullYear()}-${savedAt.getMonth()}-${savedAt.getDate()}`;
    const group = groups.get(key) ?? {
      key,
      label: versionDayLabel(savedAt),
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

function EntryIcon({ kind }: { kind: VersionPanelEntry["kind"] }) {
  const Icon = kind === "manual" ? Save : kind === "ai" ? Sparkles : History;
  return <Icon size={18} aria-hidden="true" />;
}

function entryKindLabel(kind: VersionPanelEntry["kind"]) {
  if (kind === "manual") return "ذخیرهٔ دستی";
  if (kind === "ai") return "تغییر راوی هوشمند";
  return "ذخیرهٔ خودکار";
}

export function VersionsPanel({
  fileName,
  versionCount,
  currentDirty,
  entries,
  loading,
  error,
  restoreCandidate,
  restorePending,
  onRequestRestore,
  onCancelRestore,
  onConfirmRestore,
  onRetry,
}: {
  fileName: string;
  versionCount: number;
  currentDirty: boolean;
  entries: VersionPanelEntry[];
  loading?: boolean;
  error?: string;
  restoreCandidate?: VersionPanelEntry | null;
  restorePending?: boolean;
  onRequestRestore: (entry: VersionPanelEntry) => void;
  onCancelRestore: () => void;
  onConfirmRestore: (entry: VersionPanelEntry) => void;
  onRetry: () => void;
}) {
  const groups = groupVersions(entries);
  const displayName = splitFileName(fileName);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const restoreOriginKeyRef = useRef<string | null>(null);
  const confirmWasOpenRef = useRef(false);

  useEffect(() => {
    if (restoreCandidate) {
      confirmWasOpenRef.current = true;
      confirmButtonRef.current?.focus({ preventScroll: true });
      return;
    }
    if (!confirmWasOpenRef.current || !restoreOriginKeyRef.current) return;
    confirmWasOpenRef.current = false;
    const originKey = restoreOriginKeyRef.current;
    const frame = window.requestAnimationFrame(() => {
      const origin = [
        ...(panelRef.current?.querySelectorAll<HTMLButtonElement>(
          ".versions-restore",
        ) ?? []),
      ].find((button) => button.dataset.versionKey === originKey);
      origin?.focus({ preventScroll: true });
      restoreOriginKeyRef.current = null;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [restoreCandidate]);

  const renderState = () => {
    if (restoreCandidate) {
      const savedAt = new Date(restoreCandidate.savedAt);
      const kindLabel = entryKindLabel(restoreCandidate.kind);
      return (
        <div
          className="versions-state is-restore-confirm"
          onKeyDown={(event) => {
            if (event.key !== "Escape" || restorePending) return;
            event.preventDefault();
            onCancelRestore();
          }}
        >
          <div
            className="versions-confirm-card"
            role="alertdialog"
            aria-labelledby="versions-restore-title"
            aria-describedby="versions-restore-description"
            aria-busy={restorePending || undefined}
          >
            <div className="versions-confirm-copy">
              <strong id="versions-restore-title">
                این نسخه بازگردانی شود؟
              </strong>
              <p id="versions-restore-description">
                وضعیت فعلی ابتدا به‌صورت نسخهٔ جدید ذخیره می‌شود؛ سپس نسخهٔ
                {` ${versionTitle(savedAt)} `}
                باز می‌گردد.
              </p>
            </div>
            <div className="versions-row is-selected">
              <span className="versions-kind-icon" aria-label={kindLabel}>
                <EntryIcon kind={restoreCandidate.kind} />
              </span>
              <span className="versions-row-copy">
                <strong>{versionTitle(savedAt)}</strong>
                <small>{kindLabel}</small>
              </span>
              <span className="versions-confirm-indicator" aria-hidden="true">
                <History size={18} />
              </span>
            </div>
            <div className="versions-confirm-actions">
              <button
                type="button"
                disabled={restorePending}
                onClick={onCancelRestore}
              >
                لغو
              </button>
              <button
                ref={confirmButtonRef}
                className="is-primary"
                type="button"
                disabled={restorePending}
                onClick={() => {
                  restoreOriginKeyRef.current = null;
                  onConfirmRestore(restoreCandidate);
                }}
              >
                {restorePending ? (
                  <LoaderCircle
                    className="is-spinning"
                    size={18}
                    aria-hidden="true"
                  />
                ) : (
                  <History size={18} aria-hidden="true" />
                )}
                {restorePending ? "در حال حفظ…" : "بازگردانی"}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (loading) {
      return (
        <div className="versions-state" role="status" aria-live="polite">
          <span className="versions-state-icon">
            <LoaderCircle
              className="is-spinning"
              size={24}
              aria-hidden="true"
            />
          </span>
          <strong>در حال خواندن نسخه‌های محلی…</strong>
          <p>همه‌چیز فقط از حافظهٔ محلی خوانده می‌شود.</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="versions-state is-error" role="alert">
          <span className="versions-state-icon">
            <AlertTriangle size={24} aria-hidden="true" />
          </span>
          <strong>نسخه‌ها خوانده نشد</strong>
          <p>فایل نسخه‌ها در دسترس نبود؛ دوباره تلاش کنید.</p>
          <button className="versions-retry" type="button" onClick={onRetry}>
            <Save size={18} aria-hidden="true" />
            تلاش دوباره
          </button>
        </div>
      );
    }

    if (versionCount === 0) {
      return (
        <div className="versions-state is-empty">
          <span className="versions-state-icon">
            <FileArchive size={24} aria-hidden="true" />
          </span>
          <strong>هنوز نسخه‌ای برای این سند نیست</strong>
          <p>
            پس از ذخیره یا ویرایش سند، نسخه‌های قابل‌بازگشت اینجا دیده می‌شوند.
          </p>
        </div>
      );
    }

    return (
      <>
        <div className="versions-current-document">
          <span className="versions-count">
            {versionCount.toLocaleString("fa-IR")} نسخه
          </span>
          <strong className="versions-file-name" title={fileName}>
            <bdi dir="auto">{displayName.stem}</bdi>
            <bdi className="versions-file-extension" dir="ltr">
              {displayName.extension}
            </bdi>
          </strong>
        </div>

        <div className="versions-scroll">
          <section className="versions-group is-current">
            <h3>امروز</h3>
            <div className="versions-row is-current" aria-current="true">
              <History size={18} aria-hidden="true" />
              <span className="versions-row-copy">
                <strong>نسخهٔ فعلی</strong>
                <small>
                  {currentDirty
                    ? "دارای تغییرات ذخیره‌نشده"
                    : "آخرین وضعیت ذخیره‌شده"}
                </small>
              </span>
              <span
                className="versions-current-indicator"
                aria-label="نسخهٔ فعلی"
              >
                <Check size={18} aria-hidden="true" />
              </span>
            </div>
          </section>

          {groups.map((group) => (
            <section
              className={`versions-group ${
                group.label === "امروز" ? "is-today-continuation" : ""
              }`}
              key={group.key}
            >
              {group.label !== "امروز" && <h3>{group.label}</h3>}
              <ol className="versions-list">
                {group.entries.map((entry) => {
                  const savedAt = new Date(entry.savedAt);
                  const kindLabel = entryKindLabel(entry.kind);
                  const elapsed = elapsedLabel(savedAt);
                  return (
                    <li className="versions-row" key={entry.key}>
                      <span
                        className="versions-kind-icon"
                        aria-label={kindLabel}
                        title={kindLabel}
                      >
                        <EntryIcon kind={entry.kind} />
                      </span>
                      <span className="versions-row-copy">
                        <strong>{versionTitle(savedAt)}</strong>
                        <small>
                          {kindLabel}
                          {elapsed ? ` · ${elapsed}` : ""}
                        </small>
                      </span>
                      <button
                        className="versions-restore"
                        type="button"
                        data-version-key={entry.key}
                        onClick={() => {
                          restoreOriginKeyRef.current = entry.key;
                          onRequestRestore(entry);
                        }}
                        aria-label={`بازیابی ${versionTitle(savedAt)}`}
                        title="بازیابی این نسخه"
                      >
                        <History size={18} aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ol>
            </section>
          ))}
        </div>
      </>
    );
  };

  return (
    <section
      ref={panelRef}
      className="versions-panel"
      id="library-versions-panel"
      role="region"
      aria-labelledby="sidebar-pane-title"
    >
      {renderState()}
      <footer className="versions-privacy">
        فقط روی این دستگاه · نسخه‌ها به اینترنت ارسال نمی‌شوند
      </footer>
    </section>
  );
}
