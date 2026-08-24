"use client";

import {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  RefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

const MIN_SCALE = 0.05;
const MAX_SCALE = 4;
const SCALE_SYNC_INTERVAL_MS = 100;

type MermaidViewportState = { scale: number; x: number; y: number };
export type MermaidIntrinsicSize = { width: number; height: number };
type DragState = {
  pointerId: number;
  clientX: number;
  clientY: number;
  originX: number;
  originY: number;
};

const INITIAL_VIEW: MermaidViewportState = { scale: 1, x: 0, y: 0 };

function clampScale(scale: number) {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
}

export function calculateMermaidFitScale({
  availableWidth,
  availableHeight,
  contentWidth,
  contentHeight,
}: {
  availableWidth: number;
  availableHeight: number;
  contentWidth: number;
  contentHeight: number;
}) {
  if (
    availableWidth <= 0 ||
    availableHeight <= 0 ||
    contentWidth <= 0 ||
    contentHeight <= 0
  ) return 1;
  return clampScale(
    Math.min(1, availableWidth / contentWidth, availableHeight / contentHeight),
  );
}

export function useMermaidViewport({
  enabled = true,
  contentRef,
}: {
  enabled?: boolean;
  contentRef?: RefObject<HTMLElement | null>;
} = {}) {
  const [scalePercent, setScalePercent] = useState(100);
  const [panning, setPanning] = useState(false);
  const viewRef = useRef<MermaidViewportState>(INITIAL_VIEW);
  const dragRef = useRef<DragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const scaleTimerRef = useRef<number | null>(null);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    reducedMotionRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (scaleTimerRef.current !== null) window.clearTimeout(scaleTimerRef.current);
    };
  }, []);

  const applyTransform = useCallback(() => {
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const element = contentRef?.current;
      if (!element) return;
      const current = viewRef.current;
      element.style.transform = `translate3d(${current.x}px, ${current.y}px, 0) scale(${current.scale})`;
      element.style.transition =
        dragRef.current || reducedMotionRef.current ? "none" : "";
    });
  }, [contentRef]);

  const syncScale = useCallback((immediate = false) => {
    const update = () => {
      scaleTimerRef.current = null;
      setScalePercent(Math.round(viewRef.current.scale * 100));
    };
    if (immediate) {
      if (scaleTimerRef.current !== null) window.clearTimeout(scaleTimerRef.current);
      update();
    } else if (scaleTimerRef.current === null) {
      scaleTimerRef.current = window.setTimeout(update, SCALE_SYNC_INTERVAL_MS);
    }
  }, []);

  const updateView = useCallback(
    (
      update:
        | MermaidViewportState
        | ((current: MermaidViewportState) => MermaidViewportState),
      immediateScaleSync = false,
    ) => {
      viewRef.current =
        typeof update === "function" ? update(viewRef.current) : update;
      applyTransform();
      syncScale(immediateScaleSync);
    },
    [applyTransform, syncScale],
  );

  const resetView = useCallback(() => {
    dragRef.current = null;
    setPanning(false);
    updateView(INITIAL_VIEW, true);
  }, [updateView]);

  const fitView = useCallback(
    (
      container: HTMLElement | null,
      content: HTMLElement | null,
      intrinsicSize?: MermaidIntrinsicSize | null,
    ) => {
      if (!container || !content) {
        resetView();
        return;
      }
      const style = window.getComputedStyle(container);
      const paddingInlineStart = Number.parseFloat(style.paddingInlineStart) || 0;
      const paddingInlineEnd = Number.parseFloat(style.paddingInlineEnd) || 0;
      const paddingTop = Number.parseFloat(style.paddingTop) || 0;
      const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
      // Blob-backed SVG images may expose the browser's 300×150 fallback as
      // their natural size. Keep the element at the actual SVG viewBox size so
      // the viewport transform is calculated from the complete graph bounds.
      const contentWidth = intrinsicSize?.width ?? content.offsetWidth;
      const contentHeight = intrinsicSize?.height ?? content.offsetHeight;
      if (intrinsicSize?.width && intrinsicSize.height) {
        content.style.width = `${intrinsicSize.width}px`;
        content.style.height = `${intrinsicSize.height}px`;
        content.style.maxWidth = "none";
        content.style.maxHeight = "none";
      }
      const availableWidth =
        container.clientWidth - paddingInlineStart - paddingInlineEnd;
      const availableHeight = container.clientHeight - paddingTop - paddingBottom;
      const scale = calculateMermaidFitScale({
        availableWidth,
        availableHeight,
        contentWidth,
        contentHeight,
      });
      const fittedHeight = contentHeight * scale;
      dragRef.current = null;
      setPanning(false);
      updateView(
        {
          scale,
          x: 0,
          y: Math.max(0, (availableHeight - fittedHeight) / 2),
        },
        true,
      );
    },
    [resetView, updateView],
  );

  const zoomTo = useCallback(
    (requestedScale: number, anchor?: { x: number; y: number }) => {
      updateView((current) => {
        const scale = clampScale(requestedScale);
        if (scale === current.scale) return current;
        if (!anchor) return { ...current, scale };
        const ratio = scale / current.scale;
        return {
          scale,
          x: anchor.x - (anchor.x - current.x) * ratio,
          y: anchor.y - (anchor.y - current.y) * ratio,
        };
      });
    },
    [updateView],
  );

  const zoomBy = useCallback(
    (delta: number) => zoomTo(viewRef.current.scale + delta),
    [zoomTo],
  );

  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLElement>) => {
      if (!enabled) return;
      event.preventDefault();
      const rect = event.currentTarget.getBoundingClientRect();
      const anchor = {
        x: event.clientX - rect.left - rect.width / 2,
        y: event.clientY - rect.top - rect.height / 2,
      };
      zoomTo(viewRef.current.scale * Math.exp(-event.deltaY * 0.0015), anchor);
    },
    [enabled, zoomTo],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0 || !event.isPrimary) return;
      if (
        event.target instanceof Element &&
        event.target.closest("button, a, input, textarea, select")
      ) return;
      event.preventDefault();
      const current = viewRef.current;
      dragRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        originX: current.x,
        originY: current.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setPanning(true);
      applyTransform();
    },
    [applyTransform, enabled],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      viewRef.current = {
        ...viewRef.current,
        x: drag.originX + event.clientX - drag.clientX,
        y: drag.originY + event.clientY - drag.clientY,
      };
      applyTransform();
    },
    [applyTransform],
  );

  const finishPan = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setPanning(false);
      syncScale(true);
      applyTransform();
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [applyTransform, syncScale],
  );

  return {
    scalePercent,
    panning,
    zoomBy,
    resetView,
    fitView,
    viewportHandlers: {
      onWheel: handleWheel,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: finishPan,
      onPointerCancel: finishPan,
      onLostPointerCapture: finishPan,
    },
  };
}
