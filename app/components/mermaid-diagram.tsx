"use client";

import { AlertTriangle, LoaderCircle, PencilLine } from "lucide-react";
import { MouseEvent, useMemo } from "react";
import { MermaidBlock } from "../mermaid/blocks";
import { MermaidTheme } from "../mermaid/renderer";
import { useMermaidRender } from "../mermaid/use-mermaid-render";

export function MermaidDiagram({
  block,
  theme,
  onEdit,
}: {
  block: MermaidBlock;
  theme: MermaidTheme;
  onEdit: (block: MermaidBlock) => void;
}) {
  const renderState = useMermaidRender(block.code, theme);
  const svg = renderState.svg || renderState.lastValidSvg;
  const statusLabel = useMemo(() => {
    if (renderState.status === "loading") return "در حال ساخت نمودار";
    if (renderState.status === "invalid") return "نمودار نیاز به اصلاح دارد";
    return "نمودار Mermaid";
  }, [renderState.status]);

  const editFromDoubleClick = (event: MouseEvent<HTMLElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest("a, button, input, textarea, [role='button']")
    ) {
      return;
    }
    onEdit(block);
  };

  return (
    <figure
      className={`mermaid-diagram is-${renderState.status}`}
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
            className="mermaid-svg"
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
          className="mermaid-diagram-edit"
          type="button"
          onClick={() => onEdit(block)}
          aria-label="ویرایش این نمودار"
          title="ویرایش این نمودار"
        >
          <PencilLine size={15} aria-hidden="true" />
          <span>ویرایش</span>
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
        برای ویرایش همین نمودار، دوبار کلیک کنید.
      </figcaption>
    </figure>
  );
}
