"use client";

import {
  BookOpen,
  ChevronDown,
  Code2,
  FileText,
  PencilLine,
  ViewColumn,
} from "@/app/icons/material-symbols";
import {
  lazy,
  Suspense,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from "react";
import {
  commandAriaKeyShortcuts,
  commandTitle,
} from "./command-tooltip";
import { EDITOR_MODES, type EditorMode } from "../editor/mode";
import type {
  CommandEnvironment,
  CommandId,
} from "../keyboard/command-registry";

const COMMAND_BAR_EDITOR_MODE_ORDER: EditorMode[] = [
  "source",
  "proof",
  "live",
];

const DocumentMenuPopover = lazy(() =>
  import("./document-menu-popover").then((module) => ({
    default: module.DocumentMenuPopover,
  })),
);

type SaveState = "saved" | "dirty" | "saving" | "error";

export function DocumentCommandBar({
  activeEditorMode,
  commandEnvironment,
  documentMenuButtonRef,
  documentMenuOpen,
  documentMenuRef,
  effectiveSaveState,
  executeCommand,
  fileName,
  inert,
  isInitialWorkspace,
  liveEditEnabled,
  onSave,
  readingMode,
  saveErrorBannerVisible,
  saveIndicatorRef,
  saveState,
  setDocumentMenuOpen,
  wordCount,
}: {
  activeEditorMode: EditorMode;
  commandEnvironment: CommandEnvironment;
  documentMenuButtonRef: RefObject<HTMLButtonElement | null>;
  documentMenuOpen: boolean;
  documentMenuRef: RefObject<HTMLDivElement | null>;
  effectiveSaveState: SaveState;
  executeCommand: (id: CommandId) => void;
  fileName: string;
  inert: boolean;
  isInitialWorkspace: boolean;
  liveEditEnabled: boolean;
  onSave: () => void;
  readingMode: boolean;
  saveErrorBannerVisible: boolean;
  saveIndicatorRef: RefObject<HTMLButtonElement | null>;
  saveState: SaveState;
  setDocumentMenuOpen: Dispatch<SetStateAction<boolean>>;
  wordCount: number;
}) {
  return (
    <div
      className="proofbar"
      aria-hidden={isInitialWorkspace || undefined}
      aria-label="وضعیت سند"
      inert={inert ? true : undefined}
    >
      <div className="document-menu-shell" ref={documentMenuRef}>
        <button
          ref={documentMenuButtonRef}
          className="document-identity"
          type="button"
          title={fileName}
          aria-label={`بازکردن منوی سند «${fileName}»`}
          aria-haspopup="menu"
          aria-expanded={documentMenuOpen}
          aria-controls="document-menu-popover"
          onClick={() => {
            setDocumentMenuOpen((open) => !open);
            requestAnimationFrame(() => {
              documentMenuRef.current
                ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
                ?.focus();
            });
          }}
        >
          <FileText size={16} aria-hidden="true" />
          <span>{fileName}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </button>
        {documentMenuOpen && (
          <Suspense fallback={null}>
            <DocumentMenuPopover
              buttonRef={documentMenuButtonRef}
              executeCommand={executeCommand}
              onClose={() => setDocumentMenuOpen(false)}
              saveState={saveState}
            />
          </Suspense>
        )}
      </div>

      <div className="editor-mode-switcher" role="group" aria-label="حالت ویرایش">
        <button
          type="button"
          data-command-id="view.reading"
          aria-pressed={readingMode}
          aria-label="خواندن"
          title="خواندن"
          onClick={() => executeCommand("view.reading")}
        >
          <BookOpen size={18} aria-hidden="true" />
          <span>خواندن</span>
        </button>
        {COMMAND_BAR_EDITOR_MODE_ORDER.map((modeId) => {
          const mode = EDITOR_MODES.find((candidate) => candidate.id === modeId)!;
          const commandId = `view.editor.${mode.id}` as CommandId;
          const disabled = mode.id === "live" && !liveEditEnabled;
          return (
            <button
              key={mode.id}
              type="button"
              data-command-id={commandId}
              aria-pressed={activeEditorMode === mode.id}
              aria-label={mode.title}
              disabled={disabled}
              title={
                disabled
                  ? "ویرایش روان در این نسخه غیرفعال است"
                  : mode.description
              }
              onClick={() => executeCommand(commandId)}
            >
              {mode.id === "live" ? (
                <PencilLine size={18} aria-hidden="true" />
              ) : mode.id === "source" ? (
                <Code2 size={18} aria-hidden="true" />
              ) : (
                <ViewColumn size={18} aria-hidden="true" />
              )}
              <span>{mode.title}</span>
            </button>
          );
        })}
      </div>

      <button
        ref={saveIndicatorRef}
        className={`save-indicator is-${effectiveSaveState}`}
        type="button"
        onClick={onSave}
        disabled={effectiveSaveState === "saving"}
        aria-live="polite"
        aria-describedby={
          saveErrorBannerVisible
            ? "save-error-title save-error-description"
            : undefined
        }
        aria-keyshortcuts={commandAriaKeyShortcuts(
          "file.save",
          commandEnvironment,
        )}
        title={commandTitle(
          "file.save",
          commandEnvironment,
          "برای ذخیره‌ی نسخه‌ی جدید کلیک کنید",
        )}
      >
        <span className={`status-dot is-${effectiveSaveState}`} />
        {effectiveSaveState === "saving"
          ? "در حال ذخیره…"
          : effectiveSaveState === "error"
            ? "ذخیره ناموفق"
            : effectiveSaveState === "dirty"
              ? "هشدار: ذخیره نشده"
              : "ذخیره شده"}
      </button>

      <div className="document-stats" aria-label="آمار نوشته">
        <span>{wordCount.toLocaleString("fa-IR")} واژه</span>
      </div>


    </div>
  );
}
