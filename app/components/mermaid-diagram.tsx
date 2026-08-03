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
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { MermaidBlock } from "../mermaid/blocks";
import { MermaidTheme } from "../mermaid/renderer";
import { useMermaidRender } from "../mermaid/use-mermaid-render";
import { useMermaidViewport } from "../mermaid/use-mermaid-viewport";

export const MermaidDiagram = memo(function MermaidDiagram({
  block,
  theme,
  onEdit,
  onFullscreenChange,
  readingMode = false,
}: {
  block: MermaidBlock;
  theme: MermaidTheme;
  onEdit: (block: MermaidBlock) => void;
  onFullscreenChange?: (fullscreen: boolean) => void;
  readingMode?: boolean;
}) {
  const figureRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const [renderRequested, setRenderRequested] = useState(!readingMode);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const renderState = useMermaidRender(
    block.code,
    theme,
    0,
    0,
    renderRequested,
  );
  const svg = renderState.svg || renderState.lastValidSvg;
  const fullscreen = nativeFullscreen || fallbackFullscreen;
  const viewport = useMermaidViewport({ enabled: fullscreen });
  const { resetView: resetViewport } = viewport;
  const statusLabel = useMemo(() => {
    if (renderState.status === "loading") return "در حال ساخت نمودار";
    if (renderState.status === "invalid") return "نمودار نیاز به اصلاح دارد";
    return "نمودار Mermaid";
  }, [renderState.status]);
  const svgSurface = useMemo(
    () =>
      svg ? (
        <div
          ref={surfaceRef}
          className="mermaid-svg mermaid-render-surface"
          data-mermaid-render-key={renderState.renderKey}
          style={fullscreen ? { transform: viewport.transform } : undefined}
          // Mermaid runs in strict mode and the SVG is sanitized again locally.
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      ) : null,
    [fullscreen, renderState.renderKey, svg, viewport.transform],
  );

  useEffect(() => {
    if (renderRequested) return;
    const figure = figureRef.current;
    if (!figure || typeof IntersectionObserver === "undefined") {
      setRenderRequested(true);
      return;
    }
    const scrollRoot = readingMode
      ? figure.closest<HTMLElement>(".workspace--reading")
      : figure.closest<HTMLElement>(".preview-scroll");
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setRenderRequested(true);
        observer.disconnect();
      },
      {
        root: scrollRoot,
        rootMargin: "150% 0px",
      },
    );
    observer.observe(figure);
    return () => observer.disconnect();
  }, [readingMode, renderRequested]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isOpen = document.fullscreenElement === figureRef.current;
      setNativeFullscreen(isOpen);
      onFullscreenChange?.(isOpen);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [onFullscreenChange]);

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
        onFullscreenChange?.(false);
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
      onFullscreenChange?.(false);
      setFallbackFullscreen(false);
      return;
    }
    if (document.fullscreenElement === figure) {
      onFullscreenChange?.(false);
      await document.exitFullscreen();
      return;
    }
    onFullscreenChange?.(true);
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
      } ${fallbackFullscreen ? "is-detail-open" : ""}`}
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
            <LoaderCircle size={22} aria-hidden="true" />
            <span>در حال ساخت نمودار…</span>
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
              <small dir="ltr">{renderState.error.technical}</small>
            </span>
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
            <small dir="ltr">{renderState.error.technical}</small>
          </span>
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
