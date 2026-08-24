"use client";

import { FileDown, FileText, Save } from "@/app/icons/material-symbols";
import { useEffect, useRef, type RefObject } from "react";
import type { CommandId } from "../keyboard/command-registry";

type SaveState = "saved" | "dirty" | "saving" | "error";

export function DocumentMenuPopover({
  buttonRef,
  executeCommand,
  onClose,
  saveState,
}: {
  buttonRef: RefObject<HTMLButtonElement | null>;
  executeCommand: (id: CommandId) => void;
  onClose: () => void;
  saveState: SaveState;
}) {
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    firstItemRef.current?.focus({ preventScroll: true });
  }, []);

  const run = (commandId: CommandId) => {
    onClose();
    buttonRef.current?.focus({ preventScroll: true });
    executeCommand(commandId);
  };

  return (
    <div
      className="document-menu-popover"
      id="document-menu-popover"
      role="menu"
      aria-label="منوی سند"
      onKeyDown={(event) => {
        const items = Array.from(
          event.currentTarget.querySelectorAll<HTMLButtonElement>(
            '[role="menuitem"]:not(:disabled)',
          ),
        );
        const currentIndex = items.indexOf(
          document.activeElement as HTMLButtonElement,
        );
        let nextIndex = currentIndex;
        if (event.key === "ArrowDown") {
          nextIndex = (currentIndex + 1) % items.length;
        } else if (event.key === "ArrowUp") {
          nextIndex = (currentIndex - 1 + items.length) % items.length;
        } else if (event.key === "Home") {
          nextIndex = 0;
        } else if (event.key === "End") {
          nextIndex = items.length - 1;
        } else {
          return;
        }
        event.preventDefault();
        items[nextIndex]?.focus();
      }}
    >
      <button
        ref={firstItemRef}
        type="button"
        role="menuitem"
        data-command-id="file.save"
        disabled={saveState === "saving"}
        onClick={() => run("file.save")}
      >
        <Save size={18} aria-hidden="true" />
        <span>ذخیرهٔ سند</span>
      </button>
      <button
        type="button"
        role="menuitem"
        data-command-id="file.saveAs"
        onClick={() => run("file.saveAs")}
      >
        <FileText size={18} aria-hidden="true" />
        <span>ذخیره با نام</span>
      </button>
      <button
        type="button"
        role="menuitem"
        data-command-id="file.export"
        onClick={() => run("file.export")}
      >
        <FileDown size={18} aria-hidden="true" />
        <span>خروجی Word یا PDF</span>
      </button>
    </div>
  );
}
