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
  Code2,
  Download,
  Eye,
  FileText,
  Folder,
  FolderOpen,
  Highlighter,
  Italic,
  Library,
  Link2,
  MessageCircle,
  MessageSquareText,
  Minus,
  NotebookPen,
  PanelLeftOpen,
  Plus,
  Quote,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AnnotationKind,
  getRaaviName,
  makeRaaviDocument,
  parseRaaviDocument,
  RaaviAnnotation,
} from "./raavi";

const STORAGE_KEY = "raavi:document:v1";
const LIBRARY_ROOT_KEY = "raavi:library-root:v1";
const DEFAULT_FILE_NAME = "راهنمای-راوی.md";
const MAX_FILE_SIZE = 2 * 1024 * 1024;

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

type SaveState = "saved" | "saving" | "error";
type MobilePane = "editor" | "preview";
type LibraryState = "idle" | "scanning" | "ready";

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
  content: string;
  annotations?: RaaviAnnotation[];
};

type RaaviDesktopAPI = {
  isDesktop: true;
  chooseMarkdownFolder: () => Promise<DesktopLibraryScan | null>;
  scanMarkdownFolder: (rootPath: string) => Promise<DesktopLibraryScan>;
  readMarkdownFile: (filePath: string) => Promise<string>;
  saveMarkdown: (
    fileName: string,
    content: string,
  ) => Promise<{ saved: boolean; filePath?: string }>;
  saveRaavi: (
    fileName: string,
    document: ReturnType<typeof makeRaaviDocument>,
  ) => Promise<{
    saved: boolean;
    raviPath?: string;
    markdownPath?: string;
  }>;
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
  size: number;
  lastModified: number;
  read: () => Promise<string>;
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

async function scanMarkdownDirectory(
  directory: LocalDirectoryHandle,
  basePath = "",
  results: LibraryFile[] = [],
): Promise<LibraryFile[]> {
  for await (const entry of directory.values()) {
    const entryPath = basePath ? `${basePath}/${entry.name}` : entry.name;

    if (entry.kind === "directory") {
      await scanMarkdownDirectory(entry, entryPath, results);
      continue;
    }

    if (!/\.(md|markdown)$/i.test(entry.name)) continue;

    const file = await entry.getFile();
    results.push({
      id: `${entryPath}:${file.lastModified}:${file.size}`,
      name: entry.name,
      path: entryPath,
      size: file.size,
      lastModified: file.lastModified,
      read: async () => (await entry.getFile()).text(),
    });
  }

  return results;
}

function LibraryBranch({
  node,
  activePath,
  onOpenFile,
  depth = 0,
  isRoot = false,
}: {
  node: LibraryFolderNode;
  activePath: string;
  onOpenFile: (file: LibraryFile) => void;
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
          onOpenFile={onOpenFile}
          depth={isRoot ? 0 : depth + 1}
        />
      ))}
      {files.map((file) => (
        <li key={file.id}>
          <button
            className={`library-file ${
              activePath === file.path ? "is-active" : ""
            }`}
            type="button"
            onClick={() => onOpenFile(file)}
            title={file.path}
            style={
              {
                "--tree-indent": `${(isRoot ? 0 : depth + 1) * 15}px`,
              } as React.CSSProperties
            }
            aria-pressed={activePath === file.path}
          >
            <FileText size={15} aria-hidden="true" />
            <span dir="auto">{file.name}</span>
          </button>
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

function getDownloadName(fileName: string) {
  const trimmed = fileName.trim() || "نوشته-راوی";
  return /\.(md|markdown)$/i.test(trimmed) ? trimmed : `${trimmed}.md`;
}

export default function Home() {
  const [content, setContent] = useState(SAMPLE_MARKDOWN);
  const [fileName, setFileName] = useState(DEFAULT_FILE_NAME);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [readingMode, setReadingMode] = useState(false);
  const [readerSize, setReaderSize] = useState(18);
  const [mobilePane, setMobilePane] = useState<MobilePane>("preview");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryIsModal, setLibraryIsModal] = useState(false);
  const [libraryState, setLibraryState] = useState<LibraryState>("idle");
  const [libraryFiles, setLibraryFiles] = useState<LibraryFile[]>([]);
  const [libraryRoot, setLibraryRoot] = useState("");
  const [libraryRootPath, setLibraryRootPath] = useState("");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [activeLibraryPath, setActiveLibraryPath] = useState("");
  const [openingLibraryPath, setOpeningLibraryPath] = useState("");
  const [directoryHandle, setDirectoryHandle] =
    useState<LocalDirectoryHandle | null>(null);
  const [annotations, setAnnotations] = useState<RaaviAnnotation[]>([]);
  const [selectionDraft, setSelectionDraft] =
    useState<SelectionDraft | null>(null);
  const [composerKind, setComposerKind] = useState<
    Extract<AnnotationKind, "comment" | "margin"> | null
  >(null);
  const [composerText, setComposerText] = useState("");
  const [annotationPanelOpen, setAnnotationPanelOpen] = useState(false);
  const [activeAnnotationId, setActiveAnnotationId] = useState("");

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const previewArticleRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  const libraryPanelRef = useRef<HTMLElement>(null);
  const libraryCloseRef = useRef<HTMLButtonElement>(null);
  const libraryTriggerRef = useRef<HTMLButtonElement>(null);
  const libraryWasOpenRef = useRef(false);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = setTimeout(() => setNotice(""), 2400);
  }, []);

  useEffect(() => {
    const desktop = window.raaviDesktop;
    if (!desktop) return;

    return desktop.onOpenMarkdownFile((document) => {
      setContent(document.content);
      setFileName(document.name);
      setAnnotations(document.annotations ?? []);
      setSelectionDraft(null);
      setComposerKind(null);
      setAnnotationPanelOpen(Boolean(document.annotations?.length));
      setActiveLibraryPath("");
      setMobilePane("preview");
      setReadingMode(false);
      setError("");
      showNotice(`«${document.name}» باز شد.`);
    });
  }, [showNotice]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as {
            content?: string;
            fileName?: string;
            readerSize?: number;
            annotations?: RaaviAnnotation[];
          };
          if (typeof parsed.content === "string") setContent(parsed.content);
          if (typeof parsed.fileName === "string") setFileName(parsed.fileName);
          if (Array.isArray(parsed.annotations)) {
            setAnnotations(parsed.annotations);
          }
          if (typeof parsed.readerSize === "number") {
            setReaderSize(Math.min(22, Math.max(16, parsed.readerSize)));
          }
        }
        const lastLibraryRoot = window.localStorage.getItem(LIBRARY_ROOT_KEY);
        if (lastLibraryRoot) setLibraryRoot(lastLibraryRoot);
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

    const savingTimer = setTimeout(() => setSaveState("saving"), 0);
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ content, fileName, readerSize, annotations }),
        );
        setSaveState("saved");
      } catch {
        setSaveState("error");
        setError("ذخیره‌ی محلی انجام نشد؛ برای نگه‌داری نوشته آن را دانلود کنید.");
      }
    }, 450);

    return () => {
      clearTimeout(savingTimer);
      clearTimeout(timer);
    };
  }, [content, fileName, readerSize, annotations, hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    const flushLatestDocument = () => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ content, fileName, readerSize, annotations }),
        );
      } catch {
        // The visible save state already communicates storage failures.
      }
    };

    window.addEventListener("pagehide", flushLatestDocument);
    return () => window.removeEventListener("pagehide", flushLatestDocument);
  }, [content, fileName, readerSize, annotations, hydrated]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 820px)");
    const syncLibraryMode = () => setLibraryIsModal(mediaQuery.matches);
    syncLibraryMode();
    mediaQuery.addEventListener("change", syncLibraryMode);
    return () => mediaQuery.removeEventListener("change", syncLibraryMode);
  }, []);

  useEffect(() => {
    if (libraryWasOpenRef.current && !libraryOpen) {
      requestAnimationFrame(() => libraryTriggerRef.current?.focus());
    }
    libraryWasOpenRef.current = libraryOpen;
  }, [libraryOpen]);

  useEffect(() => {
    if (!libraryOpen || !libraryIsModal) return;

    requestAnimationFrame(() => libraryCloseRef.current?.focus());

    const trapFocus = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const panel = libraryPanelRef.current;
      if (!panel) return;

      const focusable = Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);

      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", trapFocus);
    return () => document.removeEventListener("keydown", trapFocus);
  }, [libraryOpen, libraryIsModal]);

  useEffect(() => {
    const style = document.createElement("style");
    style.dataset.raaviHighlights = "true";
    style.textContent = `
      ::highlight(raavi-highlight) {
        color: inherit;
        background: rgba(243, 214, 107, 0.78);
      }
      ::highlight(raavi-comment) {
        color: inherit;
        background: rgba(168, 191, 255, 0.66);
        text-decoration: underline #2557e5 1.5px;
        text-underline-offset: 3px;
      }
      ::highlight(raavi-margin) {
        color: inherit;
        background: rgba(232, 170, 152, 0.62);
        text-decoration: underline #a34f39 1.5px dashed;
        text-underline-offset: 3px;
      }
      ::highlight(raavi-active) {
        color: white;
        background: #2557e5;
        text-decoration: underline white 1px;
        text-underline-offset: 3px;
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

  const capturePreviewSelection = () => {
    requestAnimationFrame(() => {
      const article = previewArticleRef.current;
      const selection = window.getSelection();
      if (!article || !selection || selection.rangeCount !== 1) return;

      const range = selection.getRangeAt(0);
      if (
        range.collapsed ||
        !article.contains(range.startContainer) ||
        !article.contains(range.endContainer)
      ) {
        return;
      }

      const rawQuote = range.cloneContents().textContent ?? range.toString();
      const quote = rawQuote.trim();
      if (!quote) return;
      if (quote.length > 2_000) {
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

      setSelectionDraft({
        start,
        end,
        quote,
        prefix: fullText.slice(Math.max(0, start - 48), start),
        suffix: fullText.slice(end, end + 48),
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
    setComposerKind(null);
    setComposerText("");
    setAnnotationPanelOpen(true);
    setActiveAnnotationId(annotation.id);
    clearNativeSelection();
    showNotice(`${ANNOTATION_LABELS[kind]} ثبت شد.`);
  };

  const openAnnotationComposer = (
    kind: Extract<AnnotationKind, "comment" | "margin">,
  ) => {
    if (!selectionDraft) {
      showNotice("ابتدا بخشی از متن پیش‌نمایش را انتخاب کنید.");
      return;
    }
    setComposerKind(kind);
    setComposerText("");
  };

  const submitAnnotationComposer = () => {
    if (!composerKind || !composerText.trim()) return;
    addAnnotation(composerKind, composerText);
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
  };

  const downloadMarkdown = useCallback(async () => {
    if (window.raaviDesktop) {
      setError("");
      try {
        const result = await window.raaviDesktop.saveMarkdown(
          getDownloadName(fileName),
          content,
        );
        if (result.saved) showNotice("فایل Markdown روی دستگاه ذخیره شد.");
      } catch {
        setError("ذخیره‌ی فایل ممکن نبود؛ مسیر دیگری را انتخاب کنید.");
      }
      return;
    }

    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = getDownloadName(fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showNotice("فایل Markdown آماده‌ی دریافت شد.");
  }, [content, fileName, showNotice]);

  const downloadRaavi = useCallback(async () => {
    const documentValue = makeRaaviDocument(fileName, content, annotations);
    const raviName = getRaaviName(fileName);

    if (window.raaviDesktop) {
      setError("");
      try {
        const result = await window.raaviDesktop.saveRaavi(
          raviName,
          documentValue,
        );
        if (result.saved) {
          showNotice("فایل .ravi و نسخه‌ی Markdown کنار هم ذخیره شدند.");
        }
      } catch {
        setError("ذخیره‌ی بسته‌ی راوی ممکن نبود؛ مسیر دیگری را انتخاب کنید.");
      }
      return;
    }

    const downloads = [
      {
        name: raviName,
        blob: new Blob([JSON.stringify(documentValue, null, 2)], {
          type: "application/json;charset=utf-8",
        }),
      },
      {
        name: getDownloadName(fileName),
        blob: new Blob([content], { type: "text/markdown;charset=utf-8" }),
      },
    ];

    for (const download of downloads) {
      const url = URL.createObjectURL(download.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = download.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }
    showNotice("بسته‌ی .ravi و فایل Markdown آماده‌ی دریافت شدند.");
  }, [annotations, content, fileName, showNotice]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (event.key === "Escape" && libraryOpen) {
        setLibraryOpen(false);
        return;
      }
      if (event.key === "Escape" && readingMode) {
        setReadingMode(false);
        return;
      }

      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        fileInputRef.current?.click();
      }
      if (event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (event.shiftKey) {
          void downloadRaavi();
        } else {
          void downloadMarkdown();
        }
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [
    downloadMarkdown,
    downloadRaavi,
    readingMode,
    libraryOpen,
  ]);

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

    if (file.size > MAX_FILE_SIZE) {
      setError("حجم فایل بیشتر از ۲ مگابایت است؛ یک فایل کوچک‌تر انتخاب کنید.");
      return;
    }

    try {
      const rawContent = await file.text();
      if (isRaaviFile) {
        const parsed = parseRaaviDocument(
          rawContent,
          file.name.replace(/\.ravi$/i, ".md"),
        );
        setContent(parsed.content);
        setFileName(parsed.fileName);
        setAnnotations(parsed.annotations);
        setAnnotationPanelOpen(Boolean(parsed.annotations.length));
        showNotice(
          `بسته‌ی راوی با ${parsed.annotations.length.toLocaleString("fa-IR")} یادداشت باز شد.`,
        );
      } else {
        setContent(rawContent);
        setFileName(file.name);
        setAnnotations([]);
        setAnnotationPanelOpen(false);
        showNotice("فایل باز شد و پیش‌نمایش آماده است.");
      }
      setSelectionDraft(null);
      setComposerKind(null);
      setActiveLibraryPath("");
      setMobilePane("preview");
      setReadingMode(false);
    } catch {
      setError(
        isRaaviFile
          ? "فایل .ravi معتبر نیست یا با نسخه‌ی دیگری ساخته شده است."
          : "خواندن فایل ممکن نبود؛ دوباره تلاش کنید.",
      );
    }
  };

  const scanConnectedDirectory = async (handle: LocalDirectoryHandle) => {
    setLibraryState("scanning");
    setError("");

    try {
      const files = await scanMarkdownDirectory(handle);
      files.sort((a, b) => a.path.localeCompare(b.path, "fa"));
      setLibraryFiles(files);
      setLibraryRoot(handle.name);
      setLibraryRootPath("");
      setLibraryQuery("");
      setLibraryState("ready");
      window.localStorage.setItem(LIBRARY_ROOT_KEY, handle.name);
      showNotice(
        files.length
          ? `${files.length.toLocaleString("fa-IR")} فایل Markdown به کتابخانه اضافه شد.`
          : "در این پوشه فایل Markdown پیدا نشد.",
      );
    } catch {
      setLibraryState(libraryFiles.length ? "ready" : "idle");
      setError(
        "اسکن پوشه کامل نشد؛ دسترسی پوشه را بررسی کنید و دوباره تلاش کنید.",
      );
    }
  };

  const applyDesktopLibrary = (scan: DesktopLibraryScan) => {
    const desktop = window.raaviDesktop;
    if (!desktop) return;

    const entries = scan.files.map(
      (file) =>
        ({
          id: file.id,
          name: file.name,
          path: file.path,
          size: file.size,
          lastModified: file.lastModified,
          read: () => desktop.readMarkdownFile(file.nativePath),
        }) satisfies LibraryFile,
    );

    setDirectoryHandle(null);
    setLibraryFiles(entries);
    setLibraryRoot(scan.rootName);
    setLibraryRootPath(scan.rootPath);
    setActiveLibraryPath("");
    setLibraryQuery("");
    setLibraryState("ready");
    window.localStorage.setItem(LIBRARY_ROOT_KEY, scan.rootName);
    showNotice(
      scan.truncated
        ? "۲۰٬۰۰۰ فایل اول به کتابخانه اضافه شد؛ پوشه‌ی کوچک‌تری انتخاب کنید."
        : entries.length
          ? `${entries.length.toLocaleString("fa-IR")} فایل Markdown به کتابخانه اضافه شد.`
          : "در این پوشه فایل Markdown پیدا نشد.",
    );
  };

  const scanDesktopDirectory = async (rootPath: string) => {
    const desktop = window.raaviDesktop;
    if (!desktop) return;

    setLibraryState("scanning");
    setError("");
    try {
      applyDesktopLibrary(await desktop.scanMarkdownFolder(rootPath));
    } catch {
      setLibraryState(libraryFiles.length ? "ready" : "idle");
      setError(
        "اسکن پوشه کامل نشد؛ پوشه را دوباره انتخاب کنید و مجوز دسترسی را تأیید کنید.",
      );
    }
  };

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
      setDirectoryHandle(handle);
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
      .filter((file) => /\.(md|markdown)$/i.test(file.name))
      .map((file) => {
        const rawPath =
          (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
          file.name;
        const pathParts = rawPath.split("/");
        const relativePath =
          pathParts.length > 1 ? pathParts.slice(1).join("/") : file.name;

        return {
          id: `${relativePath}:${file.lastModified}:${file.size}`,
          name: file.name,
          path: relativePath,
          size: file.size,
          lastModified: file.lastModified,
          read: () => file.text(),
        } satisfies LibraryFile;
      })
      .sort((a, b) => a.path.localeCompare(b.path, "fa"));

    setDirectoryHandle(null);
    setLibraryFiles(entries);
    setLibraryRoot(rootName);
    setLibraryRootPath("");
    setActiveLibraryPath("");
    setLibraryQuery("");
    setLibraryState("ready");
    window.localStorage.setItem(LIBRARY_ROOT_KEY, rootName);
    showNotice(
      entries.length
        ? `${entries.length.toLocaleString("fa-IR")} فایل Markdown به کتابخانه اضافه شد.`
        : "در این پوشه فایل Markdown پیدا نشد.",
    );
  };

  const openLibraryFile = async (file: LibraryFile) => {
    if (file.size > MAX_FILE_SIZE) {
      setError("حجم این فایل بیشتر از ۲ مگابایت است و در راوی باز نمی‌شود.");
      return;
    }

    setOpeningLibraryPath(file.path);
    setError("");

    try {
      const nextContent = await file.read();
      setContent(nextContent);
      setFileName(file.name);
      setAnnotations([]);
      setSelectionDraft(null);
      setComposerKind(null);
      setAnnotationPanelOpen(false);
      setActiveLibraryPath(file.path);
      setMobilePane("preview");
      setReadingMode(false);
      if (window.matchMedia("(max-width: 820px)").matches) {
        setLibraryOpen(false);
      }
      showNotice(`«${file.name}» از کتابخانه باز شد.`);
    } catch {
      setError(
        "خواندن این فایل ممکن نبود؛ پوشه را دوباره متصل کنید و مجوز دسترسی را تأیید کنید.",
      );
    } finally {
      setOpeningLibraryPath("");
    }
  };

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

  const insertInline = (
    before: string,
    after: string,
    placeholder: string,
  ) => {
    const editor = editorRef.current;
    if (!editor) return;

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
        "نوشته‌ی فعلی با یک برگه‌ی خالی جایگزین شود؟ پیش از ادامه، در صورت نیاز آن را دریافت کنید.",
      )
    ) {
      return;
    }

    setContent("");
    setFileName("نوشته-تازه.md");
    setAnnotations([]);
    setSelectionDraft(null);
    setComposerKind(null);
    setAnnotationPanelOpen(false);
    setReadingMode(false);
    setMobilePane("editor");
    requestAnimationFrame(() => editorRef.current?.focus());
    showNotice("یک برگه‌ی تازه آماده شد.");
  };

  return (
    <div className={`app-shell ${readingMode ? "is-reading" : ""}`}>
      <header className="topbar">
        <div className="brand" aria-label="راوی، ویور Markdown فارسی">
          <span className="brand-mark" aria-hidden="true">
            ر
          </span>
          <span className="brand-copy">
            <strong>راوی</strong>
            <small>میز Markdown فارسی</small>
          </span>
        </div>

        <div className="topbar-actions">
          <span className="local-note">
            <Check size={15} aria-hidden="true" />
            فایل روی همین دستگاه می‌ماند
          </span>
          <button
            ref={libraryTriggerRef}
            className={`button button--quiet library-trigger ${
              libraryOpen ? "is-active" : ""
            }`}
            type="button"
            onClick={() => setLibraryOpen((current) => !current)}
            aria-controls="library-panel"
            aria-expanded={libraryOpen}
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
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={18} aria-hidden="true" />
            <span>باز کردن فایل</span>
          </button>
          <button
            className="button button--ink"
            type="button"
            onClick={downloadMarkdown}
            title="ذخیره‌ی Markdown — Ctrl+S"
          >
            <Download size={18} aria-hidden="true" />
            <span>دریافت</span>
          </button>
          <button
            className="button button--ravi"
            type="button"
            onClick={downloadRaavi}
            title="ذخیره‌ی بسته‌ی راوی — Ctrl+Shift+S"
          >
            <MessageSquareText size={18} aria-hidden="true" />
            <span>اشتراک .ravi</span>
          </button>
          <button
            className={`button button--quiet ${readingMode ? "is-active" : ""}`}
            type="button"
            onClick={() =>
              setReadingMode((current) => {
                const nextMode = !current;
                if (nextMode) setLibraryOpen(false);
                return nextMode;
              })
            }
            aria-pressed={readingMode}
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

      <div className="proofbar" aria-label="وضعیت سند">
        <div className="document-identity" title={fileName}>
          <FileText size={16} aria-hidden="true" />
          <span>{fileName}</span>
        </div>

        <div className="save-indicator" aria-live="polite">
          <span
            className={`status-dot is-${saveState}`}
          />
          {saveState === "saving"
            ? "در حال نگه‌داری…"
            : saveState === "error"
              ? "ذخیره نشد"
              : "روی دستگاه ذخیره شد"}
        </div>

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
        <div className="error-banner" role="alert">
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
      >
        <main
          className={`workspace ${readingMode ? "workspace--reading" : ""}`}
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

        <section
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
                title="پررنگ"
              >
                <Bold size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => insertInline("_", "_", "متن مورب")}
                aria-label="مورب"
                title="مورب"
              >
                <Italic size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => insertInline("`", "`", "code")}
                aria-label="کد درون‌خطی"
                title="کد درون‌خطی"
              >
                <Code2 size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={insertQuote}
                aria-label="نقل‌قول"
                title="نقل‌قول"
              >
                <Quote size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() =>
                  insertInline("[", "](https://example.com)", "عنوان پیوند")
                }
                aria-label="افزودن پیوند"
                title="افزودن پیوند"
              >
                <Link2 size={16} aria-hidden="true" />
              </button>
              <span className="tool-divider" aria-hidden="true" />
              <button
                type="button"
                onClick={resetDocument}
                aria-label="برگه‌ی تازه"
                title="برگه‌ی تازه"
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
            onChange={(event) => setContent(event.target.value)}
            spellCheck
            dir="auto"
            aria-describedby="editor-hint"
          />
          <div className="pane-footer" id="editor-hint">
            میان‌برها: Ctrl+O برای باز کردن و Ctrl+S برای دریافت فایل
          </div>
        </section>

        <div className="registration-spine" aria-hidden="true">
          <span className="registration-dot" />
          <span className="spine-line" />
          <span className="spine-label">پیش‌نمای زنده</span>
          <span className="spine-line" />
          <span className="registration-dot registration-dot--bottom" />
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
                className={`annotation-toggle ${
                  annotationPanelOpen ? "is-active" : ""
                }`}
                type="button"
                onClick={() =>
                  setAnnotationPanelOpen((current) => !current)
                }
                aria-expanded={annotationPanelOpen}
                aria-controls="annotation-panel"
                title="نمایش یادداشت‌ها"
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
                  title="کوچک‌تر کردن متن"
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
                  title="بزرگ‌تر کردن متن"
                >
                  <Plus size={15} aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <div
            className={`annotation-toolbar ${
              selectionDraft ? "has-selection" : ""
            } ${composerKind ? "is-composing" : ""}`}
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
                      setComposerKind(null);
                      setComposerText("");
                    }}
                  >
                    لغو
                  </button>
                </div>
              </>
            ) : selectionDraft ? (
              <>
                <div className="selection-summary">
                  <span>انتخاب‌شده</span>
                  <q dir="auto">{selectionDraft.quote}</q>
                </div>
                <div className="annotation-actions">
                  <button
                    className="annotation-action annotation-action--highlight"
                    type="button"
                    onClick={() => addAnnotation("highlight")}
                  >
                    <Highlighter size={15} aria-hidden="true" />
                    هایلایت
                  </button>
                  <button
                    className="annotation-action annotation-action--comment"
                    type="button"
                    onClick={() => openAnnotationComposer("comment")}
                  >
                    <MessageCircle size={15} aria-hidden="true" />
                    کامنت
                  </button>
                  <button
                    className="annotation-action annotation-action--margin"
                    type="button"
                    onClick={() => openAnnotationComposer("margin")}
                  >
                    <NotebookPen size={15} aria-hidden="true" />
                    حاشیه
                  </button>
                  <button
                    className="annotation-dismiss"
                    type="button"
                    onClick={() => {
                      setSelectionDraft(null);
                      clearNativeSelection();
                    }}
                    aria-label="لغو انتخاب"
                    title="لغو انتخاب"
                  >
                    <X size={15} aria-hidden="true" />
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
                className="annotation-panel"
                id="annotation-panel"
                aria-label="یادداشت‌های سند"
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
              className="preview-scroll"
              style={
                { "--reader-size": `${readerSize}px` } as React.CSSProperties
              }
            >
            {content.trim() ? (
              <article
                ref={previewArticleRef}
                className="markdown-body"
                dir="rtl"
                onMouseUp={capturePreviewSelection}
                onKeyUp={capturePreviewSelection}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
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
                  onClick={() => fileInputRef.current?.click()}
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
              <button
                ref={libraryCloseRef}
                type="button"
                onClick={() => setLibraryOpen(false)}
                aria-label="بستن کتابخانه"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <input
              ref={directoryInputRef}
              className="visually-hidden"
              type="file"
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

            {libraryState === "idle" ? (
              <div className="library-onboarding">
                <span className="library-seal" aria-hidden="true">
                  <FolderOpen size={32} />
                </span>
                <strong>
                  {libraryRoot
                    ? `اتصال دوباره به «${libraryRoot}»`
                    : "پوشه‌ی نوشته‌ها را انتخاب کنید"}
                </strong>
                <p>
                  راوی همه‌ی زیرپوشه‌ها را می‌گردد و فقط فایل‌های md و markdown
                  را به این قفسه می‌آورد.
                </p>
                <button
                  className="button button--primary"
                  type="button"
                  onClick={() => void connectLibrary()}
                >
                  <FolderOpen size={17} aria-hidden="true" />
                  انتخاب پوشه
                </button>
              </div>
            ) : libraryState === "scanning" ? (
              <div className="library-scanning" role="status">
                <RefreshCw
                  className="is-spinning"
                  size={28}
                  aria-hidden="true"
                />
                <strong>در حال ساخت کتابخانه…</strong>
                <span>پوشه‌ها و فایل‌های Markdown بررسی می‌شوند.</span>
              </div>
            ) : (
              <>
                <div className="library-rootbar">
                  <div>
                    <FolderOpen size={17} aria-hidden="true" />
                    <span>
                      <small>پوشه‌ی ریشه</small>
                      <strong dir="auto">{libraryRoot}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      directoryHandle
                        ? void scanConnectedDirectory(directoryHandle)
                        : libraryRootPath && window.raaviDesktop
                          ? void scanDesktopDirectory(libraryRootPath)
                        : void connectLibrary()
                    }
                    aria-label="اسکن دوباره‌ی پوشه"
                    title="اسکن دوباره"
                  >
                    <RefreshCw size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void connectLibrary()}
                    aria-label="انتخاب پوشه‌ی دیگر"
                    title="تغییر پوشه"
                  >
                    <FolderOpen size={16} aria-hidden="true" />
                  </button>
                </div>

                <label className="library-search">
                  <Search size={16} aria-hidden="true" />
                  <span className="visually-hidden">جست‌وجو در کتابخانه</span>
                  <input
                    type="search"
                    value={libraryQuery}
                    onChange={(event) => setLibraryQuery(event.target.value)}
                    placeholder="جست‌وجوی نام یا مسیر…"
                    dir="auto"
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
                    {visibleLibraryFiles.length.toLocaleString("fa-IR")} فایل
                  </span>
                  {libraryQuery && (
                    <span>
                      از {libraryFiles.length.toLocaleString("fa-IR")}
                    </span>
                  )}
                </div>

                <div className="library-tree">
                  {visibleLibraryFiles.length ? (
                    <LibraryBranch
                      node={libraryTree}
                      activePath={activeLibraryPath}
                      onOpenFile={(file) => void openLibraryFile(file)}
                      isRoot
                    />
                  ) : (
                    <div className="library-empty">
                      <FileText size={28} aria-hidden="true" />
                      <strong>
                        {libraryQuery
                          ? "فایلی با این عبارت پیدا نشد"
                          : "فایل Markdown پیدا نشد"}
                      </strong>
                      <span>
                        {libraryQuery
                          ? "عبارت جست‌وجو را تغییر دهید."
                          : "یک پوشه‌ی دیگر انتخاب کنید یا فایل md بسازید."}
                      </span>
                    </div>
                  )}
                </div>

                <div className="library-footer">
                  {openingLibraryPath ? (
                    <span>در حال باز کردن فایل…</span>
                  ) : activeLibraryPath ? (
                    <span dir="auto" title={activeLibraryPath}>
                      {activeLibraryPath}
                    </span>
                  ) : (
                    <span>برای باز کردن، روی نام فایل کلیک کنید.</span>
                  )}
                </div>
              </>
            )}

            <div className="library-privacy">
              <ShieldCheck size={17} aria-hidden="true" />
              <span>
                اسکن فقط پس از اجازه‌ی شما انجام می‌شود؛ فایلی به اینترنت ارسال
                نمی‌شود.
              </span>
            </div>
          </aside>
        )}
      </div>

      {notice && (
        <div className="toast" role="status">
          <Check size={17} aria-hidden="true" />
          {notice}
        </div>
      )}
    </div>
  );
}
