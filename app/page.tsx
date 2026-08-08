"use client";

/*
THESIS: راوی یک برگه‌ی زنده‌ی نمونه‌خوانی است؛ نه یک ادیتور تیره و فنی.
OWN-WORLD: کاغذ سرد، مرکب زغالی، آبی نمونه‌خوان و علائم ثبت چاپی.
STORY: فایل را باز کن، در راست ویرایش کن، در چپ نتیجه را ببین و یک برگ تمیز تحویل بگیر.
FIRST VIEWPORT: نوار ابزار فشرده بالا، دو برگ تمام‌قد و یک ستون ثبت باریک در میانه؛ عمل اصلی بالا سمت چپ.
FORM: مسیر هفتم، میز دوبرگی با ساختار bench؛ seed a26e2614.
*/

import {
  Bold,
  BookOpen,
  Braces,
  Check,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Code2,
  Copy,
  Download,
  Ellipsis,
  Eye,
  FileArchive,
  FileDown,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  FolderOpen,
  Heading1,
  Highlighter,
  Heart,
  History,
  ImagePlus,
  Italic,
  Keyboard,
  Library,
  List as ListIcon,
  ListChecks,
  ListOrdered,
  ListTodo,
  Link2,
  ListTree,
  Lock,
  LockOpen,
  Menu,
  MessageCircle,
  MessageSquareText,
  Minus,
  Moon,
  Network,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  Plus,
  Quote,
  RefreshCw,
  Redo2,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sun,
  Table2,
  Trash2,
  Upload,
  Undo2,
  Wand2,
  X,
} from "lucide-react";
import {
  Children,
  DragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  lazy,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  Suspense,
  isValidElement,
  type RefObject,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown, {
  type Components,
  defaultUrlTransform,
} from "react-markdown";
import remarkGfm from "remark-gfm";
import packageMetadata from "../package.json";
import { useBackLayer } from "./components/back-layer-provider";
import {
  AccessibleModal,
  useModalFocus,
  useModalStack,
} from "./components/accessible-modal";
import {
  ExportDialog,
  type ExportDialogStatus,
  type ExportDialogWarning,
  type ExportFormat,
} from "./components/export-dialog";
import { extractWordFrontmatter } from "./export/frontmatter";
import { stagePrintDocument } from "./export/print-document";
import type { NewDocumentSpec } from "./components/new-document-dialog";
import type {
  MermaidApplyResult,
  MermaidStudioSession,
} from "./components/mermaid-studio";
import {
  commandAriaKeyShortcuts,
  commandTitle,
} from "./components/command-tooltip";
import type { MarkdownCodeEditorHandle } from "./components/markdown-code-editor";
import { useCommandSystem } from "./hooks/use-command-system";
import {
  ALL_COMMAND_IDS,
  CommandEnvironment,
  CommandId,
} from "./keyboard/command-registry";
import {
  findMermaidBlocks,
  insertMermaidBlock,
  mermaidBlockAtOffset,
  MermaidBlock,
  replaceMermaidBlock,
} from "./mermaid/blocks";
import { DEFAULT_MERMAID_CODE } from "./mermaid/samples";
import {
  captureReadingViewport,
  createReadingDraftId,
  READING_POSITION_VERSION,
  readingAnchorsMatch,
  readingContentSignature,
  readingDocumentKey,
  restoreReadingViewport,
  sanitizeReadingPositionMap,
  upsertReadingPosition,
  type ReadingPositionMap,
  type ReadingPositionRecord,
  type ReadingScrollContext,
  type ReadingViewMode,
} from "./reading-position";
import {
  AnnotationKind,
  MAX_RAVI_IMAGE_ASSETS,
  MAX_RAVI_IMAGE_BYTES,
  makeRaaviDocument,
  markdownWithEmbeddedRaaviImages,
  parseRaaviDocument,
  RaaviAnnotation,
  RaaviImageAsset,
  RaaviVersion,
  raaviImageAssetId,
  raaviImageDataUrl,
  raaviImageUrl,
} from "./raavi";

const MermaidStudio = lazy(() =>
  import("./components/mermaid-studio").then((module) => ({
    default: module.MermaidStudio,
  })),
);
const MermaidDiagram = lazy(() =>
  import("./components/mermaid-diagram").then((module) => ({
    default: module.MermaidDiagram,
  })),
);
const MarkdownCodeEditor = lazy(() =>
  import("./components/markdown-code-editor").then((module) => ({
    default: module.MarkdownCodeEditor,
  })),
);
const NewDocumentDialog = lazy(() =>
  import("./components/new-document-dialog").then((module) => ({
    default: module.NewDocumentDialog,
  })),
);
const AboutDialog = lazy(() =>
  import("./components/about-dialog").then((module) => ({
    default: module.AboutDialog,
  })),
);
const SupportDialog = lazy(() =>
  import("./components/support-dialog").then((module) => ({
    default: module.SupportDialog,
  })),
);
const ShortcutHelpDialog = lazy(() =>
  import("./components/shortcut-help-dialog").then((module) => ({
    default: module.ShortcutHelpDialog,
  })),
);

function DeferredDialogFallback({
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

const STORAGE_KEY = "raavi:document:v1";
const LOCAL_DOCUMENT_DB_NAME = "raavi-local-documents";
const LOCAL_DOCUMENT_DB_VERSION = 1;
const LOCAL_DOCUMENT_STORE = "documents";
const LOCAL_DOCUMENT_ID = "active";
const THEME_STORAGE_KEY = "raavi:theme:v1";
const PINNED_LIBRARY_STORAGE_KEY = "raavi:library-pins:v1";
const PANE_LAYOUT_STORAGE_KEY = "raavi:pane-layout:v1";
const DEFAULT_FILE_NAME = "راهنمای-راوی.md";
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_LOCAL_VERSIONS = 10;
const PANE_COLLAPSE_THRESHOLD = 10;
const PANE_SPINE_WIDTH = 34;
const EDITOR_SELECTION_MENU_DELAY_MS = 480;
const DESKTOP_DOWNLOAD_PAGE = "https://ravi.poorsmile.ir/#download";

type DesktopInstallRecommendation = {
  platformLabel: string;
  description: string;
  actionLabel: string;
  href: string;
};

const DEFAULT_DESKTOP_INSTALL_RECOMMENDATION: DesktopInstallRecommendation = {
  platformLabel: "دسکتاپ",
  description:
    "برای اتصال پوشه‌ها و دسترسی سریع‌تر به نوشته‌ها، نسخه دسکتاپ را روی رایانه نصب کنید.",
  actionLabel: "مشاهده نسخه‌ها",
  href: DESKTOP_DOWNLOAD_PAGE,
};

function detectCommandEnvironment(): CommandEnvironment {
  if (typeof navigator === "undefined") {
    return { platform: "windows", surface: "web" };
  }
  const navigatorWithPlatform = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platformValue = (
    navigatorWithPlatform.userAgentData?.platform ??
    navigator.platform ??
    ""
  ).toLocaleLowerCase("en-US");
  const platform =
    platformValue.includes("mac")
      ? "mac"
      : platformValue.includes("linux")
        ? "linux"
        : "windows";
  return {
    platform,
    surface:
      typeof window !== "undefined" && window.raaviDesktop
        ? "electron"
        : "web",
  };
}

function detectDesktopInstallRecommendation(): DesktopInstallRecommendation {
  if (typeof navigator === "undefined") {
    return DEFAULT_DESKTOP_INSTALL_RECOMMENDATION;
  }

  const navigatorWithPlatform = navigator as Navigator & {
    userAgentData?: { platform?: string };
  };
  const platformValue = (
    navigatorWithPlatform.userAgentData?.platform ??
    navigator.platform ??
    navigator.userAgent ??
    ""
  ).toLocaleLowerCase("en-US");
  const userAgent = navigator.userAgent.toLocaleLowerCase("en-US");
  const isMobile = /android|iphone|ipad|ipod|mobile/u.test(userAgent);

  if (isMobile) {
    return {
      ...DEFAULT_DESKTOP_INSTALL_RECOMMENDATION,
      description:
        "برای کتابخانه کامل و اتصال پوشه‌ها، راوی را متناسب با سیستم‌عامل رایانه‌تان نصب کنید.",
    };
  }

  if (platformValue.includes("win")) {
    return {
      platformLabel: "Windows",
      description:
        "برای اتصال پوشه‌ها و دسترسی سریع‌تر به نوشته‌ها، نسخه Windows را روی همین دستگاه نصب کنید.",
      actionLabel: "دانلود برای Windows",
    href: "https://ravi.poorsmile.ir/downloads/Raavi-Setup-1.5.2-x64.exe",
    };
  }

  if (platformValue.includes("mac")) {
    return {
      platformLabel: "macOS",
      description:
        "نسخه macOS هنوز منتشر نشده است؛ وضعیت انتشار آن را در وب‌سایت راوی ببینید.",
      actionLabel: "مشاهده وضعیت macOS",
      href: DESKTOP_DOWNLOAD_PAGE,
    };
  }

  if (platformValue.includes("linux")) {
    return {
      platformLabel: "Linux",
      description:
        "برای اتصال پوشه‌ها و دسترسی سریع‌تر به نوشته‌ها، نسخه Linux را روی همین دستگاه نصب کنید.",
      actionLabel: "دانلود برای Linux",
      href: "https://ravi.poorsmile.ir/downloads/Raavi-1.0.0-linux-x64-portable.tar.gz",
    };
  }

  return DEFAULT_DESKTOP_INSTALL_RECOMMENDATION;
}

const SAMPLE_MARKDOWN = [
  "# راهنمای راوی",
  "",
  "راوی یک میز مطالعه و ویرایش برای **Markdown فارسی** است. فایل را روی صفحه رها کنید یا از دکمه‌ی «باز کردن فایل» کمک بگیرید.",
  "",
  "## از کجا شروع کنم؟",
  "",
  "1. یک فایل با پسوند `.md` یا `.markdown` باز کنید.",
  "2. متن را در برگ سمت راست اصلاح کنید.",
  "3. نتیجه را همان لحظه در برگ سمت چپ ببینید.",
  "4. با «حالت مطالعه» مزاحمت‌ها را کنار بزنید.",
  "",
  "> محتوای شما از این مرورگر خارج نمی‌شود؛ آخرین نوشته فقط روی همین دستگاه نگه‌داری می‌شود.",
  "",
  "### رفتار درست متن فنی",
  "",
  "کد و نشانی‌ها جهت طبیعی خود را حفظ می‌کنند:",
  "",
  "```js",
  "const direction = isCode ? \"ltr\" : \"rtl\";",
  "console.log(\"راوی آماده است\");",
  "```",
  "",
  "| قابلیت | وضعیت |",
  "| :--- | :---: |",
  "| پیش‌نمایش زنده | ✓ |",
  "| قفل اسکرول دوطرفه | ✓ |",
  "| تم روشن و تاریک | ✓ |",
  "| فهرست فصل‌های حالت مطالعه | ✓ |",
  "| جدول و چک‌لیست | ✓ |",
  "| ذخیره‌ی محلی | ✓ |",
  "| هایلایت، کامنت و حاشیه‌نویسی | ✓ |",
  "| اشتراک با فایل `.ravi` | ✓ |",
  "",
  "برای افزودن یادداشت، بخشی از متنِ همین پیش‌نمایش را انتخاب کنید و از نوار بالای برگه نوع یادداشت را بزنید.",
  "",
  "- [x] متن فارسی خوانا",
  "- [x] قطعه‌کد LTR",
  "- [ ] حالا فایل خودتان را باز کنید",
].join("\n");

type SaveState = "saved" | "dirty" | "saving" | "error";
type MobilePane = "editor" | "preview";
type ScrollPane = "editor" | "preview";
type DesktopPaneMode = "split" | ScrollPane;
type LibraryTab = "history" | "library" | "versions";
type LibraryState = "idle" | "scanning" | "ready";
type DocumentFileType = "markdown" | "ravi";
type SaveFileType = DocumentFileType;
type PendingExport = {
  format: ExportFormat;
  fileName: string;
  bytes?: ArrayBuffer;
  requiresDiagramConfirmation?: boolean;
};
type ImageSourceMode = "local" | "url";
type ReadingHeading = {
  documentIndex: number;
  level: number;
  text: string;
};
type TextDirection = "ltr" | "rtl";
type ThemeMode = "light" | "dark";
type ThemeTransition = "to-dark" | "to-light" | null;
type EditorAssistantTab = "outline" | "review";
type PersianReviewIssueId =
  | "arabic-characters"
  | "half-space"
  | "punctuation-spacing"
  | "heading-spacing"
  | "trailing-space"
  | "blank-lines";
type PersianReviewIssue = {
  id: PersianReviewIssueId;
  title: string;
  detail: string;
  count: number;
};

type LocalFileHandle = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
};

type LocalDirectoryHandle = {
  kind: "directory";
  name: string;
  values: () => AsyncIterableIterator<LocalFileHandle | LocalDirectoryHandle>;
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: "read";
  }) => Promise<LocalDirectoryHandle>;
};

type DesktopLibraryFile = {
  id: string;
  name: string;
  path: string;
  nativePath: string;
  size: number;
  lastModified: number;
  documentType: DocumentFileType;
};

type DesktopLibraryScan = {
  rootName: string;
  rootPath: string;
  files: DesktopLibraryFile[];
  truncated: boolean;
};

type DesktopOpenedDocument = {
  name: string;
  path: string;
  documentType: DocumentFileType;
  content: string;
  annotations?: RaaviAnnotation[];
  assets?: RaaviImageAsset[];
  revision?: number;
  versions?: RaaviVersion[];
  openInReadingMode?: boolean;
  draftId?: string;
};

type DesktopRecentFile = {
  path: string;
  name: string;
  documentType: DocumentFileType;
  openedAt: string;
};

type DesktopLibraryState = {
  folders: Array<{ rootName: string; rootPath: string }>;
  recents: DesktopRecentFile[];
};

type DocumentSavePayload = {
  content: string;
  annotations: RaaviAnnotation[];
  assets: RaaviImageAsset[];
  revision: number;
  versions: RaaviVersion[];
  raavi: ReturnType<typeof makeRaaviDocument>;
};

type LocalDocumentSnapshot = {
  content: string;
  fileName: string;
  readerSize: number;
  annotations: RaaviAnnotation[];
  assets: RaaviImageAsset[];
  revision: number;
  versions: RaaviVersion[];
  activeDocumentPath: string;
  documentType: DocumentFileType;
  lastSavedSnapshot: string;
  draftId?: string;
  viewMode?: ReadingViewMode;
  readingOutlineOpen?: boolean;
  readingPositions?: ReadingPositionMap;
  annotationComposer?: {
    kind: Extract<AnnotationKind, "comment" | "margin">;
    text: string;
    selection: SelectionDraft;
  } | null;
};

type ReadingResumeNotice = {
  documentKey: string;
  label: string;
  precision: "exact" | "near";
  record: ReadingPositionRecord;
};

export type RaaviDesktopAPI = {
  isDesktop: true;
  getLocalDocumentSnapshot: () => Promise<LocalDocumentSnapshot | null>;
  saveLocalDocumentSnapshot: (
    snapshot: LocalDocumentSnapshot,
  ) => Promise<{ saved: boolean }>;
  saveReadingPositions: (
    positions: ReadingPositionMap,
  ) => Promise<{ saved: boolean }>;
  saveReadingPositionsSync?: (
    positions: ReadingPositionMap,
  ) => { saved: boolean };
  getLibraryState: () => Promise<DesktopLibraryState>;
  chooseMarkdownFolder: () => Promise<DesktopLibraryScan | null>;
  scanMarkdownFolder: (rootPath: string) => Promise<DesktopLibraryScan>;
  readLibraryDocument: (filePath: string) => Promise<DesktopOpenedDocument>;
  chooseDocument: () => Promise<DesktopOpenedDocument | null>;
  openRecentDocument: (filePath: string) => Promise<DesktopOpenedDocument>;
  saveMarkdown: (
    fileName: string,
    document: DocumentSavePayload,
  ) => Promise<{
    saved: boolean;
    filePath?: string;
    documentType?: DocumentFileType;
  }>;
  saveRaavi: (
    fileName: string,
    document: DocumentSavePayload,
  ) => Promise<{
    saved: boolean;
    filePath?: string;
    raviPath?: string;
    markdownPath?: string;
    documentType?: DocumentFileType;
  }>;
  saveCurrentDocument: (
    filePath: string,
    document: DocumentSavePayload,
  ) => Promise<{
    saved: boolean;
    filePath?: string;
    documentType?: DocumentFileType;
  }>;
  saveWordExport: (
    fileName: string,
    bytes: Uint8Array,
  ) => Promise<{ saved: boolean; filePath?: string }>;
  exportPdf: (
    fileName: string,
  ) => Promise<{ saved: boolean; filePath?: string }>;
  rendererReady: () => void;
  onOpenMarkdownFile: (
    callback: (document: DesktopOpenedDocument) => void,
  ) => () => void;
};

declare global {
  interface Window {
    raaviDesktop?: RaaviDesktopAPI;
  }
}

type LibraryFile = {
  id: string;
  name: string;
  path: string;
  rootId: string;
  documentType: DocumentFileType;
  size: number;
  lastModified: number;
  read: () => Promise<DesktopOpenedDocument>;
};

type LibraryFolder = {
  rootId: string;
  rootName: string;
  rootPath: string;
};

type LibraryFolderNode = {
  name: string;
  path: string;
  folders: Map<string, LibraryFolderNode>;
  files: LibraryFile[];
};

type SelectionDraft = {
  start: number;
  end: number;
  quote: string;
  prefix: string;
  suffix: string;
};

type SelectionMenuPosition = {
  x: number;
  y: number;
  placement: "above" | "below";
};

type SelectionHighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type AnnotationHoverPreview = {
  annotationId: string;
  x: number;
  y: number;
  placement: "above" | "below";
};

function plainHeadingText(value: string) {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/[*_~`]/g, "")
    .trim();
}

function countDirectionalLetters(value: string) {
  return {
    latin: value.match(/\p{Script=Latin}/gu)?.length ?? 0,
    arabic: value.match(/\p{Script=Arabic}/gu)?.length ?? 0,
  };
}

function detectDocumentTextDirection(markdown: string): TextDirection {
  const { latin, arabic } = countDirectionalLetters(markdown);
  return latin > 0 && arabic === 0 ? "ltr" : "rtl";
}

function textFromReactNode(node: ReactNode): string {
  let text = "";

  Children.forEach(node, (child) => {
    if (typeof child === "string" || typeof child === "number") {
      text += String(child);
      return;
    }

    if (isValidElement<{ children?: ReactNode }>(child)) {
      text += textFromReactNode(child.props.children);
    }
  });

  return text;
}

function detectBlockTextDirection(
  node: ReactNode,
  documentDirection: TextDirection,
): TextDirection {
  if (documentDirection === "ltr") return "ltr";

  const { latin, arabic } = countDirectionalLetters(textFromReactNode(node));
  const directionalLetterCount = latin + arabic;
  if (directionalLetterCount === 0) return "rtl";

  return latin / directionalLetterCount > 0.7 ? "ltr" : "rtl";
}

function normalizePersianMarkdownLine(line: string) {
  const leadingWhitespace = line.match(/^\s*/u)?.[0] ?? "";
  const body = line.slice(leadingWhitespace.length).replace(/[ \t]+$/u, "");

  return (
    leadingWhitespace +
    body
      .replace(/\u064A/g, "ی")
      .replace(/\u0643/g, "ک")
      .replace(/\b(ن?می) /gu, "$1‌")
      .replace(/\s+([،؛؟!])/gu, "$1")
      .replace(/([،؛؟!])(?=\S)/gu, "$1 ")
      .replace(/^(#{1,6})([^\s#])/u, "$1 $2")
      .replace(/^([-*+])\s*\[(x|X| )\]\s*/u, "$1 [$2] ")
  );
}

function normalizePersianMarkdown(markdown: string) {
  const lines = markdown.split(/\r?\n/u);
  let fenceMarker = "";

  return lines
    .map((line) => {
      const fence = line.match(/^ {0,3}(`{3,}|~{3,})/u);
      if (fence) {
        const marker = fence[1][0];
        fenceMarker = fenceMarker === marker ? "" : fenceMarker || marker;
        return line.replace(/[ \t]+$/u, "");
      }

      if (fenceMarker) return line;
      return normalizePersianMarkdownLine(line);
    })
    .join("\n")
    .replace(/\n{3,}/gu, "\n\n");
}

function editorHeadings(markdown: string) {
  const headings: Array<{ level: number; offset: number; text: string }> = [];
  const lines = markdown.split(/\r?\n/u);
  let offset = 0;
  let fenceMarker = "";

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/u);
    if (fence) {
      const marker = fence[1][0];
      fenceMarker = fenceMarker === marker ? "" : fenceMarker || marker;
    } else if (!fenceMarker) {
      const atx = line.match(/^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*$/u);
      if (atx) {
        const text = plainHeadingText(
          atx[2].replace(/[ \t]+#+[ \t]*$/u, ""),
        );
        if (text) headings.push({ level: atx[1].length, offset, text });
      } else {
        const setext = lines[lineIndex + 1]?.match(
          /^ {0,3}(=+|-+)[ \t]*$/u,
        );
        if (line.trim() && setext) {
          const text = plainHeadingText(line.trim());
          if (text) {
            headings.push({
              level: setext[1][0] === "=" ? 1 : 2,
              offset,
              text,
            });
          }
        }
      }
    }
    offset += line.length + 1;
  }

  return headings;
}

function analyzePersianMarkdown(markdown: string): PersianReviewIssue[] {
  const counts: Record<PersianReviewIssueId, number> = {
    "arabic-characters": 0,
    "half-space": 0,
    "punctuation-spacing": 0,
    "heading-spacing": 0,
    "trailing-space": 0,
    "blank-lines": 0,
  };
  const lines = markdown.split(/\r?\n/u);
  let fenceMarker = "";
  let blankRun = 0;

  for (const line of lines) {
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/u);
    if (fence) {
      const marker = fence[1][0];
      fenceMarker = fenceMarker === marker ? "" : fenceMarker || marker;
      blankRun = 0;
      continue;
    }
    if (fenceMarker) continue;

    counts["arabic-characters"] += line.match(/[\u064A\u0643]/gu)?.length ?? 0;
    counts["half-space"] += line.match(/\b(?:ن?می) /gu)?.length ?? 0;
    counts["punctuation-spacing"] +=
      (line.match(/\s+[،؛؟!]/gu)?.length ?? 0) +
      (line.match(/[،؛؟!](?=\S)/gu)?.length ?? 0);
    counts["heading-spacing"] += /^ {0,3}#{1,6}[^\s#]/u.test(line) ? 1 : 0;
    counts["trailing-space"] += /[ \t]+$/u.test(line) ? 1 : 0;

    if (!line.trim()) {
      blankRun += 1;
      if (blankRun > 1) counts["blank-lines"] += 1;
    } else {
      blankRun = 0;
    }
  }

  const definitions: Array<Omit<PersianReviewIssue, "count">> = [
    {
      id: "arabic-characters",
      title: "نویسه‌های عربی",
      detail: "ی و ک عربی را به شکل فارسی تبدیل می‌کند.",
    },
    {
      id: "half-space",
      title: "نیم‌فاصله",
      detail: "می و نمی را به واژهٔ بعدی متصل می‌کند.",
    },
    {
      id: "punctuation-spacing",
      title: "فاصلهٔ نشانه‌ها",
      detail: "فاصلهٔ ویرگول، سؤال و تعجب را اصلاح می‌کند.",
    },
    {
      id: "heading-spacing",
      title: "تیتر Markdown",
      detail: "بعد از نشانهٔ تیتر فاصله می‌گذارد.",
    },
    {
      id: "trailing-space",
      title: "فاصلهٔ انتهای خط",
      detail: "فاصله‌های پنهان انتهای خط را حذف می‌کند.",
    },
    {
      id: "blank-lines",
      title: "خط‌های خالی اضافه",
      detail: "فاصلهٔ عمودی سند را یکدست می‌کند.",
    },
  ];

  return definitions
    .map((issue) => ({ ...issue, count: counts[issue.id] }))
    .filter((issue) => issue.count > 0);
}

function applyPersianReviewIssue(
  markdown: string,
  issueId: PersianReviewIssueId,
) {
  const lines = markdown.split(/\r?\n/u);
  const nextLines: string[] = [];
  let fenceMarker = "";
  let blankRun = 0;

  for (const line of lines) {
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/u);
    if (fence) {
      const marker = fence[1][0];
      fenceMarker = fenceMarker === marker ? "" : fenceMarker || marker;
      blankRun = 0;
      nextLines.push(line);
      continue;
    }
    if (fenceMarker) {
      nextLines.push(line);
      continue;
    }

    if (issueId === "blank-lines") {
      blankRun = line.trim() ? 0 : blankRun + 1;
      if (blankRun > 1) continue;
      nextLines.push(line);
      continue;
    }

    blankRun = 0;
    let nextLine = line;
    if (issueId === "arabic-characters") {
      nextLine = nextLine.replace(/\u064A/g, "ی").replace(/\u0643/g, "ک");
    } else if (issueId === "half-space") {
      nextLine = nextLine.replace(/\b(ن?می) /gu, "$1‌");
    } else if (issueId === "punctuation-spacing") {
      nextLine = nextLine
        .replace(/\s+([،؛؟!])/gu, "$1")
        .replace(/([،؛؟!])(?=\S)/gu, "$1 ");
    } else if (issueId === "heading-spacing") {
      nextLine = nextLine.replace(/^( {0,3}#{1,6})([^\s#])/u, "$1 $2");
    } else if (issueId === "trailing-space") {
      nextLine = nextLine.replace(/[ \t]+$/u, "");
    }
    nextLines.push(nextLine);
  }

  return nextLines.join("\n");
}

function extractReadingHeadings(markdown: string): ReadingHeading[] {
  const headings: ReadingHeading[] = [];
  const lines = markdown.split(/\r?\n/u);
  let documentIndex = 0;
  let fenceMarker = "";

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/u);

    if (fence) {
      const marker = fence[1][0];
      fenceMarker = fenceMarker === marker ? "" : fenceMarker || marker;
      continue;
    }

    if (fenceMarker) continue;

    const atx = line.match(/^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*$/u);
    if (atx) {
      const level = atx[1].length;
      const text = plainHeadingText(
        atx[2].replace(/[ \t]+#+[ \t]*$/u, ""),
      );
      if (level <= 3 && text) {
        headings.push({ documentIndex, level, text });
      }
      documentIndex += 1;
      continue;
    }

    const setext = lines[lineIndex + 1]?.match(/^ {0,3}(=+|-+)[ \t]*$/u);
    if (line.trim() && setext) {
      const level = setext[1][0] === "=" ? 1 : 2;
      const text = plainHeadingText(line.trim());
      if (text) headings.push({ documentIndex, level, text });
      documentIndex += 1;
      lineIndex += 1;
    }
  }

  return headings;
}

const ANNOTATION_LABELS: Record<AnnotationKind, string> = {
  highlight: "هایلایت",
  comment: "کامنت",
  margin: "حاشیه‌نویسی",
};

function AnnotationIcon({
  kind,
  size = 16,
}: {
  kind: AnnotationKind;
  size?: number;
}) {
  if (kind === "highlight") {
    return <Highlighter size={size} aria-hidden="true" />;
  }
  if (kind === "comment") {
    return <MessageCircle size={size} aria-hidden="true" />;
  }
  return <NotebookPen size={size} aria-hidden="true" />;
}

function annotationId() {
  return globalThis.crypto?.randomUUID?.() ?? `ravi-${Date.now()}`;
}

function resolveAnnotationStart(
  text: string,
  annotation: Pick<
    RaaviAnnotation,
    "start" | "quote" | "prefix" | "suffix"
  >,
) {
  if (
    text.slice(annotation.start, annotation.start + annotation.quote.length) ===
    annotation.quote
  ) {
    return annotation.start;
  }

  let cursor = 0;
  let bestStart = -1;
  let bestScore = Number.NEGATIVE_INFINITY;

  while (cursor <= text.length) {
    const candidate = text.indexOf(annotation.quote, cursor);
    if (candidate < 0) break;

    const prefix = text.slice(
      Math.max(0, candidate - annotation.prefix.length),
      candidate,
    );
    const suffix = text.slice(
      candidate + annotation.quote.length,
      candidate + annotation.quote.length + annotation.suffix.length,
    );
    const contextScore =
      (prefix.endsWith(annotation.prefix) ? 4_000 : 0) +
      (suffix.startsWith(annotation.suffix) ? 4_000 : 0);
    const distanceScore = -Math.abs(candidate - annotation.start);
    const score = contextScore + distanceScore;

    if (score > bestScore) {
      bestScore = score;
      bestStart = candidate;
    }
    cursor = candidate + Math.max(1, annotation.quote.length);
  }

  return bestStart;
}

function rangeFromTextOffsets(root: HTMLElement, start: number, end: number) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let startNode: Text | null = null;
  let endNode: Text | null = null;
  let startOffset = 0;
  let endOffset = 0;
  let current = walker.nextNode();

  while (current) {
    const node = current as Text;
    const next = consumed + node.data.length;

    if (!startNode && start >= consumed && start <= next) {
      startNode = node;
      startOffset = Math.min(node.data.length, start - consumed);
    }
    if (end >= consumed && end <= next) {
      endNode = node;
      endOffset = Math.min(node.data.length, end - consumed);
      break;
    }

    consumed = next;
    current = walker.nextNode();
  }

  if (!startNode || !endNode) return null;
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  return range.collapsed ? null : range;
}

function findAnnotationAtPoint(
  root: HTMLElement,
  annotations: RaaviAnnotation[],
  clientX: number,
  clientY: number,
) {
  const text = root.textContent ?? "";
  const matches = annotations.filter((annotation) => {
    const start = resolveAnnotationStart(text, annotation);
    if (start < 0) return false;
    const range = rangeFromTextOffsets(
      root,
      start,
      start + annotation.quote.length,
    );
    if (!range) return false;

    return Array.from(range.getClientRects()).some(
      (rect) =>
        clientX >= rect.left - 2 &&
        clientX <= rect.right + 2 &&
        clientY >= rect.top - 2 &&
        clientY <= rect.bottom + 2,
    );
  });

  matches.sort((first, second) => {
    const firstPriority = first.kind === "highlight" ? 0 : 1;
    const secondPriority = second.kind === "highlight" ? 0 : 1;
    if (firstPriority !== secondPriority) {
      return secondPriority - firstPriority;
    }
    return first.quote.length - second.quote.length;
  });

  return matches[0] ?? null;
}

function buildLibraryTree(files: LibraryFile[]): LibraryFolderNode {
  const root: LibraryFolderNode = {
    name: "",
    path: "",
    folders: new Map(),
    files: [],
  };

  for (const file of files) {
    const parts = file.path.split("/");
    parts.pop();
    let current = root;
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      if (!current.folders.has(part)) {
        current.folders.set(part, {
          name: part,
          path: currentPath,
          folders: new Map(),
          files: [],
        });
      }
      current = current.folders.get(part)!;
    }

    current.files.push(file);
  }

  return root;
}

function libraryPinKey(file: LibraryFile) {
  return `${file.rootId}::${file.path}`;
}

function LibraryFileRow({
  file,
  activePath,
  isPinned,
  onOpenFile,
  onTogglePin,
  indent = 0,
  placement = "tree",
}: {
  file: LibraryFile;
  activePath: string;
  isPinned: boolean;
  onOpenFile: (file: LibraryFile) => void;
  onTogglePin: (file: LibraryFile) => void;
  indent?: number;
  placement?: "tree" | "pinned";
}) {
  const pinLabel = isPinned
    ? `برداشتن «${file.name}» از سنجاق‌شده‌ها`
    : `سنجاق‌کردن «${file.name}»`;

  return (
    <div
      className={`library-file-row is-${placement} ${
        isPinned ? "is-pinned" : ""
      }`}
    >
      <button
        className={`library-file ${
          activePath === file.path ? "is-active" : ""
        }`}
        type="button"
        onClick={() => onOpenFile(file)}
        title={file.path}
        style={
          {
            "--tree-indent": `${indent}px`,
          } as React.CSSProperties
        }
        aria-pressed={activePath === file.path}
      >
        {file.documentType === "ravi" ? (
          <FileArchive size={15} aria-hidden="true" />
        ) : (
          <FileText size={15} aria-hidden="true" />
        )}
        <span dir="auto">{file.name}</span>
      </button>
      <button
        className={`library-pin-action ${isPinned ? "is-pinned" : ""}`}
        type="button"
        onClick={() => onTogglePin(file)}
        aria-label={pinLabel}
        aria-pressed={isPinned}
        title={isPinned ? "برداشتن سنجاق" : "سنجاق‌کردن"}
      >
        <Pin size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

async function scanMarkdownDirectory(
  directory: LocalDirectoryHandle,
  rootId: string,
  rootName: string,
  basePath = "",
  results: LibraryFile[] = [],
): Promise<LibraryFile[]> {
  for await (const entry of directory.values()) {
    const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.kind === "directory") {
      await scanMarkdownDirectory(
        entry,
        rootId,
        rootName,
        entryPath,
        results,
      );
      continue;
    }

    if (!/\.(md|markdown|ravi)$/i.test(entry.name)) continue;

    const file = await entry.getFile();
    const documentType: DocumentFileType = /\.ravi$/i.test(entry.name)
      ? "ravi"
      : "markdown";
    results.push({
      id: `${rootId}:${entryPath}:${file.lastModified}:${file.size}`,
      name: entry.name,
      path: `${rootName}/${entryPath}`,
      rootId,
      documentType,
      size: file.size,
      lastModified: file.lastModified,
      read: async () => {
        const nextFile = await entry.getFile();
        const rawContent = await nextFile.text();
        if (documentType === "ravi") {
          const parsed = parseRaaviDocument(
            rawContent,
            entry.name.replace(/\.ravi$/i, ".md"),
          );
          return {
            name: parsed.fileName,
            path: "",
            documentType,
            content: parsed.content,
            annotations: parsed.annotations,
            revision: parsed.revision,
            versions: parsed.versions,
            openInReadingMode: false,
            draftId: `web-file:${file.name.normalize("NFKC").toLocaleLowerCase("fa")}`,
          };
        }
        return {
          name: entry.name,
          path: "",
          documentType,
          content: rawContent,
          annotations: [],
          revision: 1,
          versions: [],
          openInReadingMode: false,
        };
      },
    });
  }

  return results;
}

function LibraryBranch({
  node,
  activePath,
  pinnedKeys,
  onOpenFile,
  onTogglePin,
  depth = 0,
  isRoot = false,
}: {
  node: LibraryFolderNode;
  activePath: string;
  pinnedKeys: ReadonlySet<string>;
  onOpenFile: (file: LibraryFile) => void;
  onTogglePin: (file: LibraryFile) => void;
  depth?: number;
  isRoot?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const folders = Array.from(node.folders.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "fa"),
  );
  const files = [...node.files].sort((a, b) =>
    a.name.localeCompare(b.name, "fa"),
  );
  const branchContents = (
    <>
      {folders.map((folder) => (
        <LibraryBranch
          key={folder.path}
          node={folder}
          activePath={activePath}
          pinnedKeys={pinnedKeys}
          onOpenFile={onOpenFile}
          onTogglePin={onTogglePin}
          depth={isRoot ? 0 : depth + 1}
        />
      ))}
      {files.map((file) => (
        <li key={file.id}>
          <LibraryFileRow
            file={file}
            activePath={activePath}
            isPinned={pinnedKeys.has(libraryPinKey(file))}
            onOpenFile={onOpenFile}
            onTogglePin={onTogglePin}
            indent={(isRoot ? 0 : depth + 1) * 15}
          />
        </li>
      ))}
    </>
  );

  if (isRoot) {
    return <ul className="library-branch">{branchContents}</ul>;
  }

  return (
    <li className="library-folder">
      <button
        className="folder-row"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        aria-expanded={isOpen}
        style={{ "--tree-indent": `${depth * 15}px` } as React.CSSProperties}
      >
        {isOpen ? (
          <ChevronDown size={15} aria-hidden="true" />
        ) : (
          <ChevronLeft size={15} aria-hidden="true" />
        )}
        <Folder size={16} aria-hidden="true" />
        <span dir="auto">{node.name}</span>
      </button>

      {isOpen && <ul className="library-branch">{branchContents}</ul>}
    </li>
  );
}

function documentSnapshot(
  content: string,
  annotations: RaaviAnnotation[],
  assets: RaaviImageAsset[],
) {
  return JSON.stringify({ content, annotations, assets });
}

function saveNameForType(fileName: string, type: SaveFileType) {
  const baseName =
    fileName.trim().replace(/\.(?:md|markdown|ravi)$/i, "") || "نوشته-راوی";
  return type === "ravi" ? `${baseName}.ravi` : `${baseName}.md`;
}

function exportNameForFormat(fileName: string, format: ExportFormat) {
  const baseName =
    fileName.trim().replace(/\.(?:md|markdown|ravi|docx|pdf)$/i, "") ||
    "نوشته-راوی";
  return `${baseName}.${format === "word" ? "docx" : "pdf"}`;
}

function downloadExport(bytes: ArrayBuffer, fileName: string) {
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function waitForNextPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

async function inspectPrintablePreview(root: HTMLElement | null) {
  const warnings: ExportDialogWarning[] = [];
  await document.fonts?.ready;
  await waitForNextPaint();

  const deadline = Date.now() + 12_000;
  let pendingDiagrams: HTMLElement[] = [];
  do {
    const diagrams = Array.from(
      root?.querySelectorAll<HTMLElement>(".mermaid-diagram") ?? [],
    );
    pendingDiagrams = diagrams.filter(
      (diagram) =>
        !diagram.classList.contains("is-invalid") &&
        !diagram.querySelector(".mermaid-svg"),
    );
    if (pendingDiagrams.length === 0) break;
    await new Promise((resolve) => window.setTimeout(resolve, 120));
  } while (Date.now() < deadline);

  const invalidDiagrams =
    root?.querySelectorAll(".mermaid-diagram.is-invalid").length ?? 0;
  if (invalidDiagrams > 0) {
    warnings.push({
      kind: "diagram",
      message: `${invalidDiagrams.toLocaleString("fa-IR")} نمودار نامعتبر است و در PDF به‌صورت پیام خطا دیده می‌شود.`,
    });
  }
  if (pendingDiagrams.length > 0) {
    warnings.push({
      kind: "diagram",
      message: `${pendingDiagrams.length.toLocaleString("fa-IR")} نمودار تا پایان زمان آماده‌سازی رندر نشد.`,
    });
  }

  const images = Array.from(root?.querySelectorAll<HTMLImageElement>("img") ?? []);
  await Promise.allSettled(
    images.map(async (image) => {
      if (!image.complete) {
        await new Promise<void>((resolve) => {
          const finish = () => resolve();
          image.addEventListener("load", finish, { once: true });
          image.addEventListener("error", finish, { once: true });
          window.setTimeout(finish, 5_000);
        });
      }
      await image.decode?.().catch(() => undefined);
    }),
  );
  const failedImages = images.filter((image) => image.naturalWidth === 0).length;
  const blockedImages =
    root?.querySelectorAll(".remote-media-blocked").length ?? 0;
  if (failedImages + blockedImages > 0) {
    warnings.push({
      kind: "image",
      message: `${(failedImages + blockedImages).toLocaleString("fa-IR")} تصویر در دسترس نیست و در PDF نمایش داده نمی‌شود.`,
    });
  }
  return warnings;
}

function readImageAssetData(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("error", () => reject(new Error("IMAGE_READ_FAILED")));
    reader.addEventListener("load", () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const match = /^data:image\/(?:gif|jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/iu.exec(
        result,
      );
      if (!match) {
        reject(new Error("IMAGE_READ_FAILED"));
        return;
      }
      resolve(match[1]);
    });
    reader.readAsDataURL(file);
  });
}

function readImageAssetDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    const cleanUp = () => URL.revokeObjectURL(objectUrl);
    image.addEventListener("error", () => {
      cleanUp();
      reject(new Error("IMAGE_DIMENSIONS_FAILED"));
    });
    image.addEventListener("load", () => {
      const width = image.naturalWidth;
      const height = image.naturalHeight;
      cleanUp();
      if (!width || !height) {
        reject(new Error("IMAGE_DIMENSIONS_FAILED"));
        return;
      }
      resolve({ width, height });
    });
    image.src = objectUrl;
  });
}

function imageAltFromFileName(fileName: string) {
  return (
    fileName
      .replace(/\.[^.]+$/u, "")
      .replace(/[\[\]\r\n]/gu, " ")
      .trim() || "تصویر"
  );
}

function raaviMarkdownUrlTransform(url: string) {
  if (
    raaviImageAssetId(url) ||
    /^data:image\/(?:gif|jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/iu.test(
      url,
    )
  ) {
    return url;
  }
  return defaultUrlTransform(url);
}

function caretBoundaryFromPoint(clientX: number, clientY: number) {
  const caretPosition = document.caretPositionFromPoint?.(clientX, clientY);
  if (caretPosition) {
    return { node: caretPosition.offsetNode, offset: caretPosition.offset };
  }
  const caretRange = document.caretRangeFromPoint?.(clientX, clientY);
  return caretRange
    ? { node: caretRange.startContainer, offset: caretRange.startOffset }
    : null;
}

function rangeBetweenBoundaries(
  first: { node: Node; offset: number },
  second: { node: Node; offset: number },
) {
  try {
    const firstProbe = document.createRange();
    firstProbe.setStart(first.node, first.offset);
    firstProbe.collapse(true);
    const secondProbe = document.createRange();
    secondProbe.setStart(second.node, second.offset);
    secondProbe.collapse(true);
    const firstComesFirst =
      firstProbe.compareBoundaryPoints(Range.START_TO_START, secondProbe) <= 0;
    const range = document.createRange();
    range.setStart(
      firstComesFirst ? first.node : second.node,
      firstComesFirst ? first.offset : second.offset,
    );
    range.setEnd(
      firstComesFirst ? second.node : first.node,
      firstComesFirst ? second.offset : first.offset,
    );
    return range;
  } catch {
    return null;
  }
}

function openLocalDocumentDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("INDEXEDDB_UNAVAILABLE"));
      return;
    }

    const request = indexedDB.open(
      LOCAL_DOCUMENT_DB_NAME,
      LOCAL_DOCUMENT_DB_VERSION,
    );
    request.addEventListener("upgradeneeded", () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LOCAL_DOCUMENT_STORE)) {
        db.createObjectStore(LOCAL_DOCUMENT_STORE, { keyPath: "id" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () =>
      reject(request.error ?? new Error("INDEXEDDB_OPEN_FAILED")),
    );
  });
}

function readLocalDocumentSnapshot() {
  return new Promise<LocalDocumentSnapshot | null>((resolve, reject) => {
    openLocalDocumentDb()
      .then((db) => {
        const transaction = db.transaction(LOCAL_DOCUMENT_STORE, "readonly");
        const store = transaction.objectStore(LOCAL_DOCUMENT_STORE);
        const request = store.get(LOCAL_DOCUMENT_ID);
        request.addEventListener("success", () => {
          const record = request.result as
            | { snapshot?: LocalDocumentSnapshot }
            | undefined;
          resolve(record?.snapshot ?? null);
          db.close();
        });
        request.addEventListener("error", () => {
          reject(request.error ?? new Error("INDEXEDDB_READ_FAILED"));
          db.close();
        });
      })
      .catch(reject);
  });
}

function writeLocalDocumentSnapshot(snapshot: LocalDocumentSnapshot) {
  return new Promise<void>((resolve, reject) => {
    openLocalDocumentDb()
      .then((db) => {
        const transaction = db.transaction(LOCAL_DOCUMENT_STORE, "readwrite");
        transaction.objectStore(LOCAL_DOCUMENT_STORE).put({
          id: LOCAL_DOCUMENT_ID,
          snapshot,
          updatedAt: new Date().toISOString(),
        });
        transaction.addEventListener("complete", () => {
          db.close();
          resolve();
        });
        transaction.addEventListener("error", () => {
          db.close();
          reject(transaction.error ?? new Error("INDEXEDDB_WRITE_FAILED"));
        });
      })
      .catch(reject);
  });
}

export default function Home() {
  const [content, setContent] = useState(SAMPLE_MARKDOWN);
  const [fileName, setFileName] = useState(DEFAULT_FILE_NAME);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [activeDocumentPath, setActiveDocumentPath] = useState("");
  const [documentType, setDocumentType] =
    useState<DocumentFileType>("markdown");
  const [revision, setRevision] = useState(1);
  const [versions, setVersions] = useState<RaaviVersion[]>([]);
  const [imageAssets, setImageAssets] = useState<RaaviImageAsset[]>([]);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() =>
    documentSnapshot(SAMPLE_MARKDOWN, [], []),
  );
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("word");
  const [exportStatus, setExportStatus] =
    useState<ExportDialogStatus>("idle");
  const [exportProgressLabel, setExportProgressLabel] = useState("");
  const [exportWarnings, setExportWarnings] = useState<
    ExportDialogWarning[]
  >([]);
  const [exportDiagramConfirmed, setExportDiagramConfirmed] = useState(false);
  const [exportError, setExportError] = useState("");
  const [pdfExportActive, setPdfExportActive] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageSourceMode, setImageSourceMode] =
    useState<ImageSourceMode>("local");
  const [imageUrl, setImageUrl] = useState("");
  const [imageInsertError, setImageInsertError] = useState("");
  const [newDocumentModalOpen, setNewDocumentModalOpen] = useState(false);
  const [newDocumentCreating, setNewDocumentCreating] = useState(false);
  const [newDocumentError, setNewDocumentError] = useState("");
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [mermaidStudioSession, setMermaidStudioSession] =
    useState<MermaidStudioSession | null>(null);
  const [saveFileType, setSaveFileType] =
    useState<SaveFileType>("ravi");
  const [saveFileName, setSaveFileName] = useState(
    saveNameForType(DEFAULT_FILE_NAME, "ravi"),
  );
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [themeTransition, setThemeTransition] =
    useState<ThemeTransition>(null);
  const [commandEnvironment, setCommandEnvironment] =
    useState<CommandEnvironment>(() => detectCommandEnvironment());
  const [desktopInstallRecommendation, setDesktopInstallRecommendation] =
    useState<DesktopInstallRecommendation>(
      DEFAULT_DESKTOP_INSTALL_RECOMMENDATION,
    );
  const [readingMode, setReadingMode] = useState(false);
  const [readingHeaderVisible, setReadingHeaderVisible] = useState(true);
  const [readingOutlineOpen, setReadingOutlineOpen] = useState(true);
  const [activeReadingHeadingIndex, setActiveReadingHeadingIndex] =
    useState(-1);
  const [readerSize, setReaderSize] = useState(18);
  const [documentDraftId, setDocumentDraftId] = useState("active");
  const [readingPositions, setReadingPositions] =
    useState<ReadingPositionMap>({});
  const [readingResumeNotice, setReadingResumeNotice] =
    useState<ReadingResumeNotice | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>("preview");
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const [mobileHeaderMenuOpen, setMobileHeaderMenuOpen] = useState(false);
  const [mobileEditorToolsExpanded, setMobileEditorToolsExpanded] =
    useState(false);
  const [editorAssistantTab, setEditorAssistantTab] =
    useState<EditorAssistantTab | null>(null);
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(true);
  const [desktopPaneMode, setDesktopPaneMode] =
    useState<DesktopPaneMode>("split");
  const [previewPanePercent, setPreviewPanePercent] = useState(50);
  const [paneLayoutHydrated, setPaneLayoutHydrated] = useState(false);
  const [paneDragging, setPaneDragging] = useState(false);
  const [paneCollapseCandidate, setPaneCollapseCandidate] =
    useState<ScrollPane | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<LibraryTab>("library");
  const [libraryIsModal, setLibraryIsModal] = useState(false);
  const [libraryState, setLibraryState] =
    useState<LibraryState>("scanning");
  const [libraryFiles, setLibraryFiles] = useState<LibraryFile[]>([]);
  const [libraryFolders, setLibraryFolders] = useState<LibraryFolder[]>([]);
  const [recentFiles, setRecentFiles] = useState<DesktopRecentFile[]>([]);
  const [pinnedLibraryKeys, setPinnedLibraryKeys] = useState<string[]>([]);
  const [pinnedLibraryHydrated, setPinnedLibraryHydrated] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [activeLibraryPath, setActiveLibraryPath] = useState("");
  const [openingLibraryPath, setOpeningLibraryPath] = useState("");
  const [annotations, setAnnotations] = useState<RaaviAnnotation[]>([]);
  const [editorSelectionMenuPosition, setEditorSelectionMenuPosition] =
    useState<SelectionMenuPosition | null>(null);
  const [selectionDraft, setSelectionDraft] =
    useState<SelectionDraft | null>(null);
  const [selectionHighlightRects, setSelectionHighlightRects] = useState<
    SelectionHighlightRect[]
  >([]);
  const [selectionMenuPosition, setSelectionMenuPosition] =
    useState<SelectionMenuPosition | null>(null);
  const [composerKind, setComposerKind] = useState<
    Extract<AnnotationKind, "comment" | "margin"> | null
  >(null);
  const [composerText, setComposerText] = useState("");
  const [annotationPanelOpen, setAnnotationPanelOpen] = useState(false);
  const [activeAnnotationId, setActiveAnnotationId] = useState("");
  const [hoverPreview, setHoverPreview] =
    useState<AnnotationHoverPreview | null>(null);

  const editorRef = useRef<MarkdownCodeEditorHandle>(null);
  const editorPaneRef = useRef<HTMLElement>(null);
  const editorSelectionMenuRef = useRef<HTMLDivElement>(null);
  const editorSelectionMenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const previewArticleRef = useRef<HTMLElement>(null);
  const librarySearchRef = useRef<HTMLInputElement>(null);
  const annotationPanelRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageInsertButtonRef = useRef<HTMLButtonElement>(null);
  const imageModalRef = useRef<HTMLDivElement>(null);
  const mermaidLoadingModalRef = useRef<HTMLDivElement>(null);
  const imageUrlInputRef = useRef<HTMLInputElement>(null);
  const imageLocalPickerRef = useRef<HTMLButtonElement>(null);
  const imageModalCloseRef = useRef<HTMLButtonElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const libraryPanelRef = useRef<HTMLElement>(null);
  const libraryCloseRef = useRef<HTMLButtonElement>(null);
  const libraryTriggerRef = useRef<HTMLButtonElement>(null);
  const historyTabRef = useRef<HTMLButtonElement>(null);
  const libraryTabRef = useRef<HTMLButtonElement>(null);
  const versionsTabRef = useRef<HTMLButtonElement>(null);
  const annotationToggleRef = useRef<HTMLButtonElement>(null);
  const selectionMenuRef = useRef<HTMLDivElement>(null);
  const commentButtonRef = useRef<HTMLButtonElement>(null);
  const marginButtonRef = useRef<HTMLButtonElement>(null);
  const composerTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const composerOriginRef = useRef<HTMLButtonElement | null>(null);
  const readingReturnFocusRef = useRef<HTMLElement | null>(null);
  const saveModalCloseRef = useRef<HTMLButtonElement>(null);
  const exportButtonRef = useRef<HTMLButtonElement>(null);
  const newDocumentButtonRef = useRef<HTMLButtonElement>(null);
  const brandButtonRef = useRef<HTMLButtonElement>(null);
  const supportButtonRef = useRef<HTMLButtonElement>(null);
  const mobileHeaderMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileHeaderMenuRef = useRef<HTMLDivElement>(null);
  const mobileHeaderMenuCloseRef = useRef<HTMLButtonElement>(null);
  const mermaidReturnFocusRef = useRef<HTMLElement | null>(null);
  const saveFileNameRef = useRef<HTMLInputElement>(null);
  const saveModalRef = useRef<HTMLDivElement>(null);
  const pendingExportRef = useRef<PendingExport | null>(null);
  const openedDocumentRef = useRef(false);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeCommitTimerRef = useRef<number | null>(null);
  const themeFinishTimerRef = useRef<number | null>(null);
  const annotationHoverFrameRef = useRef<number | null>(null);
  const readingHeaderFrameRef = useRef<number | null>(null);
  const readingOutlineFrameRef = useRef<number | null>(null);
  const readingLastScrollTopRef = useRef(0);
  const readingPositionTimerRef = useRef<number | null>(null);
  const readingRestoreFrameRef = useRef<number | null>(null);
  const readingRestoreTimerRef = useRef<number | null>(null);
  const readingRestoreInProgressRef = useRef(false);
  const readingRestoreExpectedScrollTopRef = useRef<number | null>(null);
  const readingRestoreProtectPendingRef = useRef(false);
  const readingRestoreRequestRef = useRef(0);
  const readingDocumentEpochRef = useRef(0);
  const readingCaptureSuspendedRef = useRef(false);
  const readingUserInteractionUntilRef = useRef(0);
  const readingIntentionalNavigationRef = useRef(false);
  const readingNavigationTimerRef = useRef<number | null>(null);
  const readingNavigationReleaseTimerRef = useRef<number | null>(null);
  const readingNavigationTargetRef = useRef<{
    element: HTMLElement;
    placement: "start" | "center";
  } | null>(null);
  const readingReflowTimerRef = useRef<number | null>(null);
  const readingLayoutTransitionTimerRef = useRef<number | null>(null);
  const readingPositionsRef = useRef<ReadingPositionMap>({});
  const lastReadingAnchorRef = useRef<ReadingPositionRecord | null>(null);
  const pendingReadingLayoutAnchorRef = useRef<ReadingPositionRecord | null>(
    null,
  );
  const selectionReadingAnchorRef = useRef<ReadingPositionRecord | null>(null);
  const selectionStartScrollRef = useRef<{
    documentKey: string;
    root: HTMLElement;
    top: number;
    request: number;
  } | null>(null);
  const selectionScrollRestoreRequestRef = useRef(0);
  const selectionPointerStartRef = useRef<{
    documentKey: string;
    node: Node;
    offset: number;
  } | null>(null);
  const diagramReadingAnchorRef = useRef<{
    record: ReadingPositionRecord | null;
    documentKey: string;
    root: HTMLElement | null;
    scrollTop: number;
  } | null>(null);
  const lastExpandedPreviewPercentRef = useRef(50);
  const paneDragCleanupRef = useRef<(() => void) | null>(null);
  const scrollSyncFrameRef = useRef<number | null>(null);
  const scrollSyncTargetRef = useRef<{
    pane: ScrollPane;
    scrollTop: number;
  } | null>(null);
  const pendingScrollSourceRef = useRef<ScrollPane | null>(null);
  const lastScrolledPaneRef = useRef<ScrollPane>("editor");
  const directoryHandlesRef = useRef(
    new Map<string, LocalDirectoryHandle>(),
  );
  const { topLayer, syncLayer } = useModalStack();
  const readingHeadings = useMemo(
    () => extractReadingHeadings(content),
    [content],
  );
  const currentDocumentKey = useMemo(
    () => readingDocumentKey({ activeDocumentPath, draftId: documentDraftId }),
    [activeDocumentPath, documentDraftId],
  );
  const currentContentSignature = useMemo(
    () => readingContentSignature(content),
    [content],
  );
  const readingDocumentStateRef = useRef({
    documentKey: currentDocumentKey,
    contentSignature: currentContentSignature,
    readerSize,
    outlineOpen: readingOutlineOpen,
  });
  useLayoutEffect(() => {
    if (
      readingCaptureSuspendedRef.current &&
      (currentDocumentKey !== readingDocumentStateRef.current.documentKey ||
        currentContentSignature !==
          readingDocumentStateRef.current.contentSignature)
    ) {
      return;
    }
    readingDocumentStateRef.current = {
      documentKey: currentDocumentKey,
      contentSignature: currentContentSignature,
      readerSize,
      outlineOpen: readingOutlineOpen,
    };
    readingCaptureSuspendedRef.current = false;
  }, [
    currentContentSignature,
    currentDocumentKey,
    readerSize,
    readingOutlineOpen,
  ]);
  const cancelReadingRestoreWork = useCallback(() => {
    readingRestoreRequestRef.current += 1;
    if (readingPositionTimerRef.current !== null) {
      window.clearTimeout(readingPositionTimerRef.current);
      readingPositionTimerRef.current = null;
    }
    if (readingRestoreFrameRef.current !== null) {
      window.cancelAnimationFrame(readingRestoreFrameRef.current);
      readingRestoreFrameRef.current = null;
    }
    if (readingRestoreTimerRef.current !== null) {
      window.clearTimeout(readingRestoreTimerRef.current);
      readingRestoreTimerRef.current = null;
    }
    if (readingReflowTimerRef.current !== null) {
      window.clearTimeout(readingReflowTimerRef.current);
      readingReflowTimerRef.current = null;
    }
    if (readingNavigationTimerRef.current !== null) {
      window.clearTimeout(readingNavigationTimerRef.current);
      readingNavigationTimerRef.current = null;
    }
    if (readingNavigationReleaseTimerRef.current !== null) {
      window.clearTimeout(readingNavigationReleaseTimerRef.current);
      readingNavigationReleaseTimerRef.current = null;
    }
    readingIntentionalNavigationRef.current = false;
    readingNavigationTargetRef.current = null;
    readingRestoreInProgressRef.current = false;
    readingRestoreExpectedScrollTopRef.current = null;
    readingRestoreProtectPendingRef.current = false;
    pendingReadingLayoutAnchorRef.current = null;
  }, []);
  const documentEditorHeadings = useMemo(() => editorHeadings(content), [content]);
  const persianReviewIssues = useMemo(
    () => analyzePersianMarkdown(content),
    [content],
  );
  const mermaidBlocks = useMemo(() => findMermaidBlocks(content), [content]);
  const imageAssetsById = useMemo(
    () => new Map(imageAssets.map((asset) => [asset.id, asset])),
    [imageAssets],
  );
  const documentTextDirection = useMemo(
    () => detectDocumentTextDirection(content),
    [content],
  );
  const blockTextDirection = useCallback(
    (children: ReactNode) =>
      detectBlockTextDirection(children, documentTextDirection),
    [documentTextDirection],
  );

  const commitTheme = useCallback((nextTheme: ThemeMode) => {
    setThemeMode(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The theme still applies for this session when storage is unavailable.
    }
  }, []);

  const toggleTheme = useCallback(() => {
    if (themeTransition) return;

    const nextTheme: ThemeMode =
      themeMode === "light" ? "dark" : "light";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      commitTheme(nextTheme);
      return;
    }

    document.documentElement.classList.add("theme-is-changing");
    setThemeTransition(nextTheme === "dark" ? "to-dark" : "to-light");
    themeCommitTimerRef.current = window.setTimeout(
      () => commitTheme(nextTheme),
      170,
    );
    themeFinishTimerRef.current = window.setTimeout(
      () => {
        document.documentElement.classList.remove("theme-is-changing");
        setThemeTransition(null);
      },
      520,
    );
  }, [commitTheme, themeMode, themeTransition]);

  useEffect(() => {
    const initialTheme =
      document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    const frame = window.requestAnimationFrame(() =>
      setThemeMode(initialTheme),
    );
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(
    () => () => {
      if (themeCommitTimerRef.current) {
        window.clearTimeout(themeCommitTimerRef.current);
      }
      if (themeFinishTimerRef.current) {
        window.clearTimeout(themeFinishTimerRef.current);
      }
      document.documentElement.classList.remove("theme-is-changing");
    },
    [],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const savedLayout = window.localStorage.getItem(
          PANE_LAYOUT_STORAGE_KEY,
        );
        if (savedLayout) {
          const parsed = JSON.parse(savedLayout) as {
            mode?: DesktopPaneMode;
            previewPercent?: number;
          };
          if (
            parsed.mode === "split" ||
            parsed.mode === "editor" ||
            parsed.mode === "preview"
          ) {
            setDesktopPaneMode(parsed.mode);
          }
          if (typeof parsed.previewPercent === "number") {
            const savedPercent = Math.min(
              90,
              Math.max(
                10,
                Math.round(parsed.previewPercent * 10) / 10,
              ),
            );
            lastExpandedPreviewPercentRef.current = savedPercent;
            setPreviewPanePercent(savedPercent);
          }
        }
      } catch {
        // A balanced split is a safe fallback when layout storage is invalid.
      } finally {
        setPaneLayoutHydrated(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!paneLayoutHydrated) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          PANE_LAYOUT_STORAGE_KEY,
          JSON.stringify({
            mode: desktopPaneMode,
            previewPercent: previewPanePercent,
          }),
        );
      } catch {
        // The layout remains usable for this session without persistence.
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [desktopPaneMode, paneLayoutHydrated, previewPanePercent]);

  const alignScrollPanes = useCallback((sourcePane: ScrollPane) => {
    const source =
      sourcePane === "editor"
        ? editorRef.current
        : previewScrollRef.current;
    const target =
      sourcePane === "editor"
        ? previewScrollRef.current
        : editorRef.current;

    if (
      !source ||
      !target ||
      source.clientHeight <= 0 ||
      target.clientHeight <= 0
    ) {
      return;
    }

    const sourceRange = source.scrollHeight - source.clientHeight;
    const targetRange = target.scrollHeight - target.clientHeight;
    const progress = sourceRange > 0 ? source.scrollTop / sourceRange : 0;
    const nextScrollTop = progress * Math.max(0, targetRange);

    if (Math.abs(target.scrollTop - nextScrollTop) < 1) return;

    scrollSyncTargetRef.current = {
      pane: sourcePane === "editor" ? "preview" : "editor",
      scrollTop: nextScrollTop,
    };
    target.scrollTop = nextScrollTop;
  }, []);

  const handleSyncedScroll = useCallback(
    (sourcePane: ScrollPane) => {
      lastScrolledPaneRef.current = sourcePane;
      if (!scrollSyncEnabled || desktopPaneMode !== "split") return;

      const guardedTarget = scrollSyncTargetRef.current;
      if (guardedTarget?.pane === sourcePane) {
        const source =
          sourcePane === "editor"
            ? editorRef.current
            : previewScrollRef.current;
        scrollSyncTargetRef.current = null;
        if (
          source &&
          Math.abs(source.scrollTop - guardedTarget.scrollTop) < 1
        ) {
          return;
        }
      }

      pendingScrollSourceRef.current = sourcePane;
      if (scrollSyncFrameRef.current !== null) return;

      scrollSyncFrameRef.current = window.requestAnimationFrame(() => {
        const pendingSource = pendingScrollSourceRef.current;
        scrollSyncFrameRef.current = null;
        pendingScrollSourceRef.current = null;
        if (pendingSource) alignScrollPanes(pendingSource);
      });
    },
    [alignScrollPanes, desktopPaneMode, scrollSyncEnabled],
  );

  const toggleScrollSync = useCallback(() => {
    const nextEnabled = !scrollSyncEnabled;
    setScrollSyncEnabled(nextEnabled);
    scrollSyncTargetRef.current = null;

    if (nextEnabled) {
      window.requestAnimationFrame(() => {
        alignScrollPanes(lastScrolledPaneRef.current);
      });
    }
  }, [alignScrollPanes, scrollSyncEnabled]);

  const setPaneCandidate = useCallback((pane: ScrollPane | null) => {
    setPaneCollapseCandidate(pane);
  }, []);

  const focusDesktopPane = useCallback((pane: ScrollPane) => {
    window.requestAnimationFrame(() => {
      if (pane === "editor") {
        editorRef.current?.focus();
      } else {
        previewArticleRef.current?.focus({ preventScroll: true });
      }
    });
  }, []);

  const clearPaneTransientUi = useCallback(() => {
    setEditorSelectionMenuPosition(null);
    setSelectionDraft(null);
    setSelectionHighlightRects([]);
    setSelectionMenuPosition(null);
    setComposerKind(null);
    setComposerText("");
    setHoverPreview(null);
    selectionReadingAnchorRef.current = null;
    window.getSelection()?.removeAllRanges();
  }, []);

  const collapseDesktopPane = useCallback(
    (pane: ScrollPane) => {
      clearPaneTransientUi();
      setPaneDragging(false);
      setPaneCandidate(null);
      setPreviewPanePercent(lastExpandedPreviewPercentRef.current);
      setDesktopPaneMode(pane === "preview" ? "editor" : "preview");
      focusDesktopPane(pane === "preview" ? "editor" : "preview");
    },
    [clearPaneTransientUi, focusDesktopPane, setPaneCandidate],
  );

  const restoreDesktopPanes = useCallback(
    (focusPane: ScrollPane) => {
      setPreviewPanePercent(lastExpandedPreviewPercentRef.current);
      setDesktopPaneMode("split");
      setPaneDragging(false);
      setPaneCandidate(null);
      focusDesktopPane(focusPane);
      window.requestAnimationFrame(() => {
        if (scrollSyncEnabled) {
          alignScrollPanes(lastScrolledPaneRef.current);
        }
      });
    },
    [
      alignScrollPanes,
      focusDesktopPane,
      scrollSyncEnabled,
      setPaneCandidate,
    ],
  );

  const panePercentFromClientX = useCallback((clientX: number) => {
    const workspace = workspaceRef.current;
    if (!workspace) return 50;

    const bounds = workspace.getBoundingClientRect();
    const styles = window.getComputedStyle(workspace);
    const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
    const availableWidth = Math.max(
      1,
      bounds.width - paddingLeft - paddingRight - PANE_SPINE_WIDTH,
    );
    return (
      ((clientX - bounds.left - paddingLeft) / availableWidth) * 100
    );
  }, []);

  const updatePaneSplitFromPointer = useCallback(
    (clientX: number) => {
      const rawPercent = panePercentFromClientX(clientX);
      const candidate =
        rawPercent <= PANE_COLLAPSE_THRESHOLD
          ? "preview"
          : rawPercent >= 100 - PANE_COLLAPSE_THRESHOLD
            ? "editor"
            : null;
      setPaneCandidate(candidate);
      const nextPercent = Math.min(
        100 - PANE_COLLAPSE_THRESHOLD,
        Math.max(PANE_COLLAPSE_THRESHOLD, rawPercent),
      );
      if (!candidate) {
        lastExpandedPreviewPercentRef.current = nextPercent;
      }
      setPreviewPanePercent(nextPercent);
      return candidate;
    },
    [panePercentFromClientX, setPaneCandidate],
  );

  const handlePaneResizePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (
        desktopPaneMode !== "split" ||
        readingMode ||
        (event.pointerType === "mouse" && event.button !== 0)
      ) {
        return;
      }
      event.preventDefault();
      clearPaneTransientUi();
      const pointerId = event.pointerId;
      const resizeHandle = event.currentTarget;
      setPaneDragging(true);
      updatePaneSplitFromPointer(event.clientX);

      const cleanup = () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
        paneDragCleanupRef.current = null;
      };
      const finish = (clientX: number, cancel = false) => {
        cleanup();
        if (
          resizeHandle.hasPointerCapture?.(pointerId)
        ) {
          resizeHandle.releasePointerCapture(pointerId);
        }
        setPaneDragging(false);

        if (cancel) {
          setPaneCandidate(null);
          return;
        }

        const candidate = updatePaneSplitFromPointer(clientX);
        if (candidate) {
          collapseDesktopPane(candidate);
        } else {
          setDesktopPaneMode("split");
          setPaneCandidate(null);
        }
      };
      function handlePointerMove(pointerEvent: PointerEvent) {
        if (pointerEvent.pointerId !== pointerId) return;
        pointerEvent.preventDefault();
        updatePaneSplitFromPointer(pointerEvent.clientX);
      }
      function handlePointerUp(pointerEvent: PointerEvent) {
        if (pointerEvent.pointerId !== pointerId) return;
        finish(pointerEvent.clientX);
      }
      function handlePointerCancel(pointerEvent: PointerEvent) {
        if (pointerEvent.pointerId !== pointerId) return;
        finish(pointerEvent.clientX, true);
      }

      paneDragCleanupRef.current?.();
      paneDragCleanupRef.current = cleanup;
      window.addEventListener("pointermove", handlePointerMove, {
        passive: false,
      });
      window.addEventListener("pointerup", handlePointerUp);
      window.addEventListener("pointercancel", handlePointerCancel);
      try {
        resizeHandle.setPointerCapture(pointerId);
      } catch {
        // Window listeners still keep the drag reliable without pointer capture.
      }
    },
    [
      clearPaneTransientUi,
      collapseDesktopPane,
      desktopPaneMode,
      readingMode,
      setPaneCandidate,
      updatePaneSplitFromPointer,
    ],
  );

  useEffect(
    () => () => {
      paneDragCleanupRef.current?.();
    },
    [],
  );

  const handlePaneResizeKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      let nextPercent = previewPanePercent;
      if (event.key === "ArrowLeft") {
        nextPercent -= 5;
      } else if (event.key === "ArrowRight") {
        nextPercent += 5;
      } else if (event.key === "Home") {
        nextPercent = PANE_COLLAPSE_THRESHOLD;
      } else if (event.key === "End") {
        nextPercent = 100 - PANE_COLLAPSE_THRESHOLD;
      } else if (event.key === "Enter") {
        event.preventDefault();
        lastExpandedPreviewPercentRef.current = 50;
        setPreviewPanePercent(50);
        setPaneCandidate(null);
        return;
      } else {
        return;
      }

      event.preventDefault();
      if (nextPercent <= PANE_COLLAPSE_THRESHOLD) {
        collapseDesktopPane("preview");
      } else if (
        nextPercent >=
        100 - PANE_COLLAPSE_THRESHOLD
      ) {
        collapseDesktopPane("editor");
      } else {
        lastExpandedPreviewPercentRef.current = nextPercent;
        setPreviewPanePercent(nextPercent);
        setPaneCandidate(null);
      }
    },
    [
      collapseDesktopPane,
      previewPanePercent,
      setPaneCandidate,
    ],
  );

  const focusReadingHeading = (documentIndex: number) => {
    const heading = previewArticleRef.current?.querySelectorAll<HTMLElement>(
      "h1, h2, h3, h4, h5, h6",
    )[documentIndex];
    if (!heading) return;

    cancelReadingRestoreWork();
    readingIntentionalNavigationRef.current = true;
    readingNavigationTargetRef.current = {
      element: heading,
      placement: "start",
    };
    setActiveReadingHeadingIndex(documentIndex);
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scrollReadingElement(
      heading,
      reducedMotion ? "auto" : "smooth",
      "start",
    );
    if (readingNavigationTimerRef.current !== null) {
      window.clearTimeout(readingNavigationTimerRef.current);
    }
    readingNavigationTimerRef.current = window.setTimeout(
      () => {
        readingNavigationTimerRef.current = null;
        if (heading.isConnected) {
          scrollReadingElement(heading, "auto", "start");
        }
        readingNavigationReleaseTimerRef.current = window.setTimeout(() => {
          readingNavigationReleaseTimerRef.current = null;
          readingIntentionalNavigationRef.current = false;
          readingNavigationTargetRef.current = null;
          scheduleReadingPositionCommit(0);
        }, 900);
      },
      reducedMotion ? 80 : 560,
    );
  };

  useEffect(
    () => () => {
      if (scrollSyncFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollSyncFrameRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    if (!scrollSyncEnabled || desktopPaneMode !== "split") return;

    const frame = window.requestAnimationFrame(() => {
      alignScrollPanes(lastScrolledPaneRef.current);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    alignScrollPanes,
    annotationPanelOpen,
    content,
    desktopPaneMode,
    readerSize,
    scrollSyncEnabled,
  ]);

  useEffect(() => {
    if (!readingMode) return;
    const scrollRoot = workspaceRef.current;
    if (!scrollRoot) return;

    const markUserScrollIntent = (event: Event) => {
      readingUserInteractionUntilRef.current = performance.now() + 260;
      selectionScrollRestoreRequestRef.current += 1;
      if (
        event.type === "pointerdown" &&
        event instanceof PointerEvent &&
        event.target instanceof Element &&
        event.target.closest(".markdown-body")
      ) {
        selectionStartScrollRef.current = {
          documentKey: readingDocumentStateRef.current.documentKey,
          root: scrollRoot,
          top:
            scrollRoot === document.scrollingElement
              ? window.scrollY
              : scrollRoot.scrollTop,
          request: selectionScrollRestoreRequestRef.current,
        };
        const boundary = caretBoundaryFromPoint(event.clientX, event.clientY);
        const article = previewArticleRef.current;
        selectionPointerStartRef.current =
          boundary && article?.contains(boundary.node)
            ? {
                documentKey: readingDocumentStateRef.current.documentKey,
                ...boundary,
              }
            : null;
      }
      cancelReadingRestoreWork();
    };
    const handleReadingKey = (event: KeyboardEvent) => {
      if (
        ![
          "ArrowDown",
          "ArrowUp",
          "PageDown",
          "PageUp",
          "Home",
          "End",
          " ",
        ].includes(event.key)
      ) {
        return;
      }
      if (
        event.target instanceof HTMLElement &&
        event.target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      markUserScrollIntent(event);
    };

    scrollRoot.addEventListener("wheel", markUserScrollIntent, {
      capture: true,
      passive: true,
    });
    scrollRoot.addEventListener("touchstart", markUserScrollIntent, {
      capture: true,
      passive: true,
    });
    scrollRoot.addEventListener("pointerdown", markUserScrollIntent, true);
    document.addEventListener("keydown", handleReadingKey, true);

    return () => {
      scrollRoot.removeEventListener("wheel", markUserScrollIntent, true);
      scrollRoot.removeEventListener("touchstart", markUserScrollIntent, true);
      scrollRoot.removeEventListener("pointerdown", markUserScrollIntent, true);
      document.removeEventListener("keydown", handleReadingKey, true);
    };
  }, [cancelReadingRestoreWork, readingMode]);

  useEffect(() => {
    if (!readingMode) return;

    const scrollRoot = workspaceRef.current;
    if (!scrollRoot) return;

    const currentScrollTop = () =>
      scrollRoot.scrollHeight - scrollRoot.clientHeight > 1
        ? scrollRoot.scrollTop
        : window.scrollY;

    readingLastScrollTopRef.current = currentScrollTop();

    const updateHeaderVisibility = () => {
      readingHeaderFrameRef.current = null;
      const nextScrollTop = currentScrollTop();
      const previousScrollTop = readingLastScrollTopRef.current;
      const delta = nextScrollTop - previousScrollTop;

      if (
        readingRestoreInProgressRef.current ||
        readingRestoreProtectPendingRef.current ||
        performance.now() > readingUserInteractionUntilRef.current
      ) {
        readingLastScrollTopRef.current = nextScrollTop;
        return;
      }

      if (nextScrollTop <= 24 || delta <= -4) {
        setReadingHeaderVisible(true);
      } else if (nextScrollTop >= 88 && delta >= 4) {
        setReadingHeaderVisible(false);
      }

      readingLastScrollTopRef.current = nextScrollTop;
    };

    const scheduleHeaderUpdate = () => {
      if (readingHeaderFrameRef.current !== null) return;
      readingHeaderFrameRef.current = window.requestAnimationFrame(
        updateHeaderVisibility,
      );
    };

    scrollRoot.addEventListener("scroll", scheduleHeaderUpdate, {
      passive: true,
    });
    window.addEventListener("scroll", scheduleHeaderUpdate, {
      passive: true,
    });

    return () => {
      scrollRoot.removeEventListener("scroll", scheduleHeaderUpdate);
      window.removeEventListener("scroll", scheduleHeaderUpdate);
      if (readingHeaderFrameRef.current !== null) {
        window.cancelAnimationFrame(readingHeaderFrameRef.current);
        readingHeaderFrameRef.current = null;
      }
    };
  }, [readingMode]);

  useEffect(() => {
    if (!readingMode) return;

    const scrollRoot = workspaceRef.current;
    const article = previewArticleRef.current;
    if (!scrollRoot || !article) return;
    const usesWindowScroll =
      scrollRoot.scrollHeight - scrollRoot.clientHeight <= 1;
    const scrollTarget: HTMLElement | Window = usesWindowScroll
      ? window
      : scrollRoot;

    const updateActiveHeading = () => {
      readingOutlineFrameRef.current = null;
      const renderedHeadings =
        article.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
      const rootRect = usesWindowScroll
        ? { top: 0, height: window.innerHeight }
        : scrollRoot.getBoundingClientRect();
      const threshold = rootRect.top + Math.min(150, rootRect.height * 0.2);
      let nextIndex = readingHeadings[0]?.documentIndex ?? -1;

      for (const heading of readingHeadings) {
        const renderedHeading = renderedHeadings[heading.documentIndex];
        if (!renderedHeading) continue;
        if (renderedHeading.getBoundingClientRect().top <= threshold) {
          nextIndex = heading.documentIndex;
        } else {
          break;
        }
      }

      setActiveReadingHeadingIndex((current) =>
        current === nextIndex ? current : nextIndex,
      );
    };

    const scheduleUpdate = () => {
      if (readingOutlineFrameRef.current !== null) return;
      readingOutlineFrameRef.current =
        window.requestAnimationFrame(updateActiveHeading);
    };

    scrollTarget.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();

    return () => {
      scrollTarget.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (readingOutlineFrameRef.current !== null) {
        window.cancelAnimationFrame(readingOutlineFrameRef.current);
        readingOutlineFrameRef.current = null;
      }
    };
  }, [readingHeadings, readingMode, readerSize]);

  useEffect(() => {
    readingPositionsRef.current = readingPositions;
  }, [readingPositions]);

  const getReadingScrollContext = useCallback(() => {
    const article = previewArticleRef.current;
    const workspace = workspaceRef.current;
    const previewScroll = previewScrollRef.current;
    if (!article || !workspace || !previewScroll) return null;

    const isReading = Boolean(document.querySelector(".app-shell.is-reading"));
    if (!isReading) return { article, root: previewScroll };

    const workspaceCanScroll =
      workspace.scrollHeight - workspace.clientHeight > 1;
    const documentRoot = document.scrollingElement;
    return {
      article,
      root:
        workspaceCanScroll || !(documentRoot instanceof HTMLElement)
          ? workspace
          : documentRoot,
    };
  }, []);

  const scrollReadingElement = useCallback(
    (
      element: HTMLElement,
      behavior: ScrollBehavior,
      placement: "start" | "center",
    ) => {
      const context = getReadingScrollContext();
      if (!context) return;
      const root = context.root;
      const rootRect =
        root === document.scrollingElement
          ? { top: 0, height: window.innerHeight }
          : root.getBoundingClientRect();
      const desiredTop =
        placement === "center"
          ? rootRect.top + rootRect.height * 0.42
          : rootRect.top + Math.min(132, rootRect.height * 0.18);
      const currentScrollTop =
        root === document.scrollingElement ? window.scrollY : root.scrollTop;
      const nextScrollTop =
        currentScrollTop + element.getBoundingClientRect().top - desiredTop;
      if (root === document.scrollingElement) {
        window.scrollTo({ top: nextScrollTop, behavior });
      } else {
        root.scrollTo({ top: nextScrollTop, behavior });
      }
    },
    [getReadingScrollContext],
  );

  const captureCurrentReadingPosition = useCallback(
    (viewMode?: ReadingViewMode) => {
      if (readingCaptureSuspendedRef.current) return null;
      const context = getReadingScrollContext();
      const viewport = context ? captureReadingViewport(context) : null;
      if (!viewport) return null;
      const documentState = readingDocumentStateRef.current;
      const currentMode = viewMode ??
        (document.querySelector(".app-shell.is-reading")
          ? "reading"
          : "desk");
      return {
        version: READING_POSITION_VERSION,
        documentKey: documentState.documentKey,
        contentSignature: documentState.contentSignature,
        viewMode: currentMode,
        ...viewport,
        readerSize: documentState.readerSize,
        outlineOpen: documentState.outlineOpen,
        updatedAt: Date.now(),
      } satisfies ReadingPositionRecord;
    },
    [getReadingScrollContext],
  );

  const commitReadingPosition = useCallback((record: ReadingPositionRecord) => {
    if (
      record.documentKey !== readingDocumentStateRef.current.documentKey
    ) {
      return;
    }
    const next = upsertReadingPosition(readingPositionsRef.current, record);
    readingPositionsRef.current = next;
    lastReadingAnchorRef.current = record;
    setReadingPositions(next);
    void window.raaviDesktop?.saveReadingPositions(next).catch(() => {});
  }, []);

  const scheduleReadingPositionCommit = useCallback(
    (delay = 220) => {
      if (readingPositionTimerRef.current !== null) {
        window.clearTimeout(readingPositionTimerRef.current);
      }
      const documentEpoch = readingDocumentEpochRef.current;
      const documentKey = readingDocumentStateRef.current.documentKey;
      readingPositionTimerRef.current = window.setTimeout(() => {
        readingPositionTimerRef.current = null;
        if (
          documentEpoch !== readingDocumentEpochRef.current ||
          documentKey !== readingDocumentStateRef.current.documentKey
        ) {
          return;
        }
        const record = captureCurrentReadingPosition();
        if (record?.documentKey === documentKey) commitReadingPosition(record);
      }, delay);
    },
    [captureCurrentReadingPosition, commitReadingPosition],
  );

  const scheduleReadingRestore = useCallback(
    (
      record: ReadingPositionRecord,
      options: {
        announce?: boolean;
        retries?: number;
        protectPending?: boolean;
        settle?: boolean;
      } = {},
    ) => {
      if (
        record.documentKey !== readingDocumentStateRef.current.documentKey
      ) {
        return;
      }
      const request = readingRestoreRequestRef.current + 1;
      readingRestoreRequestRef.current = request;
      const documentEpoch = readingDocumentEpochRef.current;
      const documentKey = record.documentKey;
      const requestIsCurrent = () =>
        request === readingRestoreRequestRef.current &&
        documentEpoch === readingDocumentEpochRef.current &&
        documentKey === readingDocumentStateRef.current.documentKey;
      if (readingRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(readingRestoreFrameRef.current);
      }
      if (readingRestoreTimerRef.current !== null) {
        window.clearTimeout(readingRestoreTimerRef.current);
      }
      readingRestoreProtectPendingRef.current = Boolean(
        options.protectPending,
      );

      const retries = options.retries ?? 8;
      const settleRestore = Boolean(options.announce || options.settle);
      const startedAt = performance.now();
      let stableLayoutSamples = 0;
      let previousLayoutSignature = "";
      let latestCaptured: ReadingPositionRecord | null = null;
      let anchorWasVerified = false;

      const readLayoutState = (context: ReadingScrollContext) => {
        const article = context.article;
        const rootBounds =
          context.root === document.scrollingElement
            ? { top: 0, bottom: window.innerHeight, height: window.innerHeight }
            : context.root.getBoundingClientRect();
        const vicinity = Math.max(rootBounds.height, window.innerHeight) * 2;
        const pendingImages = Array.from(article.querySelectorAll("img")).filter(
          (image) => {
            const bounds = image.getBoundingClientRect();
            const isNearViewport =
              bounds.bottom >= rootBounds.top - vicinity &&
              bounds.top <= rootBounds.bottom + vicinity;
            return isNearViewport && !image.complete;
          },
        ).length;
        const pendingDiagrams = article.querySelectorAll(
          ".mermaid-diagram-canvas[aria-busy='true']",
        ).length;
        const articleBounds = article.getBoundingClientRect();
        return {
          pending: pendingImages + pendingDiagrams,
          signature: [
            Math.round(articleBounds.height),
            article.scrollHeight,
            context.root.scrollHeight,
            pendingImages,
            pendingDiagrams,
          ].join(":"),
        };
      };

      const finish = (precision: "exact" | "near") => {
        if (!requestIsCurrent()) return;
        readingRestoreTimerRef.current = null;
        readingRestoreProtectPendingRef.current = false;
        readingRestoreInProgressRef.current = false;
        readingRestoreExpectedScrollTopRef.current = null;
        const finalRecord = latestCaptured ?? record;
        lastReadingAnchorRef.current = finalRecord;
        commitReadingPosition(finalRecord);
        if (options.announce && record.fallbackProgress > 0.01) {
          const label =
            record.anchor.headingPath.at(-1) ||
            record.anchor.textPrefix.slice(0, 56) ||
            "جای قبلی مطالعه";
          setReadingResumeNotice({
            documentKey: record.documentKey,
            label,
            precision,
            record,
          });
        }
      };

      const run = (attempt: number) => {
        if (!requestIsCurrent()) return;
        if (readingCaptureSuspendedRef.current) {
          readingRestoreTimerRef.current = window.setTimeout(
            () => run(attempt),
            16,
          );
          return;
        }
        const context = getReadingScrollContext();
        if (!context) return;
        readingRestoreInProgressRef.current = true;
        const restoreResult = restoreReadingViewport(
          context,
          record,
          readingDocumentStateRef.current.contentSignature,
        );
        readingRestoreExpectedScrollTopRef.current =
          context.root === document.scrollingElement
            ? window.scrollY
            : context.root.scrollTop;
        readingRestoreFrameRef.current = window.requestAnimationFrame(() => {
          readingRestoreFrameRef.current = null;
          if (!requestIsCurrent()) return;
          const captured = captureCurrentReadingPosition();
          if (captured?.documentKey === documentKey) {
            latestCaptured = captured;
            anchorWasVerified =
              anchorWasVerified ||
              readingAnchorsMatch(record.anchor, captured.anchor);
          }
          const layout = readLayoutState(context);
          stableLayoutSamples =
            layout.signature === previousLayoutSignature
              ? stableLayoutSamples + 1
              : 0;
          previousLayoutSignature = layout.signature;
          readingRestoreInProgressRef.current = false;
          readingRestoreExpectedScrollTopRef.current = null;
          const elapsed = performance.now() - startedAt;
          const layoutSettled =
            !settleRestore ||
            (elapsed >= 420 && layout.pending === 0 && stableLayoutSamples >= 2);
          const timedOut = settleRestore && elapsed >= 5000;
          const exhausted = !settleRestore && attempt + 1 >= retries;

          if (layoutSettled || timedOut || exhausted) {
            const exact =
              anchorWasVerified &&
              restoreResult.match !== "progress" &&
              restoreResult.match !== "none";
            finish(exact ? "exact" : "near");
            return;
          }

          readingRestoreTimerRef.current = window.setTimeout(
            () => requestIsCurrent() && run(attempt + 1),
            options.settle && elapsed < 600
              ? 16
              : settleRestore
              ? attempt === 0
                ? 60
                : 120
              : attempt + 2 === retries
                ? 100
                : attempt === 0
                  ? 16
                  : 12,
          );
        });
      };

      readingRestoreFrameRef.current = window.requestAnimationFrame(() => {
        if (!requestIsCurrent()) return;
        readingRestoreFrameRef.current = window.requestAnimationFrame(() => {
          if (!requestIsCurrent()) return;
          readingRestoreFrameRef.current = null;
          run(0);
        });
      });
    },
    [
      captureCurrentReadingPosition,
      commitReadingPosition,
      getReadingScrollContext,
    ],
  );

  const preserveReadingViewport = useCallback(
    (
      change: () => void,
      options?: {
        retries?: number;
        anchor?: ReadingPositionRecord | null;
        settle?: boolean;
      },
    ) => {
      const anchor =
        options?.anchor ??
        captureCurrentReadingPosition() ??
        lastReadingAnchorRef.current;
      if (anchor) {
        lastReadingAnchorRef.current = anchor;
        pendingReadingLayoutAnchorRef.current = anchor;
      }
      change();
      if (anchor) {
        scheduleReadingRestore(anchor, {
          retries: options?.retries ?? 3,
          protectPending: true,
          settle: options?.settle,
        });
      }
    },
    [captureCurrentReadingPosition, scheduleReadingRestore],
  );

  const restoreComposerReadingViewport = useCallback(() => {
    if (!readingMode) return;
    const anchor = selectionReadingAnchorRef.current;
    const context = getReadingScrollContext();
    if (
      !anchor ||
      !context ||
      anchor.documentKey !== readingDocumentStateRef.current.documentKey
    ) {
      return;
    }

    readingRestoreInProgressRef.current = true;
    restoreReadingViewport(
      context,
      anchor,
      readingDocumentStateRef.current.contentSignature,
    );
    readingRestoreExpectedScrollTopRef.current =
      context.root === document.scrollingElement
        ? window.scrollY
        : context.root.scrollTop;
    const captured = captureCurrentReadingPosition();
    if (captured) lastReadingAnchorRef.current = captured;
  }, [
    captureCurrentReadingPosition,
    getReadingScrollContext,
    readingMode,
  ]);

  const handleDiagramFullscreenChange = useCallback(
    (fullscreen: boolean) => {
      if (!readingMode) return;
      if (fullscreen) {
        const context = getReadingScrollContext();
        diagramReadingAnchorRef.current = {
          record:
            captureCurrentReadingPosition() ?? lastReadingAnchorRef.current,
          documentKey: readingDocumentStateRef.current.documentKey,
          root: context?.root ?? null,
          scrollTop: context
            ? context.root === document.scrollingElement
              ? window.scrollY
              : context.root.scrollTop
            : 0,
        };
        return;
      }
      const snapshot = diagramReadingAnchorRef.current;
      diagramReadingAnchorRef.current = null;
      if (!snapshot) return;

      const restoreExactScroll = () => {
        if (
          snapshot.documentKey !==
          readingDocumentStateRef.current.documentKey
        ) {
          return;
        }
        const root = snapshot.root ?? getReadingScrollContext()?.root;
        if (!root) return;
        readingRestoreInProgressRef.current = true;
        readingRestoreExpectedScrollTopRef.current = snapshot.scrollTop;
        if (root === document.scrollingElement) {
          window.scrollTo({ top: snapshot.scrollTop, behavior: "auto" });
        } else if (root.isConnected) {
          root.scrollTop = snapshot.scrollTop;
        }
      };

      restoreExactScroll();
      if (snapshot.record) {
        scheduleReadingRestore(snapshot.record, {
          retries: 4,
          protectPending: true,
          settle: true,
        });
      }

      let exactRestoreFramesRemaining = 8;
      const holdExactScrollThroughFullscreenExit = () => {
        restoreExactScroll();
        exactRestoreFramesRemaining -= 1;
        if (exactRestoreFramesRemaining > 0) {
          window.requestAnimationFrame(holdExactScrollThroughFullscreenExit);
          return;
        }
        const captured = captureCurrentReadingPosition();
        if (captured) lastReadingAnchorRef.current = captured;
      };
      window.requestAnimationFrame(holdExactScrollThroughFullscreenExit);
    },
    [
      captureCurrentReadingPosition,
      getReadingScrollContext,
      readingMode,
      scheduleReadingRestore,
    ],
  );

  useLayoutEffect(() => {
    const anchor = pendingReadingLayoutAnchorRef.current;
    if (!anchor) return;
    if (
      anchor.documentKey !== readingDocumentStateRef.current.documentKey
    ) {
      pendingReadingLayoutAnchorRef.current = null;
      return;
    }
    const context = getReadingScrollContext();
    if (!context) return;

    readingRestoreInProgressRef.current = true;
    restoreReadingViewport(
      context,
      anchor,
      readingDocumentStateRef.current.contentSignature,
    );
    readingRestoreExpectedScrollTopRef.current =
      context.root === document.scrollingElement
        ? window.scrollY
        : context.root.scrollTop;
    pendingReadingLayoutAnchorRef.current = null;
    const captured = captureCurrentReadingPosition();
    if (captured) lastReadingAnchorRef.current = captured;
  }, [
    annotationPanelOpen,
    captureCurrentReadingPosition,
    composerKind,
    desktopPaneMode,
    getReadingScrollContext,
    libraryOpen,
    mobilePane,
    readerSize,
    readingMode,
    readingOutlineOpen,
  ]);

  const startReadingAtBeginning = () => {
    const context = getReadingScrollContext();
    if (!context) return;
    cancelReadingRestoreWork();
    readingIntentionalNavigationRef.current = true;
    if (context.root === document.scrollingElement) {
      window.scrollTo({ top: 0, behavior: "auto" });
    } else {
      context.root.scrollTop = 0;
    }
    setReadingResumeNotice(null);
    readingNavigationTimerRef.current = window.setTimeout(() => {
      readingNavigationTimerRef.current = null;
      readingIntentionalNavigationRef.current = false;
      scheduleReadingPositionCommit(0);
    }, 80);
    previewArticleRef.current?.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!hydrated) return;
    const context = getReadingScrollContext();
    if (!context) return;
    const root = context.root;

    const rememberVisibleAnchor = () => {
      if (readingCaptureSuspendedRef.current) return;
      if (
        readingRestoreProtectPendingRef.current &&
        (readingRestoreFrameRef.current !== null ||
          readingRestoreTimerRef.current !== null)
      ) {
        return;
      }
      const currentScrollTop =
        root === document.scrollingElement ? window.scrollY : root.scrollTop;
      const expectedScrollTop = readingRestoreExpectedScrollTopRef.current;
      if (
        readingRestoreInProgressRef.current &&
        expectedScrollTop === null
      ) {
        return;
      }
      if (
        readingRestoreInProgressRef.current &&
        expectedScrollTop !== null &&
        Math.abs(currentScrollTop - expectedScrollTop) < 2
      ) {
        return;
      }
      readingRestoreInProgressRef.current = false;
      readingRestoreExpectedScrollTopRef.current = null;
      readingRestoreProtectPendingRef.current = false;
      if (readingRestoreFrameRef.current !== null) {
        window.cancelAnimationFrame(readingRestoreFrameRef.current);
        readingRestoreFrameRef.current = null;
      }
      if (readingRestoreTimerRef.current) {
        window.clearTimeout(readingRestoreTimerRef.current);
        readingRestoreTimerRef.current = null;
      }
      const record = captureCurrentReadingPosition();
      if (record) lastReadingAnchorRef.current = record;
      scheduleReadingPositionCommit();
    };
    const preserveAcrossResize = () => {
      const anchor =
        lastReadingAnchorRef.current ?? captureCurrentReadingPosition();
      if (anchor) {
        scheduleReadingRestore(anchor, { protectPending: true });
      }
    };
    const flushWhenHidden = () => {
      if (document.visibilityState !== "hidden") return;
      const record = readingRestoreProtectPendingRef.current
        ? lastReadingAnchorRef.current
        : captureCurrentReadingPosition();
      if (record) commitReadingPosition(record);
    };

    root.addEventListener("scroll", rememberVisibleAnchor, { passive: true });
    if (root !== document.scrollingElement) {
      window.addEventListener("scroll", rememberVisibleAnchor, {
        passive: true,
      });
    }
    window.addEventListener("resize", preserveAcrossResize);
    document.addEventListener("visibilitychange", flushWhenHidden);
    if (
      readingRestoreFrameRef.current === null &&
      !readingRestoreTimerRef.current
    ) {
      const initialRecord = captureCurrentReadingPosition();
      if (initialRecord) lastReadingAnchorRef.current = initialRecord;
      scheduleReadingPositionCommit();
    }

    return () => {
      root.removeEventListener("scroll", rememberVisibleAnchor);
      window.removeEventListener("scroll", rememberVisibleAnchor);
      window.removeEventListener("resize", preserveAcrossResize);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, [
    captureCurrentReadingPosition,
    commitReadingPosition,
    getReadingScrollContext,
    hydrated,
    mobilePane,
    readingMode,
    scheduleReadingPositionCommit,
    scheduleReadingRestore,
  ]);

  useEffect(() => {
    if (!hydrated) return;
    const article = previewArticleRef.current;
    if (!article) return;
    let previousHeight = article.getBoundingClientRect().height;

    const restoreAfterReflow = () => {
      if (readingCaptureSuspendedRef.current) return;
      if (
        readingRestoreProtectPendingRef.current &&
        (readingRestoreFrameRef.current !== null ||
          readingRestoreTimerRef.current !== null)
      ) {
        return;
      }
      if (readingIntentionalNavigationRef.current) {
        const target = readingNavigationTargetRef.current;
        if (target?.element.isConnected) {
          window.requestAnimationFrame(() => {
            if (
              readingIntentionalNavigationRef.current &&
              target === readingNavigationTargetRef.current
            ) {
              scrollReadingElement(target.element, "auto", target.placement);
            }
          });
        }
        return;
      }
      if (readingReflowTimerRef.current !== null) {
        window.clearTimeout(readingReflowTimerRef.current);
      }
      const documentEpoch = readingDocumentEpochRef.current;
      const documentKey = readingDocumentStateRef.current.documentKey;
      const delay = Math.max(
        72,
        readingUserInteractionUntilRef.current - performance.now() + 24,
      );
      readingReflowTimerRef.current = window.setTimeout(() => {
        readingReflowTimerRef.current = null;
        if (performance.now() <= readingUserInteractionUntilRef.current) {
          restoreAfterReflow();
          return;
        }
        if (
          documentEpoch !== readingDocumentEpochRef.current ||
          documentKey !== readingDocumentStateRef.current.documentKey ||
          readingIntentionalNavigationRef.current
        ) {
          return;
        }
        const anchor = lastReadingAnchorRef.current;
        if (
          anchor &&
          anchor.fallbackProgress > 0.01 &&
          anchor.documentKey === documentKey
        ) {
          scheduleReadingRestore(anchor, {
            retries: 1,
            protectPending: true,
          });
        }
      }, delay);
    };
    const handleMediaLoad = (event: Event) => {
      if (event.target instanceof HTMLImageElement) restoreAfterReflow();
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            const nextHeight = article.getBoundingClientRect().height;
            if (Math.abs(nextHeight - previousHeight) < 2) return;
            previousHeight = nextHeight;
            restoreAfterReflow();
          });

    article.addEventListener("load", handleMediaLoad, true);
    resizeObserver?.observe(article);
    void document.fonts?.ready.then(restoreAfterReflow).catch(() => {});
    return () => {
      article.removeEventListener("load", handleMediaLoad, true);
      resizeObserver?.disconnect();
      if (readingReflowTimerRef.current !== null) {
        window.clearTimeout(readingReflowTimerRef.current);
        readingReflowTimerRef.current = null;
      }
    };
  }, [content, hydrated, scheduleReadingRestore, scrollReadingElement]);

  const stats = useMemo(() => {
    const cleanText = content.trim();
    return {
      words: cleanText ? cleanText.split(/\s+/u).length : 0,
      lines: content.split(/\r?\n/u).length,
    };
  }, [content]);

  const annotationCounts = useMemo(
    () =>
      annotations.reduce(
        (counts, annotation) => {
          counts[annotation.kind] += 1;
          return counts;
        },
        { highlight: 0, comment: 0, margin: 0 } as Record<
          AnnotationKind,
          number
        >,
      ),
    [annotations],
  );

  const currentSnapshot = useMemo(
    () => documentSnapshot(content, annotations, imageAssets),
    [annotations, content, imageAssets],
  );
  const localDocumentSnapshot = useMemo<LocalDocumentSnapshot>(
    () => ({
      content,
      fileName,
      readerSize,
      annotations,
      assets: imageAssets,
      revision,
      versions: versions.slice(-MAX_LOCAL_VERSIONS),
      activeDocumentPath,
      documentType,
      lastSavedSnapshot,
      draftId: documentDraftId,
      viewMode: readingMode ? "reading" : "desk",
      readingOutlineOpen,
      readingPositions,
      annotationComposer:
        composerKind && selectionDraft
          ? { kind: composerKind, text: composerText, selection: selectionDraft }
          : null,
    }),
    [
      activeDocumentPath,
      annotations,
      content,
      composerKind,
      composerText,
      documentType,
      documentDraftId,
      fileName,
      imageAssets,
      lastSavedSnapshot,
      readerSize,
      readingMode,
      readingOutlineOpen,
      readingPositions,
      revision,
      selectionDraft,
      versions,
    ],
  );

  const effectiveSaveState: SaveState =
    saveState === "saving" || saveState === "error"
      ? saveState
      : currentSnapshot === lastSavedSnapshot
        ? "saved"
        : "dirty";

  const hoveredAnnotation = useMemo(
    () =>
      hoverPreview
        ? annotations.find(
            (annotation) => annotation.id === hoverPreview.annotationId,
          ) ?? null
        : null,
    [annotations, hoverPreview],
  );

  const visibleLibraryFiles = useMemo(() => {
    const query = libraryQuery.trim().toLocaleLowerCase("fa");
    if (!query) return libraryFiles;
    return libraryFiles.filter((file) =>
      file.path.toLocaleLowerCase("fa").includes(query),
    );
  }, [libraryFiles, libraryQuery]);

  const libraryTree = useMemo(
    () => buildLibraryTree(visibleLibraryFiles),
    [visibleLibraryFiles],
  );
  const pinnedLibraryKeySet = useMemo(
    () => new Set(pinnedLibraryKeys),
    [pinnedLibraryKeys],
  );
  const pinnedLibraryFiles = useMemo(() => {
    const filesByPinKey = new Map(
      libraryFiles.map((file) => [libraryPinKey(file), file]),
    );
    return pinnedLibraryKeys
      .map((key) => filesByPinKey.get(key))
      .filter((file): file is LibraryFile => Boolean(file));
  }, [libraryFiles, pinnedLibraryKeys]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const savedPins = window.localStorage.getItem(
          PINNED_LIBRARY_STORAGE_KEY,
        );
        if (savedPins) {
          const parsed = JSON.parse(savedPins) as unknown;
          if (Array.isArray(parsed)) {
            setPinnedLibraryKeys(
              Array.from(
                new Set(parsed.filter((key): key is string => typeof key === "string")),
              ).slice(0, 500),
            );
          }
        }
      } catch {
        // A fresh pin list is safer than blocking access to the library.
      } finally {
        setPinnedLibraryHydrated(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!pinnedLibraryHydrated) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          PINNED_LIBRARY_STORAGE_KEY,
          JSON.stringify(pinnedLibraryKeys),
        );
      } catch {
        setError(
          "سنجاق‌ها روی این دستگاه ذخیره نشدند؛ فضای ذخیره‌سازی مرورگر را بررسی کنید.",
        );
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [pinnedLibraryHydrated, pinnedLibraryKeys]);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = setTimeout(() => setNotice(""), 2400);
  }, []);

  const togglePinnedLibraryFile = useCallback(
    (file: LibraryFile) => {
      const key = libraryPinKey(file);
      const isPinned = pinnedLibraryKeySet.has(key);
      setPinnedLibraryKeys((current) =>
        isPinned
          ? current.filter((currentKey) => currentKey !== key)
          : [key, ...current.filter((currentKey) => currentKey !== key)].slice(
              0,
              500,
            ),
      );
      showNotice(
        isPinned
          ? `«${file.name}» از سنجاق‌شده‌ها برداشته شد.`
          : `«${file.name}» به سنجاق‌شده‌ها اضافه شد.`,
      );
    },
    [pinnedLibraryKeySet, showNotice],
  );

  const applyOpenedDocument = useCallback(
    (document: DesktopOpenedDocument, message?: string) => {
      const previousPosition = captureCurrentReadingPosition();
      if (previousPosition) commitReadingPosition(previousPosition);
      cancelReadingRestoreWork();
      readingCaptureSuspendedRef.current = true;
      readingDocumentEpochRef.current += 1;
      readingUserInteractionUntilRef.current = 0;

      const nextDraftId =
        document.draftId ?? createReadingDraftId();
      const nextDocumentKey = readingDocumentKey({
        activeDocumentPath: document.path ?? "",
        draftId: nextDraftId,
      });
      const savedPosition = readingPositionsRef.current[nextDocumentKey];
      const nextReadingMode = savedPosition
        ? savedPosition.viewMode === "reading"
        : Boolean(document.openInReadingMode);
      readingDocumentStateRef.current = {
        documentKey: nextDocumentKey,
        contentSignature: readingContentSignature(document.content),
        readerSize:
          savedPosition?.readerSize ??
          readingDocumentStateRef.current.readerSize,
        outlineOpen:
          savedPosition?.outlineOpen ??
          readingDocumentStateRef.current.outlineOpen,
      };
      lastReadingAnchorRef.current = savedPosition ?? null;
      selectionReadingAnchorRef.current = null;
      selectionStartScrollRef.current = null;

      openedDocumentRef.current = true;
      const nextAnnotations = document.annotations ?? [];
      const nextAssets = document.assets ?? [];
      setContent(document.content);
      setFileName(document.name);
      setAnnotations(nextAnnotations);
      setImageAssets(nextAssets);
      setActiveDocumentPath(document.path ?? "");
      setDocumentDraftId(nextDraftId);
      setDocumentType(document.documentType ?? "markdown");
      setRevision(document.revision ?? 1);
      setVersions(document.versions ?? []);
      setLastSavedSnapshot(
        documentSnapshot(document.content, nextAnnotations, nextAssets),
      );
      setSaveState("saved");
      setEditorSelectionMenuPosition(null);
      setSelectionDraft(null);
      setComposerKind(null);
      setComposerText("");
      setAnnotationPanelOpen(false);
      setActiveLibraryPath("");
      setMobileEditorToolsExpanded(false);
      setMobilePane("preview");
      setReadingMode(nextReadingMode);
      setReadingHeaderVisible(true);
      setReadingResumeNotice(null);
      if (savedPosition) {
        setReaderSize(savedPosition.readerSize);
        setReadingOutlineOpen(savedPosition.outlineOpen);
      }
      setShortcutHelpOpen(false);
      setSaveModalOpen(false);
      setNewDocumentModalOpen(false);
      if (nextReadingMode) {
        setLibraryOpen(false);
      } else if (!window.matchMedia("(max-width: 820px)").matches) {
        setLibraryOpen(true);
      }
      setError("");
      if (document.path) {
        setRecentFiles((current) => [
          {
            path: document.path,
            name: document.name,
            documentType: document.documentType ?? "markdown",
            openedAt: new Date().toISOString(),
          },
          ...current.filter((item) => item.path !== document.path),
        ].slice(0, 20));
      }
      if (message) showNotice(message);
      if (savedPosition) {
        scheduleReadingRestore(savedPosition, {
          announce: true,
          protectPending: true,
        });
      }
    },
    [
      cancelReadingRestoreWork,
      captureCurrentReadingPosition,
      commitReadingPosition,
      scheduleReadingRestore,
      showNotice,
    ],
  );

  useEffect(() => {
    const desktop = window.raaviDesktop;
    if (!desktop || !hydrated) return;

    const unsubscribe = desktop.onOpenMarkdownFile((document) => {
      applyOpenedDocument(document, `«${document.name}» باز شد.`);
    });
    desktop.rendererReady();
    return unsubscribe;
  }, [applyOpenedDocument, hydrated]);

  const applyLocalDocumentSnapshot = useCallback(
    (snapshot: Partial<LocalDocumentSnapshot>) => {
      cancelReadingRestoreWork();
      readingCaptureSuspendedRef.current = true;
      readingDocumentEpochRef.current += 1;
      readingUserInteractionUntilRef.current = 0;
      const nextContent =
        typeof snapshot.content === "string" ? snapshot.content : SAMPLE_MARKDOWN;
      const nextPath =
        typeof snapshot.activeDocumentPath === "string"
          ? snapshot.activeDocumentPath
          : "";
      const nextDraftId =
        typeof snapshot.draftId === "string" && snapshot.draftId.trim()
          ? snapshot.draftId
          : createReadingDraftId();
      const nextPositions = sanitizeReadingPositionMap(
        snapshot.readingPositions,
      );
      const nextDocumentKey = readingDocumentKey({
        activeDocumentPath: nextPath,
        draftId: nextDraftId,
      });
      const savedPosition = nextPositions[nextDocumentKey];
      readingDocumentStateRef.current = {
        documentKey: nextDocumentKey,
        contentSignature: readingContentSignature(nextContent),
        readerSize:
          savedPosition?.readerSize ??
          (typeof snapshot.readerSize === "number"
            ? Math.min(22, Math.max(16, snapshot.readerSize))
            : readingDocumentStateRef.current.readerSize),
        outlineOpen:
          savedPosition?.outlineOpen ??
          snapshot.readingOutlineOpen ??
          readingDocumentStateRef.current.outlineOpen,
      };
      lastReadingAnchorRef.current = savedPosition ?? null;
      selectionStartScrollRef.current = null;

      setContent(nextContent);
      if (typeof snapshot.fileName === "string") setFileName(snapshot.fileName);
      if (Array.isArray(snapshot.annotations)) {
        setAnnotations(snapshot.annotations);
      }
      if (Array.isArray(snapshot.assets)) {
        setImageAssets(snapshot.assets.slice(0, MAX_RAVI_IMAGE_ASSETS));
      }
      if (savedPosition) {
        setReaderSize(savedPosition.readerSize);
      } else if (typeof snapshot.readerSize === "number") {
        setReaderSize(Math.min(22, Math.max(16, snapshot.readerSize)));
      }
      if (
        Number.isSafeInteger(snapshot.revision) &&
        Number(snapshot.revision) > 0
      ) {
        setRevision(Number(snapshot.revision));
      }
      if (Array.isArray(snapshot.versions)) {
        setVersions(snapshot.versions.slice(-MAX_LOCAL_VERSIONS));
      }
      setActiveDocumentPath(nextPath);
      setDocumentDraftId(nextDraftId);
      readingPositionsRef.current = nextPositions;
      setReadingPositions(nextPositions);
      const nextViewMode = savedPosition?.viewMode ?? snapshot.viewMode;
      setReadingMode(nextViewMode === "reading");
      setReadingOutlineOpen(
        savedPosition?.outlineOpen ?? snapshot.readingOutlineOpen ?? true,
      );
      setAnnotationPanelOpen(false);
      const savedComposer = snapshot.annotationComposer;
      const savedSelection = savedComposer?.selection;
      if (
        savedComposer &&
        (savedComposer.kind === "comment" || savedComposer.kind === "margin") &&
        typeof savedComposer.text === "string" &&
        savedComposer.text.length <= 20_000 &&
        savedSelection &&
        Number.isSafeInteger(savedSelection.start) &&
        Number.isSafeInteger(savedSelection.end) &&
        savedSelection.start >= 0 &&
        savedSelection.end >= savedSelection.start &&
        typeof savedSelection.quote === "string" &&
        savedSelection.quote.length > 0 &&
        savedSelection.quote.length <= 2_000 &&
        typeof savedSelection.prefix === "string" &&
        typeof savedSelection.suffix === "string"
      ) {
        setSelectionDraft({
          start: savedSelection.start,
          end: savedSelection.end,
          quote: savedSelection.quote,
          prefix: savedSelection.prefix.slice(-48),
          suffix: savedSelection.suffix.slice(0, 48),
        });
        setComposerKind(savedComposer.kind);
        setComposerText(savedComposer.text);
      } else {
        setSelectionDraft(null);
        setComposerKind(null);
        setComposerText("");
      }
      if (
        snapshot.documentType === "markdown" ||
        snapshot.documentType === "ravi"
      ) {
        setDocumentType(snapshot.documentType);
      }
      setLastSavedSnapshot(
        typeof snapshot.lastSavedSnapshot === "string"
          ? snapshot.lastSavedSnapshot
          : "",
      );
      if (savedPosition) {
        scheduleReadingRestore(savedPosition, {
          announce: true,
          protectPending: true,
        });
      }
    },
    [cancelReadingRestoreWork, scheduleReadingRestore],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void (async () => {
      try {
        if (openedDocumentRef.current) return;
        const desktop = window.raaviDesktop;
        let parsed = desktop
          ? await desktop.getLocalDocumentSnapshot().catch(() => null)
          : await readLocalDocumentSnapshot().catch(() => null);
        if (!parsed && !desktop) {
          const saved = window.localStorage.getItem(STORAGE_KEY);
          parsed = saved ? (JSON.parse(saved) as LocalDocumentSnapshot) : null;
        }
        if (parsed) {
          applyLocalDocumentSnapshot(parsed);
        }
      } catch {
        setError(
          "بازیابی آخرین نوشته ممکن نبود؛ می‌توانید یک فایل تازه باز کنید.",
        );
      } finally {
        setHydrated(true);
      }
      })();
    });
    return () => cancelAnimationFrame(frame);
  }, [applyLocalDocumentSnapshot]);

  useEffect(() => {
    if (!hydrated) return;

    const timer = setTimeout(() => {
      const desktop = window.raaviDesktop;
      if (desktop) {
        void desktop.saveLocalDocumentSnapshot(localDocumentSnapshot).catch(() => {
          setError(
            "پیش‌نویس محلی ذخیره نشد؛ برای جلوگیری از ازدست‌رفتن تغییرات، فایل را ذخیره کنید.",
          );
        });
      } else {
        void writeLocalDocumentSnapshot(localDocumentSnapshot).catch(() => {});
        try {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(localDocumentSnapshot),
          );
        } catch {
          setError(
            "پیش‌نویس محلی ذخیره نشد؛ برای جلوگیری از ازدست‌رفتن تغییرات، فایل را ذخیره کنید.",
          );
        }
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [hydrated, localDocumentSnapshot]);

  useEffect(() => {
    if (!hydrated) return;

    const flushLatestDocument = () => {
      const position = readingRestoreProtectPendingRef.current
        ? lastReadingAnchorRef.current
        : captureCurrentReadingPosition();
      const positions = position
        ? upsertReadingPosition(readingPositionsRef.current, position)
        : readingPositionsRef.current;
      const latestSnapshot: LocalDocumentSnapshot = {
        ...localDocumentSnapshot,
        viewMode: document.querySelector(".app-shell.is-reading")
          ? "reading"
          : "desk",
        readingPositions: positions,
      };
      const desktop = window.raaviDesktop;
      if (desktop) {
        void desktop.saveLocalDocumentSnapshot(latestSnapshot).catch(() => {});
      } else {
        void writeLocalDocumentSnapshot(latestSnapshot).catch(() => {});
        try {
          window.localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(latestSnapshot),
          );
        } catch {
          // The visible save state already communicates storage failures.
        }
      }
    };

    const flushLatestReadingPositionSync = () => {
      const position = readingRestoreProtectPendingRef.current
        ? lastReadingAnchorRef.current
        : captureCurrentReadingPosition();
      if (!position) return;
      const positions = upsertReadingPosition(
        readingPositionsRef.current,
        position,
      );
      readingPositionsRef.current = positions;
      window.raaviDesktop?.saveReadingPositionsSync?.(positions);
    };

    window.addEventListener("pagehide", flushLatestDocument);
    window.addEventListener("beforeunload", flushLatestReadingPositionSync);
    return () => {
      window.removeEventListener("pagehide", flushLatestDocument);
      window.removeEventListener("beforeunload", flushLatestReadingPositionSync);
    };
  }, [captureCurrentReadingPosition, hydrated, localDocumentSnapshot]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      if (editorSelectionMenuTimerRef.current) {
        clearTimeout(editorSelectionMenuTimerRef.current);
      }
      if (annotationHoverFrameRef.current) {
        cancelAnimationFrame(annotationHoverFrameRef.current);
      }
      if (readingPositionTimerRef.current) {
        clearTimeout(readingPositionTimerRef.current);
      }
      if (readingRestoreFrameRef.current !== null) {
        cancelAnimationFrame(readingRestoreFrameRef.current);
      }
      if (readingRestoreTimerRef.current) {
        clearTimeout(readingRestoreTimerRef.current);
      }
      if (readingNavigationTimerRef.current !== null) {
        clearTimeout(readingNavigationTimerRef.current);
      }
      if (readingNavigationReleaseTimerRef.current !== null) {
        clearTimeout(readingNavigationReleaseTimerRef.current);
      }
      if (readingReflowTimerRef.current !== null) {
        clearTimeout(readingReflowTimerRef.current);
      }
      if (readingLayoutTransitionTimerRef.current !== null) {
        clearTimeout(readingLayoutTransitionTimerRef.current);
      }
      document.documentElement.classList.remove(
        "reading-layout-is-changing",
      );
    };
  }, []);

  useEffect(() => {
    if (!selectionDraft || composerKind) return;

    const dismissSelectionMenu = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        selectionMenuRef.current?.contains(target) ||
        previewArticleRef.current?.contains(target)
      ) {
        return;
      }
      setSelectionDraft(null);
      setSelectionHighlightRects([]);
      setSelectionMenuPosition(null);
      window.getSelection()?.removeAllRanges();
    };
    const dismissSelectionMenuOnResize = () => {
      setSelectionDraft(null);
      setSelectionHighlightRects([]);
      setSelectionMenuPosition(null);
      window.getSelection()?.removeAllRanges();
    };

    document.addEventListener("pointerdown", dismissSelectionMenu, true);
    window.addEventListener("resize", dismissSelectionMenuOnResize);
    return () => {
      document.removeEventListener("pointerdown", dismissSelectionMenu, true);
      window.removeEventListener("resize", dismissSelectionMenuOnResize);
    };
  }, [composerKind, selectionDraft]);

  useEffect(() => {
    if (!editorSelectionMenuPosition) return;

    const dismissEditorSelectionMenu = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        editorSelectionMenuRef.current?.contains(target) ||
        editorRef.current?.contains(target)
      ) {
        return;
      }
      setEditorSelectionMenuPosition(null);
    };
    const dismissEditorSelectionMenuOnResize = () => {
      setEditorSelectionMenuPosition(null);
    };

    document.addEventListener("pointerdown", dismissEditorSelectionMenu, true);
    window.addEventListener("resize", dismissEditorSelectionMenuOnResize);
    return () => {
      document.removeEventListener(
        "pointerdown",
        dismissEditorSelectionMenu,
        true,
      );
      window.removeEventListener("resize", dismissEditorSelectionMenuOnResize);
    };
  }, [editorSelectionMenuPosition]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 820px)");
    const syncLibraryMode = (initialize = false) => {
      const isModal = mediaQuery.matches;
      setIsCompactLayout(isModal);
      setLibraryIsModal(isModal);
      if (isModal) {
        setLibraryOpen(false);
        setMobileHeaderMenuOpen(false);
        setMobileEditorToolsExpanded(false);
      } else if (initialize) {
        setLibraryOpen(Boolean(window.raaviDesktop));
      } else {
        setMobileHeaderMenuOpen(false);
        setMobileEditorToolsExpanded(false);
      }
    };
    const handleLibraryModeChange = () => syncLibraryMode();
    syncLibraryMode(true);
    mediaQuery.addEventListener("change", handleLibraryModeChange);
    return () =>
      mediaQuery.removeEventListener("change", handleLibraryModeChange);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setCommandEnvironment(detectCommandEnvironment());
      setDesktopInstallRecommendation(
        detectDesktopInstallRecommendation(),
      );
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    syncLayer("about", aboutModalOpen);
  }, [aboutModalOpen, syncLayer]);

  useEffect(() => {
    syncLayer("support", supportModalOpen);
  }, [supportModalOpen, syncLayer]);

  useEffect(() => {
    syncLayer("mermaid", Boolean(mermaidStudioSession));
  }, [mermaidStudioSession, syncLayer]);

  useEffect(() => {
    syncLayer("mobileMenu", mobileHeaderMenuOpen);
  }, [mobileHeaderMenuOpen, syncLayer]);

  useEffect(() => {
    syncLayer("save", saveModalOpen);
  }, [saveModalOpen, syncLayer]);

  useEffect(() => {
    syncLayer("export", exportModalOpen);
  }, [exportModalOpen, syncLayer]);

  useEffect(() => {
    document.documentElement.toggleAttribute(
      "data-raavi-pdf-export",
      pdfExportActive,
    );
    return () =>
      document.documentElement.removeAttribute("data-raavi-pdf-export");
  }, [pdfExportActive]);

  useEffect(() => {
    syncLayer("image", imageModalOpen);
  }, [imageModalOpen, syncLayer]);

  useEffect(() => {
    syncLayer("new", newDocumentModalOpen);
  }, [newDocumentModalOpen, syncLayer]);

  useEffect(() => {
    syncLayer("shortcuts", shortcutHelpOpen);
  }, [shortcutHelpOpen, syncLayer]);

  useEffect(() => {
    syncLayer("library", libraryOpen && libraryIsModal);
  }, [libraryIsModal, libraryOpen, syncLayer]);

  useModalFocus({
    open: libraryOpen && libraryIsModal,
    isTopLayer: topLayer === "library",
    containerRef: libraryPanelRef,
    initialFocusRef: libraryCloseRef,
    returnFocusRef: libraryTriggerRef,
  });

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.raaviHighlights = "true";
    style.textContent = `
      ::highlight(raavi-highlight) {
        background: var(--highlight-bg);
      }
      ::highlight(raavi-comment) {
        background: var(--comment-highlight-bg);
        text-decoration: underline var(--proof-blue) 1.5px;
        text-underline-offset: 3px;
      }
      ::highlight(raavi-margin) {
        background: var(--margin-highlight-bg);
        text-decoration: underline var(--margin-ink) 1.5px dashed;
        text-underline-offset: 3px;
      }
      ::highlight(raavi-active) {
        background: transparent;
        text-decoration: underline var(--proof-blue-dark) 2.5px;
        text-underline-offset: 4px;
      }
      ::highlight(raavi-selection) {
        background: var(--comment-highlight-bg);
        text-decoration: underline var(--proof-blue-dark) 2px;
        text-underline-offset: 3px;
      }
      @media print {
        ::highlight(raavi-highlight),
        ::highlight(raavi-comment),
        ::highlight(raavi-margin),
        ::highlight(raavi-active),
        ::highlight(raavi-selection) {
          color: inherit;
          background: transparent;
          text-decoration: none;
        }
      }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  useEffect(() => {
    const root = previewArticleRef.current;
    const highlightRegistry = (
      CSS as unknown as {
        highlights?: {
          set: (name: string, value: unknown) => void;
          delete: (name: string) => void;
        };
      }
    ).highlights;
    const HighlightConstructor = (
      window as unknown as {
        Highlight?: new (...ranges: Range[]) => unknown;
      }
    ).Highlight;

    if (!root || !highlightRegistry || !HighlightConstructor) return;

    const names = [
      "raavi-highlight",
      "raavi-comment",
      "raavi-margin",
      "raavi-active",
      "raavi-selection",
    ];
    const frame = requestAnimationFrame(() => {
      const text = root.textContent ?? "";
      const buckets: Record<AnnotationKind, Range[]> = {
        highlight: [],
        comment: [],
        margin: [],
      };
      const activeRanges: Range[] = [];

      for (const annotation of annotations) {
        const start = resolveAnnotationStart(text, annotation);
        if (start < 0) continue;
        const range = rangeFromTextOffsets(
          root,
          start,
          start + annotation.quote.length,
        );
        if (!range) continue;
        buckets[annotation.kind].push(range);
        if (annotation.id === activeAnnotationId) activeRanges.push(range);
      }

      for (const kind of Object.keys(buckets) as AnnotationKind[]) {
        const name = `raavi-${kind}`;
        if (buckets[kind].length) {
          highlightRegistry.set(
            name,
            new HighlightConstructor(...buckets[kind]),
          );
        } else {
          highlightRegistry.delete(name);
        }
      }

      if (activeRanges.length) {
        highlightRegistry.set(
          "raavi-active",
          new HighlightConstructor(...activeRanges),
        );
      } else {
        highlightRegistry.delete("raavi-active");
      }

      if (selectionDraft) {
        const start = resolveAnnotationStart(text, selectionDraft);
        const range = start >= 0
          ? rangeFromTextOffsets(
              root,
              start,
              start + selectionDraft.quote.length,
            )
          : null;
        if (range) {
          highlightRegistry.set(
            "raavi-selection",
            new HighlightConstructor(range),
          );
        } else {
          highlightRegistry.delete("raavi-selection");
        }
      } else {
        highlightRegistry.delete("raavi-selection");
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      for (const name of names) highlightRegistry.delete(name);
    };
  }, [
    activeAnnotationId,
    annotations,
    content,
    mobilePane,
    readingMode,
    selectionDraft,
  ]);

  useEffect(() => {
    if (!selectionDraft || composerKind) return;
    const frame = requestAnimationFrame(() => {
      const root = previewArticleRef.current;
      const nativeSelection = window.getSelection();
      if (!root || !nativeSelection) return;
      if (nativeSelection.toString().trim() === selectionDraft.quote) return;

      const text = root.textContent ?? "";
      const start = resolveAnnotationStart(text, selectionDraft);
      const range = start >= 0
        ? rangeFromTextOffsets(
            root,
            start,
            start + selectionDraft.quote.length,
          )
        : null;
      if (!range) return;
      nativeSelection.removeAllRanges();
      nativeSelection.addRange(range);
    });
    return () => cancelAnimationFrame(frame);
  }, [composerKind, content, mobilePane, readingMode, selectionDraft]);

  const capturePreviewSelection = (
    pointer?: { clientX: number; clientY: number },
  ) => {
    const article = previewArticleRef.current;
    const previewScroll = previewScrollRef.current;
    const selection = window.getSelection();
    if (!article || !previewScroll) return;
    const nativeRange =
      selection?.rangeCount === 1 ? selection.getRangeAt(0).cloneRange() : null;
    const pointerStart = selectionPointerStartRef.current;
    selectionPointerStartRef.current = null;
    const pointerEnd = pointer
      ? caretBoundaryFromPoint(pointer.clientX, pointer.clientY)
      : null;
    const pointerRange =
      pointerStart &&
      pointerStart.documentKey === readingDocumentStateRef.current.documentKey &&
      pointerEnd &&
      article.contains(pointerStart.node) &&
      article.contains(pointerEnd.node)
        ? rangeBetweenBoundaries(pointerStart, pointerEnd)
        : null;
    const range =
      nativeRange && !nativeRange.collapsed ? nativeRange : pointerRange;
    if (!range) return;
    if (pointerRange && (!nativeRange || nativeRange.collapsed) && selection) {
      selection.removeAllRanges();
      selection.addRange(pointerRange.cloneRange());
    }
    selectionReadingAnchorRef.current = null;

    requestAnimationFrame(() => {
      if (!article.isConnected || !previewScroll.isConnected) return;
      const selectionStartScroll = selectionStartScrollRef.current;
      selectionStartScrollRef.current = null;
      const restorePointerScroll = () => {
        if (
          selectionStartScroll &&
          selectionStartScroll.documentKey ===
            readingDocumentStateRef.current.documentKey &&
          selectionStartScroll.root.isConnected
        ) {
          const applySavedScroll = () => {
            if (
              !selectionStartScroll.root.isConnected ||
              selectionStartScroll.request !==
                selectionScrollRestoreRequestRef.current
            ) {
              return false;
            }
            readingRestoreInProgressRef.current = true;
            readingRestoreExpectedScrollTopRef.current = selectionStartScroll.top;
            if (selectionStartScroll.root === document.scrollingElement) {
              window.scrollTo({ top: selectionStartScroll.top, behavior: "auto" });
            } else {
              selectionStartScroll.root.scrollTop = selectionStartScroll.top;
            }
            return true;
          };
          const pinSavedScroll = (framesRemaining: number) => {
            if (!applySavedScroll()) return;
            if (framesRemaining > 0) {
              requestAnimationFrame(() => pinSavedScroll(framesRemaining - 1));
            } else {
              readingRestoreInProgressRef.current = false;
              readingRestoreExpectedScrollTopRef.current = null;
              selectionReadingAnchorRef.current ??=
                captureCurrentReadingPosition();
            }
          };
          pinSavedScroll(12);
        }
      };
      if (
        range.collapsed ||
        !article.contains(range.startContainer) ||
        !article.contains(range.endContainer)
      ) {
        if (!composerKind) {
          setSelectionDraft(null);
          setSelectionHighlightRects([]);
          setSelectionMenuPosition(null);
        }
        restorePointerScroll();
        return;
      }

      const rawQuote = range.cloneContents().textContent ?? range.toString();
      const quote = rawQuote.trim();
      if (!quote) {
        setSelectionDraft(null);
        setSelectionHighlightRects([]);
        setSelectionMenuPosition(null);
        restorePointerScroll();
        return;
      }
      if (quote.length > 2_000) {
        setSelectionDraft(null);
        setSelectionHighlightRects([]);
        setSelectionMenuPosition(null);
        setError("برای یادداشت‌گذاری، بخش کوتاه‌تری از متن را انتخاب کنید.");
        restorePointerScroll();
        return;
      }

      const beforeRange = document.createRange();
      beforeRange.selectNodeContents(article);
      beforeRange.setEnd(range.startContainer, range.startOffset);
      const leadingWhitespace = rawQuote.indexOf(quote);
      const beforeText =
        beforeRange.cloneContents().textContent ?? beforeRange.toString();
      const start = beforeText.length + leadingWhitespace;
      const end = start + quote.length;
      const fullText = article.textContent ?? "";
      const rangeRect = range.getBoundingClientRect();
      const scrollRect = previewScroll.getBoundingClientRect();
      const highlightRects = Array.from(range.getClientRects())
        .filter((rect) => rect.width > 0 && rect.height > 0)
        .map((rect) => ({
          left: rect.left - scrollRect.left + previewScroll.scrollLeft,
          top: rect.top - scrollRect.top + previewScroll.scrollTop,
          width: rect.width,
          height: rect.height,
        }));
      const anchorClientX =
        pointer?.clientX ?? (rangeRect.left + rangeRect.right) / 2;
      const distanceAbove = (pointer?.clientY ?? rangeRect.top) - scrollRect.top;
      const placement = distanceAbove >= 58 ? "above" : "below";
      const anchorClientY =
        pointer?.clientY ??
        (placement === "above" ? rangeRect.top : rangeRect.bottom);
      const menuHalfWidth = Math.min(
        152,
        Math.max(72, scrollRect.width / 2 - 12),
      );
      const minimumX = previewScroll.scrollLeft + menuHalfWidth;
      const maximumX =
        previewScroll.scrollLeft + scrollRect.width - menuHalfWidth;
      const rawX =
        anchorClientX - scrollRect.left + previewScroll.scrollLeft;

      setSelectionDraft({
        start,
        end,
        quote,
        prefix: fullText.slice(Math.max(0, start - 48), start),
        suffix: fullText.slice(end, end + 48),
      });
      setSelectionHighlightRects(highlightRects);
      setSelectionMenuPosition({
        x: Math.min(Math.max(rawX, minimumX), Math.max(minimumX, maximumX)),
        y:
          anchorClientY -
          scrollRect.top +
          previewScroll.scrollTop +
          (placement === "above" ? -10 : 10),
        placement,
      });
      setComposerKind(null);
      setComposerText("");
      setError("");
      restorePointerScroll();
      if (!selectionStartScroll) {
        selectionReadingAnchorRef.current = captureCurrentReadingPosition();
      }
    });
  };

  const clearNativeSelection = () => {
    window.getSelection()?.removeAllRanges();
  };

  const copyPreviewSelection = async () => {
    if (!selectionDraft?.quote) {
      showNotice("ابتدا بخشی از متن پیش‌نمایش را انتخاب کنید.");
      return;
    }

    const readingAnchor =
      selectionReadingAnchorRef.current ?? captureCurrentReadingPosition();
    try {
      await navigator.clipboard.writeText(selectionDraft.quote);
    } catch {
      const nativeSelection = window.getSelection();
      const savedRanges = nativeSelection
        ? Array.from({ length: nativeSelection.rangeCount }, (_, index) =>
            nativeSelection.getRangeAt(index).cloneRange(),
          )
        : [];
      const textarea = document.createElement("textarea");
      textarea.value = selectionDraft.quote;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      nativeSelection?.removeAllRanges();
      savedRanges.forEach((range) => nativeSelection?.addRange(range));
      if (!copied) {
        showNotice("کپی خودکار ممکن نشد؛ از Ctrl+C استفاده کنید.");
        return;
      }
    }

    setSelectionMenuPosition(null);
    if (readingAnchor) scheduleReadingRestore(readingAnchor);
    showNotice("متن کپی شد؛ محدودهٔ آبی تا انتخاب بعدی باقی می‌ماند.");
  };

  const addAnnotation = (
    kind: AnnotationKind,
    body = "",
    selection = selectionDraft,
  ) => {
    if (!selection) {
      showNotice("ابتدا بخشی از متن پیش‌نمایش را انتخاب کنید.");
      return;
    }

    const annotation: RaaviAnnotation = {
      id: annotationId(),
      kind,
      ...selection,
      body: body.trim(),
      createdAt: new Date().toISOString(),
    };

    preserveReadingViewport(() => {
      setAnnotations((current) => [...current, annotation]);
      setSelectionDraft(null);
      setSelectionHighlightRects([]);
      setSelectionMenuPosition(null);
      setComposerKind(null);
      setComposerText("");
      composerOriginRef.current = null;
      setAnnotationPanelOpen(true);
      setActiveAnnotationId(annotation.id);
      clearNativeSelection();
    }, { anchor: selectionReadingAnchorRef.current });
    selectionReadingAnchorRef.current = null;
    showNotice(`${ANNOTATION_LABELS[kind]} ثبت شد.`);
  };

  const openAnnotationComposer = (
    kind: Extract<AnnotationKind, "comment" | "margin">,
    origin?: HTMLButtonElement | null,
  ) => {
    if (!selectionDraft) {
      showNotice("ابتدا بخشی از متن پیش‌نمایش را انتخاب کنید.");
      return;
    }
    preserveReadingViewport(() => {
      composerOriginRef.current = origin ?? null;
      setComposerKind(kind);
      setComposerText("");
    }, { anchor: selectionReadingAnchorRef.current, retries: 3 });
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        composerTextAreaRef.current?.focus({ preventScroll: true }),
      ),
    );
  };

  const submitAnnotationComposer = () => {
    if (!composerKind || !composerText.trim()) return;
    addAnnotation(composerKind, composerText);
  };

  const cancelAnnotationComposer = () => {
    const origin = composerOriginRef.current;
    preserveReadingViewport(() => {
      setComposerKind(null);
      setComposerText("");
    });
    requestAnimationFrame(() => origin?.focus({ preventScroll: true }));
  };

  const updateAnnotationBody = (id: string, body: string) => {
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === id ? { ...annotation, body } : annotation,
      ),
    );
  };

  const removeAnnotation = (id: string) => {
    const anchor = captureCurrentReadingPosition();
    annotationPanelRef.current?.focus({ preventScroll: true });
    preserveReadingViewport(
      () => {
        setAnnotations((current) =>
          current.filter((annotation) => annotation.id !== id),
        );
        if (activeAnnotationId === id) setActiveAnnotationId("");
        showNotice("یادداشت حذف شد.");
      },
      { anchor, retries: 3 },
    );
  };

  const focusAnnotation = (annotation: RaaviAnnotation) => {
    cancelReadingRestoreWork();
    readingIntentionalNavigationRef.current = true;
    setActiveAnnotationId(annotation.id);
    setAnnotationPanelOpen(true);
    setHoverPreview(null);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const article = previewArticleRef.current;
        if (!article) {
          readingIntentionalNavigationRef.current = false;
          return;
        }
        const text = article.textContent ?? "";
        const start = resolveAnnotationStart(text, annotation);
        if (start < 0) {
          readingIntentionalNavigationRef.current = false;
          showNotice("محل این یادداشت پس از ویرایش متن پیدا نشد.");
          return;
        }
        const range = rangeFromTextOffsets(
          article,
          start,
          start + annotation.quote.length,
        );
        const target = range?.startContainer.parentElement;
        const reducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        if (target) {
          readingNavigationTargetRef.current = {
            element: target,
            placement: "center",
          };
          scrollReadingElement(
            target,
            reducedMotion ? "auto" : "smooth",
            "center",
          );
        }
        document
          .getElementById(`annotation-card-${annotation.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        if (readingNavigationTimerRef.current !== null) {
          window.clearTimeout(readingNavigationTimerRef.current);
        }
        readingNavigationTimerRef.current = window.setTimeout(
          () => {
            readingNavigationTimerRef.current = null;
            if (target?.isConnected) {
              scrollReadingElement(target, "auto", "center");
            }
            readingNavigationReleaseTimerRef.current = window.setTimeout(() => {
              readingNavigationReleaseTimerRef.current = null;
              readingIntentionalNavigationRef.current = false;
              readingNavigationTargetRef.current = null;
              scheduleReadingPositionCommit(0);
            }, 900);
          },
          reducedMotion ? 80 : 560,
        );
      });
    });
  };

  const handleAnnotationPointerMove = (
    event: ReactPointerEvent<HTMLElement>,
  ) => {
    if (event.pointerType === "touch") return;
    const article = previewArticleRef.current;
    if (!article || !annotations.length) return;
    const { clientX, clientY } = event;

    if (annotationHoverFrameRef.current !== null) {
      cancelAnimationFrame(annotationHoverFrameRef.current);
    }

    annotationHoverFrameRef.current = requestAnimationFrame(() => {
      annotationHoverFrameRef.current = null;
      const annotation = findAnnotationAtPoint(
        article,
        annotations,
        clientX,
        clientY,
      );

      if (!annotation) {
        setHoverPreview(null);
        return;
      }

      setHoverPreview((current) => {
        if (current?.annotationId === annotation.id) return current;
        const width = 286;
        const x = Math.min(
          window.innerWidth - width - 14,
          Math.max(14, clientX - width / 2),
        );
        const placement =
          clientY > window.innerHeight - 190 ? "above" : "below";
        const y =
          placement === "above"
            ? Math.max(14, clientY - 168)
            : clientY + 18;
        return { annotationId: annotation.id, x, y, placement };
      });
    });
  };

  const clearAnnotationHover = () => {
    if (annotationHoverFrameRef.current !== null) {
      cancelAnimationFrame(annotationHoverFrameRef.current);
      annotationHoverFrameRef.current = null;
    }
    setHoverPreview(null);
  };

  const handleAnnotationClick = (event: ReactMouseEvent<HTMLElement>) => {
    const article = previewArticleRef.current;
    if (!article || window.getSelection()?.toString().trim()) return;
    const annotation = findAnnotationAtPoint(
      article,
      annotations,
      event.clientX,
      event.clientY,
    );
    if (!annotation) return;

    event.preventDefault();
    event.stopPropagation();
    focusAnnotation(annotation);
  };

  const buildNextSave = useCallback(() => {
    const nextRevision = revision + 1;
    const nextVersion: RaaviVersion = {
      number: nextRevision,
      savedAt: new Date().toISOString(),
      content,
      annotations,
    };
    const nextVersions = [...versions, nextVersion].slice(-30);
    const raavi = makeRaaviDocument(
      saveNameForType(fileName, "markdown"),
      content,
      annotations,
      nextRevision,
      nextVersions,
      imageAssets,
    );
    const exportContent = markdownWithEmbeddedRaaviImages(content, imageAssets);
    return {
      nextRevision,
      nextVersions,
      payload: {
        content: exportContent,
        annotations,
        assets: imageAssets,
        revision: nextRevision,
        versions: nextVersions,
        raavi,
      } satisfies DocumentSavePayload,
    };
  }, [annotations, content, fileName, imageAssets, revision, versions]);

  const commitSavedVersion = useCallback(
    (
      nextRevision: number,
      nextVersions: RaaviVersion[],
      nextPath: string,
      nextType: DocumentFileType,
      nextName?: string,
    ) => {
      setRevision(nextRevision);
      setVersions(nextVersions);
      setActiveDocumentPath(nextPath);
      setDocumentType(nextType);
      if (nextName) setFileName(nextName);
      if (nextPath) {
        setRecentFiles((current) =>
          [
            {
              path: nextPath,
              name: nextName ?? fileName,
              documentType: nextType,
              openedAt: new Date().toISOString(),
            },
            ...current.filter((item) => item.path !== nextPath),
          ].slice(0, 20),
        );
      }
      setLastSavedSnapshot(documentSnapshot(content, annotations, imageAssets));
      setSaveState("saved");
      setSaveModalOpen(false);
      showNotice(
        `نسخه‌ی ${nextRevision.toLocaleString("fa-IR")} ذخیره شد.`,
      );
    },
    [annotations, content, fileName, imageAssets, showNotice],
  );

  const openSaveFileModal = useCallback(
    (preferredType: SaveFileType = documentType) => {
      setSaveFileType(preferredType);
      setSaveFileName(saveNameForType(fileName, preferredType));
      setSaveModalOpen(true);
      setError("");
    },
    [documentType, fileName],
  );

  const saveAsFile = useCallback(async () => {
    const trimmedName = saveFileName.trim();
    if (!trimmedName) {
      setError("برای فایل یک نام وارد کنید.");
      return;
    }

    const { nextRevision, nextVersions, payload } = buildNextSave();
    const nextName = saveNameForType(trimmedName, saveFileType);
    setSaveState("saving");
    setError("");

    try {
      const desktop = window.raaviDesktop;
      if (desktop) {
        const result =
          saveFileType === "ravi"
            ? await desktop.saveRaavi(nextName, payload)
            : await desktop.saveMarkdown(nextName, payload);
        if (!result.saved) {
          setSaveState(effectiveSaveState === "dirty" ? "dirty" : "saved");
          return;
        }
        commitSavedVersion(
          nextRevision,
          nextVersions,
          result.filePath ?? "",
          saveFileType,
          nextName,
        );
        return;
      }

      const blob =
        saveFileType === "ravi"
          ? new Blob([JSON.stringify(payload.raavi, null, 2)], {
              type: "application/json;charset=utf-8",
            })
          : new Blob([content], {
              type: "text/markdown;charset=utf-8",
            });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = nextName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      commitSavedVersion(
        nextRevision,
        nextVersions,
        "",
        saveFileType,
        nextName,
      );
    } catch {
      setSaveState("error");
      setError("ذخیره‌ی فایل انجام نشد؛ مسیر و مجوز نوشتن را بررسی کنید.");
    }
  }, [
    buildNextSave,
    commitSavedVersion,
    content,
    effectiveSaveState,
    saveFileName,
    saveFileType,
  ]);

  const saveCurrentFile = useCallback(async () => {
    const desktop = window.raaviDesktop;
    if (!desktop || !activeDocumentPath) {
      openSaveFileModal(documentType);
      return;
    }

    const { nextRevision, nextVersions, payload } = buildNextSave();
    setSaveState("saving");
    setError("");
    try {
      const result = await desktop.saveCurrentDocument(
        activeDocumentPath,
        payload,
      );
      if (!result.saved) {
        setSaveState(effectiveSaveState === "dirty" ? "dirty" : "saved");
        return;
      }
      commitSavedVersion(
        nextRevision,
        nextVersions,
        result.filePath ?? activeDocumentPath,
        result.documentType ?? documentType,
      );
    } catch {
      setSaveState("error");
      setError(
        "ذخیره‌ی نسخه انجام نشد؛ اگر فایل جابه‌جا شده، از «ذخیره فایل» استفاده کنید.",
      );
    }
  }, [
    activeDocumentPath,
    buildNextSave,
    commitSavedVersion,
    documentType,
    effectiveSaveState,
    openSaveFileModal,
  ]);

  const resetExportDialog = useCallback(() => {
    pendingExportRef.current = null;
    setExportModalOpen(false);
    setExportStatus("idle");
    setExportProgressLabel("");
    setExportWarnings([]);
    setExportDiagramConfirmed(false);
    setExportError("");
    setPdfExportActive(false);
  }, []);

  const closeExportDialog = useCallback(() => {
    if (exportStatus === "preparing" || exportStatus === "saving") return;
    resetExportDialog();
  }, [exportStatus, resetExportDialog]);

  const openExportDialog = useCallback(() => {
    pendingExportRef.current = null;
    setExportStatus("idle");
    setExportProgressLabel("");
    setExportWarnings([]);
    setExportDiagramConfirmed(false);
    setExportError("");
    setPdfExportActive(false);
    setMobileHeaderMenuOpen(false);
    setExportModalOpen(true);
  }, []);

  const commitPreparedExport = useCallback(async () => {
    const pending = pendingExportRef.current;
    if (!pending) return;
    if (pending.requiresDiagramConfirmation && !exportDiagramConfirmed) return;
    let cleanupPrintDocument: (() => void) | undefined;
    setExportStatus("saving");
    setExportError("");
    setExportProgressLabel(
      pending.format === "word"
        ? "در حال تحویل فایل به دستگاه…"
        : "در حال صفحه‌بندی A4…",
    );

    try {
      const desktop = window.raaviDesktop;
      if (pending.format === "word") {
        if (!pending.bytes) throw new Error("WORD_EXPORT_EMPTY");
        if (desktop) {
          const result = await desktop.saveWordExport(
            pending.fileName,
            new Uint8Array(pending.bytes),
          );
          if (!result.saved) {
            setExportStatus("idle");
            setExportProgressLabel("");
            return;
          }
        } else {
          downloadExport(pending.bytes, pending.fileName);
        }
        resetExportDialog();
        showNotice(`فایل «${pending.fileName}» ساخته شد.`);
        return;
      }

      const stagedPrintDocument = await stagePrintDocument(
        previewArticleRef.current,
        pending.fileName,
      );
      cleanupPrintDocument = stagedPrintDocument.cleanup;
      await waitForNextPaint();
      if (desktop) {
        const result = await desktop.exportPdf(pending.fileName);
        if (!result.saved) {
          pendingExportRef.current = null;
          setExportStatus("idle");
          setExportProgressLabel("");
          setPdfExportActive(false);
          return;
        }
        resetExportDialog();
        showNotice(`فایل «${pending.fileName}» ساخته شد.`);
      } else {
        window.print();
        resetExportDialog();
        showNotice("پنجره‌ی چاپ باز شد؛ مقصد را روی «Save as PDF» بگذارید.");
      }
    } catch {
      setPdfExportActive(false);
      setExportStatus("error");
      setExportProgressLabel("");
      setExportError(
        pending.format === "word"
          ? "ساخت یا ذخیره‌ی فایل Word انجام نشد. دوباره تلاش کنید."
          : "ساخت PDF انجام نشد. مسیر ذخیره و دسترسی برنامه را بررسی کنید.",
      );
    } finally {
      cleanupPrintDocument?.();
    }
  }, [exportDiagramConfirmed, resetExportDialog, showNotice]);

  const startExport = useCallback(async () => {
    const nextName = exportNameForFormat(fileName, exportFormat);
    pendingExportRef.current = null;
    setExportStatus("preparing");
    setExportWarnings([]);
    setExportDiagramConfirmed(false);
    setExportError("");

    try {
      const warnings: ExportDialogWarning[] = [];
      if (annotations.length > 0) {
        warnings.push({
          kind: "unsupported",
          message: `${annotations.length.toLocaleString("fa-IR")} یادداشت و نشانه‌ی نمونه‌خوانی وارد نسخه‌ی تحویلی نمی‌شود.`,
        });
      }

      if (exportFormat === "word") {
        setExportProgressLabel("در حال خواندن ساختار نوشته…");
        const { createWordExport } = await import("./export/word");
        const result = await createWordExport({
          markdown: content,
          fileName: nextName,
          imageAssets,
          onProgress: (stage, completed, total) => {
            const ratio = total > 0
              ? ` (${completed.toLocaleString("fa-IR")} از ${total.toLocaleString("fa-IR")})`
              : "";
            const labels = {
              reading: "در حال خواندن ساختار نوشته",
              diagrams: "در حال آماده‌سازی نمودارها",
              images: "در حال آماده‌سازی تصویرها",
              document: "در حال ساخت سند قابل‌ویرایش",
            } as const;
            setExportProgressLabel(`${labels[stage]}${ratio}…`);
          },
        });
        warnings.push(...result.warnings);
        pendingExportRef.current = {
          format: "word",
          fileName: nextName,
          bytes: result.bytes,
        };
      } else {
        setPdfExportActive(true);
        setExportProgressLabel("در حال آماده‌سازی قلم‌ها، تصاویر و نمودارها…");
        await waitForNextPaint();
        warnings.push(...(await inspectPrintablePreview(previewArticleRef.current)));
        pendingExportRef.current = { format: "pdf", fileName: nextName };
      }

      const uniqueWarnings = warnings.filter(
        (warning, index, all) =>
          all.findIndex((candidate) => candidate.message === warning.message) ===
          index,
      );
      const requiresDiagramConfirmation = uniqueWarnings.some(
        (warning) => warning.kind === "diagram",
      );
      if (pendingExportRef.current) {
        pendingExportRef.current.requiresDiagramConfirmation =
          requiresDiagramConfirmation;
      }
      if (uniqueWarnings.length > 0) {
        setExportWarnings(uniqueWarnings);
        setExportStatus("review");
        setExportProgressLabel("");
        return;
      }
      await commitPreparedExport();
    } catch {
      pendingExportRef.current = null;
      setPdfExportActive(false);
      setExportStatus("error");
      setExportProgressLabel("");
      setExportError(
        exportFormat === "word"
          ? "ساخت فایل Word کامل نشد؛ نمودارها و تصاویر سند را بررسی و دوباره تلاش کنید."
          : "پیش‌نمایش چاپ آماده نشد؛ دوباره تلاش کنید.",
      );
    }
  }, [annotations, commitPreparedExport, content, exportFormat, fileName, imageAssets]);

  const changeExportFormat = useCallback((format: ExportFormat) => {
    pendingExportRef.current = null;
    setExportFormat(format);
    setExportStatus("idle");
    setExportWarnings([]);
    setExportDiagramConfirmed(false);
    setExportError("");
    setExportProgressLabel("");
    setPdfExportActive(false);
  }, []);

  const openNewDocumentModal = useCallback(() => {
    setNewDocumentError("");
    setNewDocumentCreating(false);
    setNewDocumentModalOpen(true);
  }, []);

  const createNewDocument = useCallback(
    async (spec: NewDocumentSpec) => {
      let initialContent = "";
      if (spec.includeTitle) {
        const { titleFromDocumentName } = await import(
          "./components/new-document-dialog"
        );
        initialContent = `# ${titleFromDocumentName(spec.baseName)}\n`;
      }
      const initialAnnotations: RaaviAnnotation[] = [];
      const initialAssets: RaaviImageAsset[] = [];
      const raavi = makeRaaviDocument(
        saveNameForType(spec.fileName, "markdown"),
        initialContent,
        initialAnnotations,
        1,
        [],
        initialAssets,
      );
      const payload: DocumentSavePayload = {
        content: initialContent,
        annotations: initialAnnotations,
        assets: initialAssets,
        revision: 1,
        versions: [],
        raavi,
      };

      setNewDocumentCreating(true);
      setNewDocumentError("");

      try {
        const desktop = window.raaviDesktop;
        let nextPath = "";

        if (desktop) {
          const result =
            spec.fileType === "ravi"
              ? await desktop.saveRaavi(spec.fileName, payload)
              : await desktop.saveMarkdown(spec.fileName, payload);
          if (!result.saved) return;
          nextPath = result.filePath ?? "";
        } else {
          const blob =
            spec.fileType === "ravi"
              ? new Blob([JSON.stringify(raavi, null, 2)], {
                  type: "application/json;charset=utf-8",
                })
              : new Blob([initialContent], {
                  type: "text/markdown;charset=utf-8",
                });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = spec.fileName;
          document.body.appendChild(link);
          link.click();
          link.remove();
          URL.revokeObjectURL(url);
        }

        applyOpenedDocument(
          {
            name: spec.fileName,
            path: nextPath,
            documentType: spec.fileType,
            content: initialContent,
            annotations: initialAnnotations,
            assets: initialAssets,
            revision: 1,
            versions: [],
            openInReadingMode: false,
            draftId: `web-file:${spec.fileName.normalize("NFKC").toLocaleLowerCase("fa")}`,
          },
          `«${spec.fileName}» ساخته شد؛ ویرایش را شروع کنید.`,
        );
        setMobileEditorToolsExpanded(false);
        setMobilePane("editor");
        setNewDocumentModalOpen(false);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => editorRef.current?.focus()),
        );
      } catch {
        setNewDocumentError(
          "فایل ساخته نشد؛ نام، مسیر انتخاب‌شده و مجوز نوشتن را بررسی کنید.",
        );
      } finally {
        setNewDocumentCreating(false);
      }
    },
    [applyOpenedDocument],
  );

  const saveBeforeCreatingNew = useCallback(() => {
    setNewDocumentModalOpen(false);
    requestAnimationFrame(() => void saveCurrentFile());
  }, [saveCurrentFile]);

  const openDocumentPicker = useCallback(async () => {
    if (window.raaviDesktop) {
      setError("");
      try {
        const document = await window.raaviDesktop.chooseDocument();
        if (document) {
          applyOpenedDocument(document, `«${document.name}» باز شد.`);
        }
      } catch {
        setError("بازکردن فایل ممکن نبود؛ دوباره تلاش کنید.");
      }
      return;
    }
    fileInputRef.current?.click();
  }, [applyOpenedDocument]);

  const readFile = async (file: File) => {
    setError("");

    const isRaaviFile = /\.ravi$/i.test(file.name);
    const isMarkdownFile = /\.(md|markdown)$/i.test(file.name);
    if (!isRaaviFile && !isMarkdownFile) {
      setError(
        "این فایل پشتیبانی نمی‌شود؛ یک فایل md، markdown یا ravi انتخاب کنید.",
      );
      return;
    }

    const maximumSize = isRaaviFile ? 64 * 1024 * 1024 : MAX_FILE_SIZE;
    if (file.size > maximumSize) {
      setError(
        isRaaviFile
          ? "حجم فایل راوی بیشتر از ۶۴ مگابایت است؛ یک فایل کوچک‌تر انتخاب کنید."
          : "حجم فایل Markdown بیشتر از ۲ مگابایت است؛ یک فایل کوچک‌تر انتخاب کنید.",
      );
      return;
    }

    try {
      const rawContent = await file.text();
      if (isRaaviFile) {
        const parsed = parseRaaviDocument(
          rawContent,
          file.name.replace(/\.ravi$/i, ".md"),
        );
        applyOpenedDocument(
          {
            name: parsed.fileName,
            path: "",
            documentType: "ravi",
            content: parsed.content,
            annotations: parsed.annotations,
            assets: parsed.assets,
            revision: parsed.revision,
            versions: parsed.versions,
            openInReadingMode: false,
          },
          `فایل راوی با ${parsed.annotations.length.toLocaleString("fa-IR")} یادداشت باز شد.`,
        );
      } else {
        applyOpenedDocument(
          {
            name: file.name,
            path: "",
            documentType: "markdown",
            content: rawContent,
            annotations: [],
            assets: [],
            revision: 1,
            versions: [],
            openInReadingMode: false,
          },
          "فایل باز شد و پیش‌نمایش آماده است.",
        );
      }
    } catch {
      setError(
        isRaaviFile
          ? "فایل .ravi معتبر نیست یا با نسخه‌ی دیگری ساخته شده است."
          : "خواندن فایل ممکن نبود؛ دوباره تلاش کنید.",
      );
    }
  };

  const scanConnectedDirectory = async (
    handle: LocalDirectoryHandle,
    silent = false,
  ) => {
    setLibraryState("scanning");
    setError("");

    try {
      const rootId = `web:${handle.name}`;
      const files = await scanMarkdownDirectory(
        handle,
        rootId,
        handle.name,
      );
      files.sort((a, b) => a.path.localeCompare(b.path, "fa"));
      setLibraryFiles((current) => [
        ...current.filter((file) => file.rootId !== rootId),
        ...files,
      ]);
      setLibraryFolders((current) => [
        ...current.filter((folder) => folder.rootId !== rootId),
        { rootId, rootName: handle.name, rootPath: "" },
      ]);
      setLibraryQuery("");
      setLibraryState("ready");
      if (!silent) {
        showNotice(
          files.length
            ? `${files.length.toLocaleString("fa-IR")} فایل md و ravi به کتابخانه اضافه شد.`
            : "در این پوشه فایل md یا ravi پیدا نشد.",
        );
      }
    } catch {
      setLibraryState(libraryFiles.length ? "ready" : "idle");
      setError(
        "اسکن پوشه کامل نشد؛ دسترسی پوشه را بررسی کنید و دوباره تلاش کنید.",
      );
    }
  };

  const applyDesktopLibrary = useCallback(
    (scan: DesktopLibraryScan, silent = false) => {
      const desktop = window.raaviDesktop;
      if (!desktop) return;
      const rootId = scan.rootPath.toLocaleLowerCase("en-US");
      const entries = scan.files.map(
        (file) =>
          ({
            id: `${rootId}:${file.id}`,
            name: file.name,
            path: `${scan.rootName}/${file.path}`,
            rootId,
            documentType: file.documentType,
            size: file.size,
            lastModified: file.lastModified,
            read: () => desktop.readLibraryDocument(file.nativePath),
          }) satisfies LibraryFile,
      );

      setLibraryFiles((current) => [
        ...current.filter((file) => file.rootId !== rootId),
        ...entries,
      ]);
      setLibraryFolders((current) => [
        ...current.filter((folder) => folder.rootId !== rootId),
        {
          rootId,
          rootName: scan.rootName,
          rootPath: scan.rootPath,
        },
      ]);
      setActiveLibraryPath("");
      setLibraryQuery("");
      setLibraryState("ready");
      if (!silent) {
        showNotice(
          scan.truncated
            ? "۲۰٬۰۰۰ فایل اول اضافه شد؛ برای سرعت بیشتر پوشه‌ی کوچک‌تری انتخاب کنید."
            : entries.length
              ? `${entries.length.toLocaleString("fa-IR")} فایل md و ravi به کتابخانه اضافه شد.`
              : "در این پوشه فایل md یا ravi پیدا نشد.",
        );
      }
    },
    [showNotice],
  );

  const connectLibrary = async () => {
    if (window.raaviDesktop) {
      setLibraryState("scanning");
      setError("");
      try {
        const scan = await window.raaviDesktop.chooseMarkdownFolder();
        if (!scan) {
          setLibraryState(libraryFiles.length ? "ready" : "idle");
          return;
        }
        applyDesktopLibrary(scan);
      } catch {
        setLibraryState(libraryFiles.length ? "ready" : "idle");
        setError(
          "اتصال به پوشه انجام نشد؛ دوباره «انتخاب پوشه» را بزنید.",
        );
      }
      return;
    }

    const pickerWindow = window as DirectoryPickerWindow;
    if (!pickerWindow.showDirectoryPicker) {
      directoryInputRef.current?.click();
      return;
    }

    try {
      const handle = await pickerWindow.showDirectoryPicker({ mode: "read" });
      const rootId = `web:${handle.name}`;
      directoryHandlesRef.current.set(rootId, handle);
      setActiveLibraryPath("");
      await scanConnectedDirectory(handle);
    } catch (pickerError) {
      if (
        pickerError instanceof DOMException &&
        pickerError.name === "AbortError"
      ) {
        return;
      }
      setError(
        "اتصال به پوشه انجام نشد؛ دوباره «انتخاب پوشه» را بزنید و اجازه‌ی خواندن بدهید.",
      );
    }
  };

  const handleFallbackDirectory = (files: FileList | null) => {
    if (!files?.length) return;

    const selectedFiles = Array.from(files);
    const firstRelativePath =
      (selectedFiles[0] as File & { webkitRelativePath?: string })
        .webkitRelativePath || selectedFiles[0].name;
    const rootName = firstRelativePath.split("/")[0] || "پوشه‌ی انتخابی";

    const entries = selectedFiles
      .filter((file) => /\.(md|markdown|ravi)$/i.test(file.name))
      .map((file) => {
        const rawPath =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
          file.name;
        const pathParts = rawPath.split("/");
        const relativePath =
          pathParts.length > 1 ? pathParts.slice(1).join("/") : file.name;

        const rootId = `fallback:${rootName}`;
        const documentType: DocumentFileType = /\.ravi$/i.test(file.name)
          ? "ravi"
          : "markdown";
        return {
          id: `${rootId}:${relativePath}:${file.lastModified}:${file.size}`,
          name: file.name,
          path: `${rootName}/${relativePath}`,
          rootId,
          documentType,
          size: file.size,
          lastModified: file.lastModified,
          read: async () => {
            const rawContent = await file.text();
            if (documentType === "ravi") {
              const parsed = parseRaaviDocument(
                rawContent,
                file.name.replace(/\.ravi$/i, ".md"),
              );
              return {
                name: parsed.fileName,
                path: "",
                documentType,
                content: parsed.content,
                annotations: parsed.annotations,
                revision: parsed.revision,
                versions: parsed.versions,
                openInReadingMode: false,
              };
            }
            return {
              name: file.name,
              path: "",
              documentType,
              content: rawContent,
              annotations: [],
              revision: 1,
              versions: [],
              openInReadingMode: false,
            };
          },
        } satisfies LibraryFile;
      })
      .sort((a, b) => a.path.localeCompare(b.path, "fa"));

    const rootId = `fallback:${rootName}`;
    setLibraryFiles((current) => [
      ...current.filter((file) => file.rootId !== rootId),
      ...entries,
    ]);
    setLibraryFolders((current) => [
      ...current.filter((folder) => folder.rootId !== rootId),
      { rootId, rootName, rootPath: "" },
    ]);
    setActiveLibraryPath("");
    setLibraryQuery("");
    setLibraryState("ready");
    showNotice(
      entries.length
        ? `${entries.length.toLocaleString("fa-IR")} فایل md و ravi به کتابخانه اضافه شد.`
        : "در این پوشه فایل md یا ravi پیدا نشد.",
    );
  };

  const openLibraryFile = async (file: LibraryFile) => {
    const maximumSize =
      file.documentType === "ravi" ? 64 * 1024 * 1024 : MAX_FILE_SIZE;
    if (file.size > maximumSize) {
      setError(
        file.documentType === "ravi"
          ? "حجم این فایل راوی بیشتر از ۶۴ مگابایت است."
          : "حجم این فایل Markdown بیشتر از ۲ مگابایت است.",
      );
      return;
    }

    setOpeningLibraryPath(file.path);
    setError("");

    try {
      const document = await file.read();
      applyOpenedDocument(
        {
          ...document,
          openInReadingMode: false,
          draftId: `web-library:${file.path}`,
        },
        `«${file.name}» از کتابخانه باز شد.`,
      );
      setActiveLibraryPath(file.path);
      if (window.matchMedia("(max-width: 820px)").matches) {
        setLibraryOpen(false);
      }
    } catch {
      setError(
        "خواندن این فایل ممکن نبود؛ پوشه را دوباره متصل کنید و مجوز دسترسی را تأیید کنید.",
      );
    } finally {
      setOpeningLibraryPath("");
    }
  };

  const openRecentFile = async (recent: DesktopRecentFile) => {
    const desktop = window.raaviDesktop;
    if (!desktop) return;
    setOpeningLibraryPath(recent.path);
    setError("");
    try {
      const document = await desktop.openRecentDocument(recent.path);
      applyOpenedDocument(document, `«${recent.name}» باز شد.`);
      if (window.matchMedia("(max-width: 820px)").matches) {
        setLibraryOpen(false);
      }
    } catch {
      setRecentFiles((current) =>
        current.filter((item) => item.path !== recent.path),
      );
      setError(
        "این فایل دیگر در مسیر قبلی پیدا نشد؛ آن را دوباره از پوشه باز کنید.",
      );
    } finally {
      setOpeningLibraryPath("");
    }
  };

  const refreshLibrary = async () => {
    setLibraryState("scanning");
    const desktop = window.raaviDesktop;
    const desktopFolders = desktop
      ? libraryFolders.filter((folder) => folder.rootPath)
      : [];
    if (desktop) {
      await Promise.allSettled(
        desktopFolders.map(async (folder) => {
          const scan = await desktop.scanMarkdownFolder(folder.rootPath);
          applyDesktopLibrary(scan, true);
        }),
      );
    }

    const browserHandles = Array.from(directoryHandlesRef.current.values());
    await Promise.allSettled(
      browserHandles.map((handle) =>
        scanConnectedDirectory(handle, true),
      ),
    );
    setLibraryState(
      desktopFolders.length || browserHandles.length ? "ready" : "idle",
    );
    showNotice("کتابخانه به‌روز شد.");
  };

  useEffect(() => {
    let cancelled = false;
    const frame = requestAnimationFrame(() => {
      const desktop = window.raaviDesktop;
      if (!desktop) {
        setLibraryState("idle");
        return;
      }

      void desktop
        .getLibraryState()
        .then(async (state) => {
          if (cancelled) return;
          setRecentFiles(state.recents);
          setLibraryFolders(
            state.folders.map((folder) => ({
              rootId: folder.rootPath.toLocaleLowerCase("en-US"),
              rootName: folder.rootName,
              rootPath: folder.rootPath,
            })),
          );
          if (!state.folders.length) {
            setLibraryState("idle");
            return;
          }

          const scans = await Promise.allSettled(
            state.folders.map((folder) =>
              desktop.scanMarkdownFolder(folder.rootPath),
            ),
          );
          if (cancelled) return;
          for (const result of scans) {
            if (result.status === "fulfilled") {
              applyDesktopLibrary(result.value, true);
            }
          }
          setLibraryState("ready");
        })
        .catch(() => {
          if (!cancelled) setLibraryState("idle");
        });
    });

    return () => {
      cancelAnimationFrame(frame);
      cancelled = true;
    };
  }, [applyDesktopLibrary]);

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void readFile(file);
  };

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget as Node | null;
    if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
      setIsDragging(false);
    }
  };

  const captureEditorSelection = (
    pointer?: { clientX: number; clientY: number },
  ) => {
    if (editorSelectionMenuTimerRef.current) {
      clearTimeout(editorSelectionMenuTimerRef.current);
    }
    setEditorSelectionMenuPosition(null);

    const editor = editorRef.current;
    const selectionStart = editor?.selectionStart ?? 0;
    const selectionEnd = editor?.selectionEnd ?? 0;
    if (!editor || selectionStart === selectionEnd) return;

    editorSelectionMenuTimerRef.current = setTimeout(() => {
      editorSelectionMenuTimerRef.current = null;
      requestAnimationFrame(() => {
      const editor = editorRef.current;
      const editorPane = editorPaneRef.current;
      if (!editor || !editorPane) return;
      if (
        editor.selectionStart !== selectionStart ||
        editor.selectionEnd !== selectionEnd
      ) return;

      const editorRect = editor.getBoundingClientRect();
      const paneRect = editorPane.getBoundingClientRect();
      const selectionAnchor = editor.getSelectionAnchor();
      const anchorClientX =
        pointer?.clientX ??
        selectionAnchor?.clientX ??
        editorRect.left + editorRect.width / 2;
      const anchorClientY =
        pointer?.clientY ?? selectionAnchor?.clientY ?? editorRect.top + 54;
      const placement =
        anchorClientY - editorRect.top >= 58 ? "above" : "below";
      const menuHalfWidth = Math.min(
        96,
        Math.max(82, paneRect.width / 2 - 12),
      );
      const minimumX = menuHalfWidth;
      const maximumX = paneRect.width - menuHalfWidth;
      const rawX = anchorClientX - paneRect.left;

      setEditorSelectionMenuPosition({
        x: Math.min(Math.max(rawX, minimumX), Math.max(minimumX, maximumX)),
        y:
          anchorClientY -
          paneRect.top +
          (placement === "above" ? -10 : 10),
        placement,
      });
      });
    }, EDITOR_SELECTION_MENU_DELAY_MS);
  };

  const insertInline = (
    before: string,
    after: string,
    placeholder: string,
  ) => {
    const editor = editorRef.current;
    if (!editor) return;

    setEditorSelectionMenuPosition(null);
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const editorContent = editor.value;
    const selected = editorContent.slice(start, end) || placeholder;
    const nextContent =
      editorContent.slice(0, start) +
      before +
      selected +
      after +
      editorContent.slice(end);

    setContent(nextContent);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(
        start + before.length,
        start + before.length + selected.length,
      );
    });
  };

  const insertQuote = () => {
    const editor = editorRef.current;
    if (!editor) return;

    setEditorSelectionMenuPosition(null);
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const editorContent = editor.value;
    const selected = editorContent.slice(start, end) || "متن نقل‌قول";
    const quoted = selected
      .split(/\r?\n/u)
      .map((line) => `> ${line}`)
      .join("\n");
    const nextContent =
      editorContent.slice(0, start) + quoted + editorContent.slice(end);

    setContent(nextContent);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start, start + quoted.length);
    });
  };

  const insertHeading = () => {
    const editor = editorRef.current;
    if (!editor) return;

    setEditorSelectionMenuPosition(null);
    const start = editor.selectionStart;
    const editorContent = editor.value;
    const lineStart = editorContent.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextBreak = editorContent.indexOf("\n", start);
    const lineEnd = nextBreak === -1 ? editorContent.length : nextBreak;
    const currentLine = editorContent.slice(lineStart, lineEnd);
    const title = currentLine.replace(/^#{1,6}\s*/u, "").trim() || "عنوان بخش";
    const nextLine = `## ${title}`;
    const nextContent =
      editorContent.slice(0, lineStart) +
      nextLine +
      editorContent.slice(lineEnd);

    setContent(nextContent);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(lineStart + 3, lineStart + nextLine.length);
    });
  };

  const insertList = (
    kind: "check-done" | "check-empty" | "bullet" | "ordered",
  ) => {
    const editor = editorRef.current;
    if (!editor) return;

    setEditorSelectionMenuPosition(null);
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const editorContent = editor.value;
    const selected = editorContent.slice(start, end).trim();
    const items = selected
      ? selected.split(/\r?\n/u)
      : ["مورد اول", "مورد دوم", "مورد سوم"];
    const list = items
      .map((line, index) => {
        const item = line
          .replace(/^\s*(?:[-*+]\s+(?:\[[ xX]\]\s*)?|\d+[.)]\s+)/u, "")
          .trim();
        const prefix =
          kind === "check-done"
            ? "- [x] "
            : kind === "check-empty"
              ? "- [ ] "
              : kind === "ordered"
                ? `${index + 1}. `
                : "- ";
        return `${prefix}${item}`;
      })
      .join("\n");
    const prefix = start > 0 && !editorContent.slice(0, start).endsWith("\n\n") ? "\n\n" : "";
    const suffix = end < editorContent.length && !editorContent.slice(end).startsWith("\n\n") ? "\n\n" : "";
    const inserted = `${prefix}${list}${suffix}`;

    setContent(editorContent.slice(0, start) + inserted + editorContent.slice(end));
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + prefix.length, start + prefix.length + list.length);
    });
  };

  const insertCodeBlock = () => {
    const editor = editorRef.current;
    if (!editor) return;

    setEditorSelectionMenuPosition(null);
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const editorContent = editor.value;
    const selected =
      editorContent.slice(start, end) ||
      'const direction = isCode ? "ltr" : "rtl";\nconsole.log("راوی آماده است");';
    const block = `\`\`\`js\n${selected}\n\`\`\``;
    const prefix = start > 0 && !editorContent.slice(0, start).endsWith("\n\n") ? "\n\n" : "";
    const suffix = end < editorContent.length && !editorContent.slice(end).startsWith("\n\n") ? "\n\n" : "";
    const inserted = `${prefix}${block}${suffix}`;

    setContent(editorContent.slice(0, start) + inserted + editorContent.slice(end));
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(
        start + prefix.length + 6,
        start + prefix.length + 6 + selected.length,
      );
    });
  };

  const insertTable = () => {
    const editor = editorRef.current;
    if (!editor) return;

    setEditorSelectionMenuPosition(null);
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const editorContent = editor.value;
    const table = [
      "| قابلیت | وضعیت | یادداشت |",
      "| :--- | :---: | :--- |",
      "| پیش‌نمایش زنده | ✓ | آماده |",
      "| پاکسازی فارسی | ✓ | نیم‌فاصله و نشانه‌گذاری |",
    ].join("\n");
    const prefix = start > 0 && !editorContent.slice(0, start).endsWith("\n\n") ? "\n\n" : "";
    const suffix = end < editorContent.length && !editorContent.slice(end).startsWith("\n\n") ? "\n\n" : "";
    const inserted = `${prefix}${table}${suffix}`;

    setContent(editorContent.slice(0, start) + inserted + editorContent.slice(end));
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start + prefix.length, start + prefix.length + table.length);
    });
  };

  const cleanPersianMarkdown = () => {
    const editor = editorRef.current;
    const normalized = normalizePersianMarkdown(content);
    setEditorSelectionMenuPosition(null);
    setContent(normalized);
    showNotice("متن فارسی پاکسازی شد");
    requestAnimationFrame(() => {
      if (!editor) return;
      editor.focus();
      const caret = Math.min(editor.selectionStart, normalized.length);
      editor.setSelectionRange(caret, caret);
    });
  };

  const toggleEditorAssistant = (tab: EditorAssistantTab) => {
    setEditorSelectionMenuPosition(null);
    setEditorAssistantTab((current) => (current === tab ? null : tab));
  };

  const jumpToEditorHeading = (offset: number) => {
    setMobilePane("editor");
    setDesktopPaneMode((current) =>
      current === "preview" ? "split" : current,
    );
    requestAnimationFrame(() => {
      editorRef.current?.focus();
      editorRef.current?.setSelectionRange(offset, offset);
    });
  };

  const fixPersianReviewIssue = (issue: PersianReviewIssue) => {
    setContent((current) => applyPersianReviewIssue(current, issue.id));
    showNotice(`«${issue.title}» اصلاح شد`);
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const insertImageAsset = async (file: File) => {
    const editor = editorRef.current;
    const allowedTypes = new Set([
      "image/gif",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);

    if (!editor) return false;
    if (!allowedTypes.has(file.type)) {
      const message = "فقط تصویرهای PNG، JPEG، WebP و GIF قابل افزودن هستند.";
      setError(message);
      setImageInsertError(message);
      return false;
    }
    if (file.size > MAX_RAVI_IMAGE_BYTES) {
      const message = "حجم هر تصویر باید حداکثر ۸ مگابایت باشد.";
      setError(message);
      setImageInsertError(message);
      return false;
    }
    if (imageAssets.length >= MAX_RAVI_IMAGE_ASSETS) {
      const message = "هر سند راوی می‌تواند حداکثر ۸ تصویرِ درج‌شده داشته باشد.";
      setError(message);
      setImageInsertError(message);
      return false;
    }

    try {
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      const editorContent = editor.value;
      const selectedAlt = editorContent
        .slice(start, end)
        .replace(/[\[\]\r\n]/gu, " ")
        .trim();
      const id = `image-${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
      const [data, dimensions] = await Promise.all([
        readImageAssetData(file),
        readImageAssetDimensions(file),
      ]);
      const asset: RaaviImageAsset = {
        id,
        name: file.name.slice(0, 240),
        mimeType: file.type as RaaviImageAsset["mimeType"],
        data,
        ...dimensions,
      };
      const imageMarkdown = `![${selectedAlt || imageAltFromFileName(file.name)}](${raaviImageUrl(id)})`;
      const prefix = start > 0 && !/\n$/u.test(editorContent.slice(0, start))
        ? "\n\n"
        : "";
      const suffix = end < editorContent.length && !/^\n/u.test(editorContent.slice(end))
        ? "\n\n"
        : "";
      const inserted = `${prefix}${imageMarkdown}${suffix}`;
      const nextContent =
        editorContent.slice(0, start) + inserted + editorContent.slice(end);

      setContent(nextContent);
      setImageAssets((current) => [...current, asset]);
      setEditorSelectionMenuPosition(null);
      setError("");
      setImageInsertError("");
      showNotice(
        `«${file.name}» به سند اضافه شد؛ هنگام ذخیرهٔ .ravi همراه سند می‌ماند.`,
      );
      requestAnimationFrame(() => {
        editor.focus();
        const caret = start + prefix.length + imageMarkdown.length;
        editor.setSelectionRange(caret, caret);
      });
      return true;
    } catch {
      const message =
        "تصویر خوانده نشد؛ فایل سالم و از نوع پشتیبانی‌شده انتخاب کنید.";
      setError(message);
      setImageInsertError(message);
      return false;
    }
  };

  const handleImageInputChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void insertImageAsset(file).then((inserted) => {
      if (inserted) setImageModalOpen(false);
    });
  };

  const openImageModal = useCallback(() => {
    setImageSourceMode("local");
    setImageUrl("");
    setImageInsertError("");
    setError("");
    setImageModalOpen(true);
  }, []);

  const insertImageUrl = () => {
    const editor = editorRef.current;
    if (!editor) return;

    let imageUrlValue: URL;
    try {
      imageUrlValue = new URL(imageUrl.trim());
      if (
        !["http:", "https:"].includes(imageUrlValue.protocol) ||
        imageUrlValue.username ||
        imageUrlValue.password
      ) {
        throw new Error("INVALID_IMAGE_URL");
      }
    } catch {
      const message = "یک نشانی مستقیم و معتبر با http یا https وارد کنید.";
      setError(message);
      setImageInsertError(message);
      return;
    }

    setImageInsertError("");
    setError("");

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const editorContent = editor.value;
    const selectedAlt = editorContent
      .slice(start, end)
      .replace(/[\[\]\r\n]/gu, " ")
      .trim();
    const pathName = imageUrlValue.pathname.split("/").filter(Boolean).at(-1);
    let fallbackAlt = "تصویر اینترنتی";
    if (pathName) {
      try {
        fallbackAlt = imageAltFromFileName(decodeURIComponent(pathName));
      } catch {
        // Keep the readable fallback when the path contains malformed escapes.
      }
    }
    const imageMarkdown = `![${selectedAlt || fallbackAlt}](<${imageUrlValue.toString()}>)`;
    const prefix =
      start > 0 && !/\n$/u.test(editorContent.slice(0, start)) ? "\n\n" : "";
    const suffix =
      end < editorContent.length && !/^\n/u.test(editorContent.slice(end))
        ? "\n\n"
        : "";
    const inserted = `${prefix}${imageMarkdown}${suffix}`;

    setContent(
      editorContent.slice(0, start) + inserted + editorContent.slice(end),
    );
    setImageModalOpen(false);
    showNotice(
      "نشانی تصویر درج شد؛ در فایل .ravi فقط URL ذخیره می‌شود و حجم فایل بالا نمی‌رود.",
    );
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        editor.focus();
        const caret = start + prefix.length + imageMarkdown.length;
        editor.setSelectionRange(caret, caret);
      }),
    );
  };

  const restoreMermaidWorkspace = useCallback(
    (session: MermaidStudioSession, focus: "editor" | "preview") => {
      requestAnimationFrame(() => {
        if (editorRef.current) {
          editorRef.current.scrollTop = session.editorScrollTop;
        }
        if (previewScrollRef.current) {
          previewScrollRef.current.scrollTop = session.previewScrollTop;
        }
        if (focus === "editor") editorRef.current?.focus();
        else previewArticleRef.current?.focus({ preventScroll: true });
      });
    },
    [],
  );

  const openMermaidStudio = useCallback(
    (block?: MermaidBlock) => {
      const editor = editorRef.current;
      const mode = block ? "edit" : "create";
      const insertionOffset = editor?.selectionStart ?? content.length;
      mermaidReturnFocusRef.current =
        mode === "edit"
          ? previewArticleRef.current
          : editor?.element ?? previewArticleRef.current;
      setEditorSelectionMenuPosition(null);
      setSelectionDraft(null);
      setComposerKind(null);
      setMermaidStudioSession({
        id:
          globalThis.crypto?.randomUUID?.() ??
          `mermaid-session-${Date.now()}`,
        mode,
        initialCode: block?.code ?? DEFAULT_MERMAID_CODE,
        insertionOffset,
        originalDocument: content,
        block,
        editorScrollTop: editor?.scrollTop ?? 0,
        previewScrollTop: previewScrollRef.current?.scrollTop ?? 0,
      });
    },
    [content],
  );

  const closeMermaidStudio = useCallback(
    (session: MermaidStudioSession) => {
      setMermaidStudioSession(null);
      restoreMermaidWorkspace(
        session,
        session.mode === "create" ? "editor" : "preview",
      );
    },
    [restoreMermaidWorkspace],
  );

  const applyMermaidStudio = useCallback(
    (
      code: string,
      session: MermaidStudioSession,
    ): MermaidApplyResult => {
      if (session.mode === "edit" && session.block) {
        const result = replaceMermaidBlock(
          content,
          session.originalDocument,
          session.block,
          code,
        );
        if (!result.ok) return { ok: false, message: result.message };
        setContent(result.content);
        setMermaidStudioSession(null);
        restoreMermaidWorkspace(session, "preview");
        showNotice("نمودار در همان بلوک به‌روزرسانی شد.");
        return { ok: true };
      }

      const result = insertMermaidBlock(content, session.insertionOffset, code);
      setContent(result.content);
      setMermaidStudioSession(null);
      requestAnimationFrame(() => {
        if (editorRef.current) {
          editorRef.current.scrollTop = session.editorScrollTop;
          editorRef.current.focus();
          editorRef.current.setSelectionRange(
            result.block.codeStartOffset,
            result.block.codeEndOffset,
          );
        }
        if (previewScrollRef.current) {
          previewScrollRef.current.scrollTop = session.previewScrollTop;
        }
      });
      showNotice("نمودار در محل نشانگر به سند اضافه شد.");
      return { ok: true };
    },
    [content, restoreMermaidWorkspace, showNotice],
  );

  const changeReaderSize = (delta: -1 | 1) => {
    preserveReadingViewport(() => {
      setReaderSize((size) => Math.min(22, Math.max(16, size + delta)));
    }, {
      anchor: readingPositionsRef.current[currentDocumentKey] ?? null,
    });
  };

  const toggleThemePreservingReading = () => {
    if (!readingMode) {
      toggleTheme();
      return;
    }
    preserveReadingViewport(toggleTheme, { retries: 6 });
  };

  const openShortcutHelp = () => {
    preserveReadingViewport(() => setShortcutHelpOpen(true), { retries: 2 });
  };

  const closeShortcutHelp = () => {
    preserveReadingViewport(() => setShortcutHelpOpen(false), { retries: 2 });
  };

  const toggleShortcutHelp = () => {
    preserveReadingViewport(
      () => setShortcutHelpOpen((current) => !current),
      { retries: 2 },
    );
  };

  const beginReadingLayoutTransition = () => {
    document.documentElement.classList.add("reading-layout-is-changing");
    if (readingLayoutTransitionTimerRef.current !== null) {
      window.clearTimeout(readingLayoutTransitionTimerRef.current);
    }
    readingLayoutTransitionTimerRef.current = window.setTimeout(() => {
      readingLayoutTransitionTimerRef.current = null;
      document.documentElement.classList.remove("reading-layout-is-changing");
    }, 360);
  };

  const toggleAnnotationPanel = () => {
    preserveReadingViewport(() => {
      setAnnotationPanelOpen((current) => !current);
    }, {
      anchor: readingPositionsRef.current[currentDocumentKey] ?? null,
    });
  };

  const closeAnnotationPanel = (returnFocus = false) => {
    preserveReadingViewport(() => setAnnotationPanelOpen(false), {
      anchor: readingPositionsRef.current[currentDocumentKey] ?? null,
    });
    if (returnFocus) {
      requestAnimationFrame(() =>
        annotationToggleRef.current?.focus({ preventScroll: true }),
      );
    }
  };

  const toggleReadingOutline = () => {
    preserveReadingViewport(() => {
      setReadingOutlineOpen((current) => !current);
      setReadingHeaderVisible(true);
    });
  };

  const restoreVersion = (version: RaaviVersion) => {
    setContent(version.content);
    setAnnotations(version.annotations);
    setSaveState("saved");
    setSaveModalOpen(false);
    setEditorSelectionMenuPosition(null);
    setSelectionDraft(null);
    setComposerKind(null);
    setComposerText("");
    setAnnotationPanelOpen(false);
    setReadingMode(false);
    showNotice(
      `نسخه‌ی ${version.number.toLocaleString("fa-IR")} برای بازبینی بازیابی شد؛ برای ثبت آن ذخیره کنید.`,
    );
  };

  const leaveReadingMode = () => {
    const readingAnchor = captureCurrentReadingPosition("desk");
    const returnTarget = readingReturnFocusRef.current;
    const completeTransition = () => {
      if (!document.querySelector(".app-shell.is-reading")) return;
      beginReadingLayoutTransition();
      preserveReadingViewport(
        () => {
          setReadingMode(false);
          setReadingHeaderVisible(true);
          if (!window.matchMedia("(max-width: 820px)").matches) {
            setLibraryOpen(true);
          }
        },
        { anchor: readingAnchor, settle: true },
      );
      requestAnimationFrame(() =>
        returnTarget?.isConnected
          ? returnTarget.focus({ preventScroll: true })
          : previewArticleRef.current?.focus({ preventScroll: true }),
      );
    };
    void import("./components/markdown-code-editor").then(
      completeTransition,
      completeTransition,
    );
  };

  const toggleReadingMode = () => {
    setMobileEditorToolsExpanded(false);
    if (readingMode) {
      leaveReadingMode();
      return;
    }
    readingReturnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    beginReadingLayoutTransition();
    preserveReadingViewport(
      () => {
        setEditorSelectionMenuPosition(null);
        setReadingMode(true);
        setReadingHeaderVisible(true);
        setLibraryOpen(false);
        setMobileEditorToolsExpanded(false);
        setMobilePane("preview");
      },
      { retries: 4 },
    );
    requestAnimationFrame(() =>
      previewArticleRef.current?.focus({ preventScroll: true }),
    );
  };

  const focusEditor = () => {
    const isMobile = window.matchMedia("(max-width: 820px)").matches;
    const change = () => {
      if (readingMode) setReadingMode(false);
      setMobilePane("editor");
      if (!isMobile) setLibraryOpen(true);
    };
    if (readingMode && isMobile) {
      const position = captureCurrentReadingPosition("desk");
      if (position) commitReadingPosition(position);
      change();
    } else {
      preserveReadingViewport(change);
    }
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const focusPreview = () => {
    const savedPosition =
      readingPositionsRef.current[currentDocumentKey] ??
      lastReadingAnchorRef.current;
    setEditorSelectionMenuPosition(null);
    setMobileEditorToolsExpanded(false);
    setMobilePane("preview");
    if (savedPosition) scheduleReadingRestore(savedPosition);
    requestAnimationFrame(() =>
      previewArticleRef.current?.focus({ preventScroll: true }),
    );
  };

  const focusLibrarySearch = () => {
    const isWebSurface = commandEnvironment.surface === "web";
    preserveReadingViewport(() => {
      if (readingMode) setReadingMode(false);
      setEditorSelectionMenuPosition(null);
      setLibraryTab(isWebSurface ? "history" : "library");
      setLibraryOpen(true);
    });
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        (isWebSurface
          ? libraryCloseRef.current
          : librarySearchRef.current
        )?.focus(),
      ),
    );
  };

  const handleLibraryTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentTab: LibraryTab,
  ) => {
    const availableTabs: LibraryTab[] =
      commandEnvironment.surface === "web"
        ? ["history", "versions"]
        : ["history", "library", "versions"];
    const currentIndex = availableTabs.indexOf(currentTab);
    let nextTab: LibraryTab | null = null;
    if (event.key === "ArrowLeft") {
      nextTab = availableTabs[(currentIndex + 1) % availableTabs.length];
    } else if (event.key === "ArrowRight") {
      nextTab =
        availableTabs[
          (currentIndex - 1 + availableTabs.length) % availableTabs.length
        ];
    } else if (event.key === "Home") {
      nextTab = availableTabs[0];
    } else if (event.key === "End") {
      nextTab = availableTabs.at(-1) ?? null;
    }
    if (!nextTab) return;

    event.preventDefault();
    setLibraryTab(nextTab);
    requestAnimationFrame(() =>
      ({
        history: historyTabRef.current,
        library: libraryTabRef.current,
        versions: versionsTabRef.current,
      })[nextTab]?.focus(),
    );
  };

  const focusAnnotationPanel = () => {
    preserveReadingViewport(() => {
      if (readingMode) setReadingMode(false);
      setMobileEditorToolsExpanded(false);
      setMobilePane("preview");
      setAnnotationPanelOpen(true);
    });
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        annotationPanelRef.current?.focus({ preventScroll: true }),
      ),
    );
  };

  const closeTopLayer = () => {
    if (hoverPreview) {
      clearAnnotationHover();
      return;
    }
    if (topLayer === "about") {
      setAboutModalOpen(false);
      return;
    }
    if (topLayer === "mobileMenu") {
      setMobileHeaderMenuOpen(false);
      return;
    }
    if (topLayer === "support") {
      setSupportModalOpen(false);
      return;
    }
    if (topLayer === "shortcuts") {
      closeShortcutHelp();
      return;
    }
    if (topLayer === "save") {
      setSaveModalOpen(false);
      return;
    }
    if (topLayer === "export") {
      closeExportDialog();
      return;
    }
    if (topLayer === "image") {
      setImageModalOpen(false);
      return;
    }
    if (topLayer === "new") {
      if (!newDocumentCreating) setNewDocumentModalOpen(false);
      return;
    }
    if (topLayer === "library") {
      setLibraryOpen(false);
      return;
    }
    if (composerKind) {
      cancelAnnotationComposer();
      return;
    }
    if (editorSelectionMenuPosition) {
      setEditorSelectionMenuPosition(null);
      requestAnimationFrame(() => editorRef.current?.focus());
      return;
    }
    if (selectionDraft) {
      setSelectionDraft(null);
      setSelectionHighlightRects([]);
      clearNativeSelection();
      requestAnimationFrame(() =>
        previewArticleRef.current?.focus({ preventScroll: true }),
      );
      return;
    }
    if (activeAnnotationId) {
      setActiveAnnotationId("");
      return;
    }
    if (annotationPanelOpen) {
      closeAnnotationPanel(true);
      return;
    }
    if (editorAssistantTab) {
      setEditorAssistantTab(null);
      return;
    }
    if (mobileEditorToolsExpanded) {
      setMobileEditorToolsExpanded(false);
      return;
    }
    if (isCompactLayout && readingMode && readingOutlineOpen) {
      toggleReadingOutline();
      return;
    }
    if (readingMode) leaveReadingMode();
  };

  const hasDismissableLayer = Boolean(
    hoverPreview ||
      topLayer ||
      composerKind ||
      editorSelectionMenuPosition ||
      selectionDraft ||
      activeAnnotationId ||
      annotationPanelOpen ||
      editorAssistantTab ||
      mobileEditorToolsExpanded ||
      readingMode,
  );

  const commandHandlers: Partial<
    Record<CommandId, (event: KeyboardEvent) => void>
  > = {
    "file.open": () => void openDocumentPicker(),
    "file.save": () => {
      if (topLayer === "save") void saveAsFile();
      else void saveCurrentFile();
    },
    "file.saveAs": () => openSaveFileModal(documentType),
    "file.new": openNewDocumentModal,
    "help.shortcuts": () => {
      clearAnnotationHover();
      toggleShortcutHelp();
    },
    "edit.undo": () => editorRef.current?.undo(),
    "edit.redo": () => editorRef.current?.redo(),
    "edit.find": () => editorRef.current?.openSearch(),
    "edit.findNext": () => editorRef.current?.findNext(),
    "edit.findPrevious": () => editorRef.current?.findPrevious(),
    "edit.selectAll": () => editorRef.current?.selectAll(),
    "edit.bold": () => insertInline("**", "**", "متن پررنگ"),
    "edit.italic": () => insertInline("_", "_", "متن مورب"),
    "edit.code": () => insertInline("`", "`", "code"),
    "edit.link": () =>
      insertInline("[", "](https://example.com)", "عنوان پیوند"),
    "edit.image": openImageModal,
    "edit.quote": insertQuote,
    "diagram.mermaid": () => openMermaidStudio(),
    "view.theme": toggleThemePreservingReading,
    "view.reading": toggleReadingMode,
    "focus.editor": focusEditor,
    "focus.preview": focusPreview,
    "focus.library": focusLibrarySearch,
    "focus.annotations": focusAnnotationPanel,
    "view.text.decrease": () => changeReaderSize(-1),
    "view.text.increase": () => changeReaderSize(1),
    "annotation.highlight": () => addAnnotation("highlight"),
    "annotation.comment": () =>
      openAnnotationComposer("comment", commentButtonRef.current),
    "annotation.margin": () =>
      openAnnotationComposer("margin", marginButtonRef.current),
    "annotation.submit": submitAnnotationComposer,
    "layer.dismiss": closeTopLayer,
  };

  const enabledCommandIds = new Set(ALL_COMMAND_IDS);
  const modalIsOpen = Boolean(topLayer);

  const isCommandEnabled = (id: CommandId, event: KeyboardEvent) => {
    const activeElement = document.activeElement;
    const editorFocused = editorRef.current?.contains(activeElement) ?? false;
    const previewFocused = Boolean(
      previewArticleRef.current &&
        (activeElement === previewArticleRef.current ||
          previewArticleRef.current.contains(activeElement)),
    );

    switch (id) {
      case "help.shortcuts":
        return true;
      case "view.theme":
        return !themeTransition;
      case "layer.dismiss":
        if (
          topLayer !== "library" &&
          event.target instanceof Element &&
          event.target.closest('[data-editable-kind="librarySearch"]')
        ) {
          return false;
        }
        return hasDismissableLayer;
      case "file.save":
        return topLayer === "save" || (!modalIsOpen && !composerKind);
      case "file.open":
      case "file.saveAs":
      case "file.new":
        return !modalIsOpen && !composerKind;
      case "edit.bold":
      case "edit.italic":
      case "edit.code":
      case "edit.link":
      case "edit.image":
      case "edit.quote":
      case "edit.undo":
      case "edit.redo":
      case "edit.find":
      case "edit.findNext":
      case "edit.findPrevious":
      case "edit.selectAll":
      case "diagram.mermaid":
        return !modalIsOpen && !composerKind && editorFocused;
      case "view.reading":
      case "focus.editor":
      case "focus.preview":
      case "focus.annotations":
        return !modalIsOpen && !composerKind;
      case "focus.library":
        return (!modalIsOpen || topLayer === "library") && !composerKind;
      case "view.text.decrease":
        return (
          !modalIsOpen &&
          !composerKind &&
          (readingMode || previewFocused) &&
          readerSize > 16
        );
      case "view.text.increase":
        return (
          !modalIsOpen &&
          !composerKind &&
          (readingMode || previewFocused) &&
          readerSize < 22
        );
      case "annotation.highlight":
      case "annotation.comment":
      case "annotation.margin":
        return !modalIsOpen && !composerKind && Boolean(selectionDraft);
      case "annotation.submit":
        return !modalIsOpen && Boolean(composerKind && composerText.trim());
      default:
        return false;
    }
  };

  useCommandSystem({
    environment: commandEnvironment,
    context: { enabledCommandIds },
    handlers: commandHandlers,
    isCommandEnabled,
  });

  const markdownComponents = useMemo<Components>(
    () => ({
      pre: ({ children, node }) => {
        const block = mermaidBlockAtOffset(
          mermaidBlocks,
          node?.position?.start.offset,
        );
        if (block) {
          return (
            <Suspense
              fallback={
                <figure className="mermaid-diagram is-loading" dir="auto">
                  <div className="mermaid-diagram-canvas">
                    <div
                      className="mermaid-diagram-placeholder"
                      role="status"
                      aria-live="polite"
                    >
                      <Network size={24} aria-hidden="true" />
                      <span>در حال آماده‌سازی نمودار…</span>
                    </div>
                  </div>
                </figure>
              }
            >
              <MermaidDiagram
                block={block}
                theme={pdfExportActive ? "light" : themeMode}
                onEdit={openMermaidStudio}
                onFullscreenChange={handleDiagramFullscreenChange}
                readingMode={readingMode}
                exporting={pdfExportActive}
              />
            </Suspense>
          );
        }
        return <pre>{children}</pre>;
      },
      p: ({ children }) => (
        <p dir={blockTextDirection(children)}>{children}</p>
      ),
      h1: ({ children }) => (
        <h1 dir={blockTextDirection(children)}>{children}</h1>
      ),
      h2: ({ children }) => (
        <h2 dir={blockTextDirection(children)}>{children}</h2>
      ),
      h3: ({ children }) => (
        <h3 dir={blockTextDirection(children)}>{children}</h3>
      ),
      h4: ({ children }) => (
        <h4 dir={blockTextDirection(children)}>{children}</h4>
      ),
      h5: ({ children }) => (
        <h5 dir={blockTextDirection(children)}>{children}</h5>
      ),
      h6: ({ children }) => (
        <h6 dir={blockTextDirection(children)}>{children}</h6>
      ),
      li: ({ children, className }) => (
        <li className={className} dir={blockTextDirection(children)}>
          {children}
        </li>
      ),
      blockquote: ({ children }) => (
        <blockquote dir={blockTextDirection(children)}>{children}</blockquote>
      ),
      th: ({ children }) => (
        <th dir={blockTextDirection(children)}>{children}</th>
      ),
      td: ({ children }) => (
        <td dir={blockTextDirection(children)}>{children}</td>
      ),
      a: ({ ...props }) => (
        <a
          {...props}
          dir="auto"
          target="_blank"
          rel="noreferrer noopener"
        />
      ),
      img: ({ src, alt }) => {
        const imageSource = typeof src === "string" ? src.trim() : "";
        const assetId = raaviImageAssetId(imageSource);
        if (assetId) {
          const asset = imageAssetsById.get(assetId);
          if (!asset) {
            return (
              <span className="remote-media-blocked" role="note">
                <ImagePlus size={18} aria-hidden="true" />
                <span>
                  <strong>تصویرِ همراه سند پیدا نشد</strong>
                  <small>
                    این Markdown به تصویر داخلیِ یک فایل .ravi اشاره می‌کند، اما
                    محمولهٔ تصویر در فایل موجود نیست.
                  </small>
                </span>
              </span>
            );
          }

          return (
            // The data URL is a local document asset and cannot use Next image optimization.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="markdown-image"
              src={raaviImageDataUrl(asset)}
              alt={alt ?? asset.name}
              loading="lazy"
              width={asset.width}
              height={asset.height}
            />
          );
        }
        const isRemoteImage = /^(?:https?:)?\/\//i.test(imageSource);

        // Markdown can reference arbitrary local paths, so Next Image cannot pre-resolve them.
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            className="markdown-image markdown-image--provisional-ratio"
            src={src}
            alt={alt ?? ""}
            loading="lazy"
            width={1600}
            height={900}
            referrerPolicy={isRemoteImage ? "no-referrer" : undefined}
          />
        );
      },
    }),
    [
      blockTextDirection,
      imageAssetsById,
      handleDiagramFullscreenChange,
      mermaidBlocks,
      openMermaidStudio,
      readingMode,
      themeMode,
      pdfExportActive,
    ],
  );
  const previewHasFrontmatter = useMemo(
    () => extractWordFrontmatter(content).markdown !== content,
    [content],
  );
  const renderedMarkdownPreview = useMemo(
    () => (
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={raaviMarkdownUrlTransform}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    ),
    [content, markdownComponents],
  );

  const effectivePaneMode: DesktopPaneMode = isCompactLayout
    ? "split"
    : desktopPaneMode;
  const mobileEditorToolsVisible =
    isCompactLayout &&
    !readingMode &&
    mobilePane === "editor" &&
    mobileEditorToolsExpanded;

  useBackLayer(
    "mode:reading",
    readingMode,
    leaveReadingMode,
    isCompactLayout,
  );
  useBackLayer(
    "reading:outline",
    readingMode && readingOutlineOpen,
    toggleReadingOutline,
    isCompactLayout,
  );
  useBackLayer(
    "panel:annotations",
    annotationPanelOpen,
    () => closeAnnotationPanel(true),
    isCompactLayout,
  );
  useBackLayer(
    "annotation:active",
    Boolean(activeAnnotationId),
    () => setActiveAnnotationId(""),
    isCompactLayout,
  );
  useBackLayer(
    "annotation:selection",
    Boolean(selectionDraft),
    () => {
      setSelectionDraft(null);
      setSelectionHighlightRects([]);
      clearNativeSelection();
      requestAnimationFrame(() =>
        previewArticleRef.current?.focus({ preventScroll: true }),
      );
    },
    isCompactLayout,
  );
  useBackLayer(
    "annotation:composer",
    Boolean(composerKind),
    cancelAnnotationComposer,
    isCompactLayout,
  );
  useBackLayer(
    "editor:selection-menu",
    Boolean(editorSelectionMenuPosition),
    () => {
      setEditorSelectionMenuPosition(null);
      requestAnimationFrame(() => editorRef.current?.focus());
    },
    isCompactLayout,
  );
  useBackLayer(
    "editor:assistant",
    Boolean(editorAssistantTab),
    () => setEditorAssistantTab(null),
    isCompactLayout,
  );
  useBackLayer(
    "editor:mobile-tools",
    mobileEditorToolsVisible,
    () => setMobileEditorToolsExpanded(false),
    isCompactLayout,
  );
  useBackLayer(
    "modal:about",
    aboutModalOpen,
    () => setAboutModalOpen(false),
    isCompactLayout,
  );
  useBackLayer(
    "modal:support",
    supportModalOpen,
    () => setSupportModalOpen(false),
    isCompactLayout,
  );
  useBackLayer(
    "modal:shortcuts",
    shortcutHelpOpen,
    closeShortcutHelp,
    isCompactLayout,
  );
  useBackLayer(
    "modal:save",
    saveModalOpen,
    () => setSaveModalOpen(false),
    isCompactLayout,
  );
  useBackLayer(
    "modal:export",
    exportModalOpen,
    closeExportDialog,
    isCompactLayout,
  );
  useBackLayer(
    "modal:image",
    imageModalOpen,
    () => setImageModalOpen(false),
    isCompactLayout,
  );
  useBackLayer(
    "modal:new-document",
    newDocumentModalOpen,
    () => {
      if (!newDocumentCreating) setNewDocumentModalOpen(false);
    },
    isCompactLayout,
  );
  useBackLayer(
    "modal:library",
    libraryOpen,
    () => setLibraryOpen(false),
    isCompactLayout,
  );
  useBackLayer(
    "modal:mobile-menu",
    mobileHeaderMenuOpen,
    () => setMobileHeaderMenuOpen(false),
    isCompactLayout,
  );
  useBackLayer(
    "modal:mermaid-shell",
    Boolean(mermaidStudioSession),
    () => {
      if (mermaidStudioSession) closeMermaidStudio(mermaidStudioSession);
    },
    isCompactLayout,
  );
  const editorPaneCollapsed =
    !readingMode && !isCompactLayout && desktopPaneMode === "preview";
  const previewPaneCollapsed =
    !readingMode && !isCompactLayout && desktopPaneMode === "editor";
  const workspacePaneStyle = {
    "--preview-pane-track":
      effectivePaneMode === "editor"
        ? "0fr"
        : effectivePaneMode === "preview"
          ? "100fr"
          : `${previewPanePercent}fr`,
    "--editor-pane-track":
      effectivePaneMode === "preview"
        ? "0fr"
        : effectivePaneMode === "editor"
          ? "100fr"
          : `${100 - previewPanePercent}fr`,
  } as React.CSSProperties;
  const isWebLibrary =
    hydrated && commandEnvironment.surface === "web";
  const activeLibraryTab: LibraryTab = isWebLibrary
    ? libraryTab === "versions"
      ? "versions"
      : "history"
    : libraryTab;
  return (
    <div
      className={`app-shell ${readingMode ? "is-reading" : ""} ${
        readingMode && !readingHeaderVisible
          ? "reading-header-is-hidden"
          : ""
      }`}
    >
      <header
        className={`topbar ${
          readingMode
            ? readingHeaderVisible
              ? "reading-topbar is-visible"
              : "reading-topbar is-concealed"
            : ""
        }`}
        inert={
          Boolean(mermaidStudioSession) ||
          aboutModalOpen ||
          supportModalOpen ||
          newDocumentModalOpen ||
          saveModalOpen ||
          exportModalOpen ||
          shortcutHelpOpen ||
          mobileHeaderMenuOpen ||
          (libraryOpen && libraryIsModal)
            ? true
            : undefined
        }
      >
        {themeTransition && (
          <div
            className={`theme-transition-overlay ${themeTransition}`}
            aria-hidden="true"
          />
        )}
        <div className="brand-cluster">
          <button
            ref={brandButtonRef}
            className="brand"
            type="button"
            onClick={() => setAboutModalOpen(true)}
            aria-label="دربارهٔ راوی و نسخهٔ فعلی"
            aria-haspopup="dialog"
            aria-expanded={aboutModalOpen}
            title="دربارهٔ راوی و تغییرات نسخه"
          >
            <span className="brand-mark" aria-hidden="true">
              ر
            </span>
            <span className="brand-copy">
              <strong>راوی</strong>
              <small>میز Markdown فارسی</small>
            </span>
          </button>
          <button
            className={`theme-toggle is-${themeMode}`}
            type="button"
            onClick={toggleThemePreservingReading}
            disabled={Boolean(themeTransition)}
            aria-label={
              themeMode === "light"
                ? "فعال‌کردن تم تاریک"
                : "فعال‌کردن تم روشن"
            }
            aria-pressed={themeMode === "dark"}
            aria-keyshortcuts={commandAriaKeyShortcuts(
              "view.theme",
              commandEnvironment,
            )}
            title={commandTitle(
              "view.theme",
              commandEnvironment,
              themeMode === "light" ? "تم تاریک" : "تم روشن",
            )}
          >
            <Sun
              className="theme-toggle-sun"
              size={14}
              aria-hidden="true"
            />
            <Moon
              className="theme-toggle-moon"
              size={13}
              aria-hidden="true"
            />
            <span className="theme-toggle-thumb" aria-hidden="true" />
          </button>
        </div>

        {readingMode && (
          <div
            className="reading-header-document"
            aria-label={`سند در حال مطالعه: ${fileName}`}
          >
            <FileText size={18} aria-hidden="true" />
            <strong dir="auto" title={fileName}>
              {fileName}
            </strong>
            {!readingOutlineOpen && (
              <button
                className="reading-header-outline-toggle"
                type="button"
                onClick={toggleReadingOutline}
                aria-controls="reading-outline-navigation"
                aria-expanded={false}
                aria-label="بازکردن فهرست فصل‌ها"
                title="بازکردن فهرست فصل‌ها"
              >
                <PanelRightOpen size={18} aria-hidden="true" />
                <span>فهرست</span>
              </button>
            )}
          </div>
        )}

        <div className="topbar-actions">
          <span className="local-note">
            <Check size={15} aria-hidden="true" />
            فایل روی همین دستگاه می‌ماند
          </span>
          <button
            ref={supportButtonRef}
            className="button button--support topbar-action--secondary"
            type="button"
            onClick={() => setSupportModalOpen(true)}
            aria-label="حمایت از راوی"
            aria-haspopup="dialog"
            aria-expanded={supportModalOpen}
            title="حمایت از توسعهٔ رایگان راوی"
          >
            <Heart size={18} fill="currentColor" aria-hidden="true" />
            <span>حمایت</span>
          </button>
          <button
            ref={libraryTriggerRef}
            className={`button button--quiet library-trigger mobile-library-trigger topbar-action--library ${
              libraryOpen ? "is-active" : ""
            }`}
            type="button"
            onClick={() => setLibraryOpen((current) => !current)}
            aria-label={
              libraryOpen ? "بستن کتابخانه" : "باز کردن کتابخانه"
            }
            title={libraryOpen ? "بستن کتابخانه" : "باز کردن کتابخانه"}
            aria-controls="library-panel"
            aria-expanded={libraryOpen}
            aria-keyshortcuts={commandAriaKeyShortcuts(
              "focus.library",
              commandEnvironment,
            )}
          >
            <Library size={18} aria-hidden="true" />
            <span>کتابخانه</span>
            {libraryFiles.length > 0 && (
              <b>{libraryFiles.length.toLocaleString("fa-IR")}</b>
            )}
          </button>
          <button
            ref={newDocumentButtonRef}
            className="button button--quiet new-document-trigger topbar-action--secondary"
            type="button"
            onClick={openNewDocumentModal}
            disabled={saveState === "saving"}
            aria-haspopup="dialog"
            aria-expanded={newDocumentModalOpen}
            aria-keyshortcuts={commandAriaKeyShortcuts(
              "file.new",
              commandEnvironment,
            )}
            title={commandTitle(
              "file.new",
              commandEnvironment,
              "ساخت فایل جدید",
            )}
          >
            <FilePlus2 size={18} aria-hidden="true" />
            <span>فایل جدید</span>
          </button>
          <button
            className="button button--primary topbar-action--open"
            type="button"
            onClick={() => void openDocumentPicker()}
            aria-keyshortcuts={commandAriaKeyShortcuts(
              "file.open",
              commandEnvironment,
            )}
            title={commandTitle(
              "file.open",
              commandEnvironment,
              "باز کردن فایل",
            )}
          >
            <Upload size={18} aria-hidden="true" />
            <span>باز کردن فایل</span>
          </button>
          <button
            className="button button--ink topbar-action--save"
            type="button"
            onClick={() => void saveCurrentFile()}
            disabled={saveState === "saving"}
            aria-keyshortcuts={commandAriaKeyShortcuts(
              "file.save",
              commandEnvironment,
            )}
            title={commandTitle(
              "file.save",
              commandEnvironment,
              "ذخیره‌ی نسخه‌ی جدید",
            )}
          >
            <Save size={18} aria-hidden="true" />
            <span>ذخیره</span>
          </button>
          <button
            ref={exportButtonRef}
            className="button button--quiet topbar-action--export"
            type="button"
            onClick={openExportDialog}
            aria-haspopup="dialog"
            aria-expanded={exportModalOpen}
            title="ساخت نسخه‌ی Word یا PDF"
          >
            <FileDown size={18} aria-hidden="true" />
            <span>خروجی</span>
          </button>
          <button
            className={`button button--quiet topbar-action--reading ${
              readingMode ? "is-active" : ""
            }`}
            type="button"
            onClick={toggleReadingMode}
            aria-pressed={readingMode}
            aria-keyshortcuts={commandAriaKeyShortcuts(
              "view.reading",
              commandEnvironment,
            )}
            title={commandTitle(
              "view.reading",
              commandEnvironment,
              readingMode ? "بازگشت به میز" : "حالت مطالعه",
            )}
          >
            {readingMode ? (
              <X size={18} aria-hidden="true" />
            ) : (
              <BookOpen size={18} aria-hidden="true" />
            )}
            <span>{readingMode ? "بازگشت به میز" : "حالت مطالعه"}</span>
          </button>
          <button
            ref={mobileHeaderMenuButtonRef}
            className="button button--quiet mobile-topbar-menu-trigger"
            type="button"
            onClick={() => {
              setMobileEditorToolsExpanded(false);
              setMobileHeaderMenuOpen(true);
            }}
            aria-label="بازکردن منوی راوی"
            aria-haspopup="dialog"
            aria-expanded={mobileHeaderMenuOpen}
            title="منوی راوی"
          >
            <Menu size={19} aria-hidden="true" />
          </button>
        </div>
      </header>

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept=".md,.markdown,.ravi,text/markdown,application/json"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void readFile(file);
          event.currentTarget.value = "";
        }}
        tabIndex={-1}
      />

      <AccessibleModal
        open={mobileHeaderMenuOpen}
        isTopLayer={topLayer === "mobileMenu"}
        onClose={() => setMobileHeaderMenuOpen(false)}
        dialogRef={mobileHeaderMenuRef}
        initialFocusRef={mobileHeaderMenuCloseRef}
        returnFocusRef={mobileHeaderMenuButtonRef}
        backdropClassName="mobile-topbar-menu-backdrop"
        dialogClassName="mobile-topbar-menu"
        labelledBy="mobile-topbar-menu-title"
      >
        <div className="mobile-topbar-menu-header">
          <div>
            <span>دسترسی سریع</span>
            <strong id="mobile-topbar-menu-title">منوی راوی</strong>
          </div>
          <button
            ref={mobileHeaderMenuCloseRef}
            type="button"
            onClick={() => setMobileHeaderMenuOpen(false)}
            aria-label="بستن منوی راوی"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <div className="mobile-topbar-menu-grid">
          <button
            type="button"
            onClick={() => {
              setMobileHeaderMenuOpen(false);
              void openDocumentPicker();
            }}
          >
            <Upload size={20} aria-hidden="true" />
            <span>
              <strong>بازکردن فایل</strong>
              <small>از همین دستگاه</small>
            </span>
          </button>
          <button
            type="button"
            disabled={saveState === "saving"}
            onClick={() => {
              setMobileHeaderMenuOpen(false);
              openNewDocumentModal();
            }}
          >
            <FilePlus2 size={20} aria-hidden="true" />
            <span>
              <strong>سند تازه</strong>
              <small>شروع یک نوشته</small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileHeaderMenuOpen(false);
              toggleReadingMode();
            }}
          >
            <BookOpen size={20} aria-hidden="true" />
            <span>
              <strong>حالت مطالعه</strong>
              <small>خواندن بدون مزاحمت</small>
            </span>
          </button>
          <button type="button" onClick={openExportDialog}>
            <FileDown size={20} aria-hidden="true" />
            <span>
              <strong>خروجی Word یا PDF</strong>
              <small>نسخه‌ی آماده‌ی تحویل</small>
            </span>
          </button>
          <button
            type="button"
            disabled={Boolean(themeTransition)}
            aria-pressed={themeMode === "dark"}
            onClick={() => {
              setMobileHeaderMenuOpen(false);
              toggleThemePreservingReading();
            }}
          >
            {themeMode === "light" ? (
              <Moon size={20} aria-hidden="true" />
            ) : (
              <Sun size={20} aria-hidden="true" />
            )}
            <span>
              <strong>{themeMode === "light" ? "تم تاریک" : "تم روشن"}</strong>
              <small>تغییر فضای میز</small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileHeaderMenuOpen(false);
              setSupportModalOpen(true);
            }}
          >
            <Heart size={20} aria-hidden="true" />
            <span>
              <strong>حمایت از راوی</strong>
              <small>ادامهٔ توسعهٔ رایگان</small>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setMobileHeaderMenuOpen(false);
              setAboutModalOpen(true);
            }}
          >
            <span className="mobile-topbar-menu-mark" aria-hidden="true">
              ر
            </span>
            <span>
              <strong>دربارهٔ راوی</strong>
              <small>نسخه و تغییرات</small>
            </span>
          </button>
        </div>
      </AccessibleModal>

      <div
        className="proofbar"
        aria-label="وضعیت سند"
        inert={
          Boolean(mermaidStudioSession) ||
          aboutModalOpen ||
          supportModalOpen ||
          newDocumentModalOpen ||
          saveModalOpen ||
          exportModalOpen ||
          shortcutHelpOpen ||
          mobileHeaderMenuOpen ||
          (libraryOpen && libraryIsModal)
            ? true
            : undefined
        }
      >
        <div className="document-identity" title={fileName}>
          <FileText size={16} aria-hidden="true" />
          <span>{fileName}</span>
        </div>

        <button
          className={`save-indicator is-${effectiveSaveState}`}
          type="button"
          onClick={() => void saveCurrentFile()}
          disabled={effectiveSaveState === "saving"}
          aria-live="polite"
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
          <span
            className={`status-dot is-${effectiveSaveState}`}
          />
          {effectiveSaveState === "saving"
            ? "در حال ذخیره…"
            : effectiveSaveState === "error"
              ? "ذخیره ناموفق"
              : effectiveSaveState === "dirty"
                ? "هشدار: ذخیره نشده"
                : "ذخیره شده"}
        </button>

        <span className="revision-badge" title="نسخه‌ی فعلی سند">
          <History size={14} aria-hidden="true" />
          نسخه {revision.toLocaleString("fa-IR")}
        </span>

        <div className="document-stats" aria-label="آمار نوشته">
          <span>{stats.words.toLocaleString("fa-IR")} واژه</span>
          <span>{stats.lines.toLocaleString("fa-IR")} خط</span>
        </div>

        <div className="mobile-tabs" role="tablist" aria-label="نمای موبایل">
          <button
            role="tab"
            aria-selected={mobilePane === "editor"}
            type="button"
            onClick={() => setMobilePane("editor")}
          >
            ویرایش
          </button>
          <button
            role="tab"
            aria-selected={mobilePane === "preview"}
            type="button"
            onClick={() => {
              setMobileEditorToolsExpanded(false);
              setMobilePane("preview");
            }}
          >
            پیش‌نمایش
          </button>
        </div>
      </div>

      {error && (
        <div
          className="error-banner"
          role="alert"
          inert={
            Boolean(mermaidStudioSession) ||
            aboutModalOpen ||
            supportModalOpen ||
            newDocumentModalOpen ||
            saveModalOpen ||
            exportModalOpen ||
            shortcutHelpOpen ||
            mobileHeaderMenuOpen ||
            (libraryOpen && libraryIsModal)
              ? true
              : undefined
          }
        >
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="بستن خطا">
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      <div
        className={`workspace-frame ${
          libraryOpen ? "library-is-open" : ""
        }`}
        inert={
          Boolean(mermaidStudioSession) ||
          aboutModalOpen ||
          supportModalOpen ||
          newDocumentModalOpen ||
          saveModalOpen ||
          exportModalOpen ||
          shortcutHelpOpen ||
          mobileHeaderMenuOpen
            ? true
            : undefined
        }
      >
        <main
          ref={workspaceRef}
          className={`workspace ${
            readingMode ? "workspace--reading" : ""
          } ${
            readingMode
              ? readingOutlineOpen
                ? "reading-outline-is-open"
                : "reading-outline-is-collapsed"
              : ""
          } ${
            !readingMode ? `pane-layout-is-${effectivePaneMode}` : ""
          } ${paneDragging ? "is-resizing-panes" : ""} ${
            mobileEditorToolsVisible ? "mobile-editor-tools-is-open" : ""
          }`}
          style={workspacePaneStyle}
          data-pane-layout={effectivePaneMode}
          data-collapse-candidate={paneCollapseCandidate ?? undefined}
          inert={libraryOpen && libraryIsModal ? true : undefined}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
        <input
          ref={imageInputRef}
          className="visually-hidden"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={handleImageInputChange}
          tabIndex={-1}
        />

        {isDragging && (
          <div className="drop-overlay" role="status">
            <div className="drop-seal">
              <Upload size={30} aria-hidden="true" />
            </div>
            <strong>فایل Markdown یا .ravi را همین‌جا رها کنید</strong>
            <span>فایل در مرورگر شما باز می‌شود</span>
          </div>
        )}

        {readingMode && readingOutlineOpen && (
          <aside
            className="reading-outline is-open"
            aria-label="فهرست فصل‌های سند"
          >
            <div className="reading-outline-header">
              <div className="reading-outline-title">
                <ListTree size={18} aria-hidden="true" />
                <span>
                  <strong>فصل‌ها</strong>
                  <small>
                    {readingHeadings.length.toLocaleString("fa-IR")} بخش
                  </small>
                </span>
              </div>
              <button
                className="reading-outline-toggle"
                type="button"
                onClick={toggleReadingOutline}
                aria-controls="reading-outline-navigation"
                aria-expanded={true}
                aria-label="جمع‌کردن فهرست فصل‌ها"
                title="جمع‌کردن فهرست فصل‌ها"
              >
                <PanelRightClose size={18} aria-hidden="true" />
              </button>
            </div>

            <nav
              className="reading-outline-navigation"
              id="reading-outline-navigation"
              aria-label="فصل‌های متن"
            >
              {readingHeadings.length ? (
                <ol>
                  {readingHeadings.map((heading) => (
                    <li
                      className={`is-level-${heading.level}`}
                      key={`${heading.documentIndex}-${heading.text}`}
                    >
                      <button
                        type="button"
                        dir="auto"
                        className={
                          activeReadingHeadingIndex === heading.documentIndex
                            ? "is-active"
                            : ""
                        }
                        onClick={() =>
                          focusReadingHeading(heading.documentIndex)
                        }
                        aria-current={
                          activeReadingHeadingIndex === heading.documentIndex
                            ? "location"
                            : undefined
                        }
                        title={heading.text}
                      >
                        {heading.text}
                      </button>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="reading-outline-empty">
                  <ListTree size={24} aria-hidden="true" />
                  <strong>فصلی پیدا نشد</strong>
                  <span>
                    برای ساخت فهرست، در متن از تیترهای Markdown استفاده کنید.
                  </span>
                </div>
              )}
            </nav>
          </aside>
        )}

        <section
          ref={editorPaneRef}
          className={`work-pane editor-pane ${
            mobilePane !== "editor" ? "is-hidden-mobile" : ""
          } ${editorPaneCollapsed ? "is-pane-collapsed" : ""}`}
          aria-label="ویرایشگر Markdown"
          aria-hidden={editorPaneCollapsed || undefined}
          inert={editorPaneCollapsed ? true : undefined}
        >
          <div className="pane-header">
            <div className="pane-title">
              <span className="folio">برگ ۱</span>
              <strong>ویرایش</strong>
              <button
                className="pane-visibility-toggle"
                type="button"
                onClick={() => collapseDesktopPane("editor")}
                aria-label="پنهان‌کردن ویرایشگر"
                title="پنهان‌کردن ویرایشگر و گسترش پیش‌نمایش"
              >
                <PanelRightClose size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="format-tools" aria-label="ابزار قالب‌بندی">
              <span className="format-tool-group" aria-label="قالب متن">
              <button
                className="format-tool--expanded-only"
                type="button"
                onClick={insertHeading}
                aria-label="درج تیتر"
                title="درج تیتر Markdown"
              >
                <Heading1 size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => insertInline("**", "**", "متن پررنگ")}
                aria-label="پررنگ"
                aria-keyshortcuts={commandAriaKeyShortcuts(
                  "edit.bold",
                  commandEnvironment,
                )}
                title={commandTitle("edit.bold", commandEnvironment)}
              >
                <Bold size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => insertInline("_", "_", "متن مورب")}
                aria-label="مورب"
                aria-keyshortcuts={commandAriaKeyShortcuts(
                  "edit.italic",
                  commandEnvironment,
                )}
                title={commandTitle("edit.italic", commandEnvironment)}
              >
                <Italic size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => insertInline("`", "`", "code")}
                aria-label="کد درون‌خطی"
                aria-keyshortcuts={commandAriaKeyShortcuts(
                  "edit.code",
                  commandEnvironment,
                )}
                title={commandTitle("edit.code", commandEnvironment)}
              >
                <Code2 size={16} aria-hidden="true" />
              </button>
              <button
                className="format-tool--expanded-only"
                type="button"
                onClick={insertCodeBlock}
                aria-label="درج قطعه‌کد"
                title="درج قطعه‌کد LTR"
              >
                <Braces size={16} aria-hidden="true" />
              </button>
              <button
                className="format-tool--expanded-only"
                type="button"
                onClick={insertQuote}
                aria-label="نقل‌قول"
                aria-keyshortcuts={commandAriaKeyShortcuts(
                  "edit.quote",
                  commandEnvironment,
                )}
                title={commandTitle("edit.quote", commandEnvironment)}
              >
                <Quote size={16} aria-hidden="true" />
              </button>
              <button
                className="format-tool--expanded-only"
                type="button"
                onClick={() =>
                  insertInline("[", "](https://example.com)", "عنوان پیوند")
                }
                aria-label="افزودن پیوند"
                aria-keyshortcuts={commandAriaKeyShortcuts(
                  "edit.link",
                  commandEnvironment,
                )}
                title={commandTitle("edit.link", commandEnvironment)}
              >
                <Link2 size={16} aria-hidden="true" />
              </button>
              </span>
              <span className="format-tool-group" aria-label="درج بلوک">
              <button
                className="format-tool--expanded-only"
                type="button"
                onClick={() => insertList("check-done")}
                aria-label="درج چک‌لیست انجام‌شده"
                title="چک‌لیست انجام‌شده"
              >
                <ListChecks size={16} aria-hidden="true" />
              </button>
              <button
                className="format-tool--expanded-only"
                type="button"
                onClick={() => insertList("check-empty")}
                aria-label="درج چک‌لیست خالی"
                title="چک‌لیست خالی"
              >
                <ListTodo size={16} aria-hidden="true" />
              </button>
              <button
                className="format-tool--expanded-only"
                type="button"
                onClick={() => insertList("bullet")}
                aria-label="درج فهرست بولت‌دار"
                title="فهرست بولت‌دار"
              >
                <ListIcon size={16} aria-hidden="true" />
              </button>
              <button
                className="format-tool--expanded-only"
                type="button"
                onClick={() => insertList("ordered")}
                aria-label="درج فهرست شماره‌ای"
                title="فهرست شماره‌ای"
              >
                <ListOrdered size={16} aria-hidden="true" />
              </button>
              <button
                className="format-tool--expanded-only"
                type="button"
                onClick={insertTable}
                aria-label="درج جدول"
                title="درج جدول Markdown"
              >
                <Table2 size={16} aria-hidden="true" />
              </button>
              <button
                ref={imageInsertButtonRef}
                type="button"
                onClick={openImageModal}
                aria-label="افزودن تصویر"
                aria-haspopup="dialog"
                aria-expanded={imageModalOpen}
                aria-keyshortcuts={commandAriaKeyShortcuts(
                  "edit.image",
                  commandEnvironment,
                )}
                title={commandTitle("edit.image", commandEnvironment)}
              >
                <ImagePlus size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => openMermaidStudio()}
                aria-label="ساخت نمودار Mermaid"
                aria-haspopup="dialog"
                aria-expanded={Boolean(mermaidStudioSession)}
                aria-keyshortcuts={commandAriaKeyShortcuts(
                  "diagram.mermaid",
                  commandEnvironment,
                )}
                title={commandTitle(
                  "diagram.mermaid",
                  commandEnvironment,
                  "ساخت یا درج نمودار Mermaid",
                )}
              >
                <Network size={16} aria-hidden="true" />
              </button>
              </span>
              <span className="tool-divider" aria-hidden="true" />
              <span className="format-tool-group format-tool-group--editor" aria-label="ابزار ویرایشگر">
                <button
                  className="format-tool--expanded-only"
                  type="button"
                  onClick={() => editorRef.current?.undo()}
                  aria-label="واگرد"
                  aria-keyshortcuts={commandAriaKeyShortcuts(
                    "edit.undo",
                    commandEnvironment,
                  )}
                  title={commandTitle("edit.undo", commandEnvironment)}
                >
                  <Undo2 size={16} aria-hidden="true" />
                </button>
                <button
                  className="format-tool--expanded-only"
                  type="button"
                  onClick={() => editorRef.current?.redo()}
                  aria-label="ازنو"
                  aria-keyshortcuts={commandAriaKeyShortcuts(
                    "edit.redo",
                    commandEnvironment,
                  )}
                  title={commandTitle("edit.redo", commandEnvironment)}
                >
                  <Redo2 size={16} aria-hidden="true" />
                </button>
                <button
                  className="format-tool--expanded-only"
                  type="button"
                  onClick={() => editorRef.current?.openSearch()}
                  aria-label="جست‌وجو و جایگزینی"
                  aria-keyshortcuts={commandAriaKeyShortcuts(
                    "edit.find",
                    commandEnvironment,
                  )}
                  title={commandTitle("edit.find", commandEnvironment)}
                >
                  <Search size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={`format-tool--expanded-only ${
                    editorAssistantTab === "outline" ? "is-active" : ""
                  }`}
                  onClick={() => toggleEditorAssistant("outline")}
                  aria-label="نمایش ساختار سند"
                  aria-pressed={editorAssistantTab === "outline"}
                  title="ساختار سند"
                >
                  <ListTree size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className={editorAssistantTab === "review" ? "is-active" : ""}
                  onClick={() => toggleEditorAssistant("review")}
                  aria-label={`بازبینی فارسی؛ ${persianReviewIssues.length} نوع اصلاح`}
                  aria-pressed={editorAssistantTab === "review"}
                  title="بازبینی فارسی"
                >
                  <Wand2 size={16} aria-hidden="true" />
                  {persianReviewIssues.length > 0 && (
                    <span className="format-tool-badge" aria-hidden="true">
                      {persianReviewIssues.length}
                    </span>
                  )}
                </button>
              </span>
              <button
                className="format-tool-expand"
                type="button"
                onClick={() => {
                  if (isCompactLayout) {
                    setMobileEditorToolsExpanded((current) => !current);
                    return;
                  }
                  collapseDesktopPane("preview");
                }}
                aria-expanded={
                  isCompactLayout ? mobileEditorToolsVisible : undefined
                }
                aria-label={
                  isCompactLayout
                    ? mobileEditorToolsVisible
                      ? "بستن ابزارهای بیشتر ویرایش"
                      : "نمایش ابزارهای بیشتر ویرایش"
                    : "نمایش تمام‌صفحهٔ ویرایشگر و همهٔ ابزارها"
                }
                title={
                  isCompactLayout
                    ? mobileEditorToolsVisible
                      ? "بستن ابزارهای بیشتر"
                      : "نمایش ابزارهای بیشتر"
                    : "نمایش همهٔ ابزارها در ویرایشگر تمام‌صفحه"
                }
              >
                {mobileEditorToolsVisible ? (
                  <X size={18} aria-hidden="true" />
                ) : (
                  <Ellipsis size={18} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          <div className="editor-surface">
            {!readingMode && (
              <Suspense
                fallback={
                  <div className="editor-loading" role="status" aria-live="polite">
                    ویرایشگر در حال آماده‌شدن است…
                  </div>
                }
              >
                <MarkdownCodeEditor
                  id="markdown-editor"
                  ref={editorRef}
                  value={content}
                  onChange={(nextContent) => {
                    setEditorSelectionMenuPosition(null);
                    setContent(nextContent);
                    if (saveState === "error") setSaveState("saved");
                  }}
                  onScroll={() => {
                    setEditorSelectionMenuPosition(null);
                    handleSyncedScroll("editor");
                  }}
                  onSelectionChange={captureEditorSelection}
                  transformPastedText={normalizePersianMarkdown}
                  ariaDescribedBy="editor-hint"
                />
              </Suspense>
            )}

            {editorAssistantTab && (
              <aside
                className="editor-assistant"
                aria-label={
                  editorAssistantTab === "outline"
                    ? "ساختار سند"
                    : "بازبینی فارسی"
                }
              >
                <div className="editor-assistant-header">
                  <div>
                    <span>ابزار نمونه‌خوان</span>
                    <strong>
                      {editorAssistantTab === "outline"
                        ? "ساختار سند"
                        : "بازبینی فارسی"}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditorAssistantTab(null)}
                    aria-label="بستن پنل ابزار"
                    title="بستن"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>

                {editorAssistantTab === "outline" ? (
                  documentEditorHeadings.length ? (
                    <nav className="editor-outline" aria-label="تیترهای سند">
                      {documentEditorHeadings.map((heading, index) => (
                        <button
                          key={`${heading.offset}-${heading.text}`}
                          type="button"
                          className={`is-level-${Math.min(heading.level, 4)}`}
                          onClick={() => jumpToEditorHeading(heading.offset)}
                        >
                          <span>
                            {(index + 1).toLocaleString("fa-IR", {
                              minimumIntegerDigits: 2,
                              useGrouping: false,
                            })}
                          </span>
                          {heading.text}
                        </button>
                      ))}
                    </nav>
                  ) : (
                    <div className="editor-assistant-empty">
                      <Heading1 size={20} aria-hidden="true" />
                      <strong>هنوز تیتری ندارید</strong>
                      <p>با تیترها، سند بلند سریع‌تر مرور می‌شود.</p>
                      <button type="button" onClick={insertHeading}>
                        افزودن اولین تیتر
                      </button>
                    </div>
                  )
                ) : persianReviewIssues.length ? (
                  <>
                    <div className="review-summary">
                      <span>{persianReviewIssues.length} نوع اصلاح</span>
                      <button type="button" onClick={cleanPersianMarkdown}>
                        اصلاح همه
                      </button>
                    </div>
                    <div className="review-issues">
                      {persianReviewIssues.map((issue) => (
                        <button
                          key={issue.id}
                          type="button"
                          onClick={() => fixPersianReviewIssue(issue)}
                        >
                          <span className="review-issue-count">{issue.count}</span>
                          <span>
                            <strong>{issue.title}</strong>
                            <small>{issue.detail}</small>
                          </span>
                          <Wand2 size={14} aria-hidden="true" />
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="editor-assistant-empty is-clean">
                    <Check size={20} aria-hidden="true" />
                    <strong>متن فارسی مرتب است</strong>
                    <p>نویسه‌ها، فاصله‌ها و نشانه‌گذاری مشکلی ندارند.</p>
                  </div>
                )}
              </aside>
            )}
          </div>
          {editorSelectionMenuPosition && (
            <div
              ref={editorSelectionMenuRef}
              className={`selection-mini-menu editor-selection-mini-menu is-${editorSelectionMenuPosition.placement}`}
              role="toolbar"
              aria-label="قالب‌بندی متن انتخاب‌شده"
              aria-orientation="horizontal"
              style={
                {
                  left: editorSelectionMenuPosition.x,
                  top: editorSelectionMenuPosition.y,
                } as React.CSSProperties
              }
              onPointerDown={(event) => {
                if (event.pointerType === "mouse") event.preventDefault();
              }}
            >
              <button
                className="editor-mini-action"
                type="button"
                onClick={() => insertInline("**", "**", "متن پررنگ")}
                aria-label="پررنگ"
                aria-keyshortcuts={commandAriaKeyShortcuts(
                  "edit.bold",
                  commandEnvironment,
                )}
                title={commandTitle("edit.bold", commandEnvironment)}
              >
                <Bold size={15} aria-hidden="true" />
              </button>
              <button
                className="editor-mini-action"
                type="button"
                onClick={() => insertInline("_", "_", "متن مورب")}
                aria-label="مورب"
                aria-keyshortcuts={commandAriaKeyShortcuts(
                  "edit.italic",
                  commandEnvironment,
                )}
                title={commandTitle("edit.italic", commandEnvironment)}
              >
                <Italic size={15} aria-hidden="true" />
              </button>
              <button
                className="editor-mini-action"
                type="button"
                onClick={() => insertInline("`", "`", "code")}
                aria-label="کد درون‌خطی"
                aria-keyshortcuts={commandAriaKeyShortcuts(
                  "edit.code",
                  commandEnvironment,
                )}
                title={commandTitle("edit.code", commandEnvironment)}
              >
                <Code2 size={15} aria-hidden="true" />
              </button>
              <button
                className="editor-mini-action"
                type="button"
                onClick={insertQuote}
                aria-label="نقل‌قول"
                aria-keyshortcuts={commandAriaKeyShortcuts(
                  "edit.quote",
                  commandEnvironment,
                )}
                title={commandTitle("edit.quote", commandEnvironment)}
              >
                <Quote size={15} aria-hidden="true" />
              </button>
              <button
                className="editor-mini-action"
                type="button"
                onClick={() =>
                  insertInline("[", "](https://example.com)", "عنوان پیوند")
                }
                aria-label="افزودن پیوند"
                aria-keyshortcuts={commandAriaKeyShortcuts(
                  "edit.link",
                  commandEnvironment,
                )}
                title={commandTitle("edit.link", commandEnvironment)}
              >
                <Link2 size={15} aria-hidden="true" />
              </button>
            </div>
          )}
          <div className="pane-footer" id="editor-hint">
            <div className="editor-status">
              <span>
                <i aria-hidden="true" /> CodeMirror
              </span>
              <span>جهت هوشمند سطر</span>
              <button
                type="button"
                onClick={() => toggleEditorAssistant("review")}
                className={persianReviewIssues.length ? "has-issues" : ""}
              >
                {persianReviewIssues.length
                  ? `${persianReviewIssues.length} نوع اصلاح فارسی`
                  : "متن فارسی مرتب"}
              </button>
            </div>
            <button
              className="editor-shortcut-help"
              type="button"
              onClick={openShortcutHelp}
              aria-haspopup="dialog"
              aria-expanded={shortcutHelpOpen}
            >
              <Keyboard size={14} aria-hidden="true" />
              نمایش همهٔ میان‌برها
            </button>
          </div>
        </section>

        <div
          className={`registration-spine ${
            scrollSyncEnabled && desktopPaneMode === "split"
              ? "is-scroll-synced"
              : ""
          } ${
            desktopPaneMode !== "split" ? "has-collapsed-pane" : ""
          } ${
            paneCollapseCandidate
              ? `is-collapse-ready is-collapse-ready-${paneCollapseCandidate}`
              : ""
          }`}
        >
          {desktopPaneMode === "split" && !readingMode && (
            <div
              className="pane-resize-handle"
              role="separator"
              tabIndex={0}
              aria-label="تغییر اندازهٔ ویرایشگر و پیش‌نمایش"
              aria-orientation="vertical"
              aria-valuemin={PANE_COLLAPSE_THRESHOLD}
              aria-valuemax={100 - PANE_COLLAPSE_THRESHOLD}
              aria-valuenow={Math.round(previewPanePercent)}
              aria-valuetext={`پیش‌نمایش ${Math.round(
                previewPanePercent,
              ).toLocaleString("fa-IR")} درصد، ویرایشگر ${(
                100 - Math.round(previewPanePercent)
              ).toLocaleString("fa-IR")} درصد`}
              title="برای تغییر اندازه بکشید؛ Enter تقسیم را برابر می‌کند"
              onPointerDown={handlePaneResizePointerDown}
              onKeyDown={handlePaneResizeKeyDown}
              onDoubleClick={() => {
                lastExpandedPreviewPercentRef.current = 50;
                setPreviewPanePercent(50);
                setPaneCandidate(null);
              }}
            />
          )}
          <span className="registration-dot" aria-hidden="true" />
          <span className="spine-line" aria-hidden="true" />
          {desktopPaneMode === "split" ? (
            <button
              className="scroll-sync-toggle"
              type="button"
              onClick={toggleScrollSync}
              aria-label={
                scrollSyncEnabled
                  ? "باز کردن قفل اسکرول هماهنگ"
                  : "قفل کردن اسکرول ادیتور و پیش‌نمایش"
              }
              aria-pressed={scrollSyncEnabled}
              title={
                scrollSyncEnabled
                  ? "اسکرول هماهنگ فعال است؛ برای آزاد کردن کلیک کنید"
                  : "قفل کردن اسکرول ادیتور و پیش‌نمایش"
              }
            >
              {scrollSyncEnabled ? (
                <Lock size={14} aria-hidden="true" />
              ) : (
                <LockOpen size={14} aria-hidden="true" />
              )}
            </button>
          ) : (
            <button
              className="pane-reveal-toggle"
              type="button"
              onClick={() =>
                restoreDesktopPanes(
                  desktopPaneMode === "editor" ? "preview" : "editor",
                )
              }
              aria-label={
                desktopPaneMode === "editor"
                  ? "نمایش پیش‌نمایش"
                  : "نمایش ویرایشگر"
              }
              title={
                desktopPaneMode === "editor"
                  ? "نمایش دوبارهٔ پیش‌نمایش"
                  : "نمایش دوبارهٔ ویرایشگر"
              }
            >
              {desktopPaneMode === "editor" ? (
                <PanelLeftOpen size={16} aria-hidden="true" />
              ) : (
                <PanelRightOpen size={16} aria-hidden="true" />
              )}
            </button>
          )}
          <span className="spine-label" aria-hidden="true">
            {desktopPaneMode === "editor"
              ? "نمایش پیش‌نمایش"
              : desktopPaneMode === "preview"
                ? "نمایش ویرایشگر"
                : scrollSyncEnabled
                  ? "اسکرول هماهنگ"
                  : "اسکرول آزاد"}
          </span>
          <span className="spine-line" aria-hidden="true" />
          <span
            className="registration-dot registration-dot--bottom"
            aria-hidden="true"
          />
        </div>

        <section
          className={`work-pane preview-pane ${
            mobilePane !== "preview" ? "is-hidden-mobile" : ""
          } ${previewPaneCollapsed ? "is-pane-collapsed" : ""}`}
          aria-label="پیش‌نمایش Markdown"
          aria-hidden={previewPaneCollapsed || undefined}
          inert={previewPaneCollapsed ? true : undefined}
        >
          <div className="pane-header">
            <div className="pane-title">
              <span className="folio">برگ ۲</span>
              <strong>
                <Eye size={16} aria-hidden="true" />
                پیش‌نمایش
              </strong>
              <button
                className="pane-visibility-toggle"
                type="button"
                onClick={() => collapseDesktopPane("preview")}
                aria-label="پنهان‌کردن پیش‌نمایش"
                title="پنهان‌کردن پیش‌نمایش و گسترش ویرایشگر"
              >
                <PanelLeftClose size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="preview-header-actions">
              <button
                ref={annotationToggleRef}
                className={`annotation-toggle ${
                  annotationPanelOpen ? "is-active" : ""
                }`}
                type="button"
                onClick={toggleAnnotationPanel}
                aria-expanded={annotationPanelOpen}
                aria-controls="annotation-panel"
                aria-keyshortcuts={commandAriaKeyShortcuts(
                  "focus.annotations",
                  commandEnvironment,
                )}
                title={commandTitle(
                  "focus.annotations",
                  commandEnvironment,
                  "نمایش یادداشت‌ها",
                )}
              >
                <PanelLeftOpen size={16} aria-hidden="true" />
                <span>یادداشت‌ها</span>
                <b>{annotations.length.toLocaleString("fa-IR")}</b>
              </button>
              <div className="reader-controls" aria-label="اندازه‌ی متن">
                <button
                  type="button"
                  onClick={() => changeReaderSize(-1)}
                  disabled={readerSize <= 16}
                  aria-label="کوچک‌تر کردن متن"
                  aria-keyshortcuts={commandAriaKeyShortcuts(
                    "view.text.decrease",
                    commandEnvironment,
                  )}
                  title={commandTitle(
                    "view.text.decrease",
                    commandEnvironment,
                    "کوچک‌تر کردن متن",
                  )}
                >
                  <Minus size={15} aria-hidden="true" />
                </button>
                <span aria-live="polite">
                  {readerSize.toLocaleString("fa-IR")}
                </span>
                <button
                  type="button"
                  onClick={() => changeReaderSize(1)}
                  disabled={readerSize >= 22}
                  aria-label="بزرگ‌تر کردن متن"
                  aria-keyshortcuts={commandAriaKeyShortcuts(
                    "view.text.increase",
                    commandEnvironment,
                  )}
                  title={commandTitle(
                    "view.text.increase",
                    commandEnvironment,
                    "بزرگ‌تر کردن متن",
                  )}
                >
                  <Plus size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div
            className={`annotation-toolbar ${
              composerKind && selectionDraft
                ? "has-selection is-composing"
                : ""
            }`}
          >
            {composerKind && selectionDraft ? (
              <>
                <div className="annotation-composer-copy">
                  <span>{ANNOTATION_LABELS[composerKind]}</span>
                  <q dir="auto">{selectionDraft.quote}</q>
                </div>
                <label className="annotation-composer-field">
                  <span className="visually-hidden">
                    متن {ANNOTATION_LABELS[composerKind]}
                  </span>
                  <textarea
                    ref={composerTextAreaRef}
                    value={composerText}
                    onFocus={restoreComposerReadingViewport}
                    onChange={(event) => {
                      restoreComposerReadingViewport();
                      setComposerText(event.target.value);
                    }}
                    placeholder={
                      composerKind === "comment"
                        ? "نظر یا بازخورد خود را بنویسید…"
                        : "یادداشت حاشیه‌ای را بنویسید…"
                    }
                    dir="auto"
                    data-editable-kind="composer"
                    aria-keyshortcuts={commandAriaKeyShortcuts(
                      "annotation.submit",
                      commandEnvironment,
                    )}
                  />
                </label>
                <div className="annotation-composer-actions">
                  <button
                    className="annotation-action annotation-action--primary"
                    type="button"
                    onClick={submitAnnotationComposer}
                    disabled={!composerText.trim()}
                  >
                    <Send size={15} aria-hidden="true" />
                    ثبت
                  </button>
                  <button
                    className="annotation-action"
                    type="button"
                    onClick={() => {
                      cancelAnnotationComposer();
                    }}
                  >
                    لغو
                  </button>
                </div>
              </>
            ) : (
              <span className="annotation-instruction">
                <Highlighter size={15} aria-hidden="true" />
                بخشی از متن پیش‌نمایش را انتخاب کنید؛ سپس هایلایت یا یادداشت
                بسازید.
              </span>
            )}
          </div>

          <div
            className={`preview-stage ${
              annotationPanelOpen ? "annotations-open" : ""
            }`}
          >
            {annotationPanelOpen && (
              <aside
                ref={annotationPanelRef}
                className="annotation-panel"
                id="annotation-panel"
                aria-label="یادداشت‌های سند"
                tabIndex={-1}
              >
                <div className="annotation-panel-header">
                  <div>
                    <strong>حاشیه‌های سند</strong>
                    <span>
                      {annotations.length.toLocaleString("fa-IR")} مورد
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => closeAnnotationPanel()}
                    aria-label="بستن حاشیه‌ها"
                  >
                    <X size={17} aria-hidden="true" />
                  </button>
                </div>

                <div className="annotation-legend" aria-label="آمار یادداشت‌ها">
                  <span>
                    <Highlighter size={13} aria-hidden="true" />
                    {annotationCounts.highlight.toLocaleString("fa-IR")}
                  </span>
                  <span>
                    <MessageCircle size={13} aria-hidden="true" />
                    {annotationCounts.comment.toLocaleString("fa-IR")}
                  </span>
                  <span>
                    <NotebookPen size={13} aria-hidden="true" />
                    {annotationCounts.margin.toLocaleString("fa-IR")}
                  </span>
                </div>

                <div className="annotation-list">
                  {annotations.length ? (
                    annotations.map((annotation, index) => (
                      <article
                        id={`annotation-card-${annotation.id}`}
                        className={`annotation-card is-${annotation.kind} ${
                          activeAnnotationId === annotation.id
                            ? "is-active"
                            : ""
                        }`}
                        key={annotation.id}
                      >
                        <div className="annotation-card-heading">
                          <span>
                            <AnnotationIcon kind={annotation.kind} />
                            {ANNOTATION_LABELS[annotation.kind]}
                          </span>
                          <b>#{(index + 1).toLocaleString("fa-IR")}</b>
                        </div>
                        <button
                          className="annotation-quote"
                          type="button"
                          onClick={() => focusAnnotation(annotation)}
                          title="رفتن به محل یادداشت"
                        >
                          <q dir="auto">{annotation.quote}</q>
                        </button>
                        {annotation.kind !== "highlight" && (
                          <label className="annotation-body">
                            <span className="visually-hidden">
                              ویرایش {ANNOTATION_LABELS[annotation.kind]}
                            </span>
                            <textarea
                              value={annotation.body}
                              onChange={(event) =>
                                updateAnnotationBody(
                                  annotation.id,
                                  event.target.value,
                                )
                              }
                              dir="auto"
                              rows={3}
                              data-editable-kind="annotationBody"
                            />
                          </label>
                        )}
                        <div className="annotation-card-footer">
                          <button
                            type="button"
                            onClick={() => focusAnnotation(annotation)}
                          >
                            نمایش در متن
                          </button>
                          <button
                            className="annotation-delete"
                            type="button"
                            onClick={() => removeAnnotation(annotation.id)}
                            aria-label={`حذف ${ANNOTATION_LABELS[annotation.kind]}`}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                            حذف
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <div className="annotation-empty">
                      <NotebookPen size={28} aria-hidden="true" />
                      <strong>هنوز یادداشتی ندارید</strong>
                      <span>
                        متنی را در برگه انتخاب کنید تا اولین حاشیه ساخته شود.
                      </span>
                    </div>
                  )}
                </div>
              </aside>
            )}

            <div
              ref={previewScrollRef}
              className="preview-scroll"
              onScroll={() => handleSyncedScroll("preview")}
              style={
                { "--reader-size": `${readerSize}px` } as React.CSSProperties
              }
            >
            {selectionDraft &&
              selectionHighlightRects.map((rect, index) => (
                <span
                  aria-hidden="true"
                  className="selection-range-feedback"
                  key={`${rect.left}-${rect.top}-${index}`}
                  style={
                    {
                      left: rect.left,
                      top: rect.top,
                      width: rect.width,
                      height: rect.height,
                    } as React.CSSProperties
                  }
                />
              ))}
            <div
              className="visually-hidden"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {selectionDraft
                ? `${selectionDraft.quote.length.toLocaleString("fa-IR")} نویسه انتخاب شد؛ ابزارهای کپی، هایلایت و یادداشت در دسترس‌اند.`
                : ""}
            </div>
            {selectionDraft &&
              selectionMenuPosition &&
              !composerKind && (
                <div
                  ref={selectionMenuRef}
                  className={`selection-mini-menu is-${selectionMenuPosition.placement}`}
                  role="toolbar"
                  aria-label="ابزار متن انتخاب‌شده"
                  aria-orientation="horizontal"
                  style={
                    {
                      left: selectionMenuPosition.x,
                      top: selectionMenuPosition.y,
                    } as React.CSSProperties
                  }
                  onPointerDown={(event) => {
                    if (event.pointerType === "mouse") event.preventDefault();
                  }}
                >
                  <button
                    className="annotation-action annotation-action--copy"
                    type="button"
                    onClick={() => void copyPreviewSelection()}
                    title="کپی متن انتخاب‌شده"
                  >
                    <Copy size={14} aria-hidden="true" />
                    کپی
                  </button>
                  <button
                    className="annotation-action annotation-action--highlight"
                    type="button"
                    onClick={() => addAnnotation("highlight")}
                    aria-keyshortcuts={commandAriaKeyShortcuts(
                      "annotation.highlight",
                      commandEnvironment,
                    )}
                    title={commandTitle(
                      "annotation.highlight",
                      commandEnvironment,
                    )}
                  >
                    <Highlighter size={14} aria-hidden="true" />
                    هایلایت
                  </button>
                  <button
                    ref={commentButtonRef}
                    className="annotation-action annotation-action--comment"
                    type="button"
                    onClick={() =>
                      openAnnotationComposer(
                        "comment",
                        commentButtonRef.current,
                      )
                    }
                    aria-keyshortcuts={commandAriaKeyShortcuts(
                      "annotation.comment",
                      commandEnvironment,
                    )}
                    title={commandTitle(
                      "annotation.comment",
                      commandEnvironment,
                    )}
                  >
                    <MessageCircle size={14} aria-hidden="true" />
                    کامنت
                  </button>
                  <button
                    ref={marginButtonRef}
                    className="annotation-action annotation-action--margin"
                    type="button"
                    onClick={() =>
                      openAnnotationComposer(
                        "margin",
                        marginButtonRef.current,
                      )
                    }
                    aria-keyshortcuts={commandAriaKeyShortcuts(
                      "annotation.margin",
                      commandEnvironment,
                    )}
                    title={commandTitle(
                      "annotation.margin",
                      commandEnvironment,
                    )}
                  >
                    <NotebookPen size={14} aria-hidden="true" />
                    حاشیه
                  </button>
                </div>
              )}
            {content.trim() ? (
              <article
                ref={previewArticleRef}
                className={`markdown-body ${
                  hoveredAnnotation ? "has-annotation-hover" : ""
                }`}
                data-raavi-frontmatter={previewHasFrontmatter ? "" : undefined}
                dir={documentTextDirection}
                tabIndex={-1}
                aria-label="متن پیش‌نمایش؛ برای جابه‌جایی سریع از میان‌بر تمرکز پیش‌نمایش استفاده کنید"
                onPointerDown={() => {
                  if (!composerKind) {
                    setSelectionDraft(null);
                    setSelectionHighlightRects([]);
                    setSelectionMenuPosition(null);
                  }
                }}
                onMouseUp={(event) =>
                  capturePreviewSelection({
                    clientX: event.clientX,
                    clientY: event.clientY,
                  })
                }
                onKeyUp={() => capturePreviewSelection()}
                onPointerMove={handleAnnotationPointerMove}
                onPointerLeave={clearAnnotationHover}
                onClick={handleAnnotationClick}
              >
                {renderedMarkdownPreview}
              </article>
            ) : (
              <div className="empty-preview">
                <span className="empty-sheet" aria-hidden="true">
                  <FileText size={34} />
                </span>
                <strong>این برگ هنوز خالی است</strong>
                <p>در بخش ویرایش بنویسید یا یک فایل Markdown باز کنید.</p>
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => void openDocumentPicker()}
                >
                  <Upload size={17} aria-hidden="true" />
                  باز کردن فایل
                </button>
              </div>
            )}
            </div>
          </div>

          <div className="pane-footer pane-footer--split">
            <span>Markdown استاندارد با پشتیبانی از جدول و چک‌لیست</span>
            <span className="ravi-share-hint">
              <MessageSquareText size={14} aria-hidden="true" />
              برای اشتراک سند همراه با هایلایت، کامنت و تصویرهای درج‌شده، از پسوند
              <code dir="ltr">.ravi</code>
              استفاده کنید.
            </span>
          </div>
        </section>
        </main>

        {libraryOpen && (
          <aside
            ref={libraryPanelRef}
            className="library-panel"
            id="library-panel"
            role={libraryIsModal ? "dialog" : undefined}
            aria-modal={libraryIsModal || undefined}
            aria-labelledby="library-title"
          >
            <div className="library-header">
              <div>
                <span className="library-kicker">قفسه‌ی محلی</span>
                <strong id="library-title">کتابخانه</strong>
              </div>
              <div className="library-header-actions">
                <button
                  ref={libraryCloseRef}
                  className="library-close"
                  type="button"
                  onClick={() => setLibraryOpen(false)}
                  aria-label="بستن کتابخانه"
                  title="بستن کتابخانه"
                >
                  <X size={18} aria-hidden="true" />
                  <span>بستن کتابخانه</span>
                </button>
              </div>
            </div>

            <input
              ref={directoryInputRef}
              className="visually-hidden"
              type="file"
              accept=".md,.markdown,.ravi,text/markdown,application/json"
              multiple
              {...({
                webkitdirectory: "",
                directory: "",
              } as React.InputHTMLAttributes<HTMLInputElement>)}
              onChange={(event) => {
                handleFallbackDirectory(event.target.files);
                event.currentTarget.value = "";
              }}
              tabIndex={-1}
            />

            <div
              className={`library-tabs ${
                isWebLibrary ? "library-tabs--single" : ""
              }`}
              role="tablist"
              aria-label="بخش‌های کتابخانه"
            >
              <button
                ref={historyTabRef}
                id="library-history-tab"
                type="button"
                role="tab"
                aria-selected={activeLibraryTab === "history"}
                aria-controls="library-history-panel"
                tabIndex={activeLibraryTab === "history" ? 0 : -1}
                onClick={() => setLibraryTab("history")}
                onKeyDown={(event) =>
                  handleLibraryTabKeyDown(event, "history")
                }
              >
                <Clock3 size={16} aria-hidden="true" />
                <span>تاریخچه</span>
                <b>{recentFiles.length.toLocaleString("fa-IR")}</b>
              </button>
              {!isWebLibrary && (
                <button
                  ref={libraryTabRef}
                  id="library-catalog-tab"
                  type="button"
                  role="tab"
                  aria-selected={activeLibraryTab === "library"}
                  aria-controls="library-catalog-panel"
                  tabIndex={activeLibraryTab === "library" ? 0 : -1}
                  onClick={() => setLibraryTab("library")}
                  onKeyDown={(event) =>
                    handleLibraryTabKeyDown(event, "library")
                  }
                >
                  <Library size={16} aria-hidden="true" />
                  <span>کتابخانه</span>
                  <b>{libraryFiles.length.toLocaleString("fa-IR")}</b>
                </button>
              )}
              <button
                ref={versionsTabRef}
                id="library-versions-tab"
                type="button"
                role="tab"
                aria-selected={activeLibraryTab === "versions"}
                aria-controls="library-versions-panel"
                tabIndex={activeLibraryTab === "versions" ? 0 : -1}
                onClick={() => setLibraryTab("versions")}
                onKeyDown={(event) =>
                  handleLibraryTabKeyDown(event, "versions")
                }
              >
                <History size={16} aria-hidden="true" />
                <span>نسخه‌ها</span>
                <b>{versions.length.toLocaleString("fa-IR")}</b>
              </button>
            </div>

            <div
              className={`library-content is-${activeLibraryTab} ${
                isWebLibrary ? "is-web-library" : ""
              }`}
            >
              {isWebLibrary && activeLibraryTab !== "versions" && (
                <section
                  className="library-install-prompt"
                  aria-labelledby="library-install-title"
                >
                  <div className="library-install-copy">
                    <span className="library-install-icon" aria-hidden="true">
                      <Download size={19} />
                    </span>
                    <div>
                      <strong id="library-install-title">
                        تجربه بهتر با نسخه دسکتاپ
                      </strong>
                      <p>{desktopInstallRecommendation.description}</p>
                    </div>
                  </div>
                  <a
                    className="button button--primary library-install-action"
                    href={desktopInstallRecommendation.href}
                    aria-label={`${desktopInstallRecommendation.actionLabel}، پیشنهادشده برای ${desktopInstallRecommendation.platformLabel}`}
                  >
                    <Download size={16} aria-hidden="true" />
                    <span>{desktopInstallRecommendation.actionLabel}</span>
                  </a>
                </section>
              )}
              {recentFiles.length > 0 && (
                <section
                  className="library-section library-history-section"
                  id="library-history-panel"
                  role="tabpanel"
                  aria-labelledby="library-history-tab"
                  tabIndex={0}
                  hidden={activeLibraryTab !== "history"}
                >
                  <div className="library-section-title">
                    <span>
                      <Clock3 size={15} aria-hidden="true" />
                      <strong id="recent-title">فایل‌های اخیر</strong>
                    </span>
                    <small>{recentFiles.length.toLocaleString("fa-IR")}</small>
                  </div>
                  <div className="recent-list">
                    {recentFiles.map((recent) => (
                      <button
                        key={recent.path}
                        className="recent-file"
                        type="button"
                        onClick={() => void openRecentFile(recent)}
                        title={recent.path}
                      >
                        {recent.documentType === "ravi" ? (
                          <FileArchive size={15} aria-hidden="true" />
                        ) : (
                          <FileText size={15} aria-hidden="true" />
                        )}
                        <span>
                          <strong dir="auto">{recent.name}</strong>
                          <small dir="auto">{recent.path}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}
              {recentFiles.length === 0 && (
                <div
                  className="library-empty library-history-empty"
                  id="library-history-panel"
                  role="tabpanel"
                  aria-labelledby="library-history-tab"
                  tabIndex={0}
                  hidden={activeLibraryTab !== "history"}
                >
                  <Clock3 size={28} aria-hidden="true" />
                  <strong>هنوز فایلی باز نشده است</strong>
                  <span>فایل‌های md و ravi که باز می‌کنید اینجا می‌مانند.</span>
                </div>
              )}

              <section
                className="library-section library-versions-section"
                id="library-versions-panel"
                role="tabpanel"
                aria-labelledby="library-versions-tab"
                tabIndex={0}
                hidden={activeLibraryTab !== "versions"}
              >
                <div className="library-section-title">
                  <span>
                    <History size={15} aria-hidden="true" />
                    <strong>تاریخچهٔ نسخه‌ها</strong>
                  </span>
                  <small dir="auto" title={fileName}>
                    {fileName}
                  </small>
                </div>
                {versions.length > 0 ? (
                  <ol className="library-version-list">
                    {[...versions].reverse().map((version) => (
                      <li key={`${version.number}-${version.savedAt}`}>
                        <span className="library-version-index" aria-hidden="true">
                          {version.number.toLocaleString("fa-IR")}
                        </span>
                        <span className="library-version-copy">
                          <strong>
                            نسخهٔ {version.number.toLocaleString("fa-IR")}
                          </strong>
                          <time dateTime={version.savedAt}>
                            {new Date(version.savedAt).toLocaleString("fa-IR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </time>
                          <small>
                            {version.content.length.toLocaleString("fa-IR")} نویسه
                            {version.annotations.length > 0 &&
                              ` · ${version.annotations.length.toLocaleString("fa-IR")} یادداشت`}
                          </small>
                        </span>
                        <button
                          type="button"
                          onClick={() => restoreVersion(version)}
                          aria-label={`بازیابی نسخهٔ ${version.number.toLocaleString("fa-IR")}`}
                        >
                          <RefreshCw size={14} aria-hidden="true" />
                          بازیابی
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="library-empty library-versions-empty">
                    <History size={28} aria-hidden="true" />
                    <strong>هنوز نسخه‌ای ثبت نشده است</strong>
                    <span>
                      با اولین ذخیره، نسخهٔ سند در این بخش نگه‌داری می‌شود.
                    </span>
                  </div>
                )}
              </section>

              {!isWebLibrary && (
                <div
                  id="library-catalog-panel"
                  role="tabpanel"
                  aria-labelledby="library-catalog-tab"
                  tabIndex={0}
                  hidden={activeLibraryTab !== "library"}
                >
              <section
                className="library-section library-pinned-section"
                aria-labelledby="pinned-files-title"
              >
                <div className="library-section-title">
                  <span>
                    <Pin size={15} aria-hidden="true" />
                    <strong id="pinned-files-title">سنجاق‌شده‌ها</strong>
                  </span>
                  <small>
                    {pinnedLibraryFiles.length.toLocaleString("fa-IR")}
                  </small>
                </div>
                {pinnedLibraryFiles.length > 0 ? (
                  <ul className="library-pinned-list">
                    {pinnedLibraryFiles.map((file) => (
                      <li key={libraryPinKey(file)}>
                        <LibraryFileRow
                          file={file}
                          activePath={activeLibraryPath}
                          isPinned
                          onOpenFile={(selectedFile) =>
                            void openLibraryFile(selectedFile)
                          }
                          onTogglePin={togglePinnedLibraryFile}
                          placement="pinned"
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="library-pinned-empty">
                    {pinnedLibraryKeys.length > 0
                      ? "پوشهٔ فایل‌های سنجاق‌شده را دوباره متصل کنید."
                      : "فایل‌های مهم را با آیکن سنجاق اینجا نگه دارید."}
                  </p>
                )}
              </section>

              <section
                className="library-section library-folders-section"
                aria-labelledby="folders-title"
              >
                <div className="library-section-title">
                  <span>
                    <FolderOpen size={15} aria-hidden="true" />
                    <strong id="folders-title">پوشه‌ها</strong>
                  </span>
                  <div className="library-tab-actions">
                    <small>
                      {libraryFolders.length.toLocaleString("fa-IR")}
                    </small>
                    <button
                      type="button"
                      onClick={() => void connectLibrary()}
                      aria-label="افزودن پوشه به کتابخانه"
                      title="افزودن پوشه"
                    >
                      <FolderPlus size={18} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void refreshLibrary()}
                      disabled={libraryState === "scanning"}
                      aria-label="به‌روزرسانی کتابخانه"
                      title="به‌روزرسانی"
                    >
                      <RefreshCw
                        className={
                          libraryState === "scanning" ? "is-spinning" : ""
                        }
                        size={17}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>

                {libraryFolders.length > 0 && (
                  <div className="library-folder-list">
                    {libraryFolders.map((folder) => (
                      <div key={folder.rootId} className="library-folder-chip" title={folder.rootPath}>
                        <Folder size={14} aria-hidden="true" />
                        <span dir="auto">{folder.rootName}</span>
                      </div>
                    ))}
                  </div>
                )}

              </section>

              <label className="library-search">
                <Search size={16} aria-hidden="true" />
                <span className="visually-hidden">جست‌وجو در کتابخانه</span>
                <input
                  ref={librarySearchRef}
                  type="search"
                  value={libraryQuery}
                  onChange={(event) => setLibraryQuery(event.target.value)}
                  placeholder="جست‌وجوی نام یا مسیر…"
                  dir="auto"
                  data-editable-kind="librarySearch"
                  aria-keyshortcuts={commandAriaKeyShortcuts(
                    "focus.library",
                    commandEnvironment,
                  )}
                />
                {libraryQuery && (
                  <button
                    type="button"
                    onClick={() => setLibraryQuery("")}
                    aria-label="پاک‌کردن جست‌وجو"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </label>

              <div className="library-summary">
                <span>
                  {visibleLibraryFiles.length.toLocaleString("fa-IR")} فایل md و ravi
                </span>
                {libraryState === "scanning" && (
                  <span className="library-loading">
                    <RefreshCw className="is-spinning" size={13} aria-hidden="true" />
                    در حال اسکن
                  </span>
                )}
              </div>

              <div className="library-tree">
                {visibleLibraryFiles.length ? (
                  <LibraryBranch
                    node={libraryTree}
                    activePath={activeLibraryPath}
                    pinnedKeys={pinnedLibraryKeySet}
                    onOpenFile={(file) => void openLibraryFile(file)}
                    onTogglePin={togglePinnedLibraryFile}
                    isRoot
                  />
                ) : (
                  <div className="library-empty">
                    <FolderOpen size={28} aria-hidden="true" />
                    <strong>
                      {libraryQuery
                        ? "فایلی با این عبارت پیدا نشد"
                        : libraryState === "scanning"
                          ? "در حال اسکن پوشه‌ها…"
                          : "هنوز پوشه‌ای در کتابخانه نیست"}
                    </strong>
                    <span>
                      {libraryQuery
                        ? "عبارت جست‌وجو را تغییر دهید."
                        : "یک پوشه اضافه کنید تا فایل‌های md و ravi همیشه در دسترس باشند."}
                    </span>
                  </div>
                )}
              </div>
                </div>
              )}
            </div>

            <div className="library-footer">
              {openingLibraryPath ? (
                <span>در حال باز کردن فایل…</span>
              ) : activeLibraryTab === "library" && activeLibraryPath ? (
                <span dir="auto" title={activeLibraryPath}>
                  {activeLibraryPath}
                </span>
              ) : activeLibraryTab === "history" && recentFiles.length === 0 ? (
                <span>فایل‌های بازشده در این بخش نمایش داده می‌شوند.</span>
              ) : activeLibraryTab === "versions" ? (
                <span>
                  نسخهٔ بعدی {Math.max(revision + 1, 1).toLocaleString("fa-IR")} با ذخیرهٔ سند ثبت می‌شود.
                </span>
              ) : (
                <span>برای بازکردن، روی نام فایل کلیک کنید.</span>
              )}
            </div>

            {!isWebLibrary && (
              <div
                className="library-privacy"
                hidden={activeLibraryTab !== "library"}
              >
                <ShieldCheck size={17} aria-hidden="true" />
                <span>
                  اسکن فقط پس از اجازه‌ی شما انجام می‌شود؛ فایلی به اینترنت ارسال
                  نمی‌شود.
                </span>
              </div>
            )}
          </aside>
        )}
      </div>

      {readingMode && !readingHeaderVisible && (
        <button
          className="reading-return-handle"
          type="button"
          onClick={leaveReadingMode}
          aria-label="بازگشت به میز"
          title="بازگشت به میز"
        >
          <X size={17} aria-hidden="true" />
          <span>بازگشت به میز</span>
        </button>
      )}

      {mermaidStudioSession && (
        <Suspense
          fallback={
            <AccessibleModal
              open
              isTopLayer={topLayer === "mermaid"}
              onClose={() => closeMermaidStudio(mermaidStudioSession)}
              dialogRef={mermaidLoadingModalRef}
              returnFocusRef={mermaidReturnFocusRef}
              backdropClassName="mermaid-studio-backdrop"
              dialogClassName="mermaid-studio-loading"
              labelledBy="mermaid-studio-loading-title"
              describedBy="mermaid-studio-loading-description"
            >
              <Network size={22} aria-hidden="true" />
              <div role="status" aria-live="polite">
                <strong id="mermaid-studio-loading-title">ساخت نمودار در حال آماده‌شدن است</strong>
                <span id="mermaid-studio-loading-description">
                  ابزارهای نمودار فقط هنگام نیاز بارگذاری می‌شوند.
                </span>
              </div>
            </AccessibleModal>
          }
        >
          <MermaidStudio
            key={mermaidStudioSession.id}
            open
            isTopLayer={topLayer === "mermaid"}
            session={mermaidStudioSession}
            fileName={fileName}
            theme={themeMode}
            onApply={applyMermaidStudio}
            onClose={closeMermaidStudio}
            returnFocusRef={mermaidReturnFocusRef}
            backNavigationEnabled={isCompactLayout}
          />
        </Suspense>
      )}

      {newDocumentModalOpen && (
        <Suspense
          fallback={
            <DeferredDialogFallback
              id="new-document"
              title="فرم ساخت فایل در حال آماده‌شدن است"
              isTopLayer={topLayer === "new"}
              onClose={() => {
                if (newDocumentCreating) return;
                setNewDocumentModalOpen(false);
                setNewDocumentError("");
              }}
              returnFocusRef={
                isCompactLayout
                  ? mobileHeaderMenuButtonRef
                  : newDocumentButtonRef
              }
            />
          }
        >
          <NewDocumentDialog
            open
            isTopLayer={topLayer === "new"}
            isDesktop={commandEnvironment.surface === "electron"}
            hasUnsavedChanges={effectiveSaveState !== "saved"}
            creating={newDocumentCreating}
            creationError={newDocumentError}
            returnFocusRef={
              isCompactLayout ? mobileHeaderMenuButtonRef : newDocumentButtonRef
            }
            onClose={() => {
              if (newDocumentCreating) return;
              setNewDocumentModalOpen(false);
              setNewDocumentError("");
            }}
            onCreate={(spec) => void createNewDocument(spec)}
            onSaveCurrent={saveBeforeCreatingNew}
          />
        </Suspense>
      )}

      {aboutModalOpen && (
        <Suspense
          fallback={
            <DeferredDialogFallback
              id="about"
              title="دربارهٔ راوی در حال آماده‌شدن است"
              isTopLayer={topLayer === "about"}
              onClose={() => setAboutModalOpen(false)}
              returnFocusRef={brandButtonRef}
            />
          }
        >
          <AboutDialog
            open
            isTopLayer={topLayer === "about"}
            version={packageMetadata.version}
            returnFocusRef={brandButtonRef}
            onClose={() => setAboutModalOpen(false)}
          />
        </Suspense>
      )}

      {supportModalOpen && (
        <Suspense
          fallback={
            <DeferredDialogFallback
              id="support"
              title="راه‌های حمایت در حال آماده‌شدن است"
              isTopLayer={topLayer === "support"}
              onClose={() => setSupportModalOpen(false)}
              returnFocusRef={
                isCompactLayout ? mobileHeaderMenuButtonRef : supportButtonRef
              }
            />
          }
        >
          <SupportDialog
            open
            isTopLayer={topLayer === "support"}
            returnFocusRef={
              isCompactLayout ? mobileHeaderMenuButtonRef : supportButtonRef
            }
            onClose={() => {
              setSupportModalOpen(false);
            }}
          />
        </Suspense>
      )}

      <ExportDialog
        open={exportModalOpen}
        isTopLayer={topLayer === "export"}
        returnFocusRef={
          isCompactLayout ? mobileHeaderMenuButtonRef : exportButtonRef
        }
        format={exportFormat}
        fileName={exportNameForFormat(fileName, exportFormat)}
        status={exportStatus}
        progressLabel={exportProgressLabel}
        warnings={exportWarnings}
        diagramConfirmed={exportDiagramConfirmed}
        error={exportError}
        directPdf={commandEnvironment.surface === "electron"}
        onFormatChange={changeExportFormat}
        onClose={closeExportDialog}
        onStart={() => void startExport()}
        onContinue={() => void commitPreparedExport()}
        onDiagramConfirmationChange={setExportDiagramConfirmed}
      />

      <AccessibleModal
        open={imageModalOpen}
        isTopLayer={topLayer === "image"}
        onClose={() => setImageModalOpen(false)}
        dialogRef={imageModalRef}
        initialFocusRef={
          imageSourceMode === "url" ? imageUrlInputRef : imageLocalPickerRef
        }
        returnFocusRef={imageInsertButtonRef}
        backdropClassName="save-modal-backdrop image-insert-modal-backdrop"
        dialogClassName="save-modal image-insert-modal"
        labelledBy="image-insert-modal-title"
        describedBy="image-insert-modal-description"
      >
        <div className="save-modal-header">
          <span className="save-modal-mark" aria-hidden="true">
            <ImagePlus size={22} />
          </span>
          <div>
            <span>تصویرِ قابل‌حمل در سند</span>
            <strong id="image-insert-modal-title">افزودن تصویر</strong>
          </div>
          <button
            ref={imageModalCloseRef}
            type="button"
            onClick={() => setImageModalOpen(false)}
            aria-label="بستن پنجرهٔ افزودن تصویر"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>

        <form
          className="save-modal-body image-insert-modal-body"
          onSubmit={(event) => {
            event.preventDefault();
            if (imageSourceMode === "url") insertImageUrl();
          }}
        >
          <p id="image-insert-modal-description">
            تصویر محلی همراه فایل <code>.ravi</code> ذخیره می‌شود؛ برای تصویر
            اینترنتی فقط خود نشانی در Markdown می‌ماند.
          </p>

          <div className="image-source-tabs" role="tablist" aria-label="منبع تصویر">
            <button
              id="image-source-local-tab"
              type="button"
              role="tab"
              aria-controls="image-source-local-panel"
              aria-selected={imageSourceMode === "local"}
              className={imageSourceMode === "local" ? "is-selected" : ""}
              onClick={() => {
                setImageSourceMode("local");
                setImageInsertError("");
              }}
            >
              <Upload size={16} aria-hidden="true" />
              فایل محلی
            </button>
            <button
              id="image-source-url-tab"
              type="button"
              role="tab"
              aria-controls="image-source-url-panel"
              aria-selected={imageSourceMode === "url"}
              className={imageSourceMode === "url" ? "is-selected" : ""}
              onClick={() => {
                setImageSourceMode("url");
                setImageInsertError("");
                requestAnimationFrame(() => imageUrlInputRef.current?.focus());
              }}
            >
              <Link2 size={16} aria-hidden="true" />
              نشانی اینترنتی
            </button>
          </div>

          {imageSourceMode === "local" ? (
            <section
              id="image-source-local-panel"
              className="image-source-panel"
              role="tabpanel"
              aria-labelledby="image-source-local-tab"
            >
              <span className="image-source-panel-icon" aria-hidden="true">
                <ImagePlus size={22} />
              </span>
              <div>
                <strong>تصویر روی همین دستگاه</strong>
                <small>PNG، JPEG، WebP یا GIF تا سقف ۸ مگابایت</small>
              </div>
              <button
                ref={imageLocalPickerRef}
                type="button"
                className="button button--primary"
                onClick={() => imageInputRef.current?.click()}
              >
                <Upload size={16} aria-hidden="true" />
                انتخاب فایل
              </button>
            </section>
          ) : (
            <section
              id="image-source-url-panel"
              className="image-source-panel image-url-source"
              role="tabpanel"
              aria-labelledby="image-source-url-tab"
            >
              <label className="save-name-field image-url-field">
                <span>نشانی مستقیم تصویر</span>
                <input
                  ref={imageUrlInputRef}
                  type="url"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="https://example.com/photo.png"
                  inputMode="url"
                  dir="ltr"
                  required
                  data-editable-kind="imageUrl"
                />
              </label>
              <p className="image-url-privacy-note">
                <Link2 size={15} aria-hidden="true" />
                فقط URL ذخیره می‌شود؛ فایل سبک می‌ماند. نمایش تصویر به اینترنت
                و در دسترس‌بودن نشانی وابسته است.
              </p>
              <div className="save-modal-actions image-url-actions">
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={!imageUrl.trim()}
                >
                  <ImagePlus size={17} aria-hidden="true" />
                  درج نشانی
                </button>
              </div>
            </section>
          )}

          {imageInsertError && (
            <p className="image-insert-error" role="alert">
              {imageInsertError}
            </p>
          )}
        </form>
      </AccessibleModal>

      <AccessibleModal
        open={saveModalOpen}
        isTopLayer={topLayer === "save"}
        onClose={() => setSaveModalOpen(false)}
        dialogRef={saveModalRef}
        initialFocusRef={saveFileNameRef}
        backdropClassName="save-modal-backdrop"
        dialogClassName="save-modal"
        labelledBy="save-modal-title"
        describedBy="save-modal-description"
      >
            <div className="save-modal-header">
              <span className="save-modal-mark" aria-hidden="true">
                <Save size={22} />
              </span>
              <div>
                <span>ثبت یک نسخه‌ی تازه</span>
                <strong id="save-modal-title">ذخیره فایل</strong>
              </div>
              <button
                ref={saveModalCloseRef}
                type="button"
                onClick={() => setSaveModalOpen(false)}
                aria-label="بستن پنجره‌ی ذخیره"
              >
                <X size={19} aria-hidden="true" />
              </button>
            </div>

            <form
              className="save-modal-body"
              onSubmit={(event) => {
                event.preventDefault();
                void saveAsFile();
              }}
            >
              <p id="save-modal-description">
                نام و نوع فایل را انتخاب کنید. با هر ذخیره، نسخه‌ی سند یک شماره
                جلو می‌رود.
              </p>

              <label className="save-name-field">
                <span>نام فایل</span>
                <input
                  ref={saveFileNameRef}
                  type="text"
                  value={saveFileName}
                  onChange={(event) => setSaveFileName(event.target.value)}
                  dir="auto"
                  required
                  data-editable-kind="saveName"
                />
              </label>

              <fieldset
                className="save-type-options"
                data-editable-kind="saveName"
              >
                <legend>نوع فایل</legend>
                <label className={saveFileType === "markdown" ? "is-selected" : ""}>
                  <input
                    type="radio"
                    name="save-file-type"
                    value="markdown"
                    checked={saveFileType === "markdown"}
                    onChange={() => {
                      setSaveFileType("markdown");
                      setSaveFileName((current) =>
                        saveNameForType(current, "markdown"),
                      );
                    }}
                  />
                  <FileText size={21} aria-hidden="true" />
                  <span>
                    <strong>Markdown (.md)</strong>
                    <small>
                      فقط متن ذخیره می‌شود؛ هایلایت، کامنت و تاریخچه همراه فایل
                      نیست.
                    </small>
                  </span>
                </label>
                <label className={saveFileType === "ravi" ? "is-selected" : ""}>
                  <input
                    type="radio"
                    name="save-file-type"
                    value="ravi"
                    checked={saveFileType === "ravi"}
                    onChange={() => {
                      setSaveFileType("ravi");
                      setSaveFileName((current) =>
                        saveNameForType(current, "ravi"),
                      );
                    }}
                  />
                  <FileArchive size={21} aria-hidden="true" />
                  <span>
                    <strong>سند راوی (.ravi)</strong>
                    <small>
                      متن، هایلایت، کامنت، حاشیه‌ها و تاریخچه‌ی نسخه‌ها را یکجا
                      نگه می‌دارد.
                    </small>
                  </span>
                </label>
              </fieldset>

              <details className="version-history">
                <summary>
                  <span>
                    <History size={16} aria-hidden="true" />
                    تاریخچه‌ی نسخه‌ها
                  </span>
                  <small>
                    نسخه‌ی بعدی {(revision + 1).toLocaleString("fa-IR")}
                  </small>
                </summary>
                {versions.length > 0 ? (
                  <ol>
                    {[...versions].reverse().map((version) => (
                      <li key={`${version.number}-${version.savedAt}`}>
                        <span>
                          <strong>
                            نسخه {version.number.toLocaleString("fa-IR")}
                          </strong>
                          <time dateTime={version.savedAt}>
                            {new Date(version.savedAt).toLocaleString("fa-IR", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </time>
                        </span>
                        <button
                          type="button"
                          onClick={() => restoreVersion(version)}
                        >
                          بازیابی
                        </button>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p>با اولین ذخیره، تاریخچه‌ی این سند ساخته می‌شود.</p>
                )}
              </details>

              <div className="save-modal-actions">
                <button
                  className="button button--quiet"
                  type="button"
                  onClick={() => setSaveModalOpen(false)}
                >
                  انصراف
                </button>
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={saveState === "saving"}
                  aria-keyshortcuts={commandAriaKeyShortcuts(
                    "file.save",
                    commandEnvironment,
                  )}
                >
                  <Save size={17} aria-hidden="true" />
                  {saveState === "saving" ? "در حال ذخیره…" : "ذخیره فایل"}
                </button>
              </div>
            </form>
      </AccessibleModal>

      {shortcutHelpOpen && (
        <Suspense
          fallback={
            <DeferredDialogFallback
              id="shortcuts"
              title="راهنمای میان‌برها در حال آماده‌شدن است"
              isTopLayer={topLayer === "shortcuts"}
              onClose={closeShortcutHelp}
            />
          }
        >
          <ShortcutHelpDialog
            open
            isTopLayer={topLayer === "shortcuts"}
            environment={commandEnvironment}
            onClose={closeShortcutHelp}
          />
        </Suspense>
      )}

      {hoverPreview && hoveredAnnotation && (
        <div
          className={`annotation-hover-preview is-${hoveredAnnotation.kind} is-${hoverPreview.placement}`}
          role="tooltip"
          style={{ left: hoverPreview.x, top: hoverPreview.y }}
        >
          <div className="annotation-hover-heading">
            <span>
              <AnnotationIcon kind={hoveredAnnotation.kind} />
              <strong>{ANNOTATION_LABELS[hoveredAnnotation.kind]}</strong>
            </span>
            <small>برای بازکردن کلیک کنید</small>
          </div>
          <q dir="auto">{hoveredAnnotation.quote}</q>
          <p dir="auto">
            {hoveredAnnotation.body ||
              (hoveredAnnotation.kind === "highlight"
                ? "این بخش برای توجه بیشتر هایلایت شده است."
                : "برای این نشانه هنوز متنی نوشته نشده است.")}
          </p>
        </div>
      )}

      {notice && (
        <div className="toast" role="status">
          <Check size={17} aria-hidden="true" />
          {notice}
        </div>
      )}

      {readingResumeNotice &&
        readingResumeNotice.documentKey === currentDocumentKey && (
          <div className="reading-resume-notice" role="status" aria-live="polite">
            <div>
              <BookOpen size={18} aria-hidden="true" />
              <span>
                <strong>
                  {readingResumeNotice.precision === "exact"
                    ? "مطالعه از جای قبلی ادامه یافت"
                    : "به نزدیک‌ترین بخشِ قابل بازیابی برگشتیم"}
                </strong>
                <small dir="auto">{readingResumeNotice.label}</small>
              </span>
            </div>
            <div className="reading-resume-actions">
              {readingResumeNotice.precision === "exact" ? (
                <>
                  <button
                    className="reading-resume-continue"
                    type="button"
                    onClick={() => setReadingResumeNotice(null)}
                  >
                    ادامه مطالعه
                  </button>
                  <button type="button" onClick={startReadingAtBeginning}>
                    شروع از ابتدا
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="reading-resume-continue"
                    type="button"
                    onClick={() => {
                      const savedRecord = readingResumeNotice.record;
                      setReadingResumeNotice(null);
                      scheduleReadingRestore(savedRecord, {
                        announce: true,
                        protectPending: true,
                      });
                    }}
                  >
                    رفتن به نشان قبلی
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReadingResumeNotice(null);
                      scheduleReadingPositionCommit(0);
                    }}
                  >
                    ادامه از اینجا
                  </button>
                </>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
