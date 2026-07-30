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
  Check,
  ChevronDown,
  ChevronLeft,
  Clock3,
  Code2,
  Eye,
  FileArchive,
  FileText,
  Folder,
  FolderPlus,
  FolderOpen,
  Highlighter,
  History,
  Italic,
  Keyboard,
  Library,
  Link2,
  ListTree,
  Lock,
  LockOpen,
  MessageCircle,
  MessageSquareText,
  Minus,
  Moon,
  NotebookPen,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Pin,
  Plus,
  Quote,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Send,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AccessibleModal,
  useModalFocus,
  useModalStack,
} from "./components/accessible-modal";
import {
  commandAriaKeyShortcuts,
  commandTitle,
} from "./components/command-tooltip";
import { ShortcutHelpDialog } from "./components/shortcut-help-dialog";
import { useCommandSystem } from "./hooks/use-command-system";
import {
  ALL_COMMAND_IDS,
  CommandEnvironment,
  CommandId,
} from "./keyboard/command-registry";
import {
  AnnotationKind,
  makeRaaviDocument,
  parseRaaviDocument,
  RaaviAnnotation,
  RaaviVersion,
} from "./raavi";

const STORAGE_KEY = "raavi:document:v1";
const THEME_STORAGE_KEY = "raavi:theme:v1";
const PINNED_LIBRARY_STORAGE_KEY = "raavi:library-pins:v1";
const DEFAULT_FILE_NAME = "راهنمای-راوی.md";
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const MAX_LOCAL_VERSIONS = 10;

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
type LibraryTab = "history" | "library";
type LibraryState = "idle" | "scanning" | "ready";
type DocumentFileType = "markdown" | "ravi";
type SaveFileType = DocumentFileType;
type ReadingHeading = {
  documentIndex: number;
  level: number;
  text: string;
};
type TextDirection = "ltr" | "rtl";
type ThemeMode = "light" | "dark";
type ThemeTransition = "to-dark" | "to-light" | null;

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
  revision: number;
  versions: RaaviVersion[];
  raavi: ReturnType<typeof makeRaaviDocument>;
};

type RaaviDesktopAPI = {
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

function documentSnapshot(content: string, annotations: RaaviAnnotation[]) {
  return JSON.stringify({ content, annotations });
}

function saveNameForType(fileName: string, type: SaveFileType) {
  const baseName =
    fileName.trim().replace(/\.(?:md|markdown|ravi)$/i, "") || "نوشته-راوی";
  return type === "ravi" ? `${baseName}.ravi` : `${baseName}.md`;
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
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState(() =>
    documentSnapshot(SAMPLE_MARKDOWN, []),
  );
  const [saveModalOpen, setSaveModalOpen] = useState(false);
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
  const [readingMode, setReadingMode] = useState(false);
  const [readingHeaderVisible, setReadingHeaderVisible] = useState(true);
  const [readingOutlineOpen, setReadingOutlineOpen] = useState(true);
  const [activeReadingHeadingIndex, setActiveReadingHeadingIndex] =
    useState(-1);
  const [readerSize, setReaderSize] = useState(18);
  const [mobilePane, setMobilePane] = useState<MobilePane>("preview");
  const [scrollSyncEnabled, setScrollSyncEnabled] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(true);
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

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const editorPaneRef = useRef<HTMLElement>(null);
  const editorSelectionMenuRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const previewArticleRef = useRef<HTMLElement>(null);
  const librarySearchRef = useRef<HTMLInputElement>(null);
  const annotationPanelRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const libraryPanelRef = useRef<HTMLElement>(null);
  const libraryCloseRef = useRef<HTMLButtonElement>(null);
  const libraryTriggerRef = useRef<HTMLButtonElement>(null);
  const historyTabRef = useRef<HTMLButtonElement>(null);
  const libraryTabRef = useRef<HTMLButtonElement>(null);
  const annotationToggleRef = useRef<HTMLButtonElement>(null);
  const selectionMenuRef = useRef<HTMLDivElement>(null);
  const commentButtonRef = useRef<HTMLButtonElement>(null);
  const marginButtonRef = useRef<HTMLButtonElement>(null);
  const composerOriginRef = useRef<HTMLButtonElement | null>(null);
  const readingReturnFocusRef = useRef<HTMLElement | null>(null);
  const saveModalCloseRef = useRef<HTMLButtonElement>(null);
  const saveFileNameRef = useRef<HTMLInputElement>(null);
  const saveModalRef = useRef<HTMLDivElement>(null);
  const openedDocumentRef = useRef(false);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeCommitTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const themeFinishTimerRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const annotationHoverFrameRef = useRef<number | null>(null);
  const readingHeaderFrameRef = useRef<number | null>(null);
  const readingOutlineFrameRef = useRef<number | null>(null);
  const readingLastScrollTopRef = useRef(0);
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
      if (!scrollSyncEnabled) return;

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
    [alignScrollPanes, scrollSyncEnabled],
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
    if (!scrollSyncEnabled) return;

    const frame = window.requestAnimationFrame(() => {
      alignScrollPanes(lastScrolledPaneRef.current);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [
    alignScrollPanes,
    annotationPanelOpen,
    content,
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
    () => documentSnapshot(content, annotations),
    [annotations, content],
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
      setContent(document.content);
      setFileName(document.name);
      setAnnotations(nextAnnotations);
      setActiveDocumentPath(document.path ?? "");
      setDocumentType(document.documentType ?? "markdown");
      setRevision(document.revision ?? 1);
      setVersions(document.versions ?? []);
      setLastSavedSnapshot(
        documentSnapshot(document.content, nextAnnotations),
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

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        if (openedDocumentRef.current) return;
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as {
            content?: string;
            fileName?: string;
            readerSize?: number;
            annotations?: RaaviAnnotation[];
            revision?: number;
            versions?: RaaviVersion[];
            activeDocumentPath?: string;
            documentType?: DocumentFileType;
            lastSavedSnapshot?: string;
          };
          if (typeof parsed.content === "string") setContent(parsed.content);
          if (typeof parsed.fileName === "string") setFileName(parsed.fileName);
          if (Array.isArray(parsed.annotations)) {
            setAnnotations(parsed.annotations);
          }
          if (typeof parsed.readerSize === "number") {
            setReaderSize(Math.min(22, Math.max(16, parsed.readerSize)));
          }
          if (
            Number.isSafeInteger(parsed.revision) &&
            Number(parsed.revision) > 0
          ) {
            setRevision(Number(parsed.revision));
          }
          if (Array.isArray(parsed.versions)) {
            setVersions(parsed.versions.slice(-MAX_LOCAL_VERSIONS));
          }
          if (typeof parsed.activeDocumentPath === "string") {
            setActiveDocumentPath(parsed.activeDocumentPath);
          }
          if (
            parsed.documentType === "markdown" ||
            parsed.documentType === "ravi"
          ) {
            setDocumentType(parsed.documentType);
          }
          setLastSavedSnapshot(
            typeof parsed.lastSavedSnapshot === "string"
              ? parsed.lastSavedSnapshot
              : "",
          );
        }
      } catch {
        setError(
          "بازیابی آخرین نوشته ممکن نبود؛ می‌توانید یک فایل تازه باز کنید.",
        );
      } finally {
        setHydrated(true);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            content,
            fileName,
            readerSize,
            annotations,
            revision,
            versions: versions.slice(-MAX_LOCAL_VERSIONS),
            activeDocumentPath,
            documentType,
            lastSavedSnapshot,
          }),
        );
      } catch {
        setError(
          "پیش‌نویس محلی ذخیره نشد؛ برای جلوگیری از ازدست‌رفتن تغییرات، فایل را ذخیره کنید.",
        );
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [
    activeDocumentPath,
    annotations,
    content,
    documentType,
    fileName,
    hydrated,
    lastSavedSnapshot,
    readerSize,
    revision,
    versions,
  ]);

  useEffect(() => {
    if (!hydrated) return;

    const flushLatestDocument = () => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            content,
            fileName,
            readerSize,
            annotations,
            revision,
            versions: versions.slice(-MAX_LOCAL_VERSIONS),
            activeDocumentPath,
            documentType,
            lastSavedSnapshot,
          }),
        );
      } catch {
        // The visible save state already communicates storage failures.
      }
    };

    window.addEventListener("pagehide", flushLatestDocument);
    return () => window.removeEventListener("pagehide", flushLatestDocument);
  }, [
    activeDocumentPath,
    annotations,
    content,
    documentType,
    fileName,
    hydrated,
    lastSavedSnapshot,
    readerSize,
    revision,
    versions,
  ]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
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
    const syncLibraryMode = () => {
      setLibraryIsModal(mediaQuery.matches);
      setLibraryOpen(!mediaQuery.matches);
    };
    syncLibraryMode();
    mediaQuery.addEventListener("change", syncLibraryMode);
    return () => mediaQuery.removeEventListener("change", syncLibraryMode);
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() =>
      setCommandEnvironment(detectCommandEnvironment()),
    );
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    syncLayer("save", saveModalOpen);
  }, [saveModalOpen, syncLayer]);

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
    );
    return {
      nextRevision,
      nextVersions,
      payload: {
        content,
        annotations,
        revision: nextRevision,
        versions: nextVersions,
        raavi,
      } satisfies DocumentSavePayload,
    };
  }, [annotations, content, fileName, revision, versions]);

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
      setLastSavedSnapshot(documentSnapshot(content, annotations));
      setSaveState("saved");
      setSaveModalOpen(false);
      showNotice(
        `نسخه‌ی ${nextRevision.toLocaleString("fa-IR")} ذخیره شد.`,
      );
    },
    [annotations, content, fileName, showNotice],
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
    requestAnimationFrame(() => {
      const editor = editorRef.current;
      const editorPane = editorPaneRef.current;
      if (!editor || !editorPane) return;
      if (editor.selectionStart === editor.selectionEnd) {
        setEditorSelectionMenuPosition(null);
        return;
      }

      const editorRect = editor.getBoundingClientRect();
      const paneRect = editorPane.getBoundingClientRect();
      const anchorClientX =
        pointer?.clientX ?? editorRect.left + editorRect.width / 2;
      const anchorClientY = pointer?.clientY ?? editorRect.top + 54;
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
    const selected = content.slice(start, end) || placeholder;
    const nextContent =
      content.slice(0, start) + before + selected + after + content.slice(end);

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
    const selected = content.slice(start, end) || "متن نقل‌قول";
    const quoted = selected
      .split(/\r?\n/u)
      .map((line) => `> ${line}`)
      .join("\n");
    const nextContent =
      content.slice(0, start) + quoted + content.slice(end);

    setContent(nextContent);
    requestAnimationFrame(() => {
      editor.focus();
      editor.setSelectionRange(start, start + quoted.length);
    });
  };

  const resetDocument = () => {
    if (
      content.trim() &&
      !window.confirm(
        "نوشته‌ی فعلی با یک برگه‌ی خالی جایگزین شود؟ پیش از ادامه، در صورت نیاز آن را ذخیره کنید.",
      )
    ) {
      return;
    }

    openedDocumentRef.current = false;
    setContent("");
    setFileName("نوشته-تازه.md");
    setAnnotations([]);
    setActiveDocumentPath("");
    setDocumentType("markdown");
    setRevision(1);
    setVersions([]);
    setLastSavedSnapshot(documentSnapshot(SAMPLE_MARKDOWN, []));
    setSaveState("saved");
    setEditorSelectionMenuPosition(null);
    setSelectionDraft(null);
    setComposerKind(null);
    setAnnotationPanelOpen(false);
    setReadingMode(false);
    setMobilePane("editor");
    requestAnimationFrame(() => editorRef.current?.focus());
    showNotice("یک برگه‌ی تازه آماده شد.");
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
    setLibraryTab("library");
    setLibraryOpen(true);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => librarySearchRef.current?.focus()),
    );
  };

  const handleLibraryTabKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentTab: LibraryTab,
  ) => {
    let nextTab: LibraryTab | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      nextTab = currentTab === "history" ? "library" : "history";
    } else if (event.key === "Home") {
      nextTab = "history";
    } else if (event.key === "End") {
      nextTab = "library";
    }
    if (!nextTab) return;

    event.preventDefault();
    setLibraryTab(nextTab);
    requestAnimationFrame(() =>
      (nextTab === "history"
        ? historyTabRef.current
        : libraryTabRef.current
      )?.focus(),
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
    if (topLayer === "shortcuts") {
      setShortcutHelpOpen(false);
      return;
    }
    if (topLayer === "save") {
      setSaveModalOpen(false);
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
    "file.new": resetDocument,
    "help.shortcuts": () => {
      clearAnnotationHover();
      setShortcutHelpOpen((current) => !current);
    },
    "edit.bold": () => insertInline("**", "**", "متن پررنگ"),
    "edit.italic": () => insertInline("_", "_", "متن مورب"),
    "edit.code": () => insertInline("`", "`", "code"),
    "edit.link": () =>
      insertInline("[", "](https://example.com)", "عنوان پیوند"),
    "edit.quote": insertQuote,
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
    const editorFocused = activeElement === editorRef.current;
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
      case "edit.quote":
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
          <div className="brand" aria-label="راوی، ویور Markdown فارسی">
            <span className="brand-mark" aria-hidden="true">
              ر
            </span>
            <span className="brand-copy">
              <strong>راوی</strong>
              <small>میز Markdown فارسی</small>
            </span>
          </div>
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
        inert={saveModalOpen || shortcutHelpOpen ? true : undefined}
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
          }`}
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
          }`}
          aria-label="ویرایشگر Markdown"
        >
          <div className="pane-header">
            <div className="pane-title">
              <span className="folio">برگ ۱</span>
              <strong>ویرایش</strong>
            </div>

            <div className="format-tools" aria-label="ابزار قالب‌بندی">
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
              <span className="tool-divider" aria-hidden="true" />
              <button
                type="button"
                onClick={resetDocument}
                aria-label="برگه‌ی تازه"
                aria-keyshortcuts={commandAriaKeyShortcuts(
                  "file.new",
                  commandEnvironment,
                )}
                title={commandTitle(
                  "file.new",
                  commandEnvironment,
                  "برگه‌ی تازه",
                )}
              >
                <RotateCcw size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <label className="visually-hidden" htmlFor="markdown-editor">
            متن Markdown
          </label>
          <textarea
            id="markdown-editor"
            ref={editorRef}
            value={content}
            onChange={(event) => {
              setEditorSelectionMenuPosition(null);
              setContent(event.target.value);
              if (saveState === "error") setSaveState("saved");
            }}
            onScroll={() => {
              setEditorSelectionMenuPosition(null);
              handleSyncedScroll("editor");
            }}
            onMouseUp={(event) =>
              captureEditorSelection({
                clientX: event.clientX,
                clientY: event.clientY,
              })
            }
            onPointerUp={(event) => {
              if (event.pointerType !== "mouse") {
                captureEditorSelection({
                  clientX: event.clientX,
                  clientY: event.clientY,
                });
              }
            }}
            onKeyUp={() => captureEditorSelection()}
            data-editable-kind="editor"
            spellCheck
            dir="auto"
            aria-describedby="editor-hint"
          />
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
            <span>Markdown با ذخیرهٔ نسخه‌ای</span>
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
            scrollSyncEnabled ? "is-scroll-synced" : ""
          }`}
        >
          <span className="registration-dot" aria-hidden="true" />
          <span className="spine-line" aria-hidden="true" />
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
                : "قفل اسکرول ادیتور و پیش‌نمایش"
            }
          >
            {scrollSyncEnabled ? (
              <Lock size={14} aria-hidden="true" />
            ) : (
              <LockOpen size={14} aria-hidden="true" />
            )}
          </button>
          <span className="spine-label" aria-hidden="true">
            {scrollSyncEnabled ? "اسکرول هماهنگ" : "اسکرول آزاد"}
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
          }`}
          aria-label="پیش‌نمایش Markdown"
        >
          <div className="pane-header">
            <div className="pane-title">
              <span className="folio">برگ ۲</span>
              <strong>
                <Eye size={16} aria-hidden="true" />
                پیش‌نمایش
              </strong>
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
                  components={{
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
                      const isRemoteImage =
                        /^(?:https?:)?\/\//i.test(imageSource);

                      if (isRemoteImage) {
                        return (
                          <span className="remote-media-blocked" role="note">
                            <ShieldCheck size={18} aria-hidden="true" />
                            <span>
                              <strong>تصویر خارجی بارگذاری نشد</strong>
                              <small>
                                برای حفظ حریم خصوصی، تصویرهای اینترنتی خودکار
                                دریافت نمی‌شوند.
                              </small>
                            </span>
                            <a
                              href={imageSource}
                              target="_blank"
                              rel="noreferrer noopener"
                              referrerPolicy="no-referrer"
                            >
                              بازکردن تصویر
                            </a>
                          </span>
                        );
                      }

                      // Markdown can reference arbitrary local paths, so Next Image cannot pre-resolve them.
                      // eslint-disable-next-line @next/next/no-img-element
                      return <img src={src} alt={alt ?? ""} loading="lazy" />;
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
              برای اشتراک سند همراه با هایلایت و کامنت، از پسوند
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
              className="library-tabs"
              role="tablist"
              aria-label="بخش‌های سایدبار"
            >
              <button
                ref={historyTabRef}
                id="library-history-tab"
                type="button"
                role="tab"
                aria-selected={libraryTab === "history"}
                aria-controls="library-history-panel"
                tabIndex={libraryTab === "history" ? 0 : -1}
                onClick={() => setLibraryTab("history")}
                onKeyDown={(event) =>
                  handleLibraryTabKeyDown(event, "history")
                }
              >
                <Clock3 size={16} aria-hidden="true" />
                <span>تاریخچه</span>
                <b>{recentFiles.length.toLocaleString("fa-IR")}</b>
              </button>
              <button
                ref={libraryTabRef}
                id="library-catalog-tab"
                type="button"
                role="tab"
                aria-selected={libraryTab === "library"}
                aria-controls="library-catalog-panel"
                tabIndex={libraryTab === "library" ? 0 : -1}
                onClick={() => setLibraryTab("library")}
                onKeyDown={(event) =>
                  handleLibraryTabKeyDown(event, "library")
                }
              >
                <Library size={16} aria-hidden="true" />
                <span>کتابخانه</span>
                <b>{libraryFiles.length.toLocaleString("fa-IR")}</b>
              </button>
            </div>

            <div className={`library-content is-${libraryTab}`}>
              {recentFiles.length > 0 && (
                <section
                  className="library-section library-history-section"
                  id="library-history-panel"
                  role="tabpanel"
                  aria-labelledby="library-history-tab"
                  tabIndex={0}
                  hidden={libraryTab !== "history"}
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
                  hidden={libraryTab !== "history"}
                >
                  <Clock3 size={28} aria-hidden="true" />
                  <strong>هنوز فایلی باز نشده است</strong>
                  <span>فایل‌های md و ravi که باز می‌کنید اینجا می‌مانند.</span>
                </div>
              )}

              <div
                id="library-catalog-panel"
                role="tabpanel"
                aria-labelledby="library-catalog-tab"
                tabIndex={0}
                hidden={libraryTab !== "library"}
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
            </div>

            <div className="library-footer">
              {openingLibraryPath ? (
                <span>در حال باز کردن فایل…</span>
              ) : libraryTab === "library" && activeLibraryPath ? (
                <span dir="auto" title={activeLibraryPath}>
                  {activeLibraryPath}
                </span>
              ) : libraryTab === "history" && recentFiles.length === 0 ? (
                <span>فایل‌های بازشده در این بخش نمایش داده می‌شوند.</span>
              ) : (
                <span>برای بازکردن، روی نام فایل کلیک کنید.</span>
              )}
            </div>

            <div
              className="library-privacy"
              hidden={libraryTab !== "library"}
            >
              <ShieldCheck size={17} aria-hidden="true" />
              <span>
                اسکن فقط پس از اجازه‌ی شما انجام می‌شود؛ فایلی به اینترنت ارسال
                نمی‌شود.
              </span>
            </div>
          </aside>
        )}
      </div>

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
