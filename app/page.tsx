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
  Download,
  Ellipsis,
  Eye,
  FileArchive,
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
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  isValidElement,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import packageMetadata from "../package.json";
import { AboutDialog } from "./components/about-dialog";
import {
  AccessibleModal,
  useModalFocus,
  useModalStack,
} from "./components/accessible-modal";
import {
  NewDocumentDialog,
  NewDocumentSpec,
  titleFromDocumentName,
} from "./components/new-document-dialog";
import { SupportDialog } from "./components/support-dialog";
import { MermaidDiagram } from "./components/mermaid-diagram";
import {
  MermaidApplyResult,
  MermaidStudio,
  MermaidStudioSession,
} from "./components/mermaid-studio";
import {
  commandAriaKeyShortcuts,
  commandTitle,
} from "./components/command-tooltip";
import { ShortcutHelpDialog } from "./components/shortcut-help-dialog";
import {
  MarkdownCodeEditor,
  MarkdownCodeEditorHandle,
} from "./components/markdown-code-editor";
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
      href: "https://ravi.poorsmile.ir/downloads/Raavi-Setup-1.1.0-x64.exe",
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
};

export type RaaviDesktopAPI = {
  isDesktop: true;
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

function resolveAnnotationStart(text: string, annotation: RaaviAnnotation) {
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
  const [mobilePane, setMobilePane] = useState<MobilePane>("preview");
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
  const composerOriginRef = useRef<HTMLButtonElement | null>(null);
  const readingReturnFocusRef = useRef<HTMLElement | null>(null);
  const saveModalCloseRef = useRef<HTMLButtonElement>(null);
  const newDocumentButtonRef = useRef<HTMLButtonElement>(null);
  const brandButtonRef = useRef<HTMLButtonElement>(null);
  const supportButtonRef = useRef<HTMLButtonElement>(null);
  const mermaidReturnFocusRef = useRef<HTMLElement | null>(null);
  const saveFileNameRef = useRef<HTMLInputElement>(null);
  const saveModalRef = useRef<HTMLDivElement>(null);
  const openedDocumentRef = useRef(false);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeCommitTimerRef = useRef<number | null>(null);
  const themeFinishTimerRef = useRef<number | null>(null);
  const annotationHoverFrameRef = useRef<number | null>(null);
  const readingHeaderFrameRef = useRef<number | null>(null);
  const readingOutlineFrameRef = useRef<number | null>(null);
  const readingLastScrollTopRef = useRef(0);
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
        previewArticleRef.current?.focus();
      }
    });
  }, []);

  const clearPaneTransientUi = useCallback(() => {
    setEditorSelectionMenuPosition(null);
    setSelectionDraft(null);
    setSelectionMenuPosition(null);
    setComposerKind(null);
    setComposerText("");
    setHoverPreview(null);
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

  const focusReadingHeading = useCallback((documentIndex: number) => {
    const heading = previewArticleRef.current?.querySelectorAll<HTMLElement>(
      "h1, h2, h3, h4, h5, h6",
    )[documentIndex];
    if (!heading) return;

    setActiveReadingHeadingIndex(documentIndex);
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "start",
    });
  }, []);

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

    const currentScrollTop = () =>
      Math.max(scrollRoot.scrollTop, window.scrollY);

    readingLastScrollTopRef.current = currentScrollTop();

    const updateHeaderVisibility = () => {
      readingHeaderFrameRef.current = null;
      const nextScrollTop = currentScrollTop();
      const previousScrollTop = readingLastScrollTopRef.current;
      const delta = nextScrollTop - previousScrollTop;

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

    const updateActiveHeading = () => {
      readingOutlineFrameRef.current = null;
      const renderedHeadings =
        article.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6");
      const rootRect = scrollRoot.getBoundingClientRect();
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

    scrollRoot.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();

    return () => {
      scrollRoot.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (readingOutlineFrameRef.current !== null) {
        window.cancelAnimationFrame(readingOutlineFrameRef.current);
        readingOutlineFrameRef.current = null;
      }
    };
  }, [readingHeadings, readingMode, readerSize]);

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
    }),
    [
      activeDocumentPath,
      annotations,
      content,
      documentType,
      fileName,
      imageAssets,
      lastSavedSnapshot,
      readerSize,
      revision,
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
      openedDocumentRef.current = true;
      const nextAnnotations = document.annotations ?? [];
      const nextAssets = document.assets ?? [];
      setContent(document.content);
      setFileName(document.name);
      setAnnotations(nextAnnotations);
      setImageAssets(nextAssets);
      setActiveDocumentPath(document.path ?? "");
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
      setAnnotationPanelOpen(Boolean(nextAnnotations.length));
      setActiveLibraryPath("");
      setMobilePane("preview");
      setReadingMode(Boolean(document.openInReadingMode));
      setReadingHeaderVisible(true);
      setShortcutHelpOpen(false);
      setSaveModalOpen(false);
      setNewDocumentModalOpen(false);
      if (document.openInReadingMode) {
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
    },
    [showNotice],
  );

  useEffect(() => {
    const desktop = window.raaviDesktop;
    if (!desktop) return;

    const unsubscribe = desktop.onOpenMarkdownFile((document) => {
      applyOpenedDocument(document, `«${document.name}» باز شد.`);
    });
    desktop.rendererReady();
    return unsubscribe;
  }, [applyOpenedDocument]);

  const applyLocalDocumentSnapshot = useCallback(
    (snapshot: Partial<LocalDocumentSnapshot>) => {
      if (typeof snapshot.content === "string") setContent(snapshot.content);
      if (typeof snapshot.fileName === "string") setFileName(snapshot.fileName);
      if (Array.isArray(snapshot.annotations)) {
        setAnnotations(snapshot.annotations);
      }
      if (Array.isArray(snapshot.assets)) {
        setImageAssets(snapshot.assets.slice(0, MAX_RAVI_IMAGE_ASSETS));
      }
      if (typeof snapshot.readerSize === "number") {
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
      if (typeof snapshot.activeDocumentPath === "string") {
        setActiveDocumentPath(snapshot.activeDocumentPath);
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
    },
    [],
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      void (async () => {
      try {
        if (openedDocumentRef.current) return;
        let parsed = await readLocalDocumentSnapshot().catch(() => null);
        if (!parsed) {
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
    }, 450);

    return () => clearTimeout(timer);
  }, [hydrated, localDocumentSnapshot]);

  useEffect(() => {
    if (!hydrated) return;

    const flushLatestDocument = () => {
      void writeLocalDocumentSnapshot(localDocumentSnapshot).catch(() => {});
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(localDocumentSnapshot),
        );
      } catch {
        // The visible save state already communicates storage failures.
      }
    };

    window.addEventListener("pagehide", flushLatestDocument);
    return () => window.removeEventListener("pagehide", flushLatestDocument);
  }, [hydrated, localDocumentSnapshot]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      if (editorSelectionMenuTimerRef.current) {
        clearTimeout(editorSelectionMenuTimerRef.current);
      }
      if (annotationHoverFrameRef.current) {
        cancelAnimationFrame(annotationHoverFrameRef.current);
      }
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
      setSelectionMenuPosition(null);
      window.getSelection()?.removeAllRanges();
    };
    const dismissSelectionMenuOnResize = () => {
      setSelectionDraft(null);
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
      setLibraryIsModal(isModal);
      if (isModal) {
        setLibraryOpen(false);
      } else if (initialize) {
        setLibraryOpen(Boolean(window.raaviDesktop));
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
    syncLayer("save", saveModalOpen);
  }, [saveModalOpen, syncLayer]);

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
  ]);

  const capturePreviewSelection = (
    pointer?: { clientX: number; clientY: number },
  ) => {
    requestAnimationFrame(() => {
      const article = previewArticleRef.current;
      const previewScroll = previewScrollRef.current;
      const selection = window.getSelection();
      if (
        !article ||
        !previewScroll ||
        !selection ||
        selection.rangeCount !== 1
      ) {
        return;
      }

      const range = selection.getRangeAt(0);
      if (
        range.collapsed ||
        !article.contains(range.startContainer) ||
        !article.contains(range.endContainer)
      ) {
        if (!composerKind) {
          setSelectionDraft(null);
          setSelectionMenuPosition(null);
        }
        return;
      }

      const rawQuote = range.cloneContents().textContent ?? range.toString();
      const quote = rawQuote.trim();
      if (!quote) {
        setSelectionDraft(null);
        setSelectionMenuPosition(null);
        return;
      }
      if (quote.length > 2_000) {
        setSelectionDraft(null);
        setSelectionMenuPosition(null);
        setError("برای یادداشت‌گذاری، بخش کوتاه‌تری از متن را انتخاب کنید.");
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
      const anchorClientX =
        pointer?.clientX ?? (rangeRect.left + rangeRect.right) / 2;
      const distanceAbove = (pointer?.clientY ?? rangeRect.top) - scrollRect.top;
      const placement = distanceAbove >= 58 ? "above" : "below";
      const anchorClientY =
        pointer?.clientY ??
        (placement === "above" ? rangeRect.top : rangeRect.bottom);
      const menuHalfWidth = Math.min(
        112,
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

    setAnnotations((current) => [...current, annotation]);
    setSelectionDraft(null);
    setSelectionMenuPosition(null);
    setComposerKind(null);
    setComposerText("");
    composerOriginRef.current = null;
    setAnnotationPanelOpen(true);
    setActiveAnnotationId(annotation.id);
    clearNativeSelection();
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
    composerOriginRef.current = origin ?? null;
    setComposerKind(kind);
    setComposerText("");
  };

  const submitAnnotationComposer = () => {
    if (!composerKind || !composerText.trim()) return;
    addAnnotation(composerKind, composerText);
  };

  const cancelAnnotationComposer = () => {
    const origin = composerOriginRef.current;
    setComposerKind(null);
    setComposerText("");
    requestAnimationFrame(() => origin?.focus());
  };

  const updateAnnotationBody = (id: string, body: string) => {
    setAnnotations((current) =>
      current.map((annotation) =>
        annotation.id === id ? { ...annotation, body } : annotation,
      ),
    );
  };

  const removeAnnotation = (id: string) => {
    setAnnotations((current) =>
      current.filter((annotation) => annotation.id !== id),
    );
    if (activeAnnotationId === id) setActiveAnnotationId("");
    showNotice("یادداشت حذف شد.");
  };

  const focusAnnotation = (annotation: RaaviAnnotation) => {
    setActiveAnnotationId(annotation.id);
    setAnnotationPanelOpen(true);
    setHoverPreview(null);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const article = previewArticleRef.current;
        if (!article) return;
        const text = article.textContent ?? "";
        const start = resolveAnnotationStart(text, annotation);
        if (start < 0) {
          showNotice("محل این یادداشت پس از ویرایش متن پیدا نشد.");
          return;
        }
        const range = rangeFromTextOffsets(
          article,
          start,
          start + annotation.quote.length,
        );
        const target = range?.startContainer.parentElement;
        target?.scrollIntoView({ behavior: "smooth", block: "center" });
        document
          .getElementById(`annotation-card-${annotation.id}`)
          ?.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

  const openNewDocumentModal = useCallback(() => {
    setNewDocumentError("");
    setNewDocumentCreating(false);
    setNewDocumentModalOpen(true);
  }, []);

  const createNewDocument = useCallback(
    async (spec: NewDocumentSpec) => {
      const initialContent = spec.includeTitle
        ? `# ${titleFromDocumentName(spec.baseName)}\n`
        : "";
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
          },
          `«${spec.fileName}» ساخته شد؛ ویرایش را شروع کنید.`,
        );
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
        { ...document, openInReadingMode: false },
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
      const asset: RaaviImageAsset = {
        id,
        name: file.name.slice(0, 240),
        mimeType: file.type as RaaviImageAsset["mimeType"],
        data: await readImageAssetData(file),
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
        else previewArticleRef.current?.focus();
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

  const restoreVersion = (version: RaaviVersion) => {
    setContent(version.content);
    setAnnotations(version.annotations);
    setSaveState("saved");
    setSaveModalOpen(false);
    setEditorSelectionMenuPosition(null);
    setSelectionDraft(null);
    setComposerKind(null);
    setComposerText("");
    setAnnotationPanelOpen(Boolean(version.annotations.length));
    setReadingMode(false);
    showNotice(
      `نسخه‌ی ${version.number.toLocaleString("fa-IR")} برای بازبینی بازیابی شد؛ برای ثبت آن ذخیره کنید.`,
    );
  };

  const leaveReadingMode = () => {
    setReadingMode(false);
    setReadingHeaderVisible(true);
    if (!window.matchMedia("(max-width: 820px)").matches) {
      setLibraryOpen(true);
    }
    const returnTarget = readingReturnFocusRef.current;
    requestAnimationFrame(() =>
      returnTarget?.isConnected
        ? returnTarget.focus()
        : previewArticleRef.current?.focus(),
    );
  };

  const toggleReadingMode = () => {
    if (readingMode) {
      leaveReadingMode();
      return;
    }
    readingReturnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    setEditorSelectionMenuPosition(null);
    setReadingMode(true);
    setReadingHeaderVisible(true);
    setLibraryOpen(false);
    setMobilePane("preview");
    requestAnimationFrame(() => previewArticleRef.current?.focus());
  };

  const focusEditor = () => {
    if (readingMode) setReadingMode(false);
    setMobilePane("editor");
    if (!window.matchMedia("(max-width: 820px)").matches) setLibraryOpen(true);
    requestAnimationFrame(() => editorRef.current?.focus());
  };

  const focusPreview = () => {
    setEditorSelectionMenuPosition(null);
    setMobilePane("preview");
    requestAnimationFrame(() => previewArticleRef.current?.focus());
  };

  const focusLibrarySearch = () => {
    if (readingMode) setReadingMode(false);
    setEditorSelectionMenuPosition(null);
    const isWebSurface = commandEnvironment.surface === "web";
    setLibraryTab(isWebSurface ? "history" : "library");
    setLibraryOpen(true);
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
    if (readingMode) setReadingMode(false);
    setMobilePane("preview");
    setAnnotationPanelOpen(true);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => annotationPanelRef.current?.focus()),
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
    if (topLayer === "support") {
      setSupportModalOpen(false);
      return;
    }
    if (topLayer === "shortcuts") {
      setShortcutHelpOpen(false);
      return;
    }
    if (topLayer === "save") {
      setSaveModalOpen(false);
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
      clearNativeSelection();
      requestAnimationFrame(() => previewArticleRef.current?.focus());
      return;
    }
    if (activeAnnotationId) {
      setActiveAnnotationId("");
      return;
    }
    if (annotationPanelOpen) {
      setAnnotationPanelOpen(false);
      requestAnimationFrame(() => annotationToggleRef.current?.focus());
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
      setShortcutHelpOpen((current) => !current);
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
    "view.theme": toggleTheme,
    "view.reading": toggleReadingMode,
    "focus.editor": focusEditor,
    "focus.preview": focusPreview,
    "focus.library": focusLibrarySearch,
    "focus.annotations": focusAnnotationPanel,
    "view.text.decrease": () =>
      setReaderSize((size) => Math.max(16, size - 1)),
    "view.text.increase": () =>
      setReaderSize((size) => Math.min(22, size + 1)),
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

  const editorPaneCollapsed =
    !readingMode && !libraryIsModal && desktopPaneMode === "preview";
  const previewPaneCollapsed =
    !readingMode && !libraryIsModal && desktopPaneMode === "editor";
  const workspacePaneStyle = {
    "--preview-pane-track":
      desktopPaneMode === "editor"
        ? "0fr"
        : desktopPaneMode === "preview"
          ? "100fr"
          : `${previewPanePercent}fr`,
    "--editor-pane-track":
      desktopPaneMode === "preview"
        ? "0fr"
        : desktopPaneMode === "editor"
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
          shortcutHelpOpen ||
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
            onClick={toggleTheme}
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
                onClick={() => {
                  setReadingOutlineOpen(true);
                  setReadingHeaderVisible(true);
                }}
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
            className="button button--support"
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
            className={`button button--quiet library-trigger mobile-library-trigger ${
              libraryOpen ? "is-active" : ""
            }`}
            type="button"
            onClick={() => setLibraryOpen((current) => !current)}
            aria-label="کتابخانه"
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
            className="button button--quiet new-document-trigger"
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
            className="button button--primary"
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
            className="button button--ink"
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
            className={`button button--quiet ${readingMode ? "is-active" : ""}`}
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
        </div>
      </header>

      <div
        className="proofbar"
        aria-label="وضعیت سند"
        inert={
          Boolean(mermaidStudioSession) ||
          aboutModalOpen ||
          supportModalOpen ||
          newDocumentModalOpen ||
          saveModalOpen ||
          shortcutHelpOpen ||
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
            onClick={() => setMobilePane("preview")}
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
            shortcutHelpOpen ||
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
          shortcutHelpOpen
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
            !readingMode ? `pane-layout-is-${desktopPaneMode}` : ""
          } ${paneDragging ? "is-resizing-panes" : ""}`}
          style={workspacePaneStyle}
          data-pane-layout={desktopPaneMode}
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
                onClick={() => {
                  setReadingOutlineOpen(false);
                  setReadingHeaderVisible(true);
                }}
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
                onClick={() => collapseDesktopPane("preview")}
                aria-label="نمایش تمام‌صفحهٔ ویرایشگر و همهٔ ابزارها"
                title="نمایش همهٔ ابزارها در ویرایشگر تمام‌صفحه"
              >
                <Ellipsis size={18} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="editor-surface">
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
              onClick={() => setShortcutHelpOpen(true)}
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
                onClick={() =>
                  setAnnotationPanelOpen((current) => !current)
                }
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
                  onClick={() =>
                    setReaderSize((size) => Math.max(16, size - 1))
                  }
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
                  onClick={() =>
                    setReaderSize((size) => Math.min(22, size + 1))
                  }
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
                    value={composerText}
                    onChange={(event) => setComposerText(event.target.value)}
                    placeholder={
                      composerKind === "comment"
                        ? "نظر یا بازخورد خود را بنویسید…"
                        : "یادداشت حاشیه‌ای را بنویسید…"
                    }
                    autoFocus
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
                    onClick={() => setAnnotationPanelOpen(false)}
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
                dir={documentTextDirection}
                tabIndex={-1}
                aria-label="متن پیش‌نمایش؛ برای جابه‌جایی سریع از میان‌بر تمرکز پیش‌نمایش استفاده کنید"
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
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  urlTransform={raaviMarkdownUrlTransform}
                  components={{
                    pre: ({ children, node }) => {
                      const block = mermaidBlockAtOffset(
                        mermaidBlocks,
                        node?.position?.start.offset,
                      );
                      if (block) {
                        return (
                          <MermaidDiagram
                            block={block}
                            theme={themeMode}
                            onEdit={openMermaidStudio}
                            readingMode={readingMode}
                          />
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
                      <li
                        className={className}
                        dir={blockTextDirection(children)}
                      >
                        {children}
                      </li>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote dir={blockTextDirection(children)}>
                        {children}
                      </blockquote>
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
                      const imageSource =
                        typeof src === "string" ? src.trim() : "";
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
                                  این Markdown به تصویر داخلیِ یک فایل .ravi اشاره
                                  می‌کند، اما محمولهٔ تصویر در فایل موجود نیست.
                                </small>
                              </span>
                            </span>
                          );
                        }

                        return (
                          // The data URL is a local document asset and cannot use Next image optimization.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={raaviImageDataUrl(asset)}
                            alt={alt ?? asset.name}
                            loading="lazy"
                          />
                        );
                      }
                      const isRemoteImage =
                        /^(?:https?:)?\/\//i.test(imageSource);

                      // Markdown can reference arbitrary local paths, so Next Image cannot pre-resolve them.
                      return (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt={alt ?? ""}
                          loading="lazy"
                          referrerPolicy={isRemoteImage ? "no-referrer" : undefined}
                        />
                      );
                    },
                  }}
                >
                  {content}
                </ReactMarkdown>
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
                  className="library-collapse"
                  type="button"
                  onClick={() => setLibraryOpen(false)}
                  aria-label="جمع‌کردن سایدبار"
                  title="جمع‌کردن سایدبار"
                >
                  <PanelRightClose size={19} aria-hidden="true" />
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
              aria-label="بخش‌های سایدبار"
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

      {mermaidStudioSession && (
        <MermaidStudio
          key={mermaidStudioSession.id}
          open
          isTopLayer={topLayer === "mermaid"}
          session={mermaidStudioSession}
          fileName={fileName}
          theme={themeMode}
          onToggleTheme={toggleTheme}
          onApply={applyMermaidStudio}
          onClose={closeMermaidStudio}
          returnFocusRef={mermaidReturnFocusRef}
        />
      )}

      <NewDocumentDialog
        open={newDocumentModalOpen}
        isTopLayer={topLayer === "new"}
        isDesktop={commandEnvironment.surface === "electron"}
        hasUnsavedChanges={effectiveSaveState !== "saved"}
        creating={newDocumentCreating}
        creationError={newDocumentError}
        returnFocusRef={newDocumentButtonRef}
        onClose={() => {
          if (newDocumentCreating) return;
          setNewDocumentModalOpen(false);
          setNewDocumentError("");
        }}
        onCreate={(spec) => void createNewDocument(spec)}
        onSaveCurrent={saveBeforeCreatingNew}
      />

      <AboutDialog
        open={aboutModalOpen}
        isTopLayer={topLayer === "about"}
        version={packageMetadata.version}
        returnFocusRef={brandButtonRef}
        onClose={() => setAboutModalOpen(false)}
      />

      <SupportDialog
        open={supportModalOpen}
        isTopLayer={topLayer === "support"}
        returnFocusRef={supportButtonRef}
        onClose={() => setSupportModalOpen(false)}
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

      <ShortcutHelpDialog
        open={shortcutHelpOpen}
        isTopLayer={topLayer === "shortcuts"}
        environment={commandEnvironment}
        onClose={() => setShortcutHelpOpen(false)}
      />

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
    </div>
  );
}
