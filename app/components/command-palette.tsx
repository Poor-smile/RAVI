"use client";

import { LoaderCircle, Search, X } from "@/app/icons/material-symbols";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { rankPaletteCommands, type CommandUsage } from "../commands/command-palette";
import {
  activeBindings,
  COMMAND_REGISTRY,
  type CommandDefinition,
  type CommandEnvironment,
  type CommandId,
} from "../keyboard/command-registry";
import { commandShortcutLabel } from "./command-tooltip";

export type CommandAvailability = { enabled: boolean; reason?: string };

const MAX_VISIBLE_RESULTS = 5;
const MINIMUM_EXECUTION_FEEDBACK_MS = 700;
const EXECUTION_LABELS: Partial<Record<CommandId, string>> = {
  "edit.reviewPersian": "اصلاحات فارسی",
};

function CommandResultRow({
  command,
  environment,
  state,
  index,
  selected,
  onHighlight,
  onSelect,
}: {
  command: CommandDefinition;
  environment: CommandEnvironment;
  state: CommandAvailability;
  index: number;
  selected: boolean;
  onHighlight: () => void;
  onSelect: () => void;
}) {
  const binding = activeBindings(command, environment)[0];
  const shortcut = binding
    ? commandShortcutLabel(command.id, environment)
    : "";
  const description = state.enabled
    ? command.description
    : state.reason ?? "این فرمان اکنون در دسترس نیست.";

  return (
    <div
      id={`command-palette-${index}`}
      className={`command-result-row${selected ? " is-selected" : ""}${
        state.enabled ? "" : " is-disabled"
      }`}
      role="option"
      aria-selected={selected}
      aria-disabled={state.enabled ? undefined : true}
      onMouseEnter={onHighlight}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        if (state.enabled) onSelect();
      }}
    >
      <span className="command-result-copy">
        <strong>{command.title}</strong>
        <small>{description}</small>
      </span>
      {shortcut ? (
        <kbd className="command-result-shortcut" dir="ltr" aria-hidden="true">
          {shortcut}
        </kbd>
      ) : (
        <span className="command-result-shortcut is-empty" aria-hidden="true" />
      )}
    </div>
  );
}

export function CommandPalette({
  inputRef,
  environment,
  usage,
  availability,
  onExecute,
  onClose,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  environment: CommandEnvironment;
  usage: CommandUsage;
  availability: (id: CommandId) => CommandAvailability;
  onExecute: (id: CommandId) => void | Promise<void>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [executingCommand, setExecutingCommand] =
    useState<CommandDefinition | null>(null);
  const executionCommittedRef = useRef(false);
  const executingStatusRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const commands = useMemo(
    () =>
      COMMAND_REGISTRY.filter(
        (command) =>
          command.id !== "layer.dismiss" &&
          command.id !== "view.commandPalette",
      ),
    [],
  );
  const displayed = useMemo(
    () => rankPaletteCommands(commands, query, usage).slice(0, MAX_VISIBLE_RESULTS),
    [commands, query, usage],
  );
  const activeIndex = Math.min(selectedIndex, Math.max(0, displayed.length - 1));

  useEffect(() => {
    if (executingCommand) {
      executingStatusRef.current?.focus({ preventScroll: true });
      return;
    }
    document
      .getElementById(`command-palette-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, executingCommand]);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const commit = (index: number) => {
    const command = displayed[index];
    if (
      !command ||
      executionCommittedRef.current ||
      !availability(command.id).enabled
    ) {
      return;
    }
    executionCommittedRef.current = true;
    const executionLabel = EXECUTION_LABELS[command.id];
    if (!executionLabel) {
      onClose();
      void onExecute(command.id);
      return;
    }

    setExecutingCommand(command);
    window.setTimeout(() => {
      if (mountedRef.current) onClose();
      void onExecute(command.id);
    }, MINIMUM_EXECUTION_FEEDBACK_MS);
  };

  const executionLabel = executingCommand
    ? EXECUTION_LABELS[executingCommand.id] ?? executingCommand.title
    : "";

  return (
    <div
      className="command-palette-shell"
      aria-busy={executingCommand ? true : undefined}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <header className="command-palette-header">
        <h2 id="command-palette-title">مرکز فرمان راوی</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="بستن مرکز فرمان راوی"
          title="بستن"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </header>

      <div className="command-palette-content">
        {executingCommand ? (
          <>
            <div className="command-palette-executing-query">
              <LoaderCircle className="is-spinning" size={18} aria-hidden="true" />
              <span dir="auto">در حال اجرای «{executionLabel}»…</span>
              <kbd className="command-palette-escape">Esc</kbd>
            </div>
            <h3 className="command-palette-results-title is-executing">
              در حال اجرا
            </h3>
            <div className="command-palette-executing-body">
              <div
                ref={executingStatusRef}
                className="command-palette-executing-status"
                role="status"
                aria-live="polite"
                tabIndex={-1}
              >
                <LoaderCircle className="is-spinning" size={18} aria-hidden="true" />
                <strong>فرمان در حال اجراست</strong>
                <span>پردازش فقط روی همین دستگاه انجام می‌شود.</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <label className="command-palette-search">
              <Search size={18} aria-hidden="true" />
              <span className="visually-hidden">جست‌وجوی فرمان</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={(event) => {
                  if (event.nativeEvent.isComposing) return;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setSelectedIndex((current) =>
                      Math.min(displayed.length - 1, current + 1),
                    );
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setSelectedIndex((current) => Math.max(0, current - 1));
                  } else if (event.key === "Home") {
                    event.preventDefault();
                    setSelectedIndex(0);
                  } else if (event.key === "End") {
                    event.preventDefault();
                    setSelectedIndex(Math.max(0, displayed.length - 1));
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    commit(activeIndex);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    onClose();
                  }
                }}
                placeholder="فرمان را به فارسی یا انگلیسی بنویسید…"
                dir="auto"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-palette-list"
                aria-activedescendant={
                  displayed[activeIndex]
                    ? `command-palette-${activeIndex}`
                    : undefined
                }
                aria-autocomplete="list"
              />
              <kbd className="command-palette-escape">Esc</kbd>
            </label>

            <h3 className="command-palette-results-title">نتیجه‌ها</h3>
            <div
              id="command-palette-list"
              className="command-palette-list"
              role="listbox"
              aria-label="نتیجه‌های فرمان"
            >
              {displayed.length ? (
                displayed.map((command, index) => (
                  <CommandResultRow
                    key={command.id}
                    command={command}
                    environment={environment}
                    state={availability(command.id)}
                    index={index}
                    selected={index === activeIndex}
                    onHighlight={() => setSelectedIndex(index)}
                    onSelect={() => commit(index)}
                  />
                ))
              ) : (
                <div className="command-palette-empty" role="status">
                  <strong>فرمانی پیدا نشد</strong>
                  <span>نام کار یا واژهٔ انگلیسی دیگری را امتحان کنید.</span>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <footer className="command-palette-footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> حرکت</span>
        <span><kbd>Enter</kbd> اجرا</span>
        <span><kbd>Esc</kbd> بستن</span>
        <span>سابقه فقط روی همین دستگاه</span>
      </footer>
    </div>
  );
}
