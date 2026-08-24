"use client";

import { RefreshCw } from "@/app/icons/material-symbols";
import { lazy, useRef, type RefObject } from "react";
import { AccessibleModal } from "./accessible-modal";

export const MermaidStudio = lazy(() =>
  import("./mermaid-studio").then((module) => ({ default: module.MermaidStudio })),
);
export const FormulaStudio = lazy(() =>
  import("./formula-studio").then((module) => ({ default: module.FormulaStudio })),
);
export const MermaidDiagram = lazy(() =>
  import("./mermaid-diagram").then((module) => ({ default: module.MermaidDiagram })),
);
export const MarkdownCodeEditor = lazy(() =>
  import("./markdown-code-editor").then((module) => ({ default: module.MarkdownCodeEditor })),
);
export const NewDocumentDialog = lazy(() =>
  import("./new-document-dialog").then((module) => ({ default: module.NewDocumentDialog })),
);
export const AboutDialog = lazy(() =>
  import("./about-dialog").then((module) => ({ default: module.AboutDialog })),
);
export const SupportDialog = lazy(() =>
  import("./support-dialog").then((module) => ({ default: module.SupportDialog })),
);
export const ShortcutHelpDialog = lazy(() =>
  import("./shortcut-help-dialog").then((module) => ({ default: module.ShortcutHelpDialog })),
);
export const ShortcutSettingsDialog = lazy(() =>
  import("./shortcut-settings-dialog").then((module) => ({ default: module.ShortcutSettingsDialog })),
);
export const FormulaDocumentBlock = lazy(() =>
  import("./formula-document-block").then((module) => ({ default: module.FormulaDocumentBlock })),
);
export const FileExplorer = lazy(() =>
  import("./file-explorer").then((module) => ({ default: module.FileExplorer })),
);
export const FileOperationDialog = lazy(() =>
  import("./file-operation-dialog").then((module) => ({ default: module.FileOperationDialog })),
);
export const RecentFilesPanel = lazy(() =>
  import("./recent-files-panel").then((module) => ({ default: module.RecentFilesPanel })),
);
export const VersionsPanel = lazy(() =>
  import("./versions-panel").then((module) => ({ default: module.VersionsPanel })),
);
export const PersianCorrectionsPanel = lazy(() =>
  import("./persian-corrections-panel").then((module) => ({ default: module.PersianCorrectionsPanel })),
);
export const LibrarySearchPane = lazy(() =>
  import("./library-search-pane").then((module) => ({ default: module.LibrarySearchPane })),
);
export const ReadingDocumentSearchPane = lazy(() =>
  import("./reading-document-search-pane").then((module) => ({ default: module.ReadingDocumentSearchPane })),
);
export const DocumentOutlinePane = lazy(() =>
  import("./reading-document-outline-pane").then((module) => ({ default: module.DocumentOutlinePane })),
);
export const ReadingDocumentOutlinePane = lazy(() =>
  import("./reading-document-outline-pane").then((module) => ({ default: module.ReadingDocumentOutlinePane })),
);
export const ReadingHighlightsPane = lazy(() =>
  import("./reading-highlights-pane").then((module) => ({ default: module.ReadingHighlightsPane })),
);
export const ReadingCommentsPane = lazy(() =>
  import("./reading-comments-pane").then((module) => ({ default: module.ReadingCommentsPane })),
);
export const QuickOpen = lazy(() =>
  import("./quick-open").then((module) => ({ default: module.QuickOpen })),
);
export const CommandPalette = lazy(() =>
  import("./command-palette").then((module) => ({ default: module.CommandPalette })),
);
export const ExportDialog = lazy(() =>
  import("./export-dialog").then((module) => ({ default: module.ExportDialog })),
);
export const ExternalLinkDialog = lazy(() =>
  import("./document-dialogs").then((module) => ({ default: module.ExternalLinkDialog })),
);
export const CloseDocumentDialog = lazy(() =>
  import("./document-dialogs").then((module) => ({ default: module.CloseDocumentDialog })),
);
export const ImageInsertDialog = lazy(() =>
  import("./document-dialogs").then((module) => ({ default: module.ImageInsertDialog })),
);
export const SaveFileDialog = lazy(() =>
  import("./document-dialogs").then((module) => ({ default: module.SaveFileDialog })),
);

export function DeferredDialogFallback({
  id,
  title,
  isTopLayer,
  onClose,
  returnFocusRef,
}: {
  id: string;
  title: string;
  isTopLayer: boolean;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = `deferred-dialog-${id}-title`;
  const descriptionId = `deferred-dialog-${id}-description`;

  return (
    <AccessibleModal
      open
      isTopLayer={isTopLayer}
      onClose={onClose}
      dialogRef={dialogRef}
      returnFocusRef={returnFocusRef}
      backdropClassName="save-modal-backdrop deferred-dialog-backdrop"
      dialogClassName="deferred-dialog-loading"
      labelledBy={titleId}
      describedBy={descriptionId}
    >
      <RefreshCw size={22} aria-hidden="true" />
      <div role="status" aria-live="polite">
        <strong id={titleId}>{title}</strong>
        <span id={descriptionId}>این بخش فقط هنگام نیاز بارگذاری می‌شود.</span>
      </div>
    </AccessibleModal>
  );
}

export function DeferredPanelFallback() {
  return (
    <div className="library-empty deferred-panel-loading" role="status" aria-live="polite">
      <RefreshCw className="is-spinning" size={22} aria-hidden="true" />
      <strong>در حال آماده‌سازی پنل…</strong>
      <span>اطلاعات روی همین دستگاه بارگذاری می‌شود.</span>
    </div>
  );
}
