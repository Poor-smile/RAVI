"use client";

import {
  TextDecrease,
  TextIncrease,
} from "@/app/icons/material-symbols";
import { forwardRef, type KeyboardEvent } from "react";

type ReadingToolsMenuProps = {
  size: number;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseKeyShortcuts?: string;
  increaseKeyShortcuts?: string;
  decreaseTitle?: string;
  increaseTitle?: string;
};

export const ReadingToolsMenu = forwardRef<
  HTMLDivElement,
  ReadingToolsMenuProps
>(function ReadingToolsMenu(
  {
    size,
    onDecrease,
    onIncrease,
    decreaseKeyShortcuts,
    increaseKeyShortcuts,
    decreaseTitle = "کوچک‌تر کردن متن",
    increaseTitle = "بزرگ‌تر کردن متن",
  },
  ref,
) {
  const localizedSize = size.toLocaleString("fa-IR");

  const moveFocus = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ),
    );
    if (!items.length) return;

    const currentIndex = items.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % items.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
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
    <>
      <div
        ref={ref}
        className="reading-tools-menu"
        id="reading-tools-menu"
        role="menu"
        aria-label="ابزار مطالعه"
        onKeyDown={moveFocus}
      >
        <button
          type="button"
          role="menuitem"
          data-reading-size-action="decrease"
          onClick={onDecrease}
          disabled={size <= 16}
          aria-label="کوچک‌تر کردن متن"
          aria-keyshortcuts={decreaseKeyShortcuts}
          title={decreaseTitle}
        >
          <TextDecrease size={18} aria-hidden="true" />
        </button>
        <span
          className="reading-tools-size-value"
          role="presentation"
          aria-hidden="true"
        >
          {localizedSize}
        </span>
        <button
          type="button"
          role="menuitem"
          data-reading-size-action="increase"
          onClick={onIncrease}
          disabled={size >= 22}
          aria-label="بزرگ‌تر کردن متن"
          aria-keyshortcuts={increaseKeyShortcuts}
          title={increaseTitle}
        >
          <TextIncrease size={18} aria-hidden="true" />
        </button>
      </div>
      <span
        className="visually-hidden"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {`اندازهٔ متن: ${localizedSize} پیکسل`}
      </span>
    </>
  );
});
