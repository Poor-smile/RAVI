import { EditorView, WidgetType } from "@codemirror/view";
import { isolateHistory } from "@codemirror/commands";
import { Transaction } from "@codemirror/state";
import katex from "katex";
import type { FormulaBlock } from "../formula/blocks";
import type { AudioDescriptor, AudioSourceResolution } from "../audio/types";
import { MATERIAL_SYMBOL_PATHS } from "../icons/material-symbol-paths";
import { formulaAccessibleText } from "../formula/model";
import { createMermaidBlobUrl, type MermaidBlobUrl } from "../mermaid/blob-url";
import { mermaidSvgAccessibleName } from "../mermaid/use-mermaid-render";
import type { FenceDescriptor, ImageDescriptor, TableDescriptor } from "./rich-blocks";
import {
  appendGfmTableColumn,
  appendGfmTableRow,
  clearGfmTableCells,
  cycleGfmTableAlignment,
  insertGfmTableColumn,
  insertGfmTableRow,
  removeGfmTableColumn,
  removeGfmTableColumns,
  removeGfmTableRow,
  removeGfmTableRows,
  resolveAdjacentMarkdownBlockRange,
  safeLiveImageSource,
  serializeGfmTable,
  updateGfmTableCell,
} from "./rich-blocks";
import { createStructuralBlockOperations } from "./block-operations";
import { mixedScriptWordRangeAt } from "./text-selection";

export type LiveImageResolution =
  | { status: "ready"; source: string }
  | { status: "blocked"; message: string };

export type LiveAudioResolution = AudioSourceResolution;

function createMaterialSymbol(
  symbol:
    | "content_copy"
    | "pause"
    | "play_arrow"
    | "speech_to_text",
) {
  const namespace = "http://www.w3.org/2000/svg";
  const vector = MATERIAL_SYMBOL_PATHS[symbol];
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", vector.viewBox);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("cm-audio-symbol");
  for (const pathData of vector.outline) {
    const iconPath = document.createElementNS(namespace, "path");
    iconPath.setAttribute("d", pathData);
    iconPath.setAttribute("fill", "currentColor");
    svg.append(iconPath);
  }
  return svg;
}

export class CodeBlockHeaderWidget extends WidgetType {
  constructor(
    private readonly language: string,
    private readonly code: string,
  ) {
    super();
  }

  eq(other: CodeBlockHeaderWidget) {
    return other.code === this.code && other.language === this.language;
  }

  toDOM() {
    const header = document.createElement("span");
    header.className = "cm-ch";
    header.textContent = this.language || "text";
    const copy = actionButton(
      "کپی کد",
      (button) => {
        void import("./clipboard").then((clipboard) =>
          clipboard.copyCode(button, this.code),
        );
      },
      "cm-copy",
    );
    copy.replaceChildren(createMaterialSymbol("content_copy"));
    copy.onpointerdown = (event) => event.preventDefault();
    header.append(copy);
    return header;
  }

}

export type RichWidgetOptions = {
  resolveImage?: (source: string) => LiveImageResolution;
  resolveAudio?: (
    source: string,
  ) => LiveAudioResolution | Promise<LiveAudioResolution>;
  openAudioTranscription?: (
    descriptor: AudioDescriptor,
    from: number,
    to: number,
  ) => void;
  openMermaidStudio?: (from: number, to: number) => void;
  openFormulaStudio?: (
    from: number,
    to: number,
    opener?: HTMLElement,
  ) => void;
};

function actionButton(
  label: string,
  action: (button: HTMLButtonElement) => void,
  className = "",
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = `cm-rich-action ${className}`.trim();
  button.textContent = label;
  button.setAttribute("aria-label", label);
  button.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    action(button);
  };
  return button;
}

function revealSource(view: EditorView, from: number, to: number) {
  view.dispatch({
    selection: { anchor: from, head: Math.min(to, from + 1) },
    effects: EditorView.scrollIntoView(from, { y: "nearest" }),
  });
  view.focus();
}

function widgetShell(
  kind: string,
  label: string,
  from: number,
  to: number,
  view: EditorView,
) {
  const figure = document.createElement("figure");
  figure.className = `cm-rich-block cm-rich-${kind}`;
  figure.contentEditable = "false";
  figure.tabIndex = 0;
  figure.dataset.richBlockFrom = String(from);
  figure.dataset.richBlockTo = String(to);
  figure.setAttribute("role", "group");
  figure.setAttribute("aria-label", label);
  figure.setAttribute(
    "aria-keyshortcuts",
    "Control+Enter Meta+Enter",
  );
  figure.addEventListener("keydown", (event) => {
    if (
      event.isComposing ||
      (!event.ctrlKey && !event.metaKey) ||
      event.altKey ||
      event.shiftKey ||
      event.key !== "Enter"
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const operations = createStructuralBlockOperations(
      view.state.doc.toString(),
      { anchor: from, head: from },
    );
    const operation = operations.insertAfter(operations.blockIdAt(from));
    if (!operation) return;
    view.dispatch({
      changes: operation.changes,
      selection: operation.selection,
      annotations: [
        Transaction.addToHistory.of(true),
        Transaction.userEvent.of(operation.userEvent),
        isolateHistory.of("full"),
      ],
      effects: EditorView.announce.of(operation.announcement),
    });
    view.focus();
  });
  return figure;
}

function widgetHeader(title: string, meta = "") {
  const header = document.createElement("figcaption");
  header.className = "cm-rich-header";
  const identity = document.createElement("span");
  const strong = document.createElement("strong");
  strong.textContent = title;
  identity.append(strong);
  if (meta) {
    const small = document.createElement("small");
    small.textContent = meta;
    identity.append(small);
  }
  const actions = document.createElement("span");
  actions.className = "cm-rich-actions";
  header.append(identity, actions);
  return { header, actions };
}

abstract class SourceBlockWidget extends WidgetType {
  constructor(
    protected readonly from: number,
    protected readonly to: number,
    protected readonly source: string,
  ) { super(); }

  protected editButton(view: EditorView) {
    return actionButton("ویرایش متن Markdown", () => revealSource(view, this.from, this.to));
  }

  ignoreEvent() { return true; }
}

type TableCellPosition = { row: number; column: number };
type TableCellCaret =
  | number
  | "start"
  | "end"
  | "all"
  | "visual-left"
  | "visual-right";

const tableWrapPreferences = new WeakMap<EditorView, boolean>();
const tableContextMenus = new WeakMap<HTMLElement, HTMLElement>();

type TableCellInlineToken = {
  index: number;
  length: number;
  content: string;
  kind: "bold" | "code" | "highlight" | "italic" | "link" | "strike" | "underline";
  metadata?: string;
};

function tableCellInlineToken(source: string): TableCellInlineToken | null {
  const candidates: Array<{
    kind: TableCellInlineToken["kind"];
    expression: RegExp;
    contentIndex?: number;
    metadataIndex?: number;
  }> = [
    { kind: "code", expression: /(?<!\\)`([^`\n]+?)(?<!\\)`/u },
    { kind: "underline", expression: /<u>(.+?)<\/u>/iu },
    { kind: "bold", expression: /(?<!\\)\*\*(.+?)(?<!\\)\*\*/u },
    { kind: "bold", expression: /(?<!\\)__(.+?)(?<!\\)__/u },
    { kind: "strike", expression: /(?<!\\)~~(.+?)(?<!\\)~~/u },
    { kind: "highlight", expression: /(?<!\\)==(.+?)(?<!\\)==/u },
    {
      kind: "link",
      expression: /(?<!\\)\[([^\]\n]+?)\]\(([^)\n]+?)\)/u,
      metadataIndex: 2,
    },
    {
      kind: "italic",
      expression: /(?<![\\*])\*([^*\n]+?)(?<!\\)\*(?!\*)/u,
    },
    {
      kind: "italic",
      expression: /(?<![\\_])_([^_\n]+?)(?<!\\)_(?!_)/u,
    },
  ];
  let token: TableCellInlineToken | null = null;
  for (const candidate of candidates) {
    const match = candidate.expression.exec(source);
    if (!match || match.index === undefined) continue;
    const next: TableCellInlineToken = {
      index: match.index,
      length: match[0].length,
      content: match[candidate.contentIndex ?? 1] ?? "",
      kind: candidate.kind,
      metadata: candidate.metadataIndex
        ? match[candidate.metadataIndex]
        : undefined,
    };
    if (!token || next.index < token.index) token = next;
  }
  return token;
}

function appendTableCellInlineMarkdown(
  parent: HTMLElement | DocumentFragment,
  source: string,
  depth = 0,
) {
  if (!source) return;
  if (depth >= 8) {
    parent.append(document.createTextNode(source));
    return;
  }
  let remaining = source;
  while (remaining) {
    const token = tableCellInlineToken(remaining);
    if (!token) {
      parent.append(
        document.createTextNode(
          remaining.replace(/\\([\\`*_{}\[\]()#+\-.!|>~])/gu, "$1"),
        ),
      );
      return;
    }
    if (token.index > 0) {
      parent.append(document.createTextNode(remaining.slice(0, token.index)));
    }
    const element = document.createElement(
      token.kind === "bold"
        ? "strong"
        : token.kind === "italic"
          ? "em"
          : token.kind === "strike"
            ? "s"
            : token.kind === "underline"
              ? "u"
              : token.kind === "highlight"
                ? "mark"
                : token.kind === "code"
                  ? "code"
                  : "span",
    );
    if (token.kind === "link") {
      element.className = "cm-rich-table-cell-link";
      if (token.metadata) element.title = token.metadata;
    }
    if (token.kind === "code") {
      element.textContent = token.content;
    } else {
      appendTableCellInlineMarkdown(element, token.content, depth + 1);
    }
    parent.append(element);
    remaining = remaining.slice(token.index + token.length);
  }
}

function renderTableCellPreview(element: HTMLElement, source: string) {
  const fragment = document.createDocumentFragment();
  appendTableCellInlineMarkdown(fragment, source);
  element.replaceChildren(fragment);
}

export class TableBlockWidget extends SourceBlockWidget {
  constructor(from: number, to: number, source: string, private readonly table: TableDescriptor) {
    super(from, to, source);
  }

  eq(other: TableBlockWidget) {
    return other.from === this.from && other.to === this.to && other.source === this.source;
  }

  toDOM(view: EditorView) {
    const editableCell = (value: string) => value.replace(/\\\|/gu, "|");
    const shell = widgetShell(
      "table",
      `جدول با ${this.table.headers.length.toLocaleString("fa-IR")} ستون`,
      this.from,
      this.to,
      view,
    );
    shell.dataset.tableFrom = String(this.from);
    shell.tabIndex = -1;
    let draft: TableDescriptor = {
      headers: this.table.headers.map(editableCell),
      rows: this.table.rows.map((row) => row.map(editableCell)),
      alignments: [...this.table.alignments],
    };
    let committedSource = this.source;
    let committedTo = this.to;
    let activeRow = -1;
    let activeColumn = 0;
    let selectionAnchor: TableCellPosition = { row: -1, column: 0 };
    let selectionHead: TableCellPosition = { row: -1, column: 0 };
    let preserveSelectionOnFocus = false;

    let tableWrapEnabled = tableWrapPreferences.get(view) ?? true;
    tableWrapPreferences.set(view, tableWrapEnabled);

    const cellKey = ({ row, column }: TableCellPosition) => `${row}:${column}`;
    const selectionRange = () => ({
      rowFrom: Math.min(selectionAnchor.row, selectionHead.row),
      rowTo: Math.max(selectionAnchor.row, selectionHead.row),
      columnFrom: Math.min(selectionAnchor.column, selectionHead.column),
      columnTo: Math.max(selectionAnchor.column, selectionHead.column),
    });
    const selectedCellCount = () => {
      const range = selectionRange();
      return (
        (range.rowTo - range.rowFrom + 1) *
        (range.columnTo - range.columnFrom + 1)
      );
    };
    const positionInSelection = (position: TableCellPosition) => {
      const range = selectionRange();
      return (
        position.row >= range.rowFrom &&
        position.row <= range.rowTo &&
        position.column >= range.columnFrom &&
        position.column <= range.columnTo
      );
    };

    const updateCellVisuals = () => {
      const range = selectionRange();
      shell.dataset.selectionCount = String(selectedCellCount());
      shell
        .querySelectorAll<HTMLElement>("[data-table-row][data-table-column]")
        .forEach((editor) => {
          const row = Number(editor.dataset.tableRow);
          const column = Number(editor.dataset.tableColumn);
          const cell = editor.closest<HTMLElement>("th, td");
          const selected =
            row >= range.rowFrom &&
            row <= range.rowTo &&
            column >= range.columnFrom &&
            column <= range.columnTo;
          editor.dataset.wrap = tableWrapEnabled ? "true" : "false";
          if (cell) {
            cell.dataset.selected = selected ? "true" : "false";
            cell.dataset.wrap = tableWrapEnabled ? "true" : "false";
            cell.setAttribute("aria-selected", String(selected));
          }
        });
    };

    const setCellSelection = (
      position: TableCellPosition,
      extend = false,
    ) => {
      if (!extend) selectionAnchor = position;
      selectionHead = position;
      activeRow = position.row;
      activeColumn = position.column;
      shell.dataset.activeCell = cellKey(position);
      updateCellVisuals();
      syncDestructiveActions();
    };

    const focusCell = (
      row: number,
      column: number,
      extend = false,
      caret: TableCellCaret = "end",
      preview = false,
    ) => {
      requestAnimationFrame(() => {
        const next = view.dom.querySelector<HTMLTextAreaElement>(
          `.cm-rich-table[data-table-from="${this.from}"] textarea[data-table-row="${row}"][data-table-column="${column}"]`,
        );
        if (!next) return;
        preserveSelectionOnFocus = extend;
        next.focus({ preventScroll: true });
        if (extend) setCellSelection({ row, column }, true);
        if (caret === "all") {
          next.select();
          return;
        }
        const direction = getComputedStyle(next).direction;
        const offset =
          typeof caret === "number"
            ? Math.max(0, Math.min(caret, next.value.length))
            : caret === "start"
              ? 0
              : caret === "visual-left"
                ? direction === "rtl"
                  ? next.value.length
                  : 0
                : caret === "visual-right"
                  ? direction === "rtl"
                    ? 0
                    : next.value.length
                  : next.value.length;
        next.setSelectionRange(offset, offset);
        if (preview) {
          const cellEditor = next.closest<HTMLElement>(
            ".cm-rich-table-cell-editor",
          );
          if (cellEditor) cellEditor.dataset.editing = "false";
        }
      });
    };

    const focusShell = () => {
      requestAnimationFrame(() => {
        view.dom
          .querySelector<HTMLElement>(
            `.cm-rich-table[data-table-from="${this.from}"]`,
          )
          ?.focus({ preventScroll: true });
      });
    };

    const commit = (
      next: TableDescriptor,
      focus: TableCellPosition | null,
      announcement = "جدول به‌روزرسانی شد",
    ) => {
      const markdown = serializeGfmTable(next);
      meta.textContent = `جدول · ${next.headers.length.toLocaleString("fa-IR")} × ${next.rows.length.toLocaleString("fa-IR")}`;
      shell.setAttribute(
        "aria-label",
        `جدول با ${next.headers.length.toLocaleString("fa-IR")} ستون و ${next.rows.length.toLocaleString("fa-IR")} ردیف`,
      );
      syncDestructiveActions();
      if (markdown === committedSource) {
        if (focus) focusCell(focus.row, focus.column);
        return;
      }
      const replacedTo = committedTo;
      committedSource = markdown;
      committedTo = this.from + markdown.length;
      view.dispatch({
        changes: { from: this.from, to: replacedTo, insert: markdown },
        effects: EditorView.announce.of(announcement),
      });
      if (focus) focusCell(focus.row, focus.column);
    };

    const insertTextBlockAfter = () => {
      const markdown = serializeGfmTable(draft);
      const documentSource = view.state.doc.toString();
      const committedDocument = `${documentSource.slice(0, this.from)}${markdown}${documentSource.slice(committedTo)}`;
      const operations = createStructuralBlockOperations(committedDocument, {
        anchor: this.from,
        head: this.from,
      });
      const operation = operations.insertAfter(operations.blockIdAt(this.from));
      if (!operation) return;
      const insertion = operation.changes[0];
      if (!insertion || insertion.from !== this.from + markdown.length) return;
      view.dispatch({
        changes: {
          from: this.from,
          to: committedTo,
          insert: `${markdown}${insertion.insert}`,
        },
        selection: operation.selection,
        annotations: [
          Transaction.addToHistory.of(true),
          Transaction.userEvent.of(operation.userEvent),
          isolateHistory.of("full"),
        ],
        effects: EditorView.announce.of("بلاک متنی بعد از جدول ساخته شد"),
      });
      view.focus();
    };

    const leaveTableVertically = (direction: -1 | 1) => {
      commit(draft, null);
      const source = view.state.doc.toString();
      const adjacent = resolveAdjacentMarkdownBlockRange(
        source,
        this.from,
        direction,
      );
      if (!adjacent) return false;
      const targetLine = direction > 0
        ? view.state.doc.lineAt(adjacent.from)
        : view.state.doc.lineAt(Math.max(adjacent.from, adjacent.to - 1));
      const position = direction > 0 ? targetLine.from : targetLine.to;
      view.dispatch({
        selection: { anchor: position },
        effects: [
          EditorView.scrollIntoView(position, { y: "nearest" }),
          EditorView.announce.of(
            direction > 0 ? "بلاک بعدی فعال شد" : "بلاک قبلی فعال شد",
          ),
        ],
        annotations: Transaction.userEvent.of("select.block.vertical"),
      });
      view.focus();
      return true;
    };

    const toolbar = document.createElement("div");
    toolbar.className = "cm-rich-table-toolbar";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "ابزار ویرایش جدول");
    const meta = document.createElement("span");
    meta.className = "cm-rich-table-meta";
    meta.textContent = `جدول · ${this.table.headers.length.toLocaleString("fa-IR")} × ${this.table.rows.length.toLocaleString("fa-IR")}`;
    const controls = document.createElement("span");
    controls.className = "cm-rich-table-actions";

    const addRow = actionButton("ردیف +", () => {
      draft = appendGfmTableRow(draft);
      commit(
        draft,
        { row: draft.rows.length - 1, column: 0 },
        "ردیف به جدول اضافه شد",
      );
    }, "cm-rich-table-action");
    addRow.title = "افزودن ردیف";
    const removeRow = actionButton("ردیف −", () => {
      const targetRow = activeRow >= 0 ? activeRow : draft.rows.length - 1;
      draft = removeGfmTableRow(draft, targetRow);
      const nextRow = draft.rows.length
        ? Math.min(targetRow, draft.rows.length - 1)
        : -1;
      commit(
        draft,
        { row: nextRow, column: Math.min(activeColumn, draft.headers.length - 1) },
        "ردیف از جدول حذف شد",
      );
    }, "cm-rich-table-action cm-rich-table-action--remove");
    removeRow.setAttribute("aria-label", "حذف ردیف فعال");
    const addColumn = actionButton("ستون +", () => {
      draft = appendGfmTableColumn(draft);
      commit(
        draft,
        { row: -1, column: draft.headers.length - 1 },
        "ستون به جدول اضافه شد",
      );
    }, "cm-rich-table-action");
    addColumn.title = "افزودن ستون";
    const removeColumn = actionButton("ستون −", () => {
      const targetColumn = Math.max(
        0,
        Math.min(activeColumn, draft.headers.length - 1),
      );
      draft = removeGfmTableColumn(draft, targetColumn);
      const nextColumn = Math.min(targetColumn, draft.headers.length - 1);
      commit(
        draft,
        { row: Math.min(activeRow, draft.rows.length - 1), column: nextColumn },
        "ستون از جدول حذف شد",
      );
    }, "cm-rich-table-action cm-rich-table-action--remove");
    removeColumn.setAttribute("aria-label", "حذف ستون فعال");

    const syncDestructiveActions = () => {
      removeRow.disabled = draft.rows.length === 0;
      removeRow.title = removeRow.disabled
        ? "جدول ردیف محتوایی ندارد"
        : activeRow >= 0
          ? "حذف ردیف فعال"
          : "حذف آخرین ردیف";
      removeColumn.disabled = draft.headers.length <= 2;
      removeColumn.title = removeColumn.disabled
        ? "جدول باید حداقل دو ستون داشته باشد"
        : "حذف ستون فعال";
    };
    const align = actionButton("تراز", () => {
      draft = cycleGfmTableAlignment(draft, activeColumn);
      commit(
        draft,
        { row: activeRow, column: activeColumn },
        "تراز ستون تغییر کرد",
      );
    }, "cm-rich-table-action");
    align.title = "تغییر تراز ستون فعال";

    const more = actionButton("گزینه‌های جدول", () => {}, "cm-rich-table-action cm-rich-table-more-trigger");
    more.textContent = "•••";
    more.title = "گزینه‌های بیشتر";
    more.setAttribute("aria-haspopup", "menu");
    more.setAttribute("aria-expanded", "false");
    const moreMenu = document.createElement("div");
    moreMenu.className = "cm-rich-table-menu";
    moreMenu.hidden = true;
    moreMenu.setAttribute("role", "menu");
    const editSource = actionButton("ویرایش متن Markdown", () => {
      const markdown = serializeGfmTable(draft);
      view.dispatch({
        changes: { from: this.from, to: committedTo, insert: markdown },
        selection: {
          anchor: this.from,
          head: Math.min(this.from + markdown.length, this.from + 1),
        },
        effects: EditorView.scrollIntoView(this.from, { y: "nearest" }),
      });
      view.focus();
    });
    editSource.setAttribute("role", "menuitem");
    moreMenu.append(editSource);
    more.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      moreMenu.hidden = !moreMenu.hidden;
      more.setAttribute("aria-expanded", String(!moreMenu.hidden));
      if (!moreMenu.hidden) editSource.focus();
    });
    syncDestructiveActions();
    controls.append(
      addRow,
      removeRow,
      addColumn,
      removeColumn,
      align,
      more,
    );
    toolbar.append(meta, controls, moreMenu);

    const contextMenu = document.createElement("div");
    contextMenu.className = "cm-rich-table-context-menu";
    contextMenu.hidden = true;
    contextMenu.dir = "rtl";
    contextMenu.setAttribute("role", "menu");
    contextMenu.setAttribute("aria-label", "عملیات سلول‌های جدول");

    const closeContextMenu = (restoreFocus = false) => {
      if (contextMenu.hidden) return;
      contextMenu.hidden = true;
      if (restoreFocus) focusCell(activeRow, activeColumn);
    };
    const menuDivider = () => {
      const divider = document.createElement("div");
      divider.className = "cm-rich-table-context-divider";
      divider.setAttribute("role", "separator");
      contextMenu.append(divider);
    };
    const menuItem = (
      label: string,
      action: () => void,
      options: { danger?: boolean; disabled?: boolean; shortcut?: string } = {},
    ) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `cm-rich-table-context-item${options.danger ? " is-danger" : ""}`;
      button.setAttribute("role", "menuitem");
      button.disabled = options.disabled ?? false;
      const text = document.createElement("span");
      text.textContent = label;
      button.append(text);
      if (options.shortcut) {
        const shortcut = document.createElement("kbd");
        shortcut.textContent = options.shortcut;
        button.append(shortcut);
      }
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        closeContextMenu();
        action();
      });
      contextMenu.append(button);
      return button;
    };

    const updateWrapForAllTables = () => {
      tableWrapEnabled = !tableWrapEnabled;
      tableWrapPreferences.set(view, tableWrapEnabled);
      view.dom
        .querySelectorAll<HTMLElement>(
          ".cm-rich-table [data-table-row][data-table-column]",
        )
        .forEach((editor) => {
          editor.dataset.wrap = tableWrapEnabled ? "true" : "false";
          const cell = editor.closest<HTMLElement>("th, td");
          if (cell) cell.dataset.wrap = tableWrapEnabled ? "true" : "false";
        });
      updateCellVisuals();
      view.dispatch({
        effects: EditorView.announce.of(
          tableWrapEnabled
            ? "شکستن متن برای همهٔ جدول‌ها فعال شد"
            : "شکستن متن برای همهٔ جدول‌ها غیرفعال شد",
        ),
      });
      focusCell(activeRow, activeColumn, true);
    };

    const buildContextMenu = () => {
      contextMenu.replaceChildren();
      const range = selectionRange();
      const isRange = selectedCellCount() > 1;
      const selectedRows = Array.from(
        { length: Math.max(0, range.rowTo - Math.max(0, range.rowFrom) + 1) },
        (_, index) => Math.max(0, range.rowFrom) + index,
      ).filter((row) => row < draft.rows.length);
      const selectedColumns = Array.from(
        { length: range.columnTo - range.columnFrom + 1 },
        (_, index) => range.columnFrom + index,
      );

      menuItem("افزودن ردیف", () => {
        const insertAt = Math.max(0, range.rowTo + 1);
        draft = insertGfmTableRow(draft, insertAt);
        commit(draft, { row: insertAt, column: range.columnFrom }, "ردیف به جدول اضافه شد");
      });
      menuItem("افزودن ستون", () => {
        const insertAt = range.columnTo + 1;
        draft = insertGfmTableColumn(draft, insertAt);
        commit(draft, { row: activeRow, column: insertAt }, "ستون به جدول اضافه شد");
      });
      menuDivider();
      menuItem(isRange ? "حذف ردیف‌های انتخابی" : "حذف ردیف", () => {
        const firstRow = selectedRows[0] ?? 0;
        draft = removeGfmTableRows(draft, selectedRows);
        const nextRow = draft.rows.length ? Math.min(firstRow, draft.rows.length - 1) : -1;
        commit(draft, { row: nextRow, column: Math.min(activeColumn, draft.headers.length - 1) }, "ردیف انتخابی حذف شد");
      }, { danger: true, disabled: selectedRows.length === 0 });
      menuItem(isRange ? "حذف ستون‌های انتخابی" : "حذف ستون", () => {
        const firstColumn = selectedColumns[0] ?? 0;
        draft = removeGfmTableColumns(draft, selectedColumns);
        commit(draft, {
          row: Math.min(activeRow, draft.rows.length - 1),
          column: Math.min(firstColumn, draft.headers.length - 1),
        }, "ستون انتخابی حذف شد");
      }, {
        danger: true,
        disabled: draft.headers.length - selectedColumns.length < 2,
      });
      menuDivider();
      menuItem("Wrap Text", updateWrapForAllTables);
      menuItem(
        isRange ? "پاک‌کردن سلول‌های انتخابی" : "پاک‌کردن محتوای سلول",
        () => {
          draft = clearGfmTableCells(draft, range);
          commit(draft, { row: activeRow, column: activeColumn }, "محتوای سلول‌های انتخابی پاک شد");
        },
        { danger: true, shortcut: "Delete" },
      );
    };

    const openContextMenu = (
      event: MouseEvent,
      position: TableCellPosition,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      document
        .querySelectorAll<HTMLElement>(".cm-rich-table-context-menu:not([hidden])")
        .forEach((openMenu) => {
          if (openMenu !== contextMenu) openMenu.hidden = true;
        });
      if (!positionInSelection(position)) setCellSelection(position);
      buildContextMenu();
      contextMenu.hidden = false;
      const menuBounds = contextMenu.getBoundingClientRect();
      const menuWidth = menuBounds.width || 280;
      const menuHeight = menuBounds.height || 280;
      const left = Math.max(8, Math.min(event.clientX, window.innerWidth - menuWidth - 8));
      const top = Math.max(8, Math.min(event.clientY, window.innerHeight - menuHeight - 8));
      contextMenu.style.left = `${left}px`;
      contextMenu.style.top = `${top}px`;
      contextMenu.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    };

    contextMenu.addEventListener("keydown", (event) => {
      const items = [...contextMenu.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")];
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeContextMenu(true);
        return;
      }
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      event.stopPropagation();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      items[(index + direction + items.length) % items.length]?.focus();
    });
    contextMenu.addEventListener("focusout", (event) => {
      const next = event.relatedTarget;
      if (next instanceof Node && contextMenu.contains(next)) return;
      queueMicrotask(() => closeContextMenu());
    });

    const viewport = document.createElement("div");
    viewport.className = "cm-rich-table-scroll";
    viewport.setAttribute("role", "region");
    viewport.setAttribute(
      "aria-label",
      "ویرایش جدول؛ با جهت‌ها بین سلول‌ها حرکت کنید، در مرز بالا یا پایین از جدول خارج شوید، Ctrl+A محتوای سلول را انتخاب می‌کند و Shift+جهت محدوده می‌سازد",
    );
    const table = document.createElement("table");
    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const horizontalColumnDelta = (key: "ArrowLeft" | "ArrowRight") => {
      const rtl = getComputedStyle(table).direction === "rtl";
      if (key === "ArrowLeft") return rtl ? 1 : -1;
      return rtl ? -1 : 1;
    };

    const moveToAdjacentCell = (
      key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
      position: TableCellPosition,
      caretOffset: number,
    ) => {
      const next = { ...position };
      let caret: TableCellCaret = caretOffset;
      if (key === "ArrowUp") next.row -= 1;
      if (key === "ArrowDown") next.row += 1;
      if (key === "ArrowLeft" || key === "ArrowRight") {
        next.column += horizontalColumnDelta(key);
        caret = key === "ArrowLeft" ? "visual-right" : "visual-left";
      }
      if (
        next.row < -1 ||
        next.row >= draft.rows.length ||
        next.column < 0 ||
        next.column >= draft.headers.length
      ) {
        return false;
      }
      focusCell(next.row, next.column, false, caret, true);
      return true;
    };

    const createCellEditor = (
      value: string,
      row: number,
      column: number,
    ) => {
      const cellEditor = document.createElement("div");
      cellEditor.className = "cm-rich-table-cell-editor";
      cellEditor.dataset.editing = "false";
      const preview = document.createElement("div");
      preview.className = "cm-rich-table-cell-preview";
      preview.dir = "auto";
      preview.setAttribute("aria-hidden", "true");
      renderTableCellPreview(preview, value);
      const editor = document.createElement("textarea");
      editor.rows = 1;
      editor.value = value;
      editor.dir = "auto";
      editor.dataset.tableRow = String(row);
      editor.dataset.tableColumn = String(column);
      editor.dataset.editableKind = "editor";
      editor.dataset.wrap = tableWrapEnabled ? "true" : "false";
      editor.setAttribute(
        "aria-label",
        row < 0
          ? `عنوان ستون ${(column + 1).toLocaleString("fa-IR")}`
          : `ردیف ${(row + 1).toLocaleString("fa-IR")}، ستون ${(column + 1).toLocaleString("fa-IR")}`,
      );
      editor.setAttribute(
        "aria-keyshortcuts",
        "Control+A Meta+A Control+Enter Meta+Enter ArrowUp ArrowDown ArrowLeft ArrowRight Control+ArrowUp Control+ArrowDown Control+ArrowLeft Control+ArrowRight Meta+ArrowUp Meta+ArrowDown Meta+ArrowLeft Meta+ArrowRight Tab Shift+Tab Enter",
      );
      editor.style.textAlign = draft.alignments[column] ?? "start";
      editor.addEventListener("focus", () => {
        cellEditor.dataset.editing = "true";
        if (!preserveSelectionOnFocus) setCellSelection({ row, column });
        preserveSelectionOnFocus = false;
      });
      editor.addEventListener("pointerdown", (event) => {
        if (!event.shiftKey) return;
        event.preventDefault();
        event.stopPropagation();
        preserveSelectionOnFocus = true;
        setCellSelection({ row, column }, true);
        editor.focus({ preventScroll: true });
      });
      editor.addEventListener("dblclick", (event) => {
        const probe = Math.floor(
          (editor.selectionStart + editor.selectionEnd) / 2,
        );
        const range = mixedScriptWordRangeAt(editor.value, probe);
        if (!range) return;
        event.preventDefault();
        event.stopPropagation();
        editor.setSelectionRange(range.from, range.to);
        cellEditor.dataset.editing = "preview-selection";
        editor.dispatchEvent(new Event("select", { bubbles: true }));
      });
      editor.addEventListener("click", (event) => {
        if (event.detail < 3) return;
        event.preventDefault();
        event.stopPropagation();
        editor.setSelectionRange(0, editor.value.length);
        cellEditor.dataset.editing = "preview-selection";
        editor.dispatchEvent(new Event("select", { bubbles: true }));
      });
      editor.addEventListener("contextmenu", (event) => {
        openContextMenu(event, { row, column });
      });
      editor.addEventListener("beforeinput", () => {
        cellEditor.dataset.editing = "true";
      });
      editor.addEventListener("input", () => {
        draft = updateGfmTableCell(draft, row, column, editor.value);
        renderTableCellPreview(preview, editor.value);
        if (editor.dataset.renderFormattedPreview === "true") {
          delete editor.dataset.renderFormattedPreview;
          cellEditor.dataset.editing = "false";
        }
      });
      editor.addEventListener("blur", (event) => {
        cellEditor.dataset.editing = "false";
        const next = event.relatedTarget;
        if (
          next instanceof Node &&
          (shell.contains(next) || contextMenu.contains(next))
        ) return;
        queueMicrotask(() => {
          if (!shell.isConnected) return;
          const active = document.activeElement;
          if (active instanceof Node && shell.contains(active)) return;
          commit(draft, null);
        });
      });
      editor.addEventListener("keydown", (event) => {
        if (event.isComposing) return;
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          insertTextBlockAfter();
          return;
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
          event.preventDefault();
          event.stopPropagation();
          setCellSelection({ row, column });
          editor.select();
          view.dispatch({
            effects: EditorView.announce.of("محتوای سلول انتخاب شد"),
          });
          return;
        }
        if (event.key === "Delete" && selectedCellCount() > 1) {
          event.preventDefault();
          event.stopPropagation();
          draft = clearGfmTableCells(draft, selectionRange());
          commit(draft, { row: activeRow, column: activeColumn }, "محتوای سلول‌های انتخابی پاک شد");
          return;
        }
        if (
          event.shiftKey &&
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
        ) {
          event.preventDefault();
          event.stopPropagation();
          const next = { ...selectionHead };
          if (event.key === "ArrowUp") next.row = Math.max(-1, next.row - 1);
          if (event.key === "ArrowDown") next.row = Math.min(draft.rows.length - 1, next.row + 1);
          if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
            next.column = Math.max(
              0,
              Math.min(
                draft.headers.length - 1,
                next.column + horizontalColumnDelta(event.key),
              ),
            );
          }
          focusCell(next.row, next.column, true, "end", true);
          return;
        }
        if (
          (event.ctrlKey || event.metaKey) &&
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
            event.key,
          )
        ) {
          const moved = moveToAdjacentCell(
            event.key as "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight",
            { row, column },
            editor.selectionStart,
          );
          if (moved) {
            event.preventDefault();
            event.stopPropagation();
          }
          return;
        }
        if (event.key === "ArrowUp" || event.key === "ArrowDown") {
          const moved = moveToAdjacentCell(
            event.key,
            { row, column },
            editor.selectionStart,
          );
          const leftTable = !moved &&
            leaveTableVertically(event.key === "ArrowDown" ? 1 : -1);
          if (moved || leftTable) {
            event.preventDefault();
            event.stopPropagation();
          }
          return;
        }
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          const direction = getComputedStyle(editor).direction;
          const collapsed = editor.selectionStart === editor.selectionEnd;
          const atVisualEdge =
            event.key === "ArrowLeft"
              ? direction === "rtl"
                ? editor.selectionEnd === editor.value.length
                : editor.selectionStart === 0
              : direction === "rtl"
                ? editor.selectionStart === 0
                : editor.selectionEnd === editor.value.length;
          if (
            collapsed &&
            atVisualEdge &&
            moveToAdjacentCell(
              event.key,
              { row, column },
              editor.selectionStart,
            )
          ) {
            event.preventDefault();
            event.stopPropagation();
          }
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          commit(draft, null);
          focusShell();
          return;
        }
        if (event.key !== "Tab" && event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        const columnCount = draft.headers.length;
        const bodyRow = row + 1;
        const currentIndex = bodyRow * columnCount + column;
        if (event.key === "Enter") {
          let targetRow = row + 1;
          if (targetRow >= draft.rows.length) {
            draft = appendGfmTableRow(draft);
            targetRow = draft.rows.length - 1;
          }
          commit(draft, { row: targetRow, column });
          return;
        }
        const targetIndex = currentIndex + (event.shiftKey ? -1 : 1);
        if (targetIndex < 0) {
          commit(draft, { row: -1, column: 0 });
          return;
        }
        const totalCells = (draft.rows.length + 1) * columnCount;
        if (targetIndex >= totalCells) {
          draft = appendGfmTableRow(draft);
          commit(draft, { row: draft.rows.length - 1, column: 0 });
          return;
        }
        const targetBodyRow = Math.floor(targetIndex / columnCount);
        commit(draft, {
          row: targetBodyRow - 1,
          column: targetIndex % columnCount,
        });
      });
      cellEditor.append(preview, editor);
      return cellEditor;
    };

    this.table.headers.forEach((value, index) => {
      const cell = document.createElement("th");
      cell.scope = "col";
      cell.append(createCellEditor(value, -1, index));
      headerRow.append(cell);
    });
    thead.append(headerRow);
    const tbody = document.createElement("tbody");
    this.table.rows.forEach((row, rowIndex) => {
      const tableRow = document.createElement("tr");
      row.forEach((value, index) => {
        const cell = document.createElement("td");
        cell.append(createCellEditor(value, rowIndex, index));
        tableRow.append(cell);
      });
      tbody.append(tableRow);
    });
    table.append(thead, tbody);
    viewport.append(table);
    shell.append(toolbar, viewport);
    document.body.append(contextMenu);
    tableContextMenus.set(shell, contextMenu);
    updateCellVisuals();
    return shell;
  }

  destroy(dom: HTMLElement) {
    tableContextMenus.get(dom)?.remove();
    tableContextMenus.delete(dom);
  }
}

export class ImageBlockWidget extends SourceBlockWidget {
  private image: HTMLImageElement | null = null;
  private disposed = false;

  constructor(
    from: number,
    to: number,
    source: string,
    private readonly imageData: ImageDescriptor,
    private readonly resolveImage?: RichWidgetOptions["resolveImage"],
  ) { super(from, to, source); }

  eq(other: ImageBlockWidget) {
    return other.from === this.from && other.to === this.to && other.source === this.source;
  }

  toDOM(view: EditorView) {
    this.disposed = false;
    const shell = widgetShell(
      "image",
      this.imageData.alt || "تصویر بدون متن جایگزین",
      this.from,
      this.to,
      view,
    );
    const { header, actions } = widgetHeader("تصویر", this.imageData.alt || "متن جایگزین ندارد");
    actions.append(this.editButton(view));
    const stage = document.createElement("div");
    stage.className = "cm-rich-media-stage is-loading";
    stage.setAttribute("role", "status");
    stage.textContent = "تصویر هنگام دیده‌شدن بارگیری می‌شود…";
    shell.append(header, stage);

    const resolved = this.resolveImage?.(this.imageData.source) ?? (() => {
      const safe = safeLiveImageSource(this.imageData.source);
      return safe ? { status: "ready" as const, source: safe } : { status: "blocked" as const, message: "نشانی تصویر ناامن یا پشتیبانی‌نشده است." };
    })();
    if (resolved.status === "blocked") {
      stage.className = "cm-rich-media-stage is-error";
      stage.setAttribute("role", "note");
      stage.textContent = resolved.message;
      return shell;
    }

    const mount = () => {
      if (this.image || this.disposed) return;
      const image = document.createElement("img");
      this.image = image;
      image.alt = this.imageData.alt;
      image.title = this.imageData.title;
      image.decoding = "async";
      image.loading = "lazy";
      image.width = 1600;
      image.height = 900;
      image.referrerPolicy = /^https?:/iu.test(resolved.source) ? "no-referrer" : "";
      image.addEventListener("load", () => {
        stage.className = "cm-rich-media-stage is-ready";
      }, { once: true });
      image.addEventListener("error", () => {
        stage.className = "cm-rich-media-stage is-error";
        stage.setAttribute("role", "alert");
        stage.textContent = "تصویر بارگیری نشد؛ نشانی یا دسترسی فایل را بررسی کنید.";
      }, { once: true });
      stage.replaceChildren(image);
      image.src = resolved.source;
    };
    mount();
    return shell;
  }

  destroy() {
    this.disposed = true;
    if (this.image) this.image.removeAttribute("src");
    this.image = null;
  }
}

function formatAudioTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "۰:۰۰";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes.toLocaleString("fa-IR")}:${remainder
    .toString()
    .padStart(2, "0")
    .replace(/\d/gu, (digit) => "۰۱۲۳۴۵۶۷۸۹"[Number(digit)])}`;
}

export class AudioBlockWidget extends SourceBlockWidget {
  private audio: HTMLAudioElement | null = null;
  private disposed = false;
  private removeSegmentListener: (() => void) | null = null;

  constructor(
    from: number,
    to: number,
    source: string,
    private readonly audioData: AudioDescriptor,
    private readonly resolveAudio?: RichWidgetOptions["resolveAudio"],
    private readonly openAudioTranscription?: RichWidgetOptions["openAudioTranscription"],
  ) {
    super(from, to, source);
  }

  eq(other: AudioBlockWidget) {
    return (
      other.from === this.from &&
      other.to === this.to &&
      other.source === this.source
    );
  }

  toDOM(view: EditorView) {
    this.disposed = false;
    const shell = widgetShell(
      "audio",
      `فایل صوتی ${this.audioData.fileName}`,
      this.from,
      this.to,
      view,
    );
    shell.dataset.audioSource = this.audioData.source;

    const header = document.createElement("figcaption");
    header.className = "cm-audio-header";
    const status = document.createElement("small");
    status.textContent = "در حال آماده‌سازی پخش…";
    const name = document.createElement("strong");
    name.dir = "auto";
    name.textContent = this.audioData.fileName;
    header.append(status, name);

    const controls = document.createElement("div");
    controls.className = "cm-audio-controls";
    const transcribe = actionButton("تبدیل به متن", () => {
      this.openAudioTranscription?.(
        this.audioData,
        this.from,
        this.to,
      );
    }, "cm-audio-transcribe");
    const transcribeLabel = document.createElement("span");
    transcribeLabel.textContent = "تبدیل به متن";
    transcribe.replaceChildren(
      createMaterialSymbol("speech_to_text"),
      transcribeLabel,
    );

    const timeline = document.createElement("div");
    timeline.className = "cm-audio-timeline";
    const range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = "1000";
    range.value = "0";
    range.dir = "ltr";
    range.setAttribute("aria-label", "موقعیت پخش صوت");
    const time = document.createElement("span");
    time.textContent = "۰:۰۰ / ۰:۰۰";
    timeline.append(range, time);

    const play = document.createElement("button");
    play.type = "button";
    play.className = "cm-audio-play";
    play.setAttribute("aria-label", "پخش صوت");
    play.append(createMaterialSymbol("play_arrow"));
    const audio = document.createElement("audio");
    this.audio = audio;
    audio.preload = "metadata";

    let playingState = false;
    const sync = () => {
      const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
      const current = Math.min(audio.currentTime, duration || audio.currentTime);
      range.value = duration ? String(Math.round((current / duration) * 1000)) : "0";
      time.textContent = `${formatAudioTime(current)} / ${formatAudioTime(duration)}`;
      if (playingState !== !audio.paused) {
        playingState = !audio.paused;
        play.replaceChildren(
          createMaterialSymbol(playingState ? "pause" : "play_arrow"),
        );
      }
      play.setAttribute("aria-label", audio.paused ? "پخش صوت" : "توقف موقت صوت");
    };
    audio.addEventListener("loadedmetadata", () => {
      status.textContent = "آمادهٔ پخش";
      shell.classList.remove("is-loading");
      sync();
    });
    audio.addEventListener("timeupdate", sync);
    audio.addEventListener("play", sync);
    audio.addEventListener("pause", sync);
    audio.addEventListener("ended", sync);
    audio.addEventListener("error", () => {
      status.textContent = "فایل صوتی در دسترس نیست";
      shell.classList.add("is-error");
    });
    play.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!audio.src) return;
      if (audio.paused) void audio.play();
      else audio.pause();
    });
    range.addEventListener("input", () => {
      if (!Number.isFinite(audio.duration) || !audio.duration) return;
      audio.currentTime = (Number(range.value) / 1000) * audio.duration;
      sync();
    });
    for (const eventName of ["pointerdown", "mousedown", "click", "keydown"]) {
      range.addEventListener(eventName, (event) => event.stopPropagation());
    }

    const onPlaySegment = (event: Event) => {
      const detail = (event as CustomEvent<{
        source?: string;
        startMs?: number;
        endMs?: number;
      }>).detail;
      if (!detail || detail.source !== this.audioData.source || !audio.src) return;
      audio.currentTime = Math.max(0, Number(detail.startMs ?? 0) / 1000);
      void audio.play();
      const endSeconds = Number(detail.endMs ?? 0) / 1000;
      if (endSeconds > audio.currentTime) {
        const stopAtEnd = () => {
          if (audio.currentTime < endSeconds) return;
          audio.pause();
          audio.removeEventListener("timeupdate", stopAtEnd);
        };
        audio.addEventListener("timeupdate", stopAtEnd);
      }
    };
    window.addEventListener("raavi:play-audio-segment", onPlaySegment);
    this.removeSegmentListener = () =>
      window.removeEventListener("raavi:play-audio-segment", onPlaySegment);

    controls.append(transcribe, timeline, play, audio);
    shell.append(header, controls);

    void Promise.resolve(
      this.resolveAudio?.(this.audioData.source) ?? {
        status: "ready" as const,
        source: this.audioData.source,
      },
    ).then((resolved) => {
      if (this.disposed) return;
      if (resolved.status === "blocked") {
        status.textContent = resolved.message;
        shell.classList.add("is-error");
        return;
      }
      audio.src = resolved.source;
      audio.load();
    });

    return shell;
  }

  destroy() {
    this.disposed = true;
    this.removeSegmentListener?.();
    this.removeSegmentListener = null;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute("src");
      this.audio.load();
    }
    this.audio = null;
  }
}

const lastHealthyMermaid = new Map<number, string>();
function rememberMermaid(from: number, svg: string) {
  lastHealthyMermaid.delete(from);
  lastHealthyMermaid.set(from, svg);
  while (lastHealthyMermaid.size > 32) lastHealthyMermaid.delete(lastHealthyMermaid.keys().next().value!);
}

export class MermaidBlockWidget extends SourceBlockWidget {
  private blob: MermaidBlobUrl | null = null;
  private disposed = false;

  constructor(
    from: number,
    to: number,
    source: string,
    private readonly fence: FenceDescriptor,
    private readonly openStudio?: RichWidgetOptions["openMermaidStudio"],
  ) { super(from, to, source); }

  eq(other: MermaidBlockWidget) {
    return other.from === this.from && other.to === this.to && other.source === this.source;
  }

  toDOM(view: EditorView) {
    this.disposed = false;
    const shell = widgetShell(
      "mermaid",
      "نمودار Mermaid",
      this.from,
      this.to,
      view,
    );
    const { header, actions } = widgetHeader("نمودار", "Mermaid");
    if (this.openStudio) actions.append(actionButton("بازکردن در استودیو", () => this.openStudio?.(this.from, this.to)));
    actions.append(this.editButton(view));
    const stage = document.createElement("div");
    stage.className = "cm-rich-media-stage cm-rich-mermaid-stage is-loading";
    stage.setAttribute("role", "status");
    stage.textContent = "نمودار هنگام دیده‌شدن ساخته می‌شود…";
    const sourceAlternative = document.createElement("details");
    sourceAlternative.className = "cm-rich-text-alternative";
    const summary = document.createElement("summary");
    summary.textContent = "نمایش متن نمودار";
    const pre = document.createElement("pre");
    pre.dir = "ltr";
    pre.textContent = this.fence.code;
    sourceAlternative.append(summary, pre);
    shell.append(header, stage, sourceAlternative);

    const showSvg = (svg: string) => {
      this.blob?.revoke();
      this.blob = createMermaidBlobUrl(svg);
      if (!this.blob || this.disposed) return;
      const image = document.createElement("img");
      image.className = "cm-rich-mermaid-svg";
      image.width = 800;
      image.height = 450;
      image.src = this.blob.url;
      image.alt = mermaidSvgAccessibleName(svg);
      image.draggable = false;
      stage.className = "cm-rich-media-stage cm-rich-mermaid-stage is-ready";
      stage.replaceChildren(image);
    };
    const render = async () => {
      const previous = lastHealthyMermaid.get(this.from);
      if (previous) showSvg(previous);
      try {
        const { renderMermaid } = await import("../mermaid/renderer");
        const theme = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
        const result = await renderMermaid(this.fence.code, theme, {
          documentId: "live-editor",
          blockId: `live-${this.from}`,
          priority: "visible",
        });
        if (this.disposed) return;
        if (result.ok) {
          rememberMermaid(this.from, result.svg);
          showSvg(result.svg);
          return;
        }
        stage.classList.add("has-error");
        const error = document.createElement("p");
        error.className = "cm-rich-media-error";
        error.setAttribute("role", "alert");
        error.textContent = previous
          ? "کد تازه معتبر نیست؛ آخرین نمودار سالم نگه داشته شد. متن Mermaid را ویرایش کنید."
          : "نمودار ساخته نشد؛ متن Mermaid را ویرایش و خط مشخص‌شده را اصلاح کنید.";
        if (previous) stage.append(error);
        else { stage.className = "cm-rich-media-stage cm-rich-mermaid-stage is-error"; stage.replaceChildren(error); }
      } catch {
        if (this.disposed) return;
        stage.className = "cm-rich-media-stage cm-rich-mermaid-stage is-error";
        stage.textContent = "سازندهٔ نمودار در دسترس نیست؛ متن شما محفوظ است و می‌توانید Markdown را ویرایش کنید.";
      }
    };
    void render();
    return shell;
  }

  destroy() {
    this.disposed = true;
    this.blob?.revoke();
    this.blob = null;
  }
}

export class FormulaBlockWidget extends SourceBlockWidget {
  constructor(
    from: number,
    to: number,
    source: string,
    private readonly block: FormulaBlock,
    private readonly openStudio?: RichWidgetOptions["openFormulaStudio"],
  ) { super(from, to, source); }

  eq(other: FormulaBlockWidget) {
    return other.from === this.from &&
      other.to === this.to &&
      other.source === this.source;
  }

  toDOM(view: EditorView) {
    const accessibleName = formulaAccessibleText(this.block.latex) || "فرمول";
    const shell = widgetShell(
      "formula",
      accessibleName,
      this.from,
      this.to,
      view,
    );
    shell.dataset.formulaFrom = String(this.block.startOffset);
    const { header, actions } = widgetHeader("فرمول", "رندر‌شده");
    const editAction = this.openStudio
      ? actionButton("ویرایش در استودیو", (button) =>
          this.openStudio?.(this.from, this.to, button))
      : null;
    if (editAction) actions.append(editAction);
    const stage = document.createElement("div");
    stage.className = "cm-rich-formula-stage";
    stage.dir = "ltr";
    stage.setAttribute("role", "img");
    stage.setAttribute("aria-label", accessibleName);
    try {
      katex.render(this.block.latex, stage, {
        displayMode: true,
        output: "mathml",
        throwOnError: false,
        strict: "ignore",
      });
    } catch {
      stage.classList.add("is-error");
      stage.setAttribute("role", "alert");
      stage.textContent = "فرمول رندر نشد؛ آن را در استودیو ویرایش کنید.";
    }
    stage.addEventListener("dblclick", (event) => {
      if (!this.openStudio) return;
      event.preventDefault();
      event.stopPropagation();
      this.openStudio(this.from, this.to, editAction ?? shell);
    });
    shell.append(header, stage);
    return shell;
  }
}

export class FootnoteWidget extends WidgetType {
  constructor(
    private readonly id: string,
    private readonly from: number,
    private readonly to: number,
    private readonly target: number | null,
    private readonly definition: boolean,
  ) { super(); }

  eq(other: FootnoteWidget) {
    return other.id === this.id && other.from === this.from && other.to === this.to && other.target === this.target && other.definition === this.definition;
  }

  toDOM(view: EditorView) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `cm-rich-footnote ${this.definition ? "is-definition" : "is-reference"}`;
    button.textContent = this.definition ? `پاورقی ${this.id}` : this.id;
    button.title = this.target === null ? "پاورقی متناظر پیدا نشد؛ نمایش Markdown" : this.definition ? "رفتن به نخستین ارجاع" : "رفتن به تعریف پاورقی";
    button.setAttribute("aria-label", button.title);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const position = this.target ?? this.from;
      view.dispatch({ selection: { anchor: position }, effects: EditorView.scrollIntoView(position, { y: "center" }) });
      view.focus();
    });
    return button;
  }

  ignoreEvent() { return true; }
}
