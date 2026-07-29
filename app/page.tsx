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
  Code2,
  Download,
  Eye,
  FileText,
  Italic,
  Link2,
  Minus,
  Plus,
  Quote,
  RotateCcw,
  Upload,
  X,
} from "lucide-react";
import { DragEvent, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const STORAGE_KEY = "raavi:document:v1";
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
  "",
  "- [x] متن فارسی خوانا",
  "- [x] قطعه‌کد LTR",
  "- [ ] حالا فایل خودتان را باز کنید",
].join("\n");

type SaveState = "saved" | "saving" | "error";
type MobilePane = "editor" | "preview";

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

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stats = useMemo(() => {
    const cleanText = content.trim();
    return {
      words: cleanText ? cleanText.split(/\s+/u).length : 0,
      lines: content.split(/\r?\n/u).length,
    };
  }, [content]);

  const showNotice = (message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = setTimeout(() => setNotice(""), 2400);
  };

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as {
          content?: string;
          fileName?: string;
          readerSize?: number;
        };
        if (typeof parsed.content === "string") setContent(parsed.content);
        if (typeof parsed.fileName === "string") setFileName(parsed.fileName);
        if (typeof parsed.readerSize === "number") {
          setReaderSize(Math.min(22, Math.max(16, parsed.readerSize)));
        }
      }
    } catch {
      setError("بازیابی آخرین نوشته ممکن نبود؛ می‌توانید یک فایل تازه باز کنید.");
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;

    setSaveState("saving");
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ content, fileName, readerSize }),
        );
        setSaveState("saved");
      } catch {
        setSaveState("error");
        setError("ذخیره‌ی محلی انجام نشد؛ برای نگه‌داری نوشته آن را دانلود کنید.");
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [content, fileName, readerSize, hydrated]);

  useEffect(() => {
    if (!hydrated) return;

    const flushLatestDocument = () => {
      try {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ content, fileName, readerSize }),
        );
      } catch {
        // The visible save state already communicates storage failures.
      }
    };

    window.addEventListener("pagehide", flushLatestDocument);
    return () => window.removeEventListener("pagehide", flushLatestDocument);
  }, [content, fileName, readerSize, hydrated]);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const downloadMarkdown = () => {
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
  };

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
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
        downloadMarkdown();
      }
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [content, fileName, readingMode]);

  const readFile = async (file: File) => {
    setError("");

    const hasMarkdownExtension = /\.(md|markdown)$/i.test(file.name);
    if (!hasMarkdownExtension) {
      setError("این فایل Markdown نیست؛ یک فایل با پسوند md یا markdown انتخاب کنید.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("حجم فایل بیشتر از ۲ مگابایت است؛ یک فایل کوچک‌تر انتخاب کنید.");
      return;
    }

    try {
      const nextContent = await file.text();
      setContent(nextContent);
      setFileName(file.name);
      setMobilePane("preview");
      setReadingMode(false);
      showNotice("فایل باز شد و پیش‌نمایش آماده است.");
    } catch {
      setError("خواندن فایل ممکن نبود؛ دوباره تلاش کنید.");
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
          >
            <Download size={18} aria-hidden="true" />
            <span>دریافت</span>
          </button>
          <button
            className={`button button--quiet ${readingMode ? "is-active" : ""}`}
            type="button"
            onClick={() => setReadingMode((current) => !current)}
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

      <main
        className={`workspace ${readingMode ? "workspace--reading" : ""}`}
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
          accept=".md,.markdown,text/markdown"
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
            <strong>فایل Markdown را همین‌جا رها کنید</strong>
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

            <div className="reader-controls" aria-label="اندازه‌ی متن">
              <button
                type="button"
                onClick={() => setReaderSize((size) => Math.max(16, size - 1))}
                disabled={readerSize <= 16}
                aria-label="کوچک‌تر کردن متن"
                title="کوچک‌تر کردن متن"
              >
                <Minus size={15} aria-hidden="true" />
              </button>
              <span aria-live="polite">{readerSize.toLocaleString("fa-IR")}</span>
              <button
                type="button"
                onClick={() => setReaderSize((size) => Math.min(22, size + 1))}
                disabled={readerSize >= 22}
                aria-label="بزرگ‌تر کردن متن"
                title="بزرگ‌تر کردن متن"
              >
                <Plus size={15} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            className="preview-scroll"
            style={{ "--reader-size": `${readerSize}px` } as React.CSSProperties}
          >
            {content.trim() ? (
              <article className="markdown-body" dir="rtl">
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

          <div className="pane-footer">
            Markdown استاندارد با پشتیبانی از جدول و چک‌لیست
          </div>
        </section>
      </main>

      {notice && (
        <div className="toast" role="status">
          <Check size={17} aria-hidden="true" />
          {notice}
        </div>
      )}
    </div>
  );
}
