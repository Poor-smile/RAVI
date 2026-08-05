"use client";

import {
  AlertTriangle,
  Hand,
  LoaderCircle,
  Maximize2,
  Minimize2,
  PencilLine,
  Scan,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  memo,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MermaidBlock } from "../mermaid/blocks";
import { MermaidTheme } from "../mermaid/renderer";
import {
  mermaidSvgAccessibleName,
  useMermaidBlobUrl,
  useMermaidRender,
} from "../mermaid/use-mermaid-render";
import { useMermaidViewport } from "../mermaid/use-mermaid-viewport";
import { useMermaidVirtualization } from "../mermaid/use-mermaid-virtualization";
import { recordMermaidMeasure } from "../mermaid/performance";

function readableErrorDetail(technical: string, suggestion?: string) {
  if (suggestion) return suggestion;
  return /[\u0600-\u06ff]/u.test(technical)
    ? technical
    : "کد نمودار را بررسی کنید یا دوباره رندر بگیرید.";
}

export const MermaidDiagram = memo(function MermaidDiagram({
  block,
  theme,
  onEdit,
  onFullscreenChange,
  readingMode = false,
  exporting = false,
}: {
  block: MermaidBlock;
  theme: MermaidTheme;
  onEdit: (block: MermaidBlock) => void;
  onFullscreenChange?: (fullscreen: boolean) => void;
  readingMode?: boolean;
  exporting?: boolean;
}) {
  const figureRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLImageElement>(null);
  const displayStartedRef = useRef(0);
  const [renderNonce, setRenderNonce] = useState(0);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const fullscreen = nativeFullscreen || fallbackFullscreen;
  const reportedFullscreenRef = useRef(false);
  const reportFullscreenChange = useCallback(
    (nextFullscreen: boolean) => {
      if (reportedFullscreenRef.current === nextFullscreen) return;
      reportedFullscreenRef.current = nextFullscreen;
      onFullscreenChange?.(nextFullscreen);
    },
    [onFullscreenChange],
  );
  const virtualization = useMermaidVirtualization(
    figureRef,
    readingMode,
    fullscreen || exporting,
  );
  const renderState = useMermaidRender(
    block.code,
    theme,
    0,
    renderNonce,
    virtualization.mounted,
    {
      documentId: "workspace",
      blockId: block.id,
      priority: virtualization.priority,
    },
  );
  const svg = renderState.svg || renderState.lastValidSvg;
  const blobUrl = useMermaidBlobUrl(virtualization.mounted ? svg : "");
  const accessibleName = useMemo(() => mermaidSvgAccessibleName(svg), [svg]);

  useEffect(() => {
    if (blobUrl) displayStartedRef.current = performance.now();
  }, [blobUrl]);
  const viewport = useMermaidViewport({
    enabled: fullscreen,
    contentRef: surfaceRef,
  });
  const { resetView: resetViewport } = viewport;
  const statusLabel = useMemo(() => {
    if (renderState.status === "loading") return "در حال ساخت نمودار";
    if (renderState.status === "invalid") return "نمودار نیاز به اصلاح دارد";
    return "نمودار Mermaid";
  }, [renderState.status]);
  const svgSurface = useMemo(
    () =>
      blobUrl ? (
        // Blob-backed SVG must remain an ordinary image; Next/Image cannot
        // optimize or safely proxy component-owned object URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          ref={surfaceRef}
          className="mermaid-svg mermaid-render-surface"
          data-mermaid-render-key={renderState.renderKey}
          src={blobUrl}
          alt={accessibleName}
          draggable={false}
          onLoad={() =>
            recordMermaidMeasure(
              block.id,
              "display",
              displayStartedRef.current || performance.now(),
            )
          }
        />
      ) : null,
    [accessibleName, blobUrl, block.id, renderState.renderKey],
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isOpen = document.fullscreenElement === figureRef.current;
      setNativeFullscreen(isOpen);
      reportFullscreenChange(isOpen);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [reportFullscreenChange]);

  useEffect(() => {
    reportFullscreenChange(fullscreen);
  }, [fullscreen, reportFullscreenChange]);

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    if (fallbackFullscreen) document.body.style.overflow = "hidden";
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (fallbackFullscreen) {
        setFallbackFullscreen(false);
      } else if (document.fullscreenElement === figureRef.current) {
        void document.exitFullscreen();
      }
    };
    document.addEventListener("keydown", closeWithEscape, true);
    return () => {
      if (fallbackFullscreen) document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeWithEscape, true);
    };
  }, [fallbackFullscreen, fullscreen, onFullscreenChange]);

  useEffect(() => {
    if (readingMode) return;
    const resetFallback = window.setTimeout(
      () => setFallbackFullscreen(false),
      0,
    );
    if (document.fullscreenElement === figureRef.current) {
      void document.exitFullscreen();
    }
    return () => window.clearTimeout(resetFallback);
  }, [readingMode]);

  useEffect(() => {
    if (!fullscreen) resetViewport();
  }, [fullscreen, resetViewport]);

  const toggleFullscreen = async () => {
    const figure = figureRef.current;
    if (!figure) return;
    if (fallbackFullscreen) {
      setFallbackFullscreen(false);
      return;
    }
    if (document.fullscreenElement === figure) {
      await document.exitFullscreen();
      return;
    }
    reportFullscreenChange(true);
    try {
      await figure.requestFullscreen();
    } catch {
      setFallbackFullscreen(true);
    }
  };

  const fitDiagram = () =>
    viewport.fitView(canvasRef.current, surfaceRef.current);

  const editFromDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest("a, button, input, textarea, [role='button']")
    ) {
      return;
    }
    if (readingMode) {
      if (!fullscreen) void toggleFullscreen();
    } else {
      onEdit(block);
    }
  };

  return (
    <figure
      ref={figureRef}
      className={`mermaid-diagram is-${renderState.status} ${
        readingMode ? "is-reading" : ""
      } ${exporting ? "is-exporting" : ""} ${
        fallbackFullscreen ? "is-detail-open" : ""
      }`}
      dir="auto"
      data-mermaid-block-id={block.id}
      onDoubleClick={editFromDoubleClick}
    >
      <div
        ref={canvasRef}
        className={`mermaid-diagram-canvas ${
          fullscreen ? "is-viewport-active" : ""
        } ${viewport.panning ? "is-panning" : ""}`}
        aria-label={statusLabel}
        aria-busy={
          renderState.status === "idle" || renderState.status === "loading"
        }
        {...(fullscreen ? viewport.viewportHandlers : {})}
      >
        {svgSurface ?? (renderState.status !== "invalid" ? (
          <div className="mermaid-diagram-placeholder" role="status">
            {virtualization.mounted && <LoaderCircle size={22} aria-hidden="true" />}
            <span>
              {virtualization.mounted
                ? "در حال ساخت نمودار…"
                : "نمودار هنگام نزدیک‌شدن به محدودهٔ دید نمایش داده می‌شود."}
            </span>
          </div>
        ) : null)}
        {readingMode && renderState.status === "invalid" && renderState.error && (
          <div
            className="mermaid-inline-error mermaid-inline-error--in-canvas"
            role="status"
          >
            <AlertTriangle size={17} aria-hidden="true" />
            <span>
              <strong>{renderState.error.message}</strong>
              <small>
                {readableErrorDetail(
                  renderState.error.technical,
                  renderState.error.suggestion,
                )}
              </small>
            </span>
            {renderState.complexity?.level === "extreme" && (
              <button type="button" onClick={() => setRenderNonce((value) => value + 1)}>
                رندر کامل
              </button>
            )}
            <button type="button" onClick={() => onEdit(block)}>
              اصلاح در استودیو
            </button>
          </div>
        )}
        {readingMode && fullscreen && svg && (
          <div
            className="mermaid-diagram-viewport-tools mermaid-preview-tools"
            role="toolbar"
            aria-label="کنترل نمای نمودار"
          >
            <span
              className="mermaid-pan-indicator"
              title="برای جابه‌جایی، نمودار یا فضای خالی را بکشید"
            >
              <Hand size={20} aria-hidden="true" />
              <span className="visually-hidden">
                ابزار دست فعال است؛ برای جابه‌جایی بکشید
              </span>
            </span>
            <button
              type="button"
              onClick={() => viewport.zoomBy(-0.15)}
              aria-label="کوچک‌نمایی نمودار"
              title="کوچک‌نمایی"
            >
              <ZoomOut size={20} aria-hidden="true" />
            </button>
            <output
              aria-label={`بزرگ‌نمایی ${viewport.scalePercent} درصد`}
            >
              {viewport.scalePercent.toLocaleString("fa-IR")}٪
            </output>
            <button
              type="button"
              onClick={() => viewport.zoomBy(0.15)}
              aria-label="بزرگ‌نمایی نمودار"
              title="بزرگ‌نمایی"
            >
              <ZoomIn size={20} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={fitDiagram}
              aria-label="جا دادن کامل نمودار در کادر"
              title="نمایش کامل طول و عرض نمودار در کادر"
            >
              <Scan size={20} aria-hidden="true" />
            </button>
            <span
              className="mermaid-fullscreen-dock-separator"
              aria-hidden="true"
            />
            <button
              className="mermaid-fullscreen-close"
              type="button"
              onClick={() => void toggleFullscreen()}
              aria-label="بستن نمای تمام‌صفحهٔ نمودار"
              title="بستن نمای تمام‌صفحه (Esc)"
            >
              <Minimize2 size={20} aria-hidden="true" />
              <span>بستن</span>
            </button>
          </div>
        )}
        {(!readingMode || !fullscreen) && (
          <button
            className="mermaid-diagram-action"
            type="button"
            onClick={() =>
              readingMode ? void toggleFullscreen() : onEdit(block)
            }
            aria-label={
              readingMode
                ? "نمایش تمام‌صفحهٔ نمودار"
                : "ویرایش این نمودار"
            }
            aria-pressed={readingMode ? false : undefined}
            title={
              readingMode
                ? "نمایش تمام‌صفحهٔ نمودار"
                : "ویرایش این نمودار"
            }
          >
            {readingMode ? (
              <Maximize2 size={15} aria-hidden="true" />
            ) : (
              <PencilLine size={15} aria-hidden="true" />
            )}
            <span>{readingMode ? "تمام‌صفحه" : "ویرایش"}</span>
          </button>
        )}
      </div>
      {!readingMode && renderState.status === "invalid" && renderState.error && (
        <figcaption className="mermaid-inline-error" role="status">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>
            <strong>{renderState.error.message}</strong>
            <small>
              {readableErrorDetail(
                renderState.error.technical,
                renderState.error.suggestion,
              )}
            </small>
          </span>
          {renderState.complexity?.level === "extreme" && (
            <button type="button" onClick={() => setRenderNonce((value) => value + 1)}>
              رندر کامل
            </button>
          )}
          <button type="button" onClick={() => onEdit(block)}>
            اصلاح در استودیو
          </button>
        </figcaption>
      )}
      <figcaption className="mermaid-diagram-hint">
        {readingMode
          ? fullscreen
            ? "با چرخ ماوس زوم کنید، برای جابه‌جایی بکشید و با Escape به متن برگردید."
            : "برای بررسی دقیق نمودار، دکمهٔ تمام‌صفحه را بزنید."
          : "برای ویرایش همین نمودار، دوبار کلیک کنید."}
      </figcaption>
    </figure>
  );
});
