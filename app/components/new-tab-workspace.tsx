"use client";

import {
  BookOpen,
  BrainCircuit,
  ChartNoAxesCombined,
  Clock3,
  FileArchive,
  FilePlus2,
  FileText,
  FolderPlus,
  GitMerge,
  History,
  ListTodo,
  MessageSquareText,
  NotebookPen,
  Table2,
  Workflow,
  type LucideIcon,
} from "@/app/icons/material-symbols";
import {
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  NOTE_TEMPLATES,
  type NoteTemplate,
  type NoteTemplateId,
} from "../workspace/note-templates";

const TEMPLATE_ICONS: Record<NoteTemplateId, LucideIcon> = {
  blank: FilePlus2,
  "quick-note": NotebookPen,
  "daily-journal": Clock3,
  "meeting-notes": MessageSquareText,
  "meeting-minutes": Table2,
  "todo-list": ListTodo,
  "project-plan": Workflow,
  "research-notes": BookOpen,
  brainstorming: BrainCircuit,
  "financial-report": ChartNoAxesCombined,
  "weekly-review": History,
  "decision-log": GitMerge,
};

type NewTabSource = "templates" | "recent";

export type LaunchRecentFile = {
  key: string;
  path: string;
  name: string;
  documentType: "markdown" | "ravi";
  openedAt: string;
  lastModified?: number;
  opening?: boolean;
};

export type LaunchOpenResult = "opened" | "missing" | "failed";

function splitRecentFileName(file: LaunchRecentFile) {
  const extensionMatch = file.name.match(/(\.[^.]+)$/u);
  const fallbackExtension = file.documentType === "ravi" ? ".ravi" : ".md";
  if (!extensionMatch || extensionMatch.index === undefined) {
    return { stem: file.name, extension: fallbackExtension };
  }
  return {
    stem: file.name.slice(0, extensionMatch.index),
    extension: extensionMatch[1],
  };
}

function recentFolderName(path: string) {
  const segments = path.split(/[\\/]/u).filter(Boolean);
  return segments.at(-2) ?? segments.at(0) ?? "دفتر راوی";
}

function recentRelativeTime(openedAt: string) {
  const timestamp = new Date(openedAt).getTime();
  if (!Number.isFinite(timestamp)) return "زمان نامشخص";
  const difference = timestamp - Date.now();
  const absoluteDifference = Math.abs(difference);
  const formatter = new Intl.RelativeTimeFormat("fa-IR", { numeric: "always" });
  if (absoluteDifference < 60 * 60 * 1000) {
    return formatter.format(Math.round(difference / 60_000), "minute");
  }
  if (absoluteDifference < 24 * 60 * 60 * 1000) {
    return formatter.format(Math.round(difference / 3_600_000), "hour");
  }
  if (absoluteDifference < 30 * 24 * 60 * 60 * 1000) {
    return formatter.format(Math.round(difference / 86_400_000), "day");
  }
  return new Date(openedAt).toLocaleDateString("fa-IR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function NewTabWorkspace({
  workspaceName,
  workspacePath,
  busy,
  recentFiles = [],
  returningLaunch = false,
  onChooseWorkspace,
  onCreateCustom,
  onOpenRecent,
  onSelectTemplate,
}: {
  workspaceName?: string;
  workspacePath?: string;
  busy: boolean;
  recentFiles?: readonly LaunchRecentFile[];
  returningLaunch?: boolean;
  onChooseWorkspace: () => void;
  onCreateCustom: () => void;
  onOpenRecent?: (file: LaunchRecentFile) => Promise<LaunchOpenResult>;
  onSelectTemplate: (template: NoteTemplate) => void;
}) {
  const templateRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const recentRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeRecentIndex, setActiveRecentIndex] = useState(0);
  const [activeTemplateIndex, setActiveTemplateIndex] = useState(0);
  const [activeSource, setActiveSource] = useState<NewTabSource>("templates");
  const [openingRecentKey, setOpeningRecentKey] = useState("");
  const [launchError, setLaunchError] = useState("");
  const templates = useMemo(() => NOTE_TEMPLATES, []);
  const hasWorkspace = Boolean(workspaceName);
  const launchFiles = useMemo(() => recentFiles.slice(0, 9), [recentFiles]);
  const previousRecentKeysRef = useRef<string[]>([]);

  useEffect(() => {
    const nextKeys = launchFiles.map((file) => file.key);
    const previousKeys = previousRecentKeysRef.current;
    previousRecentKeysRef.current = nextKeys;
    if (previousKeys.length === 0 || nextKeys.length === 0) return;
    const previousActiveKey = previousKeys[activeRecentIndex];
    const preservedIndex = nextKeys.indexOf(previousActiveKey);
    if (preservedIndex >= 0) {
      if (preservedIndex !== activeRecentIndex) setActiveRecentIndex(preservedIndex);
      return;
    }
    const nextIndex = Math.min(activeRecentIndex, nextKeys.length - 1);
    setActiveRecentIndex(nextIndex);
    window.requestAnimationFrame(() => recentRefs.current[nextIndex]?.focus());
  }, [activeRecentIndex, launchFiles]);

  const moveTemplateFocus = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const columns = matchMedia("(max-width: 760px)").matches ? 1 : 2;
    let next = index;
    if (event.key === "ArrowDown") next = Math.min(templates.length - 1, index + columns);
    else if (event.key === "ArrowUp") next = Math.max(0, index - columns);
    else if (event.key === "ArrowLeft") next = Math.min(templates.length - 1, index + 1);
    else if (event.key === "ArrowRight") next = Math.max(0, index - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = templates.length - 1;
    else return;
    event.preventDefault();
    setActiveTemplateIndex(next);
    templateRefs.current[next]?.focus();
  };

  const moveRecentFocus = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const width = window.innerWidth;
    const columns = returningLaunch
      ? width <= 820
        ? 1
        : width <= 1100
          ? 2
          : 3
      : width <= 760
        ? 1
        : 2;
    let next = index;
    if (event.key === "ArrowDown") {
      next = Math.min(launchFiles.length - 1, index + columns);
    } else if (event.key === "ArrowUp") {
      next = Math.max(0, index - columns);
    } else if (event.key === "ArrowLeft") {
      next = Math.min(launchFiles.length - 1, index + 1);
    } else if (event.key === "ArrowRight") {
      next = Math.max(0, index - 1);
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = launchFiles.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    setActiveRecentIndex(next);
    recentRefs.current[next]?.focus();
  };

  const selectSource = (source: NewTabSource) => {
    if (source === "recent" && launchFiles.length === 0) return;
    setActiveSource(source);
    window.requestAnimationFrame(() => {
      if (source === "recent") recentRefs.current[activeRecentIndex]?.focus();
      else templateRefs.current[activeTemplateIndex]?.focus();
    });
  };

  const openRecent = async (file: LaunchRecentFile) => {
    if (!onOpenRecent || openingRecentKey) return;
    setLaunchError("");
    setOpeningRecentKey(file.key);
    const result = await onOpenRecent(file).catch(() => "failed" as const);
    if (result === "missing") {
      setLaunchError(
        "این فایل در مسیر قبلی پیدا نشد؛ آن را دوباره از پوشه باز کنید.",
      );
    } else if (result === "failed") {
      setLaunchError(
        "باز کردن فایل انجام نشد؛ دسترسی فایل را بررسی و دوباره تلاش کنید.",
      );
    }
    setOpeningRecentKey("");
  };

  if (!hasWorkspace) {
    return (
      <section className="workspace-office-setup" aria-labelledby="workspace-office-title">
        <span className="workspace-office-setup__icon" aria-hidden="true">
          <FolderPlus size={28} />
        </span>
        <h1 id="workspace-office-title">یک پوشه را به‌عنوان مخزن انتخاب کنید</h1>
        <p>
          فایل‌های Markdown و قالب‌های فارسی در همان پوشه ذخیره می‌شوند؛
          محتوا روی دستگاه شما می‌ماند.
        </p>
        <button type="button" onClick={onChooseWorkspace} disabled={busy} autoFocus>
          <FolderPlus size={17} aria-hidden="true" />
          {busy ? "در حال اتصال…" : "انتخاب پوشه"}
        </button>
        <small>Tab برای جابه‌جایی · Enter برای تأیید</small>
      </section>
    );
  }

  if (returningLaunch && launchFiles.length > 0 && onOpenRecent) {
    return (
      <section
        className="new-tab-workspace launch-returning"
        aria-labelledby="launch-returning-title"
      >
        <header className="launch-returning__heading">
          <div className="launch-returning__context">
            <strong>{launchFiles.length.toLocaleString("fa-IR")} فایل اخیر</strong>
            <span>مرتب‌شده بر اساس آخرین ویرایش</span>
          </div>
          <div className="launch-returning__welcome">
            <div className="launch-returning__brand" aria-label="راوی">
              <bdi dir="ltr">RAAVI</bdi>
              <span aria-hidden="true" />
            </div>
            <h1 id="launch-returning-title">خوش آمدید</h1>
            <p>کار را از همان‌جایی ادامه دهید که متوقف کرده بودید.</p>
          </div>
        </header>

        {launchError && (
          <div className="launch-returning__error" role="alert">
            {launchError}
          </div>
        )}

        <ul className="launch-recent-grid" aria-label="فایل‌های اخیر">
          {launchFiles.map((file, index) => {
            const displayName = splitRecentFileName(file);
            const isActive = index === activeRecentIndex;
            const isOpening =
              openingRecentKey === file.key || Boolean(file.opening);
            return (
              <li key={file.key}>
                <button
                  ref={(node) => {
                    recentRefs.current[index] = node;
                  }}
                  type="button"
                  className={`launch-recent-card ${isActive ? "is-active" : ""}`}
                  data-launch-recent-card
                  data-document-type={file.documentType}
                  onFocus={() => setActiveRecentIndex(index)}
                  onPointerEnter={() => setActiveRecentIndex(index)}
                  onKeyDown={(event) => moveRecentFocus(event, index)}
                  onClick={() => void openRecent(file)}
                  tabIndex={isActive ? 0 : -1}
                  aria-busy={isOpening || undefined}
                  disabled={Boolean(openingRecentKey) && !isOpening}
                  autoFocus={index === 0}
                >
                  <span className="launch-recent-preview" aria-hidden="true">
                    <span className="launch-recent-preview__paper">
                      <span className="launch-recent-preview__header">
                        <span className="launch-recent-folder" dir="auto">
                          {recentFolderName(file.path)}
                        </span>
                        <span className="launch-recent-accent" />
                      </span>
                      <strong dir="auto">{displayName.stem}</strong>
                      <span dir="auto">
                        {file.documentType === "ravi"
                          ? "سند قدیمی آمادهٔ تبدیل به Markdown است."
                          : "برای ادامهٔ نوشتن یا مطالعه، سند را باز کنید."}
                      </span>
                    </span>
                  </span>
                  <span className="launch-recent-metadata">
                    <span className="launch-recent-actions">
                      <span className="launch-recent-open">
                        {isOpening ? "در حال باز کردن…" : "باز کردن"}
                      </span>
                      <span className="launch-recent-extension" dir="ltr">
                        {displayName.extension}
                      </span>
                    </span>
                    <span className="launch-recent-info">
                      <strong dir="auto">{displayName.stem}</strong>
                      <span className="launch-recent-modified">
                        <span>
                          آخرین ویرایش:{" "}
                          {recentRelativeTime(
                            file.lastModified
                              ? new Date(file.lastModified).toISOString()
                              : file.openedAt,
                          )}
                        </span>
                        <span className="launch-recent-indicator" aria-hidden="true" />
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <section className="new-tab-workspace" aria-labelledby="new-tab-title">
      <header>
        <div>
          <h1 id="new-tab-title">از کجا شروع می‌کنید؟</h1>
          <p>
            {activeSource === "templates"
              ? "یک قالب انتخاب کنید؛ با کلیدهای جهت‌دار حرکت کنید و Enter بزنید."
              : "یکی از فایل‌های اخیر را انتخاب کنید تا کار را از همان‌جا ادامه دهید."}
          </p>
        </div>
        <button type="button" className="new-tab-workspace__office" onClick={onChooseWorkspace}>
          <span>
            <strong dir="auto">{workspaceName}</strong>
            {workspacePath && <small dir="auto">{workspacePath}</small>}
          </span>
          <b>تغییر</b>
        </button>
      </header>
      <div className="new-tab-source-switch" role="tablist" aria-label="روش شروع سند">
        <button
          id="new-tab-templates-tab"
          type="button"
          role="tab"
          aria-selected={activeSource === "templates"}
          aria-controls="new-tab-templates-panel"
          tabIndex={activeSource === "templates" ? 0 : -1}
          onClick={() => selectSource("templates")}
        >
          قالب‌ها
          <span>{templates.length.toLocaleString("fa-IR")}</span>
        </button>
        <button
          id="new-tab-recent-tab"
          type="button"
          role="tab"
          aria-selected={activeSource === "recent"}
          aria-controls="new-tab-recent-panel"
          aria-disabled={launchFiles.length === 0 || undefined}
          disabled={launchFiles.length === 0}
          tabIndex={activeSource === "recent" ? 0 : -1}
          onClick={() => selectSource("recent")}
        >
          اخیر
          <span>{launchFiles.length.toLocaleString("fa-IR")}</span>
        </button>
      </div>

      {activeSource === "templates" ? (
        <div
          id="new-tab-templates-panel"
          className="note-template-grid"
          role="tabpanel"
          aria-labelledby="new-tab-templates-tab"
          aria-label="قالب‌های فارسی"
        >
          {templates.map((template, index) => {
            const TemplateIcon = TEMPLATE_ICONS[template.id];
            return (
              <button
                key={template.id}
                ref={(node) => {
                  templateRefs.current[index] = node;
                }}
                type="button"
                className="note-template-card"
                disabled={busy}
                onClick={() => onSelectTemplate(template)}
                onKeyDown={(event) => moveTemplateFocus(event, index)}
                onFocus={() => setActiveTemplateIndex(index)}
                tabIndex={activeTemplateIndex === index ? 0 : -1}
                autoFocus={index === 0}
                data-note-template-card
                data-template-id={template.id}
              >
                <span>
                  <strong>{template.title}</strong>
                  <small>{template.description}</small>
                </span>
                <span className="note-template-card__icon" aria-hidden="true">
                  <TemplateIcon size={18} />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div
          id="new-tab-recent-panel"
          className="new-tab-recent-panel"
          role="tabpanel"
          aria-labelledby="new-tab-recent-tab"
        >
          {launchError && (
            <div className="new-tab-recent-error" role="alert">
              {launchError}
            </div>
          )}
          <ul className="new-tab-recent-grid" aria-label="فایل‌های اخیر">
            {launchFiles.map((file, index) => {
              const displayName = splitRecentFileName(file);
              const isActive = index === activeRecentIndex;
              const isOpening =
                openingRecentKey === file.key || Boolean(file.opening);
              const RecentIcon =
                file.documentType === "ravi" ? FileArchive : FileText;
              return (
                <li key={file.key}>
                  <button
                    ref={(node) => {
                      recentRefs.current[index] = node;
                    }}
                    type="button"
                    className={`new-tab-recent-card ${isActive ? "is-active" : ""}`}
                    onFocus={() => setActiveRecentIndex(index)}
                    onPointerEnter={() => setActiveRecentIndex(index)}
                    onKeyDown={(event) => moveRecentFocus(event, index)}
                    onClick={() => void openRecent(file)}
                    tabIndex={isActive ? 0 : -1}
                    aria-busy={isOpening || undefined}
                    disabled={Boolean(openingRecentKey) && !isOpening}
                    data-new-tab-recent-card
                  >
                    <span className="new-tab-recent-card__icon" aria-hidden="true">
                      <RecentIcon size={18} />
                    </span>
                    <span className="new-tab-recent-card__copy">
                      <strong dir="auto">{displayName.stem}</strong>
                      <small dir="auto">
                        {recentFolderName(file.path)} · {recentRelativeTime(file.openedAt)}
                      </small>
                    </span>
                    <span className="new-tab-recent-card__meta">
                      <bdi dir="ltr">{displayName.extension}</bdi>
                      <span>{isOpening ? "در حال باز کردن…" : "باز کردن"}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <footer>
        <span><bdi dir="ltr">Ctrl/Cmd+N</bdi> تب جدید</span>
        <i aria-hidden="true">•</i>
        <span><bdi dir="ltr">/</bdi> منوی بلاک‌ها</span>
        <i aria-hidden="true">•</i>
        <span><bdi dir="ltr">Ctrl/Cmd+Enter</bdi> بلاک بعدی</span>
        <i aria-hidden="true">•</i>
        <button type="button" onClick={onCreateCustom}>
          نام و نوع سفارشی
        </button>
      </footer>
    </section>
  );
}
