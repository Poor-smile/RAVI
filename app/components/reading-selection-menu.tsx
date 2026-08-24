"use client";

import {
  Highlighter,
  MessageSquareText,
} from "@/app/icons/material-symbols";
import {
  forwardRef,
  type CSSProperties,
  type KeyboardEvent,
  type RefObject,
} from "react";

type ReadingSelectionMenuProps = {
  onHighlight: () => void;
  onComment: () => void;
  commentButtonRef: RefObject<HTMLButtonElement | null>;
  highlightKeyShortcuts?: string;
  commentKeyShortcuts?: string;
  highlightTitle?: string;
  commentTitle?: string;
  className?: string;
  style?: CSSProperties;
};

export const ReadingSelectionMenu = forwardRef<
  HTMLDivElement,
  ReadingSelectionMenuProps
>(function ReadingSelectionMenu(
  {
    onHighlight,
    onComment,
    commentButtonRef,
    highlightKeyShortcuts,
    commentKeyShortcuts,
    highlightTitle = "هایلایت",
    commentTitle = "نظر",
    className = "",
    style,
  },
  ref,
) {
  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>("button"),
    );
    if (!items.length) return;

    const currentIndex = items.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    let nextIndex = currentIndex;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      nextIndex =
        currentIndex < 0
          ? items.length - 1
          : (currentIndex - 1 + items.length) % items.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    items[nextIndex]?.focus({ preventScroll: true });
  };

  return (
    <div
      ref={ref}
      className={`reading-selection-menu ${className}`.trim()}
      style={style}
      role="toolbar"
      aria-label="ابزار متن انتخاب‌شده"
      aria-orientation="horizontal"
      onKeyDown={moveFocus}
      onPointerDown={(event) => {
        if (event.pointerType === "mouse") event.preventDefault();
      }}
    >
      <button
        className="reading-selection-action reading-selection-action--highlight"
        type="button"
        data-selection-action="highlight"
        onClick={onHighlight}
        aria-keyshortcuts={highlightKeyShortcuts}
        title={highlightTitle}
      >
        <Highlighter size={18} aria-hidden="true" />
        <span>هایلایت</span>
      </button>
      <button
        ref={commentButtonRef}
        className="reading-selection-action reading-selection-action--comment"
        type="button"
        data-selection-action="comment"
        onClick={onComment}
        aria-keyshortcuts={commentKeyShortcuts}
        title={commentTitle}
      >
        <MessageSquareText size={18} aria-hidden="true" />
        <span>نظر</span>
      </button>
    </div>
  );
});
