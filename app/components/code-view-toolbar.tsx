"use client";

import {
  Bold,
  ChevronDown,
  Code2,
  Ellipsis,
  Italic,
  Link2,
  Search,
  Table2,
} from "@/app/icons/material-symbols";
import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import type { EditorFormattingContext } from "./markdown-code-editor";
import type { CodeViewLineDirection } from "../editor/code-view-preferences";

const DIRECTION_LABELS: Record<CodeViewLineDirection, string> = {
  auto: "Auto",
  rtl: "RTL",
  ltr: "LTR",
};

type ToolbarCommand =
  | "edit.bold"
  | "edit.italic"
  | "edit.link"
  | "edit.code"
  | "edit.list"
  | "edit.orderedList"
  | "edit.task"
  | "edit.find";

type ToolbarButtonProps = {
  label: string;
  active?: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
};

function ToolbarButton({
  label,
  active = false,
  onClick,
  children,
}: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className="code-view-toolbar-button"
      aria-label={label}
      aria-pressed={active || undefined}
      title={label}
      onPointerDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function CodeViewToolbar({
  context,
  lineDirection,
  onLineDirectionChange,
  onOpenTable,
  onCommand,
  onOpenCommandPalette,
}: {
  context: EditorFormattingContext;
  lineDirection: CodeViewLineDirection;
  onLineDirectionChange: (direction: CodeViewLineDirection) => void;
  onOpenTable: (trigger: HTMLButtonElement) => void;
  onCommand: (command: ToolbarCommand) => void;
  onOpenCommandPalette: () => void;
}) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const directionRef = useRef<HTMLDivElement>(null);
  const [directionOpen, setDirectionOpen] = useState(false);
  useEffect(() => {
    if (!directionOpen) return;
    const dismiss = (event: globalThis.PointerEvent) => {
      if (
        event.target instanceof Node &&
        !directionRef.current?.contains(event.target)
      ) {
        setDirectionOpen(false);
      }
    };
    document.addEventListener("pointerdown", dismiss, true);
    return () => document.removeEventListener("pointerdown", dismiss, true);
  }, [directionOpen]);

  const handleToolbarKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (directionOpen && directionRef.current?.contains(event.target as Node)) {
      if (event.key === "Escape") {
        event.preventDefault();
        setDirectionOpen(false);
        directionRef.current
          ?.querySelector<HTMLButtonElement>(".code-view-toolbar-direction")
          ?.focus();
        return;
      }
      if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
        const options = Array.from(
          directionRef.current.querySelectorAll<HTMLButtonElement>(
            '[role="menuitemradio"]',
          ),
        );
        if (options.length) {
          const current = options.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? options.length - 1
                : event.key === "ArrowUp"
                  ? Math.max(0, current <= 0 ? 0 : current - 1)
                  : Math.min(options.length - 1, current + 1);
          event.preventDefault();
          options[next]?.focus();
          return;
        }
      }
    }
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
      return;
    }
    const buttons = Array.from(
      toolbarRef.current?.querySelectorAll<HTMLButtonElement>(
        ':scope > button:not([disabled]), :scope > div > button:not([disabled])',
      ) ?? [],
    );
    if (!buttons.length) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : event.key === "ArrowLeft"
            ? Math.min(buttons.length - 1, Math.max(0, current) + 1)
            : Math.max(0, current <= 0 ? 0 : current - 1);
    event.preventDefault();
    buttons[next]?.focus();
  };

  const run = (command: ToolbarCommand) => () => onCommand(command);

  return (
    <div
      ref={toolbarRef}
      className="code-view-toolbar"
      role="toolbar"
      aria-label="ابزارهای نمای کد"
      dir="rtl"
      onKeyDown={handleToolbarKeyDown}
    >
      <ToolbarButton label="جدول Markdown" onClick={(event) => onOpenTable(event.currentTarget)}>
        <Table2 size={18} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="پررنگ" active={context.bold} onClick={run("edit.bold")}>
        <Bold size={18} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="مورب" active={context.italic} onClick={run("edit.italic")}>
        <Italic size={18} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="پیوند" active={context.link} onClick={run("edit.link")}>
        <Link2 size={18} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="کد درون‌خطی" active={context.code} onClick={run("edit.code")}>
        <Code2 size={18} aria-hidden="true" />
      </ToolbarButton>

      <span className="code-view-toolbar-separator" aria-hidden="true" />
      <div ref={directionRef} className="code-view-direction-control">
        <button
          type="button"
          className="code-view-toolbar-direction"
          aria-label={`جهت خطوط: ${DIRECTION_LABELS[lineDirection]}`}
          aria-haspopup="menu"
          aria-expanded={directionOpen}
          title="جهت نمایش خطوط"
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => {
            setDirectionOpen((current) => {
              const next = !current;
              if (next) {
                requestAnimationFrame(() => {
                  directionRef.current
                    ?.querySelector<HTMLButtonElement>(
                      '[role="menuitemradio"][aria-checked="true"]',
                    )
                    ?.focus();
                });
              }
              return next;
            });
          }}
        >
          <span dir="ltr">{DIRECTION_LABELS[lineDirection]}</span>
          <ChevronDown size={13} aria-hidden="true" />
        </button>
        {directionOpen && (
          <div className="code-view-direction-menu" role="menu" aria-label="جهت نمایش خطوط">
            <div className="code-view-direction-menu-heading">
              <strong>جهت نمایش خطوط</strong>
              <small>بدون تغییر Markdown</small>
            </div>
            {(["auto", "rtl", "ltr"] as const).map((direction) => (
              <button
                key={direction}
                type="button"
                role="menuitemradio"
                aria-checked={lineDirection === direction}
                onClick={() => {
                  onLineDirectionChange(direction);
                  setDirectionOpen(false);
                }}
              >
                <span dir="ltr">{DIRECTION_LABELS[direction]}</span>
                <small>
                  {direction === "auto"
                    ? "تشخیص جداگانه برای هر خط"
                    : direction === "rtl"
                      ? "راست‌به‌چپ"
                      : "چپ‌به‌راست"}
                </small>
              </button>
            ))}
            <p dir="auto">نسخه 2.0 — path/to/file.md</p>
          </div>
        )}
      </div>
      <ToolbarButton label="جست‌وجو در سند" onClick={run("edit.find")}>
        <Search size={18} aria-hidden="true" />
      </ToolbarButton>
      <ToolbarButton label="فرمان‌های بیشتر" onClick={() => onOpenCommandPalette()}>
        <Ellipsis size={18} aria-hidden="true" />
      </ToolbarButton>
    </div>
  );
}
