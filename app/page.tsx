"use client";

/*
THESIS: راوی یک برگه‌ی زنده‌ی نمونه‌خوانی است؛ نه یک ادیتور تیره و فنی.
OWN-WORLD: کاغذ سرد، مرکب زغالی، آبی نمونه‌خوان و علائم ثبت چاپی.
STORY: فایل را باز کن، در راست ویرایش کن، در چپ نتیجه را ببین و یک برگ تمیز تحویل بگیر.
FIRST VIEWPORT: نوار ابزار فشرده بالا، دو برگ تمام‌قد و یک ستون ثبت باریک در میانه؛ عمل اصلی بالا سمت چپ.
FORM: مسیر هفتم، میز دوبرگی با ساختار bench؛ seed a26e2614.
*/

import {
  AlertTriangle,
  ArrowLeft,
  Bold,
  BookOpen,
  Braces,
  Check,
  Code2,
  Command,
  Download,
  Ellipsis,
  FileArchive,
  FilePlus2,
  FileText,
  Folder,
  FolderPlus,
  FolderOpen,
  FormatClear,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Heart,
  History,
  ImagePlus,
  Info,
  Italic,
  Keyboard,
  Library,
  List as ListIcon,
  ListOrdered,
  ListTodo,
  Link2,
  ListTree,
  MessageCircle,
  MessageSquareText,
  Minus,
  Moon,
  Network,
  Notes,
  PanelLeftOpen,
  PanelRightOpen,
  PencilLine,
  Plus,
  Quote,
  RefreshCw,
  Redo2,
  Save,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sun,
  Table2,
  TextCursorInput,
  Trash2,
  Upload,
  Undo2,
  Wand2,
  WindowMaximize,
  X,
  type LucideIcon,
} from "@/app/icons/material-symbols";
import {
  Children,
  DragEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  Suspense,
  isValidElement,
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
import remarkHighlight from "./markdown/remark-highlight";
import remarkUnderline from "./markdown/remark-underline";
import packageMetadata from "../package.json";
import { useBackLayer } from "./components/back-layer-provider";
import {
  Sidebar,
  SidebarPaneHeader,
  SidebarRail,
  type SidebarRailItem,
} from "./components/sidebar";
import type {
  FileExplorerActionEntry,
  FileExplorerFile,
} from "./components/file-explorer";
import type { FileOperationMode } from "./components/file-operation-dialog";
import type { FileSuggestion } from "./components/file-suggestion-row";
import type { RecentFilePanelEntry } from "./components/recent-files-panel";
import type { VersionPanelEntry } from "./components/versions-panel";
import type { SearchPaneState } from "./components/library-search-pane";
import type { ReadingDocumentSearchResult } from "./components/reading-document-search-pane";
import { ReadingToolsMenu } from "./components/reading-tools-menu";
import { ReadingSelectionMenu } from "./components/reading-selection-menu";
import { TableSizePicker } from "./components/table-size-picker";
import { CodeViewToolbar } from "./components/code-view-toolbar";
import { AiChatPanel } from "./components/ai-chat-panel";
import { MagicWandIcon } from "./components/magic-wand-trigger";
import { DocumentTabs, type DocumentTabView } from "./components/document-tabs";
import { DocumentCommandBar } from "./components/app-chrome";
import {
  NewTabWorkspace,
  type LaunchRecentFile,
} from "./components/new-tab-workspace";
import type { QuickOpenFile } from "./components/quick-open";
import type { CommandAvailability } from "./components/command-palette";
import {
  AccessibleModal,
  useModalFocus,
  useModalStack,
} from "./components/accessible-modal";
import {
  AboutDialog,
  CloseDocumentDialog,
  CommandPalette,
  DeferredDialogFallback,
  DeferredPanelFallback,
  DocumentOutlinePane,
  ExportDialog,
  ExternalLinkDialog,
  FileExplorer,
  FileOperationDialog,
  FormulaDocumentBlock,
  FormulaStudio,
  ImageInsertDialog,
  LibrarySearchPane,
  MarkdownCodeEditor,
  MermaidDiagram,
  MermaidStudio,
  NewDocumentDialog,
  PersianCorrectionsPanel,
  QuickOpen,
  ReadingCommentsPane,
  ReadingDocumentOutlinePane,
  ReadingDocumentSearchPane,
  ReadingHighlightsPane,
  RecentFilesPanel,
  SaveFileDialog,
  ShortcutHelpDialog,
  ShortcutSettingsDialog,
  SupportDialog,
  VersionsPanel,
} from "./components/deferred-surfaces";
import type {
  ExportDialogStatus,
  ExportDialogWarning,
  ExportFormat,
} from "./components/export-dialog";
import { extractWordFrontmatter } from "./export/frontmatter";
import { stagePrintDocument } from "./export/print-document";
import type { NewDocumentSpec } from "./components/new-document-dialog";
import {
  HiddenAnnotationDataWarningDialog,
  LegacyAnnotationMigrationDialog,
} from "./components/annotation-migration-dialogs";
import type {
  MermaidApplyResult,
  MermaidStudioSession,
} from "./components/mermaid-studio";
import type {
  FormulaApplyResult,
  FormulaStudioSession,
} from "./components/formula-studio";
import {
  normalizeSmartAnnotationResult,
  type SmartAnnotationRawResult,
} from "./ai/smart-annotations";
import {
  readMarkdownAnnotations,
  reconnectMarkdownAnnotations,
  writeMarkdownAnnotations,
} from "./markdown/annotations";
import {
  commandAriaKeyShortcuts,
  commandShortcutLabel,
  commandTitle,
} from "./components/command-tooltip";
import type {
  EditorFormattingContext,
  MarkdownCodeEditorHandle,
} from "./components/markdown-code-editor";
import {
  convertMarkdownBlockToType,
  type DirectEditorBlockType,
  type EditorBlockType,
} from "./editor/block-types";
import {
  rankSlashMenuItems,
  slashMenuQueryFromLine,
  type SlashMenuBlockType,
  type SlashMenuItem,
} from "./editor/slash-menu";
import { clearInlineFormatting } from "./editor/inline-formatting";
import {
  CODE_VIEW_PREFERENCES_STORAGE_KEY,
  DEFAULT_CODE_VIEW_PREFERENCES,
  parseCodeViewPreferences,
  type CodeViewPreferences,
} from "./editor/code-view-preferences";
import {
  APPEARANCE_PREFERENCES_STORAGE_KEY,
  DEFAULT_APPEARANCE_PREFERENCES,
  LEGACY_THEME_STORAGE_KEY,
  effectiveTheme,
  parseAppearancePreferences,
  type AppearancePreferences,
} from "./settings/appearance-preferences";
import {
  DEFAULT_READING_PREFERENCES,
  READING_LINE_HEIGHT,
  READING_PREFERENCES_STORAGE_KEY,
  READING_TEXT_SIZE_PX,
  READING_TEXT_WIDTH_PX,
  parseReadingPreferences,
  type ReadingPreferences,
} from "./settings/reading-preferences";
import {
  DEFAULT_FILE_LIBRARY_PREFERENCES,
  FILE_LIBRARY_PREFERENCES_STORAGE_KEY,
  parseFileLibraryPreferences,
  type FileLibraryPreferences,
} from "./settings/file-library-preferences";
import {
  DEFAULT_PRIVACY_PREFERENCES,
  PRIVACY_PREFERENCES_STORAGE_KEY,
  parsePrivacyPreferences,
  type PrivacyPreferences,
} from "./settings/privacy-preferences";
import {
  effectiveEditorMode as resolveEditorMode,
  liveEditFeatureEnabled,
  type EditorMode,
  type SingleEditorMode,
} from "./editor/mode";
import { safeLiveImageSource } from "./editor/rich-blocks";
import { useCommandSystem } from "./hooks/use-command-system";
import { useVisualViewportInsets } from "./hooks/use-visual-viewport";
import { useAppChromeState } from "./hooks/use-app-chrome-state";
import {
  usePersistedWorkspaceState,
  useWorkspaceLayoutState,
  PANE_LAYOUT_STORAGE_KEY,
  type DesktopPaneMode,
  type ScrollPane,
} from "./hooks/use-workspace-layout-state";
import {
  SIDEBAR_DRAWER_MEDIA_QUERY,
  useSidebarShellState,
  type SidebarDestination,
} from "./hooks/use-sidebar-shell-state";
import {
  COMMAND_USAGE_STORAGE_KEY,
  parseCommandUsage,
  recordCommandUsage,
  type CommandUsage,
} from "./commands/command-palette";
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
import {
  findFormulaBlocks,
  formulaBlockAtOffset,
  insertFormulaBlock,
  replaceFormulaBlock,
  type FormulaBlock,
} from "./formula/blocks";
import { DEFAULT_MERMAID_CODE } from "./mermaid/samples";
import {
  LARGE_MARKDOWN_THRESHOLD,
  splitMarkdownForProgressiveRender,
} from "./markdown/progressive-render";
import {
  detectBlockTextDirection as detectMarkdownBlockTextDirection,
  detectDocumentTextDirection,
  type TextDirection,
} from "./markdown/text-direction";
import { SIDEBAR_STORAGE_KEY, type SidebarView } from "./sidebar-state";
import type {
  AiFrozenContext,
  AiFrozenContextDraft,
  CodexConnectionState,
  CodexConnectionStatus,
  CodexResult,
} from "./ai/types";
import {
  frozenBlockIsCurrent,
  frozenContextIsCurrent,
  insertionAfterBlock,
} from "./ai/apply";
import {
  applyAllPersianAiSuggestions,
  applyPersianAiSuggestion,
  normalizePersianAiReviewResult,
  preservesPersianReviewTechnicalText,
  type PersianAiReviewRawResult,
  type PersianAiSuggestion,
} from "./ai/persian-review";
import {
  parsePinnedPaths,
  WORKSPACE_STATE_STORAGE_KEY,
} from "./release/workspace-state";
import {
  READ_ONLY_LIBRARY_CAPABILITIES,
  WRITABLE_LIBRARY_CAPABILITIES,
  libraryErrorMessage,
  parentLibraryPath,
  type LibraryCapabilities,
  type LibraryMutationRequest,
  type LibraryMutationResult,
} from "./filesystem/contract";
import {
  browserLibraryIsWritable,
  performBrowserLibraryMutation,
  undoBrowserLibraryDelete,
  type BrowserDirectoryHandle,
  type BrowserUndoRecord,
} from "./filesystem/browser-adapter";
import {
  persistBrowserLibraryHandle,
  readBrowserLibraryHandles,
  removeBrowserLibraryHandle,
} from "./filesystem/browser-library-handles";
import {
  LocalSearchIndex,
  type LocalSearchProgress,
  type LocalSearchResult,
  type SearchScope,
  type SearchSort,
} from "./search/local-index";
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
  capturePreviewSemanticAnchor,
  restorePreviewSemanticAnchor,
  type SemanticDocumentAnchor,
} from "./context/semantic-anchor";
import {
  DOCUMENT_SESSION_STORAGE_KEY,
  LEGACY_DOCUMENT_SESSION_STORAGE_KEY,
  documentTabId,
  orderDocumentTabs,
  parseDocumentSession,
  serializeDocumentSession,
  setDocumentTabPinned,
  type DocumentTabRecord,
} from "./workspace/document-session";
import {
  resolveTemplateContent,
  type NoteTemplate,
} from "./workspace/note-templates";
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

const STORAGE_KEY = "raavi:document:v1";
const LOCAL_DOCUMENT_DB_NAME = "raavi-local-documents";
const LOCAL_DOCUMENT_DB_VERSION = 1;
const LOCAL_DOCUMENT_STORE = "documents";
const LOCAL_DOCUMENT_ID = "active";
const PINNED_LIBRARY_STORAGE_KEY = "raavi:library-pins:v1";
const QUICK_OPEN_USAGE_STORAGE_KEY = "raavi:quick-open-usage:v1";
const MOBILE_LAYOUT_MEDIA_QUERY = "(max-width: 820px)";
const ANNOTATION_PRESENCE_STORAGE_PREFIX = "raavi:markdown-annotations:v1:";

function annotationPresenceKey(pathValue: string, nameValue: string) {
  return `${ANNOTATION_PRESENCE_STORAGE_PREFIX}${(pathValue || nameValue).normalize("NFKC").toLocaleLowerCase("fa")}`;
}
const EDITOR_BLOCK_TYPE_ICONS: Record<SlashMenuBlockType, LucideIcon> = {
  "heading-1": Heading1,
  "heading-2": Heading2,
  "heading-3": Heading3,
  paragraph: Notes,
  task: ListTodo,
  "bullet-list": ListIcon,
  "ordered-list": ListOrdered,
  quote: Quote,
  table: Table2,
  mermaid: Network,
  image: ImagePlus,
  formula: Braces,
};
const EDITOR_SELECTION_COMMANDS: Array<{
  id: CommandId;
  label: string;
  icon: LucideIcon;
  group: "format" | "link" | "annotation" | "clear";
}> = [
  { id: "edit.bold", label: "پررنگ", icon: Bold, group: "format" },
  { id: "edit.italic", label: "مورب", icon: Italic, group: "format" },
  {
    id: "edit.underline",
    label: "زیرخط‌دار",
    icon: TextCursorInput,
    group: "format",
  },
  { id: "edit.strike", label: "خط‌خورده", icon: Minus, group: "format" },
  { id: "edit.code", label: "کد درون‌خطی", icon: Code2, group: "format" },
  { id: "edit.link", label: "افزودن پیوند", icon: Link2, group: "link" },
  {
    id: "annotation.highlight",
    label: "هایلایت",
    icon: Highlighter,
    group: "annotation",
  },
  {
    id: "annotation.comment",
    label: "نظر",
    icon: MessageCircle,
    group: "annotation",
  },
  {
    id: "edit.clearFormatting",
    label: "پاک‌کردن قالب‌بندی",
    icon: FormatClear,
    group: "clear",
  },
];
const LIVE_EDIT_FEATURE_ENABLED = liveEditFeatureEnabled(
  typeof process !== "undefined"
    ? process.env.NEXT_PUBLIC_RAAVI_LIVE_EDIT
    : undefined,
);
const DEFAULT_FILE_NAME = "راهنمای-راوی.md";
const MAX_FILE_SIZE = 16 * 1024 * 1024;
const MAX_LOCAL_VERSIONS = 10;
const PANE_MIN_WIDTH = 320;
const PANE_SPINE_WIDTH = 48;
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
  const platform = platformValue.includes("mac")
    ? "mac"
    : platformValue.includes("linux")
      ? "linux"
      : "windows";
  return {
    platform,
    surface:
      typeof window !== "undefined" && window.raaviDesktop ? "electron" : "web",
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
      href: `https://ravi.poorsmile.ir/downloads/Raavi-Setup-${packageMetadata.version}-x64.exe`,
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
  'const direction = isCode ? "ltr" : "rtl";',
  'console.log("راوی آماده است");',
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
  "| هایلایت و نظر | ✓ |",
  "| اشتراک نشانه‌ها در Markdown | ✓ |",
  "",
  "برای افزودن یادداشت، بخشی از متنِ همین پیش‌نمایش را انتخاب کنید و از نوار بالای برگه نوع یادداشت را بزنید.",
  "",
  "- [x] متن فارسی خوانا",
  "- [x] قطعه‌کد LTR",
  "- [ ] حالا فایل خودتان را باز کنید",
].join("\n");

function countDocumentWords(markdown: string) {
  const visibleText = markdown
    .replace(/^ {0,3}(?:`{3,}|~{3,})[^\n]*$/gmu, " ")
    .replace(/^ {0,3}(?:[-+*]|\d+[.)])\s+(?:\[[ xX]\]\s*)?/gmu, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1");
  return (
    visibleText.match(/[\p{L}\p{N}]+(?:[\u200c\u200d'’_-][\p{L}\p{N}]+)*/gu)
      ?.length ?? 0
  );
}

type SaveState = "saved" | "dirty" | "saving" | "error";
type EditorSelectionStats = {
  words: number;
  characters: number;
};
type LibraryState = "idle" | "scanning" | "ready";
type DocumentFileType = "markdown" | "ravi";
type SaveFileType = DocumentFileType;

type FailedSaveOperation =
  | { kind: "current" }
  | {
      kind: "saveAs";
      fileName: string;
      fileType: SaveFileType;
    };
type PendingExport = {
  format: ExportFormat;
  fileName: string;
  bytes?: ArrayBuffer;
  requiresReviewConfirmation?: boolean;
};
type ImageSourceMode = "local" | "url";
type ReadingHeading = {
  documentIndex: number;
  level: number;
  offset: number;
  text: string;
};
type ThemeMode = "light" | "dark";
type ThemeTransition = "to-dark" | "to-light" | null;
type EditorAssistantTab = "outline" | "review";
type AnnotationUndoRecord = {
  id: string;
  documentKey: string;
  annotation: RaaviAnnotation;
  index: number;
  documentOrder: string[];
  anchor: ReadingPositionRecord | null;
  returnFocus: HTMLElement | null;
};
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

type LocalDirectoryHandle = BrowserDirectoryHandle;

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (options?: {
    mode?: "read" | "readwrite";
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
  errors?: Array<{ path: string; code: string }>;
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
  lastModified?: number;
};

type DesktopLibraryState = {
  folders: Array<{ rootName: string; rootPath: string }>;
  recents: DesktopRecentFile[];
};

type DesktopLibraryMutationResponse = {
  result: LibraryMutationResult;
  scan: DesktopLibraryScan;
};

type DesktopRecentPruneResponse = {
  removed: boolean;
  state: DesktopLibraryState;
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
    kind: "comment";
    text: string;
    selection: SelectionDraft;
  } | null;
};

type PendingDocumentClose =
  | { kind: "single"; tabId: string; title: string; dirtyCount: 1 }
  | { kind: "others"; tabId: string; title: string; dirtyCount: number };

function isLocalDocumentSnapshot(
  value: unknown,
): value is LocalDocumentSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<LocalDocumentSnapshot>;
  return (
    typeof snapshot.content === "string" &&
    typeof snapshot.fileName === "string" &&
    typeof snapshot.activeDocumentPath === "string" &&
    (snapshot.documentType === "markdown" ||
      snapshot.documentType === "ravi") &&
    Array.isArray(snapshot.annotations) &&
    Array.isArray(snapshot.assets) &&
    Array.isArray(snapshot.versions)
  );
}

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
  saveReadingPositionsSync?: (positions: ReadingPositionMap) => {
    saved: boolean;
  };
  getLibraryState: () => Promise<DesktopLibraryState>;
  clearRecentFiles?: () => Promise<DesktopLibraryState>;
  removeRecentFileIfMissing?: (
    filePath: string,
  ) => Promise<DesktopRecentPruneResponse>;
  chooseMarkdownFolder: () => Promise<DesktopLibraryScan | null>;
  disconnectLibraryFolder?: (rootPath: string) => Promise<DesktopLibraryState>;
  scanMarkdownFolder: (rootPath: string) => Promise<DesktopLibraryScan>;
  readLibraryDocument: (filePath: string) => Promise<DesktopOpenedDocument>;
  readLibrarySearchText: (filePath: string) => Promise<{ content: string }>;
  mutateLibrary?: (
    rootPath: string,
    request: LibraryMutationRequest,
  ) => Promise<DesktopLibraryMutationResponse>;
  undoLibraryMutation?: (
    token: string,
  ) => Promise<DesktopLibraryMutationResponse>;
  onLibraryChanged?: (
    callback: (change: { rootPath: string; reason: string }) => void,
  ) => () => void;
  chooseDocument: () => Promise<DesktopOpenedDocument | null>;
  openRecentDocument: (filePath: string) => Promise<DesktopOpenedDocument>;
  readDocumentVersions?: (filePath: string) => Promise<{
    revision: number;
    versions: RaaviVersion[];
  }>;
  saveMarkdown: (
    fileName: string,
    document: DocumentSavePayload,
  ) => Promise<{
    saved: boolean;
    filePath?: string;
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
  revealExport?: (filePath: string) => Promise<{ revealed: boolean }>;
  openExternalUrl?: (url: string) => Promise<{ opened: boolean }>;
  getCodexConnectionStatus?: () => Promise<CodexConnectionStatus>;
  startCodexLogin?: () => Promise<{
    started: boolean;
    state: "auth_waiting" | "cli_missing" | "connection_error";
  }>;
  runCodexPrompt?: (payload: {
    context: string;
    prompt: string;
  }) => Promise<CodexResult>;
  runCodexPersianReview?: (payload: {
    document: string;
    economy?: boolean;
  }) => Promise<PersianAiReviewRawResult>;
  runCodexSmartAnnotations?: (payload: {
    document: string;
    economy?: boolean;
  }) => Promise<SmartAnnotationRawResult>;
  setWindowTheme?: (theme: ThemeMode) => void;
  minimizeWindow?: () => Promise<void>;
  toggleMaximizeWindow?: () => Promise<void>;
  closeWindow?: () => Promise<void>;
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
  relativePath: string;
  rootId: string;
  rootName: string;
  nativePath?: string;
  documentType: DocumentFileType;
  size: number;
  lastModified: number;
  read: () => Promise<DesktopOpenedDocument>;
  readForSearch: () => Promise<string>;
  write?: (document: DocumentSavePayload) => Promise<void>;
};

type LibraryFolder = {
  rootId: string;
  rootName: string;
  rootPath: string;
  capabilities: LibraryCapabilities;
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
  return detectMarkdownBlockTextDirection(
    textFromReactNode(node),
    documentDirection,
  );
}

function normalizePersianMarkdownLine(line: string) {
  const leadingWhitespace = line.match(/^\s*/u)?.[0] ?? "";
  const body = line.slice(leadingWhitespace.length).replace(/[ \t]+$/u, "");

  return (
    leadingWhitespace +
    body
      .replace(/\u064A/g, "ی")
      .replace(/\u0643/g, "ک")
      .replace(/(^|[^\p{L}\p{N}_])(ن?می) /gu, "$1$2‌")
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

function markdownFrontmatterEndLine(lines: readonly string[]) {
  if (lines[0]?.trim() !== "---") return -1;
  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    if (/^(?:---|\.\.\.)$/u.test(lines[lineIndex].trim())) return lineIndex;
  }
  return -1;
}

function editorHeadings(markdown: string) {
  const headings: Array<{ level: number; offset: number; text: string }> = [];
  const lines = markdown.split(/\r?\n/u);
  const frontmatterEndLine = markdownFrontmatterEndLine(lines);
  let offset = 0;
  let fenceMarker = "";

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (frontmatterEndLine >= 0 && lineIndex <= frontmatterEndLine) {
      offset += line.length + 1;
      continue;
    }
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/u);
    if (fence) {
      const marker = fence[1][0];
      fenceMarker = fenceMarker === marker ? "" : fenceMarker || marker;
    } else if (!fenceMarker) {
      const atx = line.match(/^ {0,3}(#{1,6})[ \t]+(.+?)[ \t]*$/u);
      if (atx) {
        const text = plainHeadingText(atx[2].replace(/[ \t]+#+[ \t]*$/u, ""));
        if (text) headings.push({ level: atx[1].length, offset, text });
      } else {
        const setext = lines[lineIndex + 1]?.match(/^ {0,3}(=+|-+)[ \t]*$/u);
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

function sourceOffsetAttribute(node?: {
  position?: { start?: { offset?: number } };
}) {
  const offset = node?.position?.start?.offset;
  return Number.isFinite(offset) ? { "data-source-offset": offset } : {};
}

const PERSIAN_REVIEW_DEFINITIONS: Array<Omit<PersianReviewIssue, "count">> = [
  {
    id: "arabic-characters",
    title: "نویسه‌های عربی",
    detail: "ی و ک عربی → فارسی",
  },
  {
    id: "half-space",
    title: "نیم‌فاصله",
    detail: "می/نمی و واژهٔ بعد",
  },
  {
    id: "punctuation-spacing",
    title: "فاصلهٔ نشانه‌ها",
    detail: "پیش و پس از نشانه",
  },
  {
    id: "heading-spacing",
    title: "تیتر Markdown",
    detail: "فاصلهٔ پس از #",
  },
  {
    id: "trailing-space",
    title: "فاصلهٔ انتهای خط",
    detail: "فاصله‌های پنهان انتهای خط",
  },
  {
    id: "blank-lines",
    title: "خط‌های خالی اضافه",
    detail: "فاصلهٔ عمودی سند",
  },
];

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
    counts["half-space"] +=
      line.match(/(^|[^\p{L}\p{N}_])(?:ن?می) /gu)?.length ?? 0;
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

  return PERSIAN_REVIEW_DEFINITIONS.map((issue) => ({
    ...issue,
    count: counts[issue.id],
  }));
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
      nextLine = nextLine.replace(/(^|[^\p{L}\p{N}_])(ن?می) /gu, "$1$2‌");
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
  const frontmatterEndLine = markdownFrontmatterEndLine(lines);
  const lineOffsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    lineOffsets.push(offset);
    offset += line.length + 1;
  }
  let documentIndex = 0;
  let fenceMarker = "";

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (frontmatterEndLine >= 0 && lineIndex <= frontmatterEndLine) continue;
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
      const text = plainHeadingText(atx[2].replace(/[ \t]+#+[ \t]*$/u, ""));
      if (level <= 3 && text) {
        headings.push({
          documentIndex,
          level,
          offset: lineOffsets[lineIndex],
          text,
        });
      }
      documentIndex += 1;
      continue;
    }

    const setext = lines[lineIndex + 1]?.match(/^ {0,3}(=+|-+)[ \t]*$/u);
    if (line.trim() && setext) {
      const level = setext[1][0] === "=" ? 1 : 2;
      const text = plainHeadingText(line.trim());
      if (text) {
        headings.push({
          documentIndex,
          level,
          offset: lineOffsets[lineIndex],
          text,
        });
      }
      documentIndex += 1;
      lineIndex += 1;
    }
  }

  return headings;
}

function renderedReadingHeading(article: HTMLElement, heading: ReadingHeading) {
  return article.querySelector<HTMLElement>(
    `h${heading.level}[data-source-offset="${heading.offset}"]`,
  );
}

const ANNOTATION_LABELS: Record<AnnotationKind, string> = {
  highlight: "هایلایت",
  comment: "نظر",
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
  return <MessageCircle size={size} aria-hidden="true" />;
}

function annotationId() {
  return globalThis.crypto?.randomUUID?.() ?? `ravi-${Date.now()}`;
}

function resolveAnnotationStart(
  text: string,
  annotation: Pick<RaaviAnnotation, "start" | "quote" | "prefix" | "suffix">,
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

    if (!startNode && start >= consumed && start < next) {
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

function normalizeReadingSearchText(value: string) {
  return value
    .toLocaleLowerCase("fa-IR")
    .replace(/\u064a/gu, "\u06cc")
    .replace(/\u0643/gu, "\u06a9");
}

function readingSearchOffsets(text: string, query: string, limit = 100) {
  const normalizedText = normalizeReadingSearchText(text);
  const normalizedQuery = normalizeReadingSearchText(query.trim());
  if (!normalizedQuery) return [];

  const matches: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  while (cursor <= normalizedText.length - normalizedQuery.length) {
    const start = normalizedText.indexOf(normalizedQuery, cursor);
    if (start < 0) break;
    matches.push({ start, end: start + normalizedQuery.length });
    if (matches.length >= limit) break;
    cursor = start + Math.max(1, normalizedQuery.length);
  }
  return matches;
}

function readingSearchOffsetsInRoot(
  root: HTMLElement,
  query: string,
  limit = 100,
) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const segments: Array<{
    corpusStart: number;
    corpusEnd: number;
    rootStart: number;
  }> = [];
  const blockSelector =
    "h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, td, th, figcaption";
  let corpus = "";
  let rootOffset = 0;
  let previousBlock: Element | null = null;
  let current = walker.nextNode();

  while (current) {
    const node = current as Text;
    const element = node.parentElement;
    const excluded = Boolean(
      element?.closest(
        ".visually-hidden, [aria-hidden='true'], [hidden], script, style, .progressive-render-status",
      ),
    );
    const block = element?.closest(blockSelector) ?? root;
    if (excluded) {
      if (corpus && corpus.at(-1) !== "\0") corpus += "\0";
      previousBlock = null;
    } else if (node.data) {
      if (corpus && previousBlock && block !== previousBlock) corpus += "\0";
      const corpusStart = corpus.length;
      corpus += node.data;
      segments.push({
        corpusStart,
        corpusEnd: corpus.length,
        rootStart: rootOffset,
      });
      previousBlock = block;
    }
    rootOffset += node.data.length;
    current = walker.nextNode();
  }

  return readingSearchOffsets(corpus, query, limit).flatMap((match) => {
    const startSegment = segments.find(
      (segment) =>
        match.start >= segment.corpusStart && match.start < segment.corpusEnd,
    );
    const endSegment = segments.find(
      (segment) =>
        match.end > segment.corpusStart && match.end <= segment.corpusEnd,
    );
    if (!startSegment || !endSegment) return [];
    return [
      {
        start:
          startSegment.rootStart + (match.start - startSegment.corpusStart),
        end: endSegment.rootStart + (match.end - endSegment.corpusStart),
      },
    ];
  });
}

function compactReadingSearchLabel(value: string, maxLength = 48) {
  const compact = value.replace(/\s+/gu, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength - 1).trimEnd()}…`;
}

function readingSearchLabelForRange(
  root: HTMLElement,
  range: Range,
  documentText: string,
  start: number,
  end: number,
) {
  const startElement =
    range.startContainer instanceof HTMLElement
      ? range.startContainer
      : range.startContainer.parentElement;
  const directHeading = startElement?.closest<HTMLElement>(
    "h1, h2, h3, h4, h5, h6",
  );
  if (directHeading && root.contains(directHeading)) {
    return compactReadingSearchLabel(directHeading.textContent ?? "");
  }

  const fallbackBlock = startElement?.closest<HTMLElement>(
    "p, li, blockquote, pre, td, th, figcaption, section, div",
  );
  let precedingHeading: HTMLElement | null = null;
  if (startElement) {
    for (const heading of root.querySelectorAll<HTMLElement>(
      "h1, h2, h3, h4, h5, h6",
    )) {
      const position = heading.compareDocumentPosition(startElement);
      if (position & Node.DOCUMENT_POSITION_FOLLOWING) {
        precedingHeading = heading;
      } else if (!heading.contains(startElement)) {
        break;
      }
    }
  }
  if (precedingHeading) {
    return compactReadingSearchLabel(precedingHeading.textContent ?? "");
  }

  const blockLabel = compactReadingSearchLabel(
    fallbackBlock?.textContent ?? "",
  );
  if (blockLabel) return blockLabel;
  const contextStart = Math.max(0, start - 22);
  const contextEnd = Math.min(documentText.length, end + 22);
  return compactReadingSearchLabel(
    documentText.slice(contextStart, contextEnd),
  );
}

function readingAnnotationLocationLabel(
  root: HTMLElement | null,
  annotation: RaaviAnnotation,
) {
  if (!root) return "همین سند";
  const documentText = root.textContent ?? "";
  const start = resolveAnnotationStart(documentText, annotation);
  if (start < 0) return "همین سند";
  const range = rangeFromTextOffsets(
    root,
    start,
    start + annotation.quote.length,
  );
  if (!range) return "همین سند";

  const section = readingSearchLabelForRange(
    root,
    range,
    documentText,
    start,
    start + annotation.quote.length,
  );
  const startElement =
    range.startContainer instanceof HTMLElement
      ? range.startContainer
      : range.startContainer.parentElement;
  const selectedBlock = startElement?.closest<HTMLElement>(
    "p, li, blockquote, pre, td, th, figcaption",
  );
  const blocks = Array.from(
    root.querySelectorAll<HTMLElement>(
      "p, li, blockquote, pre, td, th, figcaption",
    ),
  );
  const paragraphIndex = selectedBlock ? blocks.indexOf(selectedBlock) : -1;
  if (paragraphIndex < 0) return section || "همین سند";
  return `${section || "همین سند"} · بند ${(paragraphIndex + 1).toLocaleString(
    "fa-IR",
  )}`;
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

function libraryPinKey(file: LibraryFile) {
  return `${file.rootId}::${file.relativePath}`;
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
      await scanMarkdownDirectory(entry, rootId, rootName, entryPath, results);
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
      relativePath: entryPath,
      rootId,
      rootName,
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
      readForSearch: async () => {
        const nextFile = await entry.getFile();
        const rawContent = await nextFile.text();
        if (documentType !== "ravi") return rawContent;
        return parseRaaviDocument(
          rawContent,
          entry.name.replace(/\.ravi$/i, ".md"),
        ).content;
      },
      write: entry.createWritable
        ? async (document) => {
            const writable = await entry.createWritable!();
            try {
              await writable.write(
                documentType === "ravi"
                  ? JSON.stringify(document.raavi, null, 2)
                  : document.content,
              );
              await writable.close();
            } catch (writeError) {
              await writable.abort?.().catch(() => {});
              throw writeError;
            }
          }
        : undefined,
    });
  }

  return results;
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

  const images = Array.from(
    root?.querySelectorAll<HTMLImageElement>("img") ?? [],
  );
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
  const failedImages = images.filter(
    (image) => image.naturalWidth === 0,
  ).length;
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
    reader.addEventListener("error", () =>
      reject(new Error("IMAGE_READ_FAILED")),
    );
    reader.addEventListener("load", () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const match =
        /^data:image\/(?:gif|jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/iu.exec(
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
            { snapshot?: LocalDocumentSnapshot } | undefined;
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
  useVisualViewportInsets();
  const [content, setContent] = useState(SAMPLE_MARKDOWN);
  const [fileName, setFileName] = useState(DEFAULT_FILE_NAME);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveErrorVisible, setSaveErrorVisible] = useState(false);
  const [activeDocumentPath, setActiveDocumentPath] = useState("");
  const [documentType, setDocumentType] =
    useState<DocumentFileType>("markdown");
  const [revision, setRevision] = useState(1);
  const [versions, setVersions] = useState<RaaviVersion[]>([]);
  const [versionsRefreshing, setVersionsRefreshing] = useState(false);
  const [versionsRefreshError, setVersionsRefreshError] = useState("");
  const [versionRestoreCandidate, setVersionRestoreCandidate] =
    useState<VersionPanelEntry | null>(null);
  const [versionRestoreSaving, setVersionRestoreSaving] = useState(false);
  const [imageAssets, setImageAssets] = useState<RaaviImageAsset[]>([]);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() =>
    documentSnapshot(SAMPLE_MARKDOWN, [], []),
  );
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [pendingDocumentClose, setPendingDocumentClose] =
    useState<PendingDocumentClose | null>(null);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("word");
  const [exportStatus, setExportStatus] = useState<ExportDialogStatus>("idle");
  const [exportProgress, setExportProgress] = useState(0);
  const [exportProgressLabel, setExportProgressLabel] = useState("");
  const [exportWarnings, setExportWarnings] = useState<ExportDialogWarning[]>(
    [],
  );
  const [exportReviewConfirmed, setExportReviewConfirmed] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportResultPath, setExportResultPath] = useState("");
  const [exportResultRevealable, setExportResultRevealable] = useState(false);
  const [pdfExportActive, setPdfExportActive] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [imageSourceMode, setImageSourceMode] =
    useState<ImageSourceMode>("local");
  const [imageUrl, setImageUrl] = useState("");
  const [imageInsertError, setImageInsertError] = useState("");
  const [newDocumentModalOpen, setNewDocumentModalOpen] = useState(false);
  const [newDocumentCreating, setNewDocumentCreating] = useState(false);
  const [newDocumentError, setNewDocumentError] = useState("");
  const [legacyMigrationPromptOpen, setLegacyMigrationPromptOpen] = useState(false);
  const [hiddenAnnotationWarningOpen, setHiddenAnnotationWarningOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);
  const [supportModalOpen, setSupportModalOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandUsage, setCommandUsage] = useState<CommandUsage>({});
  const [commandUsageHydrated, setCommandUsageHydrated] = useState(false);
  const [mermaidStudioSession, setMermaidStudioSession] =
    useState<MermaidStudioSession | null>(null);
  const [formulaStudioSession, setFormulaStudioSession] =
    useState<FormulaStudioSession | null>(null);
  const [saveFileType, setSaveFileType] = useState<SaveFileType>("markdown");
  const [saveFileName, setSaveFileName] = useState(
    saveNameForType(DEFAULT_FILE_NAME, "markdown"),
  );
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [shortcutSettingsOpen, setShortcutSettingsOpen] = useState(false);
  const [settingsInitialCategory, setSettingsInitialCategory] = useState<
    | "general"
    | "appearance"
    | "reading"
    | "editing"
    | "files"
    | "privacy"
    | "shortcuts"
  >("general");
  const [codeViewPreferences, setCodeViewPreferences] =
    useState<CodeViewPreferences>(DEFAULT_CODE_VIEW_PREFERENCES);
  const [codeViewPreferencesHydrated, setCodeViewPreferencesHydrated] =
    useState(false);
  const [appearancePreferences, setAppearancePreferences] =
    useState<AppearancePreferences>(DEFAULT_APPEARANCE_PREFERENCES);
  const [appearancePreferencesHydrated, setAppearancePreferencesHydrated] =
    useState(false);
  const [readingPreferences, setReadingPreferences] =
    useState<ReadingPreferences>(DEFAULT_READING_PREFERENCES);
  const [readingPreferencesHydrated, setReadingPreferencesHydrated] =
    useState(false);
  const readingPreferencesRef = useRef<ReadingPreferences>(
    DEFAULT_READING_PREFERENCES,
  );
  const [fileLibraryPreferences, setFileLibraryPreferences] =
    useState<FileLibraryPreferences>(DEFAULT_FILE_LIBRARY_PREFERENCES);
  const [fileLibraryPreferencesHydrated, setFileLibraryPreferencesHydrated] =
    useState(false);
  const fileLibraryPreferencesRef = useRef<FileLibraryPreferences>(
    DEFAULT_FILE_LIBRARY_PREFERENCES,
  );
  const [privacyPreferences, setPrivacyPreferences] =
    useState<PrivacyPreferences>(DEFAULT_PRIVACY_PREFERENCES);
  const [privacyPreferencesHydrated, setPrivacyPreferencesHydrated] =
    useState(false);
  const [approvedRemoteImages, setApprovedRemoteImages] = useState<Set<string>>(
    () => new Set(),
  );
  const [externalLinkCandidate, setExternalLinkCandidate] = useState("");
  const [themeMode, setThemeMode] = useState<ThemeMode>("light");
  const [themeTransition, setThemeTransition] = useState<ThemeTransition>(null);
  const [commandEnvironment, setCommandEnvironment] =
    useState<CommandEnvironment>({ platform: "windows", surface: "web" });
  const [desktopInstallRecommendation, setDesktopInstallRecommendation] =
    useState<DesktopInstallRecommendation>(
      DEFAULT_DESKTOP_INSTALL_RECOMMENDATION,
    );
  const [readingMode, setReadingMode] = useState(false);
  const [readingHeaderVisible, setReadingHeaderVisible] = useState(true);
  const [readingOutlineOpen, setReadingOutlineOpen] = useState(false);
  const [readingToolsOpen, setReadingToolsOpen] = useState(false);
  const [activeReadingHeadingIndex, setActiveReadingHeadingIndex] =
    useState(-1);
  const [readingSearchQuery, setReadingSearchQuery] = useState("");
  const [readingSearchResults, setReadingSearchResults] = useState<
    ReadingDocumentSearchResult[]
  >([]);
  const [activeReadingSearchIndex, setActiveReadingSearchIndex] = useState(-1);
  const [readingOutlineSearchOpen, setReadingOutlineSearchOpen] =
    useState(false);
  const [readingOutlineQuery, setReadingOutlineQuery] = useState("");
  const [readingHighlightSearchOpen, setReadingHighlightSearchOpen] =
    useState(false);
  const [readingHighlightQuery, setReadingHighlightQuery] = useState("");
  const [readingCommentSearchOpen, setReadingCommentSearchOpen] =
    useState(false);
  const [readingCommentQuery, setReadingCommentQuery] = useState("");
  const [progressiveRenderState, setProgressiveRenderState] = useState({
    contentSignature: "",
    chunkCount: 1,
  });
  const [progressiveTargetChunk, setProgressiveTargetChunk] = useState<
    number | null
  >(null);
  const [readerSize, setReaderSize] = useState(18);
  const [documentDraftId, setDocumentDraftId] = useState("active");
  const [readingPositions, setReadingPositions] = useState<ReadingPositionMap>(
    {},
  );
  const [readingResumeNotice, setReadingResumeNotice] =
    useState<ReadingResumeNotice | null>(null);
  const [
    [mobileHeaderMenuOpen, setMobileHeaderMenuOpen],
    [documentMenuOpen, setDocumentMenuOpen],
    [mobileEditorToolsExpanded, setMobileEditorToolsExpanded],
    [editorToolMenuOpen, setEditorToolMenuOpen],
  ] = useAppChromeState();
  const [editorBlockMenu, setEditorBlockMenu] = useState<{
    lineFrom: number;
    x: number;
    y: number;
    trigger: HTMLElement;
    source: "gutter" | "slash" | "toolbar";
    intent: "convert" | "insert";
    query: string;
  } | null>(null);
  const editorBlockMenuItems = useMemo(
    () =>
      editorBlockMenu?.source === "slash"
        ? rankSlashMenuItems(editorBlockMenu.query)
        : rankSlashMenuItems(""),
    [editorBlockMenu],
  );
  const [editorHelper, setEditorHelper] = useState<
    "link" | "table" | "image" | null
  >(null);
  const [editorLinkUrl, setEditorLinkUrl] = useState("https://");
  const [editorTableRows, setEditorTableRows] = useState(2);
  const [editorTableColumns, setEditorTableColumns] = useState(3);
  const [editorFormatting, setEditorFormatting] =
    useState<EditorFormattingContext>({
      bold: false,
      italic: false,
      code: false,
      link: false,
      block: "paragraph",
      headingLevel: null,
    });
  const [editorAssistantTab, setEditorAssistantTab] =
    useState<EditorAssistantTab | null>(null);
  const [
    [mobilePane, setMobilePane],
    [isCompactLayout, setIsCompactLayout],
    [scrollSyncEnabled, setScrollSyncEnabled],
    [desktopPaneMode, setDesktopPaneMode],
    [activeSplitPane, setActiveSplitPane],
    [splitWorkspaceActive, setSplitWorkspaceActive],
    [singleEditorMode, setSingleEditorMode],
    [previewPanePercent, setPreviewPanePercent],
    paneLayoutHydrated,
    paneLayoutInteractedRef,
    lastExpandedPreviewPercentRef,
    [paneDragging, setPaneDragging],
    [paneCollapseCandidate, setPaneCollapseCandidate],
    [modeSwipeTarget, setModeSwipeTarget],
  ] = useWorkspaceLayoutState(LIVE_EDIT_FEATURE_ENABLED);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [closedTabRecoveryVisible, setClosedTabRecoveryVisible] =
    useState(false);
  const [hydrated, setHydrated] = useState(false);
  const documentTabsHydratedRef = useRef(false);
  const [documentTabs, setDocumentTabs] = useState<
    DocumentTabRecord<LocalDocumentSnapshot>[]
  >([]);
  const [closedDocumentTabs, setClosedDocumentTabs] = useState<
    DocumentTabRecord<LocalDocumentSnapshot>[]
  >([]);
  const [activeDocumentTabId, setActiveDocumentTabId] = useState("");
  const [newTabWorkspaceOpen, setNewTabWorkspaceOpen] = useState(false);
  const [templateCreating, setTemplateCreating] = useState(false);
  const [
    [libraryOpen, setLibraryOpen],
    [sidebarView, setSidebarView],
    [sidebarDestination, setSidebarDestination],
    [sidebarWidth],
    [sidebarCollapsedPreference, setSidebarCollapsedPreference],
    sidebarPreferencesHydrated,
    sidebarResizing,
    [libraryIsModal, setLibraryIsModal],
    resizeSidebarFromPointer,
    resizeSidebarFromKeyboard,
  ] = useSidebarShellState();
  const [aiContext, setAiContext] = useState<AiFrozenContext | null>(null);
  const [codexConnectionState, setCodexConnectionState] =
    useState<CodexConnectionState>("checking");
  const [aiUndoRecord, setAiUndoRecord] = useState<{
    editor: "main" | "writing";
    valueAfter: string;
  } | null>(null);
  const [aiApplyMotion, setAiApplyMotion] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  const persianAiReviewContextsRef = useRef(
    new Map<
      string,
      {
        sourceSnapshot: string;
        expectedContent: string;
        versionSaved: boolean;
      }
    >(),
  );
  const smartAnnotationContextsRef = useRef(
    new Map<string, { sourceSnapshot: string; expectedContent: string; versionSaved: boolean }>(),
  );
  const [libraryState, setLibraryState] = useState<LibraryState>("scanning");
  const [libraryFiles, setLibraryFiles] = useState<LibraryFile[]>([]);
  const [libraryFolders, setLibraryFolders] = useState<LibraryFolder[]>([]);
  const [recentFiles, setRecentFiles] = useState<DesktopRecentFile[]>([]);
  const [recentSearchOpen, setRecentSearchOpen] = useState(false);
  const [recentQuery, setRecentQuery] = useState("");
  const [pinnedLibraryKeys, setPinnedLibraryKeys] = useState<string[]>([]);
  const [pinnedLibraryHydrated, setPinnedLibraryHydrated] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [librarySearchScope, setLibrarySearchScope] =
    useState<SearchScope>("all");
  const [librarySearchSort, setLibrarySearchSort] =
    useState<SearchSort>("relevance");
  const [librarySearchResults, setLibrarySearchResults] = useState<
    LocalSearchResult[]
  >([]);
  const [librarySearchProgress, setLibrarySearchProgress] =
    useState<LocalSearchProgress>({ indexed: 0, total: 0, errors: 0 });
  const [libraryIndexState, setLibraryIndexState] = useState<
    "idle" | "indexing" | "ready" | "error"
  >("idle");
  const [librarySearchRequestState, setLibrarySearchRequestState] = useState<
    "idle" | "searching" | "ready" | "error"
  >("idle");
  const [librarySearchError, setLibrarySearchError] = useState("");
  const [libraryIndexVersion, setLibraryIndexVersion] = useState(0);
  const [quickOpenUsage, setQuickOpenUsage] = useState<
    Record<string, { count: number; lastOpened: number }>
  >({});
  const [activeLibraryPath, setActiveLibraryPath] = useState("");
  const [openingLibraryPath, setOpeningLibraryPath] = useState("");
  const [activeLibraryKey, setActiveLibraryKey] = useState("");
  const [activeLibrarySignature, setActiveLibrarySignature] = useState("");
  const [fileOperation, setFileOperation] = useState<{
    entry: FileExplorerActionEntry;
    mode: FileOperationMode;
  } | null>(null);
  const [fileOperationBusy, setFileOperationBusy] = useState(false);
  const [fileOperationError, setFileOperationError] = useState("");
  const [libraryUndo, setLibraryUndo] = useState<{
    token: string;
    rootId: string;
    label: string;
    previousPath: string;
    activeDocument?: {
      content: string;
      path: string;
      fileName: string;
      snapshot: string;
    };
  } | null>(null);
  const [externalLibraryChange, setExternalLibraryChange] = useState<{
    kind: "changed" | "missing";
    file: LibraryFile | null;
    message: string;
  } | null>(null);
  const [annotations, setAnnotations] = useState<RaaviAnnotation[]>([]);
  const readingHighlights = useMemo(
    () => annotations.filter((annotation) => annotation.kind === "highlight"),
    [annotations],
  );
  const readingComments = useMemo(
    () => annotations.filter((annotation) => annotation.kind === "comment"),
    [annotations],
  );
  const [editorSelectionMenuPosition, setEditorSelectionMenuPosition] =
    useState<SelectionMenuPosition | null>(null);
  const [editorSelectionStats, setEditorSelectionStats] =
    useState<EditorSelectionStats | null>(null);
  const [editorCaretOffset, setEditorCaretOffset] = useState(0);
  const [editorSelectionActionIndex, setEditorSelectionActionIndex] =
    useState(0);
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(
    null,
  );
  const [selectionHighlightRects, setSelectionHighlightRects] = useState<
    SelectionHighlightRect[]
  >([]);
  const [selectionMenuPosition, setSelectionMenuPosition] =
    useState<SelectionMenuPosition | null>(null);
  const [composerKind, setComposerKind] = useState<"comment" | null>(null);
  const [composerText, setComposerText] = useState("");
  const annotationPanelOpen = libraryOpen && sidebarView === "annotations";
  const [activeAnnotationId, setActiveAnnotationId] = useState("");
  const [annotationUndoQueue, setAnnotationUndoQueue] = useState<
    AnnotationUndoRecord[]
  >([]);
  const [hoverPreview, setHoverPreview] =
    useState<AnnotationHoverPreview | null>(null);

  usePersistedWorkspaceState({
    desktopPaneMode,
    paneLayoutHydrated,
    pinnedLibraryHydrated,
    pinnedLibraryKeys,
    previewPanePercent,
    sidebarCollapsed: sidebarCollapsedPreference,
    sidebarHydrated: sidebarPreferencesHydrated,
    sidebarView,
    sidebarWidth,
    singleEditorMode,
  });

  const editorRef = useRef<MarkdownCodeEditorHandle>(null);
  const writingEditorRef = useRef<MarkdownCodeEditorHandle>(null);
  const editorBlockMenuEditorRef = useRef<MarkdownCodeEditorHandle | null>(
    null,
  );
  const editorPaneRef = useRef<HTMLElement>(null);
  const editorSelectionMenuRef = useRef<HTMLDivElement>(null);
  const editorSelectionActionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const editorSelectionFocusRequestedRef = useRef(false);
  const editorToolMenuRef = useRef<HTMLDivElement>(null);
  const editorToolMenuButtonRef = useRef<HTMLButtonElement>(null);
  const editorBlockMenuRef = useRef<HTMLDivElement>(null);
  const editorHelperRef = useRef<HTMLDivElement>(null);
  const editorHelperReturnFocusRef = useRef<HTMLElement | null>(null);
  const restoreEditorHelperFocus = useCallback(() => {
    const returnTarget = editorHelperReturnFocusRef.current;
    if (
      returnTarget?.isConnected &&
      !returnTarget.closest("[hidden], [inert]")
    ) {
      returnTarget.focus();
      if (document.activeElement === returnTarget) return;
    }
    editorRef.current?.focus();
  }, []);
  const editorSelectionMenuTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const dismissedEditorSelectionRef = useRef<{
    source: "editor" | "table";
    key?: string;
    start: number;
    end: number;
  } | null>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const previewArticleRef = useRef<HTMLElement>(null);
  const progressiveRenderSentinelRef = useRef<HTMLDivElement>(null);
  const pendingReadingHeadingIndexRef = useRef<number | null>(null);
  const librarySearchRef = useRef<HTMLInputElement>(null);
  const librarySearchFocusPendingRef = useRef(false);
  const readingDocumentSearchRef = useRef<HTMLInputElement>(null);
  const readingOutlineSearchRef = useRef<HTMLInputElement>(null);
  const recentSearchInputRef = useRef<HTMLInputElement>(null);
  const recentSearchButtonRef = useRef<HTMLButtonElement>(null);
  const readingHighlightSearchRef = useRef<HTMLInputElement>(null);
  const readingCommentSearchRef = useRef<HTMLInputElement>(null);
  const localSearchIndexRef = useRef(new LocalSearchIndex());
  const libraryIndexAbortRef = useRef<AbortController | null>(null);
  const librarySearchAbortRef = useRef<AbortController | null>(null);
  const quickOpenDialogRef = useRef<HTMLDivElement>(null);
  const quickOpenInputRef = useRef<HTMLInputElement>(null);
  const commandPaletteDialogRef = useRef<HTMLDivElement>(null);
  const commandPaletteInputRef = useRef<HTMLInputElement>(null);
  const commandPaletteReturnFocusRef = useRef<HTMLElement>(null);
  const shortcutHelpReturnFocusRef = useRef<HTMLElement>(null);
  const shortcutSettingsReturnFocusRef = useRef<HTMLElement>(null);
  const aboutReturnFocusRef = useRef<HTMLElement>(null);
  const supportReturnFocusRef = useRef<HTMLElement>(null);
  const exportReturnFocusRef = useRef<HTMLElement>(null);
  const annotationPanelRef = useRef<HTMLElement>(null);
  const persianCorrectionsPanelRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageInsertButtonRef = useRef<HTMLButtonElement>(null);
  const imageModalRef = useRef<HTMLDivElement>(null);
  const externalLinkModalRef = useRef<HTMLDivElement>(null);
  const externalLinkConfirmRef = useRef<HTMLButtonElement>(null);
  const mermaidLoadingModalRef = useRef<HTMLDivElement>(null);
  const formulaLoadingModalRef = useRef<HTMLDivElement>(null);
  const imageUrlInputRef = useRef<HTMLInputElement>(null);
  const imageLocalPickerRef = useRef<HTMLButtonElement>(null);
  const imageModalCloseRef = useRef<HTMLButtonElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const libraryPanelRef = useRef<HTMLElement>(null);
  const libraryCloseRef = useRef<HTMLButtonElement>(null);
  const libraryReturnFocusRef = useRef<HTMLElement>(null);
  const selectionMenuRef = useRef<HTMLDivElement>(null);
  const commentButtonRef = useRef<HTMLButtonElement>(null);
  const composerTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const composerOriginRef = useRef<HTMLButtonElement | null>(null);
  const readingReturnFocusRef = useRef<HTMLElement | null>(null);
  const readingToolsButtonRef = useRef<HTMLButtonElement>(null);
  const readingToolsRef = useRef<HTMLDivElement>(null);
  const saveModalCloseRef = useRef<HTMLButtonElement>(null);
  const saveModalReturnFocusRef = useRef<HTMLElement>(null);
  const closeDocumentDialogRef = useRef<HTMLDivElement>(null);
  const closeDocumentCancelRef = useRef<HTMLButtonElement>(null);
  const saveIndicatorRef = useRef<HTMLButtonElement>(null);
  const failedSaveOperationRef = useRef<FailedSaveOperation | null>(null);
  const closeAfterSaveRequestedRef = useRef(false);
  const closeDocumentTabActionRef = useRef<
    ((tabId: string, discardChanges?: boolean) => void) | null
  >(null);
  const newDocumentButtonRef = useRef<HTMLButtonElement>(null);
  const mobileHeaderMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileHeaderMenuRef = useRef<HTMLDivElement>(null);
  const mobileHeaderMenuCloseRef = useRef<HTMLButtonElement>(null);
  const desktopHeaderMenuFirstItemRef = useRef<HTMLButtonElement>(null);
  const headerOverflowReturnFocusRef = useRef<HTMLElement>(null);
  const documentMenuButtonRef = useRef<HTMLButtonElement>(null);
  const documentMenuRef = useRef<HTMLDivElement>(null);
  const mermaidReturnFocusRef = useRef<HTMLElement | null>(null);
  const formulaReturnFocusRef = useRef<HTMLElement | null>(null);
  const formulaReturnSurfaceRef = useRef<"live" | "preview" | "other">("other");
  const saveFileNameRef = useRef<HTMLInputElement>(null);
  const saveModalRef = useRef<HTMLDivElement>(null);
  const pendingExportRef = useRef<PendingExport | null>(null);
  const openedDocumentRef = useRef(false);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedTabRecoveryTimerRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const themeCommitTimerRef = useRef<number | null>(null);
  const themeFinishTimerRef = useRef<number | null>(null);
  const annotationHoverFrameRef = useRef<number | null>(null);
  const readingHeaderFrameRef = useRef<number | null>(null);
  const readingOutlineFrameRef = useRef<number | null>(null);
  const readingAnnotationFrameRef = useRef<number | null>(null);
  const annotationUndoTimerRefs = useRef(new Map<string, number>());
  const readingEditorSelectionRef = useRef({ start: 0, end: 0 });
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
  const readingDirectScrollPendingRef = useRef(false);
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
  const captureReadingPositionRef = useRef<
    (() => ReadingPositionRecord | null) | null
  >(null);
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
  const paneDragStartPreviewPercentRef = useRef(50);
  const editorModeScrollHoldRef = useRef<{
    top: number;
  } | null>(null);
  const editorModeScrollPositionsRef = useRef<
    Record<SingleEditorMode, number | null>
  >({ live: null, source: null });
  const paneDragCleanupRef = useRef<(() => void) | null>(null);
  const scrollSyncFrameRef = useRef<number | null>(null);
  const scrollSyncTargetRef = useRef<{
    pane: ScrollPane;
    scrollTop: number;
  } | null>(null);
  const semanticScrollGuardRef = useRef<{
    pane: ScrollPane;
    until: number;
  } | null>(null);
  const pendingScrollSourceRef = useRef<ScrollPane | null>(null);
  const lastScrolledPaneRef = useRef<ScrollPane>("editor");
  const directoryHandlesRef = useRef(new Map<string, LocalDirectoryHandle>());
  const browserHandlesRestoredRef = useRef(false);
  const browserUndoStoreRef = useRef(new Map<string, BrowserUndoRecord>());
  const libraryWriteInProgressRef = useRef(false);
  const { topLayer, syncLayer } = useModalStack();
  const readingHeadings = useMemo(
    () => extractReadingHeadings(content),
    [content],
  );
  const activeReadingHeadingOffset = useMemo(
    () =>
      readingHeadings.find(
        (heading) => heading.documentIndex === activeReadingHeadingIndex,
      )?.offset ?? null,
    [activeReadingHeadingIndex, readingHeadings],
  );
  const currentDocumentKey = useMemo(
    () => readingDocumentKey({ activeDocumentPath, draftId: documentDraftId }),
    [activeDocumentPath, documentDraftId],
  );
  const currentContentSignature = useMemo(
    () => readingContentSignature(content),
    [content],
  );
  const previewMarkdownChunks = useMemo(
    () => splitMarkdownForProgressiveRender(content),
    [content],
  );
  const progressivePreview =
    content.length >= LARGE_MARKDOWN_THRESHOLD &&
    previewMarkdownChunks.length > 1;
  const renderedPreviewChunkCount = progressivePreview
    ? progressiveRenderState.contentSignature === currentContentSignature
      ? Math.min(
          progressiveRenderState.chunkCount,
          previewMarkdownChunks.length,
        )
      : 1
    : previewMarkdownChunks.length;

  useEffect(() => {
    pendingReadingHeadingIndexRef.current = null;
    const frame = window.requestAnimationFrame(() => {
      setProgressiveRenderState((current) =>
        current.contentSignature === currentContentSignature
          ? current
          : {
              contentSignature: currentContentSignature,
              chunkCount: 1,
            },
      );
      setProgressiveTargetChunk(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [currentContentSignature]);

  useEffect(() => {
    if (!progressivePreview) return;
    const sentinel = progressiveRenderSentinelRef.current;
    if (
      !sentinel ||
      renderedPreviewChunkCount >= previewMarkdownChunks.length
    ) {
      return;
    }

    const idleWindow = window as Window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions,
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    let idleHandle: number | null = null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        const appendChunk = () =>
          setProgressiveRenderState((current) => ({
            contentSignature: currentContentSignature,
            chunkCount:
              current.contentSignature === currentContentSignature
                ? Math.min(current.chunkCount + 1, previewMarkdownChunks.length)
                : 1,
          }));
        if (typeof idleWindow.requestIdleCallback === "function") {
          idleHandle = idleWindow.requestIdleCallback(appendChunk, {
            timeout: 350,
          });
        } else {
          idleHandle = window.setTimeout(appendChunk, 32);
        }
      },
      { rootMargin: "900px 0px" },
    );
    observer.observe(sentinel);
    return () => {
      observer.disconnect();
      if (idleHandle !== null) {
        if (typeof idleWindow.cancelIdleCallback === "function") {
          idleWindow.cancelIdleCallback(idleHandle);
        } else window.clearTimeout(idleHandle);
      }
    };
  }, [
    currentContentSignature,
    previewMarkdownChunks.length,
    progressivePreview,
    renderedPreviewChunkCount,
  ]);
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
  const documentEditorHeadings = useMemo(
    () => editorHeadings(content),
    [content],
  );
  const activeEditorHeadingOffset = useMemo(() => {
    if (!documentEditorHeadings.length) return null;
    let activeOffset = documentEditorHeadings[0].offset;
    for (const heading of documentEditorHeadings) {
      if (heading.offset > editorCaretOffset) break;
      activeOffset = heading.offset;
    }
    return activeOffset;
  }, [documentEditorHeadings, editorCaretOffset]);
  const persianReviewRows = useMemo(
    () => analyzePersianMarkdown(content),
    [content],
  );
  const persianReviewIssues = useMemo(
    () => persianReviewRows.filter((issue) => issue.count > 0),
    [persianReviewRows],
  );
  const mermaidBlocks = useMemo(() => findMermaidBlocks(content), [content]);
  const formulaBlocks = useMemo(() => findFormulaBlocks(content), [content]);
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
    window.raaviDesktop?.setWindowTheme?.(nextTheme);
  }, []);

  const commitAppearancePreferences = useCallback(
    (nextPreferences: AppearancePreferences) => {
      setAppearancePreferences(nextPreferences);
      const root = document.documentElement;
      root.dataset.themePreference = nextPreferences.theme;
      root.dataset.accent = nextPreferences.accent;
      root.dataset.motion = nextPreferences.motion;
      commitTheme(
        effectiveTheme(
          nextPreferences.theme,
          window.matchMedia("(prefers-color-scheme: dark)").matches,
        ),
      );
    },
    [commitTheme],
  );

  const toggleTheme = useCallback(() => {
    if (themeTransition) return;

    const nextTheme: ThemeMode = themeMode === "light" ? "dark" : "light";
    const nextPreferences: AppearancePreferences = {
      ...appearancePreferences,
      theme: nextTheme,
    };
    setAppearancePreferences(nextPreferences);
    if (
      appearancePreferences.motion === "reduced" ||
      (appearancePreferences.motion === "system" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    ) {
      commitTheme(nextTheme);
      return;
    }

    document.documentElement.classList.add("theme-is-changing");
    setThemeTransition(nextTheme === "dark" ? "to-dark" : "to-light");
    themeCommitTimerRef.current = window.setTimeout(
      () => commitTheme(nextTheme),
      170,
    );
    themeFinishTimerRef.current = window.setTimeout(() => {
      document.documentElement.classList.remove("theme-is-changing");
      setThemeTransition(null);
    }, 520);
  }, [appearancePreferences, commitTheme, themeMode, themeTransition]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const preferences = parseAppearancePreferences(
        window.localStorage.getItem(APPEARANCE_PREFERENCES_STORAGE_KEY),
        window.localStorage.getItem(LEGACY_THEME_STORAGE_KEY),
      );
      setAppearancePreferences(preferences);
      const root = document.documentElement;
      root.dataset.themePreference = preferences.theme;
      root.dataset.accent = preferences.accent;
      root.dataset.motion = preferences.motion;
      commitTheme(
        effectiveTheme(
          preferences.theme,
          window.matchMedia("(prefers-color-scheme: dark)").matches,
        ),
      );
      setAppearancePreferencesHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [commitTheme]);

  useEffect(() => {
    if (!appearancePreferencesHydrated) return;
    const root = document.documentElement;
    root.dataset.themePreference = appearancePreferences.theme;
    root.dataset.accent = appearancePreferences.accent;
    root.dataset.motion = appearancePreferences.motion;
    try {
      window.localStorage.setItem(
        APPEARANCE_PREFERENCES_STORAGE_KEY,
        JSON.stringify(appearancePreferences),
      );
      window.localStorage.setItem(
        LEGACY_THEME_STORAGE_KEY,
        appearancePreferences.theme,
      );
    } catch {
      // Preferences continue to work in-session when persistence is unavailable.
    }
  }, [appearancePreferences, appearancePreferencesHydrated]);

  useEffect(() => {
    if (appearancePreferences.theme !== "system") return;
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = (event: MediaQueryListEvent | MediaQueryList) =>
      commitTheme(event.matches ? "dark" : "light");
    query.addEventListener("change", syncSystemTheme);
    return () => query.removeEventListener("change", syncSystemTheme);
  }, [appearancePreferences.theme, commitTheme]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const preferences = parseReadingPreferences(
        window.localStorage.getItem(READING_PREFERENCES_STORAGE_KEY),
      );
      readingPreferencesRef.current = preferences;
      setReadingPreferences(preferences);
      setReaderSize(READING_TEXT_SIZE_PX[preferences.textSize]);
      setReadingPreferencesHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    readingPreferencesRef.current = readingPreferences;
    if (!readingPreferencesHydrated) return;
    const root = document.documentElement;
    root.dataset.readingTextSize = readingPreferences.textSize;
    root.dataset.readingLineSpacing = readingPreferences.lineSpacing;
    root.dataset.readingTextWidth = readingPreferences.textWidth;
    root.style.setProperty(
      "--reading-line-height",
      String(READING_LINE_HEIGHT[readingPreferences.lineSpacing]),
    );
    root.style.setProperty(
      "--reading-document-width",
      `${READING_TEXT_WIDTH_PX[readingPreferences.textWidth]}px`,
    );
    try {
      window.localStorage.setItem(
        READING_PREFERENCES_STORAGE_KEY,
        JSON.stringify(readingPreferences),
      );
    } catch {
      // Reading preferences continue to work in-session.
    }
  }, [readingPreferences, readingPreferencesHydrated]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const preferences = parseFileLibraryPreferences(
        window.localStorage.getItem(FILE_LIBRARY_PREFERENCES_STORAGE_KEY),
      );
      fileLibraryPreferencesRef.current = preferences;
      setFileLibraryPreferences(preferences);
      setFileLibraryPreferencesHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    fileLibraryPreferencesRef.current = fileLibraryPreferences;
    if (!fileLibraryPreferencesHydrated) return;
    try {
      window.localStorage.setItem(
        FILE_LIBRARY_PREFERENCES_STORAGE_KEY,
        JSON.stringify(fileLibraryPreferences),
      );
    } catch {
      // File and library preferences continue to work in-session.
    }
  }, [fileLibraryPreferences, fileLibraryPreferencesHydrated]);

  useEffect(() => {
    if (!fileLibraryPreferencesHydrated || !libraryFolders.length) return;
    if (
      libraryFolders.some(
        (folder) =>
          folder.rootId === fileLibraryPreferences.activeWorkspaceRootId,
      )
    ) {
      return;
    }
    const activeWorkspaceRootId = libraryFolders[0].rootId;
    const frame = window.requestAnimationFrame(() => {
      setFileLibraryPreferences((current) => ({
        ...current,
        activeWorkspaceRootId,
      }));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    fileLibraryPreferences.activeWorkspaceRootId,
    fileLibraryPreferencesHydrated,
    libraryFolders,
  ]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const preferences = parsePrivacyPreferences(
        window.localStorage.getItem(PRIVACY_PREFERENCES_STORAGE_KEY),
      );
      setPrivacyPreferences(preferences);
      document.documentElement.dataset.externalImagePolicy =
        preferences.externalImagePolicy;
      setPrivacyPreferencesHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!privacyPreferencesHydrated) return;
    document.documentElement.dataset.externalImagePolicy =
      privacyPreferences.externalImagePolicy;
    try {
      window.localStorage.setItem(
        PRIVACY_PREFERENCES_STORAGE_KEY,
        JSON.stringify(privacyPreferences),
      );
    } catch {
      // Privacy preferences continue to work in-session.
    }
  }, [privacyPreferences, privacyPreferencesHydrated]);

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
        setCodeViewPreferences(
          parseCodeViewPreferences(
            window.localStorage.getItem(CODE_VIEW_PREFERENCES_STORAGE_KEY),
          ),
        );
      } finally {
        setCodeViewPreferencesHydrated(true);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!codeViewPreferencesHydrated) return;
    try {
      window.localStorage.setItem(
        CODE_VIEW_PREFERENCES_STORAGE_KEY,
        JSON.stringify(codeViewPreferences),
      );
    } catch {
      // Preferences continue to work in-session when persistence is unavailable.
    }
  }, [codeViewPreferences, codeViewPreferencesHydrated]);

  const alignScrollPanes = useCallback((sourcePane: ScrollPane) => {
    const writingPane = writingEditorRef.current ?? previewScrollRef.current;
    const source = sourcePane === "editor" ? editorRef.current : writingPane;
    const target = sourcePane === "editor" ? writingPane : editorRef.current;

    if (
      !source ||
      !target ||
      source.clientHeight <= 0 ||
      target.clientHeight <= 0
    ) {
      return;
    }

    const semanticAnchor =
      sourcePane === "editor"
        ? (editorRef.current?.captureSemanticAnchor() ?? null)
        : (writingEditorRef.current?.captureSemanticAnchor() ??
          (previewArticleRef.current && previewScrollRef.current
            ? capturePreviewSemanticAnchor(
                previewArticleRef.current,
                previewScrollRef.current,
              )
            : null));
    if (semanticAnchor) {
      const targetPane = sourcePane === "editor" ? "preview" : "editor";
      semanticScrollGuardRef.current = {
        pane: targetPane,
        until: performance.now() + 180,
      };
      if (targetPane === "preview") {
        if (writingEditorRef.current) {
          writingEditorRef.current.restoreSemanticAnchor(semanticAnchor);
          return;
        }
        const article = previewArticleRef.current;
        const preview = previewScrollRef.current;
        if (article && preview) {
          restorePreviewSemanticAnchor(article, preview, semanticAnchor);
          return;
        }
      } else {
        editorRef.current?.restoreSemanticAnchor(semanticAnchor);
        return;
      }
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

      const semanticGuard = semanticScrollGuardRef.current;
      if (
        semanticGuard?.pane === sourcePane &&
        performance.now() < semanticGuard.until
      ) {
        return;
      }
      if (semanticGuard && performance.now() >= semanticGuard.until) {
        semanticScrollGuardRef.current = null;
      }

      const guardedTarget = scrollSyncTargetRef.current;
      if (guardedTarget?.pane === sourcePane) {
        const source =
          sourcePane === "editor"
            ? editorRef.current
            : (writingEditorRef.current ?? previewScrollRef.current);
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
        if (writingEditorRef.current) writingEditorRef.current.focus();
        else previewArticleRef.current?.focus({ preventScroll: true });
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
      const targetMode: SingleEditorMode =
        pane === "preview" ? "source" : "live";
      const sourceEditor =
        pane === "preview" ? editorRef.current : writingEditorRef.current;
      const selectionStart = sourceEditor?.selectionStart ?? 0;
      const selectionEnd = sourceEditor?.selectionEnd ?? selectionStart;
      const scrollTop = sourceEditor?.scrollTop ?? 0;
      clearPaneTransientUi();
      setPaneDragging(false);
      setPaneCandidate(null);
      setPreviewPanePercent(lastExpandedPreviewPercentRef.current);
      setModeSwipeTarget(targetMode === "source" ? "code" : "writing");
      setSplitWorkspaceActive(false);
      setSingleEditorMode(targetMode);
      setDesktopPaneMode("editor");
      setMobilePane("editor");
      setActiveSplitPane("editor");
      window.requestAnimationFrame(() => {
        if (editorRef.current) editorRef.current.scrollTop = scrollTop;
        editorRef.current?.setSelectionRange(
          selectionStart,
          selectionEnd,
          false,
        );
        editorRef.current?.focus();
      });
    },
    [clearPaneTransientUi, setPaneCandidate],
  );

  const restoreDesktopPanes = useCallback(
    (focusPane: ScrollPane) => {
      setPreviewPanePercent(lastExpandedPreviewPercentRef.current);
      setSplitWorkspaceActive(true);
      setDesktopPaneMode("split");
      setActiveSplitPane(focusPane);
      setPaneDragging(false);
      setPaneCandidate(null);
      focusDesktopPane(focusPane);
      window.requestAnimationFrame(() => {
        if (scrollSyncEnabled) {
          alignScrollPanes(lastScrolledPaneRef.current);
        }
      });
    },
    [alignScrollPanes, focusDesktopPane, scrollSyncEnabled, setPaneCandidate],
  );

  const paneMetricsFromClientX = useCallback((clientX: number) => {
    const workspace = workspaceRef.current;
    if (!workspace) return { rawPercent: 50, minimumPercent: 50 };

    const bounds = workspace.getBoundingClientRect();
    const styles = window.getComputedStyle(workspace);
    const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0;
    const paddingRight = Number.parseFloat(styles.paddingRight) || 0;
    const availableWidth = Math.max(
      1,
      bounds.width - paddingLeft - paddingRight - PANE_SPINE_WIDTH,
    );
    const editorPercent =
      ((clientX - bounds.left - paddingLeft - PANE_SPINE_WIDTH / 2) /
        availableWidth) *
      100;
    return {
      rawPercent: 100 - editorPercent,
      minimumPercent: Math.min(50, (PANE_MIN_WIDTH / availableWidth) * 100),
    };
  }, []);

  const updatePaneSplitFromPointer = useCallback(
    (clientX: number) => {
      const { rawPercent, minimumPercent } = paneMetricsFromClientX(clientX);
      const candidate =
        rawPercent <= 0 ? "preview" : rawPercent >= 100 ? "editor" : null;
      setPaneCandidate(candidate);
      const nextPercent = Math.min(
        100 - minimumPercent,
        Math.max(minimumPercent, rawPercent),
      );
      if (!candidate) {
        lastExpandedPreviewPercentRef.current = nextPercent;
      }
      setPreviewPanePercent(nextPercent);
      return candidate;
    },
    [paneMetricsFromClientX, setPaneCandidate],
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
      paneDragStartPreviewPercentRef.current = previewPanePercent;
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
        if (resizeHandle.hasPointerCapture?.(pointerId)) {
          resizeHandle.releasePointerCapture(pointerId);
        }
        setPaneDragging(false);

        if (cancel) {
          lastExpandedPreviewPercentRef.current =
            paneDragStartPreviewPercentRef.current;
          setPreviewPanePercent(paneDragStartPreviewPercentRef.current);
          setPaneCandidate(null);
          return;
        }

        const candidate = updatePaneSplitFromPointer(clientX);
        if (candidate) {
          lastExpandedPreviewPercentRef.current =
            paneDragStartPreviewPercentRef.current;
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
      previewPanePercent,
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
        nextPercent += 5;
      } else if (event.key === "ArrowRight") {
        nextPercent -= 5;
      } else if (event.key === "Home") {
        event.preventDefault();
        collapseDesktopPane("editor");
        return;
      } else if (event.key === "End") {
        event.preventDefault();
        collapseDesktopPane("preview");
        return;
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
      const workspace = workspaceRef.current;
      const availableWidth = workspace
        ? Math.max(1, workspace.clientWidth - PANE_SPINE_WIDTH - 56)
        : PANE_MIN_WIDTH * 2;
      const minimumPercent = Math.min(
        50,
        (PANE_MIN_WIDTH / availableWidth) * 100,
      );
      const clampedPercent = Math.min(
        100 - minimumPercent,
        Math.max(minimumPercent, nextPercent),
      );
      lastExpandedPreviewPercentRef.current = clampedPercent;
      setPreviewPanePercent(clampedPercent);
      setPaneCandidate(null);
    },
    [collapseDesktopPane, previewPanePercent, setPaneCandidate],
  );

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
      // Pointer presses inside the article are usually text selection or an
      // action click, not scrolling. Treat wheel/touch/key input as direct
      // scroll intent so later layout reflow cannot consume a stale flag.
      if (event.type !== "pointerdown") {
        readingDirectScrollPendingRef.current = true;
      }
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
      // Wheel and keyboard handlers run before the browser applies the new
      // scroll offset. Capture on the next frame as a durable reflow anchor;
      // this also covers media that finishes loading immediately after a
      // user's scroll.
      if (event.type !== "pointerdown") {
        window.requestAnimationFrame(() => {
          const record = captureReadingPositionRef.current?.();
          if (record) lastReadingAnchorRef.current = record;
        });
      }
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
        event.target.closest(
          "input, textarea, select, [contenteditable='true']",
        )
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
    if (!readingPreferences.autoHideHeader) {
      return;
    }

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
  }, [readingMode, readingPreferences.autoHideHeader]);

  useEffect(() => {
    if (!readingMode) return;

    const scrollRoot = workspaceRef.current;
    const article = previewArticleRef.current;
    const previewScroll = previewScrollRef.current;
    if (!scrollRoot || !article) return;
    const usesWindowScroll =
      scrollRoot.scrollHeight - scrollRoot.clientHeight <= 1;

    const updateActiveHeading = () => {
      readingOutlineFrameRef.current = null;
      if (readingIntentionalNavigationRef.current) return;
      const rootRect = usesWindowScroll
        ? { top: 0, height: window.innerHeight }
        : scrollRoot.getBoundingClientRect();
      const threshold = rootRect.top + Math.min(150, rootRect.height * 0.2);
      let nextIndex = readingHeadings[0]?.documentIndex ?? -1;

      for (const heading of readingHeadings) {
        const renderedHeading = renderedReadingHeading(article, heading);
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

    scrollRoot.addEventListener("scroll", scheduleUpdate, { passive: true });
    previewScroll?.addEventListener("scroll", scheduleUpdate, {
      passive: true,
    });
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();

    return () => {
      scrollRoot.removeEventListener("scroll", scheduleUpdate);
      previewScroll?.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (readingOutlineFrameRef.current !== null) {
        window.cancelAnimationFrame(readingOutlineFrameRef.current);
        readingOutlineFrameRef.current = null;
      }
    };
  }, [readingHeadings, readingMode, readerSize]);

  useEffect(() => {
    if (
      !readingMode ||
      !libraryOpen ||
      sidebarView !== "annotations" ||
      (sidebarDestination !== "highlights" && sidebarDestination !== "comments")
    ) {
      return;
    }

    const readingAnnotations =
      sidebarDestination === "comments" ? readingComments : readingHighlights;
    if (!readingAnnotations.length) return;

    const scrollRoot = workspaceRef.current;
    const article = previewArticleRef.current;
    if (!scrollRoot || !article) return;
    const usesWindowScroll =
      scrollRoot.scrollHeight - scrollRoot.clientHeight <= 1;
    const scrollTarget: HTMLElement | Window = usesWindowScroll
      ? window
      : scrollRoot;

    const updateActiveAnnotation = () => {
      readingAnnotationFrameRef.current = null;
      if (readingIntentionalNavigationRef.current) return;
      const documentText = article.textContent ?? "";
      const rootRect = usesWindowScroll
        ? { top: 0, height: window.innerHeight }
        : scrollRoot.getBoundingClientRect();
      const threshold = rootRect.top + Math.min(150, rootRect.height * 0.2);
      let nextId = "";
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const annotation of readingAnnotations) {
        const start = resolveAnnotationStart(documentText, annotation);
        if (start < 0) continue;
        const range = rangeFromTextOffsets(
          article,
          start,
          start + annotation.quote.length,
        );
        const startElement =
          range?.startContainer instanceof HTMLElement
            ? range.startContainer
            : range?.startContainer.parentElement;
        const target = startElement?.closest<HTMLElement>(
          "p, li, blockquote, pre, td, th, figcaption, h1, h2, h3, h4, h5, h6",
        );
        if (!target) continue;
        const distance = Math.abs(
          target.getBoundingClientRect().top - threshold,
        );
        if (distance < closestDistance) {
          closestDistance = distance;
          nextId = annotation.id;
        }
      }

      if (nextId) {
        setActiveAnnotationId((current) =>
          current === nextId ? current : nextId,
        );
      }
    };

    const scheduleUpdate = () => {
      if (readingAnnotationFrameRef.current !== null) return;
      readingAnnotationFrameRef.current = window.requestAnimationFrame(
        updateActiveAnnotation,
      );
    };

    scrollTarget.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();

    return () => {
      scrollTarget.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (readingAnnotationFrameRef.current !== null) {
        window.cancelAnimationFrame(readingAnnotationFrameRef.current);
        readingAnnotationFrameRef.current = null;
      }
    };
  }, [
    content,
    libraryOpen,
    readerSize,
    readingComments,
    readingHighlights,
    readingMode,
    renderedPreviewChunkCount,
    sidebarDestination,
    sidebarView,
  ]);

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

  const captureDocumentSemanticAnchor = useCallback(
    (preferred?: ScrollPane) => {
      const activeElement = document.activeElement;
      const source =
        preferred ??
        (editorRef.current?.contains(activeElement)
          ? "editor"
          : lastScrolledPaneRef.current);
      const capturePreview = () => {
        const context = getReadingScrollContext();
        return context
          ? capturePreviewSemanticAnchor(context.article, context.root)
          : null;
      };
      return source === "editor"
        ? (editorRef.current?.captureSemanticAnchor() ?? capturePreview())
        : (capturePreview() ??
            editorRef.current?.captureSemanticAnchor() ??
            null);
    },
    [getReadingScrollContext],
  );

  const restoreDocumentSemanticAnchor = useCallback(
    (
      anchor: SemanticDocumentAnchor,
      targets: { editor?: boolean; preview?: boolean } = {
        editor: true,
        preview: true,
      },
    ) => {
      if (targets.editor) editorRef.current?.restoreSemanticAnchor(anchor);
      if (targets.preview) {
        const context = getReadingScrollContext();
        if (context) {
          restorePreviewSemanticAnchor(context.article, context.root, anchor);
        }
      }
    },
    [getReadingScrollContext],
  );

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
      const currentMode =
        viewMode ??
        (document.querySelector(".app-shell.is-reading") ? "reading" : "desk");
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

  useLayoutEffect(() => {
    captureReadingPositionRef.current = captureCurrentReadingPosition;
    return () => {
      captureReadingPositionRef.current = null;
    };
  }, [captureCurrentReadingPosition]);

  const commitReadingPosition = useCallback((record: ReadingPositionRecord) => {
    if (!readingPreferencesRef.current.rememberPosition) return;
    if (record.documentKey !== readingDocumentStateRef.current.documentKey) {
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

  const focusReadingHeading = useCallback(
    (documentIndex: number) => {
      const requestedHeading = readingHeadings.find(
        (candidate) => candidate.documentIndex === documentIndex,
      );
      const findRenderedHeading = () => {
        const article = previewArticleRef.current;
        if (!article || !requestedHeading) return undefined;
        return renderedReadingHeading(article, requestedHeading) ?? undefined;
      };
      const heading = findRenderedHeading();
      if (!heading) {
        const targetChunk = requestedHeading
          ? previewMarkdownChunks.findIndex(
              (chunk) =>
                requestedHeading.offset >= chunk.start &&
                requestedHeading.offset < chunk.end,
            )
          : -1;
        if (progressivePreview && targetChunk >= renderedPreviewChunkCount) {
          pendingReadingHeadingIndexRef.current = documentIndex;
          setProgressiveTargetChunk(targetChunk);
        }
        return;
      }

      cancelReadingRestoreWork();
      readingIntentionalNavigationRef.current = true;
      readingNavigationTargetRef.current = {
        element: heading,
        placement: "center",
      };
      setActiveReadingHeadingIndex(documentIndex);
      heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
      window.requestAnimationFrame(() => {
        const currentHeading = findRenderedHeading();
        if (!currentHeading) return;
        readingNavigationTargetRef.current = {
          element: currentHeading,
          placement: "center",
        };
        currentHeading.setAttribute("tabindex", "-1");
        currentHeading.focus({ preventScroll: true });
      });
      const reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      scrollReadingElement(heading, reducedMotion ? "auto" : "smooth", "start");
      if (readingNavigationTimerRef.current !== null) {
        window.clearTimeout(readingNavigationTimerRef.current);
      }
      readingNavigationTimerRef.current = window.setTimeout(
        () => {
          readingNavigationTimerRef.current = null;
          const currentHeading = findRenderedHeading();
          if (currentHeading) {
            readingNavigationTargetRef.current = {
              element: currentHeading,
              placement: "start",
            };
            scrollReadingElement(currentHeading, "auto", "start");
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
    },
    [
      cancelReadingRestoreWork,
      previewMarkdownChunks,
      progressivePreview,
      readingHeadings,
      renderedPreviewChunkCount,
      scheduleReadingPositionCommit,
      scrollReadingElement,
    ],
  );

  useEffect(() => {
    if (progressiveTargetChunk === null) return;
    if (renderedPreviewChunkCount <= progressiveTargetChunk) {
      const timer = window.setTimeout(() => {
        setProgressiveRenderState((current) => ({
          contentSignature: currentContentSignature,
          chunkCount:
            current.contentSignature === currentContentSignature
              ? Math.min(current.chunkCount + 1, progressiveTargetChunk + 1)
              : 1,
        }));
      }, 24);
      return () => window.clearTimeout(timer);
    }

    const frame = window.requestAnimationFrame(() => {
      const pendingHeading = pendingReadingHeadingIndexRef.current;
      pendingReadingHeadingIndexRef.current = null;
      setProgressiveTargetChunk(null);
      if (pendingHeading !== null) focusReadingHeading(pendingHeading);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    currentContentSignature,
    focusReadingHeading,
    progressiveTargetChunk,
    renderedPreviewChunkCount,
  ]);

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
      if (record.documentKey !== readingDocumentStateRef.current.documentKey) {
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
      readingRestoreProtectPendingRef.current = Boolean(options.protectPending);

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
        const pendingImages = Array.from(
          article.querySelectorAll("img"),
        ).filter((image) => {
          const bounds = image.getBoundingClientRect();
          const isNearViewport =
            bounds.bottom >= rootBounds.top - vicinity &&
            bounds.top <= rootBounds.bottom + vicinity;
          return isNearViewport && !image.complete;
        }).length;
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
            (elapsed >= 420 &&
              layout.pending === 0 &&
              stableLayoutSamples >= 2);
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
  }, [captureCurrentReadingPosition, getReadingScrollContext, readingMode]);

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
          snapshot.documentKey !== readingDocumentStateRef.current.documentKey
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
    if (anchor.documentKey !== readingDocumentStateRef.current.documentKey) {
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
      if (readingRestoreInProgressRef.current && expectedScrollTop === null) {
        return;
      }
      if (
        readingRestoreInProgressRef.current &&
        expectedScrollTop !== null &&
        Math.abs(currentScrollTop - expectedScrollTop) < 2
      ) {
        return;
      }
      readingDirectScrollPendingRef.current = false;
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
        lastReadingAnchorRef.current = anchor;
        scheduleReadingRestore(anchor, {
          retries: 6,
          protectPending: true,
          settle: true,
        });
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
      if (performance.now() <= readingUserInteractionUntilRef.current) {
        const userAnchor = captureCurrentReadingPosition();
        if (userAnchor) lastReadingAnchorRef.current = userAnchor;
      }
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
    const restoreAfterMeaningfulHeightChange = () => {
      const nextHeight = article.getBoundingClientRect().height;
      const heightDelta = Math.abs(nextHeight - previousHeight);
      previousHeight = nextHeight;
      // Remote Markdown images reserve a provisional 16:9 box. A small
      // correction once their intrinsic ratio is known is already handled by
      // native scroll anchoring; running a semantic restore for a few pixels
      // can fight the browser and create a much larger jump.
      if (heightDelta < 64) return;
      restoreAfterReflow();
    };
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            restoreAfterMeaningfulHeightChange();
          });

    resizeObserver?.observe(article);
    void document.fonts?.ready.then(restoreAfterReflow).catch(() => {});
    return () => {
      resizeObserver?.disconnect();
      if (readingReflowTimerRef.current !== null) {
        window.clearTimeout(readingReflowTimerRef.current);
        readingReflowTimerRef.current = null;
      }
    };
  }, [
    captureCurrentReadingPosition,
    content,
    hydrated,
    scheduleReadingRestore,
    scrollReadingElement,
  ]);

  const stats = useMemo(
    () => ({
      words: countDocumentWords(content),
      lines: content.split(/\r?\n/u).length,
    }),
    [content],
  );

  const annotationCounts = useMemo(
    () =>
      annotations.reduce(
        (counts, annotation) => {
          counts[annotation.kind] += 1;
          return counts;
        },
        { highlight: 0, comment: 0 } as Record<AnnotationKind, number>,
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
          ? {
              kind: composerKind,
              text: composerText,
              selection: selectionDraft,
            }
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
  const isInitialWorkspace =
    !activeDocumentPath &&
    documentDraftId === "active" &&
    fileName === DEFAULT_FILE_NAME;

  useEffect(() => {
    if (!hydrated || !activeDocumentTabId || newTabWorkspaceOpen) return;
    const frame = window.requestAnimationFrame(() => {
      setDocumentTabs((current) =>
        current.map((tab) =>
          tab.id === activeDocumentTabId
            ? {
                ...tab,
                title: fileName,
                path: activeDocumentPath,
                draftId: documentDraftId,
                dirty: effectiveSaveState === "dirty",
                snapshot: localDocumentSnapshot,
              }
            : tab,
        ),
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    activeDocumentPath,
    activeDocumentTabId,
    documentDraftId,
    effectiveSaveState,
    fileName,
    hydrated,
    localDocumentSnapshot,
    newTabWorkspaceOpen,
  ]);

  useEffect(() => {
    if (!hydrated || !documentTabsHydratedRef.current) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          DOCUMENT_SESSION_STORAGE_KEY,
          serializeDocumentSession(
            activeDocumentTabId,
            documentTabs,
            closedDocumentTabs,
          ),
        );
      } catch {
        // The current document snapshot remains the fallback restore source.
      }
    }, 240);
    return () => window.clearTimeout(timer);
  }, [activeDocumentTabId, closedDocumentTabs, documentTabs, hydrated]);
  const saveErrorBannerVisible =
    saveErrorVisible && effectiveSaveState === "error" && !isInitialWorkspace;

  const hoveredAnnotation = useMemo(
    () =>
      hoverPreview
        ? (annotations.find(
            (annotation) => annotation.id === hoverPreview.annotationId,
          ) ?? null)
        : null,
    [annotations, hoverPreview],
  );

  const visibleLibraryFiles = useMemo(() => {
    if (fileLibraryPreferences.fileVisibility === "all") return libraryFiles;
    return libraryFiles.filter((file) => file.documentType === "markdown");
  }, [fileLibraryPreferences.fileVisibility, libraryFiles]);

  const explorerRoots = useMemo(
    () =>
      libraryFolders.map((folder) => ({
        rootId: folder.rootId,
        rootName: folder.rootName,
        rootPath: folder.rootPath,
        writable: folder.capabilities.createFile && folder.capabilities.delete,
      })),
    [libraryFolders],
  );
  const explorerFiles = useMemo<FileExplorerFile[]>(
    () =>
      visibleLibraryFiles.map((file) => ({
        id: file.id,
        rootId: file.rootId,
        rootName: file.rootName,
        relativePath: file.relativePath,
        name: file.name,
        documentType: file.documentType,
        lastModified: file.lastModified,
      })),
    [visibleLibraryFiles],
  );
  const explorerFolderOptions = useMemo(() => {
    if (!fileOperation) return [""];
    const paths = new Set<string>([""]);
    for (const file of libraryFiles) {
      if (file.rootId !== fileOperation.entry.rootId) continue;
      let parent = parentLibraryPath(file.relativePath);
      while (parent) {
        paths.add(parent);
        parent = parentLibraryPath(parent);
      }
    }
    const validPaths = [...paths].filter(
      (path) =>
        fileOperation.entry.kind !== "folder" ||
        !fileOperation.entry.relativePath ||
        (path !== fileOperation.entry.relativePath &&
          !path.startsWith(`${fileOperation.entry.relativePath}/`)),
    );
    return validPaths.sort((a, b) => a.localeCompare(b, "fa"));
  }, [fileOperation, libraryFiles]);
  const pinnedLibraryKeySet = useMemo(
    () => new Set(pinnedLibraryKeys),
    [pinnedLibraryKeys],
  );
  const activeLibraryFile = useMemo(
    () =>
      libraryFiles.find((file) => libraryPinKey(file) === activeLibraryKey) ??
      null,
    [activeLibraryKey, libraryFiles],
  );
  const libraryFilesByKey = useMemo(
    () =>
      new Map<string, LibraryFile>(
        libraryFiles.map((file) => [libraryPinKey(file), file]),
      ),
    [libraryFiles],
  );
  const searchSuggestionFiles = useMemo(
    () =>
      new Map<string, FileSuggestion>(
        libraryFiles.map((file) => [
          libraryPinKey(file),
          {
            key: libraryPinKey(file),
            name: file.name,
            path: file.path,
            documentType: file.documentType,
          },
        ]),
      ),
    [libraryFiles],
  );
  const quickOpenFiles = useMemo<QuickOpenFile[]>(() => {
    const recentByPath = new Map(
      recentFiles.map((recent) => [
        recent.path.toLocaleLowerCase("en-US"),
        new Date(recent.openedAt).getTime(),
      ]),
    );
    return libraryFiles.map((file) => {
      const key = libraryPinKey(file);
      const usage = quickOpenUsage[key];
      const recentOpenedAt = file.nativePath
        ? recentByPath.get(file.nativePath.toLocaleLowerCase("en-US"))
        : undefined;
      return {
        key,
        name: file.name,
        path: file.path,
        documentType: file.documentType,
        lastModified: file.lastModified,
        openedAt:
          Math.max(usage?.lastOpened ?? 0, recentOpenedAt ?? 0) || undefined,
        openCount: usage?.count ?? (recentOpenedAt ? 1 : 0),
        pinned: pinnedLibraryKeySet.has(key),
      };
    });
  }, [libraryFiles, pinnedLibraryKeySet, quickOpenUsage, recentFiles]);
  const displayRecentFiles = useMemo<DesktopRecentFile[]>(() => {
    const merged = new Map<string, DesktopRecentFile>();
    for (const recent of recentFiles) {
      merged.set(recent.path.toLocaleLowerCase("en-US"), recent);
    }
    for (const file of libraryFiles) {
      const usage = quickOpenUsage[libraryPinKey(file)];
      if (!usage) continue;
      const path = file.nativePath ?? file.path;
      const key = path.toLocaleLowerCase("en-US");
      const existing = merged.get(key);
      if (
        !existing ||
        new Date(existing.openedAt).getTime() < usage.lastOpened
      ) {
        merged.set(key, {
          path,
          name: file.name,
          documentType: file.documentType,
          openedAt: new Date(usage.lastOpened).toISOString(),
        });
      }
    }
    return [...merged.values()]
      .filter((recent) => {
        const normalizedPath = recent.path.toLocaleLowerCase("en-US");
        const belongsToShelf = libraryFolders.some((folder) => {
          if (!folder.rootPath) return false;
          const root = folder.rootPath.toLocaleLowerCase("en-US");
          return (
            normalizedPath.startsWith(`${root}\\`) ||
            normalizedPath.startsWith(`${root}/`)
          );
        });
        return (
          !belongsToShelf ||
          libraryFiles.some(
            (file) => (file.nativePath ?? file.path) === recent.path,
          )
        );
      })
      .sort(
        (first, second) =>
          new Date(second.openedAt).getTime() -
          new Date(first.openedAt).getTime(),
      )
      .slice(0, 30);
  }, [libraryFiles, libraryFolders, quickOpenUsage, recentFiles]);
  const recentPanelEntries = useMemo<RecentFilePanelEntry[]>(
    () =>
      displayRecentFiles.map((recent) => {
        const normalizedPath = recent.path.toLocaleLowerCase("en-US");
        const file = libraryFiles.find(
          (candidate) =>
            (candidate.nativePath ?? candidate.path).toLocaleLowerCase(
              "en-US",
            ) === normalizedPath,
        );
        const fileKey = file ? libraryPinKey(file) : recent.path;
        return {
          ...recent,
          key: normalizedPath,
          active:
            activeDocumentPath.toLocaleLowerCase("en-US") === normalizedPath ||
            Boolean(file && activeLibraryKey === fileKey),
          opening:
            openingLibraryPath.toLocaleLowerCase("en-US") === normalizedPath ||
            Boolean(file && openingLibraryPath === file.path),
        };
      }),
    [
      activeDocumentPath,
      activeLibraryKey,
      displayRecentFiles,
      libraryFiles,
      openingLibraryPath,
    ],
  );
  const versionPanelEntries = useMemo<VersionPanelEntry[]>(() => {
    const serializedAnnotations = JSON.stringify(annotations);
    let currentVersionIndex = -1;
    for (let index = versions.length - 1; index >= 0; index -= 1) {
      const version = versions[index];
      if (
        version.content === content &&
        JSON.stringify(version.annotations) === serializedAnnotations
      ) {
        currentVersionIndex = index;
        break;
      }
    }

    return versions
      .filter((_, index) => index !== currentVersionIndex)
      .sort(
        (first, second) =>
          new Date(second.savedAt).getTime() -
          new Date(first.savedAt).getTime(),
      )
      .map((version) => ({
        key: `${version.number}-${version.savedAt}`,
        number: version.number,
        savedAt: version.savedAt,
        kind: version.kind ?? "manual",
      }));
  }, [annotations, content, versions]);
  const librarySearchPaneState: SearchPaneState = libraryQuery.trim()
    ? librarySearchRequestState
    : libraryIndexState === "indexing"
      ? "indexing"
      : libraryIndexState === "error"
        ? "error"
        : "idle";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const savedPins = window.localStorage.getItem(
          PINNED_LIBRARY_STORAGE_KEY,
        );
        if (savedPins) {
          setPinnedLibraryKeys(
            parsePinnedPaths(JSON.parse(savedPins)).slice(0, 500),
          );
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

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const parsed = JSON.parse(
          window.localStorage.getItem(QUICK_OPEN_USAGE_STORAGE_KEY) ?? "{}",
        ) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          const safeEntries = Object.entries(parsed as Record<string, unknown>)
            .filter(([, value]) => {
              if (!value || typeof value !== "object") return false;
              const record = value as { count?: unknown; lastOpened?: unknown };
              return (
                Number.isFinite(record.count) &&
                Number.isFinite(record.lastOpened)
              );
            })
            .slice(0, 2_000) as Array<
            [string, { count: number; lastOpened: number }]
          >;
          setQuickOpenUsage(Object.fromEntries(safeEntries));
        }
      } catch {
        // Ranking history is optional and never blocks opening a file.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const activeKeys = new Set(libraryFiles.map(libraryPinKey));
        const pruned = Object.fromEntries(
          Object.entries(quickOpenUsage).filter(([key]) => activeKeys.has(key)),
        );
        window.localStorage.setItem(
          QUICK_OPEN_USAGE_STORAGE_KEY,
          JSON.stringify(pruned),
        );
      } catch {
        // Quick Open remains functional without ranking persistence.
      }
    }, 180);
    return () => window.clearTimeout(timer);
  }, [libraryFiles, quickOpenUsage]);

  useEffect(() => {
    libraryIndexAbortRef.current?.abort();
    const controller = new AbortController();
    libraryIndexAbortRef.current = controller;
    const index = localSearchIndexRef.current;
    index.updateSources(
      libraryFiles.map((file) => ({
        key: libraryPinKey(file),
        name: file.name,
        path: file.path,
        relativePath: file.relativePath,
        rootId: file.rootId,
        lastModified: file.lastModified,
        size: file.size,
        readText: file.readForSearch,
      })),
    );

    if (!libraryFiles.length) {
      const frame = window.requestAnimationFrame(() => {
        setLibrarySearchProgress({ indexed: 0, total: 0, errors: 0 });
        setLibraryIndexState("idle");
        setLibrarySearchResults([]);
      });
      return () => {
        window.cancelAnimationFrame(frame);
        controller.abort();
      };
    }

    const statusFrame = window.requestAnimationFrame(() => {
      setLibraryIndexState("indexing");
      setLibrarySearchError("");
    });
    void index
      .indexAll({
        signal: controller.signal,
        onProgress: setLibrarySearchProgress,
      })
      .then((progress) => {
        if (controller.signal.aborted) return;
        setLibrarySearchProgress(progress);
        setLibraryIndexState(
          progress.errors === progress.total ? "error" : "ready",
        );
        if (progress.errors === progress.total) {
          setLibrarySearchError(
            "متن فایل‌ها خوانده نشد؛ مجوز پوشه را تأیید و قفسه را به‌روزرسانی کنید.",
          );
        }
        setLibraryIndexVersion((current) => current + 1);
      })
      .catch((indexError: unknown) => {
        if (
          indexError instanceof DOMException &&
          indexError.name === "AbortError"
        )
          return;
        setLibraryIndexState("error");
        setLibrarySearchError(
          "نمایهٔ محلی ساخته نشد؛ قفسه را به‌روزرسانی و دوباره تلاش کنید.",
        );
      });
    return () => {
      window.cancelAnimationFrame(statusFrame);
      controller.abort();
    };
  }, [libraryFiles]);

  useEffect(() => {
    librarySearchAbortRef.current?.abort();
    const query = libraryQuery.trim();
    if (!query) {
      const frame = window.requestAnimationFrame(() => {
        setLibrarySearchResults([]);
        setLibrarySearchRequestState("idle");
      });
      return () => window.cancelAnimationFrame(frame);
    }

    const controller = new AbortController();
    librarySearchAbortRef.current = controller;
    const timer = window.setTimeout(() => {
      setLibrarySearchRequestState("searching");
      void localSearchIndexRef.current
        .search(query, {
          scope: librarySearchScope,
          sort: librarySearchSort,
          currentFolder: activeLibraryFile
            ? {
                rootId: activeLibraryFile.rootId,
                relativePath: activeLibraryFile.relativePath,
              }
            : null,
          signal: controller.signal,
        })
        .then((results) => {
          if (controller.signal.aborted) return;
          setLibrarySearchResults(results);
          setLibrarySearchRequestState("ready");
        })
        .catch((searchError: unknown) => {
          if (
            searchError instanceof DOMException &&
            searchError.name === "AbortError"
          )
            return;
          setLibrarySearchRequestState("error");
          setLibrarySearchError(
            "جست‌وجو کامل نشد؛ عبارت را پاک کنید و دوباره بنویسید.",
          );
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    activeLibraryFile,
    libraryIndexVersion,
    libraryQuery,
    librarySearchScope,
    librarySearchSort,
  ]);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = setTimeout(() => setNotice(""), 2400);
  }, []);

  const showClosedTabRecovery = useCallback(() => {
    setClosedTabRecoveryVisible(true);
    if (closedTabRecoveryTimerRef.current) {
      clearTimeout(closedTabRecoveryTimerRef.current);
    }
    closedTabRecoveryTimerRef.current = setTimeout(
      () => setClosedTabRecoveryVisible(false),
      6_000,
    );
  }, []);

  useEffect(() => {
    if (!libraryUndo) return;
    const timer = window.setTimeout(() => setLibraryUndo(null), 9_000);
    return () => window.clearTimeout(timer);
  }, [libraryUndo]);

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

      const migratingLegacyDocument = document.documentType === "ravi";
      const nextDocumentName = migratingLegacyDocument
        ? document.name.replace(/\.ravi$/iu, ".md")
        : document.name;
      const nextDocumentPath = migratingLegacyDocument ? "" : document.path;
      const nextDocumentType: DocumentFileType = "markdown";
      const markdownPayload =
        (document.documentType ?? "markdown") === "markdown"
          ? readMarkdownAnnotations(document.content)
          : null;
      const nextDocumentContent = markdownPayload?.content ?? document.content;
      const importedAnnotations = markdownPayload?.annotations ?? [];
      if (migratingLegacyDocument) setLegacyMigrationPromptOpen(true);
      if (!migratingLegacyDocument && document.path) {
        const presenceKey = annotationPresenceKey(document.path, document.name);
        const expectedAnnotations = window.localStorage.getItem(presenceKey) === "true";
        if (markdownPayload?.hadBlock) {
          window.localStorage.setItem(presenceKey, "true");
        } else if (expectedAnnotations) {
          setHiddenAnnotationWarningOpen(true);
        }
      }
      const nextDraftId = document.draftId ?? createReadingDraftId();
      const nextDocumentKey = readingDocumentKey({
        activeDocumentPath: nextDocumentPath ?? "",
        draftId: nextDraftId,
      });
      const savedPosition = readingPreferencesRef.current.rememberPosition
        ? readingPositionsRef.current[nextDocumentKey]
        : undefined;
      const nextContentSignature = readingContentSignature(nextDocumentContent);
      const nextPreviewChunks = splitMarkdownForProgressiveRender(
        nextDocumentContent,
      );
      // A persisted semantic anchor can only be restored reliably when its
      // target block exists in the DOM. Progressive rendering based on a
      // percentage may stop before that block (Markdown chunks are not equal
      // in rendered height), causing the fallback position to be committed as
      // the new reading location. Resume an existing document with all chunks
      // available; new documents still begin progressively.
      const restoreChunkCount = savedPosition ? nextPreviewChunks.length : 1;
      const nextReadingMode =
        nextDocumentContent.length >= LARGE_MARKDOWN_THRESHOLD ||
        (savedPosition
          ? savedPosition.viewMode === "reading"
          : Boolean(document.openInReadingMode));
      readingDocumentStateRef.current = {
        documentKey: nextDocumentKey,
        contentSignature: nextContentSignature,
        readerSize:
          savedPosition?.readerSize ??
          readingDocumentStateRef.current.readerSize,
        outlineOpen:
          savedPosition?.outlineOpen ??
          readingDocumentStateRef.current.outlineOpen,
      };
      lastReadingAnchorRef.current = savedPosition ?? null;
      setProgressiveRenderState({
        contentSignature: nextContentSignature,
        chunkCount: restoreChunkCount,
      });
      selectionReadingAnchorRef.current = null;
      selectionStartScrollRef.current = null;

      openedDocumentRef.current = true;
      const nextAnnotations = reconnectMarkdownAnnotations(
        nextDocumentContent,
        (document.annotations?.length ? document.annotations : importedAnnotations) ?? [],
      );
      const nextAssets = document.assets ?? [];
      const nextSavedSnapshot = documentSnapshot(
        nextDocumentContent,
        nextAnnotations,
        nextAssets,
      );
      const nextTabId = documentTabId({
        path: nextDocumentPath,
        draftId: nextDraftId,
      });
      const nextTabSnapshot: LocalDocumentSnapshot = {
        content: nextDocumentContent,
        fileName: nextDocumentName,
        readerSize,
        annotations: nextAnnotations,
        assets: nextAssets,
        revision: document.revision ?? 1,
        versions: document.versions ?? [],
        activeDocumentPath: nextDocumentPath ?? "",
        documentType: nextDocumentType,
        lastSavedSnapshot: nextSavedSnapshot,
        draftId: nextDraftId,
        viewMode: nextReadingMode ? "reading" : "desk",
        readingOutlineOpen: savedPosition?.outlineOpen ?? false,
        readingPositions: readingPositionsRef.current,
        annotationComposer: null,
      };
      setDocumentTabs((current) => {
        const existingIndex = current.findIndex((tab) => tab.id === nextTabId);
        const nextTab: DocumentTabRecord<LocalDocumentSnapshot> = {
          id: nextTabId,
          title: nextDocumentName,
          path: nextDocumentPath ?? "",
          draftId: nextDraftId,
          dirty: false,
          pinned: current[existingIndex]?.pinned ?? false,
          snapshot: nextTabSnapshot,
        };
        if (existingIndex < 0) return orderDocumentTabs([...current, nextTab]);
        return current.map((tab, index) =>
          index === existingIndex ? nextTab : tab,
        );
      });
      setActiveDocumentTabId(nextTabId);
      setNewTabWorkspaceOpen(false);
      setContent(nextDocumentContent);
      setFileName(nextDocumentName);
      setAnnotations(nextAnnotations);
      setImageAssets(nextAssets);
      setActiveDocumentPath(nextDocumentPath ?? "");
      setActiveLibraryPath("");
      setActiveLibraryKey("");
      setActiveLibrarySignature("");
      setExternalLibraryChange(null);
      setDocumentDraftId(nextDraftId);
      setDocumentType(nextDocumentType);
      setRevision(document.revision ?? 1);
      setVersions(document.versions ?? []);
      setVersionsRefreshError("");
      setVersionRestoreCandidate(null);
      setLastSavedSnapshot(nextSavedSnapshot);
      setSaveState("saved");
      setSaveErrorVisible(false);
      setEditorSelectionMenuPosition(null);
      setSelectionDraft(null);
      setComposerKind(null);
      setComposerText("");
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
      setLibraryOpen(false);
      setSidebarCollapsedPreference(true);
      setError("");
      if (document.path) {
        setRecentFiles((current) =>
          [
            {
              path: document.path,
              name: document.name,
              documentType: document.documentType ?? "markdown",
              openedAt: new Date().toISOString(),
            },
            ...current.filter((item) => item.path !== document.path),
          ].slice(0, 20),
        );
      }
      if (migratingLegacyDocument) {
        showNotice("سند قدیمی به یک نسخهٔ Markdown تازه تبدیل شد؛ فایل اصلی بدون تغییر ماند.");
      } else if (message) showNotice(message);
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
      readerSize,
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
        typeof snapshot.content === "string"
          ? snapshot.content
          : SAMPLE_MARKDOWN;
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
      const savedPosition = readingPreferencesRef.current.rememberPosition
        ? nextPositions[nextDocumentKey]
        : undefined;
      const nextContentSignature = readingContentSignature(nextContent);
      const nextPreviewChunks = splitMarkdownForProgressiveRender(nextContent);
      const restoreChunkCount = savedPosition ? nextPreviewChunks.length : 1;
      readingDocumentStateRef.current = {
        documentKey: nextDocumentKey,
        contentSignature: nextContentSignature,
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
      setProgressiveRenderState({
        contentSignature: nextContentSignature,
        chunkCount: restoreChunkCount,
      });
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
        savedPosition?.outlineOpen ?? snapshot.readingOutlineOpen ?? false,
      );
      const savedComposer = snapshot.annotationComposer;
      const savedSelection = savedComposer?.selection;
      if (
        savedComposer &&
        (savedComposer.kind === "comment" ||
          (savedComposer.kind as string) === "margin") &&
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
        setComposerKind("comment");
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
            parsed = saved
              ? (JSON.parse(saved) as LocalDocumentSnapshot)
              : null;
          }
          const restoredSession = fileLibraryPreferencesRef.current
            .restoreDocumentTabs
            ? parseDocumentSession(
                window.localStorage.getItem(DOCUMENT_SESSION_STORAGE_KEY) ??
                  window.localStorage.getItem(
                    LEGACY_DOCUMENT_SESSION_STORAGE_KEY,
                  ),
                isLocalDocumentSnapshot,
              )
            : null;
          if (restoredSession) {
            const activeTab =
              restoredSession.tabs.find(
                (tab) => tab.id === restoredSession.activeTabId,
              ) ??
              restoredSession.tabs[0] ??
              null;
            setDocumentTabs(restoredSession.tabs);
            setClosedDocumentTabs(restoredSession.closedTabs);
            setActiveDocumentTabId(activeTab?.id ?? "");
            if (activeTab) {
              applyLocalDocumentSnapshot(activeTab.snapshot);
            } else {
              setNewTabWorkspaceOpen(true);
            }
          } else if (parsed) {
            applyLocalDocumentSnapshot(parsed);
            const initial =
              !parsed.activeDocumentPath &&
              parsed.draftId === "active" &&
              parsed.fileName === DEFAULT_FILE_NAME;
            if (!initial) {
              const tabId = documentTabId({
                path: parsed.activeDocumentPath,
                draftId: parsed.draftId,
              });
              setDocumentTabs([
                {
                  id: tabId,
                  title: parsed.fileName,
                  path: parsed.activeDocumentPath,
                  draftId: parsed.draftId ?? tabId,
                  dirty:
                    documentSnapshot(
                      parsed.content,
                      parsed.annotations,
                      parsed.assets,
                    ) !== parsed.lastSavedSnapshot,
                  pinned: false,
                  snapshot: parsed,
                },
              ]);
              setActiveDocumentTabId(tabId);
            }
          }
        } catch {
          setError(
            "بازیابی آخرین نوشته ممکن نبود؛ می‌توانید یک فایل تازه باز کنید.",
          );
        } finally {
          documentTabsHydratedRef.current = true;
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
        void desktop
          .saveLocalDocumentSnapshot(localDocumentSnapshot)
          .catch(() => {
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
      const position = readingPreferencesRef.current.rememberPosition
        ? lastReadingAnchorRef.current ?? captureCurrentReadingPosition()
        : null;
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
      if (!readingPreferencesRef.current.rememberPosition) return;
      // During beforeunload Chromium can already be collapsing focused
      // overlays and media. The last stable scroll anchor is safer than a new
      // measurement taken from a page that is being torn down.
      const position =
        lastReadingAnchorRef.current ?? captureCurrentReadingPosition();
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
      window.removeEventListener(
        "beforeunload",
        flushLatestReadingPositionSync,
      );
    };
  }, [captureCurrentReadingPosition, hydrated, localDocumentSnapshot]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      if (closedTabRecoveryTimerRef.current) {
        clearTimeout(closedTabRecoveryTimerRef.current);
      }
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
      document.documentElement.classList.remove("reading-layout-is-changing");
    };
  }, []);

  useEffect(() => {
    try {
      setCommandUsage(
        parseCommandUsage(
          window.localStorage.getItem(COMMAND_USAGE_STORAGE_KEY),
        ),
      );
    } finally {
      setCommandUsageHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!commandUsageHydrated) return;
    try {
      window.localStorage.setItem(
        COMMAND_USAGE_STORAGE_KEY,
        JSON.stringify(commandUsage),
      );
    } catch {
      // Local ranking is optional; commands remain fully usable without storage.
    }
  }, [commandUsage, commandUsageHydrated]);

  useEffect(() => {
    if (!selectionDraft || composerKind) return;
    let selectionChangeFrame: number | null = null;

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
    const dismissCancelledSelection = () => {
      if (selectionChangeFrame !== null) {
        cancelAnimationFrame(selectionChangeFrame);
      }
      selectionChangeFrame = requestAnimationFrame(() => {
        selectionChangeFrame = null;
        const selection = window.getSelection();
        const article = previewArticleRef.current;
        if (
          selection &&
          !selection.isCollapsed &&
          article &&
          selection.anchorNode &&
          article.contains(selection.anchorNode)
        ) {
          return;
        }
        setSelectionDraft(null);
        setSelectionHighlightRects([]);
        setSelectionMenuPosition(null);
      });
    };

    document.addEventListener("pointerdown", dismissSelectionMenu, true);
    document.addEventListener("selectionchange", dismissCancelledSelection);
    window.addEventListener("resize", dismissSelectionMenuOnResize);
    return () => {
      if (selectionChangeFrame !== null) {
        cancelAnimationFrame(selectionChangeFrame);
      }
      document.removeEventListener("pointerdown", dismissSelectionMenu, true);
      document.removeEventListener(
        "selectionchange",
        dismissCancelledSelection,
      );
      window.removeEventListener("resize", dismissSelectionMenuOnResize);
    };
  }, [composerKind, selectionDraft]);

  useEffect(() => {
    if (!editorSelectionMenuPosition) return;

    let focusFrame: number | null = null;
    if (editorSelectionFocusRequestedRef.current) {
      editorSelectionFocusRequestedRef.current = false;
      focusFrame = requestAnimationFrame(() => {
        editorSelectionActionRefs.current[editorSelectionActionIndex]?.focus();
      });
    }

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
    const dismissEditorSelectionMenuWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      const editor = editorRef.current;
      const tableSelection = editor?.tableCellSelection;
      dismissedEditorSelectionRef.current = tableSelection
        ? {
            source: "table",
            key: tableSelection.key,
            start: tableSelection.start,
            end: tableSelection.end,
          }
        : {
            source: "editor",
            start: editor?.selectionStart ?? 0,
            end: editor?.selectionEnd ?? 0,
          };
      setEditorSelectionMenuPosition(null);
      requestAnimationFrame(() => {
        if (!editorRef.current?.focusTableCellSelection()) {
          editorRef.current?.focus();
        }
      });
    };

    document.addEventListener("pointerdown", dismissEditorSelectionMenu, true);
    document.addEventListener(
      "keydown",
      dismissEditorSelectionMenuWithEscape,
      true,
    );
    window.addEventListener("resize", dismissEditorSelectionMenuOnResize);
    return () => {
      if (focusFrame !== null) cancelAnimationFrame(focusFrame);
      document.removeEventListener(
        "pointerdown",
        dismissEditorSelectionMenu,
        true,
      );
      document.removeEventListener(
        "keydown",
        dismissEditorSelectionMenuWithEscape,
        true,
      );
      window.removeEventListener("resize", dismissEditorSelectionMenuOnResize);
    };
  }, [editorSelectionActionIndex, editorSelectionMenuPosition]);

  useEffect(() => {
    if (!editorToolMenuOpen && !editorBlockMenu && !editorHelper) return;

    const dismissContextualTools = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        editorToolMenuRef.current?.contains(target) ||
        editorToolMenuButtonRef.current?.contains(target) ||
        editorBlockMenuRef.current?.contains(target) ||
        editorHelperRef.current?.contains(target)
      ) {
        return;
      }
      setEditorToolMenuOpen(false);
      setEditorBlockMenu(null);
      setEditorHelper(null);
    };
    const handleContextualKeyDown = (event: KeyboardEvent) => {
      if (
        editorBlockMenu &&
        ["ArrowDown", "ArrowUp", "Home", "End", "Enter"].includes(event.key) &&
        editorRef.current?.contains(document.activeElement)
      ) {
        const items = Array.from(
          editorBlockMenuRef.current?.querySelectorAll<HTMLButtonElement>(
            '[role="menuitemradio"]',
          ) ?? [],
        );
        if (!items.length) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        const checkedIndex = Math.max(
          0,
          items.findIndex(
            (item) => item.getAttribute("aria-checked") === "true",
          ),
        );
        if (event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          items[checkedIndex]?.click();
          return;
        }
        const nextIndex =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? items.length - 1
              : event.key === "ArrowUp"
                ? (checkedIndex - 1 + items.length) % items.length
                : (checkedIndex + 1) % items.length;
        event.preventDefault();
        event.stopPropagation();
        items[nextIndex]?.focus();
        return;
      }

      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (editorHelper) {
        setEditorHelper(null);
        requestAnimationFrame(restoreEditorHelperFocus);
      } else if (editorBlockMenu) {
        const returnTrigger = editorBlockMenu.trigger;
        if (editorBlockMenu.source !== "slash") returnTrigger.focus();
        setEditorBlockMenu(null);
        if (editorBlockMenu.source === "slash") {
          const editor = editorRef.current;
          if (editor) {
            const source = editor.value;
            const lineEnd = source.indexOf("\n", editorBlockMenu.lineFrom);
            const lineTo = lineEnd === -1 ? source.length : lineEnd;
            const activeLine = source.slice(editorBlockMenu.lineFrom, lineTo);
            if (slashMenuQueryFromLine(activeLine) !== null) {
              editor.replaceRange({
                from: editorBlockMenu.lineFrom,
                to: lineTo,
                insert: "",
                selectionFrom: editorBlockMenu.lineFrom,
                selectionTo: editorBlockMenu.lineFrom,
                announcement: "منوی نوع بلوک بسته شد",
              });
            } else {
              editor.setSelectionRange(
                editorBlockMenu.lineFrom,
                editorBlockMenu.lineFrom,
                false,
              );
            }
          }
        }
        requestAnimationFrame(() => {
          if (editorBlockMenu.source === "slash") {
            editorRef.current?.focus();
            return;
          }
          const activeTrigger = returnTrigger.isConnected
            ? returnTrigger
            : editorPaneRef.current?.querySelector<HTMLElement>(
                ".writing-block-type-trigger",
              );
          activeTrigger?.focus();
        });
      } else {
        setEditorToolMenuOpen(false);
        requestAnimationFrame(() => editorToolMenuButtonRef.current?.focus());
      }
    };

    document.addEventListener("pointerdown", dismissContextualTools, true);
    document.addEventListener("keydown", handleContextualKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", dismissContextualTools, true);
      document.removeEventListener("keydown", handleContextualKeyDown, true);
    };
  }, [
    editorBlockMenu,
    editorHelper,
    editorToolMenuOpen,
    restoreEditorHelperFocus,
  ]);

  useEffect(() => {
    if (!readingToolsOpen) return;

    const focusFrame = window.requestAnimationFrame(() => {
      readingToolsRef.current
        ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
        ?.focus({ preventScroll: true });
    });

    const dismissReadingTools = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        readingToolsRef.current?.contains(target) ||
        readingToolsButtonRef.current?.contains(target)
      ) {
        return;
      }
      setReadingToolsOpen(false);
    };
    const dismissReadingToolsWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      setReadingToolsOpen(false);
      requestAnimationFrame(() => readingToolsButtonRef.current?.focus());
    };

    document.addEventListener("pointerdown", dismissReadingTools, true);
    document.addEventListener("keydown", dismissReadingToolsWithEscape, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", dismissReadingTools, true);
      document.removeEventListener(
        "keydown",
        dismissReadingToolsWithEscape,
        true,
      );
    };
  }, [readingToolsOpen]);

  useEffect(() => {
    if (!readingResumeNotice) return;
    const timer = window.setTimeout(() => setReadingResumeNotice(null), 8_000);
    return () => window.clearTimeout(timer);
  }, [readingResumeNotice]);

  useEffect(
    () => () => {
      for (const timer of annotationUndoTimerRefs.current.values()) {
        window.clearTimeout(timer);
      }
      annotationUndoTimerRefs.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (!editorHelper) return;
    requestAnimationFrame(() => {
      editorHelperRef.current
        ?.querySelector<HTMLElement>("[data-helper-autofocus]")
        ?.focus();
    });
  }, [editorHelper]);

  useEffect(() => {
    const compactMediaQuery = window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY);
    const sidebarDrawerMediaQuery = window.matchMedia(
      SIDEBAR_DRAWER_MEDIA_QUERY,
    );
    const syncLibraryMode = () => {
      const compact = compactMediaQuery.matches;
      const sidebarDrawer = sidebarDrawerMediaQuery.matches;
      setIsCompactLayout(compact);
      const modalSidebar = compact || (sidebarDrawer && !readingMode);
      setLibraryIsModal(modalSidebar);
      if (modalSidebar) {
        setLibraryOpen(false);
      }
      if (compact) {
        setMobileHeaderMenuOpen(false);
        setMobileEditorToolsExpanded(false);
      } else {
        setMobileHeaderMenuOpen(false);
        setMobileEditorToolsExpanded(false);
      }
    };
    const handleLibraryModeChange = () => syncLibraryMode();
    syncLibraryMode();
    compactMediaQuery.addEventListener("change", handleLibraryModeChange);
    sidebarDrawerMediaQuery.addEventListener("change", handleLibraryModeChange);
    return () => {
      compactMediaQuery.removeEventListener("change", handleLibraryModeChange);
      sidebarDrawerMediaQuery.removeEventListener(
        "change",
        handleLibraryModeChange,
      );
    };
  }, [readingMode]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setCommandEnvironment(detectCommandEnvironment());
      setDesktopInstallRecommendation(detectDesktopInstallRecommendation());
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
    syncLayer("quickOpen", quickOpenOpen);
  }, [quickOpenOpen, syncLayer]);

  useEffect(() => {
    syncLayer("commandPalette", commandPaletteOpen);
  }, [commandPaletteOpen, syncLayer]);

  useEffect(() => {
    syncLayer("mermaid", Boolean(mermaidStudioSession));
  }, [mermaidStudioSession, syncLayer]);

  useEffect(() => {
    syncLayer("formula", Boolean(formulaStudioSession));
  }, [formulaStudioSession, syncLayer]);

  useEffect(() => {
    syncLayer("mobileMenu", mobileHeaderMenuOpen);
  }, [mobileHeaderMenuOpen, syncLayer]);

  useEffect(() => {
    if (!documentMenuOpen) return;
    const closeFromOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !documentMenuRef.current?.contains(event.target)
      ) {
        setDocumentMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeFromOutside);
    return () => document.removeEventListener("pointerdown", closeFromOutside);
  }, [documentMenuOpen]);

  useEffect(() => {
    syncLayer("save", saveModalOpen);
  }, [saveModalOpen, syncLayer]);

  useEffect(() => {
    syncLayer("closeDocument", Boolean(pendingDocumentClose));
  }, [pendingDocumentClose, syncLayer]);

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
    syncLayer("externalLink", Boolean(externalLinkCandidate));
  }, [externalLinkCandidate, syncLayer]);

  useEffect(() => {
    syncLayer("new", newDocumentModalOpen);
  }, [newDocumentModalOpen, syncLayer]);

  useEffect(() => {
    syncLayer("shortcuts", shortcutHelpOpen);
  }, [shortcutHelpOpen, syncLayer]);

  useEffect(() => {
    syncLayer("settings", shortcutSettingsOpen);
  }, [shortcutSettingsOpen, syncLayer]);

  useEffect(() => {
    syncLayer("library", libraryOpen && libraryIsModal);
  }, [libraryIsModal, libraryOpen, syncLayer]);

  useEffect(() => {
    syncLayer("fileOperation", Boolean(fileOperation));
  }, [fileOperation, syncLayer]);

  useModalFocus({
    open: libraryOpen && libraryIsModal,
    isTopLayer: topLayer === "library",
    containerRef: libraryPanelRef,
    initialFocusRef: libraryCloseRef,
    returnFocusRef: libraryReturnFocusRef,
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
      ::highlight(raavi-active) {
        background: transparent;
        text-decoration: underline var(--proof-blue-dark) 2.5px;
        text-underline-offset: 4px;
      }
      ::highlight(raavi-selection) {
        background: transparent;
        text-decoration: none;
      }
      ::highlight(raavi-search-match) {
        background: var(--proof-blue-soft);
      }
      ::highlight(raavi-search-active) {
        color: var(--proof-blue-dark);
        background: var(--proof-blue-soft);
        text-decoration: underline var(--proof-blue) 2px;
        text-underline-offset: 3px;
      }
      @media print {
        ::highlight(raavi-highlight),
        ::highlight(raavi-comment),
        ::highlight(raavi-active),
        ::highlight(raavi-selection),
        ::highlight(raavi-search-match),
        ::highlight(raavi-search-active) {
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
      "raavi-active",
      "raavi-selection",
    ];
    const frame = requestAnimationFrame(() => {
      const text = root.textContent ?? "";
      const buckets: Record<AnnotationKind, Range[]> = {
        highlight: [],
        comment: [],
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
        const range =
          start >= 0
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
    const query = readingSearchQuery.trim();
    const frame = requestAnimationFrame(() => {
      if (!readingMode || sidebarView !== "search" || !query) {
        setReadingSearchResults([]);
        setActiveReadingSearchIndex(-1);
        return;
      }
      const root = previewArticleRef.current;
      if (!root) {
        setReadingSearchResults([]);
        setActiveReadingSearchIndex(-1);
        return;
      }
      const documentText = root.textContent ?? "";
      const nextResults = readingSearchOffsetsInRoot(root, query).flatMap(
        ({ start, end }) => {
          const range = rangeFromTextOffsets(root, start, end);
          if (!range) return [];
          return [
            {
              start,
              end,
              label: readingSearchLabelForRange(
                root,
                range,
                documentText,
                start,
                end,
              ),
            },
          ];
        },
      );
      setReadingSearchResults(nextResults);
      setActiveReadingSearchIndex((current) =>
        nextResults.length
          ? Math.min(Math.max(current, 0), nextResults.length - 1)
          : -1,
      );
    });

    return () => cancelAnimationFrame(frame);
  }, [
    content,
    readingMode,
    readingSearchQuery,
    renderedPreviewChunkCount,
    sidebarView,
  ]);

  useEffect(() => {
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
    const names = ["raavi-search-match", "raavi-search-active"];
    const root = previewArticleRef.current;
    if (!root || !highlightRegistry || !HighlightConstructor) return;

    const frame = requestAnimationFrame(() => {
      const ranges = readingSearchResults.flatMap((result) => {
        const range = rangeFromTextOffsets(root, result.start, result.end);
        return range ? [range] : [];
      });
      if (ranges.length) {
        highlightRegistry.set(
          "raavi-search-match",
          new HighlightConstructor(...ranges),
        );
      } else {
        highlightRegistry.delete("raavi-search-match");
      }
      const activeResult = readingSearchResults[activeReadingSearchIndex];
      const activeRange = activeResult
        ? rangeFromTextOffsets(root, activeResult.start, activeResult.end)
        : null;
      if (activeRange) {
        highlightRegistry.set(
          "raavi-search-active",
          new HighlightConstructor(activeRange),
        );
      } else {
        highlightRegistry.delete("raavi-search-active");
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      for (const name of names) highlightRegistry.delete(name);
    };
  }, [activeReadingSearchIndex, readingSearchResults]);

  useEffect(() => {
    if (!selectionDraft || composerKind) return;
    const frame = requestAnimationFrame(() => {
      const root = previewArticleRef.current;
      const nativeSelection = window.getSelection();
      if (!root || !nativeSelection) return;
      if (nativeSelection.toString().trim() === selectionDraft.quote) return;

      const text = root.textContent ?? "";
      const start = resolveAnnotationStart(text, selectionDraft);
      const range =
        start >= 0
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

  const capturePreviewSelection = (pointer?: {
    clientX: number;
    clientY: number;
  }) => {
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
      pointerStart.documentKey ===
        readingDocumentStateRef.current.documentKey &&
      pointerEnd &&
      article.contains(pointerStart.node) &&
      article.contains(pointerEnd.node)
        ? rangeBetweenBoundaries(pointerStart, pointerEnd)
        : null;
    const range =
      nativeRange && !nativeRange.collapsed ? nativeRange : pointerRange;
    if (!range) {
      if (!composerKind) {
        setSelectionDraft(null);
        setSelectionHighlightRects([]);
        setSelectionMenuPosition(null);
      }
      return;
    }
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
            readingRestoreExpectedScrollTopRef.current =
              selectionStartScroll.top;
            if (selectionStartScroll.root === document.scrollingElement) {
              window.scrollTo({
                top: selectionStartScroll.top,
                behavior: "auto",
              });
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
      const anchorClientX = (rangeRect.left + rangeRect.right) / 2;
      const distanceAbove = rangeRect.top - scrollRect.top;
      const placement = distanceAbove >= 60 ? "above" : "below";
      const anchorClientY =
        placement === "above" ? rangeRect.top : rangeRect.bottom;
      const menuHalfWidth = Math.min(
        124,
        Math.max(72, scrollRect.width / 2 - 12),
      );
      const minimumX = previewScroll.scrollLeft + menuHalfWidth;
      const maximumX =
        previewScroll.scrollLeft + scrollRect.width - menuHalfWidth;
      const rawX = anchorClientX - scrollRect.left + previewScroll.scrollLeft;

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
        y: anchorClientY - scrollRect.top + previewScroll.scrollTop,
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

    preserveReadingViewport(
      () => {
        setAnnotations((current) => [...current, annotation]);
        setSelectionDraft(null);
        setSelectionHighlightRects([]);
        setSelectionMenuPosition(null);
        setComposerKind(null);
        setComposerText("");
        composerOriginRef.current = null;
        setSidebarView("annotations");
        setSidebarDestination(kind === "highlight" ? "highlights" : "comments");
        setLibraryOpen(true);
        if (!window.matchMedia(SIDEBAR_DRAWER_MEDIA_QUERY).matches) {
          setSidebarCollapsedPreference(false);
        }
        setActiveAnnotationId(annotation.id);
        clearNativeSelection();
      },
      { anchor: selectionReadingAnchorRef.current },
    );
    selectionReadingAnchorRef.current = null;
    showNotice(`${ANNOTATION_LABELS[kind]} ثبت شد.`);
  };

  const openAnnotationComposer = (
    kind: "comment",
    origin?: HTMLButtonElement | null,
    selection = selectionDraft,
  ) => {
    if (!selection) {
      showNotice("ابتدا بخشی از متن پیش‌نمایش را انتخاب کنید.");
      return;
    }
    preserveReadingViewport(
      () => {
        composerOriginRef.current = origin ?? null;
        setSelectionDraft(selection);
        setComposerKind(kind);
        setComposerText("");
      },
      { anchor: selectionReadingAnchorRef.current, retries: 3 },
    );
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
    requestAnimationFrame(() => {
      const target = origin?.isConnected ? origin : commentButtonRef.current;
      target?.focus({ preventScroll: true });
    });
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
    const annotationIndex = annotations.findIndex(
      (annotation) => annotation.id === id,
    );
    const annotation = annotations[annotationIndex];
    if (!annotation) return;
    const undoId = annotationId();
    const existingDocumentOrder = annotationUndoQueue.find(
      (record) => record.documentKey === currentDocumentKey,
    )?.documentOrder;
    const documentOrder = existingDocumentOrder
      ? [...existingDocumentOrder]
      : annotations.map((item) => item.id);
    for (const item of annotations) {
      if (!documentOrder.includes(item.id)) documentOrder.push(item.id);
    }
    const undoRecord: AnnotationUndoRecord = {
      id: undoId,
      documentKey: currentDocumentKey,
      annotation,
      index: annotationIndex,
      documentOrder,
      anchor,
      returnFocus:
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null,
    };
    preserveReadingViewport(
      () => {
        setAnnotations((current) =>
          current.filter((annotation) => annotation.id !== id),
        );
        if (activeAnnotationId === id) setActiveAnnotationId("");
        setAnnotationUndoQueue((current) => [...current, undoRecord]);
      },
      { anchor, retries: 3 },
    );
    const timer = window.setTimeout(() => {
      annotationUndoTimerRefs.current.delete(undoId);
      setAnnotationUndoQueue((current) =>
        current.filter((record) => record.id !== undoId),
      );
    }, 9_000);
    annotationUndoTimerRefs.current.set(undoId, timer);
    requestAnimationFrame(() => {
      const nextFocusable =
        annotationPanelRef.current?.querySelector<HTMLElement>(
          ".reading-highlight-row-main, .reading-comment-row-jump, .annotation-card .annotation-quote",
        );
      (nextFocusable ?? annotationPanelRef.current)?.focus({
        preventScroll: true,
      });
    });
  };

  const undoAnnotationDelete = (undoId: string) => {
    const deleted = annotationUndoQueue.find(
      (record) =>
        record.id === undoId && record.documentKey === currentDocumentKey,
    );
    if (!deleted) return;
    const timer = annotationUndoTimerRefs.current.get(undoId);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      annotationUndoTimerRefs.current.delete(undoId);
    }
    preserveReadingViewport(
      () => {
        setAnnotations((current) => {
          if (
            current.some(
              (annotation) => annotation.id === deleted.annotation.id,
            )
          ) {
            return current;
          }
          const next = [...current];
          const deletedOrderIndex = deleted.documentOrder.indexOf(
            deleted.annotation.id,
          );
          const followingIndex = next.findIndex((annotation) => {
            const orderIndex = deleted.documentOrder.indexOf(annotation.id);
            return orderIndex > deletedOrderIndex;
          });
          let insertionIndex = followingIndex;
          if (insertionIndex < 0) {
            let closestPrecedingOrder = -1;
            let closestPrecedingIndex = -1;
            next.forEach((annotation, index) => {
              const orderIndex = deleted.documentOrder.indexOf(annotation.id);
              if (
                orderIndex >= 0 &&
                orderIndex < deletedOrderIndex &&
                orderIndex > closestPrecedingOrder
              ) {
                closestPrecedingOrder = orderIndex;
                closestPrecedingIndex = index;
              }
            });
            insertionIndex =
              closestPrecedingIndex >= 0
                ? closestPrecedingIndex + 1
                : Math.min(Math.max(0, deleted.index), next.length);
          }
          next.splice(insertionIndex, 0, deleted.annotation);
          return next;
        });
        setActiveAnnotationId(deleted.annotation.id);
        setAnnotationUndoQueue((current) =>
          current.filter((record) => record.id !== undoId),
        );
      },
      { anchor: deleted.anchor, retries: 4 },
    );
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const restored = document.querySelector<HTMLElement>(
          `#annotation-card-${CSS.escape(deleted.annotation.id)} .reading-highlight-row-main, #annotation-card-${CSS.escape(deleted.annotation.id)} .reading-comment-row-jump, #annotation-card-${CSS.escape(deleted.annotation.id)} .annotation-quote`,
        );
        if (restored) restored.focus({ preventScroll: true });
        else if (deleted.returnFocus?.isConnected) {
          deleted.returnFocus.focus({ preventScroll: true });
        }
      }),
    );
  };

  const focusAnnotation = (annotation: RaaviAnnotation) => {
    cancelReadingRestoreWork();
    readingIntentionalNavigationRef.current = true;
    setActiveAnnotationId(annotation.id);
    setSidebarView("annotations");
    setSidebarDestination(
      annotation.kind === "highlight" ? "highlights" : "comments",
    );
    setLibraryOpen(true);
    if (!window.matchMedia(SIDEBAR_DRAWER_MEDIA_QUERY).matches) {
      setSidebarCollapsedPreference(false);
    }
    setHoverPreview(null);

    if (!readingMode) {
      requestAnimationFrame(() => {
        const start = resolveAnnotationStart(content, annotation);
        if (start < 0) {
          showNotice("محل این یادداشت پس از ویرایش متن پیدا نشد.");
          return;
        }
        editorRef.current?.setSelectionRange(
          start,
          start + annotation.quote.length,
          false,
        );
        editorRef.current?.focus();
      });
      return;
    }

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
          placement === "above" ? Math.max(14, clientY - 168) : clientY + 18;
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
      kind: "manual",
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
    const exportContent = writeMarkdownAnnotations(
      markdownWithEmbeddedRaaviImages(content, imageAssets),
      annotations,
    );
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
      const savedSnapshot = documentSnapshot(content, annotations, imageAssets);
      const persistedTabId = documentTabId({
        path: nextPath,
        draftId: documentDraftId,
      });
      if (activeDocumentTabId) {
        setDocumentTabs((current) =>
          current.map((tab) =>
            tab.id === activeDocumentTabId
              ? {
                  ...tab,
                  id: persistedTabId,
                  title: nextName ?? fileName,
                  path: nextPath,
                  dirty: false,
                  snapshot: {
                    ...tab.snapshot,
                    content,
                    fileName: nextName ?? fileName,
                    annotations,
                    assets: imageAssets,
                    revision: nextRevision,
                    versions: nextVersions,
                    activeDocumentPath: nextPath,
                    documentType: nextType,
                    lastSavedSnapshot: savedSnapshot,
                  },
                }
              : tab,
          ),
        );
        setActiveDocumentTabId(persistedTabId);
      }
      setRevision(nextRevision);
      setVersions(nextVersions);
      setVersionsRefreshError("");
      setVersionRestoreCandidate(null);
      setActiveDocumentPath(nextPath);
      setDocumentType(nextType);
      if (nextPath && annotations.length) {
        window.localStorage.setItem(
          annotationPresenceKey(nextPath, nextName ?? fileName),
          "true",
        );
      }
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
      setLastSavedSnapshot(savedSnapshot);
      setSaveState("saved");
      setSaveErrorVisible(false);
      failedSaveOperationRef.current = null;
      setSaveModalOpen(false);
      showNotice(`نسخه‌ی ${nextRevision.toLocaleString("fa-IR")} ذخیره شد.`);
      if (closeAfterSaveRequestedRef.current) {
        closeAfterSaveRequestedRef.current = false;
        requestAnimationFrame(() =>
          closeDocumentTabActionRef.current?.(persistedTabId),
        );
      }
    },
    [
      activeDocumentTabId,
      annotations,
      content,
      documentDraftId,
      fileName,
      imageAssets,
      showNotice,
    ],
  );

  const openSaveFileModal = useCallback(
    (_preferredType: SaveFileType = "markdown") => {
      saveModalReturnFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      setSaveFileType("markdown");
      setSaveFileName(saveNameForType(fileName, "markdown"));
      setSaveModalOpen(true);
      setSaveErrorVisible(false);
      setError("");
    },
    [fileName],
  );

  const saveAsFile = useCallback(
    async (
      retryOperation?: Extract<FailedSaveOperation, { kind: "saveAs" }>,
    ) => {
      const requestedFileName = retryOperation?.fileName ?? saveFileName;
      const requestedFileType: SaveFileType = "markdown";
      const trimmedName = requestedFileName.trim();
      if (!trimmedName) {
        setError("برای فایل یک نام وارد کنید.");
        return;
      }

      const { nextRevision, nextVersions, payload } = buildNextSave();
      const nextName = saveNameForType(trimmedName, requestedFileType);
      setSaveState("saving");
      setSaveErrorVisible(false);
      setError("");

      try {
        const desktop = window.raaviDesktop;
        if (desktop) {
          const result = await desktop.saveMarkdown(nextName, payload);
          if (!result.saved) {
            closeAfterSaveRequestedRef.current = false;
            setSaveState(effectiveSaveState === "dirty" ? "dirty" : "saved");
            setSaveErrorVisible(false);
            failedSaveOperationRef.current = null;
            return;
          }
          commitSavedVersion(
            nextRevision,
            nextVersions,
            result.filePath ?? "",
            requestedFileType,
            nextName,
          );
          return;
        }

        const blob = new Blob([payload.content], {
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
          requestedFileType,
          nextName,
        );
      } catch {
        closeAfterSaveRequestedRef.current = false;
        failedSaveOperationRef.current = {
          kind: "saveAs",
          fileName: trimmedName,
          fileType: requestedFileType,
        };
        setSaveModalOpen(false);
        setSaveState("error");
        setSaveErrorVisible(true);
        setError("");
      }
    },
    [
      buildNextSave,
      commitSavedVersion,
      content,
      effectiveSaveState,
      saveFileName,
      saveFileType,
    ],
  );

  const saveCurrentFile = useCallback(async () => {
    const desktop = window.raaviDesktop;
    if (!desktop && activeLibraryFile?.write) {
      const { nextRevision, nextVersions, payload } = buildNextSave();
      setSaveState("saving");
      setSaveErrorVisible(false);
      setError("");
      try {
        await activeLibraryFile.write(payload);
        commitSavedVersion(
          nextRevision,
          nextVersions,
          "",
          activeLibraryFile.documentType,
          activeLibraryFile.name,
        );
        setActiveLibrarySignature(`${Date.now()}:${new Blob([content]).size}`);
      } catch {
        closeAfterSaveRequestedRef.current = false;
        failedSaveOperationRef.current = { kind: "current" };
        setSaveState("error");
        setSaveErrorVisible(true);
        setError("");
      }
      return;
    }
    if (!desktop || !activeDocumentPath) {
      openSaveFileModal(documentType);
      return;
    }

    const { nextRevision, nextVersions, payload } = buildNextSave();
    setSaveState("saving");
    setSaveErrorVisible(false);
    setError("");
    libraryWriteInProgressRef.current = true;
    try {
      const result = await desktop.saveCurrentDocument(
        activeDocumentPath,
        payload,
      );
      if (!result.saved) {
        closeAfterSaveRequestedRef.current = false;
        setSaveState(effectiveSaveState === "dirty" ? "dirty" : "saved");
        setSaveErrorVisible(false);
        failedSaveOperationRef.current = null;
        return;
      }
      commitSavedVersion(
        nextRevision,
        nextVersions,
        result.filePath ?? activeDocumentPath,
        result.documentType ?? documentType,
      );
    } catch {
      closeAfterSaveRequestedRef.current = false;
      failedSaveOperationRef.current = { kind: "current" };
      setSaveState("error");
      setSaveErrorVisible(true);
      setError("");
    } finally {
      window.setTimeout(() => {
        libraryWriteInProgressRef.current = false;
      }, 500);
    }
  }, [
    activeLibraryFile,
    activeDocumentPath,
    buildNextSave,
    commitSavedVersion,
    content,
    documentType,
    effectiveSaveState,
    openSaveFileModal,
  ]);

  const retryFailedSave = useCallback(async () => {
    const failedOperation = failedSaveOperationRef.current;
    if (failedOperation?.kind === "saveAs") {
      await saveAsFile(failedOperation);
      return;
    }
    await saveCurrentFile();
  }, [saveAsFile, saveCurrentFile]);

  const resetExportDialog = useCallback(() => {
    pendingExportRef.current = null;
    setExportModalOpen(false);
    setExportStatus("idle");
    setExportProgress(0);
    setExportProgressLabel("");
    setExportWarnings([]);
    setExportReviewConfirmed(false);
    setExportError("");
    setExportResultPath("");
    setExportResultRevealable(false);
    setPdfExportActive(false);
  }, []);

  const closeExportDialog = useCallback(() => {
    if (exportStatus === "preparing" || exportStatus === "saving") return;
    resetExportDialog();
  }, [exportStatus, resetExportDialog]);

  const openExportDialog = useCallback(() => {
    pendingExportRef.current = null;
    setExportStatus("idle");
    setExportProgress(0);
    setExportProgressLabel("");
    setExportWarnings([]);
    setExportReviewConfirmed(false);
    setExportError("");
    setExportResultPath("");
    setExportResultRevealable(false);
    setPdfExportActive(false);
    setMobileHeaderMenuOpen(false);
    setExportModalOpen(true);
  }, []);

  const commitPreparedExport = useCallback(async () => {
    const pending = pendingExportRef.current;
    if (!pending) return;
    if (pending.requiresReviewConfirmation && !exportReviewConfirmed) return;
    let cleanupPrintDocument: (() => void) | undefined;
    setExportStatus("saving");
    setExportError("");
    setExportProgress((current) => Math.max(current, 96));
    setExportProgressLabel(
      pending.format === "word"
        ? "در حال ذخیرهٔ فایل…"
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
            pendingExportRef.current = null;
            setExportStatus("idle");
            setExportProgress(0);
            setExportProgressLabel("");
            return;
          }
          setExportResultPath(
            result.filePath ?? `Downloads / ${pending.fileName}`,
          );
          setExportResultRevealable(Boolean(desktop.revealExport));
        } else {
          downloadExport(pending.bytes, pending.fileName);
          setExportResultPath(`Downloads / ${pending.fileName}`);
          setExportResultRevealable(false);
        }
        setExportProgress(100);
        setExportProgressLabel("خروجی آماده است");
        setExportStatus("success");
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
          setExportProgress(0);
          setExportProgressLabel("");
          setPdfExportActive(false);
          return;
        }
        setPdfExportActive(false);
        setExportResultPath(
          result.filePath ?? `Downloads / ${pending.fileName}`,
        );
        setExportResultRevealable(Boolean(desktop.revealExport));
        setExportProgress(100);
        setExportProgressLabel("خروجی آماده است");
        setExportStatus("success");
      } else {
        window.print();
        resetExportDialog();
        showNotice("پنجره‌ی چاپ باز شد؛ مقصد را روی «Save as PDF» بگذارید.");
      }
    } catch {
      setPdfExportActive(false);
      setExportStatus("error");
      setExportProgress(0);
      setExportProgressLabel("");
      setExportError(
        pending.format === "word"
          ? "پوشهٔ مقصد در دسترس نیست یا مجوز نوشتن تغییر کرده است."
          : "صفحه‌بندی یا ذخیرهٔ PDF کامل نشد؛ مسیر مقصد را بررسی کنید.",
      );
    } finally {
      cleanupPrintDocument?.();
    }
  }, [exportReviewConfirmed, resetExportDialog, showNotice]);

  const startExport = useCallback(async () => {
    const nextName = exportNameForFormat(fileName, exportFormat);
    pendingExportRef.current = null;
    setExportStatus("preparing");
    setExportProgress(8);
    setExportWarnings([]);
    setExportReviewConfirmed(false);
    setExportError("");
    setExportResultPath("");
    setExportResultRevealable(false);

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
            const labels = {
              reading: "در حال خواندن ساختار نوشته…",
              diagrams: "در حال تبدیل نمودارها…",
              images: "در حال آماده‌سازی تصویرها…",
              document: "در حال ساخت سند قابل‌ویرایش…",
            } as const;
            const ranges = {
              reading: [8, 20],
              diagrams: [20, 58],
              images: [58, 76],
              document: [76, 94],
            } as const;
            const [start, end] = ranges[stage];
            const ratio = total > 0 ? completed / total : 0;
            const nextProgress = start + (end - start) * ratio;
            setExportProgress((current) => Math.max(current, nextProgress));
            setExportProgressLabel(labels[stage]);
          },
        });
        if (result.stats.diagrams > 0) {
          warnings.push({
            kind: "diagram",
            message: `${result.stats.diagrams.toLocaleString("fa-IR")} نمودار Mermaid برای DOCX به تصویر تبدیل می‌شود.`,
          });
        }
        warnings.push(...result.warnings);
        pendingExportRef.current = {
          format: "word",
          fileName: nextName,
          bytes: result.bytes,
        };
      } else {
        setPdfExportActive(true);
        setExportProgress(32);
        setExportProgressLabel("در حال آماده‌سازی قلم‌ها، تصاویر و نمودارها…");
        await waitForNextPaint();
        warnings.push(
          ...(await inspectPrintablePreview(previewArticleRef.current)),
        );
        setExportProgress(94);
        pendingExportRef.current = { format: "pdf", fileName: nextName };
      }

      const uniqueWarnings = warnings.filter(
        (warning, index, all) =>
          all.findIndex(
            (candidate) => candidate.message === warning.message,
          ) === index,
      );
      if (pendingExportRef.current) {
        pendingExportRef.current.requiresReviewConfirmation =
          uniqueWarnings.length > 0;
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
      setExportProgress(0);
      setExportProgressLabel("");
      setExportError(
        exportFormat === "word"
          ? "ساخت فایل Word کامل نشد؛ نمودارها و تصاویر سند را بررسی و دوباره تلاش کنید."
          : "پیش‌نمایش چاپ آماده نشد؛ دوباره تلاش کنید.",
      );
    }
  }, [
    annotations,
    commitPreparedExport,
    content,
    exportFormat,
    fileName,
    imageAssets,
  ]);

  const changeExportFormat = useCallback((format: ExportFormat) => {
    pendingExportRef.current = null;
    setExportFormat(format);
    setExportStatus("idle");
    setExportProgress(0);
    setExportWarnings([]);
    setExportReviewConfirmed(false);
    setExportError("");
    setExportResultPath("");
    setExportResultRevealable(false);
    setExportProgressLabel("");
    setPdfExportActive(false);
  }, []);

  const backFromExportReview = useCallback(() => {
    pendingExportRef.current = null;
    setExportStatus("idle");
    setExportProgress(0);
    setExportProgressLabel("");
    setExportWarnings([]);
    setExportReviewConfirmed(false);
    setExportError("");
    setExportResultPath("");
    setPdfExportActive(false);
  }, []);

  const revealExportResult = useCallback(async () => {
    if (!exportResultPath) return;
    const desktop = window.raaviDesktop;
    if (!desktop?.revealExport) {
      showNotice("مرورگر اجازهٔ نمایش مستقیم پوشهٔ دانلود را نمی‌دهد.");
      return;
    }
    try {
      const result = await desktop.revealExport(exportResultPath);
      if (!result.revealed) {
        showNotice("پوشهٔ فایل خروجی در دسترس نیست.");
      }
    } catch {
      showNotice("نمایش پوشهٔ فایل خروجی ممکن نشد.");
    }
  }, [exportResultPath, showNotice]);

  const openNewDocumentModal = useCallback(() => {
    setNewDocumentError("");
    setNewDocumentCreating(false);
    setNewDocumentModalOpen(true);
  }, []);

  const createNewDocument = useCallback(
    async (spec: NewDocumentSpec) => {
      let initialContent = "";
      if (spec.includeTitle) {
        const { titleFromDocumentName } =
          await import("./components/new-document-dialog");
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
          const result = await desktop.saveMarkdown(spec.fileName, payload);
          if (!result.saved) return;
          nextPath = result.filePath ?? "";
        } else {
          const blob = new Blob([initialContent], {
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
            documentType: "markdown",
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
          applyOpenedDocument(
            {
              ...document,
              openInReadingMode:
                fileLibraryPreferencesRef.current.defaultOpenMode === "reading",
            },
            `«${document.name}» باز شد.`,
          );
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
        "این فایل پشتیبانی نمی‌شود؛ یک فایل Markdown معتبر انتخاب کنید.",
      );
      return;
    }

    const maximumSize = isRaaviFile ? 64 * 1024 * 1024 : MAX_FILE_SIZE;
    if (file.size > maximumSize) {
      setError(
        isRaaviFile
          ? "حجم فایل راوی بیشتر از ۶۴ مگابایت است؛ یک فایل کوچک‌تر انتخاب کنید."
          : "حجم فایل Markdown بیشتر از ۱۶ مگابایت است؛ یک فایل کوچک‌تر انتخاب کنید.",
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
            openInReadingMode:
              fileLibraryPreferencesRef.current.defaultOpenMode === "reading",
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
            openInReadingMode:
              fileLibraryPreferencesRef.current.defaultOpenMode === "reading",
          },
          "فایل باز شد و پیش‌نمایش آماده است.",
        );
      }
    } catch {
      setError(
        isRaaviFile
          ? "سند قدیمی راوی معتبر نیست یا با نسخه‌ی دیگری ساخته شده است."
          : "خواندن فایل ممکن نبود؛ دوباره تلاش کنید.",
      );
    }
  };

  const scanConnectedDirectory = useCallback(
    async (
      handle: LocalDirectoryHandle,
      silent = false,
      connectedRootId?: string,
    ) => {
      setLibraryState("scanning");
      setError("");

      try {
        const rootId = connectedRootId ?? `web:${handle.name}`;
        const files = await scanMarkdownDirectory(handle, rootId, handle.name);
        const writable = await browserLibraryIsWritable(handle);
        files.sort((a, b) => a.path.localeCompare(b.path, "fa"));
        setLibraryFiles((current) => [
          ...current.filter((file) => file.rootId !== rootId),
          ...files,
        ]);
        setLibraryFolders((current) => [
          ...current.filter((folder) => folder.rootId !== rootId),
          {
            rootId,
            rootName: handle.name,
            rootPath: "",
            capabilities: writable
              ? WRITABLE_LIBRARY_CAPABILITIES
              : READ_ONLY_LIBRARY_CAPABILITIES,
          },
        ]);
        if (!silent) setLibraryQuery("");
        setLibraryState("ready");
        if (!silent) {
          showNotice(
            files.length
              ? `${files.length.toLocaleString("fa-IR")} فایل Markdown به کتابخانه اضافه شد.`
              : "در این پوشه فایل Markdown پیدا نشد.",
          );
        }
        return true;
      } catch {
        setLibraryState(libraryFiles.length ? "ready" : "idle");
        setError(
          "اسکن پوشه کامل نشد؛ دسترسی پوشه را بررسی کنید و دوباره تلاش کنید.",
        );
        return false;
      }
    },
    [libraryFiles.length, showNotice],
  );

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
            relativePath: file.path,
            rootId,
            rootName: scan.rootName,
            nativePath: file.nativePath,
            documentType: file.documentType,
            size: file.size,
            lastModified: file.lastModified,
            read: () => desktop.readLibraryDocument(file.nativePath),
            readForSearch: async () =>
              (await desktop.readLibrarySearchText(file.nativePath)).content,
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
          capabilities: WRITABLE_LIBRARY_CAPABILITIES,
        },
      ]);
      if (!silent) setLibraryQuery("");
      setLibraryState("ready");
      if (scan.errors?.length) {
        setError(
          `${scan.errors.length.toLocaleString("fa-IR")} مسیر خوانده نشد؛ مجوز پوشه‌های مشخص‌شده را بررسی کنید و دوباره به‌روزرسانی را بزنید.`,
        );
      }
      if (!silent) {
        showNotice(
          scan.truncated
            ? "۲۰٬۰۰۰ فایل اول اضافه شد؛ برای سرعت بیشتر پوشه‌ی کوچک‌تری انتخاب کنید."
            : entries.length
              ? `${entries.length.toLocaleString("fa-IR")} فایل Markdown به کتابخانه اضافه شد.`
              : "در این پوشه فایل Markdown پیدا نشد.",
        );
      }
    },
    [showNotice],
  );

  const connectLibrary = useCallback(async () => {
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
        setError("اتصال به پوشه انجام نشد؛ دوباره «انتخاب پوشه» را بزنید.");
      }
      return;
    }

    const pickerWindow = window as DirectoryPickerWindow;
    if (!pickerWindow.showDirectoryPicker) {
      directoryInputRef.current?.click();
      return;
    }

    try {
      const handle = await pickerWindow.showDirectoryPicker({
        mode: "readwrite",
      });
      const rootId = `web:${crypto.randomUUID()}`;
      let persisted = true;
      try {
        await persistBrowserLibraryHandle({
          id: rootId,
          name: handle.name,
          handle,
        });
      } catch {
        persisted = false;
      }
      directoryHandlesRef.current.set(rootId, handle);
      setActiveLibraryPath("");
      const scanned = await scanConnectedDirectory(handle, false, rootId);
      if (scanned && !persisted) {
        setError(
          "این مرورگر نگه‌داری دسترسی پوشه را نپذیرفت؛ اتصال فقط تا بستن این صفحه فعال می‌ماند.",
        );
      }
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
  }, [applyDesktopLibrary, libraryFiles.length, scanConnectedDirectory]);

  const openNewTabWorkspace = useCallback(() => {
    setReadingMode(false);
    setReadingHeaderVisible(true);
    setReadingToolsOpen(false);
    setNewTabWorkspaceOpen(true);
    setLibraryOpen(false);
    setDocumentMenuOpen(false);
    setMobileHeaderMenuOpen(false);
  }, []);

  const selectDocumentTab = useCallback(
    (tabId: string) => {
      if (tabId === activeDocumentTabId && !newTabWorkspaceOpen) return;
      const tab = documentTabs.find((candidate) => candidate.id === tabId);
      if (!tab) return;
      setDocumentTabs((current) =>
        current.map((candidate) =>
          candidate.id === activeDocumentTabId
            ? {
                ...candidate,
                title: fileName,
                path: activeDocumentPath,
                draftId: documentDraftId,
                dirty: effectiveSaveState === "dirty",
                snapshot: localDocumentSnapshot,
              }
            : candidate,
        ),
      );
      setActiveDocumentTabId(tabId);
      setNewTabWorkspaceOpen(false);
      applyLocalDocumentSnapshot(tab.snapshot);
      requestAnimationFrame(() => editorRef.current?.focus());
    },
    [
      activeDocumentPath,
      activeDocumentTabId,
      applyLocalDocumentSnapshot,
      documentDraftId,
      documentTabs,
      effectiveSaveState,
      fileName,
      localDocumentSnapshot,
      newTabWorkspaceOpen,
    ],
  );

  const closeDocumentTab = useCallback(
    (tabId: string, discardChanges = false) => {
      const tab = documentTabs.find((candidate) => candidate.id === tabId);
      if (!tab) return;
      const isDirty =
        tab.dirty ||
        (tabId === activeDocumentTabId && effectiveSaveState === "dirty");
      if (isDirty && !discardChanges) {
        if (tabId !== activeDocumentTabId) selectDocumentTab(tabId);
        setPendingDocumentClose({
          kind: "single",
          tabId,
          title: tab.title,
          dirtyCount: 1,
        });
        return;
      }
      const index = documentTabs.findIndex(
        (candidate) => candidate.id === tabId,
      );
      const nextTabs = documentTabs.filter(
        (candidate) => candidate.id !== tabId,
      );
      const closedTab =
        tabId === activeDocumentTabId
          ? {
              ...tab,
              title: fileName,
              path: activeDocumentPath,
              draftId: documentDraftId,
              dirty: false,
              snapshot: localDocumentSnapshot,
            }
          : { ...tab, dirty: false };
      if (!discardChanges) {
        setClosedDocumentTabs((current) =>
          [
            closedTab,
            ...current.filter((candidate) => candidate.id !== tabId),
          ].slice(0, 10),
        );
        showClosedTabRecovery();
      } else {
        setClosedDocumentTabs((current) =>
          current.filter((candidate) => candidate.id !== tabId),
        );
        showNotice(`«${tab.title}» بدون ذخیره بسته شد.`);
      }
      setDocumentTabs(nextTabs);
      if (tabId !== activeDocumentTabId) return;
      const nextTab = nextTabs[Math.min(index, nextTabs.length - 1)];
      if (nextTab) {
        setActiveDocumentTabId(nextTab.id);
        setNewTabWorkspaceOpen(false);
        applyLocalDocumentSnapshot(nextTab.snapshot);
      } else {
        setActiveDocumentTabId("");
        setNewTabWorkspaceOpen(true);
      }
    },
    [
      activeDocumentTabId,
      activeDocumentPath,
      applyLocalDocumentSnapshot,
      documentDraftId,
      documentTabs,
      effectiveSaveState,
      fileName,
      localDocumentSnapshot,
      selectDocumentTab,
      showClosedTabRecovery,
      showNotice,
    ],
  );
  useEffect(() => {
    closeDocumentTabActionRef.current = closeDocumentTab;
    return () => {
      closeDocumentTabActionRef.current = null;
    };
  }, [closeDocumentTab]);

  const toggleDocumentTabPinned = useCallback(
    (tabId: string) => {
      const tab = documentTabs.find((candidate) => candidate.id === tabId);
      if (!tab) return;
      setDocumentTabs((current) =>
        setDocumentTabPinned(current, tabId, !tab.pinned),
      );
      showNotice(tab.pinned ? "سنجاق تب برداشته شد." : "تب سنجاق شد.");
    },
    [documentTabs, showNotice],
  );

  const closeOtherDocumentTabs = useCallback(
    (tabId: string, discardChanges = false) => {
      const target = documentTabs.find((candidate) => candidate.id === tabId);
      if (!target) return;
      const others = documentTabs.filter((candidate) => candidate.id !== tabId);
      const dirtyOthers = others.filter((candidate) => candidate.dirty);
      if (dirtyOthers.length && !discardChanges) {
        setPendingDocumentClose({
          kind: "others",
          tabId,
          title: target.title,
          dirtyCount: dirtyOthers.length,
        });
        return;
      }
      const recoverableOthers = discardChanges
        ? others.filter((candidate) => !candidate.dirty)
        : others;
      setClosedDocumentTabs((current) =>
        [
          ...recoverableOthers.map((candidate) => ({
            ...candidate,
            dirty: false,
          })),
          ...current.filter(
            (candidate) => !others.some((closed) => closed.id === candidate.id),
          ),
        ].slice(0, 10),
      );
      if (recoverableOthers.length) showClosedTabRecovery();
      setDocumentTabs([target]);
      if (tabId !== activeDocumentTabId) {
        setActiveDocumentTabId(tabId);
        setNewTabWorkspaceOpen(false);
        applyLocalDocumentSnapshot(target.snapshot);
      }
      showNotice(
        dirtyOthers.length
          ? "سایر تب‌ها بسته شدند و تغییرهای ذخیره‌نشده کنار گذاشته شدند."
          : "سایر تب‌ها بسته شدند.",
      );
    },
    [
      activeDocumentTabId,
      applyLocalDocumentSnapshot,
      documentTabs,
      showClosedTabRecovery,
      showNotice,
    ],
  );

  const reopenLastClosedDocumentTab = useCallback(() => {
    const closedTab = closedDocumentTabs[0];
    if (!closedTab) return;
    setClosedTabRecoveryVisible(false);
    if (closedTabRecoveryTimerRef.current) {
      clearTimeout(closedTabRecoveryTimerRef.current);
    }
    setClosedDocumentTabs((current) => current.slice(1));
    setDocumentTabs((current) =>
      orderDocumentTabs([
        ...current.filter((candidate) => candidate.id !== closedTab.id),
        { ...closedTab, dirty: false },
      ]),
    );
    setActiveDocumentTabId(closedTab.id);
    setNewTabWorkspaceOpen(false);
    applyLocalDocumentSnapshot(closedTab.snapshot);
    showNotice(`«${closedTab.title}» دوباره باز شد.`);
    requestAnimationFrame(() => editorRef.current?.focus());
  }, [applyLocalDocumentSnapshot, closedDocumentTabs, showNotice]);

  const createDocumentFromTemplate = useCallback(
    async (template: NoteTemplate) => {
      const activeWorkspace =
        libraryFolders.find(
          (folder) =>
            folder.rootId === fileLibraryPreferences.activeWorkspaceRootId,
        ) ?? libraryFolders[0];
      if (!activeWorkspace) {
        await connectLibrary();
        return;
      }

      const stamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace("T", " ")
        .replaceAll(":", "-");
      const fileName = `${template.suggestedBaseName} ${stamp}.md`;
      const initialContent = resolveTemplateContent(template);
      const request: LibraryMutationRequest = {
        kind: "create-file",
        rootId: activeWorkspace.rootId,
        parentPath: "",
        name: fileName,
        content: initialContent,
      };

      setTemplateCreating(true);
      setError("");
      libraryWriteInProgressRef.current = true;
      try {
        const desktop = window.raaviDesktop;
        if (desktop && activeWorkspace.rootPath && desktop.mutateLibrary) {
          const response = await desktop.mutateLibrary(
            activeWorkspace.rootPath,
            request,
          );
          applyDesktopLibrary(response.scan, true);
          const target = response.scan.files.find(
            (file) => file.path === response.result.nextPath,
          );
          if (!target)
            throw new Error("Created document was not returned by scan.");
          const opened = await desktop.readLibraryDocument(target.nativePath);
          applyOpenedDocument(
            { ...opened, openInReadingMode: false },
            `«${fileName}» از قالب «${template.title}» ساخته شد.`,
          );
        } else {
          const handle = directoryHandlesRef.current.get(
            activeWorkspace.rootId,
          );
          if (!handle) {
            throw new Error("پوشهٔ فعال برای نوشتن دوباره باید انتخاب شود.");
          }
          const result = await performBrowserLibraryMutation(
            handle,
            request,
            browserUndoStoreRef.current,
          );
          await scanConnectedDirectory(handle, true, activeWorkspace.rootId);
          applyOpenedDocument(
            {
              name: fileName,
              path: "",
              documentType: "markdown",
              content: initialContent,
              annotations: [],
              assets: [],
              revision: 1,
              versions: [],
              openInReadingMode: false,
              draftId: `browser-library:${activeWorkspace.rootId}:${result.nextPath ?? fileName}`,
            },
            `«${fileName}» در دفتر فعال ساخته شد.`,
          );
          if (result.nextPath) {
            setActiveLibraryKey(
              `${activeWorkspace.rootId}::${result.nextPath}`,
            );
            setActiveLibraryPath(
              `${activeWorkspace.rootName}/${result.nextPath}`,
            );
          }
        }
        setNewTabWorkspaceOpen(false);
        setSingleEditorMode("live");
        setSplitWorkspaceActive(false);
        setDesktopPaneMode("editor");
        setMobilePane("editor");
        if (template.id === "blank") {
          window.requestAnimationFrame(() => {
            editorRef.current?.setSelectionRange(0, 0, false);
            editorRef.current?.focus();
          });
        }
      } catch (templateError) {
        setError(libraryErrorMessage(templateError));
      } finally {
        setTemplateCreating(false);
        window.setTimeout(() => {
          libraryWriteInProgressRef.current = false;
        }, 500);
      }
    },
    [
      applyDesktopLibrary,
      applyOpenedDocument,
      connectLibrary,
      fileLibraryPreferences.activeWorkspaceRootId,
      libraryFolders,
      scanConnectedDirectory,
    ],
  );

  const handleFallbackDirectory = (files: FileList | null) => {
    if (!files?.length) return;

    const selectedFiles = Array.from(files);
    const firstRelativePath =
      (selectedFiles[0] as File & { webkitRelativePath?: string })
        .webkitRelativePath || selectedFiles[0].name;
    const rootName = firstRelativePath.split("/")[0] || "پوشه‌ی انتخابی";

    const entries = selectedFiles
      .filter((file) => /\.(md|markdown)$/i.test(file.name))
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
          relativePath,
          rootId,
          rootName,
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
          readForSearch: async () => {
            const rawContent = await file.text();
            if (documentType !== "ravi") return rawContent;
            return parseRaaviDocument(
              rawContent,
              file.name.replace(/\.ravi$/i, ".md"),
            ).content;
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
      {
        rootId,
        rootName,
        rootPath: "",
        capabilities: READ_ONLY_LIBRARY_CAPABILITIES,
      },
    ]);
    setActiveLibraryPath("");
    setLibraryQuery("");
    setLibraryState("ready");
    showNotice(
      entries.length
        ? `${entries.length.toLocaleString("fa-IR")} فایل Markdown به کتابخانه اضافه شد.`
        : "در این پوشه فایل Markdown پیدا نشد.",
    );
  };

  const openLibraryFile = async (file: LibraryFile) => {
    const nextKey = libraryPinKey(file);
    if (effectiveSaveState === "dirty" && activeLibraryKey !== nextKey) {
      setError(
        "سند فعلی تغییرات ذخیره‌نشده دارد. ابتدا آن را ذخیره کنید؛ سپس فایل دیگری را باز کنید.",
      );
      return false;
    }
    const maximumSize =
      file.documentType === "ravi" ? 64 * 1024 * 1024 : MAX_FILE_SIZE;
    if (file.size > maximumSize) {
      setError(
        file.documentType === "ravi"
          ? "حجم این فایل راوی بیشتر از ۶۴ مگابایت است."
          : "حجم این فایل Markdown بیشتر از ۱۶ مگابایت است.",
      );
      return false;
    }

    setOpeningLibraryPath(file.path);
    setError("");

    try {
      const document = await file.read();
      applyOpenedDocument(
        {
          ...document,
          path: document.path || file.nativePath || "",
          openInReadingMode:
            fileLibraryPreferencesRef.current.defaultOpenMode === "reading",
          draftId: `web-library:${file.path}`,
        },
        `«${file.name}» از کتابخانه باز شد.`,
      );
      setActiveLibraryPath(file.path);
      setActiveLibraryKey(nextKey);
      setActiveLibrarySignature(`${file.lastModified}:${file.size}`);
      setExternalLibraryChange(null);
      setQuickOpenUsage((current) => {
        const key = libraryPinKey(file);
        const previous = current[key];
        return {
          ...current,
          [key]: {
            count: Math.min(10_000, (previous?.count ?? 0) + 1),
            lastOpened: Date.now(),
          },
        };
      });
      if (window.matchMedia(SIDEBAR_DRAWER_MEDIA_QUERY).matches) {
        setLibraryOpen(false);
      }
      return true;
    } catch {
      setError(
        "خواندن این فایل ممکن نبود؛ پوشه را دوباره متصل کنید و مجوز دسترسی را تأیید کنید.",
      );
      return false;
    } finally {
      setOpeningLibraryPath("");
    }
  };

  const openRecentFile = async (recent: DesktopRecentFile) => {
    const normalizedPath = recent.path.toLocaleLowerCase("en-US");
    const libraryFile = libraryFiles.find(
      (candidate) =>
        (candidate.nativePath ?? candidate.path).toLocaleLowerCase("en-US") ===
        normalizedPath,
    );
    if (libraryFile) {
      const opened = await openLibraryFile(libraryFile);
      if (!opened) {
        const desktop = window.raaviDesktop;
        const pruned = await desktop
          ?.removeRecentFileIfMissing?.(recent.path)
          .catch(() => null);
        if (pruned?.removed) {
          setRecentFiles(pruned.state.recents);
          setQuickOpenUsage((current) => {
            const next = { ...current };
            delete next[libraryPinKey(libraryFile)];
            return next;
          });
          return "missing" as const;
        }
        return "failed" as const;
      }
      return "opened" as const;
    }

    const desktop = window.raaviDesktop;
    if (!desktop) return "failed" as const;
    setOpeningLibraryPath(recent.path);
    setError("");
    try {
      const document = await desktop.openRecentDocument(recent.path);
      applyOpenedDocument(
        {
          ...document,
          openInReadingMode:
            fileLibraryPreferencesRef.current.defaultOpenMode === "reading",
        },
        `«${recent.name}» باز شد.`,
      );
      if (window.matchMedia(SIDEBAR_DRAWER_MEDIA_QUERY).matches) {
        setLibraryOpen(false);
      }
      return "opened" as const;
    } catch {
      const pruned = await desktop
        .removeRecentFileIfMissing?.(recent.path)
        .catch(() => null);
      if (pruned?.removed) {
        setRecentFiles(pruned.state.recents);
        setError(
          "این فایل دیگر در مسیر قبلی پیدا نشد؛ آن را دوباره از پوشه باز کنید.",
        );
        return "missing" as const;
      }
      setError("باز کردن فایل انجام نشد؛ دسترسی فایل را بررسی کنید.");
      return "failed" as const;
    } finally {
      setOpeningLibraryPath("");
    }
  };

  const openSearchResult = async (result: LocalSearchResult) => {
    const file = libraryFilesByKey.get(result.key);
    if (!file) {
      setLibrarySearchError(
        "این فایل پس از تغییر پوشه دیگر در نمایه نیست؛ قفسه را به‌روزرسانی کنید.",
      );
      setLibrarySearchRequestState("error");
      return;
    }
    const opened = await openLibraryFile(file);
    if (!opened || result.offset === null) return;
    setMobilePane("editor");
    setDesktopPaneMode((current) =>
      current === "preview" ? "split" : current,
    );
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const editor = editorRef.current;
        if (!editor) return;
        const offset = Math.min(result.offset ?? 0, editor.value.length);
        editor.focus();
        editor.setSelectionRange(offset, offset);
      });
    });
  };

  const openQuickOpenFile = async (candidate: QuickOpenFile) => {
    const file = libraryFilesByKey.get(candidate.key);
    if (!file) {
      setQuickOpenOpen(false);
      setError("این فایل دیگر در قفسه نیست؛ پوشه را به‌روزرسانی کنید.");
      return;
    }
    setQuickOpenOpen(false);
    await openLibraryFile(file);
  };

  const togglePinnedLibraryKey = (key: string) => {
    const file = libraryFilesByKey.get(key);
    if (file) togglePinnedLibraryFile(file);
  };

  const entryTouchesActiveDocument = (entry: FileExplorerActionEntry) => {
    if (!activeLibraryFile || activeLibraryFile.rootId !== entry.rootId) {
      return false;
    }
    return entry.kind === "file"
      ? activeLibraryFile.relativePath === entry.relativePath
      : Boolean(entry.relativePath) &&
          (activeLibraryFile.relativePath === entry.relativePath ||
            activeLibraryFile.relativePath.startsWith(
              `${entry.relativePath}/`,
            ));
  };

  const migratePinnedPaths = (
    rootId: string,
    previousPath: string,
    nextPath: string | null,
    entryKind: "file" | "folder",
  ) => {
    const previousKey = `${rootId}::${previousPath}`;
    setPinnedLibraryKeys((current) =>
      current.flatMap((key) => {
        const matches =
          key === previousKey ||
          (entryKind === "folder" && key.startsWith(`${previousKey}/`));
        if (!matches) return [key];
        if (!nextPath) return [];
        return [`${rootId}::${nextPath}${key.slice(previousKey.length)}`];
      }),
    );
  };

  const submitFileOperation = async (
    mode: Exclude<FileOperationMode, "menu">,
    value: string,
  ) => {
    if (!fileOperation) return;
    const { entry } = fileOperation;
    const root = libraryFolders.find(
      (folder) => folder.rootId === entry.rootId,
    );
    if (!root) {
      setFileOperationError(
        "پوشهٔ اصلی دیگر متصل نیست؛ آن را دوباره انتخاب کنید.",
      );
      return;
    }
    if (
      entryTouchesActiveDocument(entry) &&
      effectiveSaveState === "dirty" &&
      (mode === "rename" || mode === "move" || mode === "delete")
    ) {
      setFileOperationError(
        "این سند تغییرات ذخیره‌نشده دارد؛ ابتدا آن را ذخیره کنید.",
      );
      return;
    }

    const request: LibraryMutationRequest =
      mode === "create-file"
        ? {
            kind: "create-file",
            rootId: entry.rootId,
            parentPath:
              entry.kind === "folder"
                ? entry.relativePath
                : parentLibraryPath(entry.relativePath),
            name: value,
            content: `# ${value.replace(/\.(?:md|markdown)$/iu, "")}\n`,
          }
        : mode === "create-folder"
          ? {
              kind: "create-folder",
              rootId: entry.rootId,
              parentPath:
                entry.kind === "folder"
                  ? entry.relativePath
                  : parentLibraryPath(entry.relativePath),
              name: value,
            }
          : mode === "rename"
            ? {
                kind: "rename",
                rootId: entry.rootId,
                sourcePath: entry.relativePath,
                name: value,
                entryKind: entry.kind,
              }
            : mode === "move"
              ? {
                  kind: "move",
                  rootId: entry.rootId,
                  sourcePath: entry.relativePath,
                  destinationFolder: value,
                  entryKind: entry.kind,
                }
              : {
                  kind: "delete",
                  rootId: entry.rootId,
                  sourcePath: entry.relativePath,
                  entryKind: entry.kind,
                };

    setFileOperationBusy(true);
    setFileOperationError("");
    libraryWriteInProgressRef.current = true;
    try {
      let result: LibraryMutationResult;
      const desktop = window.raaviDesktop;
      if (desktop && root.rootPath && desktop.mutateLibrary) {
        const response = await desktop.mutateLibrary(root.rootPath, request);
        result = response.result;
        applyDesktopLibrary(response.scan, true);
      } else {
        const handle = directoryHandlesRef.current.get(root.rootId);
        if (!handle) {
          throw new Error(
            "این پوشه فقط خواندنی است؛ آن را دوباره با اجازهٔ ویرایش متصل کنید.",
          );
        }
        result = await performBrowserLibraryMutation(
          handle,
          request,
          browserUndoStoreRef.current,
        );
        await scanConnectedDirectory(handle, true, root.rootId);
      }

      if (result.previousPath) {
        migratePinnedPaths(
          entry.rootId,
          result.previousPath,
          result.kind === "delete" ? null : (result.nextPath ?? null),
          entry.kind,
        );
      }

      const touchesActive = entryTouchesActiveDocument(entry);
      if (touchesActive && result.kind === "delete" && result.undoToken) {
        setLibraryUndo({
          token: result.undoToken,
          rootId: entry.rootId,
          label: entry.name,
          previousPath: entry.relativePath,
          activeDocument: {
            content,
            path: activeDocumentPath,
            fileName,
            snapshot: lastSavedSnapshot,
          },
        });
        setActiveDocumentPath("");
        setActiveLibraryPath("");
        setActiveLibraryKey("");
        setActiveLibrarySignature("");
        setLastSavedSnapshot("");
        setExternalLibraryChange({
          kind: "missing",
          file: null,
          message:
            "فایل فعال حذف شد، اما متن آن در میز راوی محفوظ است. «بازگردانی» را بزنید یا سند را با نام تازه ذخیره کنید.",
        });
      } else if (touchesActive && result.nextPath) {
        const nextDisplayPath = `${root.rootName}/${result.nextPath}`;
        setActiveLibraryPath(nextDisplayPath);
        setActiveLibraryKey(`${entry.rootId}::${result.nextPath}`);
        if (entry.kind === "file") {
          setFileName(
            result.nextPath.slice(result.nextPath.lastIndexOf("/") + 1),
          );
        }
        if (desktop && root.rootPath) {
          const nextFile =
            (await desktop.scanMarkdownFolder(root.rootPath)).files.find(
              (file) => file.path === result.nextPath,
            ) ?? null;
          if (nextFile) {
            setActiveDocumentPath(nextFile.nativePath);
            setActiveLibrarySignature(
              `${nextFile.lastModified}:${nextFile.size}`,
            );
          }
        }
      }

      if (result.kind === "delete" && result.undoToken && !touchesActive) {
        setLibraryUndo({
          token: result.undoToken,
          rootId: entry.rootId,
          label: entry.name,
          previousPath: entry.relativePath,
        });
      }
      setFileOperation(null);
      showNotice(
        result.kind === "create-file"
          ? "فایل تازه ساخته شد."
          : result.kind === "create-folder"
            ? "پوشهٔ تازه ساخته شد."
            : result.kind === "rename"
              ? "نام با موفقیت تغییر کرد."
              : result.kind === "move"
                ? "مورد به پوشهٔ مقصد منتقل شد."
                : "مورد حذف شد؛ امکان بازگردانی در اعلان پایین صفحه وجود دارد.",
      );
    } catch (operationError) {
      setFileOperationError(libraryErrorMessage(operationError));
    } finally {
      setFileOperationBusy(false);
      window.setTimeout(() => {
        libraryWriteInProgressRef.current = false;
      }, 500);
    }
  };

  const undoLastLibraryDelete = async () => {
    if (!libraryUndo) return;
    const root = libraryFolders.find(
      (folder) => folder.rootId === libraryUndo.rootId,
    );
    if (!root) return;
    try {
      let result: LibraryMutationResult;
      const desktop = window.raaviDesktop;
      if (desktop && root.rootPath && desktop.undoLibraryMutation) {
        const response = await desktop.undoLibraryMutation(libraryUndo.token);
        result = response.result;
        applyDesktopLibrary(response.scan, true);
      } else {
        const handle = directoryHandlesRef.current.get(root.rootId);
        if (!handle) throw new Error("پوشه دیگر متصل نیست.");
        result = await undoBrowserLibraryDelete(
          handle,
          libraryUndo.token,
          browserUndoStoreRef.current,
        );
        await scanConnectedDirectory(handle, true, root.rootId);
      }
      if (libraryUndo.activeDocument && result.nextPath) {
        setActiveLibraryPath(`${root.rootName}/${result.nextPath}`);
        setActiveLibraryKey(`${root.rootId}::${result.nextPath}`);
        setLastSavedSnapshot(libraryUndo.activeDocument.snapshot);
        setExternalLibraryChange(null);
        if (desktop && root.rootPath) {
          const scan = await desktop.scanMarkdownFolder(root.rootPath);
          const restored = scan.files.find(
            (file) => file.path === result.nextPath,
          );
          if (restored) {
            setActiveDocumentPath(restored.nativePath);
            setActiveLibrarySignature(
              `${restored.lastModified}:${restored.size}`,
            );
          }
        }
      }
      setLibraryUndo(null);
      showNotice(`«${libraryUndo.label}» بازگردانده شد.`);
    } catch (undoError) {
      setError(libraryErrorMessage(undoError));
    }
  };

  const refreshLibrary = async () => {
    setLibraryState("scanning");
    setError("");
    let failedRoots = 0;
    const desktop = window.raaviDesktop;
    const desktopFolders = desktop
      ? libraryFolders.filter((folder) => folder.rootPath)
      : [];
    if (desktop) {
      const desktopResults = await Promise.allSettled(
        desktopFolders.map(async (folder) => {
          const scan = await desktop.scanMarkdownFolder(folder.rootPath);
          applyDesktopLibrary(scan, true);
        }),
      );
      failedRoots += desktopResults.filter(
        (result) => result.status === "rejected",
      ).length;
    }

    const browserHandles = Array.from(directoryHandlesRef.current.entries());
    const browserResults = await Promise.allSettled(
      browserHandles.map(async ([rootId, handle]) => {
        const permission = handle.requestPermission
          ? await handle.requestPermission({ mode: "readwrite" })
          : "granted";
        if (permission !== "granted") return false;
        return scanConnectedDirectory(handle, true, rootId);
      }),
    );
    failedRoots += browserResults.filter(
      (result) => result.status === "rejected" || result.value === false,
    ).length;
    const sessionOnlyFolders = libraryFolders.filter(
      (folder) =>
        folder.rootId.startsWith("fallback:") &&
        !directoryHandlesRef.current.has(folder.rootId),
    ).length;
    failedRoots += sessionOnlyFolders;
    setLibraryState(
      desktopFolders.length || browserHandles.length ? "ready" : "idle",
    );
    if (failedRoots) {
      setError(
        sessionOnlyFolders
          ? "پوشه‌ای که با انتخاب فایل‌های مرورگر افزوده شده، برای به‌روزرسانی باید دوباره انتخاب شود. فایل باز فعلی محفوظ است."
          : `${failedRoots.toLocaleString("fa-IR")} پوشه به‌روز نشد؛ وجود پوشه و مجوز دسترسی آن را بررسی کنید. فایل باز فعلی محفوظ مانده است.`,
      );
      showNotice(
        sessionOnlyFolders &&
          failedRoots === sessionOnlyFolders &&
          !desktopFolders.length &&
          !browserHandles.length
          ? "برای به‌روزرسانی، پوشه را دوباره انتخاب کنید."
          : "بخش‌های در دسترس قفسه به‌روز شدند.",
      );
    } else {
      showNotice("قفسه به‌روز شد.");
    }
  };

  const disconnectLibraryFolder = async (rootId: string) => {
    const folder = libraryFolders.find(
      (candidate) => candidate.rootId === rootId,
    );
    if (!folder) return;
    const desktop = window.raaviDesktop;

    try {
      if (desktop && folder.rootPath) {
        if (!desktop.disconnectLibraryFolder) {
          throw new Error("Desktop disconnect is unavailable.");
        }
        const state = await desktop.disconnectLibraryFolder(folder.rootPath);
        setRecentFiles(state.recents);
      } else {
        directoryHandlesRef.current.delete(rootId);
        if (rootId.startsWith("web:")) {
          await removeBrowserLibraryHandle(rootId);
        }
      }

      setLibraryFolders((current) =>
        current.filter((candidate) => candidate.rootId !== rootId),
      );
      setLibraryFiles((current) =>
        current.filter((file) => file.rootId !== rootId),
      );
      setPinnedLibraryKeys((current) =>
        current.filter((key) => !key.startsWith(`${rootId}::`)),
      );
      setLibraryState(libraryFolders.length > 1 ? "ready" : "idle");
      showNotice(`اتصال «${folder.rootName}» قطع شد؛ هیچ فایلی حذف نشد.`);
    } catch {
      setError(
        "قطع اتصال پوشه انجام نشد؛ دسترسی پوشه را بررسی کنید و دوباره تلاش کنید.",
      );
      throw new Error("Library folder disconnect failed.");
    }
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
              capabilities: WRITABLE_LIBRARY_CAPABILITIES,
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

  useEffect(() => {
    if (window.raaviDesktop || browserHandlesRestoredRef.current) return;
    browserHandlesRestoredRef.current = true;
    let cancelled = false;
    void readBrowserLibraryHandles()
      .then(async (records) => {
        if (cancelled || !records.length) return;
        for (const record of records) {
          directoryHandlesRef.current.set(record.id, record.handle);
        }
        setLibraryFolders((current) => [
          ...current.filter(
            (folder) => !records.some((record) => record.id === folder.rootId),
          ),
          ...records.map((record) => ({
            rootId: record.id,
            rootName: record.name,
            rootPath: "",
            capabilities: READ_ONLY_LIBRARY_CAPABILITIES,
          })),
        ]);
        setLibraryState("ready");

        for (const record of records) {
          if (cancelled) return;
          const permission = record.handle.queryPermission
            ? await record.handle.queryPermission({ mode: "readwrite" })
            : "granted";
          if (permission === "granted") {
            await scanConnectedDirectory(record.handle, true, record.id);
          }
        }
      })
      .catch(() => {
        // Browsers without cloneable FileSystem handles keep session access only.
      });
    return () => {
      cancelled = true;
    };
  }, [scanConnectedDirectory]);

  useEffect(() => {
    if (
      window.raaviDesktop ||
      !fileLibraryPreferencesHydrated ||
      !fileLibraryPreferences.autoRefresh
    ) {
      return;
    }
    let cancelled = false;
    const refreshGrantedHandles = () => {
      void Promise.all(
        Array.from(directoryHandlesRef.current.entries()).map(
          async ([rootId, handle]) => {
            const permission = handle.queryPermission
              ? await handle.queryPermission({ mode: "readwrite" })
              : "granted";
            if (!cancelled && permission === "granted") {
              await scanConnectedDirectory(handle, true, rootId);
            }
          },
        ),
      );
    };
    window.addEventListener("focus", refreshGrantedHandles);
    document.addEventListener("visibilitychange", refreshGrantedHandles);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", refreshGrantedHandles);
      document.removeEventListener("visibilitychange", refreshGrantedHandles);
    };
  }, [
    fileLibraryPreferences.autoRefresh,
    fileLibraryPreferencesHydrated,
    scanConnectedDirectory,
  ]);

  useEffect(() => {
    const desktop = window.raaviDesktop;
    if (
      !desktop?.onLibraryChanged ||
      !fileLibraryPreferencesHydrated ||
      !fileLibraryPreferences.autoRefresh
    ) {
      return;
    }
    let cancelled = false;
    const unsubscribe = desktop.onLibraryChanged((change) => {
      if (change.reason === "mutation" || libraryWriteInProgressRef.current) {
        return;
      }
      const rootId = change.rootPath.toLocaleLowerCase("en-US");
      void desktop
        .scanMarkdownFolder(change.rootPath)
        .then((scan) => {
          if (cancelled) return;
          applyDesktopLibrary(scan, true);
          const activePrefix = `${rootId}::`;
          if (!activeLibraryKey.startsWith(activePrefix)) return;
          const relativePath = activeLibraryKey.slice(activePrefix.length);
          const changedFile = scan.files.find(
            (candidate) => candidate.path === relativePath,
          );
          if (!changedFile) {
            setExternalLibraryChange({
              kind: "missing",
              file: null,
              message:
                "فایل فعال بیرون از راوی حذف یا جابه‌جا شده است. متن فعلی محفوظ است؛ می‌توانید آن را با نام تازه ذخیره کنید.",
            });
            setLastSavedSnapshot("");
            return;
          }
          const nextSignature = `${changedFile.lastModified}:${changedFile.size}`;
          if (nextSignature === activeLibrarySignature) return;
          const file: LibraryFile = {
            id: `${rootId}:${changedFile.id}`,
            name: changedFile.name,
            path: `${scan.rootName}/${changedFile.path}`,
            relativePath: changedFile.path,
            rootId,
            rootName: scan.rootName,
            nativePath: changedFile.nativePath,
            documentType: changedFile.documentType,
            size: changedFile.size,
            lastModified: changedFile.lastModified,
            read: () => desktop.readLibraryDocument(changedFile.nativePath),
            readForSearch: async () =>
              (await desktop.readLibrarySearchText(changedFile.nativePath))
                .content,
          };
          setExternalLibraryChange({
            kind: "changed",
            file,
            message:
              effectiveSaveState === "dirty"
                ? "این فایل هم بیرون از راوی و هم در میز فعلی تغییر کرده است. متن فعلی جایگزین نمی‌شود؛ ابتدا آن را با نام تازه ذخیره کنید."
                : "این فایل بیرون از راوی تغییر کرده است. نسخهٔ تازه را بازخوانی کنید یا همین متن را نگه دارید.",
          });
        })
        .catch(() => {
          if (!cancelled) {
            setExternalLibraryChange({
              kind: "missing",
              file: null,
              message:
                "پوشهٔ فایل دیگر قابل خواندن نیست. دسترسی سیستم‌عامل را بررسی و پوشه را دوباره متصل کنید.",
            });
          }
        });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [
    activeLibraryKey,
    activeLibrarySignature,
    applyDesktopLibrary,
    effectiveSaveState,
    fileLibraryPreferences.autoRefresh,
    fileLibraryPreferencesHydrated,
  ]);

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
    focusToolbar = false,
  ) => {
    const mountedSelectionToolbar =
      editorSelectionMenuRef.current ??
      document.querySelector<HTMLDivElement>(".editor-selection-mini-menu");
    if (mountedSelectionToolbar?.contains(document.activeElement)) {
      return;
    }
    if (editorSelectionMenuTimerRef.current) {
      clearTimeout(editorSelectionMenuTimerRef.current);
    }
    setEditorSelectionMenuPosition(null);

    const editor = editorRef.current;
    const tableSelection = editor?.tableCellSelection;
    const selectionSource = tableSelection ? "table" : "editor";
    const selectionKey = tableSelection?.key;
    const selectionStart = tableSelection?.start ?? editor?.selectionStart ?? 0;
    const selectionEnd = tableSelection?.end ?? editor?.selectionEnd ?? 0;
    setEditorCaretOffset(
      tableSelection
        ? tableSelection.blockFrom + tableSelection.start
        : selectionStart,
    );
    if (!editor || selectionStart === selectionEnd) {
      dismissedEditorSelectionRef.current = null;
      setEditorSelectionStats(null);
      return;
    }

    const selectedText = (
      tableSelection?.text ?? editor.value.slice(selectionStart, selectionEnd)
    ).replace(/\r\n?/gu, "\n");
    setEditorSelectionStats({
      words: countDocumentWords(selectedText),
      characters: Array.from(selectedText).length,
    });
    const dismissedSelection = dismissedEditorSelectionRef.current;
    if (
      !focusToolbar &&
      dismissedSelection?.source === selectionSource &&
      dismissedSelection.key === selectionKey &&
      dismissedSelection?.start === selectionStart &&
      dismissedSelection.end === selectionEnd
    ) {
      return;
    }
    dismissedEditorSelectionRef.current = null;

    editorSelectionMenuTimerRef.current = setTimeout(
      () => {
        editorSelectionMenuTimerRef.current = null;
        requestAnimationFrame(() => {
          const editor = editorRef.current;
          const editorPane = editorPaneRef.current;
          if (!editor || !editorPane) return;
          const currentTableSelection = editor.tableCellSelection;
          if (selectionSource === "table") {
            if (
              currentTableSelection?.key !== selectionKey ||
              currentTableSelection?.start !== selectionStart ||
              currentTableSelection?.end !== selectionEnd
            )
              return;
          } else if (
            currentTableSelection ||
            editor.selectionStart !== selectionStart ||
            editor.selectionEnd !== selectionEnd
          ) {
            return;
          }

          const editorRect = editor.getBoundingClientRect();
          const paneRect = editorPane.getBoundingClientRect();
          const selectionAnchor = editor.getSelectionAnchor();
          const anchorClientX =
            pointer?.clientX ??
            tableSelection?.clientX ??
            selectionAnchor?.clientX ??
            editorRect.left + editorRect.width / 2;
          const anchorClientY =
            pointer?.clientY ??
            tableSelection?.clientY ??
            selectionAnchor?.clientY ??
            editorRect.top + 54;
          const placement =
            anchorClientY - editorRect.top >= 58 ? "above" : "below";
          const menuHalfWidth = Math.min(
            180,
            Math.max(160, paneRect.width / 2 - 12),
          );
          const minimumX = menuHalfWidth;
          const maximumX = paneRect.width - menuHalfWidth;
          const rawX = anchorClientX - paneRect.left;

          setEditorSelectionMenuPosition({
            x: Math.min(Math.max(rawX, minimumX), Math.max(minimumX, maximumX)),
            y:
              anchorClientY - paneRect.top + (placement === "above" ? -10 : 10),
            placement,
          });
        });
      },
      focusToolbar ? 0 : EDITOR_SELECTION_MENU_DELAY_MS,
    );
  };

  const focusEditorSelectionToolbar = () => {
    const editor = editorRef.current;
    if (!editor) return;
    dismissedEditorSelectionRef.current = null;
    const mountedSelectionToolbar =
      editorSelectionMenuRef.current ??
      document.querySelector<HTMLDivElement>(".editor-selection-mini-menu");
    if (mountedSelectionToolbar) {
      editorSelectionFocusRequestedRef.current = false;
      requestAnimationFrame(() => {
        const action =
          editorSelectionActionRefs.current[editorSelectionActionIndex] ??
          mountedSelectionToolbar.querySelector<HTMLButtonElement>(
            'button[tabindex="0"]',
          ) ??
          mountedSelectionToolbar.querySelector<HTMLButtonElement>("button");
        action?.focus({ preventScroll: true });
      });
      return;
    }
    if (
      !editor.tableCellSelection &&
      editor.selectionStart === editor.selectionEnd
    )
      return;
    editorSelectionFocusRequestedRef.current = true;
    captureEditorSelection(undefined, true);
  };

  const focusEditorSelectionAction = (index: number) => {
    const actionCount = EDITOR_SELECTION_COMMANDS.length + 1;
    const normalizedIndex = (index + actionCount) % actionCount;
    setEditorSelectionActionIndex(normalizedIndex);
    editorSelectionActionRefs.current[normalizedIndex]?.focus();
  };

  const handleEditorSelectionToolbarKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let nextIndex: number | null = null;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = editorSelectionActionIndex + 1;
        break;
      case "ArrowLeft":
        nextIndex = editorSelectionActionIndex - 1;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = EDITOR_SELECTION_COMMANDS.length;
        break;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    focusEditorSelectionAction(nextIndex);
  };

  const editorAnnotationSelection = (): SelectionDraft | null => {
    const editor = editorRef.current;
    if (!editor) return null;

    const source = editor.value;
    const tableSelection = editor.tableCellSelection;
    if (!tableSelection && editor.selectionStart === editor.selectionEnd)
      return null;
    const selectedSource =
      tableSelection?.text ??
      source.slice(editor.selectionStart, editor.selectionEnd);
    const quote = plainHeadingText(selectedSource).replace(/\s+/gu, " ").trim();
    if (!quote) return null;

    const renderedText =
      previewArticleRef.current?.textContent ?? plainHeadingText(source);
    const approximateStart = Math.round(
      ((tableSelection?.blockFrom ?? editor.selectionStart) /
        Math.max(1, source.length)) *
        renderedText.length,
    );
    let cursor = 0;
    let start = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    while (cursor <= renderedText.length) {
      const candidate = renderedText.indexOf(quote, cursor);
      if (candidate < 0) break;
      const distance = Math.abs(candidate - approximateStart);
      if (distance < nearestDistance) {
        start = candidate;
        nearestDistance = distance;
      }
      cursor = candidate + Math.max(1, quote.length);
    }
    if (start < 0) return null;

    return {
      start,
      end: start + quote.length,
      quote,
      prefix: renderedText.slice(Math.max(0, start - 48), start),
      suffix: renderedText.slice(
        start + quote.length,
        start + quote.length + 48,
      ),
    };
  };

  const runEditorAnnotation = (
    kind: Extract<AnnotationKind, "highlight" | "comment">,
    origin?: HTMLButtonElement | null,
  ) => {
    const selection = editorAnnotationSelection();
    if (!selection) {
      showNotice("انتخاب فعلی به متن قابل یادداشت تبدیل نشد.");
      return;
    }
    setEditorSelectionMenuPosition(null);
    if (kind === "highlight") {
      addAnnotation("highlight", "", selection);
    } else {
      openAnnotationComposer("comment", origin, selection);
    }
  };

  const insertInline = (before: string, after: string, placeholder: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    setEditorSelectionMenuPosition(null);
    const tableSelection = editor.tableCellSelection;
    if (tableSelection) {
      const selected = tableSelection.text || placeholder;
      const inserted = before + selected + after;
      editor.replaceTableCellRange({
        from: tableSelection.start,
        to: tableSelection.end,
        insert: inserted,
        selectionFrom: tableSelection.start + before.length,
        selectionTo: tableSelection.start + before.length + selected.length,
        announcement: "قالب متن سلول اعمال شد",
      });
      return;
    }
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const editorContent = editor.value;
    const selected = editorContent.slice(start, end) || placeholder;
    const inserted = before + selected + after;
    editor.replaceRange({
      from: start,
      to: end,
      insert: inserted,
      selectionFrom: start + before.length,
      selectionTo: start + before.length + selected.length,
      announcement: "قالب متن اعمال شد",
    });
  };

  const clearEditorInlineFormatting = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const tableSelection = editor.tableCellSelection;
    const edit = clearInlineFormatting(
      tableSelection?.value ?? editor.value,
      tableSelection?.start ?? editor.selectionStart,
      tableSelection?.end ?? editor.selectionEnd,
    );
    if (!edit) {
      showNotice("برای پاک‌کردن قالب‌بندی، بخشی از متن را انتخاب کنید.");
      return;
    }
    setEditorSelectionMenuPosition(null);
    if (tableSelection) {
      editor.replaceTableCellRange({
        ...edit,
        announcement: "قالب‌بندی درون‌خطی سلول پاک شد",
      });
      return;
    }
    editor.replaceRange({
      ...edit,
      announcement: "قالب‌بندی درون‌خطی پاک شد",
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
    editor.replaceRange({
      from: start,
      to: end,
      insert: quoted,
      selectionFrom: start,
      selectionTo: start + quoted.length,
      announcement: "نقل‌قول اعمال شد",
    });
  };

  const insertHeading = () => {
    const editor = editorRef.current;
    if (!editor) return;

    setEditorSelectionMenuPosition(null);
    const start = editor.selectionStart;
    const editorContent = editor.value;
    const lineStart =
      editorContent.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextBreak = editorContent.indexOf("\n", start);
    const lineEnd = nextBreak === -1 ? editorContent.length : nextBreak;
    const currentLine = editorContent.slice(lineStart, lineEnd);
    const title = currentLine.replace(/^#{1,6}\s*/u, "").trim() || "عنوان بخش";
    const nextLine = `## ${title}`;
    editor.replaceRange({
      from: lineStart,
      to: lineEnd,
      insert: nextLine,
      selectionFrom: lineStart + 3,
      selectionTo: lineStart + nextLine.length,
      announcement: "تیتر بخش اعمال شد",
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
    const prefix =
      start > 0 && !editorContent.slice(0, start).endsWith("\n\n")
        ? "\n\n"
        : "";
    const suffix =
      end < editorContent.length && !editorContent.slice(end).startsWith("\n\n")
        ? "\n\n"
        : "";
    const inserted = `${prefix}${list}${suffix}`;

    editor.replaceRange({
      from: start,
      to: end,
      insert: inserted,
      selectionFrom: start + prefix.length,
      selectionTo: start + prefix.length + list.length,
      announcement: "فهرست اعمال شد",
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
    const prefix =
      start > 0 && !editorContent.slice(0, start).endsWith("\n\n")
        ? "\n\n"
        : "";
    const suffix =
      end < editorContent.length && !editorContent.slice(end).startsWith("\n\n")
        ? "\n\n"
        : "";
    const inserted = `${prefix}${block}${suffix}`;

    editor.replaceRange({
      from: start,
      to: end,
      insert: inserted,
      selectionFrom: start + prefix.length + 6,
      selectionTo: start + prefix.length + 6 + selected.length,
      announcement: "قطعه‌کد درج شد",
    });
  };

  const insertTable = (
    rows = editorTableRows,
    columns = editorTableColumns,
  ) => {
    const editor = editorRef.current;
    if (!editor) return;

    setEditorSelectionMenuPosition(null);
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const editorContent = editor.value;
    const safeRows = Math.max(1, Math.min(6, rows));
    const safeColumns = Math.max(2, Math.min(6, columns));
    const table = [
      `| ${Array.from({ length: safeColumns }, (_, index) => `ستون ${index + 1}`).join(" | ")} |`,
      `| ${Array.from({ length: safeColumns }, () => ":---").join(" | ")} |`,
      ...Array.from(
        { length: safeRows },
        (_, row) =>
          `| ${Array.from({ length: safeColumns }, (_, column) => `مقدار ${row + 1}-${column + 1}`).join(" | ")} |`,
      ),
    ].join("\n");
    const lineBreak = editorContent.includes("\r\n") ? "\r\n" : "\n";
    const blockGap = `${lineBreak}${lineBreak}`;
    const prefix =
      start > 0 && !editorContent.slice(0, start).endsWith(blockGap)
        ? blockGap
        : "";
    const following = editorContent.slice(end);
    const existingBreaks = following.match(/^(?:\r\n|\n|\r){0,2}/u)?.[0] ?? "";
    const inserted = `${prefix}${table}${blockGap}`;
    const tableFrom = start + prefix.length;
    const caretAfterTable = tableFrom + table.length + blockGap.length;

    editor.replaceRange({
      from: start,
      to: end + existingBreaks.length,
      insert: inserted,
      selectionFrom: caretAfterTable,
      selectionTo: caretAfterTable,
      announcement: "جدول درج شد",
    });
    setEditorHelper(null);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        editor.element
          ?.querySelector<HTMLTextAreaElement>(
            `.cm-rich-table[data-table-from="${tableFrom}"] textarea[data-table-row="-1"][data-table-column="0"]`,
          )
          ?.focus({ preventScroll: true });
      });
    });
  };

  const insertCallout = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.slice(start, end).trim() || "متن یادداشت";
    const callout = `> [!NOTE] یادداشت\n${selected
      .split(/\r?\n/u)
      .map((line) => `> ${line}`)
      .join("\n")}`;
    editor.replaceRange({
      from: start,
      to: end,
      insert: callout,
      selectionFrom: start,
      selectionTo: start + callout.length,
      announcement: "فراخوان درج شد",
    });
  };

  const cleanPersianMarkdown = () => {
    const editor = editorRef.current;
    const normalized = normalizePersianMarkdown(content);
    setEditorSelectionMenuPosition(null);
    if (editor) {
      const caret = Math.min(editor.selectionStart, normalized.length);
      editor.replaceRange({
        from: 0,
        to: editor.value.length,
        insert: normalized,
        selectionFrom: caret,
        selectionTo: caret,
        announcement: "متن فارسی پاکسازی شد",
      });
    } else {
      setContent(normalized);
    }
    showNotice("متن فارسی پاکسازی شد");
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

  const jumpToDocumentHeading = (
    heading: (typeof documentEditorHeadings)[number],
  ) => {
    const readingHeading = readingHeadings.find(
      (candidate) => candidate.offset === heading.offset,
    );
    const previewIsActive =
      readingMode ||
      mobilePane === "preview" ||
      desktopPaneMode === "preview" ||
      (desktopPaneMode === "split" &&
        lastScrolledPaneRef.current === "preview");
    const navigate = () => {
      if (previewIsActive && readingHeading) {
        readingEditorSelectionRef.current = {
          start: heading.offset,
          end: heading.offset,
        };
        if (desktopPaneMode === "split") {
          editorRef.current?.setSelectionRange(
            heading.offset,
            heading.offset,
            false,
          );
        }
        focusReadingHeading(readingHeading.documentIndex);
        return;
      }
      setEditorCaretOffset(heading.offset);
      jumpToEditorHeading(heading.offset);
    };

    if (libraryIsModal) {
      setLibraryOpen(false);
      requestAnimationFrame(() => requestAnimationFrame(navigate));
      return;
    }
    navigate();
  };

  const jumpToReadingSearchResult = (index: number) => {
    const result = readingSearchResults[index];
    const article = previewArticleRef.current;
    if (!result || !article) return;
    const range = rangeFromTextOffsets(article, result.start, result.end);
    const target = range?.startContainer.parentElement?.closest<HTMLElement>(
      "h1, h2, h3, h4, h5, h6, p, li, blockquote, pre, td, th, figcaption",
    );
    if (!range || !target) return;

    cancelReadingRestoreWork();
    readingIntentionalNavigationRef.current = true;
    readingNavigationTargetRef.current = {
      element: target,
      placement: "center",
    };
    setActiveReadingSearchIndex(index);
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    scrollReadingElement(target, reducedMotion ? "auto" : "smooth", "center");
    if (readingNavigationTimerRef.current !== null) {
      window.clearTimeout(readingNavigationTimerRef.current);
    }
    readingNavigationTimerRef.current = window.setTimeout(
      () => {
        readingNavigationTimerRef.current = null;
        if (target.isConnected) scrollReadingElement(target, "auto", "center");
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

  const fixPersianReviewIssue = (
    issue: PersianReviewIssue,
    returnFocusToEditor = true,
  ) => {
    setContent((current) => applyPersianReviewIssue(current, issue.id));
    showNotice(`«${issue.title}» اصلاح شد`);
    if (returnFocusToEditor) {
      requestAnimationFrame(() => editorRef.current?.focus());
    }
  };

  const rescanPersianReview = () => {
    const total = persianReviewIssues.reduce(
      (sum, issue) => sum + issue.count,
      0,
    );
    showNotice(
      total > 0
        ? `${total.toLocaleString("fa-IR")} مورد برای اصلاح پیدا شد`
        : "متن فارسی مرتب است",
    );
    requestAnimationFrame(() =>
      persianCorrectionsPanelRef.current?.focus({ preventScroll: true }),
    );
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
      const message =
        "هر سند راوی می‌تواند حداکثر ۸ تصویرِ درج‌شده داشته باشد.";
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
      const prefix =
        start > 0 && !/\n$/u.test(editorContent.slice(0, start)) ? "\n\n" : "";
      const suffix =
        end < editorContent.length && !/^\n/u.test(editorContent.slice(end))
          ? "\n\n"
          : "";
      const inserted = `${prefix}${imageMarkdown}${suffix}`;
      editor.replaceRange({
        from: start,
        to: end,
        insert: inserted,
        selectionFrom: start + prefix.length + imageMarkdown.length,
        selectionTo: start + prefix.length + imageMarkdown.length,
        announcement: "تصویر به سند اضافه شد",
      });
      setImageAssets((current) => [...current, asset]);
      setEditorSelectionMenuPosition(null);
      setError("");
      setImageInsertError("");
      showNotice(
        `«${file.name}» به سند اضافه شد؛ در پوشهٔ همین سند نگه‌داری می‌شود.`,
      );
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
      if (inserted) {
        setImageModalOpen(false);
        setEditorHelper(null);
      }
    });
  };

  const openEditorHelper = (
    kind: "link" | "table" | "image",
    trigger?: HTMLElement | null,
  ) => {
    editorHelperReturnFocusRef.current =
      trigger ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : (editorRef.current?.element ?? null));
    setEditorToolMenuOpen(false);
    setEditorBlockMenu(null);
    setEditorSelectionMenuPosition(null);
    setEditorHelper(kind);
    if (kind === "link") setEditorLinkUrl("https://");
    if (kind === "table") {
      setEditorTableRows(2);
      setEditorTableColumns(3);
    }
    if (kind === "image") {
      setImageUrl("");
      setImageInsertError("");
    }
  };

  const closeEditorHelper = (restoreFocus = true) => {
    setEditorHelper(null);
    setImageInsertError("");
    if (restoreFocus) {
      requestAnimationFrame(restoreEditorHelperFocus);
    }
  };

  const insertLinkFromHelper = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const destination = editorLinkUrl.trim();
    if (
      !destination ||
      /[\r\n\u0000-\u001f]/u.test(destination) ||
      /^(?:javascript|vbscript|data):/iu.test(destination)
    )
      return;
    const tableSelection = editor.tableCellSelection;
    const start = tableSelection?.start ?? editor.selectionStart;
    const end = tableSelection?.end ?? editor.selectionEnd;
    const selected =
      tableSelection?.text ?? (editor.value.slice(start, end) || "عنوان پیوند");
    const inserted = `[${selected}](${destination})`;
    const edit = {
      from: start,
      to: end,
      insert: inserted,
      selectionFrom: start + 1,
      selectionTo: start + 1 + selected.length,
      announcement: "پیوند درج شد",
    };
    if (tableSelection) editor.replaceTableCellRange(edit);
    else editor.replaceRange(edit);
    closeEditorHelper(false);
  };

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

    editor.replaceRange({
      from: start,
      to: end,
      insert: inserted,
      selectionFrom: start + prefix.length + imageMarkdown.length,
      selectionTo: start + prefix.length + imageMarkdown.length,
      announcement: "نشانی تصویر درج شد",
    });
    setImageModalOpen(false);
    setEditorHelper(null);
    showNotice(
      "نشانی تصویر درج شد؛ در Markdown فقط URL ذخیره می‌شود و حجم فایل بالا نمی‌رود.",
    );
  };

  const restoreMermaidWorkspace = useCallback(
    (
      session: {
        editorScrollTop: number;
        previewScrollTop: number;
      },
      focus: "editor" | "preview",
    ) => {
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
    (block?: MermaidBlock, insertion?: { content: string; offset: number }) => {
      const editor = editorRef.current;
      const mode = block ? "edit" : "create";
      const activeContent = insertion?.content ?? content;
      const selectedText = editor && editor.selectionEnd > editor.selectionStart
        ? editor.value.slice(editor.selectionStart, editor.selectionEnd).trim()
        : "";
      const insertionOffset =
        insertion?.offset ?? editor?.selectionStart ?? activeContent.length;
      mermaidReturnFocusRef.current =
        mode === "edit"
          ? previewArticleRef.current
          : (editor?.element ?? previewArticleRef.current);
      setEditorSelectionMenuPosition(null);
      setSelectionDraft(null);
      setComposerKind(null);
      setMermaidStudioSession({
        id:
          globalThis.crypto?.randomUUID?.() ?? `mermaid-session-${Date.now()}`,
        mode,
        initialCode: block?.code ?? DEFAULT_MERMAID_CODE,
        insertionOffset,
        originalDocument: activeContent,
        selectedText,
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
    (code: string, session: MermaidStudioSession): MermaidApplyResult => {
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

  const openFormulaStudio = useCallback(
    (
      block?: FormulaBlock,
      insertion?: { content: string; offset: number },
      explicitOpener?: HTMLElement,
    ) => {
      const editor = editorRef.current;
      const mode = block ? "edit" : "create";
      const activeContent = insertion?.content ?? content;
      const insertionOffset =
        insertion?.offset ?? editor?.selectionStart ?? activeContent.length;
      const activeOpener = explicitOpener?.isConnected
        ? explicitOpener
        : document.activeElement instanceof HTMLElement &&
            document.activeElement.isConnected
          ? document.activeElement
          : null;
      formulaReturnFocusRef.current =
        activeOpener ??
        (mode === "edit"
          ? previewArticleRef.current
          : (editor?.element ?? previewArticleRef.current));
      formulaReturnSurfaceRef.current = activeOpener?.closest(
        ".cm-rich-formula",
      )
        ? "live"
        : activeOpener?.closest(".formula-document-block")
          ? "preview"
          : "other";
      setEditorSelectionMenuPosition(null);
      setSelectionDraft(null);
      setComposerKind(null);
      setFormulaStudioSession({
        id:
          globalThis.crypto?.randomUUID?.() ?? `formula-session-${Date.now()}`,
        mode,
        initialLatex: block?.latex ?? "",
        insertionOffset,
        originalDocument: activeContent,
        block,
        editorScrollTop: editor?.scrollTop ?? 0,
        previewScrollTop: previewScrollRef.current?.scrollTop ?? 0,
      });
    },
    [content],
  );

  const restoreFormulaWorkspace = useCallback(
    (session: FormulaStudioSession, block?: FormulaBlock) => {
      requestAnimationFrame(() => {
        if (editorRef.current) {
          editorRef.current.scrollTop = session.editorScrollTop;
        }
        if (previewScrollRef.current) {
          previewScrollRef.current.scrollTop = session.previewScrollTop;
        }
        const returnSurface = formulaReturnSurfaceRef.current;
        const focusReturnTarget = (attempt = 0) => {
          const captured = formulaReturnFocusRef.current;
          const replacementSelector =
            returnSurface === "preview"
              ? `.formula-document-block[data-formula-from="${block?.startOffset}"] button`
              : returnSurface === "live"
                ? `.cm-rich-formula[data-formula-from="${block?.startOffset}"] .cm-rich-action`
                : null;
          let replacementAction =
            block && replacementSelector
              ? document.querySelector<HTMLElement>(replacementSelector)
              : null;
          if (!replacementAction && block && returnSurface === "live") {
            replacementAction = Array.from(
              document.querySelectorAll<HTMLElement>(
                ".cm-rich-formula[data-formula-from] .cm-rich-action",
              ),
            ).reduce<HTMLElement | null>((nearest, candidate) => {
              const candidateFrom = Number(
                candidate.closest<HTMLElement>(".cm-rich-formula")?.dataset
                  .formulaFrom,
              );
              if (!Number.isFinite(candidateFrom)) return nearest;
              if (!nearest) return candidate;
              const nearestFrom = Number(
                nearest.closest<HTMLElement>(".cm-rich-formula")?.dataset
                  .formulaFrom,
              );
              return Math.abs(candidateFrom - block.startOffset) <
                Math.abs(nearestFrom - block.startOffset)
                ? candidate
                : nearest;
            }, null);
          }
          const target =
            replacementAction ??
            (captured?.isConnected && !captured.closest("[hidden], [inert]")
              ? captured
              : null);
          if (target?.isConnected) {
            target.focus({ preventScroll: true });
            // CodeMirror can rebuild a live widget for a few frames after the
            // editor regains focus. Re-resolve and re-focus the replacement
            // action until the decoration has stabilized instead of retaining
            // a button that may be detached on the next frame.
            if (returnSurface === "live" && attempt < 5) {
              requestAnimationFrame(() => focusReturnTarget(attempt + 1));
            }
            return;
          }
          if (returnSurface === "live" && attempt < 5) {
            requestAnimationFrame(() => focusReturnTarget(attempt + 1));
            return;
          }
          if (session.mode === "create") editorRef.current?.focus();
          else previewArticleRef.current?.focus({ preventScroll: true });
        };
        let focusObserver: MutationObserver | null = null;
        if (returnSurface === "live") {
          const editorRoot = document.getElementById("markdown-editor");
          if (editorRoot) {
            focusObserver = new MutationObserver(() => {
              if (document.activeElement === document.body) {
                queueMicrotask(() => focusReturnTarget(5));
              }
            });
            focusObserver.observe(editorRoot, {
              childList: true,
              subtree: true,
            });
          }
        }
        requestAnimationFrame(() => focusReturnTarget());
        if (returnSurface === "live") {
          window.setTimeout(() => {
            // CodeMirror can replace the focused widget action while its live
            // decorations settle. Resolve the final action once more only when
            // focus fell back to <body>; never steal deliberate user focus.
            if (document.activeElement === document.body) {
              focusReturnTarget(5);
            }
            focusObserver?.disconnect();
          }, 1_200);
        }
      });
    },
    [],
  );

  const closeFormulaStudio = useCallback(
    (session: FormulaStudioSession) => {
      setFormulaStudioSession(null);
      restoreFormulaWorkspace(session, session.block);
    },
    [restoreFormulaWorkspace],
  );

  const applyFormulaStudio = useCallback(
    (latex: string, session: FormulaStudioSession): FormulaApplyResult => {
      if (session.mode === "edit" && session.block) {
        const result = replaceFormulaBlock(
          content,
          session.originalDocument,
          session.block,
          latex,
        );
        if (!result.ok) return { ok: false, message: result.message };
        setContent(result.content);
        setFormulaStudioSession(null);
        restoreFormulaWorkspace(session, result.block);
        showNotice("فرمول در همان بلوک به‌روزرسانی شد.");
        return { ok: true };
      }

      const result = insertFormulaBlock(
        session.originalDocument,
        session.insertionOffset,
        latex,
      );
      setContent(result.content);
      setFormulaStudioSession(null);
      restoreFormulaWorkspace(session, result.block);
      showNotice("فرمول در محل نشانگر به سند اضافه شد.");
      return { ok: true };
    },
    [content, restoreFormulaWorkspace, showNotice],
  );

  const changeReaderSize = (delta: -1 | 1) => {
    preserveReadingViewport(() => {
      setReaderSize((size) => Math.min(22, Math.max(16, size + delta)));
    });
  };

  const commitReadingPreferences = (nextPreferences: ReadingPreferences) => {
    const root = document.documentElement;
    root.dataset.readingTextSize = nextPreferences.textSize;
    root.dataset.readingLineSpacing = nextPreferences.lineSpacing;
    root.dataset.readingTextWidth = nextPreferences.textWidth;
    root.style.setProperty(
      "--reading-line-height",
      String(READING_LINE_HEIGHT[nextPreferences.lineSpacing]),
    );
    root.style.setProperty(
      "--reading-document-width",
      `${READING_TEXT_WIDTH_PX[nextPreferences.textWidth]}px`,
    );
    const applyPreferences = () => {
      readingPreferencesRef.current = nextPreferences;
      setReadingPreferences(nextPreferences);
      setReaderSize(READING_TEXT_SIZE_PX[nextPreferences.textSize]);
      if (!nextPreferences.autoHideHeader) {
        setReadingHeaderVisible(true);
      }
    };
    if (!readingMode) {
      applyPreferences();
      return;
    }
    preserveReadingViewport(applyPreferences, { retries: 6, settle: true });
  };

  const toggleThemePreservingReading = () => {
    if (!readingMode) {
      toggleTheme();
      return;
    }
    preserveReadingViewport(toggleTheme, { retries: 6 });
  };

  const closeShortcutHelp = () => {
    preserveReadingViewport(() => setShortcutHelpOpen(false), { retries: 2 });
  };

  const toggleShortcutHelp = () => {
    preserveReadingViewport(() => setShortcutHelpOpen((current) => !current), {
      retries: 2,
    });
  };

  const closeShortcutSettings = () => {
    preserveReadingViewport(() => setShortcutSettingsOpen(false), {
      retries: 2,
    });
  };

  const clearRecentFilesFromSettings = async () => {
    const desktop = window.raaviDesktop;
    if (desktop?.clearRecentFiles) {
      const state = await desktop.clearRecentFiles();
      setRecentFiles(state.recents);
    } else {
      setRecentFiles([]);
    }
    setQuickOpenUsage({});
    try {
      window.localStorage.removeItem(QUICK_OPEN_USAGE_STORAGE_KEY);
    } catch {
      // Clearing the in-memory list still succeeds if storage is unavailable.
    }
    showNotice("فهرست فایل‌های اخیر پاک شد؛ هیچ فایلی حذف نشد.");
  };

  const resetAllSettings = async () => {
    const desktop = window.raaviDesktop;
    if (desktop) {
      await desktop.saveLocalDocumentSnapshot(localDocumentSnapshot);
    } else {
      await writeLocalDocumentSnapshot(localDocumentSnapshot);
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(localDocumentSnapshot),
      );
    }
    const settingKeys = [
      APPEARANCE_PREFERENCES_STORAGE_KEY,
      LEGACY_THEME_STORAGE_KEY,
      READING_PREFERENCES_STORAGE_KEY,
      FILE_LIBRARY_PREFERENCES_STORAGE_KEY,
      PRIVACY_PREFERENCES_STORAGE_KEY,
      CODE_VIEW_PREFERENCES_STORAGE_KEY,
      COMMAND_USAGE_STORAGE_KEY,
      QUICK_OPEN_USAGE_STORAGE_KEY,
      PINNED_LIBRARY_STORAGE_KEY,
      PANE_LAYOUT_STORAGE_KEY,
      SIDEBAR_STORAGE_KEY,
      WORKSPACE_STATE_STORAGE_KEY,
      "raavi:file-tree:v1",
    ];
    for (const key of settingKeys) window.localStorage.removeItem(key);
    // The document snapshot and local files are deliberately outside this list.
    window.location.reload();
  };

  const openExternalUrl = useCallback(async (value: string) => {
    let url: URL;
    try {
      url = new URL(value, window.location.href);
    } catch {
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    if (window.raaviDesktop?.openExternalUrl) {
      await window.raaviDesktop.openExternalUrl(url.href);
      return;
    }
    window.open(url.href, "_blank", "noopener,noreferrer");
  }, []);

  const openShortcutSettings = (
    returnTarget?: HTMLElement | null,
    initialCategory:
      | "general"
      | "appearance"
      | "reading"
      | "editing"
      | "files"
      | "privacy"
      | "shortcuts" = "general",
  ) => {
    const activeReturnTarget =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    shortcutSettingsReturnFocusRef.current =
      returnTarget ?? shortcutHelpReturnFocusRef.current ?? activeReturnTarget;
    preserveReadingViewport(
      () => {
        setSettingsInitialCategory(initialCategory);
        setShortcutHelpOpen(false);
        setShortcutSettingsOpen(true);
      },
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

  const closeAnnotationPanel = (returnFocus = false) => {
    preserveReadingViewport(
      () => {
        setLibraryOpen(false);
        if (readingMode) {
          setReadingHighlightSearchOpen(false);
          setReadingHighlightQuery("");
          setReadingCommentSearchOpen(false);
          setReadingCommentQuery("");
        }
        if (!window.matchMedia(SIDEBAR_DRAWER_MEDIA_QUERY).matches) {
          setSidebarCollapsedPreference(true);
        }
      },
      {
        anchor: readingPositionsRef.current[currentDocumentKey] ?? null,
      },
    );
    if (returnFocus) {
      requestAnimationFrame(() => {
        const returnTarget = libraryReturnFocusRef.current;
        if (returnTarget?.isConnected) {
          returnTarget.focus({ preventScroll: true });
        }
      });
    }
  };

  const toggleReadingOutline = () => {
    const nextOpen = !(libraryOpen && sidebarView === "outline");
    preserveReadingViewport(() => {
      setReadingOutlineOpen(nextOpen);
      if (nextOpen) {
        setSidebarView("outline");
        setSidebarDestination("outline");
        setLibraryOpen(true);
        if (!window.matchMedia(SIDEBAR_DRAWER_MEDIA_QUERY).matches) {
          setSidebarCollapsedPreference(false);
        }
      } else {
        setLibraryOpen(false);
        setReadingOutlineSearchOpen(false);
        setReadingOutlineQuery("");
      }
      setReadingHeaderVisible(true);
    });
  };

  const restoreVersion = async (version: RaaviVersion) => {
    if (versionRestoreSaving) return;
    const nextRevision =
      Math.max(revision, ...versions.map((candidate) => candidate.number)) + 1;
    const preservedVersion: RaaviVersion = {
      number: nextRevision,
      savedAt: new Date().toISOString(),
      content,
      annotations,
      kind: "autosave",
    };
    const nextVersions = [...versions, preservedVersion].slice(
      -MAX_LOCAL_VERSIONS,
    );
    const payload: DocumentSavePayload = {
      content: markdownWithEmbeddedRaaviImages(content, imageAssets),
      annotations,
      assets: imageAssets,
      revision: nextRevision,
      versions: nextVersions,
      raavi: makeRaaviDocument(
        saveNameForType(fileName, "markdown"),
        content,
        annotations,
        nextRevision,
        nextVersions,
        imageAssets,
      ),
    };

    setVersionRestoreSaving(true);
    libraryWriteInProgressRef.current = true;
    try {
      const desktop = window.raaviDesktop;
      if (desktop && activeDocumentPath) {
        const result = await desktop.saveCurrentDocument(
          activeDocumentPath,
          payload,
        );
        if (!result.saved) throw new Error("VERSION_SNAPSHOT_NOT_SAVED");
      } else if (!desktop && activeLibraryFile?.write) {
        await activeLibraryFile.write(payload);
      } else {
        const snapshot = {
          ...localDocumentSnapshot,
          revision: nextRevision,
          versions: nextVersions,
          lastSavedSnapshot: currentSnapshot,
        };
        if (desktop) await desktop.saveLocalDocumentSnapshot(snapshot);
        else await writeLocalDocumentSnapshot(snapshot);
      }

      setVersions(nextVersions);
      setRevision(nextRevision);
      setLastSavedSnapshot(currentSnapshot);
      setContent(version.content);
      setAnnotations(version.annotations);
      setSaveState("saved");
      setVersionRestoreCandidate(null);
      setSaveModalOpen(false);
      setEditorSelectionMenuPosition(null);
      setSelectionDraft(null);
      setComposerKind(null);
      setComposerText("");
      setReadingMode(false);
      showNotice(
        `وضعیت فعلی حفظ شد و نسخه‌ی ${version.number.toLocaleString("fa-IR")} بازگردانی شد؛ برای ثبت آن ذخیره کنید.`,
      );
    } catch {
      showNotice(
        "حفظ وضعیت فعلی ممکن نشد؛ بازگردانی انجام نشد. دوباره تلاش کنید.",
      );
    } finally {
      setVersionRestoreSaving(false);
      window.setTimeout(() => {
        libraryWriteInProgressRef.current = false;
      }, 500);
    }
  };

  const refreshVersions = async () => {
    if (versionsRefreshing) return;
    setVersionsRefreshing(true);
    setVersionsRefreshError("");
    try {
      const desktop = window.raaviDesktop;
      const document =
        desktop && activeDocumentPath
          ? await desktop.readDocumentVersions?.(activeDocumentPath)
          : activeLibraryFile
            ? await activeLibraryFile.read()
            : null;
      if (!document) {
        showNotice("نسخه‌های نمایش‌داده‌شده به‌روز هستند.");
        return;
      }
      setVersions(document.versions ?? []);
      showNotice("فهرست نسخه‌ها به‌روز شد.");
    } catch {
      setVersionsRefreshError(
        "به‌روزرسانی نسخه‌ها ممکن نبود؛ اتصال فایل را بررسی و دوباره تلاش کنید.",
      );
    } finally {
      setVersionsRefreshing(false);
    }
  };

  const leaveReadingMode = () => {
    const readingAnchor = captureCurrentReadingPosition("desk");
    const semanticAnchor = captureDocumentSemanticAnchor("preview");
    const selectionStart = readingEditorSelectionRef.current.start;
    const selectionEnd = readingEditorSelectionRef.current.end;
    const returnTarget = readingReturnFocusRef.current;
    const restoreEditorWhenReady = (attempt = 0) => {
      const editor = editorRef.current;
      const editorViewReady = Boolean(
        editor?.element?.isConnected &&
        editor.element.querySelector(".cm-editor") &&
        editor.clientHeight > 0,
      );
      if (!editorViewReady && attempt < 12) {
        requestAnimationFrame(() => restoreEditorWhenReady(attempt + 1));
        return;
      }
      if (semanticAnchor) {
        editor?.restoreSemanticAnchor({
          ...semanticAnchor,
          // A rendered paragraph can be much taller than its CodeMirror line.
          // Keep the semantic source position, but center it in the editor
          // instead of copying an incompatible visual offset across surfaces.
          viewportOffset: 0,
        });
        restoreDocumentSemanticAnchor(semanticAnchor, {
          editor: false,
          preview: true,
        });
      }
      editor?.setSelectionRange(selectionStart, selectionEnd, false);
      if (returnTarget?.isConnected) {
        returnTarget.focus({ preventScroll: true });
      } else {
        previewArticleRef.current?.focus({ preventScroll: true });
      }
    };
    const completeTransition = () => {
      if (!document.querySelector(".app-shell.is-reading")) return;
      beginReadingLayoutTransition();
      preserveReadingViewport(
        () => {
          setReadingMode(false);
          setReadingHeaderVisible(true);
          setReadingToolsOpen(false);
          setReadingOutlineSearchOpen(false);
          setReadingOutlineQuery("");
          setReadingHighlightSearchOpen(false);
          setReadingHighlightQuery("");
          setReadingCommentSearchOpen(false);
          setReadingCommentQuery("");
        },
        { anchor: readingAnchor, settle: true },
      );
      requestAnimationFrame(() =>
        requestAnimationFrame(() => restoreEditorWhenReady()),
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
    const semanticAnchor = captureDocumentSemanticAnchor();
    const isMobile = window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY).matches;
    const shouldOpenOutline =
      !isMobile &&
      readingPreferencesRef.current.openOutlineOnEnter &&
      readingHeadings.length > 0;
    const editorSelectionStart = editorRef.current?.selectionStart ?? 0;
    readingEditorSelectionRef.current = {
      start: editorSelectionStart,
      end: editorRef.current?.selectionEnd ?? editorSelectionStart,
    };
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
        setReadingToolsOpen(false);
        setReadingOutlineOpen(shouldOpenOutline);
        if (isMobile) {
          setLibraryOpen(false);
        } else if (shouldOpenOutline) {
          setSidebarView("outline");
          setSidebarDestination("outline");
          setLibraryOpen(true);
          setSidebarCollapsedPreference(false);
        } else {
          setLibraryOpen(false);
        }
        setMobileEditorToolsExpanded(false);
        setMobilePane("preview");
      },
      { retries: 4 },
    );
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (semanticAnchor) {
          restoreDocumentSemanticAnchor(semanticAnchor, {
            editor: false,
            preview: true,
          });
        }
        previewArticleRef.current?.focus({ preventScroll: true });
      }),
    );
  };

  const focusEditor = () => {
    const isMobile = window.matchMedia(MOBILE_LAYOUT_MEDIA_QUERY).matches;
    const sidebarIsDrawer = window.matchMedia(
      SIDEBAR_DRAWER_MEDIA_QUERY,
    ).matches;
    const change = () => {
      if (readingMode) setReadingMode(false);
      setMobilePane("editor");
      if (!sidebarIsDrawer) setLibraryOpen(true);
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
    const savedPosition = readingPreferencesRef.current.rememberPosition
      ? (readingPositionsRef.current[currentDocumentKey] ??
        lastReadingAnchorRef.current)
      : null;
    setEditorSelectionMenuPosition(null);
    setMobileEditorToolsExpanded(false);
    setMobilePane("preview");
    if (savedPosition) scheduleReadingRestore(savedPosition);
    requestAnimationFrame(() =>
      previewArticleRef.current?.focus({ preventScroll: true }),
    );
  };

  const focusLibrarySearch = () => {
    librarySearchFocusPendingRef.current = true;
    preserveReadingViewport(() => {
      if (readingMode) setReadingMode(false);
      setEditorSelectionMenuPosition(null);
      setSidebarView("search");
      setSidebarDestination("library");
      setLibraryOpen(true);
      if (!window.matchMedia(SIDEBAR_DRAWER_MEDIA_QUERY).matches) {
        setSidebarCollapsedPreference(false);
      }
    });
    requestAnimationFrame(() =>
      requestAnimationFrame(() => librarySearchRef.current?.focus()),
    );
  };

  useEffect(() => {
    if (
      !librarySearchFocusPendingRef.current ||
      !libraryOpen ||
      sidebarView !== "search" ||
      sidebarDestination !== "library"
    ) {
      return;
    }
    let frame = 0;
    let attempts = 0;
    const focusWhenReady = () => {
      const input = librarySearchRef.current;
      input?.focus({ preventScroll: true });
      if (input && document.activeElement === input) {
        librarySearchFocusPendingRef.current = false;
        return;
      }
      attempts += 1;
      if (attempts < 30) frame = requestAnimationFrame(focusWhenReady);
    };
    frame = requestAnimationFrame(focusWhenReady);
    return () => cancelAnimationFrame(frame);
  }, [
    libraryOpen,
    sidebarDestination,
    sidebarView,
  ]);

  const closeReadingOutlineSearch = () => {
    setReadingOutlineSearchOpen(false);
    setReadingOutlineQuery("");
  };

  const toggleReadingOutlineSearch = () => {
    if (readingOutlineSearchOpen) {
      closeReadingOutlineSearch();
      return;
    }
    setReadingOutlineSearchOpen(true);
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        readingOutlineSearchRef.current?.focus({ preventScroll: true }),
      ),
    );
  };

  const closeReadingHighlightSearch = () => {
    setReadingHighlightSearchOpen(false);
    setReadingHighlightQuery("");
  };

  const toggleReadingHighlightSearch = () => {
    if (readingHighlightSearchOpen) {
      closeReadingHighlightSearch();
      return;
    }
    setReadingHighlightSearchOpen(true);
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        readingHighlightSearchRef.current?.focus({ preventScroll: true }),
      ),
    );
  };

  const closeReadingCommentSearch = () => {
    setReadingCommentSearchOpen(false);
    setReadingCommentQuery("");
  };

  const toggleReadingCommentSearch = () => {
    if (readingCommentSearchOpen) {
      closeReadingCommentSearch();
      return;
    }
    setReadingCommentSearchOpen(true);
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        readingCommentSearchRef.current?.focus({ preventScroll: true }),
      ),
    );
  };

  const closeRecentSearch = () => {
    setRecentSearchOpen(false);
    setRecentQuery("");
    requestAnimationFrame(() =>
      recentSearchButtonRef.current?.focus({ preventScroll: true }),
    );
  };

  const toggleRecentSearch = () => {
    if (recentSearchOpen) {
      closeRecentSearch();
      return;
    }
    setRecentSearchOpen(true);
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        recentSearchInputRef.current?.focus({ preventScroll: true }),
      ),
    );
  };

  const openSidebarView = (
    view: SidebarView,
    destination: SidebarDestination = view === "search"
      ? "search"
      : view === "ai"
        ? "ai"
        : view === "outline"
          ? "outline"
          : view === "annotations"
            ? "comments"
            : view === "history"
              ? "history"
              : view === "versions"
                ? "versions"
                : "library",
    behavior: "toggle" | "ensure" = "toggle",
  ) => {
    const closingCurrentView =
      behavior === "toggle" &&
      libraryOpen &&
      sidebarView === view &&
      sidebarDestination === destination;
    if (
      !closingCurrentView &&
      !libraryIsModal &&
      document.activeElement instanceof HTMLElement
    ) {
      libraryReturnFocusRef.current = document.activeElement;
    }

    const change = () => {
      setSidebarDestination(destination);
      if (
        !readingMode &&
        destination === "highlights" &&
        readingHighlights.length &&
        !readingHighlights.some(
          (highlight) => highlight.id === activeAnnotationId,
        )
      ) {
        setActiveAnnotationId(readingHighlights[0].id);
      }
      if (closingCurrentView) {
        setLibraryOpen(false);
        if (view === "history") {
          setRecentSearchOpen(false);
          setRecentQuery("");
        }
        if (view === "outline") {
          if (readingMode) setReadingOutlineOpen(false);
          closeReadingOutlineSearch();
        }
        if (destination === "highlights") {
          closeReadingHighlightSearch();
        }
        if (destination === "comments") {
          closeReadingCommentSearch();
        }
        if (!window.matchMedia(SIDEBAR_DRAWER_MEDIA_QUERY).matches) {
          setSidebarCollapsedPreference(true);
        }
        return;
      }
      if (view !== "outline") closeReadingOutlineSearch();
      if (destination !== "highlights") {
        closeReadingHighlightSearch();
      }
      if (destination !== "comments") {
        closeReadingCommentSearch();
      }
      if (view !== "history") {
        setRecentSearchOpen(false);
        setRecentQuery("");
      }
      setSidebarView(view);
      if (readingMode) setReadingOutlineOpen(view === "outline");
      if (view === "files") setLibraryQuery("");
      setLibraryOpen(true);
      if (!window.matchMedia(SIDEBAR_DRAWER_MEDIA_QUERY).matches) {
        setSidebarCollapsedPreference(false);
      }
    };

    if (readingMode) {
      beginReadingLayoutTransition();
      preserveReadingViewport(change, {
        retries: 6,
        settle: true,
      });
    } else {
      change();
    }

    if (!closingCurrentView && readingMode && view === "search") {
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          readingDocumentSearchRef.current?.focus({ preventScroll: true }),
        ),
      );
    }
  };

  const closeSidebarFromUser = () => {
    const returnTarget = libraryReturnFocusRef.current;
    const change = () => {
      setLibraryOpen(false);
      if (readingMode && sidebarView === "outline") {
        setReadingOutlineOpen(false);
        closeReadingOutlineSearch();
      }
      if (sidebarDestination === "highlights") {
        closeReadingHighlightSearch();
      }
      if (sidebarDestination === "comments") {
        closeReadingCommentSearch();
      }
      if (!window.matchMedia(SIDEBAR_DRAWER_MEDIA_QUERY).matches) {
        setSidebarCollapsedPreference(true);
      }
    };
    if (readingMode) {
      beginReadingLayoutTransition();
      preserveReadingViewport(change, {
        retries: 6,
        settle: true,
      });
    } else {
      change();
    }
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const fallback = document.querySelector<HTMLButtonElement>(
          `[data-sidebar-destination="${sidebarDestination}"]`,
        );
        (returnTarget?.isConnected ? returnTarget : fallback)?.focus({
          preventScroll: true,
        });
      }),
    );
  };

  const checkCodexConnection = async () => {
    const desktop = window.raaviDesktop;
    if (!desktop?.getCodexConnectionStatus) {
      setCodexConnectionState("unavailable");
      return "unavailable" as const;
    }
    setCodexConnectionState("checking");
    try {
      const status = await desktop.getCodexConnectionStatus();
      setCodexConnectionState(status.state);
      return status.state;
    } catch {
      setCodexConnectionState("connection_error");
      return "connection_error" as const;
    }
  };

  const openAiContext = (nextContext: AiFrozenContextDraft) => {
    setAiContext({ ...nextContext, sessionId: crypto.randomUUID() });
    setAiUndoRecord(null);
    setEditorSelectionMenuPosition(null);
    openSidebarView("ai", "ai", "ensure");
    void checkCodexConnection();
  };

  const openAiForDocument = () => {
    openAiContext({
      kind: "document",
      label: `کل سند · ${fileName}`,
      content,
      editor: "main",
      source: "editor",
    });
  };

  const openAiForSelection = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const tableSelection = editor.tableCellSelection;
    if (tableSelection) {
      openAiContext({
        kind: "selection",
        label: "متن انتخاب‌شده در جدول",
        content: tableSelection.text,
        editor: "main",
        source: "table",
        tableKey: tableSelection.key,
        from: tableSelection.start,
        to: tableSelection.end,
      });
      return;
    }
    const from = editor.selectionStart;
    const to = editor.selectionEnd;
    if (from === to) return;
    const block = editor.getBlockRange(from);
    openAiContext({
      kind: "selection",
      label: "متن انتخاب‌شده",
      content: editor.value.slice(from, to),
      editor: "main",
      source: "editor",
      from,
      to,
      blockFrom: block?.from,
      blockTo: block?.to,
      blockContent: block
        ? editor.value.slice(block.from, block.to)
        : undefined,
    });
  };

  const openAiForBlock = (
    block: { from: number; to: number; content: string },
    editor: "main" | "writing",
  ) => {
    openAiContext({
      kind: "block",
      label: "بلاک فعال",
      content: block.content,
      editor,
      source: "editor",
      from: block.from,
      to: block.to,
      blockFrom: block.from,
      blockTo: block.to,
      blockContent: block.content,
    });
  };

  const runAiPrompt = async (prompt: string) => {
    const desktop = window.raaviDesktop;
    if (!aiContext || !desktop?.runCodexPrompt) {
      throw new Error("اتصال Codex CLI در دسترس نیست.");
    }
    try {
      return await desktop.runCodexPrompt({
        context: aiContext.content,
        prompt,
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "";
      if (message.includes("CODEX_CLI_MISSING")) {
        setCodexConnectionState("cli_missing");
        throw new Error("Codex CLI پیدا نشد؛ راهنمای نصب را باز کنید.");
      }
      if (message.includes("CODEX_AUTH_REQUIRED")) {
        setCodexConnectionState("auth_required");
        throw new Error("برای ادامه، با حساب ChatGPT وارد Codex CLI شوید.");
      }
      throw new Error("پاسخ آماده نشد؛ اتصال را بررسی و دوباره تلاش کنید.");
    }
  };

  const codexErrorForUser = (requestError: unknown) => {
    const message = requestError instanceof Error ? requestError.message : "";
    if (message.includes("CODEX_CLI_MISSING")) {
      setCodexConnectionState("cli_missing");
      return new Error("CODEX_CLI_MISSING");
    }
    if (message.includes("CODEX_AUTH_REQUIRED")) {
      setCodexConnectionState("auth_required");
      return new Error("CODEX_AUTH_REQUIRED");
    }
    if (message.includes("CODEX_QUOTA_EXHAUSTED")) {
      return new Error("CODEX_QUOTA_EXHAUSTED");
    }
    return new Error("پاسخ آماده نشد؛ اتصال را بررسی و دوباره تلاش کنید.");
  };

  const runPersianAiReview = async (reviewKey: string, source: string) => {
    const desktop = window.raaviDesktop;
    if (!desktop?.runCodexPersianReview) {
      throw new Error("CODEX_CLI_MISSING");
    }
    persianAiReviewContextsRef.current.set(reviewKey, {
      sourceSnapshot: source,
      expectedContent: source,
      versionSaved: false,
    });
    try {
      const raw = await desktop.runCodexPersianReview({
        document: source,
        economy:
          window.localStorage.getItem("raavi:ai-economy-mode:v1") === "true",
      });
      return normalizePersianAiReviewResult(raw, source);
    } catch (requestError) {
      throw codexErrorForUser(requestError);
    }
  };

  const rewritePersianAiSuggestion = async (
    suggestion: PersianAiSuggestion,
  ) => {
    const desktop = window.raaviDesktop;
    if (!desktop?.runCodexPrompt) throw new Error("CODEX_CLI_MISSING");
    try {
      const result = await desktop.runCodexPrompt({
        context: suggestion.current,
        prompt: [
          `این پیشنهاد فارسی را با توجه به این دلیل دوباره بنویس: ${suggestion.reason}`,
          "معنا و لحن متن را حفظ کن.",
          "قطعه‌کد، نشانی، مسیر فایل، نام متغیر، نام محصول و اصطلاح انگلیسی را دقیقاً دست‌نخورده نگه دار.",
          "replacement باید فقط جایگزین کامل همین عبارت باشد.",
        ].join("\n"),
      });
      const replacement = result.replacement?.trim();
      if (
        !replacement ||
        replacement === suggestion.current ||
        !preservesPersianReviewTechnicalText(
          suggestion.current,
          replacement,
        )
      ) {
        throw new Error("بازنویسی قابل‌اعتمادی آماده نشد.");
      }
      return replacement;
    } catch (requestError) {
      if (
        requestError instanceof Error &&
        requestError.message === "بازنویسی قابل‌اعتمادی آماده نشد."
      ) {
        throw requestError;
      }
      throw codexErrorForUser(requestError);
    }
  };

  const savePersianAiVersion = (reviewKey: string, value: string) => {
    const reviewContext = persianAiReviewContextsRef.current.get(reviewKey);
    if (!reviewContext || reviewContext.versionSaved) return;
    reviewContext.versionSaved = true;
    setVersions((current) => {
      const nextNumber =
        Math.max(revision, ...current.map((version) => version.number)) + 1;
      const aiVersion: RaaviVersion = {
        number: nextNumber,
        savedAt: new Date().toISOString(),
        content: value,
        annotations,
        kind: "ai",
      };
      return [...current, aiVersion].slice(-MAX_LOCAL_VERSIONS);
    });
  };

  const applyPersianAiReviewSuggestion = async (
    suggestion: PersianAiSuggestion,
    sourceSnapshot: string,
    reviewKey: string,
  ) => {
    const editor = editorRef.current;
    const reviewContext = persianAiReviewContextsRef.current.get(reviewKey);
    if (
      !editor ||
      !reviewContext ||
      reviewContext.sourceSnapshot !== sourceSnapshot ||
      editor.value !== reviewContext.expectedContent
    ) {
      return { ok: false as const, reason: "conflict" as const };
    }
    const result = applyPersianAiSuggestion(editor.value, suggestion);
    if (!result.ok) {
      return { ok: false as const, reason: "conflict" as const };
    }
    savePersianAiVersion(reviewKey, editor.value);
    editor.replaceRange({
      from: result.range.start,
      to: result.range.end,
      insert: suggestion.replacement,
      selectionFrom: result.range.start,
      selectionTo: result.range.start + suggestion.replacement.length,
      announcement: "پیشنهاد هوشمند فارسی اعمال شد",
    });
    reviewContext.expectedContent = result.document;
    showNotice("پیشنهاد اعمال و در نسخه‌ها ثبت شد");
    return { ok: true as const };
  };

  const applyAllPersianAiReviewSuggestions = async (
    suggestions: readonly PersianAiSuggestion[],
    sourceSnapshot: string,
    reviewKey: string,
  ) => {
    const editor = editorRef.current;
    const reviewContext = persianAiReviewContextsRef.current.get(reviewKey);
    if (
      !editor ||
      !reviewContext ||
      reviewContext.sourceSnapshot !== sourceSnapshot ||
      editor.value !== reviewContext.expectedContent
    ) {
      return { ok: false as const, reason: "conflict" as const };
    }
    const result = applyAllPersianAiSuggestions(editor.value, suggestions);
    if (!result.ok) {
      return { ok: false as const, reason: "conflict" as const };
    }
    savePersianAiVersion(reviewKey, editor.value);
    const caret = Math.min(editor.selectionStart, result.document.length);
    editor.replaceRange({
      from: 0,
      to: editor.value.length,
      insert: result.document,
      selectionFrom: caret,
      selectionTo: caret,
      announcement: "پیشنهادهای هوشمند فارسی اعمال شدند",
    });
    reviewContext.expectedContent = result.document;
    showNotice("پیشنهادها اعمال و در نسخه‌ها ثبت شدند");
    return { ok: true as const };
  };

  const runSmartAnnotationReview = async (reviewKey: string, source: string) => {
    const desktop = window.raaviDesktop;
    if (!desktop?.runCodexSmartAnnotations) throw new Error("CODEX_CLI_MISSING");
    smartAnnotationContextsRef.current.set(reviewKey, {
      sourceSnapshot: source,
      expectedContent: source,
      versionSaved: false,
    });
    try {
      const raw = await desktop.runCodexSmartAnnotations({
        document: source,
        economy: window.localStorage.getItem("raavi:ai-economy-mode:v1") === "true",
      });
      return normalizeSmartAnnotationResult(raw, source);
    } catch (requestError) {
      throw codexErrorForUser(requestError);
    }
  };

  const addSmartAnnotationsForDocument = (
    reviewKey: string,
    items: readonly RaaviAnnotation[],
  ) => {
    if (!items.length) return;
    const currentKey = activeDocumentTabId || documentDraftId;
    if (reviewKey === currentKey) {
      setAnnotations((current) => {
        const ids = new Set(current.map((item) => item.id));
        return [...current, ...items.filter((item) => !ids.has(item.id))];
      });
      return;
    }
    setDocumentTabs((current) =>
      current.map((tab) =>
        tab.id === reviewKey || tab.snapshot.draftId === reviewKey
          ? {
              ...tab,
              dirty: true,
              snapshot: {
                ...tab.snapshot,
                annotations: [
                  ...tab.snapshot.annotations,
                  ...items.filter(
                    (item) =>
                      !tab.snapshot.annotations.some(
                        (existing) => existing.id === item.id,
                      ),
                  ),
                ],
              },
            }
          : tab,
      ),
    );
  };

  const updateSmartAnnotationForDocument = (
    reviewKey: string,
    id: string,
    patch: Partial<RaaviAnnotation>,
  ) => {
    const currentKey = activeDocumentTabId || documentDraftId;
    if (reviewKey === currentKey) {
      setAnnotations((current) =>
        current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      );
      return;
    }
    setDocumentTabs((current) =>
      current.map((tab) =>
        tab.id === reviewKey || tab.snapshot.draftId === reviewKey
          ? {
              ...tab,
              dirty: true,
              snapshot: {
                ...tab.snapshot,
                annotations: tab.snapshot.annotations.map((item) =>
                  item.id === id ? { ...item, ...patch } : item,
                ),
              },
            }
          : tab,
      ),
    );
  };

  const rewriteSmartAnnotation = async (annotation: RaaviAnnotation) => {
    const desktop = window.raaviDesktop;
    if (!desktop?.runCodexPrompt) throw new Error("CODEX_CLI_MISSING");
    try {
      const result = await desktop.runCodexPrompt({
        context: annotation.quote,
        prompt: [
          `با توجه به این مسئله، پیشنهاد دقیق‌تری بنویس: ${annotation.body}`,
          "فقط جایگزین کامل عبارت را برگردان.",
          "معنا، Markdown، کد، نشانی، مسیر فایل، شناسه و اصطلاح فنی را حفظ کن.",
        ].join("\n"),
      });
      const replacement = result.replacement?.trim();
      if (!replacement || replacement === annotation.quote) {
        throw new Error("بازنویسی قابل‌اعتمادی آماده نشد.");
      }
      return replacement;
    } catch (requestError) {
      if (requestError instanceof Error && requestError.message === "بازنویسی قابل‌اعتمادی آماده نشد.") throw requestError;
      throw codexErrorForUser(requestError);
    }
  };

  const applySmartAnnotation = async (
    annotation: RaaviAnnotation,
    sourceSnapshot: string,
    reviewKey: string,
  ) => {
    const editor = editorRef.current;
    if (!editor || !annotation.suggestion) {
      return { ok: false as const, reason: "conflict" as const };
    }
    const context = smartAnnotationContextsRef.current.get(reviewKey) ?? {
      sourceSnapshot: sourceSnapshot || editor.value,
      expectedContent: editor.value,
      versionSaved: false,
    };
    smartAnnotationContextsRef.current.set(reviewKey, context);
    if (
      (sourceSnapshot && context.sourceSnapshot !== sourceSnapshot) ||
      editor.value !== context.expectedContent
    ) {
      return { ok: false as const, reason: "conflict" as const };
    }
    const [resolvedAnnotation] = reconnectMarkdownAnnotations(editor.value, [annotation]);
    if (resolvedAnnotation.status === "detached") {
      return { ok: false as const, reason: "conflict" as const };
    }
    if (!context.versionSaved) {
      context.versionSaved = true;
      setVersions((currentVersions) => {
        const nextNumber = Math.max(revision, ...currentVersions.map((version) => version.number)) + 1;
        return [...currentVersions, { number: nextNumber, savedAt: new Date().toISOString(), content: editor.value, annotations, kind: "ai" as const }].slice(-MAX_LOCAL_VERSIONS);
      });
    }
    editor.replaceRange({
      from: resolvedAnnotation.start,
      to: resolvedAnnotation.end,
      insert: annotation.suggestion,
      selectionFrom: resolvedAnnotation.start,
      selectionTo: resolvedAnnotation.start + annotation.suggestion.length,
      announcement: "پیشنهاد نشانه‌گذاری هوشمند اعمال شد",
    });
    context.expectedContent = editor.value;
    setAnnotations((currentAnnotations) =>
      currentAnnotations.map((item) =>
        item.id === annotation.id
          ? item
          : reconnectMarkdownAnnotations(editor.value, [item])[0],
      ),
    );
    showNotice("پیشنهاد اعمال و نسخهٔ پیش از تغییر ذخیره شد");
    return { ok: true as const };
  };

  const startCodexLoginFlow = async () => {
    const result = await window.raaviDesktop?.startCodexLogin?.();
    if (!result) {
      setCodexConnectionState("unavailable");
      return;
    }
    setCodexConnectionState(result.state);
  };

  const aiEditor = (context: AiFrozenContext) =>
    context.editor === "writing" ? writingEditorRef.current : editorRef.current;

  const applyAiChange = async (
    replacement: string,
    mode: "replace" | "insert-after",
  ): Promise<boolean> => {
    if (!aiContext || aiContext.kind === "document") return false;
    const editor = aiEditor(aiContext);
    if (!editor) return false;
    const tableSelection = editor.tableCellSelection;
    if (
      !frozenContextIsCurrent(
        aiContext,
        editor.value,
        tableSelection?.text,
        tableSelection?.key,
      )
    ) {
      showNotice(
        "متن از زمان بازشدن چت تغییر کرده؛ زمینه را دوباره انتخاب کنید.",
      );
      return false;
    }
    if (mode === "insert-after" && aiContext.blockTo === undefined)
      return false;
    if (
      mode === "insert-after" &&
      !frozenBlockIsCurrent(aiContext, editor.value)
    ) {
      showNotice(
        "بلاک از زمان بازشدن چت تغییر کرده؛ زمینه را دوباره انتخاب کنید.",
      );
      return false;
    }

    const range =
      aiContext.source === "table"
        ? null
        : editor.getRangeClientRect(
            mode === "insert-after"
              ? (aiContext.blockTo ?? 0)
              : (aiContext.from ?? 0),
            mode === "insert-after"
              ? (aiContext.blockTo ?? 0)
              : (aiContext.to ?? 0),
          );
    const anchor = editor.getSelectionAnchor();
    const editorBounds = editor.getBoundingClientRect();
    setAiApplyMotion({
      left:
        range?.left ??
        Math.max(
          editorBounds.left + 12,
          (anchor?.clientX ?? editorBounds.left + 80) - 80,
        ),
      top:
        range?.top ??
        Math.max(
          editorBounds.top + 12,
          (anchor?.clientY ?? editorBounds.top + 80) - 22,
        ),
      width: range?.width ?? Math.min(260, editorBounds.width - 24),
      height: Math.max(40, range?.height ?? 44),
    });

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, reduceMotion ? 0 : 410);
    });
    const currentEditor = aiEditor(aiContext);
    if (!currentEditor) {
      setAiApplyMotion(null);
      return false;
    }
    const latestTableSelection = currentEditor.tableCellSelection;
    if (
      !frozenContextIsCurrent(
        aiContext,
        currentEditor.value,
        latestTableSelection?.text,
        latestTableSelection?.key,
      ) ||
      (mode === "insert-after" &&
        !frozenBlockIsCurrent(aiContext, currentEditor.value))
    ) {
      setAiApplyMotion(null);
      showNotice("متن هم‌زمان تغییر کرد؛ جایگزینی انجام نشد.");
      return false;
    }
    setVersions((current) => {
      const nextNumber =
        Math.max(revision, ...current.map((version) => version.number)) + 1;
      const aiVersion: RaaviVersion = {
        number: nextNumber,
        savedAt: new Date().toISOString(),
        content: currentEditor.value,
        annotations,
        kind: "ai",
      };
      return [...current, aiVersion].slice(-MAX_LOCAL_VERSIONS);
    });
    if (mode === "insert-after") {
      const edit = insertionAfterBlock(
        currentEditor.value,
        aiContext.blockTo ?? 0,
        replacement,
      );
      currentEditor.replaceRange({
        ...edit,
        announcement: "پیشنهاد زیر بلاک افزوده شد",
      });
    } else if (aiContext.source === "table") {
      currentEditor.replaceTableCellRange({
        from: aiContext.from ?? 0,
        to: aiContext.to ?? 0,
        insert: replacement,
        announcement: "پیشنهاد در سلول جایگزین شد",
      });
    } else {
      currentEditor.replaceRange({
        from: aiContext.from ?? 0,
        to: aiContext.to ?? 0,
        insert: replacement,
        announcement: "پیشنهاد در سند جایگزین شد",
      });
    }
    setAiUndoRecord({
      editor: aiContext.editor,
      valueAfter: currentEditor.value,
    });
    showNotice("تغییر اعمال و در نسخه‌ها ثبت شد");
    window.setTimeout(() => setAiApplyMotion(null), reduceMotion ? 80 : 1_050);
    return true;
  };

  const undoAiChange = () => {
    if (!aiUndoRecord) return;
    const editor =
      aiUndoRecord.editor === "writing"
        ? writingEditorRef.current
        : editorRef.current;
    if (!editor || editor.value !== aiUndoRecord.valueAfter) {
      setAiUndoRecord(null);
      showNotice("پس از تغییر دستی، بازگردانی هوشمند منقضی شد.");
      return;
    }
    editor.undo();
    setAiUndoRecord(null);
    showNotice("تغییر هوشمند بازگردانی شد");
  };

  const focusAnnotationPanel = () => {
    preserveReadingViewport(() => {
      setMobileEditorToolsExpanded(false);
      setMobilePane("preview");
      setSidebarView("annotations");
      setSidebarDestination("comments");
      setLibraryOpen(true);
      if (!window.matchMedia(SIDEBAR_DRAWER_MEDIA_QUERY).matches) {
        setSidebarCollapsedPreference(false);
      }
    });
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        annotationPanelRef.current?.focus({ preventScroll: true }),
      ),
    );
  };

  const closeTopLayer = () => {
    if (documentMenuOpen) {
      setDocumentMenuOpen(false);
      requestAnimationFrame(() => documentMenuButtonRef.current?.focus());
      return;
    }
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
    if (topLayer === "quickOpen") {
      setQuickOpenOpen(false);
      return;
    }
    if (topLayer === "shortcuts") {
      closeShortcutHelp();
      return;
    }
    if (topLayer === "settings") {
      closeShortcutSettings();
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
    if (readingMode && libraryOpen) {
      closeSidebarFromUser();
      return;
    }
    if (isCompactLayout && readingMode && readingOutlineOpen) {
      toggleReadingOutline();
      return;
    }
    if (readingMode) leaveReadingMode();
  };

  const hasDismissableLayer = Boolean(
    documentMenuOpen ||
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

  const toggleSidebar = () => {
    setLibraryOpen((current) => {
      const next = !current;
      if (!window.matchMedia(SIDEBAR_DRAWER_MEDIA_QUERY).matches) {
        setSidebarCollapsedPreference(!next);
      }
      return next;
    });
  };

  const activeEditorMode: EditorMode = splitWorkspaceActive
    ? "proof"
    : resolveEditorMode({
        paneMode: desktopPaneMode,
        singleMode: singleEditorMode,
      });

  const handleMarkdownEditorChange = (nextContent: string) => {
    setAiUndoRecord((record) =>
      record && nextContent !== record.valueAfter ? null : record,
    );
    setEditorSelectionMenuPosition(null);
    setEditorBlockMenu((currentMenu) => {
      if (!currentMenu) return null;
      if (currentMenu.source !== "slash") return null;
      const lineEnd = nextContent.indexOf("\n", currentMenu.lineFrom);
      const activeLine = nextContent.slice(
        currentMenu.lineFrom,
        lineEnd === -1 ? nextContent.length : lineEnd,
      );
      const query = slashMenuQueryFromLine(activeLine);
      if (query === null) return null;
      return query === currentMenu.query
        ? currentMenu
        : { ...currentMenu, query };
    });
    setContent(nextContent);
    if (saveState === "error") {
      setSaveState("saved");
      setSaveErrorVisible(false);
    }
  };

  const handleLivePreviewFailure = () => {
    setSingleEditorMode("source");
    setSplitWorkspaceActive(false);
    setDesktopPaneMode("editor");
    setMobilePane("editor");
    setNotice(
      "نمایش ویرایش روان با خطا روبه‌رو شد؛ متن شما محفوظ است و متن خام فعال شد.",
    );
  };

  const openEditorMermaidBlock = (from: number) => {
    const block = mermaidBlockAtOffset(mermaidBlocks, from);
    if (block) openMermaidStudio(block);
    else setNotice("بلوک نمودار پیدا نشد؛ متن Markdown را دوباره بررسی کنید.");
  };

  const openEditorFormulaBlock = (
    from: number,
    _to: number,
    opener?: HTMLElement,
  ) => {
    const block = formulaBlockAtOffset(formulaBlocks, from);
    if (block) openFormulaStudio(block, undefined, opener);
    else setNotice("بلوک فرمول پیدا نشد؛ متن Markdown را دوباره بررسی کنید.");
  };

  const resolveEditorLiveImage = (source: string) => {
    const assetId = raaviImageAssetId(source);
    if (assetId) {
      const asset = imageAssetsById.get(assetId);
      return asset
        ? { status: "ready" as const, source: raaviImageDataUrl(asset) }
        : {
            status: "blocked" as const,
            message: "تصویر همراه سند پیدا نشد؛ پوشهٔ فایل Markdown را بررسی کنید.",
          };
    }
    const safe = safeLiveImageSource(source);
    const isRemote = /^(?:https?):\/\//i.test(safe ?? "");
    if (
      safe &&
      isRemote &&
      privacyPreferences.externalImagePolicy !== "allow" &&
      !approvedRemoteImages.has(source.trim())
    ) {
      return {
        status: "blocked" as const,
        message:
          privacyPreferences.externalImagePolicy === "ask"
            ? "این تصویر بیرونی هنوز اجازهٔ بارگیری ندارد؛ آن را در نمای مطالعه تأیید کنید."
            : "بارگیری تصاویر بیرونی در تنظیمات حریم خصوصی مسدود شده است.",
      };
    }
    return safe
      ? { status: "ready" as const, source: safe }
      : {
          status: "blocked" as const,
          message:
            "نشانی تصویر ناامن یا پشتیبانی‌نشده است؛ Markdown را ویرایش کنید.",
        };
  };

  useLayoutEffect(() => {
    const scrollHold = editorModeScrollHoldRef.current;
    if (!scrollHold || readingMode) return;
    if (editorRef.current) editorRef.current.scrollTop = scrollHold.top;
  }, [desktopPaneMode, readingMode, singleEditorMode]);

  useEffect(() => {
    editorModeScrollHoldRef.current = null;
    editorModeScrollPositionsRef.current = { live: null, source: null };
  }, [currentDocumentKey]);

  const selectEditorMode = (mode: EditorMode) => {
    paneLayoutInteractedRef.current = true;
    setModeSwipeTarget(null);
    const semanticAnchor = captureDocumentSemanticAnchor();
    const selectionStart = editorRef.current?.selectionStart ?? 0;
    const selectionEnd = editorRef.current?.selectionEnd ?? selectionStart;
    setReadingMode(false);
    setEditorSelectionMenuPosition(null);
    setMobileEditorToolsExpanded(false);
    if (mode === "proof") {
      editorModeScrollHoldRef.current = null;
      setSplitWorkspaceActive(true);
      if (desktopPaneMode !== "split") {
        setPreviewPanePercent(lastExpandedPreviewPercentRef.current);
      }
      setDesktopPaneMode("split");
      setActiveSplitPane("editor");
      setMobilePane("preview");
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (semanticAnchor) restoreDocumentSemanticAnchor(semanticAnchor);
          editorRef.current?.setSelectionRange(
            selectionStart,
            selectionEnd,
            false,
          );
        }),
      );
      return;
    }
    if (mode === "live" && !LIVE_EDIT_FEATURE_ENABLED) return;
    const currentScrollTop = editorRef.current?.scrollTop ?? 0;
    if (!splitWorkspaceActive) {
      editorModeScrollPositionsRef.current[singleEditorMode] = currentScrollTop;
    }
    const targetModeScrollTop = editorModeScrollPositionsRef.current[mode];
    const existingScrollHold = editorModeScrollHoldRef.current;
    const preservedScrollTop =
      targetModeScrollTop ?? existingScrollHold?.top ?? currentScrollTop;
    editorModeScrollPositionsRef.current[mode] = preservedScrollTop;
    const scrollHold = { top: preservedScrollTop };
    editorModeScrollHoldRef.current = scrollHold;
    setSplitWorkspaceActive(false);
    setSingleEditorMode(mode);
    setDesktopPaneMode("editor");
    setMobilePane("editor");
    if (editorRef.current) editorRef.current.scrollTop = preservedScrollTop;
    queueMicrotask(() => {
      if (editorRef.current) editorRef.current.scrollTop = preservedScrollTop;
    });
    window.requestAnimationFrame(() => {
      if (editorRef.current) editorRef.current.scrollTop = preservedScrollTop;
      requestAnimationFrame(() => {
        if (editorRef.current) editorRef.current.scrollTop = preservedScrollTop;
        editorRef.current?.focus();
      });
    });
    window.setTimeout(() => {
      if (editorRef.current) editorRef.current.scrollTop = preservedScrollTop;
      if (editorModeScrollHoldRef.current === scrollHold) {
        editorModeScrollHoldRef.current = null;
      }
    }, 120);
  };

  const commandHandlers: Record<CommandId, (event?: KeyboardEvent) => void> = {
    "file.open": () => void openDocumentPicker(),
    "file.quickOpen": () => setQuickOpenOpen(true),
    "file.export": openExportDialog,
    "file.save": () => {
      if (topLayer === "save") void saveAsFile();
      else void saveCurrentFile();
    },
    "file.saveAs": () => openSaveFileModal(documentType),
    "file.new": openNewTabWorkspace,
    "file.closeTab": () => {
      if (newTabWorkspaceOpen) {
        if (activeDocumentTabId) setNewTabWorkspaceOpen(false);
        return;
      }
      if (activeDocumentTabId) closeDocumentTab(activeDocumentTabId);
    },
    "file.closeOtherTabs": () => {
      if (activeDocumentTabId) closeOtherDocumentTabs(activeDocumentTabId);
    },
    "file.pinTab": () => {
      if (activeDocumentTabId) toggleDocumentTabPinned(activeDocumentTabId);
    },
    "file.reopenClosedTab": reopenLastClosedDocumentTab,
    "help.support": () => setSupportModalOpen(true),
    "help.about": () => setAboutModalOpen(true),
    "help.shortcuts": () => {
      clearAnnotationHover();
      toggleShortcutHelp();
    },
    "edit.undo": () => editorRef.current?.undo(),
    "edit.redo": () => editorRef.current?.redo(),
    "edit.find": () => editorRef.current?.openSearch(),
    "edit.replace": () => editorRef.current?.openReplace(),
    "edit.findNext": () => editorRef.current?.findNext(),
    "edit.findPrevious": () => editorRef.current?.findPrevious(),
    "edit.selectAll": () => editorRef.current?.selectAll(),
    "edit.bold": () => insertInline("**", "**", "متن پررنگ"),
    "edit.italic": () => insertInline("_", "_", "متن مورب"),
    "edit.underline": () => insertInline("<u>", "</u>", "متن زیرخط‌دار"),
    "edit.strike": () => insertInline("~~", "~~", "متن خط‌خورده"),
    "edit.clearFormatting": clearEditorInlineFormatting,
    "edit.code": () => insertInline("`", "`", "code"),
    "edit.heading": insertHeading,
    "edit.list": () => insertList("bullet"),
    "edit.orderedList": () => insertList("ordered"),
    "edit.task": () => insertList("check-empty"),
    "edit.codeBlock": insertCodeBlock,
    "edit.callout": insertCallout,
    "edit.table": () => openEditorHelper("table"),
    "edit.link": () => openEditorHelper("link"),
    "edit.image": () => openEditorHelper("image"),
    "edit.quote": insertQuote,
    "edit.reviewPersian": () =>
      openSidebarView("annotations", "persian", "ensure"),
    "diagram.mermaid": () => openMermaidStudio(),
    "view.theme": toggleThemePreservingReading,
    "view.commandPalette": () => setCommandPaletteOpen(true),
    "view.sidebar": toggleSidebar,
    "view.outline": () => openSidebarView("outline"),
    "view.editor.live": () => selectEditorMode("live"),
    "view.editor.source": () => selectEditorMode("source"),
    "view.editor.proof": () => selectEditorMode("proof"),
    "view.reading": toggleReadingMode,
    "focus.editor": focusEditor,
    "focus.selectionToolbar": focusEditorSelectionToolbar,
    "focus.preview": focusPreview,
    "focus.library": focusLibrarySearch,
    "focus.annotations": focusAnnotationPanel,
    "view.text.decrease": () => changeReaderSize(-1),
    "view.text.increase": () => changeReaderSize(1),
    "annotation.highlight": () => {
      if (
        editorRef.current?.tableCellSelection ||
        editorRef.current?.selectionStart !== editorRef.current?.selectionEnd
      ) {
        runEditorAnnotation("highlight");
      } else {
        addAnnotation("highlight");
      }
    },
    "annotation.comment": () => {
      if (
        editorRef.current?.tableCellSelection ||
        editorRef.current?.selectionStart !== editorRef.current?.selectionEnd
      ) {
        runEditorAnnotation("comment", commentButtonRef.current);
      } else {
        openAnnotationComposer("comment", commentButtonRef.current);
      }
    },
    "annotation.submit": submitAnnotationComposer,
    "layer.dismiss": closeTopLayer,
  };

  const enabledCommandIds = new Set(ALL_COMMAND_IDS);
  type CommandInvocationSource = "shortcut" | "surface" | "menu" | "palette";

  const commandAvailability = (
    id: CommandId,
    event?: KeyboardEvent,
    source: CommandInvocationSource = "surface",
  ): CommandAvailability => {
    const activeElement = document.activeElement;
    const editorFocused = editorRef.current?.contains(activeElement) ?? false;
    const previewFocused = Boolean(
      previewArticleRef.current &&
      (activeElement === previewArticleRef.current ||
        previewArticleRef.current.contains(activeElement)),
    );

    const blockedByModal = Boolean(
      topLayer &&
      !(source === "palette" && topLayer === "commandPalette") &&
      !(source === "menu" && topLayer === "mobileMenu"),
    );
    const unavailable = (reason: string): CommandAvailability => ({
      enabled: false,
      reason,
    });

    switch (id) {
      case "help.shortcuts":
      case "help.support":
      case "help.about":
        return blockedByModal
          ? unavailable("ابتدا پنجرهٔ باز را ببندید.")
          : { enabled: true };
      case "view.commandPalette":
        return blockedByModal
          ? unavailable("ابتدا پنجرهٔ باز را ببندید.")
          : { enabled: true };
      case "view.theme":
        return themeTransition
          ? unavailable("تغییر تم در حال انجام است.")
          : { enabled: true };
      case "view.editor.live":
        if (!LIVE_EDIT_FEATURE_ENABLED) {
          return unavailable(
            "ویرایش روان در این نسخه غیرفعال است؛ متن خام در دسترس می‌ماند.",
          );
        }
        return !blockedByModal && !composerKind
          ? { enabled: true }
          : unavailable("ابتدا پنجره یا یادداشت باز را ببندید.");
      case "view.editor.source":
      case "view.editor.proof":
        return !blockedByModal && !composerKind
          ? { enabled: true }
          : unavailable("ابتدا پنجره یا یادداشت باز را ببندید.");
      case "layer.dismiss":
        if (
          topLayer !== "library" &&
          event?.target instanceof Element &&
          event.target.closest('[data-editable-kind="librarySearch"]')
        ) {
          return unavailable("برای بستن قفسه از دکمهٔ بستن آن استفاده کنید.");
        }
        return hasDismissableLayer
          ? { enabled: true }
          : unavailable("لایه‌ای برای بستن وجود ندارد.");
      case "file.save":
        if (saveState === "saving")
          return unavailable("ذخیره در حال انجام است.");
        return topLayer === "save" || (!blockedByModal && !composerKind)
          ? { enabled: true }
          : unavailable("ابتدا پنجره یا یادداشت باز را ببندید.");
      case "file.open":
      case "file.quickOpen":
      case "file.export":
      case "file.saveAs":
      case "file.new":
        if (id === "file.quickOpen" && libraryFiles.length === 0) {
          return unavailable("پس از اتصال یک پوشه فعال می‌شود.");
        }
        if (saveState === "saving" && id === "file.new") {
          return unavailable("پس از پایان ذخیره فعال می‌شود.");
        }
        return !blockedByModal && !composerKind
          ? { enabled: true }
          : unavailable("ابتدا پنجره یا یادداشت باز را ببندید.");
      case "file.closeTab":
        if (newTabWorkspaceOpen && !activeDocumentTabId) {
          return unavailable("تب سند فعالی برای بستن وجود ندارد.");
        }
        if (!newTabWorkspaceOpen && !activeDocumentTabId) {
          return unavailable("تب فعالی برای بستن وجود ندارد.");
        }
        return !blockedByModal && !composerKind
          ? { enabled: true }
          : unavailable("ابتدا پنجره یا یادداشت باز را ببندید.");
      case "file.closeOtherTabs":
        if (!activeDocumentTabId || documentTabs.length < 2) {
          return unavailable("تب دیگری برای بستن وجود ندارد.");
        }
        return !blockedByModal && !composerKind
          ? { enabled: true }
          : unavailable("ابتدا پنجره یا یادداشت باز را ببندید.");
      case "file.pinTab":
        return activeDocumentTabId && !newTabWorkspaceOpen && !blockedByModal
          ? { enabled: true }
          : unavailable("پس از فعال‌کردن یک تب سند در دسترس است.");
      case "file.reopenClosedTab":
        return closedDocumentTabs.length > 0 && !blockedByModal
          ? { enabled: true }
          : unavailable("تب بسته‌شده‌ای برای بازگردانی وجود ندارد.");
      case "edit.bold":
      case "edit.italic":
      case "edit.underline":
      case "edit.strike":
      case "edit.clearFormatting":
      case "edit.code":
      case "edit.heading":
      case "edit.list":
      case "edit.orderedList":
      case "edit.task":
      case "edit.codeBlock":
      case "edit.callout":
      case "edit.table":
      case "edit.link":
      case "edit.image":
      case "edit.quote":
      case "edit.reviewPersian":
      case "edit.undo":
      case "edit.redo":
      case "edit.find":
      case "edit.replace":
      case "edit.findNext":
      case "edit.findPrevious":
      case "edit.selectAll":
      case "diagram.mermaid":
        if (readingMode)
          return unavailable("ابتدا از حالت مطالعه به میز بازگردید.");
        if (blockedByModal || composerKind) {
          return unavailable("ابتدا پنجره یا یادداشت باز را ببندید.");
        }
        if (
          id === "edit.clearFormatting" &&
          (!editorRef.current ||
            (!editorRef.current.tableCellSelection &&
              editorRef.current.selectionStart ===
                editorRef.current.selectionEnd))
        ) {
          return unavailable("پس از انتخاب متن فعال می‌شود.");
        }
        return source !== "shortcut" || editorFocused
          ? { enabled: true }
          : unavailable("پس از ورود به ویرایشگر فعال می‌شود.");
      case "view.reading":
      case "focus.editor":
      case "focus.preview":
      case "focus.annotations":
      case "view.sidebar":
      case "view.outline":
        return !blockedByModal && !composerKind
          ? { enabled: true }
          : unavailable("ابتدا پنجره یا یادداشت باز را ببندید.");
      case "focus.selectionToolbar":
        if (readingMode) return unavailable("در حالت نوشتن در دسترس است.");
        if (blockedByModal || composerKind) {
          return unavailable("ابتدا پنجره یا یادداشت باز را ببندید.");
        }
        if (
          !editorSelectionMenuRef.current &&
          !document.querySelector(".editor-selection-mini-menu") &&
          (!editorRef.current ||
            (!editorRef.current.tableCellSelection &&
              editorRef.current.selectionStart ===
                editorRef.current.selectionEnd))
        ) {
          return unavailable("پس از انتخاب متن فعال می‌شود.");
        }
        return source !== "shortcut" || editorFocused
          ? { enabled: true }
          : unavailable("پس از ورود به ویرایشگر فعال می‌شود.");
      case "focus.library":
        return (!blockedByModal || topLayer === "library") && !composerKind
          ? { enabled: true }
          : unavailable("ابتدا پنجره یا یادداشت باز را ببندید.");
      case "view.text.decrease":
        if (readerSize <= 16)
          return unavailable("اندازهٔ متن در کمترین مقدار است.");
        return !blockedByModal &&
          !composerKind &&
          (readingMode || previewFocused || source === "palette")
          ? { enabled: true }
          : unavailable("در پیش‌نمایش یا حالت مطالعه فعال می‌شود.");
      case "view.text.increase":
        if (readerSize >= 22)
          return unavailable("اندازهٔ متن در بیشترین مقدار است.");
        return !blockedByModal &&
          !composerKind &&
          (readingMode || previewFocused || source === "palette")
          ? { enabled: true }
          : unavailable("در پیش‌نمایش یا حالت مطالعه فعال می‌شود.");
      case "annotation.highlight":
      case "annotation.comment":
        return !blockedByModal &&
          !composerKind &&
          Boolean(
            selectionDraft ||
            (editorRef.current &&
              (editorRef.current.tableCellSelection ||
                editorRef.current.selectionStart !==
                  editorRef.current.selectionEnd)),
          )
          ? { enabled: true }
          : unavailable("پس از انتخاب متن فعال می‌شود.");
      case "annotation.submit":
        return !blockedByModal && Boolean(composerKind && composerText.trim())
          ? { enabled: true }
          : unavailable("پس از نوشتن متن یادداشت فعال می‌شود.");
      default:
        return unavailable("این فرمان اکنون در دسترس نیست.");
    }
  };

  const executeCommand = (
    id: CommandId,
    event?: KeyboardEvent,
    source: CommandInvocationSource = "surface",
    availabilityChecked = false,
  ) => {
    if (
      !availabilityChecked &&
      !commandAvailability(id, event, source).enabled
    ) {
      return false;
    }
    const activeOpener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const modalReturnTarget =
      source === "menu"
        ? mobileHeaderMenuButtonRef.current
        : source === "palette"
          ? (commandPaletteReturnFocusRef.current ?? activeOpener)
          : activeOpener;
    switch (id) {
      case "view.commandPalette":
        commandPaletteReturnFocusRef.current = modalReturnTarget;
        break;
      case "help.shortcuts":
        shortcutHelpReturnFocusRef.current = modalReturnTarget;
        break;
      case "help.support":
        supportReturnFocusRef.current = modalReturnTarget;
        break;
      case "help.about":
        aboutReturnFocusRef.current = modalReturnTarget;
        break;
      case "file.export":
        exportReturnFocusRef.current = modalReturnTarget;
        break;
      default:
        break;
    }
    commandHandlers[id](event);
    if (id !== "layer.dismiss") {
      setCommandUsage((current) => recordCommandUsage(current, id));
    }
    return true;
  };

  const runEditorToolCommand = (id: CommandId) => {
    setEditorToolMenuOpen(false);
    setEditorBlockMenu(null);
    executeCommand(id);
  };

  const isEditorBlockTypeCurrent = (type: EditorBlockType) => {
    switch (type) {
      case "heading-1":
      case "heading-2":
      case "heading-3":
        return (
          editorFormatting.block === "heading" &&
          editorFormatting.headingLevel === Number(type.at(-1))
        );
      case "paragraph":
        return editorFormatting.block === "paragraph";
      case "task":
      case "bullet-list":
      case "ordered-list":
      case "code-block":
      case "quote":
      case "table":
      case "mermaid":
      case "image":
      case "formula":
        return editorFormatting.block === type;
    }
  };

  const convertEditorBlock = (type: DirectEditorBlockType) => {
    const editor = editorBlockMenuEditorRef.current ?? editorRef.current;
    const menu = editorBlockMenu;
    if (!editor || !menu) return;

    const source = editor.value;
    const blockRange = editor.getBlockRange(menu.lineFrom) ?? {
      from: menu.lineFrom,
      to: menu.lineFrom,
    };
    const blockFrom = Math.max(0, Math.min(blockRange.from, source.length));
    const blockTo = Math.max(blockFrom, Math.min(blockRange.to, source.length));
    const currentBlock = source.slice(blockFrom, blockTo);

    if (menu.intent === "insert") {
      const lineBreak = source.includes("\r\n") ? "\r\n" : "\n";
      const blockGap = `${lineBreak}${lineBreak}`;
      const following = source.slice(blockTo);
      const prefix =
        blockTo === 0 || source.slice(0, blockTo).endsWith(blockGap)
          ? ""
          : blockGap;
      const suffix =
        following.startsWith(blockGap) || !following ? "" : blockGap;
      const converted = convertMarkdownBlockToType("/", 1, type);
      const inserted = `${prefix}${converted.markdown}${suffix}`;
      setEditorBlockMenu(null);
      editor.replaceRange({
        from: blockTo,
        to: blockTo,
        insert: inserted,
        selectionFrom: blockTo + prefix.length + converted.selectionOffset,
        selectionTo: blockTo + prefix.length + converted.selectionOffset,
        announcement: "بلوک جدید درج شد",
      });
      return;
    }

    setEditorBlockMenu(null);
    const slashQuery =
      menu.source === "slash" ? slashMenuQueryFromLine(currentBlock) : null;
    if (isEditorBlockTypeCurrent(type) && slashQuery === null) {
      requestAnimationFrame(() => editor.focus());
      return;
    }

    const conversionSource = slashQuery === null ? currentBlock : "/";
    const selectionOffset = Math.max(
      0,
      Math.min(
        slashQuery === null ? editor.selectionStart - blockFrom : 1,
        conversionSource.length,
      ),
    );
    const converted = convertMarkdownBlockToType(
      conversionSource,
      selectionOffset,
      type,
    );
    const announcement =
      type === "paragraph"
        ? "بلوک به متن معمولی تبدیل شد"
        : type === "code-block"
          ? "بلوک به کد تبدیل شد"
          : type === "formula"
            ? "بلوک فرمول ساخته شد"
            : "نوع بلوک تغییر کرد";

    editor.replaceRange({
      from: blockFrom,
      to: blockTo,
      insert: converted.markdown,
      selectionFrom: blockFrom + converted.selectionOffset,
      selectionTo: blockFrom + converted.selectionOffset,
      announcement,
    });
  };

  useEffect(() => {
    if (!isCompactLayout || !splitWorkspaceActive) return;
    const compactMode: SingleEditorMode =
      activeSplitPane === "editor" ? "source" : "live";
    const frame = window.requestAnimationFrame(() => {
      setSplitWorkspaceActive(false);
      setSingleEditorMode(compactMode);
      setDesktopPaneMode("editor");
      setMobilePane("editor");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSplitPane, isCompactLayout, splitWorkspaceActive]);

  const prepareEditorBlockInsertion = () => {
    const menu = editorBlockMenu;
    const editor = editorBlockMenuEditorRef.current ?? editorRef.current;
    if (!menu || !editor) return null;
    const source = editor.value;
    const lineBreak = source.indexOf("\n", menu.lineFrom);
    const lineTo = lineBreak === -1 ? source.length : lineBreak;
    const line = source.slice(menu.lineFrom, lineTo);
    if (menu.intent === "insert") {
      const blockRange = editor.getBlockRange(menu.lineFrom);
      const offset = blockRange?.to ?? editor.selectionStart;
      editor.setSelectionRange(offset, offset, false);
      return { editor, menu, content: source, offset };
    }
    if (menu.source === "slash" && slashMenuQueryFromLine(line) !== null) {
      const offset = menu.lineFrom;
      const content = `${source.slice(0, menu.lineFrom)}${source.slice(lineTo)}`;
      editor.replaceRange({
        from: menu.lineFrom,
        to: lineTo,
        insert: "",
        selectionFrom: offset,
        selectionTo: offset,
        announcement: "منوی نوع بلوک بسته شد",
      });
      return { editor, menu, content, offset };
    }
    if (
      editor.selectionStart < menu.lineFrom ||
      editor.selectionStart > lineTo
    ) {
      editor.setSelectionRange(menu.lineFrom, menu.lineFrom, false);
    }
    return {
      editor,
      menu,
      content: source,
      offset: editor.selectionStart,
    };
  };

  const openEditorBlockHelper = (kind: "table" | "image") => {
    const prepared = prepareEditorBlockInsertion();
    if (!prepared) return;
    openEditorHelper(kind, prepared.menu.trigger);
  };

  const openEditorBlockMermaid = () => {
    const prepared = prepareEditorBlockInsertion();
    if (!prepared) return;
    setEditorBlockMenu(null);
    openMermaidStudio(undefined, {
      content: prepared.content,
      offset: prepared.offset,
    });
  };

  const openEditorBlockFormula = () => {
    const menu = editorBlockMenu;
    if (!menu) return;
    const existing = formulaBlockAtOffset(formulaBlocks, menu.lineFrom);
    if (existing) {
      setEditorBlockMenu(null);
      openFormulaStudio(existing);
      return;
    }
    const prepared = prepareEditorBlockInsertion();
    if (!prepared) return;
    setEditorBlockMenu(null);
    openFormulaStudio(undefined, {
      content: prepared.content,
      offset: prepared.offset,
    });
  };

  const chooseEditorBlockMenuItem = (item: SlashMenuItem) => {
    switch (item.type) {
      case "table":
      case "image":
        openEditorBlockHelper(item.type);
        return;
      case "mermaid":
        openEditorBlockMermaid();
        return;
      case "formula":
        openEditorBlockFormula();
        return;
      default:
        convertEditorBlock(item.type);
    }
  };

  const handleEditorBlockMenuKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]',
      ),
    );
    if (!items.length) return;
    const activeIndex = items.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const checkedIndex = Math.max(
      0,
      items.findIndex((item) => item.getAttribute("aria-checked") === "true"),
    );
    const currentIndex = activeIndex === -1 ? checkedIndex : activeIndex;
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowUp"
            ? (currentIndex - 1 + items.length) % items.length
            : (currentIndex + 1) % items.length;
    event.preventDefault();
    event.stopPropagation();
    items[nextIndex]?.focus();
  };

  const closeDesktopHeaderOverflowFromTab = (shiftKey: boolean) => {
    const trigger = mobileHeaderMenuButtonRef.current;
    const menu = mobileHeaderMenuRef.current;
    const focusable = Array.from(
      document.querySelectorAll<HTMLElement>(
        [
          "button:not([disabled])",
          "input:not([disabled]):not([type='hidden'])",
          "textarea:not([disabled])",
          "select:not([disabled])",
          "a[href]",
          '[tabindex]:not([tabindex="-1"])',
        ].join(","),
      ),
    ).filter(
      (element) =>
        element.offsetParent !== null &&
        element.getAttribute("aria-hidden") !== "true" &&
        !element.closest("[inert]") &&
        !menu?.contains(element),
    );
    const triggerIndex = trigger ? focusable.indexOf(trigger) : -1;
    const target =
      triggerIndex >= 0
        ? (focusable[triggerIndex + (shiftKey ? -1 : 1)] ?? trigger)
        : trigger;
    headerOverflowReturnFocusRef.current = target;
    setMobileHeaderMenuOpen(false);
  };

  const handleHeaderOverflowKeyDown = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (!isCompactLayout && event.key === "Tab") {
      event.preventDefault();
      event.stopPropagation();
      closeDesktopHeaderOverflowFromTab(event.shiftKey);
      return;
    }
    if (event.key === "Escape") {
      headerOverflowReturnFocusRef.current = mobileHeaderMenuButtonRef.current;
      event.preventDefault();
      event.stopPropagation();
      setMobileHeaderMenuOpen(false);
      return;
    }
    if (
      isCompactLayout ||
      !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
    ) {
      return;
    }
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ),
    );
    if (!items.length) return;
    const currentIndex = items.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowUp"
            ? (Math.max(currentIndex, 0) - 1 + items.length) % items.length
            : (currentIndex + 1) % items.length;
    event.preventDefault();
    event.stopPropagation();
    items[nextIndex]?.focus();
  };

  const openEditorBlockMenu = (
    lineFrom: number,
    trigger: HTMLElement,
    source: "gutter" | "slash" | "toolbar" = "gutter",
    intent: "convert" | "insert" = "convert",
  ) => {
    const triggerRect = trigger.getBoundingClientRect();
    const triggerEditor = trigger.closest("#writing-editor")
      ? writingEditorRef.current
      : editorRef.current;
    if (!triggerEditor) return;
    editorBlockMenuEditorRef.current = triggerEditor;
    const caretAnchor =
      source === "slash" && trigger.classList.contains("cm-editor")
        ? triggerEditor.getSelectionAnchor()
        : null;
    const menuWidth = 320;
    const menuHeight = source === "toolbar" ? 474 : 378;
    const maximumX = Math.max(12, window.innerWidth - menuWidth - 12);
    const x = Math.max(
      12,
      Math.min(
        caretAnchor
          ? caretAnchor.clientX - menuWidth / 2
          : triggerRect.left - menuWidth,
        maximumX,
      ),
    );
    const preferredY =
      source === "toolbar"
        ? triggerRect.top - menuHeight - 12
        : caretAnchor
          ? caretAnchor.clientY + 20
          : triggerRect.top - 152;
    const y = Math.max(
      12,
      Math.min(preferredY, window.innerHeight - menuHeight - 12),
    );
    setEditorToolMenuOpen(false);
    setEditorHelper(null);
    setEditorSelectionMenuPosition(null);
    setEditorBlockMenu({ lineFrom, x, y, trigger, source, intent, query: "" });
    if (source !== "slash") {
      requestAnimationFrame(() => {
        const menu = editorBlockMenuRef.current;
        const selected = menu?.querySelector<HTMLButtonElement>(
          '[role="menuitemradio"][aria-checked="true"]',
        );
        (
          selected ??
          menu?.querySelector<HTMLButtonElement>('[role="menuitemradio"]')
        )?.focus();
      });
    }
  };

  const keyboardCommandHandlers = ALL_COMMAND_IDS.reduce(
    (handlers, id) => {
      handlers[id] = (event: KeyboardEvent) => {
        executeCommand(id, event, "shortcut", true);
      };
      return handlers;
    },
    {} as Record<CommandId, (event: KeyboardEvent) => void>,
  );

  const isCommandEnabled = (id: CommandId, event: KeyboardEvent) =>
    commandAvailability(id, event, "shortcut").enabled;

  useCommandSystem({
    environment: commandEnvironment,
    context: {
      enabledCommandIds,
      hasEditorSelection: Boolean(editorSelectionStats),
    },
    getHasEditorSelection: () =>
      Boolean(
        editorSelectionMenuRef.current ||
        document.querySelector(".editor-selection-mini-menu") ||
        (editorRef.current &&
          (editorRef.current.tableCellSelection ||
            editorRef.current.selectionStart !==
              editorRef.current.selectionEnd)),
      ),
    handlers: keyboardCommandHandlers,
    isCommandEnabled,
  });

  const handleAppKeyDownCapture = (
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    if (
      event.code !== "F10" ||
      !event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.repeat ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Node) || !editorRef.current?.contains(target)) {
      return;
    }
    if (
      !document.querySelector(".editor-selection-mini-menu") &&
      !editorRef.current.tableCellSelection &&
      editorRef.current.selectionStart === editorRef.current.selectionEnd
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    executeCommand(
      "focus.selectionToolbar",
      event.nativeEvent,
      "shortcut",
      true,
    );
  };

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
                <figure
                  className="mermaid-diagram is-loading"
                  dir="auto"
                  {...sourceOffsetAttribute(node)}
                >
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
                documentName={fileName}
              />
            </Suspense>
          );
        }
        return <pre {...sourceOffsetAttribute(node)}>{children}</pre>;
      },
      p: ({ children, node }) => {
        const formula = formulaBlockAtOffset(
          formulaBlocks,
          node?.position?.start.offset,
        );
        if (formula) {
          return (
            <Suspense
              fallback={
                <figure
                  className="formula-document-block is-loading"
                  role="status"
                  aria-live="polite"
                  aria-label="در حال آماده‌سازی فرمول"
                >
                  <RefreshCw
                    className="is-spinning"
                    size={20}
                    aria-hidden="true"
                  />
                </figure>
              }
            >
              <FormulaDocumentBlock
                block={formula}
                readingMode={readingMode}
                onEdit={openFormulaStudio}
              />
            </Suspense>
          );
        }
        return (
          <p
            dir={blockTextDirection(children)}
            {...sourceOffsetAttribute(node)}
          >
            {children}
          </p>
        );
      },
      h1: ({ children, node }) => (
        <h1 dir={blockTextDirection(children)} {...sourceOffsetAttribute(node)}>
          {children}
        </h1>
      ),
      h2: ({ children, node }) => (
        <h2 dir={blockTextDirection(children)} {...sourceOffsetAttribute(node)}>
          {children}
        </h2>
      ),
      h3: ({ children, node }) => (
        <h3 dir={blockTextDirection(children)} {...sourceOffsetAttribute(node)}>
          {children}
        </h3>
      ),
      h4: ({ children, node }) => (
        <h4 dir={blockTextDirection(children)} {...sourceOffsetAttribute(node)}>
          {children}
        </h4>
      ),
      h5: ({ children, node }) => (
        <h5 dir={blockTextDirection(children)} {...sourceOffsetAttribute(node)}>
          {children}
        </h5>
      ),
      h6: ({ children, node }) => (
        <h6 dir={blockTextDirection(children)} {...sourceOffsetAttribute(node)}>
          {children}
        </h6>
      ),
      li: ({ children, className, node }) => (
        <li
          className={className}
          dir={blockTextDirection(children)}
          {...sourceOffsetAttribute(node)}
        >
          {children}
        </li>
      ),
      blockquote: ({ children, node }) => (
        <blockquote
          dir={blockTextDirection(children)}
          {...sourceOffsetAttribute(node)}
        >
          {children}
        </blockquote>
      ),
      table: ({ children, node }) => (
        <table {...sourceOffsetAttribute(node)}>{children}</table>
      ),
      th: ({ children }) => (
        <th dir={blockTextDirection(children)}>{children}</th>
      ),
      td: ({ children }) => (
        <td dir={blockTextDirection(children)}>{children}</td>
      ),
      a: ({ href, ...props }) => {
        const isExternal = /^(?:https?):\/\//i.test(href ?? "");
        return (
          <a
            {...props}
            href={href}
            dir="auto"
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noreferrer noopener" : undefined}
            onClick={(event) => {
              if (!isExternal || !href) return;
              event.preventDefault();
              if (privacyPreferences.warnBeforeExternalLinks) {
                setExternalLinkCandidate(href);
              } else {
                void openExternalUrl(href);
              }
            }}
          />
        );
      },
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
                    این Markdown به یک تصویر محلی اشاره می‌کند، اما
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
        const remoteImageAllowed =
          !isRemoteImage ||
          privacyPreferences.externalImagePolicy === "allow" ||
          approvedRemoteImages.has(imageSource);

        if (isRemoteImage && !remoteImageAllowed) {
          const canApprove = privacyPreferences.externalImagePolicy === "ask";
          return (
            <span className="remote-media-blocked" role="note">
              <ImagePlus size={18} aria-hidden="true" />
              <span>
                <strong>
                  {canApprove
                    ? "تصویر بیرونی آمادهٔ بارگیری است"
                    : "تصویر بیرونی مسدود است"}
                </strong>
                <small>
                  {canApprove
                    ? "تا اجازه ندهید هیچ درخواستی برای میزبان تصویر فرستاده نمی‌شود."
                    : "بارگیری تصاویر بیرونی در تنظیمات حریم خصوصی مسدود شده است."}
                </small>
              </span>
              {canApprove && (
                <button
                  type="button"
                  onClick={() =>
                    setApprovedRemoteImages((current) => {
                      const next = new Set(current);
                      next.add(imageSource);
                      return next;
                    })
                  }
                >
                  اجازه و بارگیری
                </button>
              )}
            </span>
          );
        }

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
      approvedRemoteImages,
      fileName,
      formulaBlocks,
      handleDiagramFullscreenChange,
      mermaidBlocks,
      openFormulaStudio,
      openMermaidStudio,
      openExternalUrl,
      privacyPreferences,
      readingMode,
      themeMode,
      pdfExportActive,
    ],
  );
  const previewFrontmatter = useMemo(
    () => extractWordFrontmatter(content),
    [content],
  );
  const previewHasFrontmatter = previewFrontmatter.markdown !== content;
  const readingDocumentKicker =
    previewFrontmatter.properties.subject ??
    previewFrontmatter.properties.title ??
    fileName.replace(/\.(?:md|markdown|ravi)$/iu, "");
  const renderedMarkdownPreview = useMemo(
    () =>
      !progressivePreview ? (
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkHighlight, remarkUnderline]}
          urlTransform={raaviMarkdownUrlTransform}
          components={markdownComponents}
        >
          {content}
        </ReactMarkdown>
      ) : (
        previewMarkdownChunks
          .slice(0, pdfExportActive ? undefined : renderedPreviewChunkCount)
          .map((chunk, index) => (
            <section
              className="markdown-render-chunk"
              data-markdown-chunk={index}
              data-source-start={chunk.start}
              key={`${currentContentSignature}-${chunk.start}`}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkHighlight, remarkUnderline]}
                urlTransform={raaviMarkdownUrlTransform}
                components={markdownComponents}
              >
                {chunk.content}
              </ReactMarkdown>
            </section>
          ))
      ),
    [
      content,
      currentContentSignature,
      markdownComponents,
      pdfExportActive,
      previewMarkdownChunks,
      progressivePreview,
      renderedPreviewChunkCount,
    ],
  );
  if (content.length >= 1_000_000) {
    console.log("[raavi-large-document] parent-render-ready", {
      chunkCount: previewMarkdownChunks.length,
      renderedPreviewChunkCount,
      readingMode,
    });
  }

  const effectivePaneMode: DesktopPaneMode = isCompactLayout
    ? "editor"
    : desktopPaneMode;
  const mobileEditorToolsVisible =
    isCompactLayout &&
    !readingMode &&
    mobilePane === "editor" &&
    mobileEditorToolsExpanded;

  useBackLayer("mode:reading", readingMode, leaveReadingMode, isCompactLayout);
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
    "modal:shortcut-settings",
    shortcutSettingsOpen,
    closeShortcutSettings,
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
    "modal:quick-open",
    quickOpenOpen,
    () => setQuickOpenOpen(false),
    isCompactLayout,
  );
  useBackLayer(
    "modal:command-palette",
    commandPaletteOpen,
    () => setCommandPaletteOpen(false),
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
    libraryIsModal,
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
  useBackLayer(
    "modal:formula-shell",
    Boolean(formulaStudioSession),
    () => {
      if (formulaStudioSession) closeFormulaStudio(formulaStudioSession);
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
  const isWebLibrary = hydrated && commandEnvironment.surface === "web";
  const sidebarDestinationTitles: Record<SidebarDestination, string> = {
    library: "کتابخانه",
    search: "جست‌وجو در متن",
    history: "تاریخچه",
    versions: "نسخه‌ها",
    ai: "راوی هوشمند",
    persian: "اصلاحات فارسی",
    outline: "فهرست سند",
    highlights: "هایلایت‌ها",
    comments: "نظرات",
  };
  const deskSidebarRailItems = [
    {
      id: "ai",
      view: "ai",
      label: "راوی هوشمند",
      icon: <MagicWandIcon size={18} />,
      magic: true,
      disabled: isInitialWorkspace,
    },
    {
      id: "library",
      view: "files",
      label: "کتابخانه",
      icon: <Library size={18} aria-hidden="true" />,
    },
    {
      id: "history",
      view: "history",
      label: "تاریخچه",
      icon: <History size={18} aria-hidden="true" />,
    },
    {
      id: "versions",
      view: "versions",
      label: "نسخه‌ها",
      icon: <FileArchive size={18} aria-hidden="true" />,
      disabled: isInitialWorkspace,
    },
    {
      id: "persian",
      view: "annotations",
      label: "اصلاحات فارسی",
      icon: (
        <span className="sidebar-persian-corrections-icon" aria-hidden="true">
          <span>آ</span>
          <Check size={9} />
        </span>
      ),
      disabled: isInitialWorkspace,
    },
    {
      id: "outline",
      view: "outline",
      label: "فهرست سند",
      icon: <ListIcon size={18} aria-hidden="true" />,
      disabled: isInitialWorkspace,
    },
    {
      id: "highlights",
      view: "annotations",
      label: "هایلایت‌ها",
      icon: <Highlighter size={18} aria-hidden="true" />,
      disabled: isInitialWorkspace,
    },
    {
      id: "comments",
      view: "annotations",
      label: "نظرات",
      icon: <MessageSquareText size={18} aria-hidden="true" />,
      disabled: isInitialWorkspace,
    },
  ] satisfies readonly SidebarRailItem[];
  const readingSidebarRailItems = [
    {
      id: "ai",
      view: "ai",
      label: "راوی هوشمند",
      icon: <MagicWandIcon size={18} />,
      magic: true,
    },
    {
      id: "search",
      view: "search",
      label: "جست‌وجو در متن",
      icon: <Search size={18} aria-hidden="true" />,
    },
    {
      id: "outline",
      view: "outline",
      label: "فهرست سند",
      icon: <ListIcon size={18} aria-hidden="true" />,
    },
    {
      id: "highlights",
      view: "annotations",
      label: "هایلایت‌ها",
      icon: <Highlighter size={18} aria-hidden="true" />,
    },
    {
      id: "comments",
      view: "annotations",
      label: "نظرات",
      icon: <MessageSquareText size={18} aria-hidden="true" />,
    },
  ] satisfies readonly SidebarRailItem[];
  const sidebarRailItems = readingMode
    ? readingSidebarRailItems
    : deskSidebarRailItems;
  const currentAnnotationUndos = annotationUndoQueue.filter(
    (record) => record.documentKey === currentDocumentKey,
  );
  const effectiveSidebarWidth =
    sidebarView === "ai" ? 372 : readingMode ? 304 : sidebarWidth;
  const workspaceFrameStyle = {
    "--sidebar-pane-width": `${effectiveSidebarWidth}px`,
  } as React.CSSProperties;
  const annotationComposerFloats =
    previewPaneCollapsed ||
    (!readingMode && isCompactLayout && mobilePane !== "preview");
  const activeWorkspaceFolder =
    libraryFolders.find(
      (folder) =>
        folder.rootId === fileLibraryPreferences.activeWorkspaceRootId,
    ) ?? libraryFolders[0];
  const documentTabViews: DocumentTabView[] = documentTabs.map((tab) => ({
    id: tab.id,
    title: tab.title,
    dirty: tab.dirty,
    pinned: tab.pinned,
  }));
  const showDocumentTabBar =
    !readingMode &&
    (documentTabs.length > 0 ||
      newTabWorkspaceOpen ||
      Boolean(activeWorkspaceFolder));
  const launchRecentFiles = recentPanelEntries
    .map((recent) => {
      const normalizedRecentPath = recent.path
        .replaceAll("\\", "/")
        .toLowerCase();
      const libraryFile = libraryFiles.find((file) => {
        const candidatePath = file.nativePath ?? file.path;
        return (
          candidatePath.replaceAll("\\", "/").toLowerCase() ===
          normalizedRecentPath
        );
      });
      return {
        ...recent,
        lastModified: recent.lastModified ?? libraryFile?.lastModified,
      } satisfies LaunchRecentFile;
    })
    .sort((left, right) => {
      const leftTime = left.lastModified ?? new Date(left.openedAt).getTime();
      const rightTime =
        right.lastModified ?? new Date(right.openedAt).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 9);
  const returningLaunchActive =
    isInitialWorkspace &&
    Boolean(activeWorkspaceFolder) &&
    launchRecentFiles.length > 0;
  const renderAnnotationComposer = (floating = false) => (
    <div
      className={`annotation-toolbar has-selection is-composing ${
        floating ? "editor-annotation-composer-floating" : ""
      }`}
      role="dialog"
      aria-modal={floating || undefined}
      aria-label={
        composerKind ? `افزودن ${ANNOTATION_LABELS[composerKind]}` : undefined
      }
    >
      {composerKind && selectionDraft && (
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
              placeholder="نظر یا بازخورد خود را بنویسید…"
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
              onClick={cancelAnnotationComposer}
            >
              لغو
            </button>
          </div>
        </>
      )}
    </div>
  );
  return (
    <div
      className={`app-shell is-new-ui ${isInitialWorkspace ? "is-empty-workspace" : ""} ${returningLaunchActive ? "is-launch-returning" : ""} ${readingMode ? "is-reading" : ""} ${
        !readingMode && !isInitialWorkspace && activeEditorMode === "live"
          ? "is-writing-mode"
          : ""
      } ${
        !readingMode &&
        !isInitialWorkspace &&
        activeEditorMode === "proof" &&
        splitWorkspaceActive
          ? "is-split-mode"
          : ""
      } ${
        !readingMode && !isInitialWorkspace && activeEditorMode === "source"
          ? "is-code-mode"
          : ""
      } ${
        readingMode && !readingHeaderVisible ? "reading-header-is-hidden" : ""
      } ${mobileHeaderMenuOpen ? "is-overflow-open" : ""} ${
        saveErrorBannerVisible ? "has-save-error" : ""
      } ${exportModalOpen ? "has-export-dialog" : ""} ${
        modeSwipeTarget ? `is-mode-swipe-to-${modeSwipeTarget}` : ""
      }`}
      data-hydrated={hydrated ? "true" : "false"}
      style={workspaceFrameStyle}
      onKeyDownCapture={handleAppKeyDownCapture}
    >
      {composerKind && selectionDraft && annotationComposerFloats
        ? renderAnnotationComposer(true)
        : null}
      <header
        className={`topbar ${
          readingMode
            ? readingHeaderVisible
              ? "reading-topbar is-visible"
              : "reading-topbar is-concealed"
            : ""
        }`}
        data-tauri-drag-region=""
        inert={
          Boolean(mermaidStudioSession || formulaStudioSession) ||
          aboutModalOpen ||
          supportModalOpen ||
          newDocumentModalOpen ||
          saveModalOpen ||
          Boolean(pendingDocumentClose) ||
          exportModalOpen ||
          shortcutHelpOpen ||
          shortcutSettingsOpen ||
          commandPaletteOpen ||
          (mobileHeaderMenuOpen && isCompactLayout) ||
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
        <div className="topbar-document-zone" data-tauri-drag-region="">
          <div className="brand-cluster" aria-label="راوی، میز Markdown فارسی">
            <div className="brand">
              <span className="brand-mark" aria-hidden="true">
                ر
              </span>
              <span className="brand-copy">
                <strong>راوی</strong>
                <small>میز Markdown فارسی</small>
              </span>
            </div>
          </div>
          <button
            className="titlebar-command-shortcut"
            type="button"
            data-command-id="view.commandPalette"
            onClick={() => executeCommand("view.commandPalette")}
            aria-label="بازکردن مرکز فرمان راوی"
            title="مرکز فرمان راوی"
          >
            <span dir="ltr">CTRL+K</span>
          </button>
          <button
            className="titlebar-theme-control"
            type="button"
            data-command-id="view.theme"
            onClick={() => executeCommand("view.theme")}
            disabled={Boolean(themeTransition)}
            aria-label={
              themeMode === "light" ? "فعال‌کردن تم تاریک" : "فعال‌کردن تم روشن"
            }
            aria-pressed={themeMode === "dark"}
            title={themeMode === "light" ? "تم تاریک" : "تم روشن"}
          >
            {themeMode === "light" ? (
              <Moon size={18} aria-hidden="true" />
            ) : (
              <Sun size={18} aria-hidden="true" />
            )}
          </button>
        </div>

        <div
          className={`window-controls ${
            commandEnvironment.surface === "web" ? "is-preview-only" : ""
          }`}
          dir="ltr"
          aria-label="کنترل‌های پنجره"
          aria-hidden={commandEnvironment.surface === "web" || undefined}
        >
          <button
            type="button"
            tabIndex={commandEnvironment.surface === "web" ? -1 : 0}
            onClick={() => void window.raaviDesktop?.minimizeWindow?.()}
            aria-label="کوچک‌کردن پنجره"
            title="کوچک‌کردن"
          >
            <Minus size={17} aria-hidden="true" />
          </button>
          <button
            type="button"
            tabIndex={commandEnvironment.surface === "web" ? -1 : 0}
            onClick={() => void window.raaviDesktop?.toggleMaximizeWindow?.()}
            aria-label="بزرگ یا بازیابی‌کردن پنجره"
            title="بزرگ یا بازیابی‌کردن"
          >
            <WindowMaximize size={16} aria-hidden="true" />
          </button>
          <button
            className="window-control-close"
            type="button"
            tabIndex={commandEnvironment.surface === "web" ? -1 : 0}
            onClick={() => void window.raaviDesktop?.closeWindow?.()}
            aria-label="بستن پنجره"
            title="بستن"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>

        {readingMode && (
          <span className="reading-local-note">
            <span aria-hidden="true">●</span>
            فقط روی این دستگاه
          </span>
        )}

        {readingMode && (
          <div
            className="reading-header-document"
            aria-label={`سند در حال مطالعه: ${fileName}`}
          >
            <div className="reading-header-identity">
              <BookOpen size={18} aria-hidden="true" />
              <strong dir="auto" title={fileName}>
                {fileName}
              </strong>
            </div>
            <div className="reading-header-actions">
              <button
                className="reading-return-to-desk"
                type="button"
                data-command-id="view.reading"
                onClick={() => executeCommand("view.reading")}
                aria-label="بازگشت به میز"
                title="بازگشت به میز"
              >
                <ArrowLeft size={18} aria-hidden="true" />
                <span>بازگشت به میز</span>
              </button>
              <div className="reading-tools-anchor">
                <button
                  ref={readingToolsButtonRef}
                  className="reading-header-tools-toggle"
                  type="button"
                  onClick={() => setReadingToolsOpen((current) => !current)}
                  aria-haspopup="menu"
                  aria-expanded={readingToolsOpen}
                  aria-controls="reading-tools-menu"
                  aria-label="ابزار مطالعه"
                  title="ابزار مطالعه"
                >
                  <Ellipsis size={19} aria-hidden="true" />
                  <span>ابزار</span>
                </button>
                {readingToolsOpen && (
                  <ReadingToolsMenu
                    ref={readingToolsRef}
                    size={readerSize}
                    onDecrease={() => changeReaderSize(-1)}
                    onIncrease={() => changeReaderSize(1)}
                    decreaseKeyShortcuts={commandAriaKeyShortcuts(
                      "view.text.decrease",
                      commandEnvironment,
                    )}
                    increaseKeyShortcuts={commandAriaKeyShortcuts(
                      "view.text.increase",
                      commandEnvironment,
                    )}
                    decreaseTitle={commandTitle(
                      "view.text.decrease",
                      commandEnvironment,
                      "کوچک‌تر کردن متن",
                    )}
                    increaseTitle={commandTitle(
                      "view.text.increase",
                      commandEnvironment,
                      "بزرگ‌تر کردن متن",
                    )}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        <div
          className="topbar-actions topbar-primary-actions"
          aria-label="عملیات اصلی سند"
        >
          <button
            ref={newDocumentButtonRef}
            className="button button--quiet shell-action new-document-trigger topbar-action--new"
            type="button"
            data-primary-action="new"
            data-command-id="file.new"
            data-tooltip="ساخت فایل جدید"
            onClick={() => executeCommand("file.new")}
            disabled={saveState === "saving"}
            aria-label="فایل جدید"
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
            <span className="action-label action-label--optional">
              فایل جدید
            </span>
          </button>
          <button
            className={`button shell-action topbar-action--open ${
              isInitialWorkspace
                ? "button--quiet is-icon-only"
                : "button--quiet is-icon-only"
            }`}
            type="button"
            data-primary-action="open"
            data-command-id="file.open"
            data-tooltip="باز کردن فایل از دستگاه"
            onClick={() => executeCommand("file.open")}
            aria-label="باز کردن فایل"
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
            <FolderOpen size={18} aria-hidden="true" />
            <span className="action-label">باز کردن فایل</span>
          </button>
          <button
            className={`button button--quiet shell-action topbar-action--save is-${effectiveSaveState} ${
              isInitialWorkspace ? "is-empty-hidden" : ""
            }`}
            type="button"
            data-primary-action="save"
            data-command-id="file.save"
            data-tooltip={
              effectiveSaveState === "dirty"
                ? "ذخیرهٔ تغییرات سند"
                : "ذخیرهٔ نسخهٔ جدید"
            }
            onClick={() => executeCommand("file.save")}
            disabled={saveState === "saving"}
            aria-label={
              effectiveSaveState === "saving"
                ? "در حال ذخیرهٔ سند"
                : effectiveSaveState === "dirty"
                  ? "ذخیرهٔ تغییرات سند؛ سند ذخیره نشده است"
                  : "ذخیرهٔ سند"
            }
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
            <span className="action-label">
              {effectiveSaveState === "saving"
                ? "در حال ذخیره…"
                : effectiveSaveState === "dirty"
                  ? "ذخیره نشده"
                  : "ذخیره"}
            </span>
          </button>
          <button
            className={`button button--quiet shell-action topbar-action--undo ${
              isInitialWorkspace ? "is-empty-hidden" : ""
            }`}
            type="button"
            data-command-id="edit.undo"
            data-tooltip="واگرد"
            onClick={() => executeCommand("edit.undo")}
            aria-label="واگرد آخرین تغییر"
            aria-keyshortcuts={commandAriaKeyShortcuts(
              "edit.undo",
              commandEnvironment,
            )}
            title={commandTitle("edit.undo", commandEnvironment, "واگرد")}
          >
            <Undo2 size={18} aria-hidden="true" />
            <span className="action-label">واگرد</span>
          </button>
          <button
            className={`button button--quiet shell-action topbar-action--redo ${
              isInitialWorkspace ? "is-empty-hidden" : ""
            }`}
            type="button"
            data-command-id="edit.redo"
            data-tooltip="ازنو"
            onClick={() => executeCommand("edit.redo")}
            aria-label="انجام دوبارهٔ تغییر"
            aria-keyshortcuts={commandAriaKeyShortcuts(
              "edit.redo",
              commandEnvironment,
            )}
            title={commandTitle("edit.redo", commandEnvironment, "ازنو")}
          >
            <Redo2 size={18} aria-hidden="true" />
            <span className="action-label">ازنو</span>
          </button>
          <button
            className={`button button--quiet shell-action topbar-action--find ${
              isInitialWorkspace ? "is-empty-hidden" : ""
            }`}
            type="button"
            data-command-id="edit.find"
            data-tooltip="جست‌وجو در سند"
            onClick={() => executeCommand("edit.find")}
            aria-label="جست‌وجو در سند"
            aria-keyshortcuts={commandAriaKeyShortcuts(
              "edit.find",
              commandEnvironment,
            )}
            title={commandTitle(
              "edit.find",
              commandEnvironment,
              "جست‌وجو در سند",
            )}
          >
            <Search size={18} aria-hidden="true" />
            <span className="action-label">جست‌وجو</span>
          </button>
          <button
            className={`button button--quiet shell-action topbar-action--reading ${
              readingMode ? "is-active" : ""
            } ${isInitialWorkspace ? "is-empty-hidden" : ""}`}
            type="button"
            data-primary-action="mode"
            data-command-id="view.reading"
            data-tooltip={readingMode ? "بازگشت به میز" : "حالت مطالعه"}
            onClick={() => executeCommand("view.reading")}
            aria-label={readingMode ? "بازگشت به میز" : "حالت مطالعه"}
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
            <span className="action-label">
              {readingMode ? "بازگشت به میز" : "حالت مطالعه"}
            </span>
          </button>
          <button
            ref={mobileHeaderMenuButtonRef}
            className="button button--quiet shell-action header-overflow-trigger mobile-topbar-menu-trigger topbar-action--overflow"
            type="button"
            data-tooltip="فرمان‌های بیشتر"
            onClick={() => {
              setMobileEditorToolsExpanded(false);
              headerOverflowReturnFocusRef.current =
                mobileHeaderMenuButtonRef.current;
              setMobileHeaderMenuOpen(true);
            }}
            onKeyDown={(event) => {
              if (
                isCompactLayout ||
                !mobileHeaderMenuOpen ||
                event.key !== "Tab"
              ) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              closeDesktopHeaderOverflowFromTab(event.shiftKey);
            }}
            aria-label="بازکردن فرمان‌های بیشتر"
            aria-haspopup={isCompactLayout ? "dialog" : "menu"}
            aria-expanded={mobileHeaderMenuOpen}
            aria-controls="header-overflow-menu"
            title="فرمان‌های بیشتر"
          >
            <Ellipsis size={18} aria-hidden="true" />
            <span className="action-label">بیشتر</span>
          </button>
        </div>
      </header>

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        aria-hidden="true"
        accept=".md,.markdown,text/markdown"
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
        initialFocusRef={
          isCompactLayout
            ? mobileHeaderMenuCloseRef
            : desktopHeaderMenuFirstItemRef
        }
        returnFocusRef={headerOverflowReturnFocusRef}
        backdropClassName="mobile-topbar-menu-backdrop header-overflow-backdrop"
        dialogClassName="mobile-topbar-menu header-overflow-menu"
        labelledBy="mobile-topbar-menu-title"
        containerId="header-overflow-menu"
        containerRole={isCompactLayout ? "dialog" : "menu"}
        ariaModal={isCompactLayout}
        trapFocus={isCompactLayout}
        onKeyDown={handleHeaderOverflowKeyDown}
      >
        <div className="mobile-topbar-menu-header header-overflow-header">
          <div>
            <span>فرمان‌های تکمیلی</span>
            <strong id="mobile-topbar-menu-title">فرمان‌های بیشتر</strong>
          </div>
          <button
            ref={mobileHeaderMenuCloseRef}
            type="button"
            onClick={() => setMobileHeaderMenuOpen(false)}
            aria-label="بستن فرمان‌های بیشتر"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <div className="mobile-topbar-menu-grid header-overflow-grid">
          <button
            className="overflow-mobile-only"
            type="button"
            data-command-id="file.open"
            onClick={() => {
              setMobileHeaderMenuOpen(false);
              executeCommand("file.open", undefined, "menu");
            }}
          >
            <Upload size={20} aria-hidden="true" />
            <span>
              <strong>بازکردن فایل</strong>
              <small>از همین دستگاه</small>
            </span>
          </button>
          <button
            className="overflow-mobile-only"
            type="button"
            data-command-id="file.new"
            disabled={saveState === "saving"}
            onClick={() => {
              setMobileHeaderMenuOpen(false);
              executeCommand("file.new", undefined, "menu");
            }}
          >
            <FilePlus2 size={20} aria-hidden="true" />
            <span>
              <strong>سند تازه</strong>
              <small>شروع یک نوشته</small>
            </span>
          </button>
          <button
            className="overflow-mobile-only"
            type="button"
            data-command-id="view.reading"
            onClick={() => {
              setMobileHeaderMenuOpen(false);
              executeCommand("view.reading", undefined, "menu");
            }}
          >
            <BookOpen size={20} aria-hidden="true" />
            <span>
              <strong>حالت مطالعه</strong>
              <small>خواندن بدون مزاحمت</small>
            </span>
          </button>
          <button
            className="overflow-mobile-only"
            type="button"
            data-command-id="file.save"
            disabled={saveState === "saving"}
            onClick={() => {
              setMobileHeaderMenuOpen(false);
              executeCommand("file.save", undefined, "menu");
            }}
          >
            <Save size={20} aria-hidden="true" />
            <span>
              <strong>
                {effectiveSaveState === "dirty"
                  ? "ذخیرهٔ تغییرات"
                  : "ذخیرهٔ سند"}
              </strong>
              <small>
                {effectiveSaveState === "dirty"
                  ? "تغییرات هنوز ذخیره نشده‌اند"
                  : "ساخت نسخهٔ جدید"}
              </small>
            </span>
          </button>
          <button
            className="overflow-sidebar-drawer-only"
            type="button"
            data-command-id="view.sidebar"
            aria-expanded={libraryOpen}
            aria-controls="library-panel"
            onClick={() => {
              libraryReturnFocusRef.current = mobileHeaderMenuButtonRef.current;
              setMobileHeaderMenuOpen(false);
              executeCommand("view.sidebar", undefined, "menu");
            }}
          >
            <Library size={20} aria-hidden="true" />
            <span>
              <strong>
                {libraryOpen ? "بستن نوار کناری" : "بازکردن نوار کناری"}
              </strong>
              <small>فایل‌ها، جست‌وجو، سنجاق‌ها و فهرست سند</small>
            </span>
          </button>
          <button
            ref={desktopHeaderMenuFirstItemRef}
            data-overflow-action="commands"
            data-command-id="view.commandPalette"
            type="button"
            role={isCompactLayout ? undefined : "menuitem"}
            aria-label="فرمان‌های راوی"
            aria-keyshortcuts={commandAriaKeyShortcuts(
              "view.commandPalette",
              commandEnvironment,
            )}
            onClick={() => {
              setMobileHeaderMenuOpen(false);
              executeCommand("view.commandPalette", undefined, "menu");
            }}
          >
            <Command size={20} aria-hidden="true" />
            <span>
              <strong>فرمان‌های راوی</strong>
              <small>جست‌وجو و اجرای همهٔ کارها</small>
            </span>
            <kbd
              className="header-overflow-shortcut"
              dir="ltr"
              aria-hidden="true"
            >
              {commandShortcutLabel("view.commandPalette", commandEnvironment)}
            </kbd>
          </button>
          <button
            data-overflow-action="shortcuts"
            data-command-id="help.shortcuts"
            type="button"
            role={isCompactLayout ? undefined : "menuitem"}
            aria-label="میان‌برهای صفحه‌کلید"
            aria-haspopup="dialog"
            aria-expanded={shortcutHelpOpen}
            aria-keyshortcuts={commandAriaKeyShortcuts(
              "help.shortcuts",
              commandEnvironment,
            )}
            onClick={() => {
              setMobileHeaderMenuOpen(false);
              executeCommand("help.shortcuts", undefined, "menu");
            }}
          >
            <Keyboard size={20} aria-hidden="true" />
            <span>
              <strong>میان‌برهای صفحه‌کلید</strong>
              <small>فهرست کلیدهای سریع راوی</small>
            </span>
            <kbd
              className="header-overflow-shortcut"
              dir="ltr"
              aria-hidden="true"
            >
              {commandShortcutLabel("help.shortcuts", commandEnvironment)}
            </kbd>
          </button>
          <button
            data-overflow-action="shortcut-settings"
            type="button"
            role={isCompactLayout ? undefined : "menuitem"}
            aria-label="تنظیمات"
            aria-haspopup="dialog"
            aria-expanded={shortcutSettingsOpen}
            onClick={() => {
              const returnTarget = mobileHeaderMenuButtonRef.current;
              setMobileHeaderMenuOpen(false);
              openShortcutSettings(returnTarget);
            }}
          >
            <Settings2 size={20} aria-hidden="true" />
            <span>
              <strong>تنظیمات</strong>
              <small>ظاهر، مطالعه، ویرایش و داده‌های محلی</small>
            </span>
          </button>
          <div
            className="header-overflow-divider"
            role={isCompactLayout ? undefined : "separator"}
          />
          <button
            className="topbar-action--export"
            data-overflow-action="export"
            data-command-id="file.export"
            type="button"
            role={isCompactLayout ? undefined : "menuitem"}
            aria-label="خروجی Word یا PDF"
            aria-keyshortcuts={commandAriaKeyShortcuts(
              "file.export",
              commandEnvironment,
            )}
            onClick={() => {
              setMobileHeaderMenuOpen(false);
              executeCommand("file.export", undefined, "menu");
            }}
          >
            <Download size={20} aria-hidden="true" />
            <span>
              <strong>خروجی Word یا PDF</strong>
              <small>نسخه‌ی آماده‌ی تحویل</small>
            </span>
            <kbd
              className="header-overflow-shortcut"
              dir="ltr"
              aria-hidden="true"
            >
              {commandShortcutLabel("file.export", commandEnvironment)}
            </kbd>
          </button>
          <button
            data-overflow-action="theme"
            data-command-id="view.theme"
            type="button"
            role={isCompactLayout ? undefined : "menuitem"}
            disabled={Boolean(themeTransition)}
            aria-label={
              themeMode === "light" ? "فعال‌کردن تم تاریک" : "فعال‌کردن تم روشن"
            }
            aria-pressed={isCompactLayout ? themeMode === "dark" : undefined}
            aria-keyshortcuts={commandAriaKeyShortcuts(
              "view.theme",
              commandEnvironment,
            )}
            onClick={() => {
              setMobileHeaderMenuOpen(false);
              executeCommand("view.theme", undefined, "menu");
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
            <kbd
              className="header-overflow-shortcut"
              dir="ltr"
              aria-hidden="true"
            >
              {commandShortcutLabel("view.theme", commandEnvironment)}
            </kbd>
          </button>
          <div
            className="header-overflow-divider"
            role={isCompactLayout ? undefined : "separator"}
          />
          <button
            data-overflow-action="support"
            data-command-id="help.support"
            type="button"
            role={isCompactLayout ? undefined : "menuitem"}
            aria-label="حمایت از راوی"
            onClick={() => {
              setMobileHeaderMenuOpen(false);
              executeCommand("help.support", undefined, "menu");
            }}
          >
            <Heart size={20} aria-hidden="true" />
            <span>
              <strong>حمایت از راوی</strong>
              <small>ادامهٔ توسعهٔ رایگان</small>
            </span>
          </button>
          <button
            data-overflow-action="about"
            data-command-id="help.about"
            type="button"
            role={isCompactLayout ? undefined : "menuitem"}
            aria-label="دربارهٔ راوی"
            onClick={() => {
              setMobileHeaderMenuOpen(false);
              executeCommand("help.about", undefined, "menu");
            }}
          >
            <Info size={20} aria-hidden="true" />
            <span>
              <strong>دربارهٔ راوی</strong>
              <small>نسخه و تغییرات</small>
            </span>
          </button>
        </div>
        <div className="header-overflow-document" aria-label="جزئیات سند فعال">
          <FileText size={16} aria-hidden="true" />
          <span dir="auto" title={fileName}>
            {fileName}
          </span>
          <small>
            نسخه {revision.toLocaleString("fa-IR")} ·{" "}
            {stats.words.toLocaleString("fa-IR")} واژه ·{" "}
            {stats.lines.toLocaleString("fa-IR")} خط
          </small>
        </div>
      </AccessibleModal>

      <DocumentCommandBar
        activeEditorMode={activeEditorMode}
        commandEnvironment={commandEnvironment}
        documentMenuButtonRef={documentMenuButtonRef}
        documentMenuOpen={documentMenuOpen}
        documentMenuRef={documentMenuRef}
        effectiveSaveState={effectiveSaveState}
        executeCommand={executeCommand}
        fileName={fileName}
        inert={
          Boolean(mermaidStudioSession || formulaStudioSession) ||
          aboutModalOpen ||
          supportModalOpen ||
          newDocumentModalOpen ||
          saveModalOpen ||
          Boolean(pendingDocumentClose) ||
          exportModalOpen ||
          shortcutHelpOpen ||
          shortcutSettingsOpen ||
          commandPaletteOpen ||
          (mobileHeaderMenuOpen && isCompactLayout) ||
          (libraryOpen && libraryIsModal)
        }
        isInitialWorkspace={isInitialWorkspace}
        liveEditEnabled={LIVE_EDIT_FEATURE_ENABLED}
        onSave={() => void saveCurrentFile()}
        readingMode={readingMode}
        saveErrorBannerVisible={saveErrorBannerVisible}
        saveIndicatorRef={saveIndicatorRef}
        saveState={saveState}
        selectEditorMode={selectEditorMode}
        setDocumentMenuOpen={setDocumentMenuOpen}
        setMobileEditorToolsExpanded={setMobileEditorToolsExpanded}
        wordCount={stats.words}
      />

      {error && (
        <div
          className="error-banner"
          role="alert"
          inert={
            Boolean(mermaidStudioSession || formulaStudioSession) ||
            aboutModalOpen ||
            supportModalOpen ||
            newDocumentModalOpen ||
            saveModalOpen ||
            Boolean(pendingDocumentClose) ||
            exportModalOpen ||
            shortcutHelpOpen ||
            shortcutSettingsOpen ||
            commandPaletteOpen ||
            (mobileHeaderMenuOpen && isCompactLayout) ||
            (libraryOpen && libraryIsModal)
              ? true
              : undefined
          }
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            aria-label="بستن خطا"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      )}

      <div
        className={`workspace-frame ${
          libraryOpen ? "library-is-open" : ""
        } ${sidebarResizing ? "sidebar-is-resizing" : ""} ${
          showDocumentTabBar ? "has-document-tabs" : ""
        }`}
        style={workspaceFrameStyle}
        inert={
          Boolean(mermaidStudioSession || formulaStudioSession) ||
          aboutModalOpen ||
          supportModalOpen ||
          newDocumentModalOpen ||
          saveModalOpen ||
          Boolean(pendingDocumentClose) ||
          exportModalOpen ||
          shortcutHelpOpen ||
          shortcutSettingsOpen ||
          commandPaletteOpen ||
          (mobileHeaderMenuOpen && isCompactLayout)
            ? true
            : undefined
        }
      >
        {showDocumentTabBar && (
          <DocumentTabs
            tabs={documentTabViews}
            activeTabId={activeDocumentTabId}
            newTabActive={newTabWorkspaceOpen || isInitialWorkspace}
            canReopenClosed={closedDocumentTabs.length > 0}
            onSelect={selectDocumentTab}
            onClose={closeDocumentTab}
            onTogglePin={toggleDocumentTabPinned}
            onCloseOthers={closeOtherDocumentTabs}
            onReopenClosed={reopenLastClosedDocumentTab}
            onNew={openNewTabWorkspace}
            onCloseNew={() => setNewTabWorkspaceOpen(false)}
          />
        )}
        <main
          id="raavi-document-stage"
          ref={workspaceRef}
          className={`workspace ${readingMode ? "workspace--reading" : ""} ${
            readingMode
              ? readingOutlineOpen
                ? "reading-outline-is-open"
                : "reading-outline-is-collapsed"
              : ""
          } ${
            !readingMode ? `pane-layout-is-${effectivePaneMode}` : ""
          } ${paneDragging ? "is-resizing-panes" : ""} ${
            mobileEditorToolsVisible ? "mobile-editor-tools-is-open" : ""
          } ${isInitialWorkspace ? "workspace-is-empty" : ""} ${
            newTabWorkspaceOpen ? "workspace-is-new-tab" : ""
          }`}
          data-workspace-screen={
            readingMode
              ? "reading"
              : newTabWorkspaceOpen
                ? "new-tab"
                : !isInitialWorkspace && activeEditorMode === "live"
                  ? "writing"
                  : !isInitialWorkspace &&
                      activeEditorMode === "proof" &&
                      splitWorkspaceActive
                    ? "split"
                    : !isInitialWorkspace && activeEditorMode === "source"
                      ? "code"
                      : undefined
          }
          style={workspacePaneStyle}
          data-pane-layout={effectivePaneMode}
          data-collapse-candidate={paneCollapseCandidate ?? undefined}
          inert={libraryOpen && libraryIsModal ? true : undefined}
          onDragEnter={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => {
            if (!event.dataTransfer.types.includes("Files")) return;
            event.preventDefault();
          }}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            ref={imageInputRef}
            className="visually-hidden"
            type="file"
            aria-hidden="true"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleImageInputChange}
            tabIndex={-1}
          />

          {saveErrorBannerVisible && (
            <div
              className="save-error-banner"
              role="alert"
              aria-atomic="true"
              data-save-error-banner="true"
            >
              <span className="save-error-banner__status" aria-hidden="true">
                <AlertTriangle size={18} />
              </span>
              <span className="save-error-banner__content">
                <strong id="save-error-title">
                  هماهنگ‌سازی فایل انجام نشد
                </strong>
                <span id="save-error-description">
                  فایل در دسترس نیست یا مجوز آن تغییر کرده است. مسیر را بررسی
                  کنید.
                </span>
              </span>
              <button
                className="save-error-banner__retry"
                type="button"
                data-command-id="file.save"
                onClick={() => {
                  setSaveErrorVisible(false);
                  void retryFailedSave().finally(() => {
                    requestAnimationFrame(() =>
                      saveIndicatorRef.current?.focus(),
                    );
                  });
                }}
              >
                تلاش دوباره
              </button>
              <button
                className="save-error-banner__dismiss"
                type="button"
                onClick={() => {
                  setSaveErrorVisible(false);
                  requestAnimationFrame(() =>
                    saveIndicatorRef.current?.focus(),
                  );
                }}
                aria-label="بستن پیام خطای ذخیره"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          )}

          {(isInitialWorkspace || newTabWorkspaceOpen) && (
            <NewTabWorkspace
              workspaceName={activeWorkspaceFolder?.rootName}
              workspacePath={activeWorkspaceFolder?.rootPath}
              busy={templateCreating || libraryState === "scanning"}
              recentFiles={launchRecentFiles}
              returningLaunch={returningLaunchActive}
              onChooseWorkspace={() => void connectLibrary()}
              onCreateCustom={openNewDocumentModal}
              onOpenRecent={(recent) => openRecentFile(recent)}
              onSelectTemplate={(template) =>
                void createDocumentFromTemplate(template)
              }
            />
          )}

          {isDragging && (
            <div className="drop-overlay" role="status">
              <div className="drop-seal">
                <Upload size={30} aria-hidden="true" />
              </div>
              <strong>فایل Markdown را همین‌جا رها کنید</strong>
              <span>فایل در مرورگر شما باز می‌شود</span>
            </div>
          )}

          <section
            ref={editorPaneRef}
            className={`work-pane editor-pane ${
              mobilePane !== "editor" ? "is-hidden-mobile" : ""
            } ${editorPaneCollapsed ? "is-pane-collapsed" : ""}`}
            data-pane-state={
              activeSplitPane === "editor" ? "active" : "default"
            }
            aria-label={
              splitWorkspaceActive ? "کد Markdown" : "ویرایشگر Markdown"
            }
            aria-hidden={editorPaneCollapsed || undefined}
            inert={editorPaneCollapsed ? true : undefined}
            onFocusCapture={() => setActiveSplitPane("editor")}
            onPointerDownCapture={() => setActiveSplitPane("editor")}
            onWheelCapture={() => setActiveSplitPane("editor")}
          >
            <div
              className="pane-header"
              data-pane-state={
                activeSplitPane === "editor" ? "active" : "default"
              }
            >
              <div className="pane-title">
                <span className="folio">برگ ۱</span>
                <strong>کد</strong>
                <span className="pane-icon-well" aria-hidden="true">
                  <Code2 size={18} />
                </span>
                <button
                  className="pane-visibility-toggle"
                  type="button"
                  onClick={() => collapseDesktopPane("preview")}
                  aria-label="تمام‌صفحه‌کردن کد"
                  title="نمای کد تمام‌صفحه"
                >
                  <PanelLeftOpen size={18} aria-hidden="true" />
                </button>
              </div>

              <div
                className="format-tools editor-primary-tools"
                role="toolbar"
                aria-label="ابزارهای اصلی ویرایش"
              >
                <button
                  type="button"
                  data-command-id="edit.heading"
                  className={
                    editorFormatting.block === "heading" ? "is-active" : ""
                  }
                  onClick={() => runEditorToolCommand("edit.heading")}
                  aria-label="تیتر"
                  aria-pressed={editorFormatting.block === "heading"}
                  title="تیتر بخش"
                >
                  <Heading1 size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  data-command-id="edit.bold"
                  data-mobile-editor-action="bold"
                  className={editorFormatting.bold ? "is-active" : ""}
                  onClick={() => runEditorToolCommand("edit.bold")}
                  aria-label="پررنگ"
                  aria-pressed={editorFormatting.bold}
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
                  data-command-id="edit.italic"
                  data-mobile-editor-action="italic"
                  className={editorFormatting.italic ? "is-active" : ""}
                  onClick={() => runEditorToolCommand("edit.italic")}
                  aria-label="مورب"
                  aria-pressed={editorFormatting.italic}
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
                  data-command-id="edit.link"
                  data-mobile-editor-action="link"
                  className={editorFormatting.link ? "is-active" : ""}
                  onClick={(event) =>
                    openEditorHelper("link", event.currentTarget)
                  }
                  aria-label="پیوند"
                  aria-pressed={editorFormatting.link}
                  aria-haspopup="dialog"
                  aria-expanded={editorHelper === "link"}
                  title="افزودن یا ویرایش پیوند"
                >
                  <Link2 size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  data-command-id="edit.list"
                  className={
                    editorFormatting.block === "bullet-list" ? "is-active" : ""
                  }
                  onClick={() => runEditorToolCommand("edit.list")}
                  aria-label="فهرست"
                  aria-pressed={editorFormatting.block === "bullet-list"}
                  title="فهرست بولت‌دار"
                >
                  <ListIcon size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  data-command-id="edit.task"
                  data-mobile-editor-action="task"
                  className={
                    editorFormatting.block === "task" ? "is-active" : ""
                  }
                  onClick={() => runEditorToolCommand("edit.task")}
                  aria-label="کار"
                  aria-pressed={editorFormatting.block === "task"}
                  title="فهرست کارها"
                >
                  <ListTodo size={16} aria-hidden="true" />
                </button>
                <button
                  ref={editorToolMenuButtonRef}
                  className="format-tool-overflow"
                  type="button"
                  data-mobile-editor-action="more"
                  onClick={() => {
                    setEditorBlockMenu(null);
                    setEditorHelper(null);
                    setEditorToolMenuOpen((current) => !current);
                    requestAnimationFrame(() =>
                      editorToolMenuRef.current
                        ?.querySelector<HTMLButtonElement>("button")
                        ?.focus(),
                    );
                  }}
                  aria-label="ابزارهای بیشتر"
                  aria-haspopup="menu"
                  aria-expanded={editorToolMenuOpen}
                  title="ابزارهای بیشتر"
                >
                  <Ellipsis size={18} aria-hidden="true" />
                </button>

                {editorToolMenuOpen && (
                  <div
                    ref={editorToolMenuRef}
                    className="editor-tool-menu"
                    role="menu"
                    aria-label="ابزارهای بیشتر ویرایش"
                  >
                    <section aria-labelledby="editor-tools-basic">
                      <h3 id="editor-tools-basic">پایه</h3>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runEditorToolCommand("edit.heading")}
                      >
                        <Heading1 size={16} aria-hidden="true" />
                        <span>تیتر بخش</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runEditorToolCommand("edit.list")}
                      >
                        <ListIcon size={16} aria-hidden="true" />
                        <span>فهرست بولت‌دار</span>
                      </button>
                    </section>
                    <section aria-labelledby="editor-tools-structure">
                      <h3 id="editor-tools-structure">ساختار</h3>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runEditorToolCommand("edit.orderedList")}
                      >
                        <ListOrdered size={16} aria-hidden="true" />
                        <span>فهرست شماره‌ای</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runEditorToolCommand("edit.quote")}
                      >
                        <Quote size={16} aria-hidden="true" />
                        <span>نقل‌قول</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runEditorToolCommand("edit.code")}
                      >
                        <Code2 size={16} aria-hidden="true" />
                        <span>کد درون‌خطی</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runEditorToolCommand("edit.codeBlock")}
                      >
                        <Braces size={16} aria-hidden="true" />
                        <span>قطعه‌کد</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runEditorToolCommand("edit.callout")}
                      >
                        <MessageSquareText size={16} aria-hidden="true" />
                        <span>یادداشت برجسته</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(event) =>
                          openEditorHelper("table", event.currentTarget)
                        }
                      >
                        <Table2 size={16} aria-hidden="true" />
                        <span>جدول</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={(event) =>
                          openEditorHelper("image", event.currentTarget)
                        }
                      >
                        <ImagePlus size={16} aria-hidden="true" />
                        <span>تصویر</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runEditorToolCommand("diagram.mermaid")}
                      >
                        <Network size={16} aria-hidden="true" />
                        <span>نمودار Mermaid</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setEditorToolMenuOpen(false);
                          openFormulaStudio();
                        }}
                      >
                        <Braces size={16} aria-hidden="true" />
                        <span>استودیو فرمول</span>
                      </button>
                    </section>
                    <section aria-labelledby="editor-tools-edit">
                      <h3 id="editor-tools-edit">ویرایش</h3>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runEditorToolCommand("edit.undo")}
                      >
                        <Undo2 size={16} aria-hidden="true" />
                        <span>واگرد</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runEditorToolCommand("edit.redo")}
                      >
                        <Redo2 size={16} aria-hidden="true" />
                        <span>ازنو</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runEditorToolCommand("edit.find")}
                      >
                        <Search size={16} aria-hidden="true" />
                        <span>جست‌وجو و جایگزینی</span>
                      </button>
                    </section>
                    <section aria-labelledby="editor-tools-view">
                      <h3 id="editor-tools-view">نما</h3>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => runEditorToolCommand("view.outline")}
                      >
                        <ListTree size={16} aria-hidden="true" />
                        <span>ساختار سند</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() =>
                          runEditorToolCommand("edit.reviewPersian")
                        }
                      >
                        <Wand2 size={16} aria-hidden="true" />
                        <span>بازبینی فارسی</span>
                        {persianReviewIssues.length > 0 && (
                          <small>
                            {persianReviewIssues.length.toLocaleString("fa-IR")}
                          </small>
                        )}
                      </button>
                    </section>
                  </div>
                )}
              </div>
            </div>

            <div className="editor-surface">
              {!readingMode && (
                <Suspense
                  fallback={
                    <div
                      className="editor-loading"
                      role="status"
                      aria-live="polite"
                    >
                      ویرایشگر در حال آماده‌شدن است…
                    </div>
                  }
                >
                  <MarkdownCodeEditor
                    id="markdown-editor"
                    ref={editorRef}
                    commandPlatform={commandEnvironment.platform}
                    value={content}
                    mode={activeEditorMode === "live" ? "live" : "source"}
                    contextualHintsVisible={
                      codeViewPreferences.contextualHintsVisible
                    }
                    lineDirection={codeViewPreferences.lineDirection}
                    writingBlockGutter={
                      !readingMode &&
                      !isInitialWorkspace &&
                      activeEditorMode === "live"
                    }
                    writingBlockMenuOpen={Boolean(editorBlockMenu)}
                    livePreviewEnabled={LIVE_EDIT_FEATURE_ENABLED}
                    onLivePreviewFailure={handleLivePreviewFailure}
                    onOpenMermaidStudio={openEditorMermaidBlock}
                    onOpenFormulaStudio={openEditorFormulaBlock}
                    onOpenAiForBlock={(block) => openAiForBlock(block, "main")}
                    resolveLiveImage={resolveEditorLiveImage}
                    onChange={handleMarkdownEditorChange}
                    onScroll={() => {
                      setEditorSelectionMenuPosition(null);
                      setEditorBlockMenu(null);
                      handleSyncedScroll("editor");
                    }}
                    onSelectionChange={captureEditorSelection}
                    onContextChange={setEditorFormatting}
                    onBlockMenu={openEditorBlockMenu}
                    transformPastedText={normalizePersianMarkdown}
                    ariaDescribedBy="editor-hint editor-copy-contract"
                  />
                </Suspense>
              )}

              {!readingMode &&
                activeEditorMode === "source" &&
                codeViewPreferences.toolbarVisible && (
                  <CodeViewToolbar
                    context={editorFormatting}
                    lineDirection={codeViewPreferences.lineDirection}
                    onLineDirectionChange={(lineDirection) =>
                      setCodeViewPreferences((current) => ({
                        ...current,
                        lineDirection,
                      }))
                    }
                    onOpenTable={(trigger) =>
                      openEditorHelper("table", trigger)
                    }
                    onCommand={runEditorToolCommand}
                    onOpenCommandPalette={() =>
                      executeCommand("view.commandPalette")
                    }
                  />
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
                            <span className="review-issue-count">
                              {issue.count}
                            </span>
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
            {!readingMode &&
              !isInitialWorkspace &&
              activeEditorMode === "live" && (
                <div
                  className={`document-status-bar ${editorSelectionStats ? "is-selection" : "is-document"}`}
                  role="status"
                  aria-label={
                    editorSelectionStats ? "آمار متن انتخاب‌شده" : "آمار سند"
                  }
                  data-view={editorSelectionStats ? "selection" : "document"}
                >
                  {editorSelectionStats ? (
                    <>
                      {editorSelectionStats.words.toLocaleString("fa-IR")} واژهٔ
                      انتخاب‌شده ·{" "}
                      {editorSelectionStats.characters.toLocaleString("fa-IR")}{" "}
                      نویسه
                    </>
                  ) : (
                    <>
                      {stats.words.toLocaleString("fa-IR")} واژه ·{" "}
                      {stats.lines.toLocaleString("fa-IR")} خط
                    </>
                  )}
                </div>
              )}
            {editorBlockMenu && (
              <div
                ref={editorBlockMenuRef}
                className={`editor-block-menu is-${editorBlockMenu.source}`}
                role="menu"
                aria-label="نوع بلوک"
                style={{ left: editorBlockMenu.x, top: editorBlockMenu.y }}
                onKeyDown={handleEditorBlockMenuKeyDown}
              >
                <div className="editor-context-menu-heading">
                  <span>
                    {editorBlockMenu.intent === "insert"
                      ? "درج بلوک"
                      : "نوع بلوک"}
                  </span>
                  {editorBlockMenu.source === "slash" && (
                    <small dir="ltr">/{editorBlockMenu.query}</small>
                  )}
                </div>
                <div className="editor-block-menu-options">
                  {editorBlockMenuItems.map((item, index) => {
                    const Icon = EDITOR_BLOCK_TYPE_ICONS[item.type];
                    const showDivider =
                      index > 0 &&
                      editorBlockMenuItems[index - 1]?.group !== item.group;
                    return [
                      showDivider ? (
                        <div
                          key={`${item.type}-divider`}
                          className="editor-block-menu-divider"
                          role="separator"
                        />
                      ) : null,
                      <button
                        key={item.type}
                        type="button"
                        role="menuitemradio"
                        data-block-type={item.type}
                        aria-checked={
                          editorBlockMenu.intent === "convert" &&
                          isEditorBlockTypeCurrent(item.type)
                        }
                        onClick={() => chooseEditorBlockMenuItem(item)}
                      >
                        <Icon size={18} aria-hidden="true" />
                        <span>{item.title}</span>
                        <small dir="ltr">{item.alias}</small>
                      </button>,
                    ];
                  })}
                  {!editorBlockMenuItems.length && (
                    <p className="editor-block-menu-empty" role="status">
                      نوع بلاکی پیدا نشد
                    </p>
                  )}
                </div>
              </div>
            )}

            {editorHelper && (
              <div
                ref={editorHelperRef}
                className="editor-helper-popover"
                role="dialog"
                aria-modal="false"
                aria-labelledby="editor-helper-title"
              >
                <div className="editor-helper-heading">
                  <div>
                    <small>درج سریع</small>
                    <strong id="editor-helper-title">
                      {editorHelper === "link"
                        ? "پیوند"
                        : editorHelper === "table"
                          ? "جدول"
                          : "تصویر"}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => closeEditorHelper()}
                    aria-label="بستن ابزار درج"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>

                {editorHelper === "link" && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      insertLinkFromHelper();
                    }}
                  >
                    <label htmlFor="editor-link-url">نشانی پیوند</label>
                    <input
                      id="editor-link-url"
                      data-helper-autofocus
                      dir="ltr"
                      inputMode="url"
                      value={editorLinkUrl}
                      onChange={(event) => setEditorLinkUrl(event.target.value)}
                      placeholder="https://example.com"
                    />
                    <p>متن انتخاب‌شده، عنوان پیوند می‌شود.</p>
                    <button
                      className="editor-helper-primary"
                      type="submit"
                      disabled={!editorLinkUrl.trim()}
                    >
                      درج پیوند
                    </button>
                  </form>
                )}

                {editorHelper === "table" && (
                  <TableSizePicker
                    rows={editorTableRows}
                    columns={editorTableColumns}
                    onChange={(rows, columns) => {
                      setEditorTableRows(rows);
                      setEditorTableColumns(columns);
                    }}
                    onConfirm={(rows, columns) => insertTable(rows, columns)}
                  />
                )}

                {editorHelper === "image" && (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      insertImageUrl();
                    }}
                  >
                    <label htmlFor="editor-image-url">نشانی تصویر</label>
                    <input
                      id="editor-image-url"
                      data-helper-autofocus
                      dir="ltr"
                      inputMode="url"
                      value={imageUrl}
                      onChange={(event) => setImageUrl(event.target.value)}
                      placeholder="https://example.com/image.jpg"
                    />
                    {imageInsertError && (
                      <p className="editor-helper-error" role="alert">
                        {imageInsertError}
                      </p>
                    )}
                    <div className="editor-helper-actions">
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                      >
                        <Upload size={15} aria-hidden="true" />
                        انتخاب فایل
                      </button>
                      <button
                        className="editor-helper-primary"
                        type="submit"
                        disabled={!imageUrl.trim()}
                      >
                        درج نشانی
                      </button>
                    </div>
                  </form>
                )}
              </div>
            )}

            {editorSelectionMenuPosition && (
              <div
                ref={editorSelectionMenuRef}
                className={`selection-mini-menu editor-selection-mini-menu is-${editorSelectionMenuPosition.placement}`}
                role="toolbar"
                aria-label="قالب‌بندی متن انتخاب‌شده"
                aria-orientation="horizontal"
                aria-keyshortcuts={commandAriaKeyShortcuts(
                  "focus.selectionToolbar",
                  commandEnvironment,
                )}
                style={
                  {
                    left: editorSelectionMenuPosition.x,
                    top: editorSelectionMenuPosition.y,
                  } as React.CSSProperties
                }
                onPointerDown={(event) => {
                  event.preventDefault();
                }}
                onKeyDown={handleEditorSelectionToolbarKeyDown}
              >
                {EDITOR_SELECTION_COMMANDS.map((item, index) => {
                  const Icon = item.icon;
                  const showSeparator =
                    index > 0 &&
                    EDITOR_SELECTION_COMMANDS[index - 1]?.group !== item.group;
                  return [
                    showSeparator ? (
                      <span
                        key={`${item.id}-separator`}
                        className="editor-selection-separator"
                        role="separator"
                        aria-orientation="vertical"
                      />
                    ) : null,
                    <button
                      key={item.id}
                      ref={(node) => {
                        editorSelectionActionRefs.current[index] = node;
                        if (item.id === "annotation.comment") {
                          commentButtonRef.current = node;
                        }
                      }}
                      className="editor-mini-action"
                      type="button"
                      tabIndex={index === editorSelectionActionIndex ? 0 : -1}
                      data-command-id={item.id}
                      onClick={() => executeCommand(item.id)}
                      onFocus={() => setEditorSelectionActionIndex(index)}
                      aria-label={item.label}
                      aria-keyshortcuts={commandAriaKeyShortcuts(
                        item.id,
                        commandEnvironment,
                      )}
                      title={commandTitle(item.id, commandEnvironment)}
                    >
                      <Icon size={17} aria-hidden="true" />
                      <span className="visually-hidden">{item.label}</span>
                    </button>,
                  ];
                })}
                <span
                  className="editor-selection-separator"
                  role="separator"
                  aria-orientation="vertical"
                />
                <button
                  ref={(node) => {
                    editorSelectionActionRefs.current[
                      EDITOR_SELECTION_COMMANDS.length
                    ] = node;
                  }}
                  className="magic-wand-trigger editor-mini-action editor-selection-ai-trigger"
                  type="button"
                  tabIndex={
                    editorSelectionActionIndex ===
                    EDITOR_SELECTION_COMMANDS.length
                      ? 0
                      : -1
                  }
                  onClick={openAiForSelection}
                  onFocus={() =>
                    setEditorSelectionActionIndex(
                      EDITOR_SELECTION_COMMANDS.length,
                    )
                  }
                  aria-label="گفت‌وگو دربارهٔ متن انتخاب‌شده"
                  title="راوی هوشمند"
                >
                  <MagicWandIcon size={17} />
                </button>
              </div>
            )}
            <div className="visually-hidden">
              <span id="editor-hint">ویرایشگر Markdown با جهت هوشمند سطر.</span>
              <span id="editor-copy-contract">
                کپی در ویرایشگر همیشه Markdown قابل‌حمل را برمی‌دارد؛ برای کپی
                متن رندرشده، متن را در پیش‌نمایش انتخاب و دکمهٔ کپی را بزنید.
              </span>
            </div>
          </section>

          <div
            className={`registration-spine ${
              scrollSyncEnabled && desktopPaneMode === "split"
                ? "is-scroll-synced"
                : ""
            } ${desktopPaneMode !== "split" ? "has-collapsed-pane" : ""} ${
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
                aria-label="تغییر اندازهٔ کد و نوشتن"
                aria-orientation="vertical"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(100 - previewPanePercent)}
                aria-valuetext={`کد ${Math.round(
                  100 - previewPanePercent,
                ).toLocaleString("fa-IR")} درصد، نوشتن ${Math.round(
                  previewPanePercent,
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
                <Link2 size={18} aria-hidden="true" />
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
            data-pane-state={
              activeSplitPane === "preview" ? "active" : "default"
            }
            aria-label={
              splitWorkspaceActive ? "نوشتن بلاکی" : "پیش‌نمایش Markdown"
            }
            aria-hidden={previewPaneCollapsed || undefined}
            inert={previewPaneCollapsed ? true : undefined}
            onFocusCapture={() => setActiveSplitPane("preview")}
            onPointerDownCapture={() => setActiveSplitPane("preview")}
            onWheelCapture={() => setActiveSplitPane("preview")}
          >
            <div
              className="pane-header"
              data-pane-state={
                activeSplitPane === "preview" ? "active" : "default"
              }
            >
              <div className="pane-title">
                <span className="folio">برگ ۱</span>
                <strong>نوشتن</strong>
                <span className="pane-icon-well" aria-hidden="true">
                  <PencilLine size={18} />
                </span>
                <button
                  className="pane-visibility-toggle"
                  type="button"
                  onClick={() => collapseDesktopPane("editor")}
                  aria-label="تمام‌صفحه‌کردن نوشتن"
                  title="نمای نوشتن تمام‌صفحه"
                >
                  <PanelLeftOpen size={18} aria-hidden="true" />
                </button>
              </div>

              <div className="preview-header-actions">
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

            {splitWorkspaceActive && !readingMode ? (
              <div className="split-writing-surface">
                <Suspense
                  fallback={
                    <div
                      className="editor-loading"
                      role="status"
                      aria-live="polite"
                    >
                      بخش نوشتن در حال آماده‌شدن است…
                    </div>
                  }
                >
                  <MarkdownCodeEditor
                    id="writing-editor"
                    ref={writingEditorRef}
                    className="split-writing-editor"
                    commandPlatform={commandEnvironment.platform}
                    value={content}
                    mode="live"
                    contextualHintsVisible={
                      codeViewPreferences.contextualHintsVisible
                    }
                    writingBlockGutter
                    writingBlockMenuOpen={Boolean(editorBlockMenu)}
                    livePreviewEnabled={LIVE_EDIT_FEATURE_ENABLED}
                    onLivePreviewFailure={handleLivePreviewFailure}
                    onOpenMermaidStudio={openEditorMermaidBlock}
                    onOpenFormulaStudio={openEditorFormulaBlock}
                    onOpenAiForBlock={(block) =>
                      openAiForBlock(block, "writing")
                    }
                    resolveLiveImage={resolveEditorLiveImage}
                    onChange={handleMarkdownEditorChange}
                    onScroll={() => {
                      setEditorSelectionMenuPosition(null);
                      setEditorBlockMenu(null);
                      handleSyncedScroll("preview");
                    }}
                    onSelectionChange={() => setActiveSplitPane("preview")}
                    onContextChange={setEditorFormatting}
                    onBlockMenu={openEditorBlockMenu}
                    transformPastedText={normalizePersianMarkdown}
                    ariaDescribedBy="editor-hint editor-copy-contract"
                  />
                </Suspense>
              </div>
            ) : (
              <>
                {composerKind && selectionDraft && !annotationComposerFloats
                  ? renderAnnotationComposer()
                  : null}

                <div className="preview-stage">
                  <div
                    ref={previewScrollRef}
                    className="preview-scroll"
                    onScroll={() => handleSyncedScroll("preview")}
                    style={
                      {
                        "--reader-size": `${readerSize}px`,
                      } as React.CSSProperties
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
                        ? `${selectionDraft.quote.length.toLocaleString("fa-IR")} نویسه انتخاب شد؛ ابزارهای هایلایت و نظر در دسترس‌اند.`
                        : ""}
                    </div>
                    {selectionDraft &&
                      selectionMenuPosition &&
                      !composerKind && (
                        <ReadingSelectionMenu
                          ref={selectionMenuRef}
                          className={`selection-mini-menu is-${selectionMenuPosition.placement}`}
                          style={
                            {
                              left: selectionMenuPosition.x,
                              top: selectionMenuPosition.y,
                            } as React.CSSProperties
                          }
                          onHighlight={() => addAnnotation("highlight")}
                          onComment={() =>
                            openAnnotationComposer(
                              "comment",
                              commentButtonRef.current,
                            )
                          }
                          commentButtonRef={commentButtonRef}
                          highlightKeyShortcuts={commandAriaKeyShortcuts(
                            "annotation.highlight",
                            commandEnvironment,
                          )}
                          commentKeyShortcuts={commandAriaKeyShortcuts(
                            "annotation.comment",
                            commandEnvironment,
                          )}
                          highlightTitle={commandTitle(
                            "annotation.highlight",
                            commandEnvironment,
                          )}
                          commentTitle={commandTitle(
                            "annotation.comment",
                            commandEnvironment,
                          )}
                        />
                      )}
                    {content.trim() ? (
                      <>
                        <article
                          ref={previewArticleRef}
                          className={`markdown-body ${
                            hoveredAnnotation ? "has-annotation-hover" : ""
                          }`}
                          data-raavi-frontmatter={
                            previewHasFrontmatter ? "" : undefined
                          }
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
                          {readingMode && (
                            <p className="reading-document-kicker">
                              {readingDocumentKicker}
                            </p>
                          )}
                          {renderedMarkdownPreview}
                          {progressivePreview && !pdfExportActive && (
                            <div
                              ref={progressiveRenderSentinelRef}
                              className="progressive-render-status"
                              role="status"
                              aria-live="polite"
                            >
                              {renderedPreviewChunkCount <
                              previewMarkdownChunks.length
                                ? `در حال آماده‌سازی ادامهٔ سند؛ ${renderedPreviewChunkCount.toLocaleString("fa-IR")} از ${previewMarkdownChunks.length.toLocaleString("fa-IR")} بخش`
                                : "تمام سند آماده است"}
                            </div>
                          )}
                        </article>
                        {readingMode && (
                          <div
                            className="reading-document-status"
                            role="status"
                            aria-label="آمار سند"
                          >
                            {stats.words.toLocaleString("fa-IR")} واژه ·{" "}
                            {stats.lines.toLocaleString("fa-IR")} خط
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="empty-preview">
                        <span className="empty-sheet" aria-hidden="true">
                          <FileText size={34} />
                        </span>
                        <strong>این برگ هنوز خالی است</strong>
                        <p>
                          در بخش ویرایش بنویسید یا یک فایل Markdown باز کنید.
                        </p>
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
                    هایلایت‌ها و نظرها در همین فایل Markdown قابل‌حمل می‌مانند.
                  </span>
                </div>
              </>
            )}
          </section>
        </main>

        <Sidebar
          open={libraryOpen}
          modal={libraryIsModal}
          width={effectiveSidebarWidth}
          persistentRailWhenCollapsed={readingMode && libraryIsModal}
          labelledBy="sidebar-pane-title"
          panelRef={libraryPanelRef}
          onClose={closeSidebarFromUser}
          onResizePointerDown={resizeSidebarFromPointer}
          onResizeKeyDown={resizeSidebarFromKeyboard}
          rail={
            <SidebarRail
              items={sidebarRailItems}
              activeId={sidebarDestination}
              open={libraryOpen}
              onItemSelect={(item) =>
                item.id === "ai"
                  ? openAiForDocument()
                  : openSidebarView(item.view, item.id as SidebarDestination)
              }
            />
          }
        >
          <SidebarPaneHeader
            titleId="sidebar-pane-title"
            title={sidebarDestinationTitles[sidebarDestination]}
            actions={
              readingMode ? (
                sidebarView === "search" ? (
                  <button
                    className="reading-sidebar-view-action is-active"
                    type="button"
                    onClick={() =>
                      readingDocumentSearchRef.current?.focus({
                        preventScroll: true,
                      })
                    }
                    aria-label="تمرکز روی جست‌وجوی متن"
                    aria-pressed="true"
                    title="جست‌وجو در متن"
                  >
                    <Search size={18} aria-hidden="true" />
                  </button>
                ) : sidebarView === "outline" ? (
                  <button
                    className={`reading-sidebar-view-action ${
                      readingOutlineSearchOpen ? "is-active" : ""
                    }`}
                    type="button"
                    onClick={toggleReadingOutlineSearch}
                    aria-label="جست‌وجو در فهرست سند"
                    aria-pressed={readingOutlineSearchOpen}
                    aria-controls="reading-document-outline-pane"
                    title="جست‌وجو در فهرست سند"
                  >
                    <Search size={18} aria-hidden="true" />
                  </button>
                ) : sidebarView === "annotations" &&
                  sidebarDestination === "highlights" ? (
                  <button
                    className={`reading-sidebar-view-action ${
                      readingHighlightSearchOpen ? "is-active" : ""
                    }`}
                    type="button"
                    onClick={toggleReadingHighlightSearch}
                    aria-label="جست‌وجو در هایلایت‌ها"
                    aria-pressed={readingHighlightSearchOpen}
                    aria-controls="reading-highlights-pane"
                    title="جست‌وجو در هایلایت‌ها"
                  >
                    <Search size={18} aria-hidden="true" />
                  </button>
                ) : sidebarView === "annotations" &&
                  sidebarDestination === "comments" ? (
                  <button
                    className={`reading-sidebar-view-action ${
                      readingCommentSearchOpen ? "is-active" : ""
                    }`}
                    type="button"
                    onClick={toggleReadingCommentSearch}
                    aria-label="جست‌وجو در نظرات"
                    aria-pressed={readingCommentSearchOpen}
                    aria-controls="reading-comments-pane"
                    title="جست‌وجو در نظرات"
                  >
                    <Search size={18} aria-hidden="true" />
                  </button>
                ) : null
              ) : sidebarView === "outline" ? (
                <button
                  className={readingOutlineSearchOpen ? "is-active" : undefined}
                  type="button"
                  onClick={toggleReadingOutlineSearch}
                  aria-label="جست‌وجو در فهرست سند"
                  aria-pressed={readingOutlineSearchOpen}
                  aria-controls="document-outline-pane"
                  title="جست‌وجو در فهرست سند"
                >
                  <Search size={18} aria-hidden="true" />
                </button>
              ) : sidebarView === "annotations" &&
                sidebarDestination === "highlights" ? (
                <button
                  className={
                    readingHighlightSearchOpen ? "is-active" : undefined
                  }
                  type="button"
                  onClick={toggleReadingHighlightSearch}
                  aria-label="جست‌وجو در هایلایت‌ها"
                  aria-pressed={readingHighlightSearchOpen}
                  aria-controls="highlights-panel"
                  title="جست‌وجو در هایلایت‌ها"
                >
                  <Search size={18} aria-hidden="true" />
                </button>
              ) : sidebarView === "annotations" &&
                sidebarDestination === "comments" ? (
                <button
                  className={readingCommentSearchOpen ? "is-active" : undefined}
                  type="button"
                  onClick={toggleReadingCommentSearch}
                  aria-label="جست‌وجو در نظرات"
                  aria-pressed={readingCommentSearchOpen}
                  aria-controls="comments-panel"
                  title="جست‌وجو در نظرات"
                >
                  <Search size={18} aria-hidden="true" />
                </button>
              ) : sidebarView === "annotations" &&
                sidebarDestination === "persian" ? (
                <button
                  type="button"
                  onClick={rescanPersianReview}
                  aria-label="بازبینی دوبارهٔ متن فارسی"
                  aria-controls="persian-corrections-panel"
                  title="بازبینی دوبارهٔ متن فارسی"
                >
                  <RefreshCw size={18} aria-hidden="true" />
                </button>
              ) : sidebarView === "versions" ? (
                <button
                  type="button"
                  onClick={() => void refreshVersions()}
                  disabled={
                    versionsRefreshing || Boolean(versionRestoreCandidate)
                  }
                  aria-label="به‌روزرسانی نسخه‌ها"
                  aria-controls="library-versions-panel"
                  aria-busy={versionsRefreshing || undefined}
                  title="به‌روزرسانی نسخه‌ها"
                >
                  <RefreshCw
                    className={versionsRefreshing ? "is-spinning" : undefined}
                    size={18}
                    aria-hidden="true"
                  />
                </button>
              ) : sidebarView === "history" ? (
                <button
                  ref={recentSearchButtonRef}
                  className={recentSearchOpen ? "is-active" : undefined}
                  type="button"
                  onClick={toggleRecentSearch}
                  aria-label="جست‌وجو در فایل‌های اخیر"
                  aria-controls="recent-files-panel"
                  aria-pressed={recentSearchOpen}
                  title="جست‌وجو در فایل‌های اخیر"
                >
                  <Search size={18} aria-hidden="true" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => openSidebarView("search", "library")}
                  aria-label="جست‌وجو در کتابخانه"
                  aria-controls="sidebar-pane-content"
                  aria-pressed={sidebarView === "search"}
                  title="جست‌وجو در کتابخانه"
                >
                  <Search size={18} aria-hidden="true" />
                </button>
              )
            }
            closeButtonRef={libraryCloseRef}
            onClose={closeSidebarFromUser}
          />

          <input
            ref={directoryInputRef}
            className="visually-hidden"
            type="file"
            aria-hidden="true"
            accept=".md,.markdown,text/markdown"
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
            id="sidebar-pane-content"
            className={`library-content is-sidebar-${sidebarView} ${
              isWebLibrary ? "is-web-library" : ""
            }`}
          >
            <Suspense fallback={<DeferredPanelFallback />}>
              {sidebarView === "ai" && aiContext && (
                <AiChatPanel
                  key={aiContext.sessionId}
                  context={aiContext}
                  connectionState={codexConnectionState}
                  onCheckConnection={async () => {
                    await checkCodexConnection();
                  }}
                  onStartLogin={startCodexLoginFlow}
                  onOpenInstallGuide={() => {
                    const url = "https://developers.openai.com/codex/cli/";
                    if (window.raaviDesktop?.openExternalUrl) {
                      void window.raaviDesktop.openExternalUrl(url);
                    } else {
                      window.open(url, "_blank", "noopener,noreferrer");
                    }
                  }}
                  onSend={runAiPrompt}
                  onCopy={async (value) => {
                    await navigator.clipboard.writeText(value);
                    showNotice("پیشنهاد کپی شد");
                  }}
                  onReplace={(value) => applyAiChange(value, "replace")}
                  onInsertAfter={(value) =>
                    applyAiChange(value, "insert-after")
                  }
                  onUndo={undoAiChange}
                  canUndo={Boolean(aiUndoRecord)}
                  onOpenVersions={() =>
                    openSidebarView("versions", "versions", "ensure")
                  }
                />
              )}
              {sidebarView === "annotations" &&
                (!readingMode && sidebarDestination === "persian" ? (
                  <PersianCorrectionsPanel
                    key={`persian-review-${activeDocumentTabId || documentDraftId}`}
                    issues={persianReviewRows}
                    reviewKey={activeDocumentTabId || documentDraftId}
                    panelRef={persianCorrectionsPanelRef}
                    documentContent={content}
                    connectionState={codexConnectionState}
                    onCheckConnection={checkCodexConnection}
                    onStartLogin={startCodexLoginFlow}
                    onOpenInstallGuide={() => {
                      const url = "https://developers.openai.com/codex/cli/";
                      if (window.raaviDesktop?.openExternalUrl) {
                        void window.raaviDesktop.openExternalUrl(url);
                      } else {
                        window.open(url, "_blank", "noopener,noreferrer");
                      }
                    }}
                    onReview={runPersianAiReview}
                    onRewrite={rewritePersianAiSuggestion}
                    onApplySuggestion={applyPersianAiReviewSuggestion}
                    onApplyAllSuggestions={
                      applyAllPersianAiReviewSuggestions
                    }
                    onFix={(issueId) => {
                      const issue = persianReviewRows.find(
                        (candidate) => candidate.id === issueId,
                      );
                      if (!issue || issue.count === 0) return;
                      fixPersianReviewIssue(issue, false);
                      requestAnimationFrame(() =>
                        persianCorrectionsPanelRef.current?.focus({
                          preventScroll: true,
                        }),
                      );
                    }}
                    onFixAll={() => {
                      cleanPersianMarkdown();
                      requestAnimationFrame(() =>
                        persianCorrectionsPanelRef.current?.focus({
                          preventScroll: true,
                        }),
                      );
                    }}
                  />
                ) : sidebarDestination === "highlights" ? (
                  <ReadingHighlightsPane
                    panelId={
                      readingMode
                        ? "reading-highlights-pane"
                        : "highlights-panel"
                    }
                    highlights={readingHighlights}
                    activeId={activeAnnotationId}
                    searchOpen={readingHighlightSearchOpen}
                    searchQuery={readingHighlightQuery}
                    searchInputRef={readingHighlightSearchRef}
                    panelRef={annotationPanelRef}
                    getLocation={(highlight) =>
                      readingAnnotationLocationLabel(
                        previewArticleRef.current,
                        highlight,
                      )
                    }
                    onSearchQueryChange={setReadingHighlightQuery}
                    onSearchClose={closeReadingHighlightSearch}
                    onActivate={focusAnnotation}
                    onDelete={removeAnnotation}
                    onDismiss={closeSidebarFromUser}
                  />
                ) : sidebarDestination === "comments" ? (
                  <ReadingCommentsPane
                    panelId={
                      readingMode ? "reading-comments-pane" : "comments-panel"
                    }
                    comments={readingComments}
                    activeId={activeAnnotationId}
                    reviewKey={activeDocumentTabId || documentDraftId}
                    documentContent={content}
                    connectionState={codexConnectionState}
                    searchOpen={readingCommentSearchOpen}
                    searchQuery={readingCommentQuery}
                    searchInputRef={readingCommentSearchRef}
                    panelRef={annotationPanelRef}
                    onSearchQueryChange={setReadingCommentQuery}
                    onSearchClose={closeReadingCommentSearch}
                    onActivate={focusAnnotation}
                    onSetActive={setActiveAnnotationId}
                    onBodyChange={updateAnnotationBody}
                    onDelete={removeAnnotation}
                    onDismiss={closeSidebarFromUser}
                    onCheckConnection={checkCodexConnection}
                    onStartLogin={startCodexLoginFlow}
                    onOpenInstallGuide={() => {
                      const url = "https://developers.openai.com/codex/cli/";
                      if (window.raaviDesktop?.openExternalUrl) {
                        void window.raaviDesktop.openExternalUrl(url);
                      } else {
                        window.open(url, "_blank", "noopener,noreferrer");
                      }
                    }}
                    onReview={runSmartAnnotationReview}
                    onAddSmartAnnotations={(items) =>
                      addSmartAnnotationsForDocument(
                        activeDocumentTabId || documentDraftId,
                        items,
                      )
                    }
                    onUpdateSmartAnnotation={(id, patch) =>
                      updateSmartAnnotationForDocument(
                        activeDocumentTabId || documentDraftId,
                        id,
                        patch,
                      )
                    }
                    onApplySmartAnnotation={applySmartAnnotation}
                    onRewriteSmartAnnotation={rewriteSmartAnnotation}
                  />
                ) : (
                  <section
                    ref={annotationPanelRef}
                    className="sidebar-annotations-view"
                    id="annotation-panel"
                    aria-labelledby="sidebar-pane-title"
                    tabIndex={-1}
                  >
                    <div className="sidebar-view-intro">
                      <span dir="auto" title={fileName}>
                        {fileName}
                      </span>
                      <small>
                        {annotations.length.toLocaleString("fa-IR")} مورد
                      </small>
                    </div>
                    <div
                      className="annotation-legend"
                      aria-label="آمار نشانه‌ها"
                    >
                      <span>
                        <Highlighter size={13} aria-hidden="true" />
                        {annotationCounts.highlight.toLocaleString("fa-IR")}
                      </span>
                      <span>
                        <MessageCircle size={13} aria-hidden="true" />
                        {annotationCounts.comment.toLocaleString("fa-IR")}
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
                          <MessageCircle size={28} aria-hidden="true" />
                          <strong>هنوز هایلایت یا نظری ندارید</strong>
                          <span>
                            متنی را در برگه انتخاب کنید تا اولین نشانه ساخته
                            شود.
                          </span>
                        </div>
                      )}
                    </div>
                  </section>
                ))}
              {sidebarView === "outline" &&
                (readingMode ? (
                  <ReadingDocumentOutlinePane
                    headings={documentEditorHeadings}
                    activeOffset={activeReadingHeadingOffset}
                    searchOpen={readingOutlineSearchOpen}
                    searchQuery={readingOutlineQuery}
                    searchInputRef={readingOutlineSearchRef}
                    onSearchQueryChange={setReadingOutlineQuery}
                    onSearchClose={closeReadingOutlineSearch}
                    onActivate={jumpToDocumentHeading}
                    onDismiss={closeSidebarFromUser}
                  />
                ) : (
                  <DocumentOutlinePane
                    headings={documentEditorHeadings}
                    activeOffset={activeEditorHeadingOffset}
                    searchOpen={readingOutlineSearchOpen}
                    searchQuery={readingOutlineQuery}
                    searchInputRef={readingOutlineSearchRef}
                    onSearchQueryChange={setReadingOutlineQuery}
                    onSearchClose={closeReadingOutlineSearch}
                    onActivate={jumpToDocumentHeading}
                    onDismiss={closeSidebarFromUser}
                    panelId="document-outline-pane"
                  />
                ))}
              {isWebLibrary &&
                (sidebarView === "files" || sidebarView === "search") &&
                libraryFiles.length === 0 && (
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
              {sidebarView === "history" && (
                <RecentFilesPanel
                  entries={recentPanelEntries}
                  query={recentQuery}
                  searchOpen={recentSearchOpen}
                  searchInputRef={recentSearchInputRef}
                  onQueryChange={setRecentQuery}
                  onSearchClose={closeRecentSearch}
                  onOpen={(entry) => {
                    const normalizedPath =
                      entry.path.toLocaleLowerCase("en-US");
                    const file = libraryFiles.find(
                      (candidate) =>
                        (
                          candidate.nativePath ?? candidate.path
                        ).toLocaleLowerCase("en-US") === normalizedPath,
                    );
                    if (file) {
                      void openLibraryFile(file);
                      return;
                    }
                    const recent = displayRecentFiles.find(
                      (candidate) =>
                        candidate.path.toLocaleLowerCase("en-US") ===
                        normalizedPath,
                    );
                    if (recent) void openRecentFile(recent);
                  }}
                />
              )}

              {sidebarView === "versions" && (
                <VersionsPanel
                  fileName={fileName}
                  versionCount={versions.length}
                  currentDirty={effectiveSaveState === "dirty"}
                  entries={versionPanelEntries}
                  loading={versionsRefreshing}
                  error={versionsRefreshError}
                  restoreCandidate={versionRestoreCandidate}
                  restorePending={versionRestoreSaving}
                  onRequestRestore={setVersionRestoreCandidate}
                  onCancelRestore={() => setVersionRestoreCandidate(null)}
                  onConfirmRestore={(entry) => {
                    const version = versions.find(
                      (candidate) =>
                        candidate.number === entry.number &&
                        candidate.savedAt === entry.savedAt,
                    );
                    if (version) void restoreVersion(version);
                  }}
                  onRetry={() => void refreshVersions()}
                />
              )}

              <div
                id="library-catalog-panel"
                role="region"
                aria-labelledby="sidebar-pane-title"
                tabIndex={0}
                hidden={sidebarView !== "files" && sidebarView !== "search"}
              >
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
                        <div
                          key={folder.rootId}
                          className="library-folder-chip"
                          title={folder.rootPath}
                        >
                          <Folder size={14} aria-hidden="true" />
                          <span dir="auto">{folder.rootName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {sidebarView === "files" && (
                  <div className="library-summary library-files-summary">
                    <span>
                      {visibleLibraryFiles.length.toLocaleString("fa-IR")} فایل
                      Markdown
                    </span>
                    {libraryState === "scanning" && (
                      <span className="library-loading">
                        <RefreshCw
                          className="is-spinning"
                          size={13}
                          aria-hidden="true"
                        />
                        در حال اسکن
                      </span>
                    )}
                  </div>
                )}

                {externalLibraryChange && (
                  <div
                    className={`library-external-change is-${externalLibraryChange.kind}`}
                    role="alert"
                  >
                    <div>
                      <RefreshCw size={16} aria-hidden="true" />
                      <p>{externalLibraryChange.message}</p>
                    </div>
                    <div className="library-external-actions">
                      {externalLibraryChange.file &&
                        effectiveSaveState !== "dirty" && (
                          <button
                            type="button"
                            onClick={() => {
                              const file = externalLibraryChange.file;
                              if (file) void openLibraryFile(file);
                            }}
                          >
                            بازخوانی نسخهٔ بیرونی
                          </button>
                        )}
                      {(externalLibraryChange.kind === "missing" ||
                        effectiveSaveState === "dirty") && (
                        <button
                          type="button"
                          onClick={() => openSaveFileModal(documentType)}
                        >
                          ذخیره با نام تازه
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setExternalLibraryChange(null)}
                      >
                        فعلاً نگه‌دار
                      </button>
                    </div>
                  </div>
                )}

                {readingMode && sidebarView === "search" ? (
                  <ReadingDocumentSearchPane
                    inputRef={readingDocumentSearchRef}
                    query={readingSearchQuery}
                    results={readingSearchResults}
                    activeIndex={activeReadingSearchIndex}
                    onQueryChange={setReadingSearchQuery}
                    onClear={() => {
                      setReadingSearchQuery("");
                      setActiveReadingSearchIndex(-1);
                    }}
                    onActivate={jumpToReadingSearchResult}
                    onDismiss={closeSidebarFromUser}
                  />
                ) : sidebarView === "search" ? (
                  <LibrarySearchPane
                    inputRef={librarySearchRef}
                    query={libraryQuery}
                    scope={librarySearchScope}
                    sort={librarySearchSort}
                    state={librarySearchPaneState}
                    progress={librarySearchProgress}
                    results={librarySearchResults}
                    filesByKey={searchSuggestionFiles}
                    activeKey={activeLibraryKey}
                    pinnedKeys={pinnedLibraryKeySet}
                    error={librarySearchError}
                    currentFolderAvailable={Boolean(activeLibraryFile)}
                    shortcutLabel={
                      commandTitle("file.quickOpen", commandEnvironment).split(
                        " — ",
                      )[1] ?? "Ctrl+P"
                    }
                    onQueryChange={setLibraryQuery}
                    onScopeChange={setLibrarySearchScope}
                    onSortChange={setLibrarySearchSort}
                    onClear={() => setLibraryQuery("")}
                    onOpenResult={(result) => void openSearchResult(result)}
                    onTogglePin={togglePinnedLibraryKey}
                  />
                ) : (
                  <div className="library-tree">
                    {visibleLibraryFiles.length || explorerRoots.length ? (
                      <FileExplorer
                        roots={explorerRoots}
                        files={explorerFiles}
                        activeKey={activeLibraryKey}
                        dirty={effectiveSaveState === "dirty"}
                        pinnedKeys={pinnedLibraryKeySet}
                        searchActive={false}
                        onOpenFile={(explorerFile) => {
                          const file = libraryFiles.find(
                            (candidate) => candidate.id === explorerFile.id,
                          );
                          if (file) void openLibraryFile(file);
                        }}
                        onTogglePin={(explorerFile) => {
                          const file = libraryFiles.find(
                            (candidate) => candidate.id === explorerFile.id,
                          );
                          if (file) togglePinnedLibraryFile(file);
                        }}
                        onAction={(entry) => {
                          setFileOperationError("");
                          setFileOperation({ entry, mode: "menu" });
                        }}
                      />
                    ) : (
                      <div className="library-empty">
                        <FolderOpen size={28} aria-hidden="true" />
                        <strong>
                          {libraryState === "scanning"
                            ? "در حال اسکن پوشه‌ها…"
                            : "هنوز پوشه‌ای در قفسه نیست"}
                        </strong>
                        <span>
                          یک پوشه اضافه کنید تا فایل‌های Markdown همیشه در
                          دسترس باشند.
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Suspense>
          </div>

          {sidebarView !== "history" &&
            sidebarView !== "versions" &&
            sidebarView !== "ai" &&
            sidebarDestination !== "persian" && (
              <div className="library-footer">
                {readingMode && sidebarView === "search" ? (
                  <span>محلی · فقط متن همین سند</span>
                ) : openingLibraryPath ? (
                  <span>در حال باز کردن فایل…</span>
                ) : (sidebarView === "files" || sidebarView === "search") &&
                  activeLibraryPath ? (
                  <span dir="auto" title={activeLibraryPath}>
                    {activeLibraryPath}
                  </span>
                ) : sidebarView === "outline" ? (
                  <span>محلی · فقط تیترهای همین سند</span>
                ) : sidebarView === "annotations" &&
                  (sidebarDestination === "highlights" ||
                    sidebarDestination === "comments") ? (
                  <span>Markdown · محلی و قابل‌حمل</span>
                ) : sidebarView === "annotations" ? (
                  <span>یادداشت‌ها فقط در همین سند محلی نگه‌داری می‌شوند.</span>
                ) : (
                  <span>برای بازکردن، روی نام فایل کلیک کنید.</span>
                )}
              </div>
            )}

          <div
            className="library-privacy"
            hidden={
              readingMode ||
              (sidebarView !== "files" && sidebarView !== "search")
            }
          >
            <ShieldCheck size={17} aria-hidden="true" />
            <span>فقط روی این دستگاه · فایل‌ها به اینترنت ارسال نمی‌شوند</span>
          </div>
        </Sidebar>
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
                <strong id="mermaid-studio-loading-title">
                  ساخت نمودار در حال آماده‌شدن است
                </strong>
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

      {formulaStudioSession && (
        <Suspense
          fallback={
            <AccessibleModal
              open
              isTopLayer={topLayer === "formula"}
              onClose={() => closeFormulaStudio(formulaStudioSession)}
              dialogRef={formulaLoadingModalRef}
              returnFocusRef={formulaReturnFocusRef}
              backdropClassName="formula-studio-backdrop"
              dialogClassName="mermaid-studio-loading"
              labelledBy="formula-studio-loading-title"
              describedBy="formula-studio-loading-description"
            >
              <Braces size={22} aria-hidden="true" />
              <div role="status" aria-live="polite">
                <strong id="formula-studio-loading-title">
                  بوم فرمول در حال آماده‌شدن است
                </strong>
                <span id="formula-studio-loading-description">
                  ابزارهای فرمول فقط هنگام نیاز بارگذاری می‌شوند.
                </span>
              </div>
            </AccessibleModal>
          }
        >
          <FormulaStudio
            key={formulaStudioSession.id}
            open
            isTopLayer={topLayer === "formula"}
            session={formulaStudioSession}
            fileName={fileName}
            onApply={applyFormulaStudio}
            onClose={closeFormulaStudio}
            returnFocusRef={formulaReturnFocusRef}
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
              returnFocusRef={aboutReturnFocusRef}
            />
          }
        >
          <AboutDialog
            open
            isTopLayer={topLayer === "about"}
            version={packageMetadata.version}
            returnFocusRef={aboutReturnFocusRef}
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
              returnFocusRef={supportReturnFocusRef}
            />
          }
        >
          <SupportDialog
            open
            isTopLayer={topLayer === "support"}
            returnFocusRef={supportReturnFocusRef}
            onClose={() => {
              setSupportModalOpen(false);
            }}
          />
        </Suspense>
      )}

      {exportModalOpen && (
        <Suspense
          fallback={
            <DeferredDialogFallback
              id="export"
              title="ابزار خروجی در حال آماده‌شدن است"
              isTopLayer={topLayer === "export"}
              onClose={closeExportDialog}
              returnFocusRef={exportReturnFocusRef}
            />
          }
        >
          <ExportDialog
            open
            isTopLayer={topLayer === "export"}
            returnFocusRef={exportReturnFocusRef}
            format={exportFormat}
            fileName={exportNameForFormat(fileName, exportFormat)}
            status={exportStatus}
            progress={exportProgress}
            progressLabel={exportProgressLabel}
            warnings={exportWarnings}
            reviewConfirmed={exportReviewConfirmed}
            error={exportError}
            resultPath={exportResultPath}
            canRevealResult={exportResultRevealable}
            directPdf={commandEnvironment.surface === "electron"}
            onFormatChange={changeExportFormat}
            onClose={closeExportDialog}
            onStart={() => void startExport()}
            onContinue={() => void commitPreparedExport()}
            onBack={backFromExportReview}
            onRevealResult={() => void revealExportResult()}
            onReviewConfirmationChange={setExportReviewConfirmed}
          />
        </Suspense>
      )}

      {externalLinkCandidate && (
        <Suspense
          fallback={
            <DeferredDialogFallback
              id="external-link"
              title="بررسی لینک در حال آماده‌شدن است"
              isTopLayer={topLayer === "externalLink"}
              onClose={() => setExternalLinkCandidate("")}
            />
          }
        >
          <ExternalLinkDialog
            open
            isTopLayer={topLayer === "externalLink"}
            candidate={externalLinkCandidate}
            dialogRef={externalLinkModalRef}
            confirmRef={externalLinkConfirmRef}
            onClose={() => setExternalLinkCandidate("")}
            onConfirm={(target) => {
              setExternalLinkCandidate("");
              void openExternalUrl(target);
            }}
          />
        </Suspense>
      )}

      {imageModalOpen && (
        <Suspense
          fallback={
            <DeferredDialogFallback
              id="image"
              title="ابزار تصویر در حال آماده‌شدن است"
              isTopLayer={topLayer === "image"}
              onClose={() => setImageModalOpen(false)}
              returnFocusRef={imageInsertButtonRef}
            />
          }
        >
          <ImageInsertDialog
            open
            isTopLayer={topLayer === "image"}
            sourceMode={imageSourceMode}
            url={imageUrl}
            error={imageInsertError}
            dialogRef={imageModalRef}
            closeRef={imageModalCloseRef}
            localPickerRef={imageLocalPickerRef}
            urlInputRef={imageUrlInputRef}
            returnFocusRef={imageInsertButtonRef}
            onClose={() => setImageModalOpen(false)}
            onSourceModeChange={(mode) => {
              setImageSourceMode(mode);
              setImageInsertError("");
            }}
            onUrlChange={setImageUrl}
            onChooseLocal={() => imageInputRef.current?.click()}
            onInsertUrl={insertImageUrl}
          />
        </Suspense>
      )}

      {quickOpenOpen && (
        <Suspense
          fallback={
            <DeferredDialogFallback
              id="quick-open"
              title="بازکردن سریع در حال آماده‌شدن است"
              isTopLayer={topLayer === "quickOpen"}
              onClose={() => setQuickOpenOpen(false)}
            />
          }
        >
          <AccessibleModal
            open
            isTopLayer={topLayer === "quickOpen"}
            onClose={() => setQuickOpenOpen(false)}
            dialogRef={quickOpenDialogRef}
            initialFocusRef={quickOpenInputRef}
            backdropClassName="quick-open-backdrop"
            dialogClassName="quick-open-dialog"
            labelledBy="quick-open-title"
          >
            <QuickOpen
              files={quickOpenFiles}
              activeKey={activeLibraryKey}
              inputRef={quickOpenInputRef}
              onOpen={(file) => void openQuickOpenFile(file)}
              onClose={() => setQuickOpenOpen(false)}
            />
          </AccessibleModal>
        </Suspense>
      )}

      {commandPaletteOpen && (
        <Suspense
          fallback={
            <DeferredDialogFallback
              id="command-palette"
              title="مرکز فرمان در حال آماده‌شدن است"
              isTopLayer={topLayer === "commandPalette"}
              onClose={() => setCommandPaletteOpen(false)}
              returnFocusRef={commandPaletteReturnFocusRef}
            />
          }
        >
          <AccessibleModal
            open
            isTopLayer={topLayer === "commandPalette"}
            onClose={() => setCommandPaletteOpen(false)}
            dialogRef={commandPaletteDialogRef}
            initialFocusRef={commandPaletteInputRef}
            returnFocusRef={commandPaletteReturnFocusRef}
            backdropClassName="command-palette-backdrop"
            dialogClassName="command-palette-dialog"
            labelledBy="command-palette-title"
          >
            <CommandPalette
              inputRef={commandPaletteInputRef}
              environment={commandEnvironment}
              usage={commandUsage}
              availability={(id) =>
                commandAvailability(id, undefined, "palette")
              }
              onExecute={(id) => {
                executeCommand(id, undefined, "palette");
              }}
              onClose={() => setCommandPaletteOpen(false)}
            />
          </AccessibleModal>
        </Suspense>
      )}

      {pendingDocumentClose && (
        <Suspense
          fallback={
            <DeferredDialogFallback
              id="close-document"
              title="تأیید بستن سند در حال آماده‌شدن است"
              isTopLayer={topLayer === "closeDocument"}
              onClose={() => setPendingDocumentClose(null)}
            />
          }
        >
          <CloseDocumentDialog
            open
            isTopLayer={topLayer === "closeDocument"}
            title={pendingDocumentClose.title}
            dirtyCount={pendingDocumentClose.dirtyCount}
            canSave={pendingDocumentClose.kind === "single"}
            dialogRef={closeDocumentDialogRef}
            cancelRef={closeDocumentCancelRef}
            onClose={() => setPendingDocumentClose(null)}
            onDiscard={() => {
              const request = pendingDocumentClose;
              setPendingDocumentClose(null);
              if (request.kind === "single") {
                closeDocumentTab(request.tabId, true);
              } else {
                closeOtherDocumentTabs(request.tabId, true);
              }
            }}
            onSaveAndClose={() => {
              setPendingDocumentClose(null);
              closeAfterSaveRequestedRef.current = true;
              void saveCurrentFile();
            }}
          />
        </Suspense>
      )}

      <LegacyAnnotationMigrationDialog
        open={legacyMigrationPromptOpen}
        onClose={() => setLegacyMigrationPromptOpen(false)}
        onConvert={() => {
          setLegacyMigrationPromptOpen(false);
          openSaveFileModal("markdown");
        }}
      />

      <HiddenAnnotationDataWarningDialog
        open={hiddenAnnotationWarningOpen}
        onClose={() => setHiddenAnnotationWarningOpen(false)}
        onRecover={() => {
          setHiddenAnnotationWarningOpen(false);
          openSidebarView("versions", "versions", "ensure");
        }}
      />

      {saveModalOpen && (
        <Suspense
          fallback={
            <DeferredDialogFallback
              id="save"
              title="ابزار ذخیره در حال آماده‌شدن است"
              isTopLayer={topLayer === "save"}
              onClose={() => {
                closeAfterSaveRequestedRef.current = false;
                setSaveModalOpen(false);
              }}
            />
          }
        >
          <SaveFileDialog
            open
            isTopLayer={topLayer === "save"}
            fileName={saveFileName}
            fileType={saveFileType}
            nextRevision={revision + 1}
            versions={versions}
            saving={saveState === "saving"}
            shortcut={commandAriaKeyShortcuts("file.save", commandEnvironment)}
            dialogRef={saveModalRef}
            fileNameRef={saveFileNameRef}
            closeRef={saveModalCloseRef}
            returnFocusRef={saveModalReturnFocusRef}
            onClose={() => {
              closeAfterSaveRequestedRef.current = false;
              setSaveModalOpen(false);
            }}
            onFileNameChange={setSaveFileName}
            onFileTypeChange={(type) => {
              setSaveFileType(type);
              setSaveFileName((current) => saveNameForType(current, type));
            }}
            onRestore={(number, savedAt) => {
              const version = versions.find(
                (candidate) =>
                  candidate.number === number && candidate.savedAt === savedAt,
              );
              if (version) void restoreVersion(version);
            }}
            onSubmit={() => void saveAsFile()}
          />
        </Suspense>
      )}

      {shortcutHelpOpen && (
        <Suspense
          fallback={
            <DeferredDialogFallback
              id="shortcuts"
              title="راهنمای میان‌برها در حال آماده‌شدن است"
              isTopLayer={topLayer === "shortcuts"}
              onClose={closeShortcutHelp}
              returnFocusRef={shortcutHelpReturnFocusRef}
            />
          }
        >
          <ShortcutHelpDialog
            open
            isTopLayer={topLayer === "shortcuts"}
            environment={commandEnvironment}
            onClose={closeShortcutHelp}
            onOpenSettings={() => openShortcutSettings(undefined, "shortcuts")}
            returnFocusRef={shortcutHelpReturnFocusRef}
          />
        </Suspense>
      )}

      {shortcutSettingsOpen && (
        <Suspense
          fallback={
            <DeferredDialogFallback
              id="shortcut-settings"
              title="تنظیمات میان‌برها در حال آماده‌شدن است"
              isTopLayer={topLayer === "settings"}
              onClose={closeShortcutSettings}
              returnFocusRef={shortcutSettingsReturnFocusRef}
            />
          }
        >
          <ShortcutSettingsDialog
            open
            isTopLayer={topLayer === "settings"}
            environment={commandEnvironment}
            codeViewPreferences={codeViewPreferences}
            onCodeViewPreferencesChange={setCodeViewPreferences}
            appearancePreferences={appearancePreferences}
            onAppearancePreferencesChange={commitAppearancePreferences}
            readingPreferences={readingPreferences}
            onReadingPreferencesChange={commitReadingPreferences}
            fileLibraryPreferences={fileLibraryPreferences}
            onFileLibraryPreferencesChange={setFileLibraryPreferences}
            privacyPreferences={privacyPreferences}
            onPrivacyPreferencesChange={(nextPreferences) => {
              if (nextPreferences.externalImagePolicy === "block") {
                setApprovedRemoteImages(new Set());
              }
              setPrivacyPreferences(nextPreferences);
            }}
            libraryFolders={libraryFolders.map((folder) => ({
              rootId: folder.rootId,
              rootName: folder.rootName,
              rootPath: folder.rootPath,
              sessionOnly: folder.rootId.startsWith("fallback:"),
              fileCount: libraryFiles.filter(
                (file) => file.rootId === folder.rootId,
              ).length,
            }))}
            libraryFileCount={libraryFiles.length}
            onConnectLibrary={connectLibrary}
            onRefreshLibrary={refreshLibrary}
            onDisconnectLibrary={disconnectLibraryFolder}
            onClearRecentFiles={clearRecentFilesFromSettings}
            onResetSettings={resetAllSettings}
            initialCategory={settingsInitialCategory}
            onClose={closeShortcutSettings}
            returnFocusRef={shortcutSettingsReturnFocusRef}
          />
        </Suspense>
      )}

      {aiApplyMotion && (
        <div
          className="ai-apply-motion"
          aria-hidden="true"
          style={{
            left: aiApplyMotion.left,
            top: aiApplyMotion.top,
            width: aiApplyMotion.width,
            height: aiApplyMotion.height,
          }}
        >
          <span className="ai-apply-motion__shimmer" />
          <span className="ai-apply-motion__wand">
            <MagicWandIcon size={24} />
          </span>
        </div>
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

      {(notice ||
        libraryUndo ||
        (closedTabRecoveryVisible && closedDocumentTabs[0])) && (
        <div
          className={`toast${
            !notice && !libraryUndo && closedDocumentTabs[0]
              ? " is-tab-recovery"
              : ""
          }`}
          role="status"
          aria-live="polite"
        >
          {!notice && !libraryUndo && closedDocumentTabs[0] ? (
            <History size={17} aria-hidden="true" />
          ) : (
            <Check size={17} aria-hidden="true" />
          )}
          <span>
            {notice ||
              (libraryUndo
                ? `«${libraryUndo.label}» حذف شد.`
                : `«${closedDocumentTabs[0]?.title}» بسته شد.`)}
          </span>
          {libraryUndo && (
            <button type="button" onClick={() => void undoLastLibraryDelete()}>
              بازگردانی
            </button>
          )}
          {!notice && !libraryUndo && closedDocumentTabs[0] && (
            <button type="button" onClick={reopenLastClosedDocumentTab}>
              بازگردانی
            </button>
          )}
        </div>
      )}

      {currentAnnotationUndos.length > 0 && (
        <div
          className="annotation-undo-stack"
          aria-label="عملیات حذف قابل واگرد"
        >
          {currentAnnotationUndos.map((record) => (
            <div
              className="annotation-undo-notice"
              role="status"
              aria-live="polite"
              key={record.id}
            >
              <Trash2 size={17} aria-hidden="true" />
              <span>{ANNOTATION_LABELS[record.annotation.kind]} حذف شد.</span>
              <span className="visually-hidden">
                «{record.annotation.quote}»
              </span>
              <button
                type="button"
                onClick={() => undoAnnotationDelete(record.id)}
              >
                واگرد
              </button>
            </div>
          ))}
        </div>
      )}

      {fileOperation && (
        <Suspense
          fallback={
            <DeferredDialogFallback
              id="file-operation"
              title="عملیات فایل در حال آماده‌شدن است"
              isTopLayer={topLayer === "fileOperation"}
              onClose={() => {
                if (fileOperationBusy) return;
                setFileOperation(null);
                setFileOperationError("");
              }}
            />
          }
        >
          <FileOperationDialog
            open
            entry={fileOperation.entry}
            initialMode={fileOperation.mode}
            folderOptions={explorerFolderOptions}
            busy={fileOperationBusy}
            error={fileOperationError}
            activeDirtyAffected={Boolean(
              entryTouchesActiveDocument(fileOperation.entry) &&
              effectiveSaveState === "dirty",
            )}
            isTopLayer={topLayer === "fileOperation"}
            onClose={() => {
              if (fileOperationBusy) return;
              setFileOperation(null);
              setFileOperationError("");
            }}
            onSubmit={(mode, value) => void submitFileOperation(mode, value)}
          />
        </Suspense>
      )}

      {readingResumeNotice &&
        readingResumeNotice.documentKey === currentDocumentKey && (
          <div
            className="reading-resume-notice"
            role="status"
            aria-live="polite"
          >
            <BookOpen size={17} aria-hidden="true" />
            <span>
              <strong>
                {readingResumeNotice.precision === "exact"
                  ? "از جای قبلی ادامه یافت"
                  : "نزدیک نشان قبلی بازیابی شد"}
              </strong>
              <small dir="auto">{readingResumeNotice.label}</small>
            </span>
            <div className="reading-resume-actions">
              {readingResumeNotice.precision === "exact" ? (
                <button type="button" onClick={startReadingAtBeginning}>
                  شروع سند
                </button>
              ) : (
                <button
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
                  تلاش دوباره
                </button>
              )}
              <button
                className="reading-resume-dismiss"
                type="button"
                onClick={() => setReadingResumeNotice(null)}
                aria-label="بستن پیام ادامه مطالعه"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
    </div>
  );
}
