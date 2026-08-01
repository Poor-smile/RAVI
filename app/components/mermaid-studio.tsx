"use client";

import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Check,
  CircleHelp,
  Code2,
  Eye,
  Hand,
  Library,
  LoaderCircle,
  Maximize2,
  Minimize2,
  RotateCcw,
  Scan,
  Search,
  Wrench,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MermaidBlock } from "../mermaid/blocks";
import {
  detectMermaidKind,
  normalizePersianSearch,
} from "../mermaid/persian-adapter";
import {
  createSimpleDiagramDraft,
  isSimpleDiagramKind,
  parseSimpleDiagram,
  SimpleDiagramDraft,
  simpleDraftToCode,
  validateSimpleDiagramDraft,
} from "../mermaid/simple-builder";
import { DEFAULT_MERMAID_CODE, MERMAID_SAMPLES } from "../mermaid/samples";
import { MermaidTheme } from "../mermaid/renderer";
import { useMermaidRender } from "../mermaid/use-mermaid-render";
import { useMermaidViewport } from "../mermaid/use-mermaid-viewport";
import { AccessibleModal } from "./accessible-modal";
import { MermaidCodeEditor } from "./mermaid-code-editor";
import { MermaidSimpleBuilder } from "./mermaid-simple-builder";

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

type WorkspaceMode = "simple" | "advanced";

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

function sampleTitleForCode(code: string) {
  const kind = detectMermaidKind(code);
  return MERMAID_SAMPLES.find((sample) => sample.id === kind)?.title;
}

export function MermaidStudio({
  open,
  isTopLayer,
  session,
  fileName,
  theme,
  onApply,
  onClose,
  returnFocusRef,
}: {
  open: boolean;
  isTopLayer: boolean;
  session: MermaidStudioSession;
  fileName: string;
  theme: MermaidTheme;
  onApply: (
    code: string,
    session: MermaidStudioSession,
  ) => MermaidApplyResult;
  onClose: (session: MermaidStudioSession) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}) {
  const recoveredCode = useMemo(
    () => recoverStudioCode(fileName, session),
    [fileName, session],
  );
  const recoveredSimpleDraft = useMemo(
    () => parseSimpleDiagram(recoveredCode),
    [recoveredCode],
  );
  const dialogRef = useRef<HTMLDivElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const lastValidCodeRef = useRef(session.initialCode || DEFAULT_MERMAID_CODE);
  const [code, setCode] = useState(recoveredCode);
  const initialCode = session.initialCode || DEFAULT_MERMAID_CODE;
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() =>
    session.mode === "create" || recoveredSimpleDraft ? "simple" : "advanced",
  );
  const [simpleDraft, setSimpleDraft] = useState<SimpleDiagramDraft | null>(() =>
    session.mode === "create" ? null : recoveredSimpleDraft,
  );
  const awaitingKind = workspaceMode === "simple" && simpleDraft === null;
  const [renderNonce, setRenderNonce] = useState(0);
  const [editorPercent, setEditorPercent] = useState(44);
  const [resizing, setResizing] = useState(false);
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [sampleQuery, setSampleQuery] = useState("");
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [focusErrorRequest, setFocusErrorRequest] = useState(0);
  const renderState = useMermaidRender(code, theme, 320, renderNonce);
  const simpleIssues = useMemo(
    () => workspaceMode === "simple" && simpleDraft ? validateSimpleDiagramDraft(simpleDraft) : [],
    [simpleDraft, workspaceMode],
  );
  const hasSimpleIssues = simpleIssues.length > 0;
  const viewport = useMermaidViewport();
  const { resetView: resetViewport, zoomBy: zoomViewportBy } = viewport;
  const dirty = code !== initialCode;
  const applyLabel =
    session.mode === "create" ? "افزودن به سند" : "ذخیرهٔ تغییرات";

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

  useEffect(() => {
    if (renderState.status === "valid") lastValidCodeRef.current = code;
  }, [code, renderState.status]);

  const filteredSamples = useMemo(() => {
    const query = normalizePersianSearch(sampleQuery);
    if (!query) return MERMAID_SAMPLES;
    return MERMAID_SAMPLES.filter((sample) =>
      normalizePersianSearch(
        `${sample.title} ${sample.category} ${sample.description} ${sample.id}`,
      ).includes(query),
    );
  }, [sampleQuery]);

  useEffect(() => {
    if (!open) return;
    const handleStudioKeys = (event: KeyboardEvent) => {
      const primary = event.ctrlKey || event.metaKey;
      if (event.code === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (confirmClose) setConfirmClose(false);
        else if (samplesOpen) setSamplesOpen(false);
        else if (dirty) setConfirmClose(true);
        else {
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
        resetViewport();
        return;
      }
      if (
        primary &&
        (event.code === "Equal" || event.code === "NumpadAdd")
      ) {
        event.preventDefault();
        zoomViewportBy(0.15);
        return;
      }
      if (
        primary &&
        (event.code === "Minus" || event.code === "NumpadSubtract")
      ) {
        event.preventDefault();
        zoomViewportBy(-0.15);
      }
    };
    document.addEventListener("keydown", handleStudioKeys, true);
    return () => document.removeEventListener("keydown", handleStudioKeys, true);
  }, [
    confirmClose,
    dirty,
    fileName,
    onClose,
    open,
    samplesOpen,
    session,
    resetViewport,
    zoomViewportBy,
  ]);

  const clearDraft = () => {
    try {
      window.localStorage.removeItem(draftKey(fileName, session));
    } catch {
      // No persisted draft to clear.
    }
  };

  const apply = () => {
    setApplyError("");
    if (awaitingKind) {
      setApplyError("ابتدا نوع نمودار را انتخاب کنید.");
      return;
    }
    if (hasSimpleIssues) {
      setApplyError(simpleIssues[0]?.message ?? "یک مورد در فرم نیاز به اصلاح دارد.");
      return;
    }
    if (renderState.status !== "valid") {
      setApplyError(
        `بعد از رفع ${renderState.error?.line ? `ردیف ${renderState.error.line.toLocaleString("fa-IR")}` : "خطای نمودار"} می‌توانید ادامه دهید.`,
      );
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

  const updateSimpleDraft = (next: SimpleDiagramDraft) => {
    setSimpleDraft(next);
    setCode(simpleDraftToCode(next));
    setApplyError("");
  };

  const chooseSimpleDraft = (next: SimpleDiagramDraft | null) => {
    setSimpleDraft(next);
    setWorkspaceMode("simple");
    setSamplesOpen(false);
    if (next) setCode(simpleDraftToCode(next));
  };

  const openAdvanced = () => {
    setWorkspaceMode("advanced");
    setSamplesOpen(false);
  };

  const openSimple = () => {
    const parsed = parseSimpleDiagram(code);
    if (!parsed) {
      setApplyError("این کد از قابلیت‌هایی استفاده می‌کند که ساخت آسان نمی‌تواند بدون حذف اطلاعات بازخوانی کند. کد شما دست‌نخورده ماند؛ برای ویرایش از حالت پیشرفته استفاده کنید.");
      return;
    }
    setSimpleDraft(parsed);
    setWorkspaceMode("simple");
    setSamplesOpen(false);
    setApplyError("");
  };

  const openAdvancedSamples = () => {
    setWorkspaceMode("advanced");
    setSampleQuery("");
    setSamplesOpen(true);
  };

  const openTypePicker = () => {
    setSimpleDraft(null);
    setWorkspaceMode("simple");
    setSamplesOpen(false);
  };

  const openRelevantSample = () => {
    setWorkspaceMode("advanced");
    setSampleQuery(sampleTitleForCode(code) ?? "");
    setSamplesOpen(true);
  };

  const openSuggestedFix = () => {
    const parsed = parseSimpleDiagram(code);
    const kind = detectMermaidKind(code);
    const supported = isSimpleDiagramKind(kind);
    setSimpleDraft(
      parsed ?? (supported ? createSimpleDiagramDraft(kind) : null),
    );
    setWorkspaceMode(supported ? "simple" : "advanced");
    if (!supported) openRelevantSample();
  };

  const restoreLastValid = () => {
    const restored = lastValidCodeRef.current;
    setCode(restored);
    const parsed = parseSimpleDiagram(restored);
    if (workspaceMode === "simple" && parsed) setSimpleDraft(parsed);
    setApplyError("");
  };

  const goToError = () => {
    setWorkspaceMode("advanced");
    setFocusErrorRequest((current) => current + 1);
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

  const resizeWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    let next = editorPercent;
    if (event.code === "ArrowLeft" || event.code === "ArrowUp") next += 5;
    else if (event.code === "ArrowRight" || event.code === "ArrowDown") next -= 5;
    else if (event.code === "Home") next = 28;
    else if (event.code === "End") next = 68;
    else if (event.code === "Enter") next = 44;
    else return;
    event.preventDefault();
    setEditorPercent(Math.max(28, Math.min(68, next)));
  };

  const status = awaitingKind
    ? { label: "نوع نمودار را انتخاب کنید", icon: CircleHelp }
    : hasSimpleIssues
      ? { label: `${simpleIssues.length.toLocaleString("fa-IR")} مورد نیاز به اصلاح دارد`, icon: AlertTriangle }
    : renderState.status === "valid"
      ? { label: "آماده", icon: Check }
      : renderState.status === "loading"
        ? { label: "در حال ساخت", icon: LoaderCircle }
        : { label: "یک ردیف نیاز به اصلاح دارد", icon: AlertTriangle };
  const StatusIcon = status.icon;
  const activeSvg = awaitingKind
    ? ""
    : renderState.svg || renderState.lastValidSvg;
  const showingLastValid =
    !awaitingKind &&
    renderState.status === "invalid" &&
    Boolean(renderState.lastValidSvg);
  const fitPreview = () =>
    viewport.fitView(
      previewRef.current,
      previewRef.current?.querySelector<HTMLElement>(".mermaid-studio-svg") ??
        null,
    );

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
        applyError || hasSimpleIssues || (!awaitingKind && renderState.error) ? "has-error" : ""
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
            <strong id="mermaid-studio-title">ساخت نمودار</strong>
            <span id="mermaid-studio-description" dir="auto">
              {fileName} · {session.mode === "edit" ? "ویرایش نمودار" : "نمودار تازه"}
            </span>
          </div>
        </div>
        <div className="mermaid-studio-header-actions">
          <span
            className={`mermaid-validation is-${awaitingKind ? "idle" : hasSimpleIssues ? "invalid" : renderState.status}`}
            role="status"
            aria-live="polite"
          >
            <StatusIcon size={15} aria-hidden="true" />
            {status.label}
          </span>
          <button
            className="mermaid-studio-samples-toggle"
            type="button"
            onClick={openTypePicker}
          >
            <Library size={16} aria-hidden="true" />
            انتخاب نوع نمودار
          </button>
          <div className="mermaid-apply-wrap">
            <button
              className="button button--primary mermaid-apply"
              type="button"
              onClick={apply}
              disabled={awaitingKind || hasSimpleIssues || renderState.status !== "valid"}
              title={`${applyLabel} (Ctrl+S)`}
            >
              <Check size={16} aria-hidden="true" />
              {applyLabel}
            </button>
            <small>
              {awaitingKind
                ? "ابتدا نوع نمودار را انتخاب کنید"
                : hasSimpleIssues
                ? `پس از رفع ${simpleIssues.length.toLocaleString("fa-IR")} مورد فرم فعال می‌شود`
                : renderState.status === "invalid"
                ? `پس از رفع ${renderState.error?.line ? `ردیف ${renderState.error.line.toLocaleString("fa-IR")}` : "خطا"} فعال می‌شود`
                : "پیش‌نویس خودکار نگه‌داری می‌شود"}
            </small>
          </div>
        </div>
      </header>

      {(applyError || (!awaitingKind && renderState.error)) && (
        <div className="mermaid-studio-error" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <div className="mermaid-error-copy">
            <strong>{applyError || renderState.error?.message}</strong>
            {!applyError && renderState.error?.suggestion && (
              <p>{renderState.error.suggestion}</p>
            )}
            {!applyError && renderState.error?.technical && (
              <details>
                <summary>جزئیات فنی</summary>
                <pre dir="ltr">{renderState.error.technical}</pre>
              </details>
            )}
          </div>
          {!applyError && (
            <div className="mermaid-error-actions">
              {renderState.error?.line && (
                <button type="button" onClick={goToError}>
                  <Wrench size={15} aria-hidden="true" />
                  رفتن به ردیف مشکل‌دار
                </button>
              )}
              <button type="button" onClick={openRelevantSample}>
                <BookOpen size={15} aria-hidden="true" />
                دیدن نمونهٔ صحیح
              </button>
              <button type="button" onClick={openSuggestedFix}>
                <Wrench size={15} aria-hidden="true" />
                اصلاح پیشنهادی
              </button>
              {renderState.lastValidSvg && (
                <button type="button" onClick={restoreLastValid}>
                  <RotateCcw size={15} aria-hidden="true" />
                  بازگردانی آخرین تغییر
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <main
        className={`mermaid-studio-workspace is-${workspaceMode}`}
        style={
          {
            "--mermaid-editor-percent": `${editorPercent}%`,
          } as React.CSSProperties
        }
      >
        <section className="mermaid-studio-editor" aria-label="ساختار نمودار">
          <div className="mermaid-studio-pane-heading">
            <span>
              <Code2 size={16} aria-hidden="true" />
              {workspaceMode === "simple" ? "ساخت آسان" : "کد Mermaid — پیشرفته"}
            </span>
            <div className="mermaid-pane-actions">
              <div className="mermaid-mode-switch" role="group" aria-label="روش ساخت نمودار">
                <button
                  type="button"
                  className={workspaceMode === "simple" ? "is-active" : ""}
                  onClick={openSimple}
                >
                  ساخت آسان
                </button>
                <button
                  type="button"
                  className={workspaceMode === "advanced" ? "is-active" : ""}
                  onClick={openAdvanced}
                >
                  کد پیشرفته
                </button>
              </div>
              {workspaceMode === "advanced" && (
                <button type="button" onClick={openAdvancedSamples}>
                  <Library size={15} aria-hidden="true" />
                  نمونه‌های پیشرفته
                </button>
              )}
            </div>
          </div>
          {workspaceMode === "simple" ? (
            <MermaidSimpleBuilder
              draft={simpleDraft}
              onChange={updateSimpleDraft}
              onChooseKind={chooseSimpleDraft}
            />
          ) : (
            <>
              <MermaidCodeEditor
                value={code}
                onChange={setCode}
                onApply={apply}
                onRenderNow={() => setRenderNonce((current) => current + 1)}
                onRequestClose={requestClose}
                errorLine={renderState.error?.line}
                errorMessage={
                  renderState.error?.suggestion ?? renderState.error?.message
                }
                focusErrorRequest={focusErrorRequest}
              />
              <footer className="mermaid-studio-editor-footer">
                <span>Ctrl+Space تکمیل خودکار</span>
                <span>Ctrl+F جست‌وجو</span>
                <span>Ctrl+Z بازگشت</span>
              </footer>
            </>
          )}
        </section>

        <div
          className="mermaid-studio-divider"
          role="separator"
          tabIndex={0}
          aria-label="تغییر اندازهٔ ساختار و پیش‌نمایش؛ کلیدهای جهت برای جابه‌جایی و Enter برای اندازهٔ میانی"
          aria-orientation="vertical"
          aria-valuemin={28}
          aria-valuemax={68}
          aria-valuenow={Math.round(editorPercent)}
          onPointerDown={startResize}
          onKeyDown={resizeWithKeyboard}
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
              <button type="button" onClick={() => viewport.zoomBy(-0.15)} aria-label="کوچک‌نمایی" title="کوچک‌نمایی">
                <ZoomOut size={15} aria-hidden="true" />
              </button>
              <output aria-label={`بزرگ‌نمایی ${viewport.scalePercent} درصد`}>
                {viewport.scalePercent.toLocaleString("fa-IR")}٪
              </output>
              <button type="button" onClick={() => viewport.zoomBy(0.15)} aria-label="بزرگ‌نمایی" title="بزرگ‌نمایی">
                <ZoomIn size={15} aria-hidden="true" />
              </button>
              <button type="button" onClick={fitPreview} aria-label="جا دادن کامل نمودار در نما" title="جا دادن کامل نمودار در نما">
                <Scan size={15} aria-hidden="true" />
              </button>
              <span className="mermaid-pan-indicator" title="برای جابه‌جایی، نمودار یا فضای خالی را بکشید">
                <Hand size={14} aria-hidden="true" />
                <span className="visually-hidden">ابزار دست فعال است؛ برای جابه‌جایی بکشید</span>
              </span>
              <button
                type="button"
                onClick={() => setPreviewFullscreen((current) => !current)}
                aria-label={previewFullscreen ? "خروج از تمام‌صفحه" : "پیش‌نمایش تمام‌صفحه"}
                title={previewFullscreen ? "خروج از تمام‌صفحه" : "پیش‌نمایش تمام‌صفحه"}
              >
                {previewFullscreen ? <Minimize2 size={15} aria-hidden="true" /> : <Maximize2 size={15} aria-hidden="true" />}
              </button>
            </div>
          </div>
          <div
            ref={previewRef}
            className={`mermaid-studio-canvas ${viewport.panning ? "is-panning" : ""}`}
            {...viewport.viewportHandlers}
          >
            {showingLastValid && <span className="mermaid-last-valid">آخرین نسخهٔ سالم</span>}
            {activeSvg ? (
              <div
                className="mermaid-studio-svg mermaid-render-surface"
                data-mermaid-render-key={renderState.renderKey}
                style={{ transform: viewport.transform }}
                // Mermaid runs in strict mode and the SVG is sanitized again locally.
                dangerouslySetInnerHTML={{ __html: activeSvg }}
              />
            ) : (
              <div className="mermaid-studio-empty">
                {!awaitingKind && renderState.status === "loading" ? <LoaderCircle size={26} aria-hidden="true" /> : <CircleHelp size={26} aria-hidden="true" />}
                <strong>
                  {awaitingKind
                    ? "برای شروع، نوع نمودار را انتخاب کنید"
                    : renderState.status === "loading"
                      ? "در حال ساخت پیش‌نمایش…"
                      : "اطلاعات نمودار را کامل کنید"}
                </strong>
              </div>
            )}
          </div>
        </section>

        {samplesOpen && (
          <aside className="mermaid-sample-library" id="mermaid-sample-library" aria-label="نمونه‌های پیشرفتهٔ Mermaid">
            <div className="mermaid-sample-header">
              <div>
                <strong>نمونه‌های بیشتر</strong>
                <span>{MERMAID_SAMPLES.length.toLocaleString("fa-IR")} نوع</span>
              </div>
              <button type="button" onClick={() => setSamplesOpen(false)} aria-label="بستن نمونه‌ها">
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
                    setSimpleDraft(parseSimpleDiagram(sample.code));
                    setRenderNonce((current) => current + 1);
                    setSamplesOpen(false);
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
            <a className="mermaid-docs-link" href="https://mermaid.js.org/intro/" target="_blank" rel="noreferrer noopener">
              راهنمای رسمی Mermaid
            </a>
          </aside>
        )}
      </main>

      {confirmClose && (
        <div className="mermaid-discard-layer" role="presentation">
          <div className="mermaid-discard-dialog" role="alertdialog" aria-modal="true" aria-labelledby="mermaid-discard-title">
            <AlertTriangle size={22} aria-hidden="true" />
            <div>
              <strong id="mermaid-discard-title">پیش‌نویس اعمال نشده است</strong>
              <p>با خروج، تغییرهای این نشست از سند کنار گذاشته می‌شود. نسخهٔ بازیابی‌شدنی تا زمان انتخاب شما باقی مانده است.</p>
            </div>
            <div>
              <button type="button" className="button button--quiet" onClick={() => setConfirmClose(false)}>
                ادامهٔ ویرایش
              </button>
              <button type="button" className="button mermaid-discard" onClick={discardAndClose}>
                خروج بدون اعمال
              </button>
            </div>
          </div>
        </div>
      )}
    </AccessibleModal>
  );
}
