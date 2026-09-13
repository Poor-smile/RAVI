"use client";

import "./mermaid-studio.css";

import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CircleHelp,
  Hand,
  Library,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Scan,
  Search,
  Sparkles,
  X,
  ZoomIn,
  ZoomOut,
} from "@/app/icons/material-symbols";
import {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefObject,
  Suspense,
  lazy,
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
  SIMPLE_DIAGRAM_OPTIONS,
  SimpleDiagramDraft,
  simpleDraftToCode,
  validateSimpleDiagramDraft,
} from "../mermaid/simple-builder";
import { DEFAULT_MERMAID_CODE, MERMAID_SAMPLES } from "../mermaid/samples";
import { MermaidTheme } from "../mermaid/renderer";
import {
  mermaidSvgAccessibleName,
  useMermaidBlobUrl,
  useMermaidRender,
} from "../mermaid/use-mermaid-render";
import { recordMermaidMeasure } from "../mermaid/performance";
import { useMermaidViewport } from "../mermaid/use-mermaid-viewport";
import { AccessibleModal } from "./accessible-modal";
import { useBackLayer } from "./back-layer-provider";
import { MermaidCodeEditor } from "./mermaid-code-editor";
const MermaidSimpleBuilder = lazy(() => import("./mermaid-simple-builder").then(module => ({ default: module.MermaidSimpleBuilder })));
import {
  MermaidAiBuilder,
  type MermaidAiDiagramPreview,
  type MermaidAiStep,
} from "./mermaid-ai-builder";

const MermaidBuildingPreview = lazy(() =>
  import("./mermaid-building-preview").then((module) => ({ default: module.MermaidBuildingPreview })),
);

export type MermaidStudioSession = {
  id: string;
  mode: "create" | "edit";
  initialCode: string;
  insertionOffset: number;
  originalDocument: string;
  selectedText?: string;
  block?: MermaidBlock;
  editorScrollTop: number;
  previewScrollTop: number;
};

export type MermaidApplyResult =
  | { ok: true }
  | { ok: false; message: string };

type WorkspaceMode = "simple" | "advanced" | "guided";

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
  backNavigationEnabled = false,
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
  backNavigationEnabled?: boolean;
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
  const confirmDialogRef = useRef<HTMLDivElement>(null);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const renderSurfaceRef = useRef<HTMLImageElement>(null);
  const displayStartedRef = useRef(0);
  const lastValidCodeRef = useRef(session.initialCode || DEFAULT_MERMAID_CODE);
  const [code, setCode] = useState(recoveredCode);
  const detectedDiagramKind = detectMermaidKind(code);
  const initialCode = session.initialCode || DEFAULT_MERMAID_CODE;
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() =>
    session.mode === "create" || recoveredSimpleDraft ? "simple" : "advanced",
  );
  const [simpleDraft, setSimpleDraft] = useState<SimpleDiagramDraft | null>(() =>
    session.mode === "create" ? null : recoveredSimpleDraft,
  );
  const activeDiagramKind = isSimpleDiagramKind(detectedDiagramKind)
    ? detectedDiagramKind
    : simpleDraft?.kind;
  const awaitingKind = workspaceMode === "simple" && simpleDraft === null;
  const [renderNonce, setRenderNonce] = useState(0);
  const [editorPercent, setEditorPercent] = useState(38.07);
  const [resizing, setResizing] = useState(false);
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [sampleQuery, setSampleQuery] = useState("");
  const [guidedDiagramPreview, setGuidedDiagramPreview] = useState<MermaidAiDiagramPreview | null>(null);
  const [guidedAiStep, setGuidedAiStep] = useState<MermaidAiStep | null>(null);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [applyError, setApplyError] = useState("");
  const [focusErrorRequest, setFocusErrorRequest] = useState(0);
  const renderState = useMermaidRender(code, theme, 250, renderNonce, true, {
    documentId: fileName,
    blockId: session.id,
    priority: "interactive",
  });
  const simpleIssues = useMemo(
    () => workspaceMode === "simple" && simpleDraft ? validateSimpleDiagramDraft(simpleDraft) : [],
    [simpleDraft, workspaceMode],
  );
  const hasSimpleIssues = simpleIssues.length > 0;
  const viewport = useMermaidViewport({ contentRef: renderSurfaceRef });
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
        else if (previewFullscreen) setPreviewFullscreen(false);
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
    previewFullscreen,
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
      dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
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

  useBackLayer(
    "mermaid:studio",
    open,
    requestClose,
    backNavigationEnabled,
  );
  useBackLayer(
    "mermaid:preview-fullscreen",
    open && previewFullscreen,
    () => setPreviewFullscreen(false),
    backNavigationEnabled,
  );
  useBackLayer(
    "mermaid:samples",
    open && samplesOpen,
    () => setSamplesOpen(false),
    backNavigationEnabled,
  );
  useBackLayer(
    "mermaid:confirm-close",
    open && confirmClose,
    () => setConfirmClose(false),
    backNavigationEnabled,
  );

  const discardAndClose = () => {
    clearDraft();
    setConfirmClose(false);
    onClose(session);
  };

  const updateSimpleDraft = (next: SimpleDiagramDraft) => {
    setSimpleDraft(next);
    if (validateSimpleDiagramDraft(next).length === 0) setCode(simpleDraftToCode(next));
    setApplyError("");
  };

  const chooseSimpleDraft = (next: SimpleDiagramDraft | null) => {
    setSimpleDraft(next);
    setWorkspaceMode("simple");
    setSamplesOpen(false);
    if (next) setCode(simpleDraftToCode(next));
  };

  const openAdvanced = () => {
    if (hasSimpleIssues) {
      setApplyError("ابتدا خطاهای فرم را اصلاح کنید؛ مقدارهای واردشده در فرم حفظ شده‌اند.");
      return;
    }
    setWorkspaceMode("advanced");
    setSamplesOpen(false);
    setGuidedDiagramPreview(null);
  };

  const openGuided = () => {
    if (!activeDiagramKind) {
      setApplyError("نوع نمودار از کد فعلی تشخیص داده نشد؛ ابتدا یک نوع نمودار انتخاب کنید.");
      return;
    }
    setWorkspaceMode("guided");
    setSamplesOpen(false);
    setApplyError("");
    setGuidedDiagramPreview(null);
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
    setGuidedDiagramPreview(null);
  };

  const openAdvancedSamples = () => {
    setWorkspaceMode("advanced");
    setSampleQuery("");
    setSamplesOpen(true);
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
    else if (event.code === "Enter") next = 38.07;
    else return;
    event.preventDefault();
    setEditorPercent(Math.max(28, Math.min(68, next)));
  };

  const status = workspaceMode === "guided" && guidedAiStep === "building"
    ? { label: "در حال ساخت", tone: "loading" }
    : awaitingKind
    ? { label: "انتخاب نوع", tone: "idle" }
    : hasSimpleIssues
      ? { label: "نیاز به اصلاح", tone: "invalid" }
    : renderState.status === "valid"
      ? { label: previewFullscreen ? "تمام‌صفحه" : "آماده", tone: "valid" }
      : renderState.status === "loading"
        ? { label: "در حال ساخت", tone: "loading" }
        : { label: "نیاز به اصلاح", tone: "invalid" };
  const activeSvg = awaitingKind
    ? ""
    : renderState.svg || renderState.lastValidSvg;
  const activeBlobUrl = useMermaidBlobUrl(activeSvg);
  const activeAccessibleName = useMemo(
    () => mermaidSvgAccessibleName(activeSvg),
    [activeSvg],
  );
  useEffect(() => {
    if (activeBlobUrl) displayStartedRef.current = performance.now();
  }, [activeBlobUrl]);
  const showingLastValid =
    !awaitingKind &&
    (renderState.status === "invalid" || hasSimpleIssues) &&
    Boolean(renderState.lastValidSvg);
  const showingGuidedBuild = workspaceMode === "guided" && guidedAiStep === "building";
  const fitPreview = () =>
    viewport.fitView(
      previewRef.current,
      previewRef.current?.querySelector<HTMLElement>(".mermaid-studio-svg") ??
        null,
    );

  return (
    <AccessibleModal
      open={open}
      isTopLayer={isTopLayer && !confirmClose}
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
      <div className="mermaid-studio-surface" inert={confirmClose ? true : undefined} aria-hidden={confirmClose ? true : undefined}>
      <header className="mermaid-studio-header">
        <div className="mermaid-studio-identity">
          <div>
            <strong id="mermaid-studio-title">استودیو گراف</strong>
            <span id="mermaid-studio-description" dir="auto">
              {fileName} · {session.mode === "edit" ? "ویرایش نمودار" : "نمودار تازه"}
            </span>
          </div>
        </div>
        <span
          className={`mermaid-validation is-${status.tone}`}
          role="status"
          aria-live="polite"
        >
          <i aria-hidden="true" />
          {status.label}
        </span>
        {!awaitingKind && (
          <div
            className="mermaid-mode-switch mermaid-mode-switch--compact"
            role="group"
            aria-label="روش ساخت نمودار"
          >
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
            <button
              type="button"
              className={workspaceMode === "guided" ? "is-active" : ""}
              onClick={openGuided}
            >
              ساخت با هوش مصنوعی
            </button>
          </div>
        )}
        <div className="mermaid-studio-header-actions">
          <button
            ref={backButtonRef}
            type="button"
            className="mermaid-studio-back"
            aria-label="بازگشت به سند"
            onClick={requestClose}
          >
            <ArrowLeft size={17} aria-hidden="true" />
            <span className="mermaid-back-label-wide">بازگشت به سند</span>
            <span className="mermaid-back-label-compact" aria-hidden="true">بازگشت</span>
          </button>
          {!awaitingKind && workspaceMode !== "guided" && (
            <button
              type="button"
              className="mermaid-ai-launch"
              onClick={openGuided}
            >
              <Sparkles size={17} aria-hidden="true" />
              ساخت با هوش مصنوعی
            </button>
          )}
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
          </div>
        </div>
      </header>

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
            <div className="mermaid-studio-pane-title">
              <strong>{awaitingKind ? "انتخاب نوع نمودار" : workspaceMode === "simple" ? "ساختار نمودار" : workspaceMode === "guided" ? "راوی هوشمند" : "کد Mermaid"}</strong>
              <span>{awaitingKind ? `${SIMPLE_DIAGRAM_OPTIONS.length.toLocaleString("fa-IR")} ساختار محلی` : workspaceMode === "simple" ? "ساخت آسان" : workspaceMode === "guided" ? "هدایت‌شده" : "پیشرفته"}</span>
            </div>
            <div className="mermaid-pane-actions">
              {!awaitingKind && (
                <div className="mermaid-mode-switch mermaid-mode-switch--pane" role="group" aria-label="روش ساخت نمودار">
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
                  <button
                    type="button"
                    className={workspaceMode === "guided" ? "is-active" : ""}
                    onClick={openGuided}
                  >
                    ساخت با هوش مصنوعی
                  </button>
                </div>
              )}
              {workspaceMode === "advanced" && (
                <button type="button" onClick={openAdvancedSamples}>
                  <Library size={15} aria-hidden="true" />
                  نمونه‌ها
                </button>
              )}
            </div>
          </div>
          <div className={`mermaid-editor-surface ${workspaceMode === "simple" ? "is-active" : ""}`} inert={workspaceMode === "simple" ? undefined : true} aria-hidden={workspaceMode !== "simple"}>
            <Suspense fallback={<p role="status">در حال آماده‌سازی فرم نمودار…</p>}>
            <MermaidSimpleBuilder
              draft={simpleDraft}
              onChange={updateSimpleDraft}
              onChooseKind={chooseSimpleDraft}
              onPreviewChange={setGuidedDiagramPreview}
            />
            </Suspense>
          </div>
          <div className={`mermaid-editor-surface ${workspaceMode === "advanced" ? "is-active" : ""}`} inert={workspaceMode === "advanced" ? undefined : true} aria-hidden={workspaceMode !== "advanced"}>
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
          </div>
          <div className={`mermaid-editor-surface ${workspaceMode === "guided" ? "is-active" : ""}`} inert={workspaceMode === "guided" ? undefined : true} aria-hidden={workspaceMode !== "guided"}>
            {activeDiagramKind && <MermaidAiBuilder
              key={activeDiagramKind}
              initialText={simpleDraft ? [simpleDraft.title, ...simpleDraft.rows.map((row) => [row.first, row.second, row.value].filter(Boolean).join(" | "))].filter(Boolean).join("\n") : (session.selectedText ?? "")}
              initialKind={activeDiagramKind}
              currentCode={code}
              onCode={(next) => {
                setCode(next);
                const parsed = parseSimpleDiagram(next);
                if (parsed) setSimpleDraft(parsed);
                setRenderNonce((current) => current + 1);
              }}
              onExit={() => {
                setWorkspaceMode("simple");
                setGuidedDiagramPreview(null);
              }}
              onChooseAnother={() => {
                setSimpleDraft(null);
                setWorkspaceMode("simple");
                setGuidedDiagramPreview(null);
              }}
              onPreviewChange={setGuidedDiagramPreview}
              onStepChange={setGuidedAiStep}
            />}
          </div>
          {workspaceMode === "advanced" && (
              <footer className="mermaid-studio-editor-footer">
                <span>Ctrl+Space تکمیل خودکار</span>
                <span>Ctrl+F جست‌وجو</span>
                <span>Ctrl+Z بازگشت</span>
              </footer>
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
            <span>پیش‌نمایش زنده</span>
            <div className="mermaid-preview-tools">
              {previewFullscreen && (
                <button className="mermaid-preview-close" type="button" onClick={() => setPreviewFullscreen(false)}>
                  بستن پیش‌نمایش
                </button>
              )}
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
            {showingLastValid && !guidedDiagramPreview && !showingGuidedBuild && <span className="mermaid-last-valid">آخرین نسخهٔ سالم</span>}
            {showingGuidedBuild ? (
              <Suspense fallback={<div className="mermaid-studio-empty" role="status"><strong>در حال آماده‌سازی پیش‌نمایش…</strong></div>}>
                <MermaidBuildingPreview />
              </Suspense>
            ) : guidedDiagramPreview ? (
              <div className="mermaid-ai-live-type-preview" role="status" aria-live="polite">
                <div className="mermaid-ai-live-type-heading">
                  <strong>{guidedDiagramPreview.title}</strong>
                  <span dir="ltr">{guidedDiagramPreview.english}</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/mermaid-thumbnails/${guidedDiagramPreview.kind}.png`}
                  alt={`پیش‌نمایش نمودار ${guidedDiagramPreview.title}`}
                  draggable={false}
                />
                <small>این نمونه فقط برای انتخاب نوع نمودار است؛ پس از انتخاب، پیش‌نمایش داده‌های شما همین‌جا ساخته می‌شود.</small>
              </div>
            ) : (applyError || (!awaitingKind && renderState.error)) ? (
              <div className="mermaid-studio-error" role="alert">
                <div className="mermaid-error-title">
                  <AlertTriangle size={18} aria-hidden="true" />
                  <strong>پیش‌نمایش ساخته نشد</strong>
                </div>
                <p>{applyError || renderState.error?.message}</p>
                {!applyError && renderState.error?.suggestion && (
                  <div className="mermaid-error-suggestion">{renderState.error.suggestion}</div>
                )}
                {!applyError && (
                  <div className="mermaid-error-actions">
                    {renderState.error?.line && (
                      <button type="button" onClick={goToError} aria-label="رفتن به ردیف مشکل‌دار">
                        رفتن به ردیف
                      </button>
                    )}
                    <button type="button" onClick={openRelevantSample} aria-label="دیدن نمونهٔ صحیح">
                      نمونهٔ صحیح
                    </button>
                    <button type="button" onClick={openSuggestedFix}>اصلاح پیشنهادی</button>
                    {renderState.error?.technical && (
                      <details><summary>جزئیات فنی</summary><pre>{renderState.error.technical}</pre></details>
                    )}
                    {renderState.lastValidSvg && (
                      <button type="button" onClick={restoreLastValid}>بازگردانی آخرین تغییر</button>
                    )}
                  </div>
                )}
              </div>
            ) : activeBlobUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                ref={renderSurfaceRef}
                className="mermaid-studio-svg mermaid-render-surface"
                data-mermaid-render-key={renderState.renderKey}
                src={activeBlobUrl}
                alt={activeAccessibleName}
                draggable={false}
                onLoad={() =>
                  recordMermaidMeasure(
                    session.id,
                    "display",
                    displayStartedRef.current || performance.now(),
                  )
                }
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
                <span>{awaitingKind ? "از میان ۲۹ ساختار، یک نوع را برای ساخت انتخاب کنید." : renderState.status === "loading" ? "پیش‌نمایش در همین پنجره آماده می‌شود." : "فیلدهای لازم را کامل کنید تا پیش‌نمایش ساخته شود."}</span>
              </div>
            )}
            {!guidedDiagramPreview && !showingGuidedBuild && (
              <span className="mermaid-pan-indicator" title="برای جابه‌جایی، نمودار یا فضای خالی را بکشید">
                <Hand size={14} aria-hidden="true" />
                <span className="visually-hidden">ابزار دست فعال است؛ برای جابه‌جایی بکشید</span>
              </span>
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
      </div>

      {confirmClose && (
        <AccessibleModal
          open={confirmClose}
          isTopLayer={confirmClose}
          onClose={() => setConfirmClose(false)}
          dialogRef={confirmDialogRef}
          initialFocusRef={confirmCancelRef}
          returnFocusRef={backButtonRef}
          backdropClassName="mermaid-discard-layer"
          dialogClassName="mermaid-discard-dialog"
          labelledBy="mermaid-discard-title"
          describedBy="mermaid-discard-description"
          containerRole="alertdialog"
        >
            <div>
              <strong id="mermaid-discard-title">تغییرات کنار گذاشته شوند؟</strong>
              <p id="mermaid-discard-description">پیش‌نویس محلی این نمودار حذف می‌شود و به سند برمی‌گردید.</p>
            </div>
            <div>
              <button ref={confirmCancelRef} type="button" className="button button--quiet" onClick={() => setConfirmClose(false)}>
                انصراف
              </button>
              <button type="button" className="button mermaid-discard" onClick={discardAndClose}>
                کنار گذاشتن
              </button>
            </div>
        </AccessibleModal>
      )}
    </AccessibleModal>
  );
}
