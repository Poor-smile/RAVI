"use client";

import {
  AlertTriangle,
  ArrowLeft,
  FitScreen,
  Fullscreen,
  LoaderCircle,
  Minimize2,
  PencilLine,
  ZoomIn,
  ZoomOut,
} from "@/app/icons/material-symbols";
import {
  memo,
  MouseEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
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

const FULLSCREEN_FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

let activeFallbackGraphViewerKey: string | null = null;

function fullscreenFocusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FULLSCREEN_FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      !element.inert &&
      element.getAttribute("aria-hidden") !== "true" &&
      element.getClientRects().length > 0,
  );
}

function makeOutsideSubtreeInert(target: HTMLElement) {
  const affected: Array<{ element: HTMLElement; inert: boolean }> = [];
  let branch: HTMLElement | null = target;

  while (branch?.parentElement) {
    const parent: HTMLElement = branch.parentElement;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === branch || !(sibling instanceof HTMLElement)) continue;
      affected.push({ element: sibling, inert: sibling.inert });
      sibling.inert = true;
    }
    branch = parent;
  }

  return () => {
    for (const { element, inert } of affected) element.inert = inert;
  };
}

function readableErrorDetail(technical: string, suggestion?: string) {
  if (suggestion) return suggestion;
  return /[\u0600-\u06ff]/u.test(technical)
    ? technical
    : "کد نمودار را بررسی کنید یا دوباره رندر بگیرید.";
}

function mermaidSvgIntrinsicSize(svg: string) {
  const match = svg.match(
    /\bviewBox\s*=\s*["']\s*[-+]?\d*\.?\d+(?:e[-+]?\d+)?[\s,]+[-+]?\d*\.?\d+(?:e[-+]?\d+)?[\s,]+([-+]?\d*\.?\d+(?:e[-+]?\d+)?)[\s,]+([-+]?\d*\.?\d+(?:e[-+]?\d+)?)["']/iu,
  );
  const width = Number(match?.[1]);
  const height = Number(match?.[2]);
  return width > 0 && height > 0 ? { width, height } : null;
}

export const MermaidDiagram = memo(function MermaidDiagram({
  block,
  theme,
  onEdit,
  onFullscreenChange,
  readingMode = false,
  exporting = false,
  documentName = "سند جدید",
}: {
  block: MermaidBlock;
  theme: MermaidTheme;
  onEdit: (block: MermaidBlock) => void;
  onFullscreenChange?: (fullscreen: boolean) => void;
  readingMode?: boolean;
  exporting?: boolean;
  documentName?: string;
}) {
  const figureRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<HTMLDivElement>(null);
  const surfaceRef = useRef<HTMLImageElement>(null);
  const fullscreenTriggerRef = useRef<HTMLButtonElement>(null);
  const fullscreenCloseRef = useRef<HTMLButtonElement>(null);
  const fullscreenWasOpenRef = useRef(false);
  const displayStartedRef = useRef(0);
  const hintId = useId();
  const graphViewerKey = `${documentName}::${block.id}`;
  const [renderNonce, setRenderNonce] = useState(0);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(
    () => activeFallbackGraphViewerKey === graphViewerKey,
  );
  const fullscreen = fallbackFullscreen;
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
  const intrinsicSize = useMemo(() => mermaidSvgIntrinsicSize(svg), [svg]);

  useEffect(() => {
    if (blobUrl) displayStartedRef.current = performance.now();
  }, [blobUrl]);
  const viewport = useMermaidViewport({
    enabled: fullscreen,
    contentRef: surfaceRef,
  });
  const { fitView, resetView: resetViewport } = viewport;
  const statusLabel = useMemo(() => {
    if (renderState.status === "loading") return "در حال ساخت نمودار";
    if (renderState.status === "invalid") return "نمودار نیاز به اصلاح دارد";
    return "نمودار Mermaid";
  }, [renderState.status]);
  const diagramTitle = accessibleName || "نمودار Mermaid";
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
          onLoad={() => {
            recordMermaidMeasure(
              block.id,
              "display",
              displayStartedRef.current || performance.now(),
            );
            if (fullscreen) {
              window.requestAnimationFrame(() =>
                fitView(
                  renderRef.current,
                  surfaceRef.current,
                  intrinsicSize,
                ),
              );
            }
          }}
        />
      ) : null,
    [
      accessibleName,
      blobUrl,
      block.id,
      fullscreen,
      intrinsicSize,
      renderState.renderKey,
      fitView,
    ],
  );

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isOpen = document.fullscreenElement === figureRef.current;
      setNativeFullscreen(isOpen);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [reportFullscreenChange]);

  useEffect(() => {
    reportFullscreenChange(fullscreen);
  }, [fullscreen, reportFullscreenChange]);

  const closeGraphViewer = useCallback(async () => {
    if (activeFallbackGraphViewerKey === graphViewerKey) {
      activeFallbackGraphViewerKey = null;
    }
    setFallbackFullscreen(false);
    if (document.fullscreenElement === figureRef.current) {
      try {
        await document.exitFullscreen();
      } catch {
        // The viewer still closes even when the host rejects a fullscreen exit.
      }
    }
  }, [graphViewerKey]);

  const openGraphViewer = useCallback(() => {
    activeFallbackGraphViewerKey = graphViewerKey;
    setFallbackFullscreen(true);
  }, [graphViewerKey]);

  const handleFullscreenKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!fullscreen) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        void closeGraphViewer();
        return;
      }

      if (event.key !== "Tab") return;
      const figure = figureRef.current;
      if (!figure) return;
      const focusable = fullscreenFocusableElements(figure);
      if (!focusable.length) {
        event.preventDefault();
        figure.focus();
        return;
      }
      const activeIndex = focusable.indexOf(
        document.activeElement as HTMLElement,
      );
      const nextIndex = event.shiftKey
        ? activeIndex <= 0
          ? focusable.length - 1
          : activeIndex - 1
        : activeIndex === -1 || activeIndex === focusable.length - 1
          ? 0
          : activeIndex + 1;
      event.preventDefault();
      focusable[nextIndex]?.focus();
    },
    [closeGraphViewer, fullscreen],
  );

  const toggleNativeFullscreen = useCallback(async () => {
    const figure = figureRef.current;
    if (!figure) return;
    try {
      if (document.fullscreenElement === figure) {
        await document.exitFullscreen();
      } else {
        await figure.requestFullscreen();
      }
    } catch {
      // Graph Viewer remains available when native fullscreen is unavailable.
    }
  }, []);

  useLayoutEffect(() => {
    if (!fullscreen) return;
    const figure = figureRef.current;
    if (!figure) return;
    const previousOverflow = document.body.style.overflow;
    if (fallbackFullscreen) document.body.style.overflow = "hidden";
    const restoreOutsideInert = fallbackFullscreen
      ? makeOutsideSubtreeInert(figure)
      : null;
    // Escape can arrive before the next frame moves focus into the viewer.
    // Capture at the window while this modal is open, including that gap.
    window.addEventListener("keydown", handleFullscreenKeyDown, true);
    return () => {
      if (fallbackFullscreen) document.body.style.overflow = previousOverflow;
      restoreOutsideInert?.();
      window.removeEventListener("keydown", handleFullscreenKeyDown, true);
    };
  }, [fallbackFullscreen, fullscreen, handleFullscreenKeyDown]);

  useEffect(() => {
    if (fullscreen) {
      fullscreenWasOpenRef.current = true;
      const focusClose = () =>
        (fullscreenCloseRef.current ?? figureRef.current)?.focus({
          preventScroll: true,
        });
      const frame = window.requestAnimationFrame(() => {
        focusClose();
      });
      const settleFocus = window.setTimeout(focusClose, 220);
      return () => {
        window.cancelAnimationFrame(frame);
        window.clearTimeout(settleFocus);
      };
    }

    if (!fullscreenWasOpenRef.current) return;
    fullscreenWasOpenRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      fullscreenTriggerRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fullscreen, svg]);

  useEffect(() => {
    if (readingMode) return;
    if (activeFallbackGraphViewerKey === graphViewerKey) {
      activeFallbackGraphViewerKey = null;
    }
    const resetFallback = window.setTimeout(
      () => setFallbackFullscreen(false),
      0,
    );
    if (document.fullscreenElement === figureRef.current) {
      void document.exitFullscreen();
    }
    return () => window.clearTimeout(resetFallback);
  }, [graphViewerKey, readingMode]);

  useEffect(() => {
    if (!fullscreen) {
      resetViewport();
      const surface = surfaceRef.current;
      surface?.style.removeProperty("width");
      surface?.style.removeProperty("height");
      surface?.style.removeProperty("max-width");
      surface?.style.removeProperty("max-height");
      return;
    }
    if (!svg || !surfaceRef.current?.complete) return;
    const frame = window.requestAnimationFrame(() =>
      fitView(renderRef.current, surfaceRef.current, intrinsicSize),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [fitView, fullscreen, intrinsicSize, resetViewport, svg]);

  const fitDiagram = () =>
    fitView(renderRef.current, surfaceRef.current, intrinsicSize);

  const editFromDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest("a, button, input, textarea, [role='button']")
    ) {
      return;
    }
    if (readingMode) {
      if (!fullscreen) openGraphViewer();
    } else {
      onEdit(block);
    }
  };

  const diagramSurface = svgSurface ?? (renderState.status !== "invalid" ? (
    <div className="mermaid-diagram-placeholder" role="status">
      {virtualization.mounted && <LoaderCircle size={22} aria-hidden="true" />}
      <span>
        {virtualization.mounted
          ? "در حال ساخت نمودار…"
          : "نمودار هنگام نزدیک‌شدن به محدودهٔ دید نمایش داده می‌شود."}
      </span>
    </div>
  ) : null);

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
      data-mermaid-view={fullscreen ? "graph-viewer" : "inline"}
      role={fullscreen ? "dialog" : undefined}
      aria-modal={fullscreen || undefined}
      aria-label={fullscreen ? `Graph Viewer: ${diagramTitle}` : undefined}
      aria-describedby={fullscreen ? undefined : hintId}
      tabIndex={fullscreen ? -1 : undefined}
      onDoubleClick={editFromDoubleClick}
    >
      {readingMode && !fullscreen && (
        <figcaption className="mermaid-reading-meta">
          <strong>{diagramTitle}</strong>
          <span>Mermaid · رندر شده در سند</span>
        </figcaption>
      )}
      {readingMode && fullscreen && (
        <header className="mermaid-graph-viewer-header">
          <button
            ref={fullscreenCloseRef}
            className="mermaid-graph-viewer-return"
            dir="ltr"
            type="button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void closeGraphViewer();
            }}
            onKeyDown={(event) => {
              if (event.key !== "Tab") return;
              const figure = figureRef.current;
              if (!figure) return;
              const focusable = fullscreenFocusableElements(figure);
              event.preventDefault();
              event.stopPropagation();
              event.nativeEvent.stopImmediatePropagation();
              const next = event.shiftKey
                ? focusable.at(-1)
                : focusable.find((element) => element !== event.currentTarget);
              next?.focus();
            }}
            onClick={() => void closeGraphViewer()}
            aria-label="بازگشت به سند"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            <span dir="rtl">بازگشت به سند</span>
          </button>
          <h2 dir="rtl">
            <span>{diagramTitle}</span>
            <span aria-hidden="true"> · </span>
            <bdi>{documentName}</bdi>
          </h2>
        </header>
      )}
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
        {readingMode && fullscreen && svg && (
          <div
            className="mermaid-diagram-viewport-tools mermaid-preview-tools"
            role="toolbar"
            aria-label="کنترل نمای نمودار"
          >
            <button
              type="button"
              onClick={() => viewport.zoomBy(-0.15)}
              aria-label="کوچک‌نمایی نمودار"
              title="کوچک‌نمایی"
            >
              <ZoomOut size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => viewport.zoomBy(0.15)}
              aria-label="بزرگ‌نمایی نمودار"
              title="بزرگ‌نمایی"
            >
              <ZoomIn size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={fitDiagram}
              aria-label="جا دادن کامل نمودار در کادر"
              title="نمایش کامل طول و عرض نمودار در کادر"
            >
              <FitScreen size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => void toggleNativeFullscreen()}
              aria-label={
                nativeFullscreen
                  ? "خروج از تمام‌صفحهٔ سیستم"
                  : "نمایش Graph Viewer در تمام‌صفحهٔ سیستم"
              }
              aria-pressed={nativeFullscreen}
              title={nativeFullscreen ? "خروج از تمام‌صفحه" : "تمام‌صفحه"}
            >
              {nativeFullscreen ? (
                <Minimize2 size={18} aria-hidden="true" />
              ) : (
                <Fullscreen size={18} aria-hidden="true" />
              )}
            </button>
            <output
              className="visually-hidden mermaid-graph-viewer-scale"
              aria-live="polite"
              aria-label={`بزرگ‌نمایی ${viewport.scalePercent} درصد`}
            >
              {viewport.scalePercent.toLocaleString("fa-IR")}٪
            </output>
          </div>
        )}
        {readingMode && fullscreen ? (
          <section
            className="mermaid-graph-viewer-preview"
            aria-label={`پیش‌نمایش ${diagramTitle}`}
          >
            <div ref={renderRef} className="mermaid-graph-viewer-render">
              {diagramSurface}
            </div>
          </section>
        ) : (
          diagramSurface
        )}
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
          </div>
        )}
        {(!readingMode || !fullscreen) && (
          <button
            ref={fullscreenTriggerRef}
            className="mermaid-diagram-action"
            dir={readingMode ? "ltr" : undefined}
            type="button"
            onPointerDown={(event) => {
              event.stopPropagation();
              if (readingMode) {
                openGraphViewer();
              }
            }}
            onMouseUp={(event) => event.stopPropagation()}
            onClickCapture={(event) => {
              if (!readingMode) return;
              event.preventDefault();
              event.stopPropagation();
              event.nativeEvent.stopImmediatePropagation();
              openGraphViewer();
            }}
            onClick={() => {
              if (readingMode) {
                return;
              }
              onEdit(block);
            }}
            aria-label={
              readingMode
                ? "نمایش تمام‌صفحهٔ نمودار"
                : "ویرایش این نمودار"
            }
            aria-haspopup={readingMode ? "dialog" : undefined}
            aria-expanded={readingMode ? false : undefined}
            title={
              readingMode
                ? "نمایش تمام‌صفحهٔ نمودار"
                : "ویرایش این نمودار"
            }
          >
            {readingMode ? (
              <Fullscreen size={18} aria-hidden="true" />
            ) : (
              <PencilLine size={15} aria-hidden="true" />
            )}
            <span dir={readingMode ? "rtl" : undefined}>
              {readingMode ? "تمام‌صفحه" : "ویرایش"}
            </span>
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
      <p className="mermaid-diagram-hint" id={hintId}>
        {readingMode
          ? fullscreen
            ? "با چرخ ماوس زوم کنید، برای جابه‌جایی بکشید و با Escape به متن برگردید."
            : "برای بررسی دقیق نمودار، دکمهٔ تمام‌صفحه را بزنید."
          : "برای ویرایش همین نمودار، دوبار کلیک کنید."}
      </p>
    </figure>
  );
});
