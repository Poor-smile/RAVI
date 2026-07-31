"use client";

import {
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
  useCallback,
  useRef,
  useState,
} from "react";

const MIN_SCALE = 0.05;
const MAX_SCALE = 4;

type MermaidViewportState = {
  scale: number;
  x: number;
  y: number;
};

type DragState = {
  pointerId: number;
  clientX: number;
  clientY: number;
  originX: number;
  originY: number;
};

const INITIAL_VIEW: MermaidViewportState = {
  scale: 1,
  x: 0,
  y: 0,
};

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
  ) {
    return 1;
  }
  return clampScale(
    Math.min(1, availableWidth / contentWidth, availableHeight / contentHeight),
  );
}

export function useMermaidViewport({ enabled = true } = {}) {
  const [view, setViewState] =
    useState<MermaidViewportState>(INITIAL_VIEW);
  const [panning, setPanning] = useState(false);
  const viewRef = useRef(view);
  const dragRef = useRef<DragState | null>(null);

  const updateView = useCallback(
    (
      update:
        | MermaidViewportState
        | ((current: MermaidViewportState) => MermaidViewportState),
    ) => {
      setViewState((current) => {
        const next =
          typeof update === "function" ? update(current) : update;
        viewRef.current = next;
        return next;
      });
    },
    [],
  );

  const resetView = useCallback(() => {
    dragRef.current = null;
    setPanning(false);
    updateView(INITIAL_VIEW);
  }, [updateView]);

  const fitView = useCallback(
    (container: HTMLElement | null, content: HTMLElement | null) => {
      if (!container || !content) {
        resetView();
        return;
      }

      const containerStyle = window.getComputedStyle(container);
      const horizontalPadding =
        Number.parseFloat(containerStyle.paddingInlineStart) +
        Number.parseFloat(containerStyle.paddingInlineEnd);
      const verticalPadding =
        Number.parseFloat(containerStyle.paddingTop) +
        Number.parseFloat(containerStyle.paddingBottom);
      const scale = calculateMermaidFitScale({
        availableWidth: container.clientWidth - horizontalPadding,
        availableHeight: container.clientHeight - verticalPadding,
        contentWidth: content.offsetWidth,
        contentHeight: content.offsetHeight,
      });
      const containerRect = container.getBoundingClientRect();
      const contentRect = content.getBoundingClientRect();
      const paddingInlineStart = Number.parseFloat(
        containerStyle.paddingInlineStart,
      );
      const paddingTop = Number.parseFloat(containerStyle.paddingTop);
      const availableWidth = container.clientWidth - horizontalPadding;
      const availableHeight = container.clientHeight - verticalPadding;
      const targetCenter = {
        x:
          containerRect.left +
          container.clientLeft +
          paddingInlineStart +
          availableWidth / 2,
        y:
          containerRect.top +
          container.clientTop +
          paddingTop +
          availableHeight / 2,
      };
      const current = viewRef.current;
      const layoutCenter =
        content.offsetParent === container
          ? {
              x:
                containerRect.left +
                container.clientLeft +
                content.offsetLeft +
                content.offsetWidth / 2,
              y:
                containerRect.top +
                container.clientTop +
                content.offsetTop +
                content.offsetHeight / 2,
            }
          : {
              x: contentRect.left + contentRect.width / 2 - current.x,
              y: contentRect.top + contentRect.height / 2 - current.y,
            };

      dragRef.current = null;
      setPanning(false);
      updateView({
        scale,
        x: targetCenter.x - layoutCenter.x,
        y: targetCenter.y - layoutCenter.y,
      });
    },
    [resetView, updateView],
  );

  const zoomTo = useCallback(
    (
      requestedScale: number,
      anchor?: { x: number; y: number },
    ) => {
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
    (delta: number) => {
      zoomTo(viewRef.current.scale + delta);
    },
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
      const factor = Math.exp(-event.deltaY * 0.0015);
      zoomTo(viewRef.current.scale * factor, anchor);
    },
    [enabled, zoomTo],
  );

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (!enabled || event.button !== 0 || !event.isPrimary) return;
      if (
        event.target instanceof Element &&
        event.target.closest("button, a, input, textarea, select")
      ) {
        return;
      }

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
    },
    [enabled],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      updateView((current) => ({
        ...current,
        x: drag.originX + event.clientX - drag.clientX,
        y: drag.originY + event.clientY - drag.clientY,
      }));
    },
    [updateView],
  );

  const finishPan = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      if (dragRef.current?.pointerId !== event.pointerId) return;
      dragRef.current = null;
      setPanning(false);
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [],
  );

  return {
    scale: view.scale,
    scalePercent: Math.round(view.scale * 100),
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
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
