import { syntaxTree } from "@codemirror/language";
import {
  RangeSet,
  StateEffect,
  StateField,
  type EditorState,
  type Range,
  type Text,
} from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  type ViewUpdate,
  ViewPlugin,
} from "@codemirror/view";
import { detectBlockTextDirection } from "../markdown/text-direction";
import { findFormulaBlocks } from "../formula/blocks";
import {
  structuralBlockSelection,
  transactionChangesStructuralBlockSelection,
} from "./block-selection";
import {
  createLiveLinkPopoverExtension,
  HorizontalRuleWidget,
  RevealSourceWidget,
  StaticMarkerWidget,
  TaskMarkerWidget,
} from "./live-preview-widgets";
import {
  CodeBlockHeaderWidget,
  FootnoteWidget,
  ImageBlockWidget,
  AudioBlockWidget,
  FormulaBlockWidget,
  MermaidBlockWidget,
  type RichWidgetOptions,
  TableBlockWidget,
} from "./rich-block-widgets";
import { parseMarkdownAudio } from "../audio/markdown";
import {
  footnoteReferences,
  parseFence,
  parseGfmTable,
  parseMarkdownImage,
  resolveMarkdownBlockRange,
  resolveMarkdownBlockRanges,
} from "./rich-blocks";

export type LivePreviewFailure = {
  message: string;
  cause: unknown;
};

export type ScanRange = { from: number; to: number };

export const setActiveEditingBlockRange = StateEffect.define<ScanRange | null>();

const activeEditingBlockRangeField = StateField.define<ScanRange | null>({
  create: () => null,
  update(value, transaction) {
    let next = value
      ? {
          from: transaction.changes.mapPos(value.from, -1),
          to: transaction.changes.mapPos(value.to, 1),
        }
      : null;
    let explicitlySet = false;
    for (const effect of transaction.effects) {
      if (effect.is(setActiveEditingBlockRange)) {
        next = effect.value;
        explicitlySet = true;
      }
    }
    if (!explicitlySet && transaction.docChanged && value) {
      let replacesWholeDocument = false;
      transaction.changes.iterChanges((fromA, toA) => {
        if (
          fromA === 0 &&
          toA === transaction.startState.doc.length
        ) {
          replacesWholeDocument = true;
        }
      });
      // A wholesale replacement (paste/import/test automation) belongs to a
      // new document shape. Keeping the previous block range here exposes
      // only a stale fragment in Live Edit and makes block-scoped shortcuts
      // operate on the wrong content.
      if (replacesWholeDocument) next = null;
    }
    if (
      !explicitlySet &&
      transaction.docChanged &&
      value &&
      value.to > value.from &&
      next &&
      next.from === next.to
    ) {
      const previousContent = transaction.startState.doc.sliceString(
        value.from,
        value.to,
      );
      const nextSource = transaction.newDoc.toString();
      const head = transaction.state.selection.main.head;
      let nearest = -1;
      let nearestDistance = Number.POSITIVE_INFINITY;
      for (
        let match = nextSource.indexOf(previousContent);
        match >= 0;
        match = nextSource.indexOf(previousContent, match + 1)
      ) {
        const distance = head < match
          ? match - head
          : head > match + previousContent.length
            ? head - (match + previousContent.length)
            : 0;
        if (distance < nearestDistance) {
          nearest = match;
          nearestDistance = distance;
        }
      }
      next = nearest >= 0
        ? { from: nearest, to: nearest + previousContent.length }
        : null;
    }
    if (next && transaction.selection && !explicitlySet) {
      const head = transaction.state.selection.main.head;
      if (head < next.from || head > next.to) next = null;
    }
    return next;
  },
});

/** Install once in the editor core so block identity survives mode changes. */
export const activeEditingBlockRangeExtension = activeEditingBlockRangeField;

function transactionChangesActiveEditingBlockRange(transaction: {
  effects: readonly StateEffect<unknown>[];
}) {
  return transaction.effects.some((effect) =>
    effect.is(setActiveEditingBlockRange),
  );
}

let cachedActiveBlockDocument: Text | null = null;
let cachedActiveBlockPosition = -1;
let cachedActiveBlockRange: ScanRange | null = null;

/**
 * Live Edit is block-scoped. Enter may add any number of source lines inside
 * the current block, but only an explicit structural command may activate a
 * different block. Structural selection owns the range while it is present;
 * otherwise the complete Markdown block containing the caret is editable.
 */
export function activeEditingBlockRange(
  state: EditorState,
  editorFocused: boolean,
): ScanRange | null {
  const selectedBlock = structuralBlockSelection(state);
  if (selectedBlock) {
    return { from: selectedBlock.from, to: selectedBlock.to };
  }
  if (!editorFocused) return null;

  const retainedBlock = state.field(activeEditingBlockRangeField, false);
  if (retainedBlock) return retainedBlock;

  const selection = state.selection.main;
  // While the user extends a text selection, `head` moves across Markdown
  // blocks. Driving the active editing block from that moving endpoint makes
  // Live Preview repeatedly collapse one block and expand the next, changing
  // geometry underneath the pointer. The anchor is stable for the lifetime of
  // the gesture, so keep the originating block active until the selection is
  // collapsed again.
  const activePosition = selection.empty ? selection.head : selection.anchor;
  if (
    cachedActiveBlockDocument === state.doc &&
    cachedActiveBlockPosition === activePosition
  ) {
    return cachedActiveBlockRange;
  }
  const block = resolveMarkdownBlockRange(
    state.doc.toString(),
    activePosition,
  );
  cachedActiveBlockDocument = state.doc;
  cachedActiveBlockPosition = activePosition;
  cachedActiveBlockRange = { from: block.from, to: block.to };
  return cachedActiveBlockRange;
}

const INLINE_NODES = new Set([
  "StrongEmphasis",
  "Emphasis",
  "Strikethrough",
  "InlineCode",
  "Link",
]);

let cachedFootnoteDocument: Text | null = null;
let cachedFootnoteReferences: ReturnType<typeof footnoteReferences> = [];

function documentFootnoteReferences(state: EditorState) {
  if (cachedFootnoteDocument !== state.doc) {
    cachedFootnoteDocument = state.doc;
    cachedFootnoteReferences = footnoteReferences(state.doc.toString());
  }
  return cachedFootnoteReferences;
}

type SyntaxNodeShape = {
  name: string;
  from: number;
  to: number;
  parent: SyntaxNodeShape | null;
  firstChild: SyntaxNodeShape | null;
  nextSibling: SyntaxNodeShape | null;
};

function mergeRanges(ranges: ScanRange[]) {
  const sorted = [...ranges].sort((left, right) => left.from - right.from);
  const merged: ScanRange[] = [];
  for (const range of sorted) {
    const previous = merged.at(-1);
    if (previous && range.from <= previous.to) {
      previous.to = Math.max(previous.to, range.to);
    } else {
      merged.push({ ...range });
    }
  }
  return merged;
}

export function livePreviewScanRanges(view: EditorView): ScanRange[] {
  const ranges = view.visibleRanges.map((range) => {
    const firstLine = view.state.doc.lineAt(range.from);
    const lastLine = view.state.doc.lineAt(Math.max(range.from, range.to - 1));
    const fromLine = view.state.doc.line(Math.max(1, firstLine.number - 1));
    const toLine = view.state.doc.line(
      Math.min(view.state.doc.lines, lastLine.number + 1),
    );
    return { from: fromLine.from, to: toLine.to };
  });
  const activeBlock = activeEditingBlockRange(view.state, view.hasFocus);
  if (activeBlock) ranges.push(activeBlock);
  return mergeRanges(ranges);
}

function selectionTouchesRange(
  state: EditorState,
  node: { from: number; to: number },
  editorFocused: boolean,
) {
  const activeBlock = activeEditingBlockRange(state, editorFocused);
  if (!activeBlock) return false;
  if (activeBlock.from === activeBlock.to) {
    return node.from <= activeBlock.from && node.to >= activeBlock.to;
  }
  return node.from < activeBlock.to && node.to > activeBlock.from;
}

function selectionTouchesLine(
  state: EditorState,
  node: { from: number; to: number },
  editorFocused: boolean,
) {
  return selectionTouchesRange(state, node, editorFocused);
}

function inlineAncestor(node: SyntaxNodeShape | null) {
  for (let current = node; current; current = current.parent) {
    if (INLINE_NODES.has(current.name)) return current;
  }
  return null;
}

function linkParts(node: SyntaxNodeShape, state: EditorState) {
  const marks: SyntaxNodeShape[] = [];
  let url: SyntaxNodeShape | null = null;
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.name === "LinkMark") marks.push(child);
    else if (child.name === "URL") url = child;
  }
  if (marks.length < 4 || !url) return null;
  return {
    labelFrom: marks[0].to,
    labelTo: marks[1].from,
    suffixFrom: marks[1].from,
    urlFrom: url.from,
    urlTo: url.to,
    url: state.sliceDoc(url.from, url.to),
  };
}

function escapedAt(value: string, index: number) {
  let slashes = 0;
  for (let position = index - 1; position >= 0 && value[position] === "\\"; position -= 1) {
    slashes += 1;
  }
  return slashes % 2 === 1;
}

export function findHighlightRanges(
  text: string,
  offset = 0,
): Array<{ from: number; to: number; contentFrom: number; contentTo: number }> {
  const ranges: Array<{
    from: number;
    to: number;
    contentFrom: number;
    contentTo: number;
  }> = [];
  const expression = /==(?=\S)(.+?\S)==/gu;
  for (const match of text.matchAll(expression)) {
    const index = match.index ?? 0;
    if (escapedAt(text, index)) continue;
    const from = offset + index;
    const to = from + match[0].length;
    ranges.push({ from, to, contentFrom: from + 2, contentTo: to - 2 });
  }
  return ranges;
}

export function findUnderlineRanges(
  text: string,
  offset = 0,
): Array<{ from: number; to: number; contentFrom: number; contentTo: number }> {
  const ranges: Array<{
    from: number;
    to: number;
    contentFrom: number;
    contentTo: number;
  }> = [];
  const expression = /<u>(?=\S)(.+?\S)<\/u>/giu;
  for (const match of text.matchAll(expression)) {
    const index = match.index ?? 0;
    const from = offset + index;
    const to = from + match[0].length;
    ranges.push({ from, to, contentFrom: from + 3, contentTo: to - 4 });
  }
  return ranges;
}

function addLineDecoration(
  decorations: Range<Decoration>[],
  lineKeys: Set<string>,
  state: EditorState,
  position: number,
  className: string,
) {
  const line = state.doc.lineAt(position);
  const key = `${line.from}:${className}`;
  if (lineKeys.has(key)) return;
  lineKeys.add(key);
  decorations.push(Decoration.line({ class: className }).range(line.from));
}

export function pluginSafeDecorationRanges(
  state: EditorState,
  decorations: Range<Decoration>[],
) {
  return decorations.filter((range) => {
    const decoration = range.value as Decoration & { isReplace?: boolean };
    if (!decoration.isReplace || range.from === range.to) return true;
    // ViewPlugin decorations may not replace a line break. Multiline block
    // widgets are provided through the StateField-backed rich-block extension.
    return state.doc.lineAt(range.from).to >= range.to;
  });
}

export function buildLivePreviewDecorations(view: EditorView) {
  const ranges = livePreviewScanRanges(view);
  const decorations: Range<Decoration>[] = [];
  const lineKeys = new Set<string>();
  const tree = syntaxTree(view.state);
  let documentFootnotes: ReturnType<typeof footnoteReferences> | null = null;

  for (const block of resolveMarkdownBlockRanges(view.state.doc.toString())) {
    const isScanned = ranges.some(
      (range) => block.from <= range.to && block.to >= range.from,
    );
    if (!isScanned) continue;
    const firstLine = view.state.doc.lineAt(block.from).number;
    const lastLine = view.state.doc.lineAt(
      Math.max(block.from, Math.min(view.state.doc.length, block.to) - 1),
    ).number;
    if (block.kind === "blank") {
      addLineDecoration(
        decorations,
        lineKeys,
        view.state,
        view.state.doc.line(firstLine).from,
        "cm-live-block-gap",
      );
      continue;
    }
    for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber += 1) {
      const position = view.state.doc.line(lineNumber).from;
      addLineDecoration(
        decorations,
        lineKeys,
        view.state,
        position,
        `cm-live-block-line cm-live-block-${block.kind}`,
      );
      if (lineNumber === firstLine) {
        addLineDecoration(
          decorations,
          lineKeys,
          view.state,
          position,
          "cm-live-block-start",
        );
      }
      if (lineNumber === lastLine) {
        addLineDecoration(
          decorations,
          lineKeys,
          view.state,
          position,
          "cm-live-block-end",
        );
      }
    }
  }

  for (const range of ranges) {
    tree.iterate({
      from: range.from,
      to: range.to,
      enter(node) {
        if (node.name === "FencedCode") {
          const source = view.state.sliceDoc(node.from, node.to);
          const fence = parseFence(source);
          if (fence && !fence.mermaid) {
            const openingLine = view.state.doc.lineAt(node.from);
            const closingLine = view.state.doc.lineAt(
              Math.max(node.from, node.to - 1),
            );
            addLineDecoration(
              decorations,
              lineKeys,
              view.state,
              openingLine.from,
              "cm-live-code-fence cm-live-code-fence-start",
            );
            addLineDecoration(
              decorations,
              lineKeys,
              view.state,
              closingLine.from,
              "cm-live-code-fence cm-live-code-fence-end",
            );
            decorations.push(
              Decoration.replace({
                inclusive: false,
                widget: new CodeBlockHeaderWidget(
                  fence.language,
                  fence.code,
                ),
              }).range(
                openingLine.from,
                openingLine.to,
              ),
              Decoration.replace({ inclusive: false }).range(
                closingLine.from,
                closingLine.to,
              ),
            );
            for (
              let lineNumber = openingLine.number + 1;
              lineNumber < closingLine.number;
              lineNumber += 1
            ) {
              addLineDecoration(
                decorations,
                lineKeys,
                view.state,
                view.state.doc.line(lineNumber).from,
                "cm-c",
              );
            }
          }
          return false;
        }
        if (node.name === "Table") return false;
        const headingMatch = /^ATXHeading([1-6])$/u.exec(node.name);
        if (headingMatch) {
          addLineDecoration(
            decorations,
            lineKeys,
            view.state,
            node.from,
            `cm-live-heading cm-live-heading-${headingMatch[1]}`,
          );
        }

        if (node.name === "StrongEmphasis") {
          decorations.push(
            Decoration.mark({ class: "cm-live-strong" }).range(node.from, node.to),
          );
        } else if (node.name === "Emphasis") {
          decorations.push(
            Decoration.mark({ class: "cm-live-emphasis" }).range(node.from, node.to),
          );
        } else if (node.name === "Strikethrough") {
          decorations.push(
            Decoration.mark({ class: "cm-live-strike" }).range(node.from, node.to),
          );
        } else if (node.name === "InlineCode") {
          decorations.push(
            Decoration.mark({ class: "cm-live-inline-code" }).range(node.from, node.to),
          );
        } else if (node.name === "Link") {
          const parts = linkParts(node.node as SyntaxNodeShape, view.state);
          if (!parts) return;
          decorations.push(
            Decoration.mark({
              class: "cm-live-link",
              attributes: {
                title: parts.url,
                dir: "auto",
                "data-live-link-from": String(node.from),
                "data-live-link-to": String(node.to),
                "data-live-link-url-from": String(parts.urlFrom),
                "data-live-link-url-to": String(parts.urlTo),
                "data-live-link-url": parts.url,
              },
            }).range(parts.labelFrom, parts.labelTo),
          );
          if (!selectionTouchesRange(view.state, node, view.hasFocus)) {
            decorations.push(
              Decoration.replace({ inclusive: false }).range(
                node.from,
                parts.labelFrom,
              ),
              Decoration.replace({ inclusive: false }).range(
                parts.suffixFrom,
                node.to,
              ),
            );
          }
          return false;
        } else if (node.name === "Image") {
          return false;
        } else if (node.name === "HorizontalRule") {
          if (!selectionTouchesLine(view.state, node, view.hasFocus)) {
            decorations.push(
              Decoration.replace({
                widget: new HorizontalRuleWidget(node.from, node.to),
              }).range(node.from, node.to),
            );
          }
          return false;
        } else if (node.name === "CommentBlock") {
          // Multiline comments are rendered by the StateField-backed rich
          // block extension. Replacing them from this ViewPlugin crashes
          // CodeMirror because their range includes line breaks.
          return false;
        } else if (node.name === "ListItem") {
          const line = view.state.doc.lineAt(node.from);
          const indentation = /^\s*/u.exec(line.text)?.[0].length ?? 0;
          const depth = Math.min(6, Math.floor(indentation / 2));
          addLineDecoration(
            decorations,
            lineKeys,
            view.state,
            node.from,
            `cm-live-list-item cm-live-list-depth-${depth}`,
          );
        } else if (node.name === "Blockquote") {
          const first = view.state.doc.lineAt(node.from).number;
          const last = view.state.doc.lineAt(Math.max(node.from, node.to - 1)).number;
          for (let lineNumber = first; lineNumber <= last; lineNumber += 1) {
            addLineDecoration(
              decorations,
              lineKeys,
              view.state,
              view.state.doc.line(lineNumber).from,
              "cm-live-quote",
            );
          }
        } else if (node.name === "TaskMarker") {
          if (!selectionTouchesLine(view.state, node, view.hasFocus)) {
            const checked = /^\[[xX]\]$/u.test(
              view.state.sliceDoc(node.from, node.to),
            );
            decorations.push(
              Decoration.replace({
                widget: new TaskMarkerWidget(node.from, node.to, checked),
              }).range(node.from, node.to),
            );
          }
          return false;
        } else if (node.name === "ListMark") {
          if (!selectionTouchesLine(view.state, node, view.hasFocus)) {
            const source = view.state.sliceDoc(node.from, node.to);
            const line = view.state.doc.lineAt(node.from);
            const taskLine = /^\s*(?:[-+*]|\d+[.)])\s+\[[ xX]\]/u.test(line.text);
            const ordered = /^\d/u.test(source);
            decorations.push(
              Decoration.replace({
                widget: new StaticMarkerWidget(
                  taskLine ? "" : ordered ? source : "•",
                  "cm-live-list-marker",
                ),
              }).range(node.from, node.to),
            );
          }
          return false;
        } else if (node.name === "QuoteMark") {
          if (!selectionTouchesLine(view.state, node, view.hasFocus)) {
            decorations.push(
              Decoration.replace({ inclusive: false }).range(node.from, node.to),
            );
          }
          return false;
        } else if (node.name === "Escape") {
          if (!selectionTouchesRange(view.state, node, view.hasFocus)) {
            decorations.push(
              Decoration.replace({ inclusive: false }).range(node.from, node.from + 1),
            );
          }
          return false;
        }

        const inlineSyntaxIsVisible =
          node.name !== "CodeMark" &&
          selectionTouchesRange(
            view.state,
            inlineAncestor((node.node as SyntaxNodeShape).parent) ?? node,
            view.hasFocus,
          );
        if (
          (node.name === "EmphasisMark" ||
            node.name === "StrikethroughMark" ||
            node.name === "CodeMark") &&
          node.from < node.to &&
          !inlineSyntaxIsVisible
        ) {
          decorations.push(
            Decoration.replace({ inclusive: false }).range(node.from, node.to),
          );
        } else if (
          node.name === "HeaderMark" &&
          !selectionTouchesLine(view.state, node, view.hasFocus)
        ) {
          decorations.push(
            Decoration.replace({ inclusive: false }).range(node.from, node.to),
          );
        }
      },
    });

    const firstLine = view.state.doc.lineAt(range.from).number;
    const lastLine = view.state.doc.lineAt(Math.max(range.from, range.to - 1)).number;
    for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber += 1) {
      const line = view.state.doc.line(lineNumber);
      if (!line.text.trim()) {
        addLineDecoration(
          decorations,
          lineKeys,
          view.state,
          line.from,
          "cm-live-empty-block",
        );
      }
      for (const highlight of findHighlightRanges(line.text, line.from)) {
        decorations.push(
          Decoration.mark({ class: "cm-live-highlight" }).range(
            highlight.contentFrom,
            highlight.contentTo,
          ),
        );
        if (!selectionTouchesRange(view.state, highlight, view.hasFocus)) {
          decorations.push(
            Decoration.replace({ inclusive: false }).range(
              highlight.from,
              highlight.contentFrom,
            ),
            Decoration.replace({ inclusive: false }).range(
              highlight.contentTo,
              highlight.to,
            ),
          );
        }
      }
      for (const underline of findUnderlineRanges(line.text, line.from)) {
        decorations.push(
          Decoration.mark({ class: "cm-live-underline" }).range(
            underline.contentFrom,
            underline.contentTo,
          ),
        );
        if (!selectionTouchesRange(view.state, underline, view.hasFocus)) {
          decorations.push(
            Decoration.replace({ inclusive: false }).range(
              underline.from,
              underline.contentFrom,
            ),
            Decoration.replace({ inclusive: false }).range(
              underline.contentTo,
              underline.to,
            ),
          );
        }
      }
      const allFootnotes = footnoteReferences(line.text, line.from);
      if (allFootnotes.length) {
        documentFootnotes ??= documentFootnoteReferences(view.state);
        for (const footnote of allFootnotes) {
          if (selectionTouchesRange(view.state, footnote, view.hasFocus)) continue;
          const target = documentFootnotes.find(
            (candidate) =>
              candidate.id === footnote.id &&
              candidate.definition !== footnote.definition,
          );
          decorations.push(
            Decoration.replace({
              widget: new FootnoteWidget(
                footnote.id,
                footnote.from,
                footnote.to,
                target?.from ?? null,
                footnote.definition,
              ),
            }).range(footnote.from, footnote.to),
          );
        }
      }
    }
  }

  const activeLine = view.state.doc.lineAt(view.state.selection.main.head);
  if (!activeLine.text.trim()) {
    addLineDecoration(
      decorations,
      lineKeys,
      view.state,
      activeLine.from,
      "cm-live-empty-block",
    );
  }
  const activeBlock = activeEditingBlockRange(view.state, view.hasFocus);
  if (activeBlock) {
    const firstLine = view.state.doc.lineAt(activeBlock.from).number;
    const lastLine = view.state.doc.lineAt(
      Math.min(view.state.doc.length, activeBlock.to),
    ).number;
    for (let lineNumber = firstLine; lineNumber <= lastLine; lineNumber += 1) {
      addLineDecoration(
        decorations,
        lineKeys,
        view.state,
        view.state.doc.line(lineNumber).from,
        "cm-live-syntax-is-visible",
      );
    }
  }

  return {
    decorations: Decoration.set(
      pluginSafeDecorationRanges(view.state, decorations),
      true,
    ),
    rangeCount: ranges.length,
    scannedCharacters: ranges.reduce(
      (total, range) => total + range.to - range.from,
      0,
    ),
  };
}

export function safelyBuildLiveDecorations<T>(
  build: () => T,
  fallback: T,
  onFailure: (failure: LivePreviewFailure) => void,
) {
  try {
    return build();
  } catch (cause) {
    onFailure({
      cause,
      message:
        cause instanceof Error && cause.message
          ? cause.message
          : "خطای ناشناخته در پردازش Markdown",
    });
    return fallback;
  }
}

function buildRichBlockDecorations(
  view: EditorView,
  options: RichWidgetOptions,
) {
  const decorations: Range<Decoration>[] = [];
  const tree = syntaxTree(view.state);
  const scanRanges = livePreviewScanRanges(view);
  const source = view.state.doc.toString();
  for (const block of findFormulaBlocks(source)) {
    const visible = scanRanges.some(
      (range) => block.startOffset <= range.to && block.endOffset >= range.from,
    );
    if (!visible) continue;
    decorations.push(
      Decoration.replace({
        block: true,
        inclusive: true,
        widget: new FormulaBlockWidget(
          block.startOffset,
          block.endOffset,
          block.raw,
          block,
          options.openFormulaStudio,
        ),
      }).range(block.startOffset, block.endOffset),
    );
  }
  for (const range of scanRanges) {
    tree.iterate({
      from: range.from,
      to: range.to,
      enter(node) {
        if (node.name === "FencedCode") {
          const source = view.state.sliceDoc(node.from, node.to);
          const fence = parseFence(source);
          if (fence?.mermaid) {
            decorations.push(
              Decoration.replace({
                block: true,
                widget: new MermaidBlockWidget(
                  node.from,
                  node.to,
                  source,
                  fence,
                  options.openMermaidStudio,
                ),
              }).range(node.from, node.to),
            );
          }
          return false;
        }
        if (node.name === "CommentBlock") {
          if (!selectionTouchesRange(view.state, node, view.hasFocus)) {
            decorations.push(
              Decoration.replace({
                block: true,
                widget: new RevealSourceWidget(
                  node.from,
                  node.to,
                  "یادداشت پنهان",
                  "cm-live-comment-placeholder",
                ),
              }).range(node.from, node.to),
            );
          }
          return false;
        }
        if (node.name === "Table") {
          if (!selectionTouchesRange(view.state, node, view.hasFocus)) {
            const source = view.state.sliceDoc(node.from, node.to);
            const table = parseGfmTable(source);
            if (table) {
              decorations.push(
                Decoration.replace({
                  block: true,
                  widget: new TableBlockWidget(node.from, node.to, source, table),
                }).range(node.from, node.to),
              );
            }
          }
          return false;
        }
        if (node.name === "Image") {
          if (!selectionTouchesRange(view.state, node, view.hasFocus)) {
            const source = view.state.sliceDoc(node.from, node.to);
            const image = parseMarkdownImage(source);
            if (image) {
              const line = view.state.doc.lineAt(node.from);
              const standalone = line.text.trim() === source;
              decorations.push(
                Decoration.replace({
                  block: standalone,
                  widget: new ImageBlockWidget(
                    node.from,
                    node.to,
                    source,
                    image,
                    options.resolveImage,
                  ),
                }).range(node.from, node.to),
              );
            }
          }
          return false;
        }
        if (node.name === "Link") {
          if (!selectionTouchesRange(view.state, node, view.hasFocus)) {
            const linkSource = view.state.sliceDoc(node.from, node.to);
            const audio = parseMarkdownAudio(linkSource);
            if (audio) {
              const line = view.state.doc.lineAt(node.from);
              if (line.text.trim() === linkSource) {
                decorations.push(
                  Decoration.replace({
                    block: true,
                    widget: new AudioBlockWidget(
                      node.from,
                      node.to,
                      linkSource,
                      audio,
                      options.resolveAudio,
                      options.openAudioTranscription,
                    ),
                  }).range(node.from, node.to),
                );
              }
            }
          }
          return false;
        }
      },
    });
  }
  return Decoration.set(decorations, true);
}

function createRichBlockExtension(
  options: RichWidgetOptions,
  onFailure: (failure: LivePreviewFailure) => void,
) {
  const setDecorations = StateEffect.define<DecorationSet>();
  const decorationField = StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(value, transaction) {
      let next = value.map(transaction.changes);
      for (const effect of transaction.effects) {
        if (effect.is(setDecorations)) next = effect.value;
      }
      return next;
    },
    provide: (field) => EditorView.decorations.from(field),
  });
  const viewportDriver = ViewPlugin.fromClass(
    class {
      private queued = false;
      private destroyed = false;
      private animationFrame: number | null = null;

      constructor(private readonly view: EditorView) {
        this.schedule();
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          update.focusChanged ||
          update.transactions.some(transactionChangesStructuralBlockSelection) ||
          update.transactions.some(transactionChangesActiveEditingBlockRange)
        ) {
          this.schedule();
        }
      }

      private schedule() {
        if (this.queued || this.destroyed) return;
        this.queued = true;
        const ownerWindow = this.view.dom.ownerDocument.defaultView;
        const run = () => {
          this.animationFrame = null;
          this.queued = false;
          if (this.destroyed) return;
          const decorations = safelyBuildLiveDecorations(
            () => buildRichBlockDecorations(this.view, options),
            Decoration.none,
            onFailure,
          );
          const current = this.view.state.field(decorationField, false);
          if (current && RangeSet.eq([current], [decorations])) return;
          const scrollTop = this.view.scrollDOM.scrollTop;
          this.view.dispatch({ effects: setDecorations.of(decorations) });
          this.view.scrollDOM.scrollTop = scrollTop;
        };
        if (ownerWindow) {
          this.animationFrame = ownerWindow.requestAnimationFrame(run);
        } else {
          queueMicrotask(run);
        }
      }

      destroy() {
        this.destroyed = true;
        const ownerWindow = this.view.dom.ownerDocument.defaultView;
        if (ownerWindow && this.animationFrame !== null) {
          ownerWindow.cancelAnimationFrame(this.animationFrame);
        }
      }
    },
  );
  return [decorationField, viewportDriver];
}

export function createLivePreviewExtension({
  onFailure,
  richWidgets = {},
}: {
  onFailure: (failure: LivePreviewFailure) => void;
  richWidgets?: RichWidgetOptions;
}) {
  const decorationPlugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none;
      private failed = false;
      private readonly view: EditorView;
      private lastDocument: Text | null = null;
      private lastSelection = "";
      private lastVisibleRanges = "";
      private lastActiveBlock = "";
      private lastFocused: boolean | null = null;

      constructor(view: EditorView) {
        this.view = view;
        this.rebuild(view);
      }

      update(update: ViewUpdate) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet ||
          update.focusChanged ||
          update.transactions.some(transactionChangesStructuralBlockSelection) ||
          update.transactions.some(transactionChangesActiveEditingBlockRange)
        ) {
          this.rebuild(update.view);
        }
      }

      rebuild(view: EditorView) {
        const selection = view.state.selection.main;
        const selectionSignature = `${selection.from}:${selection.to}:${selection.head}`;
        const visibleRangeSignature = view.visibleRanges
          .map((range) => `${range.from}:${range.to}`)
          .join("|");
        const activeBlock = activeEditingBlockRange(view.state, view.hasFocus);
        const activeBlockSignature = activeBlock
          ? `${activeBlock.from}:${activeBlock.to}`
          : "";
        if (
          this.lastDocument === view.state.doc &&
          this.lastSelection === selectionSignature &&
          this.lastVisibleRanges === visibleRangeSignature &&
          this.lastActiveBlock === activeBlockSignature &&
          this.lastFocused === view.hasFocus
        ) {
          return;
        }
        this.lastDocument = view.state.doc;
        this.lastSelection = selectionSignature;
        this.lastVisibleRanges = visibleRangeSignature;
        this.lastActiveBlock = activeBlockSignature;
        this.lastFocused = view.hasFocus;
        const result = safelyBuildLiveDecorations(
          () => buildLivePreviewDecorations(view),
          { decorations: Decoration.none, rangeCount: 0, scannedCharacters: 0 },
          (failure) => {
            if (this.failed) return;
            this.failed = true;
            view.dom.dataset.livePreviewFallback = "true";
            queueMicrotask(() => onFailure(failure));
          },
        );
        this.decorations = result.decorations;
        view.dom.dataset.livePreviewRanges = String(result.rangeCount);
        view.dom.dataset.livePreviewScanned = String(result.scannedCharacters);
        view.dom.dataset.livePreviewDocument = String(view.state.doc.length);
      }

      destroy() {
        delete this.view.dom.dataset.livePreviewFallback;
        delete this.view.dom.dataset.livePreviewRanges;
        delete this.view.dom.dataset.livePreviewScanned;
        delete this.view.dom.dataset.livePreviewDocument;
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
  return [
    ...createRichBlockExtension(richWidgets, onFailure),
    decorationPlugin,
    createLiveLinkPopoverExtension(),
  ];
}

function isInsideFencedCode(state: EditorState, position: number) {
  let node = syntaxTree(state).resolveInner(position, 1);
  for (;;) {
    if (node.name === "FencedCode" || node.name === "CodeBlock") return true;
    const parent = node.parent;
    if (!parent) return false;
    node = parent;
  }
}

function visibleLineStarts(view: EditorView) {
  const starts = new Set<number>();
  for (const range of view.visibleRanges) {
    const first = view.state.doc.lineAt(range.from).number;
    const last = view.state.doc.lineAt(Math.max(range.from, range.to - 1)).number;
    for (let lineNumber = first; lineNumber <= last; lineNumber += 1) {
      starts.add(view.state.doc.line(lineNumber).from);
    }
  }
  return [...starts].sort((left, right) => left - right);
}

function buildDirectionDecorations(view: EditorView) {
  return Decoration.set(
    visibleLineStarts(view).map((from) => {
      const line = view.state.doc.lineAt(from);
      const code = isInsideFencedCode(view.state, Math.min(line.to, line.from + 1));
      const direction = code ? "ltr" : detectBlockTextDirection(line.text, "rtl");
      return Decoration.line({
        attributes: { dir: direction },
        class: `cm-line-${direction}${code ? " cm-line-code" : ""}`,
      }).range(line.from);
    }),
    true,
  );
}

export const viewportDirectionExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildDirectionDecorations(view);
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildDirectionDecorations(update.view);
      }
    }
  },
  { decorations: (plugin) => plugin.decorations },
);
