"use client";

import {
  defaultKeymap,
  history,
  indentLess,
  indentMore,
  isolateHistory,
  redo,
  undo,
} from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  syntaxTree,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { lintKeymap } from "@codemirror/lint";
import {
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  highlightSelectionMatches,
  openSearchPanel,
  replaceAll,
  replaceNext,
  search,
  SearchQuery,
  searchKeymap,
  setSearchQuery,
} from "@codemirror/search";
import {
  Compartment,
  EditorState,
  Facet,
  Prec,
  StateEffect,
  StateField,
  Transaction,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  dropCursor,
  EditorView,
  gutter,
  GutterMarker,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  type Panel,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";
import type { SingleEditorMode } from "../editor/mode";
import {
  activeEditingBlockRange,
  activeEditingBlockRangeExtension,
  createLivePreviewExtension,
  setActiveEditingBlockRange,
  type LivePreviewFailure,
  viewportDirectionExtension,
} from "../editor/live-preview";
import type { LiveImageResolution } from "../editor/rich-block-widgets";
import type { LiveAudioResolution } from "../editor/rich-block-widgets";
import type { AudioDescriptor } from "../audio/types";
import {
  resolveAdjacentMarkdownBlockRange,
  resolveMarkdownBlockRange,
} from "../editor/rich-blocks";
import {
  markdownListItemAt,
  parseMarkdownListBlock,
  planMarkdownEmptyListItemDeletion,
  planMarkdownListIndentation,
  planMarkdownListItemInsertion,
  planMarkdownListItemMove,
  planMarkdownListItemMoveTo,
  planMarkdownListItemSoftBreak,
  type MarkdownListEditPlan,
} from "../editor/list-blocks";
import {
  createStructuralBlockOperations,
  type StructuralBlockId,
  type StructuralBlockOperation,
  type StructuralMoveDirection,
} from "../editor/block-operations";
import {
  clearStructuralBlockSelection,
  setStructuralBlockSelection,
  structuralBlockSelection,
  structuralBlockSelectionField,
  transactionChangesStructuralBlockSelection,
  type StructuralBlockSelection,
} from "../editor/block-selection";
import {
  closeBrackets,
  closeBracketsKeymap,
} from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
} from "react";
import type { SemanticDocumentAnchor } from "../context/semantic-anchor";
import type { CommandPlatform } from "../keyboard/command-registry";
import type { CodeViewLineDirection } from "../editor/code-view-preferences";
import { contextualShortcutsFor } from "../editor/contextual-shortcuts";
import { mixedScriptWordRangeAt } from "../editor/text-selection";
import { GripVertical, Notes } from "../icons/material-symbols";
import { MATERIAL_SYMBOL_PATHS } from "../icons/material-symbol-paths";
import { MagicWandTrigger } from "./magic-wand-trigger";

const KEYBOARD_READING_BAND_RATIO = 0.32;

function keyboardReadingBandMargin(view: EditorView) {
  return Math.round(view.scrollDOM.clientHeight * KEYBOARD_READING_BAND_RATIO);
}

function syncKeyboardReadingBandSpace(view: EditorView) {
  view.contentDOM.style.setProperty(
    "--editor-keyboard-safe-margin",
    `${keyboardReadingBandMargin(view)}px`,
  );
}

export type TableCellTextSelection = {
  key: string;
  blockFrom: number;
  row: number;
  column: number;
  value: string;
  text: string;
  start: number;
  end: number;
  clientX: number;
  clientY: number;
};

export type MarkdownCodeEditorHandle = {
  readonly element: HTMLElement | null;
  readonly value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  readonly tableCellSelection: TableCellTextSelection | null;
  readonly clientHeight: number;
  readonly scrollHeight: number;
  scrollTop: number;
  contains: (target: Node | null) => boolean;
  captureSemanticAnchor: () => SemanticDocumentAnchor | null;
  focus: () => void;
  findNext: () => void;
  findPrevious: () => void;
  getBoundingClientRect: () => DOMRect;
  getBlockRange: (position: number) => { from: number; to: number } | null;
  getRangeClientRect: (from: number, to: number) => DOMRect | null;
  getSelectionAnchor: () => { clientX: number; clientY: number } | null;
  focusTableCellSelection: () => boolean;
  openSearch: () => void;
  openReplace: () => void;
  replaceRange: (edit: {
    from: number;
    to: number;
    insert: string;
    selectionFrom?: number;
    selectionTo?: number;
    announcement?: string;
  }) => void;
  replaceTableCellRange: (edit: {
    from: number;
    to: number;
    insert: string;
    selectionFrom?: number;
    selectionTo?: number;
    announcement?: string;
  }) => boolean;
  restoreSemanticAnchor: (anchor: SemanticDocumentAnchor) => void;
  redo: () => void;
  selectAll: () => void;
  setSelectionRange: (start: number, end: number, reveal?: boolean) => void;
  undo: () => void;
};

export type EditorFormattingContext = {
  bold: boolean;
  italic: boolean;
  code: boolean;
  link: boolean;
  block:
    | "paragraph"
    | "heading"
    | "bullet-list"
    | "ordered-list"
    | "task"
    | "quote"
    | "divider"
    | "code-block"
    | "callout"
    | "table"
    | "image"
    | "mermaid"
    | "formula";
  headingLevel: number | null;
};

type MarkdownCodeEditorProps = {
  ariaDescribedBy?: string;
  className?: string;
  commandPlatform: CommandPlatform;
  id: string;
  livePreviewEnabled?: boolean;
  lineDirection?: CodeViewLineDirection;
  mode: SingleEditorMode;
  contextualHintsVisible?: boolean;
  writingBlockGutter?: boolean;
  writingBlockMenuOpen?: boolean;
  onChange: (value: string) => void;
  onBlockMenu?: (
    lineFrom: number,
    trigger: HTMLElement,
    source?: "gutter" | "slash",
  ) => void;
  onContextChange?: (context: EditorFormattingContext) => void;
  onLivePreviewFailure?: (failure: LivePreviewFailure) => void;
  onOpenMermaidStudio?: (from: number, to: number) => void;
  onOpenFormulaStudio?: (
    from: number,
    to: number,
    opener?: HTMLElement,
  ) => void;
  onOpenAudioTranscription?: (
    descriptor: AudioDescriptor,
    from: number,
    to: number,
  ) => void;
  onOpenAiForBlock?: (block: {
    from: number;
    to: number;
    content: string;
  }) => void;
  onScroll: () => void;
  onSelectionChange: (pointer?: {
    clientX: number;
    clientY: number;
  }) => void;
  resolveLiveImage?: (source: string) => LiveImageResolution;
  resolveLiveAudio?: (
    source: string,
  ) => LiveAudioResolution | Promise<LiveAudioResolution>;
  transformPastedText?: (value: string) => string;
  value: string;
};

type DoubleClickAnchor = {
  position: number;
  blockFrom: number;
  blockTo: number;
  clientX: number;
  clientY: number;
  capturedAt: number;
};

class ContextualShortcutHintsWidget extends WidgetType {
  constructor(
    readonly hints: ReturnType<typeof contextualShortcutsFor>,
  ) {
    super();
  }

  eq(other: WidgetType) {
    return (
      other instanceof ContextualShortcutHintsWidget &&
      other.hints.length === this.hints.length &&
      other.hints.every(
        (hint, index) =>
          hint.keys === this.hints[index]?.keys &&
          hint.label === this.hints[index]?.label,
      )
    );
  }

  toDOM() {
    const hint = document.createElement("div");
    hint.className = "cm-contextual-shortcut-hint";
    hint.dir = "rtl";
    hint.setAttribute("role", "note");
    hint.setAttribute("aria-label", "میان‌برهای بلاک فعال");
    this.hints.forEach((item, index) => {
      if (index > 0) {
        const separator = document.createElement("span");
        separator.className = "cm-contextual-shortcut-separator";
        separator.textContent = "/";
        separator.setAttribute("aria-hidden", "true");
        hint.append(separator);
      }
      const entry = document.createElement("span");
      entry.className = "cm-contextual-shortcut-entry";
      const keys = document.createElement("kbd");
      keys.dir = "ltr";
      keys.textContent = item.keys;
      const label = document.createElement("span");
      label.textContent = item.label;
      entry.append(keys, label);
      hint.append(entry);
    });
    return hint;
  }

  ignoreEvent() {
    return true;
  }
}

type ContextualShortcutFocus = {
  from: number | null;
  rendered: boolean;
};

type ContextualShortcutHintState = ContextualShortcutFocus & {
  decorations: DecorationSet;
};

const refreshContextualShortcutHints =
  StateEffect.define<ContextualShortcutFocus>();

function contextualShortcutDecorations(
  state: EditorState,
  platform: CommandPlatform,
  focus: ContextualShortcutFocus,
): DecorationSet {
  const selection = state.selection.main;
  const structuralSelection = structuralBlockSelection(state);
  const position = focus.from ?? structuralSelection?.from ?? selection.anchor;
  const block = resolveMarkdownBlockRange(
    state.doc.toString(),
    position,
  );
  if (!block) return Decoration.none;
  const hints = contextualShortcutsFor({
    blockKind: block.kind,
    platform,
    rendered: focus.rendered,
    structuralSelection: Boolean(structuralSelection),
    // Keep the in-flow hint geometry identical while a pointer selection is
    // growing. The formatting toolbar already exposes Alt+F10 for a selection.
    textSelection: false,
  });
  if (!hints.length) return Decoration.none;
  return Decoration.set([
    Decoration.widget({
      block: true,
      side: 1,
      widget: new ContextualShortcutHintsWidget(hints),
    }).range(block.to),
  ]);
}

function contextualShortcutFocusFromElement(
  element: Element | null,
  view: EditorView,
): ContextualShortcutFocus {
  const richBlock =
    element && view.dom.contains(element)
      ? element.closest<HTMLElement>(".cm-rich-block[data-rich-block-from]")
      : null;
  const from = Number(richBlock?.dataset.richBlockFrom);
  return {
    from: Number.isFinite(from) ? from : null,
    rendered: Boolean(richBlock),
  };
}

function contextualShortcutHintsExtension(platform: CommandPlatform) {
  const stateField = StateField.define<ContextualShortcutHintState>({
    create(state) {
      const focus = { from: null, rendered: false };
      return {
        ...focus,
        decorations: contextualShortcutDecorations(state, platform, focus),
      };
    },
    update(current, transaction) {
      let focus: ContextualShortcutFocus = {
        from: current.from,
        rendered: current.rendered,
      };
      for (const effect of transaction.effects) {
        if (effect.is(refreshContextualShortcutHints)) {
          focus = effect.value;
        }
      }
      return {
        ...focus,
        decorations: contextualShortcutDecorations(
          transaction.state,
          platform,
          focus,
        ),
      };
    },
    provide: (field) =>
      EditorView.decorations.from(field, (value) => value.decorations),
  });

  const refreshAfterFocusSettles = (view: EditorView) => {
    queueMicrotask(() => {
      if (!view.dom.isConnected) return;
      const activeElement = document.activeElement;
      view.dispatch({
        effects: refreshContextualShortcutHints.of(
          contextualShortcutFocusFromElement(
            activeElement instanceof Element ? activeElement : null,
            view,
          ),
        ),
      });
    });
  };

  return [
    stateField,
    EditorView.domEventHandlers({
      focusin: (_event, view) => {
        refreshAfterFocusSettles(view);
        return false;
      },
      focusout: (_event, view) => {
        refreshAfterFocusSettles(view);
        return false;
      },
    }),
  ];
}

function sourcePositionAtMouse(view: EditorView, event: MouseEvent) {
  const documentWithWebKitCaret = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const caretPosition = document.caretPositionFromPoint?.(
    event.clientX,
    event.clientY,
  );
  const node = caretPosition?.offsetNode;
  const offset = caretPosition?.offset;
  if (node && offset !== undefined && view.contentDOM.contains(node)) {
    const nodeElement = node instanceof Element ? node : node.parentElement;
    const liveLink = nodeElement?.closest<HTMLElement>(".cm-live-link");
    const linkFrom = Number(liveLink?.dataset.liveLinkFrom);
    const urlFrom = Number(liveLink?.dataset.liveLinkUrlFrom);
    if (
      liveLink &&
      Number.isFinite(linkFrom) &&
      Number.isFinite(urlFrom) &&
      liveLink.contains(node)
    ) {
      const visualPrefix = document.createRange();
      visualPrefix.selectNodeContents(liveLink);
      visualPrefix.setEnd(node, offset);
      const labelFrom = linkFrom + 1;
      const labelTo = Math.max(labelFrom, urlFrom - 2);
      return Math.min(
        labelTo,
        labelFrom + visualPrefix.toString().length,
      );
    }
    try {
      return view.posAtDOM(node, offset);
    } catch {
      // Fall through to the WebKit and geometry-based caret APIs.
    }
  }

  const caretRange = documentWithWebKitCaret.caretRangeFromPoint?.(
    event.clientX,
    event.clientY,
  );
  if (caretRange && view.contentDOM.contains(caretRange.startContainer)) {
    try {
      return view.posAtDOM(caretRange.startContainer, caretRange.startOffset);
    } catch {
      // Fall through to CodeMirror's geometry mapping.
    }
  }
  return view.posAtCoords({ x: event.clientX, y: event.clientY });
}

function sourceLineRangeAtEventTarget(
  view: EditorView,
  event: MouseEvent,
) {
  const target = event.target;
  const element = target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  const line = element?.closest<HTMLElement>(".cm-line");
  if (!line || !view.contentDOM.contains(line)) {
    const fallback = sourcePositionAtMouse(view, event);
    return fallback === null ? null : view.state.doc.lineAt(fallback);
  }
  try {
    const mappedPosition = view.posAtDOM(line, 0);
    const visibleText = line.textContent?.trim() ?? "";
    if (!visibleText) return view.state.doc.lineAt(mappedPosition);
    const mappedLine = view.state.doc.lineAt(mappedPosition);
    for (let distance = 0; distance <= 3; distance += 1) {
      for (const direction of distance === 0 ? [0] : [-1, 1]) {
        const lineNumber = mappedLine.number + distance * direction;
        if (lineNumber < 1 || lineNumber > view.state.doc.lines) continue;
        const candidate = view.state.doc.line(lineNumber);
        if (candidate.text.trim() === visibleText) return candidate;
      }
    }
    return mappedLine;
  } catch {
    const fallback = sourcePositionAtMouse(view, event);
    return fallback === null ? null : view.state.doc.lineAt(fallback);
  }
}

function pinEditorScroll(view: EditorView, top: number, frames = 3) {
  const apply = (remaining: number) => {
    if (!view.dom.isConnected) return;
    view.scrollDOM.scrollTop = top;
    if (remaining > 0) {
      requestAnimationFrame(() => apply(remaining - 1));
    }
  };
  apply(frames);
}

type PointerBlockDropPlacement = "before" | "after";

type PointerBlockDragState = {
  kind: "block";
  pointerId: number;
  handle: HTMLButtonElement;
  sourceBlockId: StructuralBlockId;
  sourceBlockIndex: number;
  sourceLineFrom: number;
  startX: number;
  startY: number;
  dragging: boolean;
  targetIndex: number | null;
};

type PointerListItemDragState = {
  kind: "list-item";
  pointerId: number;
  handle: HTMLButtonElement;
  sourcePosition: number;
  sourceSiblingIndex: number;
  startX: number;
  startY: number;
  dragging: boolean;
  targetIndex: number | null;
};

type PointerEditorDragState =
  | PointerBlockDragState
  | PointerListItemDragState;

function movableEditorBlockAt(state: EditorState, position: number) {
  const resolved = resolveMarkdownBlockRange(state.doc.toString(), position);
  const activeBlock = activeEditingBlockRange(state, true);
  if (
    !activeBlock ||
    position < activeBlock.from ||
    position > activeBlock.to
  ) {
    return resolved;
  }
  return {
    ...resolved,
    from: activeBlock.from,
    to: activeBlock.to,
    lineFrom: state.doc.lineAt(activeBlock.from).number,
    lineTo: state.doc.lineAt(Math.min(state.doc.length, activeBlock.to)).number,
  };
}

function structuralBlockOperations(view: EditorView) {
  const selectedBlock = structuralBlockSelection(view.state);
  const selection = selectedBlock
    ? {
        anchor: selectedBlock.returnAnchor,
        head: selectedBlock.returnHead,
      }
    : view.state.selection.main;
  return createStructuralBlockOperations(
    view.state.doc.toString(),
    { anchor: selection.anchor, head: selection.head },
    activeEditingBlockRange(view.state, true),
  );
}

function structuralOperationPosition(view: EditorView) {
  return structuralBlockSelection(view.state)?.from ?? view.state.selection.main.head;
}

function moveOneVisibleSourceLine(
  view: EditorView,
  direction: "up" | "down",
) {
  const selection = view.state.selection.main;
  if (!selection.empty) return false;
  const current = view.state.doc.lineAt(selection.head);
  const step = direction === "up" ? -1 : 1;
  const preferredColumn = selection.head - current.from;

  for (
    let lineNumber = current.number + step;
    lineNumber >= 1 && lineNumber <= view.state.doc.lines;
    lineNumber += step
  ) {
    const target = view.state.doc.line(lineNumber);
    if (view.lineBlockAt(target.from).height < 1) continue;
    const lastInteriorPosition = target.length > 0 ? target.to - 1 : target.from;
    const head = Math.min(
      lastInteriorPosition,
      target.from + preferredColumn,
    );
    view.dispatch({
      selection: { anchor: head },
      annotations: Transaction.userEvent.of("select.keyboard"),
      effects: EditorView.scrollIntoView(head, { y: "nearest" }),
    });
    return true;
  }
  return false;
}

function editorBlockVerticalBounds(
  view: EditorView,
  range: { from: number; to: number },
) {
  const firstLine = view.state.doc.lineAt(range.from);
  const lastLine = view.state.doc.lineAt(Math.max(range.from, range.to - 1));
  const first = view.coordsAtPos(firstLine.from, 1);
  const last = view.coordsAtPos(lastLine.to, -1);
  if (!first || !last) return null;
  return { top: first.top, bottom: last.bottom };
}

function pointerBlockDropTarget(
  view: EditorView,
  clientY: number,
  sourceBlockIndex: number,
) {
  const operations = structuralBlockOperations(view);
  let target:
    | {
        index: number;
        placement: PointerBlockDropPlacement;
        boundaryY: number;
      }
    | undefined;

  for (const block of operations.blocks) {
    const bounds = editorBlockVerticalBounds(view, block.range);
    if (!bounds) continue;
    if (clientY < bounds.top) {
      target = {
        index: block.index,
        placement: "before",
        boundaryY: bounds.top,
      };
      break;
    }
    if (clientY <= bounds.bottom) {
      const placement = clientY < (bounds.top + bounds.bottom) / 2
        ? "before"
        : "after";
      target = {
        index: block.index,
        placement,
        boundaryY: placement === "before" ? bounds.top : bounds.bottom,
      };
      break;
    }
    target = {
      index: block.index,
      placement: "after",
      boundaryY: bounds.bottom,
    };
  }
  if (!target) return null;

  const boundaryIndex = target.index + (target.placement === "after" ? 1 : 0);
  const finalIndex = boundaryIndex - (sourceBlockIndex < boundaryIndex ? 1 : 0);
  if (finalIndex === sourceBlockIndex) return null;
  return {
    targetIndex: finalIndex,
    placement: target.placement,
    boundaryY: target.boundaryY,
  };
}

function activeListItemContext(view: EditorView, position: number) {
  const range = resolveMarkdownBlockRange(view.state.doc.toString(), position);
  if (range.kind !== "list") return null;
  const source = view.state.doc.sliceString(range.from, range.to);
  const block = parseMarkdownListBlock(source);
  const localPosition = position - range.from;
  const item = markdownListItemAt(block, localPosition);
  if (!item) return null;
  const siblings = block.items.filter(
    (candidate) => candidate.parentId === item.parentId,
  );
  return {
    range,
    source,
    block,
    item,
    siblings,
    siblingIndex: siblings.findIndex((candidate) => candidate.id === item.id),
    localPosition,
  };
}

function pointerListItemDropTarget(
  view: EditorView,
  clientY: number,
  drag: PointerListItemDragState,
) {
  const context = activeListItemContext(view, drag.sourcePosition);
  if (!context || context.siblingIndex !== drag.sourceSiblingIndex) return null;
  let target:
    | {
        index: number;
        placement: PointerBlockDropPlacement;
        boundaryY: number;
      }
    | undefined;

  for (const [index, sibling] of context.siblings.entries()) {
    const bounds = editorBlockVerticalBounds(view, {
      from: context.range.from + sibling.from,
      to: context.range.from + sibling.subtreeTo,
    });
    if (!bounds) continue;
    if (clientY < bounds.top) {
      target = { index, placement: "before", boundaryY: bounds.top };
      break;
    }
    if (clientY <= bounds.bottom) {
      const placement = clientY < (bounds.top + bounds.bottom) / 2
        ? "before"
        : "after";
      target = {
        index,
        placement,
        boundaryY: placement === "before" ? bounds.top : bounds.bottom,
      };
      break;
    }
    target = { index, placement: "after", boundaryY: bounds.bottom };
  }
  if (!target) return null;

  const boundaryIndex = target.index + (target.placement === "after" ? 1 : 0);
  const finalIndex =
    boundaryIndex -
    (drag.sourceSiblingIndex < boundaryIndex ? 1 : 0);
  if (finalIndex === drag.sourceSiblingIndex) return null;
  return {
    targetIndex: finalIndex,
    placement: target.placement,
    boundaryY: target.boundaryY,
  };
}

function clampEditorPosition(value: number, from: number, to: number) {
  return Math.max(from, Math.min(value, to));
}

function selectEditorBlock(view: EditorView, position: number) {
  const range = movableEditorBlockAt(view.state, position);
  const selection = view.state.selection.main;
  const returnAnchor = clampEditorPosition(selection.anchor, range.from, range.to);
  const returnHead = clampEditorPosition(selection.head, range.from, range.to);
  view.dispatch({
    selection: { anchor: returnHead, head: returnHead },
    effects: [
      setStructuralBlockSelection.of({
        from: range.from,
        to: range.to,
        returnAnchor,
        returnHead,
      }),
      EditorView.announce.of("بلاک انتخاب شد."),
    ],
    annotations: Transaction.userEvent.of("select.block"),
  });
  return true;
}

function clearEditorBlockSelection(view: EditorView) {
  const selectedBlock = structuralBlockSelection(view.state);
  if (!selectedBlock) return false;
  const length = view.state.doc.length;
  const anchor = Math.max(0, Math.min(selectedBlock.returnAnchor, length));
  const head = Math.max(0, Math.min(selectedBlock.returnHead, length));
  view.dispatch({
    selection: { anchor, head },
    effects: [
      clearStructuralBlockSelection.of(null),
      EditorView.announce.of("انتخاب بلاک لغو شد."),
    ],
    annotations: Transaction.userEvent.of("select.block.clear"),
  });
  view.focus();
  return true;
}

function structuralSelectionForOperation(
  view: EditorView,
  operation: StructuralBlockOperation,
): StructuralBlockSelection | null {
  const selectedBlock = structuralBlockSelection(view.state);
  if (operation.operation === "insertAfter") return null;

  const sourceSelection = selectedBlock ?? {
    from: operation.sourceRange.from,
    to: operation.sourceRange.to,
    returnAnchor: clampEditorPosition(
      view.state.selection.main.anchor,
      operation.sourceRange.from,
      operation.sourceRange.to,
    ),
    returnHead: clampEditorPosition(
      view.state.selection.main.head,
      operation.sourceRange.from,
      operation.sourceRange.to,
    ),
  };
  const sourceLength = Math.max(0, sourceSelection.to - sourceSelection.from);
  const resultLength = Math.max(0, operation.resultRange.to - operation.resultRange.from);
  const relativeAnchor = clampEditorPosition(
    sourceSelection.returnAnchor - sourceSelection.from,
    0,
    sourceLength,
  );
  const relativeHead = clampEditorPosition(
    sourceSelection.returnHead - sourceSelection.from,
    0,
    sourceLength,
  );
  return {
    from: operation.resultRange.from,
    to: operation.resultRange.to,
    returnAnchor:
      operation.resultRange.from + Math.min(relativeAnchor, resultLength),
    returnHead:
      operation.resultRange.from + Math.min(relativeHead, resultLength),
  };
}

function applyStructuralBlockOperation(
  view: EditorView,
  operation: StructuralBlockOperation | null,
) {
  if (!operation) return false;
  const nextBlockSelection = structuralSelectionForOperation(view, operation);
  const effects = [
    EditorView.announce.of(operation.announcement),
    setActiveEditingBlockRange.of(operation.resultRange),
    ...(nextBlockSelection
      ? [setStructuralBlockSelection.of(nextBlockSelection)]
      : [clearStructuralBlockSelection.of(null)]),
  ];
  view.dispatch({
    changes: operation.changes,
    selection: operation.selection,
    annotations: [
      Transaction.addToHistory.of(true),
      Transaction.userEvent.of(operation.userEvent),
      isolateHistory.of("full"),
    ],
    effects,
  });
  if (operation.focus === "editor") view.focus();
  return true;
}

function reorderEditorBlock(
  view: EditorView,
  direction: StructuralMoveDirection,
) {
  const operations = structuralBlockOperations(view);
  const sourceBlockId = operations.blockIdAt(structuralOperationPosition(view));
  const operation = operations.move(sourceBlockId, direction);
  if (operation) {
    applyStructuralBlockOperation(view, operation);
    return "moved" as const;
  }

  view.dispatch({
    effects: EditorView.announce.of(
      direction === "up"
        ? "بلاک در ابتدای سند است و بالاتر نمی‌رود."
        : "بلاک در انتهای سند است و پایین‌تر نمی‌رود.",
    ),
    annotations: Transaction.userEvent.of("input.block.move.boundary"),
  });
  return "boundary" as const;
}

function applyMarkdownListEdit(
  view: EditorView,
  range: { from: number; to: number },
  plan: MarkdownListEditPlan | null,
) {
  if (!plan) return false;
  if (!plan.changed) {
    view.dispatch({
      effects: EditorView.announce.of(plan.announcement),
      annotations: Transaction.userEvent.of(plan.userEvent),
    });
    view.focus();
    return true;
  }
  const caret = range.from + plan.selectionOffset;
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: plan.markdown },
    selection: { anchor: caret, head: caret },
    effects: [
      setActiveEditingBlockRange.of({
        from: range.from,
        to: range.from + plan.markdown.length,
      }),
      EditorView.announce.of(plan.announcement),
    ],
    annotations: [
      Transaction.addToHistory.of(true),
      Transaction.userEvent.of(plan.userEvent),
      isolateHistory.of("full"),
    ],
  });
  view.focus();
  return true;
}

function insertLineInsideActiveBlock(view: EditorView) {
  const selection = view.state.selection.main;
  const activeBlock = activeEditingBlockRange(view.state, true) ??
    resolveMarkdownBlockRange(view.state.doc.toString(), selection.head);
  if (selection.from < activeBlock.from || selection.to > activeBlock.to) {
    view.dispatch({
      effects: EditorView.announce.of(
        "برای ساخت بلاک جدید از Ctrl یا Command همراه Enter استفاده کنید.",
      ),
      annotations: Transaction.userEvent.of("input.block.lineBreak.boundary"),
    });
    return true;
  }

  const source = view.state.doc.toString();
  const lineBreak = source.includes("\r\n") ? "\r\n" : "\n";
  const removedLength = selection.to - selection.from;
  const caret = selection.from + lineBreak.length;
  const nextBlock = {
    from: activeBlock.from,
    to: activeBlock.to - removedLength + lineBreak.length,
  };
  view.dispatch({
    changes: {
      from: selection.from,
      to: selection.to,
      insert: lineBreak,
    },
    selection: { anchor: caret, head: caret },
    effects: [
      clearStructuralBlockSelection.of(null),
      setActiveEditingBlockRange.of(nextBlock),
    ],
    annotations: [
      Transaction.addToHistory.of(true),
      Transaction.userEvent.of("input.block.lineBreak"),
    ],
  });
  view.focus();
  return true;
}

function editActiveListItem(
  view: EditorView,
  operation:
    | "insert"
    | "soft-break"
    | "nest"
    | "outdent"
    | "move-up"
    | "move-down"
    | "delete-empty",
) {
  const selection = view.state.selection.main;
  if (!selection.empty) return false;
  const range = resolveMarkdownBlockRange(
    view.state.doc.toString(),
    selection.head,
  );
  if (range.kind !== "list") return false;
  const source = view.state.doc.sliceString(range.from, range.to);
  const position = selection.head - range.from;
  const plan = operation === "insert"
    ? planMarkdownListItemInsertion(source, position)
    : operation === "soft-break"
      ? planMarkdownListItemSoftBreak(source, position)
      : operation === "nest" || operation === "outdent"
        ? planMarkdownListIndentation(
            source,
            position,
            operation === "nest" ? "in" : "out",
          )
        : operation === "move-up" || operation === "move-down"
          ? planMarkdownListItemMove(
              source,
              position,
              operation === "move-up" ? "up" : "down",
            )
          : planMarkdownEmptyListItemDeletion(source, position);
  return applyMarkdownListEdit(view, range, plan);
}

function moveWithinOrAcrossListBlock(
  view: EditorView,
  direction: "up" | "down",
) {
  const selection = view.state.selection.main;
  if (!selection.empty) return false;

  const source = view.state.doc.toString();
  const range = resolveMarkdownBlockRange(source, selection.head);
  if (range.kind !== "list") return false;

  const currentLine = view.state.doc.lineAt(selection.head);
  const boundaryLine = direction === "up"
    ? view.state.doc.lineAt(range.from)
    : view.state.doc.lineAt(Math.max(range.from, range.to - 1));
  const atBoundary = currentLine.number === boundaryLine.number;

  if (!atBoundary) {
    const target = view.moveVertically(selection, direction === "down");
    const targetLine = view.state.doc.lineAt(target.head);
    const expectedLineNumber = currentLine.number + (direction === "up" ? -1 : 1);
    const skippedAnItem = target.head < range.from ||
      target.head > range.to ||
      (targetLine.number !== currentLine.number &&
        targetLine.number !== expectedLineNumber);
    if (skippedAnItem) {
      const expectedLine = view.state.doc.line(expectedLineNumber);
      const column = selection.head - currentLine.from;
      const position = expectedLine.from + Math.min(column, expectedLine.length);
      view.dispatch({
        selection: { anchor: position, head: position },
        annotations: Transaction.userEvent.of("select.list.item"),
      });
    } else {
      view.dispatch({
        selection: target,
        annotations: Transaction.userEvent.of("select.list.item"),
      });
    }
    view.focus();
    return true;
  }

  const adjacent = resolveAdjacentMarkdownBlockRange(
    source,
    range.from,
    direction === "up" ? -1 : 1,
  );
  if (!adjacent) return false;

  let target = view.moveVertically(selection, direction === "down");
  for (let step = 0; step < view.state.doc.lines; step += 1) {
    const targetBlock = resolveMarkdownBlockRange(source, target.head);
    if (targetBlock.kind !== "blank") break;
    const next = view.moveVertically(target, direction === "down");
    if (next.head === target.head) break;
    target = next;
  }

  if (target.head < adjacent.from || target.head > adjacent.to) {
    const targetLine = direction === "up"
      ? view.state.doc.lineAt(Math.max(adjacent.from, adjacent.to - 1))
      : view.state.doc.lineAt(adjacent.from);
    const column = selection.head - currentLine.from;
    const position = targetLine.from + Math.min(column, targetLine.length);
    view.dispatch({
      selection: { anchor: position, head: position },
      annotations: Transaction.userEvent.of("select.list.boundary"),
    });
    view.focus();
    return true;
  }

  view.dispatch({
    selection: target,
    annotations: Transaction.userEvent.of("select.list.boundary"),
  });
  view.focus();
  return true;
}

function focusAdjacentRichTable(
  view: EditorView,
  direction: "up" | "down",
) {
  const selection = view.state.selection.main;
  if (!selection.empty) return false;
  const source = view.state.doc.toString();
  const current = resolveMarkdownBlockRange(source, selection.head);
  if (current.kind === "table") return false;
  const currentLine = view.state.doc.lineAt(selection.head);
  const boundaryLine = direction === "up"
    ? view.state.doc.lineAt(current.from)
    : view.state.doc.lineAt(Math.max(current.from, current.to - 1));
  if (currentLine.number !== boundaryLine.number) return false;

  const verticalTarget = view.moveVertically(
    selection,
    direction === "down",
  );
  if (
    verticalTarget.head >= current.from &&
    verticalTarget.head <= current.to
  ) {
    return false;
  }

  const adjacent = resolveAdjacentMarkdownBlockRange(
    source,
    current.from,
    direction === "up" ? -1 : 1,
  );
  if (adjacent?.kind !== "table") return false;

  view.dispatch({
    effects: [
      EditorView.scrollIntoView(adjacent.from, { y: "nearest" }),
      EditorView.announce.of(
        direction === "down"
          ? "جدول از سلول بالای سمت راست فعال شد"
          : "جدول از سلول پایین سمت راست فعال شد",
      ),
    ],
    annotations: Transaction.userEvent.of("select.table.enter.vertical"),
  });
  requestAnimationFrame(() => {
    const table = view.dom.querySelector<HTMLElement>(
      `.cm-rich-table[data-table-from="${adjacent.from}"]`,
    );
    const candidates = table
      ? [...table.querySelectorAll<HTMLTextAreaElement>(
          'textarea[data-table-column="0"]',
        )]
      : [];
    const target = direction === "down" ? candidates[0] : candidates.at(-1);
    if (!target) return;
    target.focus({ preventScroll: true });
    const caret = direction === "down" ? 0 : target.value.length;
    target.setSelectionRange(caret, caret);
    const cellEditor = target.closest<HTMLElement>(
      ".cm-rich-table-cell-editor",
    );
    if (cellEditor) cellEditor.dataset.editing = "false";
  });
  return true;
}

function selectActiveBlockContents(view: EditorView) {
  const selection = view.state.selection.main;
  const range = activeEditingBlockRange(view.state, true) ??
    resolveMarkdownBlockRange(view.state.doc.toString(), selection.head);
  view.dispatch({
    selection: { anchor: range.from, head: range.to },
    effects: [
      clearStructuralBlockSelection.of(null),
      setActiveEditingBlockRange.of({ from: range.from, to: range.to }),
      EditorView.announce.of("محتوای بلاک فعال انتخاب شد."),
    ],
    annotations: Transaction.userEvent.of("select.block.contents"),
  });
  view.focus();
  return true;
}

function preserveIndependentBlockBoundary(
  view: EditorView,
  direction: "backward" | "forward",
) {
  const selection = view.state.selection.main;
  if (!selection.empty) return false;
  const source = view.state.doc.toString();
  const range = movableEditorBlockAt(view.state, selection.head);
  const atBoundary = direction === "backward"
    ? selection.head === range.from && range.from > 0
    : selection.head === range.to && range.to < source.length;
  if (!atBoundary) return false;
  const adjacent = resolveAdjacentMarkdownBlockRange(
    source,
    range.from,
    direction === "backward" ? -1 : 1,
  );
  if (!adjacent) return false;
  view.dispatch({
    effects: EditorView.announce.of(
      "مرز دو بلاک مستقل فقط با فرمان ساختاری تغییر می‌کند.",
    ),
    annotations: Transaction.userEvent.of("delete.block.boundary"),
  });
  return true;
}

function syntaxContextAt(state: EditorState, position: number) {
  const names = new Set<string>();
  let node = syntaxTree(state).resolveInner(Math.min(position, state.doc.length), -1);
  let fencedFrom: number | null = null;
  for (;;) {
    names.add(node.name);
    if (node.name === "FencedCode" || node.name === "CodeBlock") {
      fencedFrom = node.from;
    }
    if (!node.parent) break;
    node = node.parent;
  }
  return { names, fencedFrom };
}

export function editorFormattingContext(state: EditorState): EditorFormattingContext {
  const selection = state.selection.main;
  const { names, fencedFrom } = syntaxContextAt(state, selection.head);
  const line = state.doc.lineAt(selection.head);
  const structuralBlock = resolveMarkdownBlockRange(
    state.doc.toString(),
    selection.head,
  );
  const source = line.text;
  const heading = /^\s*(#{1,6})\s/u.exec(source);
  let looksLikeTable = false;
  if (source.includes("|")) {
    for (let number = line.number; number >= 1; number -= 1) {
      const candidate = state.doc.line(number).text;
      if (!candidate.includes("|")) break;
      if (/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/u.test(candidate)) {
        looksLikeTable = true;
        break;
      }
    }
  }
  let block: EditorFormattingContext["block"] = "paragraph";
  if (names.has("FencedCode") || names.has("CodeBlock")) {
    const openingLine = state.doc.lineAt(fencedFrom ?? line.from).text;
    block = /^\s*`{3,}\s*mermaid\b/iu.test(openingLine) ? "mermaid" : "code-block";
  } else if (structuralBlock?.kind === "formula") block = "formula";
  else if (structuralBlock?.kind === "divider") block = "divider";
  else if (names.has("Table") || looksLikeTable) block = "table";
  else if (names.has("Image")) block = "image";
  else if (/^\s*>\s*\[!(?:NOTE|TIP|IMPORTANT|WARNING)\]/iu.test(source)) block = "callout";
  else if (names.has("Blockquote")) block = "quote";
  else if (/^\s*(?:[-+*]|\d+[.)])\s+\[[ xX]\]/u.test(source)) block = "task";
  else if (/^\s*\d+[.)]\s/u.test(source)) block = "ordered-list";
  else if (/^\s*[-+*]\s/u.test(source)) block = "bullet-list";
  else if (heading) block = "heading";
  return {
    bold: names.has("StrongEmphasis"),
    italic: names.has("Emphasis"),
    code: names.has("InlineCode"),
    link: names.has("Link"),
    block,
    headingLevel: heading?.[1].length ?? null,
  };
}

class BlockMenuMarker extends GutterMarker {
  constructor(private readonly onOpen: (lineFrom: number, trigger: HTMLElement) => void) {
    super();
  }

  toDOM(view: EditorView) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cm-block-menu-trigger";
    button.textContent = "ساختار این خط";
    button.title = "ساختار این خط";
    button.setAttribute("aria-label", "بازکردن منوی ساختار خط فعال");
    button.setAttribute("aria-haspopup", "menu");
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.onOpen(view.state.doc.lineAt(view.state.selection.main.head).from, button);
    });
    return button;
  }
}

const markdownHighlightStyle = HighlightStyle.define([
  {
    tag: [tags.heading1, tags.heading2, tags.heading3, tags.heading4],
    color: "var(--proof-blue-dark)",
    fontWeight: "700",
  },
  {
    tag: [tags.strong],
    color: "var(--ink-950)",
    fontWeight: "700",
  },
  { tag: [tags.emphasis], fontStyle: "italic" },
  {
    tag: [tags.link, tags.url],
    color: "var(--proof-blue-dark)",
    textDecoration: "underline",
  },
  {
    tag: [tags.monospace],
    color: "var(--proof-blue-dark)",
    fontFamily: '"Vazir Code", "Cascadia Code", Consolas, monospace',
  },
  { tag: [tags.quote], color: "var(--ink-700)" },
  {
    tag: [tags.processingInstruction, tags.meta],
    color: "var(--proof-blue)",
  },
  { tag: [tags.punctuation, tags.contentSeparator], color: "var(--ink-500)" },
]);

const persianEditorPhrases = EditorState.phrases.of({
  Find: "جست‌وجو",
  Replace: "جایگزین",
  next: "بعدی",
  previous: "قبلی",
  all: "همه",
  "match case": "تطبیق حروف",
  regexp: "عبارت منظم",
  "by word": "تمام‌واژه",
  replace: "جایگزین",
  "replace all": "جایگزینی همه",
  close: "بستن",
  "current match": "نتیجهٔ فعلی",
  "on line": "در خط",
  "replaced match on line $": "نتیجه در خط $ جایگزین شد",
  "replaced $ matches": "$ نتیجه جایگزین شد",
  "Go to line": "رفتن به خط",
  go: "رفتن",
});

type SearchOption = "caseSensitive" | "regexp" | "wholeWord";

const editorCommandPlatformFacet = Facet.define<CommandPlatform, CommandPlatform>({
  combine: (values) => values[0] ?? "windows",
});

function searchMatchersEqual(left: SearchQuery, right: SearchQuery) {
  return (
    left.search === right.search &&
    left.caseSensitive === right.caseSensitive &&
    left.literal === right.literal &&
    left.regexp === right.regexp &&
    left.wholeWord === right.wholeWord
  );
}

let searchFieldSequence = 0;

function createSearchIcon(
  symbol: "chevron_left" | "close" | "search",
  className = "",
) {
  const namespace = "http://www.w3.org/2000/svg";
  const vector = MATERIAL_SYMBOL_PATHS[symbol];
  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", vector.viewBox);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.classList.add("raavi-find-icon");
  if (className) svg.classList.add(className);
  for (const pathData of vector.outline) {
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("d", pathData);
    path.setAttribute("fill", "currentColor");
    svg.append(path);
  }
  return svg;
}

function createFindButton(
  className: string,
  label: string,
  content: string | SVGSVGElement,
  onClick: () => void,
) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.append(content);
  button.addEventListener("click", (event) => {
    event.preventDefault();
    onClick();
  });
  return button;
}

function formatPersianInteger(value: number) {
  return value.toLocaleString("fa-IR", { useGrouping: false });
}

class RaaviFindPanel implements Panel {
  readonly dom: HTMLElement;
  readonly top = true;

  private readonly view: EditorView;
  private readonly input: HTMLInputElement;
  private readonly clearButton: HTMLButtonElement;
  private readonly count: HTMLOutputElement;
  private readonly optionButtons: Record<SearchOption, HTMLButtonElement>;
  private readonly replaceRow: HTMLDivElement;
  private readonly replaceInput: HTMLInputElement;
  private readonly replaceButton: HTMLButtonElement;
  private readonly replaceAllButton: HTMLButtonElement;
  private query: SearchQuery;
  private matchCache: {
    doc: EditorState["doc"];
    query: SearchQuery;
    matches: Array<{ from: number; to: number }>;
  } | null = null;

  constructor(view: EditorView) {
    this.view = view;
    this.query = getSearchQuery(view.state);

    const row = document.createElement("div");
    row.className = "raavi-find-row";

    const closeButton = createFindButton(
      "raavi-find-control raavi-find-close",
      "بستن جست‌وجو",
      createSearchIcon("close"),
      () => closeSearchPanel(this.view),
    );
    closeButton.setAttribute("aria-keyshortcuts", "Escape");

    const regexpButton = this.createOptionButton(
      "regexp",
      ".*",
      "عبارت منظم",
    );
    const wordButton = this.createOptionButton(
      "wholeWord",
      "کلمه",
      "تطبیق تمام واژه",
    );
    const caseButton = this.createOptionButton(
      "caseSensitive",
      "Aa",
      "حساس به بزرگی و کوچکی حروف",
    );
    this.optionButtons = {
      caseSensitive: caseButton,
      regexp: regexpButton,
      wholeWord: wordButton,
    };

    this.count = document.createElement("output");
    this.count.className = "raavi-find-count";
    this.count.setAttribute("aria-live", "polite");
    this.count.setAttribute("aria-atomic", "true");
    this.count.setAttribute("aria-label", "موقعیت نتیجهٔ جست‌وجو");

    const previousButton = createFindButton(
      "raavi-find-control raavi-find-nav raavi-find-previous",
      "نتیجهٔ قبلی",
      createSearchIcon("chevron_left", "is-previous"),
      () => {
        findPrevious(this.view);
        this.renderResultCount();
      },
    );
    previousButton.setAttribute("aria-keyshortcuts", "Shift+F3");
    const nextButton = createFindButton(
      "raavi-find-control raavi-find-nav raavi-find-next",
      "نتیجهٔ بعدی",
      createSearchIcon("chevron_left"),
      () => {
        findNext(this.view);
        this.renderResultCount();
      },
    );
    nextButton.setAttribute("aria-keyshortcuts", "F3");

    const field = document.createElement("div");
    field.className = "raavi-search-field";
    const inputId = `raavi-find-query-${++searchFieldSequence}`;
    const label = document.createElement("label");
    label.className = "raavi-search-label";
    label.htmlFor = inputId;
    label.textContent = "جست‌وجو در سند";

    const control = document.createElement("div");
    control.className = "raavi-search-control";
    this.clearButton = createFindButton(
      "raavi-search-clear",
      "پاک‌کردن عبارت جست‌وجو",
      createSearchIcon("close"),
      () => {
        this.input.value = "";
        this.commitSearch();
        this.input.focus();
      },
    );
    this.input = document.createElement("input");
    this.input.id = inputId;
    this.input.className = "raavi-search-input";
    this.input.type = "search";
    this.input.name = "search";
    this.input.autocomplete = "off";
    this.input.spellcheck = false;
    this.input.value = this.query.search;
    this.input.placeholder = "عبارت جست‌وجو";
    this.input.setAttribute("aria-label", "جست‌وجو در سند");
    this.input.setAttribute("main-field", "true");
    this.input.setAttribute("aria-keyshortcuts", "Enter Shift+Enter F3 Shift+F3 Escape");
    this.input.addEventListener("input", (event) => {
      if (!(event as InputEvent).isComposing) this.commitSearch();
    });
    this.input.addEventListener("compositionend", () => this.commitSearch());

    const searchIcon = createSearchIcon("search");
    searchIcon.classList.add("raavi-search-leading-icon");
    control.append(this.clearButton, this.input, searchIcon);
    const helper = document.createElement("span");
    helper.className = "raavi-search-helper";
    helper.setAttribute("aria-hidden", "true");
    field.append(label, control, helper);

    row.append(
      closeButton,
      regexpButton,
      wordButton,
      caseButton,
      this.count,
      previousButton,
      nextButton,
      field,
    );

    this.replaceRow = document.createElement("div");
    this.replaceRow.className = "raavi-replace-row";
    this.replaceRow.hidden = true;

    this.replaceAllButton = createFindButton(
      "raavi-replace-action raavi-replace-all",
      "جایگزینی همهٔ نتیجه‌ها",
      "جایگزینی همه",
      () => {
        replaceAll(this.view);
        this.renderResultCount();
      },
    );
    this.replaceAllButton.setAttribute("aria-keyshortcuts", "Alt+Enter");
    this.replaceButton = createFindButton(
      "raavi-replace-action raavi-replace-current",
      "جایگزینی نتیجهٔ فعلی",
      "جایگزینی",
      () => {
        replaceNext(this.view);
        this.renderResultCount();
      },
    );
    this.replaceButton.setAttribute("aria-keyshortcuts", "Enter");

    const replaceField = document.createElement("div");
    replaceField.className = "raavi-replace-field";
    const replaceInputId = `raavi-replace-value-${searchFieldSequence}`;
    const replaceLabel = document.createElement("label");
    replaceLabel.className = "raavi-replace-label";
    replaceLabel.htmlFor = replaceInputId;
    replaceLabel.textContent = "جایگزینی با";
    const replaceControl = document.createElement("div");
    replaceControl.className = "raavi-replace-control";
    this.replaceInput = document.createElement("input");
    this.replaceInput.id = replaceInputId;
    this.replaceInput.className = "raavi-replace-input";
    this.replaceInput.type = "text";
    this.replaceInput.name = "replace";
    this.replaceInput.autocomplete = "off";
    this.replaceInput.spellcheck = false;
    this.replaceInput.value = this.query.replace;
    this.replaceInput.placeholder = "متن جایگزین";
    this.replaceInput.setAttribute("aria-label", "جایگزینی با");
    this.replaceInput.setAttribute("aria-keyshortcuts", "Enter Alt+Enter Escape");
    this.replaceInput.addEventListener("input", (event) => {
      if (!(event as InputEvent).isComposing) this.commitReplacement();
    });
    this.replaceInput.addEventListener("compositionend", () =>
      this.commitReplacement(),
    );
    replaceControl.append(this.replaceInput);
    const replaceHelper = document.createElement("span");
    replaceHelper.className = "raavi-replace-helper";
    replaceHelper.setAttribute("aria-hidden", "true");
    replaceField.append(replaceLabel, replaceControl, replaceHelper);
    this.replaceRow.append(
      this.replaceAllButton,
      this.replaceButton,
      replaceField,
    );

    this.dom = document.createElement("div");
    this.dom.className = "cm-search raavi-find-panel";
    this.dom.setAttribute("role", "search");
    this.dom.setAttribute("aria-label", "جست‌وجو در سند");
    this.dom.addEventListener("keydown", (event) => this.handleKeyDown(event));
    this.dom.append(row, this.replaceRow);
    raaviFindPanels.set(view, this);
    this.syncQueryControls();
    this.renderResultCount();
    this.setReplaceMode(replaceModeRequests.has(view), false);
    replaceModeRequests.delete(view);
  }

  mount() {
    this.input.select();
  }

  update(update: ViewUpdate) {
    const nextQuery = getSearchQuery(update.state);
    if (!nextQuery.eq(this.query)) {
      this.query = nextQuery;
      this.input.value = nextQuery.search;
      this.replaceInput.value = nextQuery.replace;
      this.syncQueryControls();
    }
    if (update.docChanged || update.selectionSet || !nextQuery.eq(getSearchQuery(update.startState))) {
      this.renderResultCount();
    }
  }

  destroy() {
    raaviFindPanels.delete(this.view);
  }

  setReplaceMode(enabled: boolean, focusField = true) {
    this.replaceRow.hidden = !enabled;
    this.dom.classList.toggle("is-replace", enabled);
    this.dom.setAttribute(
      "aria-label",
      enabled ? "جست‌وجو و جایگزینی در سند" : "جست‌وجو در سند",
    );
    if (!focusField) return;
    queueMicrotask(() => {
      if (enabled && this.query.search.length > 0) {
        this.replaceInput.focus();
        this.replaceInput.select();
      } else {
        this.input.focus();
        this.input.select();
      }
    });
  }

  private createOptionButton(
    option: SearchOption,
    visibleLabel: string,
    accessibleLabel: string,
  ) {
    const button = createFindButton(
      `raavi-find-option raavi-find-option-${option}`,
      accessibleLabel,
      visibleLabel,
      () => this.toggleOption(option),
    );
    button.setAttribute("aria-pressed", "false");
    return button;
  }

  private commitSearch() {
    const nextQuery = this.makeQuery({ search: this.input.value });
    this.setQuery(nextQuery);
  }

  private commitReplacement() {
    this.setQuery(this.makeQuery({ replace: this.replaceInput.value }));
  }

  private handleKeyDown(event: KeyboardEvent) {
    if (event.isComposing) return;
    const platform = this.view.state.facet(editorCommandPlatformFacet);
    const primary = platform === "mac" ? event.metaKey : event.ctrlKey;
    if (primary && !event.altKey && event.code === "KeyF") {
      event.preventDefault();
      this.setReplaceMode(false);
      return;
    }
    if (
      (platform !== "mac" &&
        event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.code === "KeyH") ||
      (platform === "mac" &&
        event.metaKey &&
        !event.ctrlKey &&
        event.altKey &&
        event.code === "KeyF")
    ) {
      event.preventDefault();
      this.setReplaceMode(true);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeSearchPanel(this.view);
      return;
    }
    if (event.key === "F3") {
      event.preventDefault();
      (event.shiftKey ? findPrevious : findNext)(this.view);
      this.renderResultCount();
      return;
    }
    if (event.altKey && event.key === "Enter" && !this.replaceRow.hidden) {
      event.preventDefault();
      replaceAll(this.view);
      this.renderResultCount();
      return;
    }
    if (event.key === "Enter" && event.target === this.replaceInput) {
      event.preventDefault();
      replaceNext(this.view);
      this.renderResultCount();
      return;
    }
    if (event.key === "Enter" && event.target === this.input) {
      event.preventDefault();
      (event.shiftKey ? findPrevious : findNext)(this.view);
      this.renderResultCount();
    }
  }

  private makeQuery(overrides: Partial<{
    search: string;
    caseSensitive: boolean;
    regexp: boolean;
    wholeWord: boolean;
    replace: string;
  }>) {
    return new SearchQuery({
      search: overrides.search ?? this.query.search,
      caseSensitive: overrides.caseSensitive ?? this.query.caseSensitive,
      literal: this.query.literal,
      regexp: overrides.regexp ?? this.query.regexp,
      replace: overrides.replace ?? this.query.replace,
      wholeWord: overrides.wholeWord ?? this.query.wholeWord,
    });
  }

  private setQuery(nextQuery: SearchQuery) {
    if (nextQuery.eq(this.query)) return;
    const shouldSelectInitialMatch =
      nextQuery.search.length > 0 && nextQuery.search !== this.query.search;
    this.query = nextQuery;
    let initialMatch: { from: number; to: number } | null = null;
    if (shouldSelectInitialMatch && nextQuery.valid) {
      const selection = this.view.state.selection.main;
      let cursor = nextQuery.getCursor(this.view.state, selection.to);
      let first = cursor.next();
      if (first.done && selection.to > 0) {
        cursor = nextQuery.getCursor(this.view.state, 0, selection.from);
        first = cursor.next();
      }
      if (!first.done) initialMatch = first.value;
    }
    this.view.dispatch({
      effects: setSearchQuery.of(nextQuery),
      ...(initialMatch
        ? {
            selection: {
              anchor: initialMatch.from,
              head: initialMatch.to,
            },
            scrollIntoView: true,
          }
        : {}),
    });
    this.syncQueryControls();
  }

  private toggleOption(option: SearchOption) {
    const nextQuery = this.makeQuery({ [option]: !this.query[option] });
    this.setQuery(nextQuery);
    this.input.focus();
  }

  private syncQueryControls() {
    for (const option of Object.keys(this.optionButtons) as SearchOption[]) {
      const pressed = this.query[option];
      this.optionButtons[option].setAttribute("aria-pressed", String(pressed));
      this.optionButtons[option].classList.toggle("is-selected", pressed);
    }
    this.clearButton.disabled = this.query.search.length === 0;
    const replacementUnavailable =
      !this.query.valid || this.query.search.length === 0;
    this.replaceButton.disabled = replacementUnavailable;
    this.replaceAllButton.disabled = replacementUnavailable;
  }

  private renderResultCount() {
    if (!this.query.valid || this.query.search.length === 0) {
      this.count.value = "۰ از ۰";
      this.count.textContent = "۰ از ۰";
      this.replaceButton.disabled = true;
      this.replaceAllButton.disabled = true;
      return;
    }

    let matches: Array<{ from: number; to: number }>;
    if (
      this.matchCache &&
      this.matchCache.doc === this.view.state.doc &&
      searchMatchersEqual(this.matchCache.query, this.query)
    ) {
      matches = this.matchCache.matches;
    } else {
      matches = [];
      const cursor = this.query.getCursor(this.view.state);
      for (let next = cursor.next(); !next.done; next = cursor.next()) {
        matches.push(next.value);
      }
      this.matchCache = {
        doc: this.view.state.doc,
        query: this.query,
        matches,
      };
    }
    const selection = this.view.state.selection.main;
    const selectedIndex = matches.findIndex(
      (match) => match.from === selection.from && match.to === selection.to,
    );
    const nextIndex = matches.findIndex((match) => match.from >= selection.head);
    const currentIndex = selectedIndex >= 0
      ? selectedIndex
      : nextIndex >= 0
        ? nextIndex
        : 0;
    const visibleIndex = matches.length === 0 ? 0 : currentIndex + 1;
    const label = `${formatPersianInteger(visibleIndex)} از ${formatPersianInteger(matches.length)}`;
    this.count.value = label;
    this.count.textContent = label;
    const hasMatches = matches.length > 0;
    this.replaceButton.disabled = !hasMatches;
    this.replaceAllButton.disabled = !hasMatches;
  }
}

const raaviFindPanels = new WeakMap<EditorView, RaaviFindPanel>();
const replaceModeRequests = new WeakSet<EditorView>();

const persianEditorSetup = [
  lineNumbers(),
  highlightActiveLineGutter(),
  highlightSpecialChars(),
  history(),
  foldGutter(),
  dropCursor(),
  indentOnInput(),
  syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
  bracketMatching(),
  closeBrackets(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  search({
    top: true,
    createPanel: (view) => new RaaviFindPanel(view),
  }),
  keymap.of([
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...foldKeymap,
    ...lintKeymap,
  ]),
];

export const MarkdownCodeEditor = forwardRef<
  MarkdownCodeEditorHandle,
  MarkdownCodeEditorProps
>(function MarkdownCodeEditor(
  {
    ariaDescribedBy,
    className,
    commandPlatform,
    contextualHintsVisible = true,
    id,
    livePreviewEnabled = true,
    lineDirection = "auto",
    mode,
    writingBlockGutter = false,
    writingBlockMenuOpen = false,
    onBlockMenu,
    onChange,
    onContextChange,
    onLivePreviewFailure,
    onOpenMermaidStudio,
    onOpenFormulaStudio,
    onOpenAudioTranscription,
    onOpenAiForBlock,
    onScroll,
    onSelectionChange,
    resolveLiveImage,
    resolveLiveAudio,
    transformPastedText,
    value,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const writingGutterRef = useRef<HTMLDivElement>(null);
  const writingDropIndicatorRef = useRef<HTMLDivElement>(null);
  const writingGutterLineFromRef = useRef(0);
  const pointerEditorDragRef = useRef<PointerEditorDragState | null>(null);
  const suppressDragHandleClickRef = useRef(false);
  const imeCompositionActiveRef = useRef(false);
  const doubleClickAnchorRef = useRef<DoubleClickAnchor | null>(null);
  const multiClickLineRef = useRef<{
    from: number;
    to: number;
    clientX: number;
    clientY: number;
    scrollTop: number;
    capturedAt: number;
  } | null>(null);
  const pointerTextSelectionRef = useRef<{
    anchor: number;
    lineFrom: number;
    lineTo: number;
    startX: number;
    startY: number;
    scrollTop: number;
    dragging: boolean;
  } | null>(null);
  const singleClickCorrectionTimerRef = useRef<number | null>(null);
  const pendingSingleClickCorrectionRef = useRef<{
    anchor: number;
    lineFrom: number;
    lineTo: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const handledDoubleClickRef = useRef<{
    from: number;
    to: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialValueRef = useRef(value);
  const externalUpdateRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onBlockMenuRef = useRef(onBlockMenu);
  const onContextChangeRef = useRef(onContextChange);
  const onScrollRef = useRef(onScroll);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const transformPastedTextRef = useRef(transformPastedText);
  const writingBlockGutterEnabledRef = useRef(writingBlockGutter);
  const modeCompartmentRef = useRef(new Compartment());
  const contextualHintsCompartmentRef = useRef(new Compartment());
  const blockMenuGutterCompartmentRef = useRef(new Compartment());
  const initialModeRef = useRef(mode);
  const initialContextualHintsVisibleRef = useRef(contextualHintsVisible);
  const currentModeRef = useRef(mode);
  const initialLivePreviewEnabledRef = useRef(livePreviewEnabled);
  const initialLineDirectionRef = useRef(lineDirection);
  const onLivePreviewFailureRef = useRef(onLivePreviewFailure);
  const onOpenMermaidStudioRef = useRef(onOpenMermaidStudio);
  const onOpenFormulaStudioRef = useRef(onOpenFormulaStudio);
  const onOpenAudioTranscriptionRef = useRef(onOpenAudioTranscription);
  const onOpenAiForBlockRef = useRef(onOpenAiForBlock);
  const resolveLiveImageRef = useRef(resolveLiveImage);
  const resolveLiveAudioRef = useRef(resolveLiveAudio);
  const tableCellSelectionRef = useRef<
    (TableCellTextSelection & { element: HTMLTextAreaElement }) | null
  >(null);
  const activeTableCellRef = useRef<{
    blockFrom: number;
    element: HTMLTextAreaElement;
  } | null>(null);

  const readActiveTableCell = useCallback((target: EventTarget | null) => {
    if (!(target instanceof HTMLTextAreaElement)) return null;
    if (
      target.dataset.tableRow === undefined ||
      target.dataset.tableColumn === undefined
    ) {
      return null;
    }
    const shell = target.closest<HTMLElement>(
      ".cm-rich-table[data-table-from]",
    );
    const blockFrom = Number(shell?.dataset.tableFrom);
    if (!shell || !Number.isFinite(blockFrom)) return null;
    return { blockFrom, element: target };
  }, []);

  const readTableCellSelection = useCallback(
    (
      target: EventTarget | null,
      pointer?: { clientX: number; clientY: number },
    ) => {
      const activeCell = readActiveTableCell(target);
      if (!activeCell) return null;
      const editor = activeCell.element;
      const row = Number(editor.dataset.tableRow);
      const column = Number(editor.dataset.tableColumn);
      if (
        !Number.isInteger(row) ||
        !Number.isInteger(column)
      ) {
        return null;
      }
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      if (start === end) return null;
      const bounds = editor.getBoundingClientRect();
      return {
        key: `${activeCell.blockFrom}:${row}:${column}`,
        blockFrom: activeCell.blockFrom,
        row,
        column,
        value: editor.value,
        text: editor.value.slice(start, end),
        start,
        end,
        clientX: pointer?.clientX ?? bounds.left + bounds.width / 2,
        clientY: pointer?.clientY ?? bounds.top + bounds.height / 2,
        element: editor,
      };
    },
    [readActiveTableCell],
  );

  const syncTableCellSelection = useCallback(
    (
      target: EventTarget | null,
      pointer?: { clientX: number; clientY: number },
    ) => {
      const activeCell = readActiveTableCell(target);
      activeTableCellRef.current = activeCell;
      const host = hostRef.current;
      if (host) {
        if (activeCell) host.dataset.tableBlockActive = "true";
        else delete host.dataset.tableBlockActive;
      }
      tableCellSelectionRef.current = readTableCellSelection(target, pointer);
      onSelectionChangeRef.current(pointer);
    },
    [readActiveTableCell, readTableCellSelection],
  );

  const syncWritingBlockGutter = useCallback((view: EditorView) => {
    const gutterElement = writingGutterRef.current;
    const host = hostRef.current;
    if (!gutterElement || !host) return;

    const selectedBlock = structuralBlockSelection(view.state);
    const activeTableCell = activeTableCellRef.current?.element.isConnected
      ? activeTableCellRef.current
      : null;
    const activePosition =
      activeTableCell?.blockFrom ??
      selectedBlock?.from ??
      view.state.selection.main.head;
    const activeLine = view.state.doc.lineAt(activePosition);
    writingGutterLineFromRef.current = activeLine.from;
    gutterElement.dataset.lineFrom = String(activeLine.from);
    const blockSelected = Boolean(selectedBlock || activeTableCell);
    gutterElement.dataset.blockSelected = blockSelected ? "true" : "false";
    const dragHandle = gutterElement.querySelector<HTMLElement>(
      ".writing-block-drag-handle",
    );
    dragHandle?.setAttribute("aria-pressed", String(blockSelected));
    const listItemContext = blockSelected
      ? null
      : activeListItemContext(view, activePosition);
    gutterElement.dataset.dragScope = listItemContext ? "list-item" : "block";
    if (dragHandle) {
      dragHandle.title = listItemContext
        ? "برای جابجایی آیتم و زیرمجموعه‌هایش بکشید؛ کلیک، کل List Block را انتخاب می‌کند"
        : "برای جابجایی بلوک بکشید؛ با Alt+بالا/پایین نیز جابه‌جا می‌شود";
      dragHandle.setAttribute(
        "aria-label",
        listItemContext
          ? "جابجایی آیتم فعال و زیرمجموعه‌هایش؛ کلیک برای انتخاب کل بلاک"
          : "انتخاب و جابجایی بلوک فعال",
      );
    }
    view.requestMeasure({
      key: gutterElement,
      read: (measuredView) => {
        const hostBounds = host.getBoundingClientRect();
        const tableElement = activeTableCell?.element.closest<HTMLElement>(
          ".cm-rich-table[data-table-from]",
        );
        if (tableElement?.isConnected) {
          const tableBounds = tableElement.getBoundingClientRect();
          return tableBounds.top - hostBounds.top + 8;
        }
        const positionNode = measuredView.domAtPos(activeLine.from).node;
        const positionElement =
          positionNode instanceof Element
            ? positionNode
            : positionNode.parentElement;
        const lineElement = positionElement?.closest<HTMLElement>(".cm-line");
        if (!lineElement) return null;
        const lineBounds = lineElement.getBoundingClientRect();
        const emptyLineLift = activeLine.text.trim() ? 0 : 16;
        return lineBounds.top - hostBounds.top - emptyLineLift;
      },
      write: (top) => {
        if (top === null || writingGutterRef.current !== gutterElement) return;
        gutterElement.style.setProperty("--writing-gutter-top", `${Math.max(0, top)}px`);
      },
    });
  }, []);

  const cleanupPointerBlockDrag = useCallback((preserveClickSuppression = false) => {
    const drag = pointerEditorDragRef.current;
    pointerEditorDragRef.current = null;
    if (drag) {
      delete drag.handle.dataset.dragging;
      delete drag.handle.dataset.pointerId;
      if (drag.handle.hasPointerCapture(drag.pointerId)) {
        try {
          drag.handle.releasePointerCapture(drag.pointerId);
        } catch {
          // The browser may already have released capture during cancellation.
        }
      }
    }
    const host = hostRef.current;
    if (host) {
      delete host.dataset.blockDragging;
      delete host.dataset.listItemDragging;
    }
    const indicator = writingDropIndicatorRef.current;
    if (indicator) {
      indicator.hidden = true;
      delete indicator.dataset.placement;
      delete indicator.dataset.targetIndex;
      delete indicator.dataset.dragScope;
      indicator.style.removeProperty("--writing-drop-indicator-top");
    }
    if (!preserveClickSuppression) suppressDragHandleClickRef.current = false;
  }, []);

  const updatePointerDropTarget = useCallback(
    (view: EditorView, clientY: number) => {
      const drag = pointerEditorDragRef.current;
      const host = hostRef.current;
      const indicator = writingDropIndicatorRef.current;
      if (!drag?.dragging || !host || !indicator) return;
      const target = drag.kind === "list-item"
        ? pointerListItemDropTarget(view, clientY, drag)
        : pointerBlockDropTarget(view, clientY, drag.sourceBlockIndex);
      drag.targetIndex = target?.targetIndex ?? null;
      if (!target) {
        indicator.hidden = true;
        delete indicator.dataset.placement;
        delete indicator.dataset.targetIndex;
        return;
      }
      const hostBounds = host.getBoundingClientRect();
      indicator.dataset.placement = target.placement;
      indicator.dataset.targetIndex = String(target.targetIndex);
      indicator.dataset.dragScope = drag.kind;
      indicator.style.setProperty(
        "--writing-drop-indicator-top",
        `${target.boundaryY - hostBounds.top}px`,
      );
      indicator.hidden = false;
    },
    [],
  );

  useEffect(() => () => cleanupPointerBlockDrag(), [cleanupPointerBlockDrag]);

  onChangeRef.current = onChange;
  onBlockMenuRef.current = onBlockMenu;
  onContextChangeRef.current = onContextChange;
  onScrollRef.current = onScroll;
  onSelectionChangeRef.current = onSelectionChange;
  transformPastedTextRef.current = transformPastedText;
  writingBlockGutterEnabledRef.current = writingBlockGutter;
  currentModeRef.current = mode;
  onLivePreviewFailureRef.current = onLivePreviewFailure;
  onOpenMermaidStudioRef.current = onOpenMermaidStudio;
  onOpenFormulaStudioRef.current = onOpenFormulaStudio;
  onOpenAudioTranscriptionRef.current = onOpenAudioTranscription;
  onOpenAiForBlockRef.current = onOpenAiForBlock;
  resolveLiveImageRef.current = resolveLiveImage;
  resolveLiveAudioRef.current = resolveLiveAudio;

  const blockMenuGutter = useRef(
    gutter({
      class: "cm-block-menu-gutter",
      lineMarker(view, block) {
        const activeLine = view.state.doc.lineAt(view.state.selection.main.head);
        return block.from === activeLine.from
          ? new BlockMenuMarker((lineFrom, trigger) =>
              onBlockMenuRef.current?.(lineFrom, trigger),
            )
          : null;
      },
      lineMarkerChange: (update) => update.selectionSet || update.docChanged,
    }),
  );

  const livePreviewExtensionRef = useRef(
    createLivePreviewExtension({
      onFailure: (failure) => onLivePreviewFailureRef.current?.(failure),
      richWidgets: {
        openMermaidStudio: (from, to) =>
          onOpenMermaidStudioRef.current?.(from, to),
        openFormulaStudio: (from, to, opener) =>
          onOpenFormulaStudioRef.current?.(from, to, opener),
        resolveImage: (source) =>
          resolveLiveImageRef.current?.(source) ?? {
            status: "blocked",
            message: "منبع تصویر برای نمایش در ویرایشگر در دسترس نیست.",
          },
        resolveAudio: (source) =>
          resolveLiveAudioRef.current?.(source) ?? {
            status: "blocked",
            message: "فایل صوتی برای پخش در دسترس نیست.",
          },
        openAudioTranscription: (descriptor, from, to) =>
          onOpenAudioTranscriptionRef.current?.(descriptor, from, to),
      },
    }),
  );

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let keyboardNavigationPending = false;
    let keyboardRevealFrame: number | null = null;
    const scheduleKeyboardReadingBandReveal = (view: EditorView) => {
      if (keyboardRevealFrame !== null) {
        cancelAnimationFrame(keyboardRevealFrame);
      }
      keyboardRevealFrame = requestAnimationFrame(() => {
        keyboardRevealFrame = null;
        if (!view.dom.isConnected || !view.hasFocus) return;
        view.requestMeasure({
          read(measuredView) {
            const selection = measuredView.state.selection.main;
            const caret = measuredView.coordsAtPos(selection.head, 1);
            if (!caret) return 0;
            const viewport = measuredView.scrollDOM.getBoundingClientRect();
            const margin = keyboardReadingBandMargin(measuredView);
            const safeTop = viewport.top + margin;
            const safeBottom = viewport.bottom - margin;
            if (caret.top < safeTop) return caret.top - safeTop;
            if (caret.bottom > safeBottom) return caret.bottom - safeBottom;
            return 0;
          },
          write(delta, measuredView) {
            if (Math.abs(delta) < 1) return;
            measuredView.scrollDOM.scrollTop += delta;
          },
        });
      });
    };

    const runStructuralShortcut = (
      view: EditorView,
      action: "insertAfter" | "duplicate",
      position = structuralOperationPosition(view),
    ) => {
      const operations = structuralBlockOperations(view);
      const activeBlockId = operations.blockIdAt(position);
      const operation = action === "insertAfter"
        ? operations.insertAfter(activeBlockId)
        : operations.duplicate(activeBlockId);
      const applied = applyStructuralBlockOperation(view, operation);
      if (applied) syncWritingBlockGutter(view);
      return applied;
    };

    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        Prec.highest(
          keymap.of([
            {
              key: "Mod-a",
              run: (view) =>
                currentModeRef.current !== "source" &&
                selectActiveBlockContents(view),
            },
            {
              key: "Escape",
              run: (view) => {
                if (currentModeRef.current === "source") return false;
                const cleared = clearEditorBlockSelection(view);
                if (cleared) syncWritingBlockGutter(view);
                return cleared;
              },
            },
            {
              key: "Mod-Enter",
              run: (view) => {
                if (view.composing || imeCompositionActiveRef.current) {
                  return true;
                }
                return runStructuralShortcut(view, "insertAfter");
              },
            },
            {
              key: "Shift-Enter",
              run: (view) =>
                view.composing || imeCompositionActiveRef.current
                  ? false
                  : editActiveListItem(view, "soft-break"),
            },
            {
              key: "Enter",
              run: (view) => {
                if (view.composing || imeCompositionActiveRef.current) {
                  return false;
                }
                return editActiveListItem(view, "insert") ||
                  insertLineInsideActiveBlock(view);
              },
            },
            {
              key: "Tab",
              run: (view) => {
                if (view.composing || imeCompositionActiveRef.current) {
                  return true;
                }
                return editActiveListItem(view, "nest") || indentMore(view);
              },
            },
            {
              key: "Shift-Tab",
              run: (view) => {
                if (view.composing || imeCompositionActiveRef.current) {
                  return true;
                }
                return editActiveListItem(view, "outdent") || indentLess(view);
              },
            },
            {
              key: "Alt-ArrowUp",
              run: (view) => {
                if (view.composing || imeCompositionActiveRef.current) {
                  return true;
                }
                return editActiveListItem(view, "move-up");
              },
            },
            {
              key: "Alt-ArrowDown",
              run: (view) => {
                if (view.composing || imeCompositionActiveRef.current) {
                  return true;
                }
                return editActiveListItem(view, "move-down");
              },
            },
            {
              key: "ArrowUp",
              run: (view) =>
                view.composing || imeCompositionActiveRef.current
                  ? false
                  : currentModeRef.current === "source"
                    ? moveOneVisibleSourceLine(view, "up")
                  : focusAdjacentRichTable(view, "up") ||
                    moveWithinOrAcrossListBlock(view, "up") ||
                    moveOneVisibleSourceLine(view, "up"),
            },
            {
              key: "ArrowDown",
              run: (view) =>
                view.composing || imeCompositionActiveRef.current
                  ? false
                  : currentModeRef.current === "source"
                    ? moveOneVisibleSourceLine(view, "down")
                  : focusAdjacentRichTable(view, "down") ||
                    moveWithinOrAcrossListBlock(view, "down") ||
                    moveOneVisibleSourceLine(view, "down"),
            },
            {
              key: "Backspace",
              run: (view) => {
                if (view.composing || imeCompositionActiveRef.current) {
                  return false;
                }
                return editActiveListItem(view, "delete-empty") ||
                  preserveIndependentBlockBoundary(view, "backward");
              },
            },
            {
              key: "Delete",
              run: (view) => {
                if (view.composing || imeCompositionActiveRef.current) {
                  return false;
                }
                return editActiveListItem(view, "delete-empty") ||
                  preserveIndependentBlockBoundary(view, "forward");
              },
            },
          ]),
        ),
        persianEditorSetup,
        editorCommandPlatformFacet.of(commandPlatform),
        structuralBlockSelectionField,
        activeEditingBlockRangeExtension,
        blockMenuGutterCompartmentRef.current.of(
          initialModeRef.current === "live" ? blockMenuGutter.current : [],
        ),
        markdown({ base: markdownLanguage }),
        persianEditorPhrases,
        syntaxHighlighting(markdownHighlightStyle),
        viewportDirectionExtension,
        modeCompartmentRef.current.of(
          initialModeRef.current === "live" &&
            initialLivePreviewEnabledRef.current
            ? livePreviewExtensionRef.current
            : [],
        ),
        contextualHintsCompartmentRef.current.of(
          initialModeRef.current === "live" &&
            initialContextualHintsVisibleRef.current &&
            writingBlockGutterEnabledRef.current
            ? contextualShortcutHintsExtension(commandPlatform)
            : [],
        ),
        EditorView.perLineTextDirection.of(true),
        EditorView.lineWrapping,
        EditorView.scrollMargins.of((view) => {
          const safeMargin = keyboardReadingBandMargin(view);
          return { top: safeMargin, bottom: safeMargin };
        }),
        EditorView.contentAttributes.of({
          "aria-label": initialModeRef.current === "source"
            ? "کد Markdown"
            : "متن Markdown",
          ...(ariaDescribedBy
            ? { "aria-describedby": ariaDescribedBy }
            : {}),
          "data-editable-kind": "editor",
          dir: "auto",
          spellcheck: "true",
          "aria-keyshortcuts":
            initialModeRef.current === "source"
              ? "Tab Shift+Tab Control+Enter Meta+Enter Control+D Meta+D Control+A Meta+A Control+F Meta+F"
              : "Escape Tab Shift+Tab Shift+Enter Alt+ArrowUp Alt+ArrowDown Control+Enter Meta+Enter Control+D Meta+D Control+A Meta+A",
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !externalUpdateRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
          if (update.selectionSet) {
            tableCellSelectionRef.current = null;
            activeTableCellRef.current = null;
            if (hostRef.current) {
              delete hostRef.current.dataset.tableBlockActive;
            }
            // Pointer drags dispatch many intermediate selections. Publishing
            // each one mounts/unmounts the floating toolbar and re-renders the
            // page while the pointer is still down. Defer that work until the
            // gesture ends; keyboard and multi-click selections still publish
            // immediately.
            if (!pointerTextSelectionRef.current?.dragging) {
              onSelectionChangeRef.current();
            }
            if (keyboardNavigationPending) {
              scheduleKeyboardReadingBandReveal(update.view);
            }
          }
          const blockSelectionChanged = update.transactions.some(
            transactionChangesStructuralBlockSelection,
          );
          if (
            update.selectionSet ||
            update.docChanged ||
            update.viewportChanged ||
            blockSelectionChanged
          ) {
            onContextChangeRef.current?.(editorFormattingContext(update.state));
            syncWritingBlockGutter(update.view);
          }
        }),
        Prec.highest(EditorView.domEventHandlers({
          compositionstart: () => {
            imeCompositionActiveRef.current = true;
            return false;
          },
          compositionend: () => {
            imeCompositionActiveRef.current = false;
            return false;
          },
          mousedown: (event, view) => {
            if (
              event.button === 0 &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey &&
              !event.shiftKey &&
              structuralBlockSelection(view.state)
            ) {
              view.dispatch({ effects: clearStructuralBlockSelection.of(null) });
              syncWritingBlockGutter(view);
            }
            if (
              event.button !== 0 ||
              event.ctrlKey ||
              event.metaKey ||
              event.altKey ||
              event.shiftKey
            ) {
              doubleClickAnchorRef.current = null;
              handledDoubleClickRef.current = null;
              multiClickLineRef.current = null;
              return false;
            }

            const previousAnchor = doubleClickAnchorRef.current;
            const repeatedClick = Boolean(
              previousAnchor &&
              performance.now() - previousAnchor.capturedAt <= 800 &&
              Math.hypot(
                event.clientX - previousAnchor.clientX,
                event.clientY - previousAnchor.clientY,
              ) <= 6,
            );
            if (!repeatedClick) {
              const position = sourcePositionAtMouse(view, event);
              if (position === null) return false;
              const line = sourceLineRangeAtEventTarget(view, event);
              multiClickLineRef.current = line
                ? {
                    from: line.from,
                    to: line.to,
                    clientX: event.clientX,
                    clientY: event.clientY,
                    scrollTop: view.scrollDOM.scrollTop,
                    capturedAt: performance.now(),
                  }
                : null;
              const block = resolveMarkdownBlockRange(
                view.state.doc.toString(),
                position,
              );
              doubleClickAnchorRef.current = {
                position,
                blockFrom: block.from,
                blockTo: block.to,
                clientX: event.clientX,
                clientY: event.clientY,
                capturedAt: performance.now(),
              };
              handledDoubleClickRef.current = null;
              return false;
            }

            const anchor = previousAnchor;
            doubleClickAnchorRef.current = null;
            if (!anchor || performance.now() - anchor.capturedAt > 800) {
              return false;
            }

            const currentBlock = resolveMarkdownBlockRange(
              view.state.doc.toString(),
              anchor.position,
            );
            if (
              currentBlock.from !== anchor.blockFrom ||
              currentBlock.to !== anchor.blockTo
            ) {
              return false;
            }

            const word =
              mixedScriptWordRangeAt(
                view.state.doc.toString(),
                anchor.position,
                currentBlock.from,
                currentBlock.to,
              ) ??
              view.state.wordAt(anchor.position) ??
              (anchor.position > currentBlock.from
                ? view.state.wordAt(anchor.position - 1)
                : null);
            if (!word) return false;
            const from = Math.max(word.from, currentBlock.from);
            const to = Math.min(word.to, currentBlock.to);
            if (from >= to) return false;

            event.preventDefault();
            event.stopPropagation();
            handledDoubleClickRef.current = {
              from,
              to,
              clientX: anchor.clientX,
              clientY: anchor.clientY,
            };
            view.dispatch({
              selection: { anchor: from, head: to },
              annotations: Transaction.userEvent.of("select.pointer.word"),
            });
            const pinnedScrollTop = multiClickLineRef.current?.scrollTop;
            if (pinnedScrollTop !== undefined) {
              pinEditorScroll(view, pinnedScrollTop);
            }
            view.focus();
            syncWritingBlockGutter(view);
            onSelectionChangeRef.current({
              clientX: anchor.clientX,
              clientY: anchor.clientY,
            });
            return true;
          },
          dblclick: (event, view) => {
            const handledSelection = handledDoubleClickRef.current;
            if (!handledSelection) return false;
            handledDoubleClickRef.current = null;
            event.preventDefault();
            event.stopPropagation();
            requestAnimationFrame(() => {
              if (!view.dom.isConnected) return;
              view.dispatch({
                selection: {
                  anchor: handledSelection.from,
                  head: handledSelection.to,
                },
                annotations: Transaction.userEvent.of("select.pointer.word"),
              });
              const pinnedScrollTop = multiClickLineRef.current?.scrollTop;
              if (pinnedScrollTop !== undefined) {
                pinEditorScroll(view, pinnedScrollTop);
              }
              view.focus();
              syncWritingBlockGutter(view);
              onSelectionChangeRef.current({
                clientX: handledSelection.clientX,
                clientY: handledSelection.clientY,
              });
            });
            return true;
          },
          keydown: (event, view) => {
            if (singleClickCorrectionTimerRef.current !== null) {
              window.clearTimeout(singleClickCorrectionTimerRef.current);
              singleClickCorrectionTimerRef.current = null;
            }
            const pendingCorrection = pendingSingleClickCorrectionRef.current;
            pendingSingleClickCorrectionRef.current = null;
            if (pendingCorrection) {
              const head = view.state.selection.main.head;
              if (
                head < pendingCorrection.lineFrom ||
                head > pendingCorrection.lineTo
              ) {
                view.dispatch({
                  selection: { anchor: pendingCorrection.anchor },
                  annotations: Transaction.userEvent.of("select.pointer"),
                });
                syncWritingBlockGutter(view);
                onSelectionChangeRef.current({
                  clientX: pendingCorrection.clientX,
                  clientY: pendingCorrection.clientY,
                });
              }
            }
            if (
              !event.altKey &&
              !event.isComposing &&
              (["ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(event.key) ||
                ((event.ctrlKey || event.metaKey) &&
                  ["Home", "End"].includes(event.key)))
            ) {
              keyboardNavigationPending = true;
              queueMicrotask(() => {
                keyboardNavigationPending = false;
              });
            }
            if (
              (event.ctrlKey || event.metaKey) &&
              !event.altKey &&
              !event.shiftKey &&
              event.key.toLowerCase() === "d"
            ) {
              event.preventDefault();
              event.stopPropagation();
              if (
                event.isComposing ||
                view.composing ||
                imeCompositionActiveRef.current
              ) {
                return true;
              }
              runStructuralShortcut(view, "duplicate");
              return true;
            }
            if (
              writingBlockGutterEnabledRef.current &&
              event.altKey &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.shiftKey &&
              ["ArrowUp", "ArrowDown"].includes(event.key)
            ) {
              if (
                event.isComposing ||
                view.composing ||
                imeCompositionActiveRef.current
              ) {
                // Consume the editor shortcut so CodeMirror's lower-priority
                // Alt+Arrow line command cannot run during IME composition.
                return true;
              }
              event.preventDefault();
              event.stopPropagation();
              reorderEditorBlock(
                view,
                event.key === "ArrowUp" ? "up" : "down",
              );
              syncWritingBlockGutter(view);
              return true;
            }
            if (
              currentModeRef.current === "source" ||
              event.key !== "/" ||
              event.ctrlKey ||
              event.metaKey ||
              event.altKey ||
              event.isComposing
            ) {
              return false;
            }
            const selection = view.state.selection.main;
            if (!selection.empty) return false;
            const line = view.state.doc.lineAt(selection.head);
            const block = resolveMarkdownBlockRange(
              view.state.doc.toString(),
              selection.head,
            );
            const beforeCursor = line.text.slice(0, selection.head - line.from);
            const afterCursor = line.text.slice(selection.head - line.from);
            if (
              selection.head !== line.from ||
              line.text.length > 0 ||
              block?.kind !== "blank" ||
              beforeCursor ||
              afterCursor
            ) {
              return false;
            }

            const trigger =
              writingGutterRef.current?.querySelector<HTMLElement>(
                ".writing-block-type-trigger",
              ) ?? view.dom;
            if (trigger) {
              requestAnimationFrame(() => {
                onBlockMenuRef.current?.(line.from, trigger, "slash");
              });
            }
            // Keep the normal input transaction. The parent keeps this same
            // block menu open and ranks it as the slash query changes.
            return false;
          },
          keyup: () => {
            onSelectionChangeRef.current();
          },
          mouseup: (event) => {
            onSelectionChangeRef.current({
              clientX: event.clientX,
              clientY: event.clientY,
            });
          },
          pointerup: (event) => {
            if (event.pointerType !== "mouse") {
              onSelectionChangeRef.current({
                clientX: event.clientX,
                clientY: event.clientY,
              });
            }
          },
          paste: (event, view) => {
            const transformer = transformPastedTextRef.current;
            const pasted = event.clipboardData?.getData("text/plain");
            if (!transformer || !pasted) return false;

            const transformed = transformer(pasted);
            if (transformed === pasted) return false;

            event.preventDefault();
            view.dispatch(
              view.state.replaceSelection(transformed),
            );
            return true;
          },
        })),
      ],
    });
    const view = new EditorView({ parent: host, state });
    viewRef.current = view;
    view.dom.dataset.editorMode = initialModeRef.current;
    view.dom.dataset.lineDirection = initialLineDirectionRef.current;
    syncKeyboardReadingBandSpace(view);
    onContextChangeRef.current?.(editorFormattingContext(view.state));
    syncWritingBlockGutter(view);

    const readingBandResizeObserver = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(() => syncKeyboardReadingBandSpace(view));
    readingBandResizeObserver?.observe(view.scrollDOM);

    const handleScroll = () => {
      onScrollRef.current();
      syncWritingBlockGutter(view);
    };
    const handleTableCellSelect = (event: Event) => {
      syncTableCellSelection(event.target);
      syncWritingBlockGutter(view);
    };
    const handleTableCellKeyUp = (event: KeyboardEvent) => {
      if (!(event.target instanceof HTMLTextAreaElement)) return;
      syncTableCellSelection(event.target);
      syncWritingBlockGutter(view);
    };
    const handleTableCellPointerUp = (event: PointerEvent) => {
      if (!(event.target instanceof HTMLTextAreaElement)) return;
      queueMicrotask(() => {
        syncTableCellSelection(event.target, {
          clientX: event.clientX,
          clientY: event.clientY,
        });
        syncWritingBlockGutter(view);
      });
    };
    const handleEditorPointerDown = (event: PointerEvent) => {
      // A new pointer interaction supersedes the delayed correction from the
      // previous text click. This also covers gutter controls that prevent the
      // compatibility `mousedown` event from firing.
      if (singleClickCorrectionTimerRef.current !== null) {
        window.clearTimeout(singleClickCorrectionTimerRef.current);
        singleClickCorrectionTimerRef.current = null;
      }
      pendingSingleClickCorrectionRef.current = null;
      const current = tableCellSelectionRef.current;
      const activeCell = activeTableCellRef.current;
      if (
        (!current && !activeCell) ||
        event.target === current?.element ||
        event.target === activeCell?.element
      ) {
        return;
      }
      tableCellSelectionRef.current = null;
      activeTableCellRef.current = null;
      delete host.dataset.tableBlockActive;
      onSelectionChangeRef.current();
      syncWritingBlockGutter(view);
    };
    const handleEditorMultiClick = (event: MouseEvent) => {
      const target =
        event.target instanceof Element
          ? event.target
          : event.target instanceof Node
            ? event.target.parentElement
            : null;
      if (target?.closest(".cm-rich-table-cell-editor")) {
        multiClickLineRef.current = null;
        return;
      }
      if (
        event.detail !== 3 ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      ) {
        return;
      }
      const remembered = multiClickLineRef.current;
      const line =
        remembered &&
        performance.now() - remembered.capturedAt <= 900 &&
        Math.hypot(
          event.clientX - remembered.clientX,
          event.clientY - remembered.clientY,
        ) <= 8
          ? remembered
          : sourceLineRangeAtEventTarget(view, event);
      if (!line || line.from >= line.to) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      doubleClickAnchorRef.current = null;
      handledDoubleClickRef.current = null;
      multiClickLineRef.current = null;
      view.dispatch({
        selection: { anchor: line.from, head: line.to },
        annotations: Transaction.userEvent.of("select.pointer.block"),
      });
      if (remembered) pinEditorScroll(view, remembered.scrollTop);
      view.focus();
      syncWritingBlockGutter(view);
      onSelectionChangeRef.current({
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };
    const handleTextSelectionStart = (event: MouseEvent) => {
      if (singleClickCorrectionTimerRef.current !== null) {
        window.clearTimeout(singleClickCorrectionTimerRef.current);
        singleClickCorrectionTimerRef.current = null;
      }
      pendingSingleClickCorrectionRef.current = null;
      if (
        event.detail !== 1 ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      ) {
        pointerTextSelectionRef.current = null;
        return;
      }
      const target = event.target;
      const element =
        target instanceof Element
          ? target
          : target instanceof Node
            ? target.parentElement
            : null;
      if (
        !element?.closest(".cm-line") ||
        element.closest(
          "textarea,input,button,.cm-rich-block",
        )
      ) {
        pointerTextSelectionRef.current = null;
        return;
      }
      const clickedLine = sourceLineRangeAtEventTarget(view, event);
      const pointerPosition = sourcePositionAtMouse(view, event);
      const anchor = clickedLine
          ? pointerPosition !== null &&
          pointerPosition >= clickedLine.from &&
          pointerPosition < clickedLine.to
          ? pointerPosition
          : clickedLine.from
        : pointerPosition;
      pointerTextSelectionRef.current =
        anchor === null || !clickedLine
          ? null
          : {
              anchor,
              lineFrom: clickedLine.from,
              lineTo: clickedLine.to,
              startX: event.clientX,
              startY: event.clientY,
              scrollTop: view.scrollDOM.scrollTop,
              dragging: false,
            };
    };
    const handleTextSelectionMove = (event: MouseEvent) => {
      const gesture = pointerTextSelectionRef.current;
      if (!gesture || (event.buttons & 1) !== 1) return;
      if (
        !gesture.dragging &&
        Math.hypot(
          event.clientX - gesture.startX,
          event.clientY - gesture.startY,
        ) < 3
      ) {
        return;
      }
      const head = sourcePositionAtMouse(view, event);
      if (head === null) return;
      gesture.dragging = true;
      event.preventDefault();
      event.stopImmediatePropagation();
      view.dispatch({
        selection: { anchor: gesture.anchor, head },
        annotations: Transaction.userEvent.of("select.pointer"),
      });
      pinEditorScroll(view, gesture.scrollTop, 1);
      view.focus();
      syncWritingBlockGutter(view);
    };
    const handleTextSelectionEnd = (event: MouseEvent) => {
      const gesture = pointerTextSelectionRef.current;
      if (!gesture) return;
      if (!gesture.dragging) {
        pointerTextSelectionRef.current = null;
        const pendingCorrection = {
          anchor: gesture.anchor,
          lineFrom: gesture.lineFrom,
          lineTo: gesture.lineTo,
          clientX: event.clientX,
          clientY: event.clientY,
        };
        pendingSingleClickCorrectionRef.current = pendingCorrection;
        singleClickCorrectionTimerRef.current = window.setTimeout(() => {
          singleClickCorrectionTimerRef.current = null;
          if (pendingSingleClickCorrectionRef.current !== pendingCorrection) {
            return;
          }
          pendingSingleClickCorrectionRef.current = null;
          if (!view.dom.isConnected) return;
          const head = view.state.selection.main.head;
          if (head >= gesture.lineFrom && head <= gesture.lineTo) return;
          view.dispatch({
            selection: { anchor: gesture.anchor },
            annotations: Transaction.userEvent.of("select.pointer"),
          });
          view.focus();
          syncWritingBlockGutter(view);
          onSelectionChangeRef.current({
            clientX: event.clientX,
            clientY: event.clientY,
          });
        }, 180);
        return;
      }
      const head = sourcePositionAtMouse(view, event);
      if (head !== null) {
        view.dispatch({
          selection: { anchor: gesture.anchor, head },
          annotations: Transaction.userEvent.of("select.pointer"),
        });
      }
      pointerTextSelectionRef.current = null;
      pinEditorScroll(view, gesture.scrollTop);
      event.preventDefault();
      event.stopImmediatePropagation();
      view.focus();
      syncWritingBlockGutter(view);
      onSelectionChangeRef.current({
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };
    view.scrollDOM.addEventListener("scroll", handleScroll, { passive: true });
    host.addEventListener("mousedown", handleTextSelectionStart, true);
    host.addEventListener("mousedown", handleEditorMultiClick, true);
    window.addEventListener("mousemove", handleTextSelectionMove, true);
    window.addEventListener("mouseup", handleTextSelectionEnd, true);
    host.addEventListener("select", handleTableCellSelect, true);
    host.addEventListener("keyup", handleTableCellKeyUp, true);
    host.addEventListener("pointerup", handleTableCellPointerUp, true);
    host.addEventListener("pointerdown", handleEditorPointerDown, true);

    return () => {
      if (keyboardRevealFrame !== null) {
        cancelAnimationFrame(keyboardRevealFrame);
      }
      readingBandResizeObserver?.disconnect();
      view.scrollDOM.removeEventListener("scroll", handleScroll);
      host.removeEventListener("mousedown", handleTextSelectionStart, true);
      host.removeEventListener("mousedown", handleEditorMultiClick, true);
      window.removeEventListener("mousemove", handleTextSelectionMove, true);
      window.removeEventListener("mouseup", handleTextSelectionEnd, true);
      host.removeEventListener("select", handleTableCellSelect, true);
      host.removeEventListener("keyup", handleTableCellKeyUp, true);
      host.removeEventListener("pointerup", handleTableCellPointerUp, true);
      host.removeEventListener("pointerdown", handleEditorPointerDown, true);
      if (singleClickCorrectionTimerRef.current !== null) {
        window.clearTimeout(singleClickCorrectionTimerRef.current);
        singleClickCorrectionTimerRef.current = null;
      }
      pendingSingleClickCorrectionRef.current = null;
      tableCellSelectionRef.current = null;
      activeTableCellRef.current = null;
      delete host.dataset.tableBlockActive;
      view.destroy();
      viewRef.current = null;
    };
  }, [
    ariaDescribedBy,
    commandPlatform,
    syncTableCellSelection,
    syncWritingBlockGutter,
  ]);

  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dom.dataset.lineDirection = lineDirection;
  }, [lineDirection]);

  useLayoutEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const scrollTop = view.scrollDOM.scrollTop;
    view.dispatch({
      effects: [
        modeCompartmentRef.current.reconfigure(
          mode === "live" && livePreviewEnabled
            ? livePreviewExtensionRef.current
            : [],
        ),
        contextualHintsCompartmentRef.current.reconfigure(
          mode === "live" && contextualHintsVisible && writingBlockGutter
            ? contextualShortcutHintsExtension(commandPlatform)
            : [],
        ),
        blockMenuGutterCompartmentRef.current.reconfigure(
          mode === "live" ? blockMenuGutter.current : [],
        ),
        ...(mode === "source"
          ? [
              clearStructuralBlockSelection.of(null),
              setActiveEditingBlockRange.of(null),
            ]
          : []),
      ],
    });
    view.scrollDOM.scrollTop = scrollTop;
    view.requestMeasure({
      key: modeCompartmentRef.current,
      read: () => scrollTop,
      write: (preservedScrollTop, measuredView) => {
        if (viewRef.current === measuredView) {
          measuredView.scrollDOM.scrollTop = preservedScrollTop;
        }
      },
    });
    view.dom.dataset.editorMode = mode;
    view.contentDOM.setAttribute(
      "aria-label",
      mode === "source" ? "کد Markdown" : "متن Markdown",
    );
    view.contentDOM.setAttribute(
      "aria-keyshortcuts",
      mode === "source"
        ? "Tab Shift+Tab Control+Enter Meta+Enter Control+D Meta+D Control+A Meta+A Control+F Meta+F"
        : "Escape Tab Shift+Tab Shift+Enter Alt+ArrowUp Alt+ArrowDown Control+Enter Meta+Enter Control+D Meta+D Control+A Meta+A",
    );
    if (mode === "source") delete view.dom.dataset.livePreviewFallback;
    syncWritingBlockGutter(view);
  }, [
    commandPlatform,
    contextualHintsVisible,
    livePreviewEnabled,
    mode,
    syncWritingBlockGutter,
    writingBlockGutter,
  ]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentValue = view.state.doc.toString();
    if (currentValue === value) return;

    externalUpdateRef.current = true;
    view.dispatch({
      changes: { from: 0, to: currentValue.length, insert: value },
      effects: [
        clearStructuralBlockSelection.of(null),
        setActiveEditingBlockRange.of(null),
      ],
      annotations: Transaction.addToHistory.of(false),
    });
    externalUpdateRef.current = false;
  }, [value]);

  useImperativeHandle(
    ref,
    () => ({
      get element() {
        return hostRef.current;
      },
      get value() {
        return viewRef.current?.state.doc.toString() ?? value;
      },
      get selectionStart() {
        return viewRef.current?.state.selection.main.from ?? 0;
      },
      get selectionEnd() {
        return viewRef.current?.state.selection.main.to ?? 0;
      },
      get tableCellSelection() {
        const selection = tableCellSelectionRef.current;
        if (!selection?.element.isConnected) return null;
        return {
          key: selection.key,
          blockFrom: selection.blockFrom,
          row: selection.row,
          column: selection.column,
          value: selection.value,
          text: selection.text,
          start: selection.start,
          end: selection.end,
          clientX: selection.clientX,
          clientY: selection.clientY,
        };
      },
      get clientHeight() {
        return viewRef.current?.scrollDOM.clientHeight ?? 0;
      },
      get scrollHeight() {
        return viewRef.current?.scrollDOM.scrollHeight ?? 0;
      },
      get scrollTop() {
        return viewRef.current?.scrollDOM.scrollTop ?? 0;
      },
      set scrollTop(nextScrollTop: number) {
        if (viewRef.current) viewRef.current.scrollDOM.scrollTop = nextScrollTop;
      },
      contains(target) {
        return Boolean(target && hostRef.current?.contains(target));
      },
      captureSemanticAnchor() {
        const view = viewRef.current;
        if (!view || view.scrollDOM.clientHeight <= 0) return null;
        const bounds = view.scrollDOM.getBoundingClientRect();
        const probeY = bounds.top + Math.max(72, Math.min(bounds.height - 72, bounds.height * 0.42));
        const position = view.posAtCoords(
          { x: bounds.left + Math.max(1, bounds.width / 2), y: probeY },
          false,
        );
        const lineStart = view.state.doc.lineAt(position).from;
        const coordinates = view.coordsAtPos(lineStart, 1);
        const range = Math.max(0, view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight);
        return {
          sourceOffset: lineStart,
          viewportOffset: Math.round((coordinates?.top ?? probeY) - probeY),
          fallbackProgress: range > 0 ? Math.max(0, Math.min(1, view.scrollDOM.scrollTop / range)) : 0,
        };
      },
      focus() {
        viewRef.current?.focus();
      },
      findNext() {
        const view = viewRef.current;
        if (view) findNext(view);
      },
      findPrevious() {
        const view = viewRef.current;
        if (view) findPrevious(view);
      },
      getBoundingClientRect() {
        return (
          hostRef.current?.getBoundingClientRect() ?? new DOMRect()
        );
      },
      getBlockRange(position) {
        const view = viewRef.current;
        return view ? movableEditorBlockAt(view.state, position) : null;
      },
      getRangeClientRect(from, to) {
        const view = viewRef.current;
        if (!view) return null;
        const length = view.state.doc.length;
        const safeFrom = Math.max(0, Math.min(from, length));
        const safeTo = Math.max(safeFrom, Math.min(to, length));
        const start = view.coordsAtPos(safeFrom, 1);
        const end = view.coordsAtPos(safeTo, -1) ?? start;
        if (!start || !end) return null;
        const editorBounds = view.scrollDOM.getBoundingClientRect();
        const top = Math.max(editorBounds.top, Math.min(start.top, end.top));
        const bottom = Math.min(editorBounds.bottom, Math.max(start.bottom, end.bottom));
        if (bottom <= top) return null;
        return new DOMRect(
          editorBounds.left + 12,
          top,
          Math.max(40, editorBounds.width - 24),
          bottom - top,
        );
      },
      getSelectionAnchor() {
        const tableSelection = tableCellSelectionRef.current;
        if (tableSelection?.element.isConnected) {
          return {
            clientX: tableSelection.clientX,
            clientY: tableSelection.clientY,
          };
        }
        const view = viewRef.current;
        if (!view) return null;
        const selection = view.state.selection.main;
        const side = selection.head === selection.to ? -1 : 1;
        const rect = view.coordsAtPos(selection.head, side);
        if (!rect) return null;
        return {
          clientX: (rect.left + rect.right) / 2,
          clientY: (rect.top + rect.bottom) / 2,
        };
      },
      focusTableCellSelection() {
        const selection = tableCellSelectionRef.current;
        if (!selection?.element.isConnected) return false;
        selection.element.focus({ preventScroll: true });
        selection.element.setSelectionRange(selection.start, selection.end);
        return true;
      },
      openSearch() {
        const view = viewRef.current;
        if (!view) return;
        replaceModeRequests.delete(view);
        openSearchPanel(view);
        raaviFindPanels.get(view)?.setReplaceMode(false);
      },
      openReplace() {
        const view = viewRef.current;
        if (!view) return;
        replaceModeRequests.add(view);
        openSearchPanel(view);
        raaviFindPanels.get(view)?.setReplaceMode(true);
      },
      replaceRange({
        from,
        to,
        insert,
        selectionFrom,
        selectionTo,
        announcement,
      }) {
        const view = viewRef.current;
        if (!view) return;
        const length = view.state.doc.length;
        const safeFrom = Math.max(0, Math.min(from, length));
        const safeTo = Math.max(safeFrom, Math.min(to, length));
        const nextLength = length - (safeTo - safeFrom) + insert.length;
        const anchor = Math.max(
          0,
          Math.min(selectionFrom ?? safeFrom + insert.length, nextLength),
        );
        const head = Math.max(
          0,
          Math.min(selectionTo ?? anchor, nextLength),
        );
        view.dispatch({
          changes: { from: safeFrom, to: safeTo, insert },
          selection: { anchor, head },
          effects: announcement
            ? EditorView.announce.of(announcement)
            : undefined,
        });
        view.focus();
      },
      replaceTableCellRange({
        from,
        to,
        insert,
        selectionFrom,
        selectionTo,
        announcement,
      }) {
        const current = tableCellSelectionRef.current;
        const view = viewRef.current;
        if (!current?.element.isConnected) return false;
        const editor = current.element;
        const safeFrom = Math.max(0, Math.min(from, editor.value.length));
        const safeTo = Math.max(
          safeFrom,
          Math.min(to, editor.value.length),
        );
        editor.dataset.renderFormattedPreview = "true";
        editor.setRangeText(insert, safeFrom, safeTo, "preserve");
        const nextLength = editor.value.length;
        const nextStart = Math.max(
          0,
          Math.min(selectionFrom ?? safeFrom + insert.length, nextLength),
        );
        const nextEnd = Math.max(
          nextStart,
          Math.min(selectionTo ?? nextStart, nextLength),
        );
        editor.focus({ preventScroll: true });
        editor.setSelectionRange(nextStart, nextEnd);
        editor.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            data: insert,
            inputType: "insertText",
          }),
        );
        tableCellSelectionRef.current = readTableCellSelection(editor);
        activeTableCellRef.current = readActiveTableCell(editor);
        if (hostRef.current) {
          hostRef.current.dataset.tableBlockActive = "true";
        }
        if (announcement && view) {
          view.dispatch({ effects: EditorView.announce.of(announcement) });
        }
        onSelectionChangeRef.current();
        if (view) syncWritingBlockGutter(view);
        return true;
      },
      restoreSemanticAnchor(anchor) {
        const view = viewRef.current;
        if (!view) return;
        const position = Math.max(0, Math.min(anchor.sourceOffset, view.state.doc.length));
        view.dispatch({ effects: EditorView.scrollIntoView(position, { y: "center" }) });
        requestAnimationFrame(() => {
          const bounds = view.scrollDOM.getBoundingClientRect();
          const probeY = bounds.top + Math.max(72, Math.min(bounds.height - 72, bounds.height * 0.42));
          const coordinates = view.coordsAtPos(position, 1);
          if (!coordinates) return;
          view.scrollDOM.scrollTop += coordinates.top - (probeY + anchor.viewportOffset);
        });
      },
      redo() {
        const view = viewRef.current;
        if (view) redo(view);
      },
      selectAll() {
        const view = viewRef.current;
        if (!view) return;
        view.dispatch({ selection: { anchor: 0, head: view.state.doc.length } });
      },
      setSelectionRange(start, end, reveal = true) {
        const view = viewRef.current;
        if (!view) return;
        const length = view.state.doc.length;
        const anchor = Math.max(0, Math.min(start, length));
        const head = Math.max(anchor, Math.min(end, length));
        view.dispatch({
          selection: { anchor, head },
          effects: reveal
            ? EditorView.scrollIntoView(head, { y: "center" })
            : undefined,
        });
      },
      undo() {
        const view = viewRef.current;
        if (view) undo(view);
      },
    }),
    [readActiveTableCell, readTableCellSelection, syncWritingBlockGutter, value],
  );

  return (
    <div
      ref={hostRef}
      id={id}
      className={`markdown-code-editor ${writingBlockGutter ? "has-writing-block-gutter" : ""} ${className ?? ""}`.trim()}
    >
      {writingBlockGutter && (
        <>
          <div
            ref={writingDropIndicatorRef}
            className="writing-block-drop-indicator"
            aria-hidden="true"
            hidden
          />
          <div
            ref={writingGutterRef}
            className="writing-block-gutter"
            aria-label="کنترل‌های بلوک فعال"
          >
          <MagicWandTrigger
            className="writing-block-ai-trigger"
            iconSize={17}
            title="گفت‌وگو دربارهٔ این بلاک"
            aria-label="گفت‌وگو با راوی هوشمند دربارهٔ بلاک فعال"
            onPointerDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              const view = viewRef.current;
              if (!view) return;
              const range = movableEditorBlockAt(
                view.state,
                writingGutterLineFromRef.current,
              );
              if (!range) return;
              onOpenAiForBlockRef.current?.({
                ...range,
                content: view.state.doc.sliceString(range.from, range.to),
              });
            }}
          />
          <button
            className="writing-block-type-trigger"
            type="button"
            title="نوع بلوک"
            aria-label="بازکردن منوی ساختار خط فعال"
            aria-haspopup="menu"
            aria-expanded={writingBlockMenuOpen}
            onPointerDown={(event) => event.preventDefault()}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onBlockMenuRef.current?.(
                writingGutterLineFromRef.current,
                event.currentTarget,
                "gutter",
              );
            }}
          >
            <Notes size={18} aria-hidden="true" />
          </button>
          <button
            className="writing-block-drag-handle"
            type="button"
            title="برای جابجایی بلوک بکشید؛ با Alt+بالا/پایین نیز جابه‌جا می‌شود"
            aria-label="انتخاب و جابجایی بلوک فعال"
            aria-keyshortcuts="Enter Space Escape Alt+ArrowUp Alt+ArrowDown Control+D Meta+D"
            aria-pressed={false}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (suppressDragHandleClickRef.current) {
                suppressDragHandleClickRef.current = false;
                return;
              }
              const view = viewRef.current;
              if (!view) return;
              selectEditorBlock(view, writingGutterLineFromRef.current);
              syncWritingBlockGutter(view);
            }}
            onPointerDown={(event) => {
              if (
                event.button !== 0 ||
                !event.isPrimary ||
                pointerEditorDragRef.current
              ) {
                return;
              }
              const lineFrom = writingGutterLineFromRef.current;
              const view = viewRef.current;
              if (!view) return;
              const handle = event.currentTarget;
              const selectionPosition =
                activeTableCellRef.current?.blockFrom ??
                view.state.selection.main.head;
              const listItemContext = activeListItemContext(
                view,
                selectionPosition,
              );
              if (listItemContext) {
                pointerEditorDragRef.current = {
                  kind: "list-item",
                  pointerId: event.pointerId,
                  handle,
                  sourcePosition: selectionPosition,
                  sourceSiblingIndex: listItemContext.siblingIndex,
                  startX: event.clientX,
                  startY: event.clientY,
                  dragging: false,
                  targetIndex: null,
                };
              } else {
                const operations = structuralBlockOperations(view);
                pointerEditorDragRef.current = {
                  kind: "block",
                  pointerId: event.pointerId,
                  handle,
                  sourceBlockId: operations.blockIdAt(lineFrom),
                  sourceBlockIndex: operations.blockIndexAt(lineFrom),
                  sourceLineFrom: lineFrom,
                  startX: event.clientX,
                  startY: event.clientY,
                  dragging: false,
                  targetIndex: null,
                };
              }
              handle.dataset.pointerId = String(event.pointerId);
              handle.focus({ preventScroll: true });
              try {
                handle.setPointerCapture(event.pointerId);
              } catch {
                cleanupPointerBlockDrag();
                return;
              }
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerMove={(event) => {
              const drag = pointerEditorDragRef.current;
              const view = viewRef.current;
              if (!drag || drag.pointerId !== event.pointerId || !view) return;
              if (
                !drag.dragging &&
                Math.hypot(
                  event.clientX - drag.startX,
                  event.clientY - drag.startY,
                ) < 4
              ) {
                return;
              }
              if (!drag.dragging) {
                drag.dragging = true;
                drag.handle.dataset.dragging = "true";
                const host = hostRef.current;
                if (host) {
                  if (drag.kind === "list-item") {
                    host.dataset.listItemDragging = "true";
                  } else {
                    host.dataset.blockDragging = "true";
                  }
                }
                suppressDragHandleClickRef.current = true;
                if (drag.kind === "block") {
                  selectEditorBlock(view, drag.sourceLineFrom);
                } else {
                  view.dispatch({
                    effects: EditorView.announce.of(
                      "آیتم و زیرمجموعه‌هایش برای جابه‌جایی گرفته شدند.",
                    ),
                    annotations: Transaction.userEvent.of(
                      "select.list.item.drag",
                    ),
                  });
                }
              }
              event.preventDefault();
              event.stopPropagation();
              updatePointerDropTarget(view, event.clientY);
            }}
            onPointerUp={(event) => {
              const drag = pointerEditorDragRef.current;
              const view = viewRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              const shouldDrop = drag.dragging && drag.targetIndex !== null;
              const targetIndex = drag.targetIndex;
              if (drag.dragging) {
                event.preventDefault();
                event.stopPropagation();
              }
              cleanupPointerBlockDrag(drag.dragging);
              if (drag.dragging) {
                window.setTimeout(() => {
                  suppressDragHandleClickRef.current = false;
                }, 0);
              }
              if (!view || !shouldDrop || targetIndex === null) return;
              if (drag.kind === "list-item") {
                const context = activeListItemContext(
                  view,
                  drag.sourcePosition,
                );
                if (!context) return;
                applyMarkdownListEdit(
                  view,
                  context.range,
                  planMarkdownListItemMoveTo(
                    context.source,
                    context.localPosition,
                    targetIndex,
                  ),
                );
              } else {
                const operations = structuralBlockOperations(view);
                applyStructuralBlockOperation(
                  view,
                  operations.moveTo(drag.sourceBlockId, targetIndex),
                );
              }
              syncWritingBlockGutter(view);
            }}
            onPointerCancel={(event) => {
              const drag = pointerEditorDragRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              event.preventDefault();
              event.stopPropagation();
              cleanupPointerBlockDrag();
            }}
            onLostPointerCapture={(event) => {
              const drag = pointerEditorDragRef.current;
              if (drag?.pointerId === event.pointerId) cleanupPointerBlockDrag();
            }}
            onKeyDown={(event) => {
              const view = viewRef.current;
              if (!view) return;
              if (event.key === "Escape") {
                event.preventDefault();
                event.stopPropagation();
                const drag = pointerEditorDragRef.current;
                cleanupPointerBlockDrag();
                if (clearEditorBlockSelection(view)) {
                  syncWritingBlockGutter(view);
                } else if (
                  drag?.kind === "list-item" ||
                  writingGutterRef.current?.dataset.dragScope === "list-item"
                ) {
                  view.focus();
                }
                return;
              }
              const modifier = event.ctrlKey || event.metaKey;
              if (
                modifier &&
                !event.shiftKey &&
                !event.altKey &&
                event.key.toLowerCase() === "d"
              ) {
                event.preventDefault();
                event.stopPropagation();
                const operations = structuralBlockOperations(view);
                applyStructuralBlockOperation(
                  view,
                  operations.duplicate(
                    operations.blockIdAt(writingGutterLineFromRef.current),
                  ),
                );
                syncWritingBlockGutter(view);
                return;
              }
              if (!event.altKey || !["ArrowUp", "ArrowDown"].includes(event.key)) {
                return;
              }
              if (
                event.nativeEvent.isComposing ||
                view.composing ||
                imeCompositionActiveRef.current
              ) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              const direction = event.key === "ArrowUp" ? "up" : "down";
              const movedListItem =
                writingGutterRef.current?.dataset.dragScope === "list-item" &&
                editActiveListItem(
                  view,
                  direction === "up" ? "move-up" : "move-down",
                );
              if (!movedListItem) reorderEditorBlock(view, direction);
              syncWritingBlockGutter(view);
            }}
          >
            <GripVertical size={18} aria-hidden="true" />
          </button>
          </div>
        </>
      )}
    </div>
  );
});
