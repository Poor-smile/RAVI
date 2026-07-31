"use client";

import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleHelp,
  Code2,
  Eye,
  Library,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Moon,
  Play,
  Search,
  Scan,
  Sun,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  PointerEvent as ReactPointerEvent,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MermaidBlock } from "../mermaid/blocks";
import {
  DEFAULT_MERMAID_CODE,
  MERMAID_SAMPLES,
} from "../mermaid/samples";
import { MermaidTheme } from "../mermaid/renderer";
import { useMermaidRender } from "../mermaid/use-mermaid-render";
import { AccessibleModal } from "./accessible-modal";
import { MermaidCodeEditor } from "./mermaid-code-editor";

export type MermaidStudioSession = {
  id: string;
  mode: "create" | "edit";
  initialCode: string;
  insertionOffset: number;
  originalDocument: string;
  block?: MermaidBlock;
  editorScrollTop: number;
  previewScrollTop: number;
};

export type MermaidApplyResult =
  | { ok: true }
  | { ok: false; message: string };

const DRAFT_PREFIX = "raavi:mermaid-draft:v1";

function draftKey(fileName: string, session: MermaidStudioSession) {
  return `${DRAFT_PREFIX}:${fileName}:${session.mode}:${
    session.block?.id ?? session.insertionOffset
  }`;
}

function recoverStudioCode(fileName: string, session: MermaidStudioSession) {
  const fallback = session.initialCode || DEFAULT_MERMAID_CODE;
  if (typeof window === "undefined") return fallback;
  try {
    return window.localStorage.getItem(draftKey(fileName, session)) || fallback;
  } catch {
    return fallback;
  }
}

export function MermaidStudio({
  open,
  isTopLayer,
  session,
  fileName,
  theme,
  onToggleTheme,
  onApply,
  onClose,
  returnFocusRef,
}: {
  open: boolean;
  isTopLayer: boolean;
  session: MermaidStudioSession;
  fileName: string;
  theme: MermaidTheme;
  onToggleTheme: () => void;
  onApply: (
    code: string,
    session: MermaidStudioSession,
  ) => MermaidApplyResult;
  onClose: (session: MermaidStudioSession) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [code, setCode] = useState(() => recoverStudioCode(fileName, session));
  const initialCode = session.initialCode || DEFAULT_MERMAID_CODE;
  const [renderNonce, setRenderNonce] = useState(0);
  const [editorPercent, setEditorPercent] = useState(44);
  const [resizing, setResizing] = useState(false);
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [sampleQuery, setSampleQuery] = useState("");
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [applyError, setApplyError] = useState("");
  const renderState = useMermaidRender(code, theme, 320, renderNonce);
  const dirty = code !== initialCode;

  useEffect(() => {
    if (!open || !session || !dirty) return;
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey(fileName, session), code);
      } catch {
        // The current in-memory draft is still available.
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [code, dirty, fileName, open, session]);

  const filteredSamples = useMemo(() => {
    const query = sampleQuery.trim().toLocaleLowerCase("fa-IR");
    if (!query) return MERMAID_SAMPLES;
    return MERMAID_SAMPLES.filter((sample) =>
      `${sample.title} ${sample.category} ${sample.description} ${sample.id}`
        .toLocaleLowerCase("fa-IR")
        .includes(query),
    );
  }, [sampleQuery]);

  useEffect(() => {
    if (!open) return;
    const handleStudioKeys = (event: KeyboardEvent) => {
      const primary = event.ctrlKey || event.metaKey;
      if (event.code === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (confirmClose) {
          setConfirmClose(false);
        } else if (dirty) {
          setConfirmClose(true);
        } else {
          try {
            window.localStorage.removeItem(draftKey(fileName, session));
          } catch {
            // No persisted draft to clear.
          }
          onClose(session);
        }
        return;
      }
      if (primary && event.code === "Digit0") {
        event.preventDefault();
        setScale(1);
        setTranslate({ x: 0, y: 0 });
        return;
      }
      if (
        primary &&
        (event.code === "Equal" || event.code === "NumpadAdd")
      ) {
        event.preventDefault();
        setScale((current) => Math.min(3, current + 0.15));
        return;
      }
      if (
        primary &&
        (event.code === "Minus" || event.code === "NumpadSubtract")
      ) {
        event.preventDefault();
        setScale((current) => Math.max(0.25, current - 0.15));
      }
    };
    document.addEventListener("keydown", handleStudioKeys, true);
    return () =>
      document.removeEventListener("keydown", handleStudioKeys, true);
  }, [confirmClose, dirty, fileName, onClose, open, session]);

  const clearDraft = () => {
    try {
      window.localStorage.removeItem(draftKey(fileName, session));
    } catch {
      // No persisted draft to clear.
    }
  };

  const apply = () => {
    setApplyError("");
    if (renderState.status !== "valid") {
      setApplyError("ابتدا خطای نمودار را برطرف کنید تا نسخهٔ معتبر اعمال شود.");
      return;
    }
    const result = onApply(code, session);
    if (!result.ok) {
      setApplyError(result.message);
      return;
    }
    clearDraft();
  };

  const requestClose = () => {
    if (dirty) {
      setConfirmClose(true);
      return;
    }
    clearDraft();
    onClose(session);
  };

  const discardAndClose = () => {
    clearDraft();
    setConfirmClose(false);
    onClose(session);
  };

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (previewFullscreen) return;
    event.preventDefault();
    const container = event.currentTarget.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setResizing(true);
    const move = (pointerEvent: PointerEvent) => {
      const percent = ((rect.right - pointerEvent.clientX) / rect.width) * 100;
      setEditorPercent(Math.max(28, Math.min(68, percent)));
    };
    const finish = () => {
      setResizing(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const startPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !event.currentTarget.closest(".mermaid-studio-svg"))
      return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const origin = {
      x: event.clientX - translate.x,
      y: event.clientY - translate.y,
    };
    setPanning(true);
    const move = (pointerEvent: PointerEvent) => {
      setTranslate({
        x: pointerEvent.clientX - origin.x,
        y: pointerEvent.clientY - origin.y,
      });
    };
    const finish = () => {
      setPanning(false);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
  };

  const resetView = () => {
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  };

  const zoom = (delta: number) =>
    setScale((current) => Math.max(0.25, Math.min(3, current + delta)));

  const status =
    renderState.status === "valid"
      ? { label: "معتبر", icon: Check }
      : renderState.status === "loading"
        ? { label: "در حال رندر", icon: LoaderCircle }
        : { label: "نیاز به اصلاح", icon: AlertTriangle };
  const StatusIcon = status.icon;
  const activeSvg = renderState.svg || renderState.lastValidSvg;

  return (
    <AccessibleModal
      open={open}
      isTopLayer={isTopLayer}
      onClose={requestClose}
      dialogRef={dialogRef}
      initialFocusRef={backButtonRef}
      returnFocusRef={returnFocusRef}
      backdropClassName="mermaid-studio-backdrop"
      dialogClassName={`mermaid-studio ${
        previewFullscreen ? "preview-is-fullscreen" : ""
      } ${resizing ? "is-resizing" : ""} ${
        applyError || renderState.error ? "has-error" : ""
      }`}
      labelledBy="mermaid-studio-title"
      describedBy="mermaid-studio-description"
    >
      <header className="mermaid-studio-header">
        <div className="mermaid-studio-identity">
          <button
            ref={backButtonRef}
            type="button"
            className="mermaid-studio-back"
            onClick={requestClose}
          >
            <ArrowRight size={17} aria-hidden="true" />
            بازگشت به سند
          </button>
          <span className="mermaid-studio-header-rule" aria-hidden="true" />
          <div>
            <strong id="mermaid-studio-title">استودیوی نمودار</strong>
            <span id="mermaid-studio-description" dir="auto">
              {fileName} ·{" "}
              {session.mode === "edit" ? "ویرایش نمودار" : "نمودار تازه"}
            </span>
          </div>
        </div>
        <div className="mermaid-studio-header-actions">
          <span className={`mermaid-validation is-${renderState.status}`}>
            <StatusIcon size={15} aria-hidden="true" />
            {status.label}
          </span>
          <button
            className="mermaid-studio-theme"
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "light" ? "تم تاریک" : "تم روشن"}
            title={theme === "light" ? "تم تاریک" : "تم روشن"}
          >
            {theme === "light" ? (
              <Moon size={16} aria-hidden="true" />
            ) : (
              <Sun size={16} aria-hidden="true" />
            )}
          </button>
          <button
            className="mermaid-studio-samples-toggle"
            type="button"
            onClick={() => setSamplesOpen((current) => !current)}
            aria-expanded={samplesOpen}
            aria-controls="mermaid-sample-library"
          >
            <Library size={16} aria-hidden="true" />
            نمونه‌ها
          </button>
          <button
            className="button button--primary mermaid-apply"
            type="button"
            onClick={apply}
            disabled={renderState.status !== "valid"}
            title="اعمال در سند (Ctrl+S)"
          >
            <Check size={16} aria-hidden="true" />
            اعمال در سند
          </button>
        </div>
      </header>

      {(applyError || renderState.error) && (
        <div className="mermaid-studio-error" role="status">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>
            <strong>{applyError || renderState.error?.message}</strong>
            {!applyError && renderState.error?.technical && (
              <small dir="ltr">{renderState.error.technical}</small>
            )}
          </span>
        </div>
      )}

      <main
        className="mermaid-studio-workspace"
        style={
          {
            "--mermaid-editor-percent": `${editorPercent}%`,
          } as React.CSSProperties
        }
      >
        <section className="mermaid-studio-editor" aria-label="ویرایش کد نمودار">
          <div className="mermaid-studio-pane-heading">
            <span>
              <Code2 size={16} aria-hidden="true" />
              کد Mermaid
            </span>
            <button
              type="button"
              onClick={() => setRenderNonce((current) => current + 1)}
              title="رندر فوری (Ctrl+Enter)"
            >
              <Play size={15} aria-hidden="true" />
              اجرا
            </button>
          </div>
          <MermaidCodeEditor
            value={code}
            onChange={setCode}
            onApply={apply}
            onRenderNow={() => setRenderNonce((current) => current + 1)}
            onRequestClose={requestClose}
          />
          <footer className="mermaid-studio-editor-footer">
            <span>Ctrl+Space تکمیل خودکار</span>
            <span>Ctrl+F جست‌وجو</span>
            <span>Ctrl+Z بازگشت</span>
          </footer>
        </section>

        <div
          className="mermaid-studio-divider"
          role="separator"
          aria-label="تغییر اندازهٔ کد و پیش‌نمایش"
          aria-orientation="vertical"
          aria-valuemin={28}
          aria-valuemax={68}
          aria-valuenow={Math.round(editorPercent)}
          onPointerDown={startResize}
        >
          <span aria-hidden="true" />
        </div>

        <section className="mermaid-studio-preview" aria-label="پیش‌نمایش نمودار">
          <div className="mermaid-studio-pane-heading">
            <span>
              <Eye size={16} aria-hidden="true" />
              پیش‌نمایش زنده
            </span>
            <div className="mermaid-preview-tools">
              <button
                type="button"
                onClick={() => zoom(-0.15)}
                aria-label="کوچک‌نمایی"
                title="کوچک‌نمایی"
              >
                <ZoomOut size={15} aria-hidden="true" />
              </button>
              <output>{Math.round(scale * 100).toLocaleString("fa-IR")}٪</output>
              <button
                type="button"
                onClick={() => zoom(0.15)}
                aria-label="بزرگ‌نمایی"
                title="بزرگ‌نمایی"
              >
                <ZoomIn size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={resetView}
                aria-label="جا دادن نمودار در نما"
                title="جا دادن در نما (Ctrl+0)"
              >
                <Scan size={15} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setPreviewFullscreen((current) => !current)
                }
                aria-label={
                  previewFullscreen
                    ? "خروج از تمام‌صفحه"
                    : "پیش‌نمایش تمام‌صفحه"
                }
                title={
                  previewFullscreen
                    ? "خروج از تمام‌صفحه"
                    : "پیش‌نمایش تمام‌صفحه"
                }
              >
                {previewFullscreen ? (
                  <Minimize2 size={15} aria-hidden="true" />
                ) : (
                  <Maximize2 size={15} aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          <div
            ref={previewRef}
            className={`mermaid-studio-canvas ${panning ? "is-panning" : ""}`}
            onPointerDown={startPan}
            onWheel={(event) => {
              if (!event.ctrlKey) return;
              event.preventDefault();
              zoom(event.deltaY > 0 ? -0.1 : 0.1);
            }}
          >
            {activeSvg ? (
              <div
                className="mermaid-studio-svg mermaid-render-surface"
                data-mermaid-render-key={renderState.renderKey}
                style={{
                  transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
                }}
                // Mermaid runs in strict mode and the SVG is sanitized again locally.
                dangerouslySetInnerHTML={{ __html: activeSvg }}
              />
            ) : (
              <div className="mermaid-studio-empty">
                {renderState.status === "loading" ? (
                  <LoaderCircle size={26} aria-hidden="true" />
                ) : (
                  <CircleHelp size={26} aria-hidden="true" />
                )}
                <strong>
                  {renderState.status === "loading"
                    ? "در حال ساخت پیش‌نمایش…"
                    : "کد نمودار را کامل کنید"}
                </strong>
              </div>
            )}
          </div>
        </section>

        {samplesOpen && (
          <aside
            className="mermaid-sample-library"
            id="mermaid-sample-library"
            aria-label="کتابخانه نمونه‌های Mermaid"
          >
            <div className="mermaid-sample-header">
              <div>
                <strong>نمونه‌های رسمی</strong>
                <span>{MERMAID_SAMPLES.length.toLocaleString("fa-IR")} نوع</span>
              </div>
              <button
                type="button"
                onClick={() => setSamplesOpen(false)}
                aria-label="بستن نمونه‌ها"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <label className="mermaid-sample-search">
              <Search size={16} aria-hidden="true" />
              <span className="visually-hidden">جست‌وجوی نمونه</span>
              <input
                value={sampleQuery}
                onChange={(event) => setSampleQuery(event.target.value)}
                placeholder="جست‌وجوی نوع نمودار…"
                data-editable-kind="generic"
              />
            </label>
            <div className="mermaid-sample-list">
              {filteredSamples.map((sample) => (
                <button
                  type="button"
                  key={sample.id}
                  onClick={() => {
                    setCode(sample.code);
                    setRenderNonce((current) => current + 1);
                  }}
                >
                  <span>
                    <strong>{sample.title}</strong>
                    <small>{sample.category}</small>
                  </span>
                  <p>{sample.description}</p>
                </button>
              ))}
            </div>
            <a
              className="mermaid-docs-link"
              href="https://mermaid.js.org/intro/"
              target="_blank"
              rel="noreferrer noopener"
            >
              راهنمای رسمی Mermaid
            </a>
          </aside>
        )}
      </main>

      {confirmClose && (
        <div className="mermaid-discard-layer" role="presentation">
          <div
            className="mermaid-discard-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="mermaid-discard-title"
          >
            <AlertTriangle size={22} aria-hidden="true" />
            <div>
              <strong id="mermaid-discard-title">پیش‌نویس اعمال نشده است</strong>
              <p>
                با خروج، تغییرهای این نشست از سند کنار گذاشته می‌شود. نسخهٔ
                بازیابی‌شدنی تا زمان انتخاب شما باقی مانده است.
              </p>
            </div>
            <div>
              <button
                type="button"
                className="button button--quiet"
                onClick={() => setConfirmClose(false)}
              >
                ادامهٔ ویرایش
              </button>
              <button
                type="button"
                className="button mermaid-discard"
                onClick={discardAndClose}
              >
                خروج بدون اعمال
              </button>
            </div>
          </div>
        </div>
      )}
    </AccessibleModal>
  );
}
