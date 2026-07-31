"use client";

import {
  AlertTriangle,
  LoaderCircle,
  Maximize2,
  Minimize2,
  PencilLine,
} from "lucide-react";
import { MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { MermaidBlock } from "../mermaid/blocks";
import { MermaidTheme } from "../mermaid/renderer";
import { useMermaidRender } from "../mermaid/use-mermaid-render";

export function MermaidDiagram({
  block,
  theme,
  onEdit,
  readingMode = false,
}: {
  block: MermaidBlock;
  theme: MermaidTheme;
  onEdit: (block: MermaidBlock) => void;
  readingMode?: boolean;
}) {
  const figureRef = useRef<HTMLElement>(null);
  const [nativeFullscreen, setNativeFullscreen] = useState(false);
  const [fallbackFullscreen, setFallbackFullscreen] = useState(false);
  const renderState = useMermaidRender(block.code, theme);
  const svg = renderState.svg || renderState.lastValidSvg;
  const fullscreen = nativeFullscreen || fallbackFullscreen;
  const statusLabel = useMemo(() => {
    if (renderState.status === "loading") return "در حال ساخت نمودار";
    if (renderState.status === "invalid") return "نمودار نیاز به اصلاح دارد";
    return "نمودار Mermaid";
  }, [renderState.status]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setNativeFullscreen(document.fullscreenElement === figureRef.current);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!fallbackFullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFallbackFullscreen(false);
    };
    document.addEventListener("keydown", closeWithEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeWithEscape);
    };
  }, [fallbackFullscreen]);

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
    try {
      await figure.requestFullscreen();
    } catch {
      setFallbackFullscreen(true);
    }
  };

  const editFromDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest("a, button, input, textarea, [role='button']")
    ) {
      return;
    }
    if (readingMode) {
      void toggleFullscreen();
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
        className="mermaid-diagram-canvas"
        aria-label={statusLabel}
        aria-busy={renderState.status === "loading"}
      >
        {svg ? (
          <div
            className="mermaid-svg mermaid-render-surface"
            data-mermaid-render-key={renderState.renderKey}
            // Mermaid runs in strict mode and the SVG is sanitized again locally.
            dangerouslySetInnerHTML={{ __html: svg }}
          />
        ) : renderState.status === "loading" ? (
          <div className="mermaid-diagram-placeholder" role="status">
            <LoaderCircle size={22} aria-hidden="true" />
            <span>در حال ساخت نمودار…</span>
          </div>
        ) : null}
        <button
          className="mermaid-diagram-action"
          type="button"
          onClick={() =>
            readingMode ? void toggleFullscreen() : onEdit(block)
          }
          aria-label={
            readingMode
              ? fullscreen
                ? "بستن نمای تمام‌صفحهٔ نمودار"
                : "نمایش تمام‌صفحهٔ نمودار"
              : "ویرایش این نمودار"
          }
          aria-pressed={readingMode ? fullscreen : undefined}
          title={
            readingMode
              ? fullscreen
                ? "بستن نمای تمام‌صفحه (Esc)"
                : "نمایش تمام‌صفحهٔ نمودار"
              : "ویرایش این نمودار"
          }
        >
          {readingMode ? (
            fullscreen ? (
              <Minimize2 size={15} aria-hidden="true" />
            ) : (
              <Maximize2 size={15} aria-hidden="true" />
            )
          ) : (
            <PencilLine size={15} aria-hidden="true" />
          )}
          <span>
            {readingMode ? (fullscreen ? "بستن" : "تمام‌صفحه") : "ویرایش"}
          </span>
        </button>
      </div>
      {renderState.status === "invalid" && renderState.error && (
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
            ? "برای بازگشت به متن، Escape را بزنید یا نمای تمام‌صفحه را ببندید."
            : "برای بررسی دقیق نمودار، دکمهٔ تمام‌صفحه را بزنید."
          : "برای ویرایش همین نمودار، دوبار کلیک کنید."}
      </figcaption>
    </figure>
  );
}
