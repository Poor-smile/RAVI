"use client";

import {
  KeyboardEventHandler,
  MouseEvent,
  ReactNode,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ModalLayerId =
  | "about"
  | "closeDocument"
  | "commandPalette"
  | "export"
  | "externalLink"
  | "fileOperation"
  | "formula"
  | "image"
  | "library"
  | "mermaid"
  | "mobileMenu"
  | "new"
  | "quickOpen"
  | "save"
  | "settings"
  | "support"
  | "shortcuts";

export function useModalStack() {
  const [stack, setStack] = useState<ModalLayerId[]>([]);

  const syncLayer = useCallback((id: ModalLayerId, open: boolean) => {
    setStack((current) => {
      const exists = current.includes(id);
      if (open && !exists) return [...current, id];
      if (!open && exists) return current.filter((item) => item !== id);
      return current;
    });
  }, []);

  return useMemo(
    () => ({
      stack,
      topLayer: stack.at(-1) ?? null,
      syncLayer,
    }),
    [stack, syncLayer],
  );
}

function focusableElements(container: HTMLElement) {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      [
        "button:not([disabled])",
        "input:not([disabled])",
        "textarea:not([disabled])",
        "select:not([disabled])",
        "[href]",
        '[tabindex]:not([tabindex="-1"])',
      ].join(","),
    ),
  ).filter(
    (element) =>
      element.offsetParent !== null &&
      element.getAttribute("aria-hidden") !== "true",
  );
}

export function useModalFocus({
  open,
  isTopLayer,
  containerRef,
  initialFocusRef,
  returnFocusRef,
  trapFocus = true,
}: {
  open: boolean;
  isTopLayer: boolean;
  containerRef: RefObject<HTMLElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  trapFocus?: boolean;
}) {
  const capturedOpenerRef = useRef<HTMLElement | null>(null);
  const latestReturnFocusRef = useRef(returnFocusRef);

  useEffect(() => {
    latestReturnFocusRef.current = returnFocusRef;
  }, [returnFocusRef]);

  useEffect(() => {
    if (!open) return;
    const explicitReturnTarget = returnFocusRef?.current ?? null;
    capturedOpenerRef.current =
      explicitReturnTarget ??
      (document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null);

    return () => {
      const target =
        latestReturnFocusRef.current?.current ??
        explicitReturnTarget ??
        capturedOpenerRef.current;
      if (target?.isConnected) requestAnimationFrame(() => target.focus());
    };
  }, [open, returnFocusRef]);

  useEffect(() => {
    if (!open || !isTopLayer) return;
    const container = containerRef.current;
    if (!container) return;

    const focusInitial = () => {
      const preferred = initialFocusRef?.current;
      const target =
        preferred && container.contains(preferred)
          ? preferred
          : focusableElements(container)[0] ?? container;
      target.focus();
    };
    requestAnimationFrame(focusInitial);

    if (!trapFocus) return;

    const trapTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusableElements(container);
      if (!items.length) {
        event.preventDefault();
        container.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const containFocus = (event: FocusEvent) => {
      if (
        event.target instanceof Node &&
        !container.contains(event.target)
      ) {
        focusInitial();
      }
    };

    document.addEventListener("keydown", trapTab);
    document.addEventListener("focusin", containFocus);
    return () => {
      document.removeEventListener("keydown", trapTab);
      document.removeEventListener("focusin", containFocus);
    };
  }, [containerRef, initialFocusRef, isTopLayer, open, trapFocus]);
}

export function AccessibleModal({
  open,
  isTopLayer,
  onClose,
  dialogRef,
  initialFocusRef,
  returnFocusRef,
  backdropClassName,
  dialogClassName,
  labelledBy,
  describedBy,
  containerId,
  containerRole = "dialog",
  ariaModal = true,
  trapFocus = true,
  onKeyDown,
  children,
}: {
  open: boolean;
  isTopLayer: boolean;
  onClose: () => void;
  dialogRef: RefObject<HTMLDivElement | null>;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  backdropClassName: string;
  dialogClassName: string;
  labelledBy: string;
  describedBy?: string;
  containerId?: string;
  containerRole?: "dialog" | "alertdialog" | "menu";
  ariaModal?: boolean;
  trapFocus?: boolean;
  onKeyDown?: KeyboardEventHandler<HTMLDivElement>;
  children: ReactNode;
}) {
  useModalFocus({
    open,
    isTopLayer,
    containerRef: dialogRef,
    initialFocusRef,
    returnFocusRef,
    trapFocus,
  });

  if (!open) return null;

  const closeFromBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (isTopLayer && event.target === event.currentTarget) onClose();
  };

  return (
    <div
      className={backdropClassName}
      role="presentation"
      onMouseDown={closeFromBackdrop}
    >
      <div
        id={containerId}
        ref={dialogRef}
        className={dialogClassName}
        role={containerRole}
        aria-modal={(containerRole === "dialog" || containerRole === "alertdialog") && ariaModal ? true : undefined}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
