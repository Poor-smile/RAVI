"use client";

import {
  defaultKeymap,
  history,
  historyKeymap,
  redo,
  undo,
} from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import {
  bracketMatching,
  defaultHighlightStyle,
  foldGutter,
  foldKeymap,
  HighlightStyle,
  indentOnInput,
  syntaxHighlighting,
} from "@codemirror/language";
import { lintKeymap } from "@codemirror/lint";
import {
  findNext,
  findPrevious,
  highlightSelectionMatches,
  openSearchPanel,
  searchKeymap,
} from "@codemirror/search";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  dropCursor,
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  highlightSpecialChars,
  keymap,
  lineNumbers,
  ViewPlugin,
  placeholder,
} from "@codemirror/view";
import {
  autocompletion,
  closeBrackets,
  closeBracketsKeymap,
  completionKeymap,
} from "@codemirror/autocomplete";
import { tags } from "@lezer/highlight";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";

export type MarkdownCodeEditorHandle = {
  readonly element: HTMLElement | null;
  readonly value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  readonly clientHeight: number;
  readonly scrollHeight: number;
  scrollTop: number;
  contains: (target: Node | null) => boolean;
  focus: () => void;
  findNext: () => void;
  findPrevious: () => void;
  getBoundingClientRect: () => DOMRect;
  getSelectionAnchor: () => { clientX: number; clientY: number } | null;
  openSearch: () => void;
  redo: () => void;
  selectAll: () => void;
  setSelectionRange: (start: number, end: number) => void;
  undo: () => void;
};

type MarkdownCodeEditorProps = {
  ariaDescribedBy?: string;
  className?: string;
  id: string;
  onChange: (value: string) => void;
  onScroll: () => void;
  onSelectionChange: (pointer?: {
    clientX: number;
    clientY: number;
  }) => void;
  transformPastedText?: (value: string) => string;
  value: string;
};

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
  autocompletion(),
  highlightActiveLine(),
  highlightSelectionMatches(),
  keymap.of([
    { key: "Mod-Shift-z", run: redo },
    ...closeBracketsKeymap,
    ...defaultKeymap,
    ...searchKeymap,
    ...historyKeymap,
    ...foldKeymap,
    ...completionKeymap,
    ...lintKeymap,
  ]),
];

const lineDirectionPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = this.buildDecorations(view);
    }

    update(update: { docChanged: boolean; view: EditorView }) {
      if (update.docChanged) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view: EditorView) {
      const builder = new RangeSetBuilder<Decoration>();
      let fenceMarker = "";
      for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber += 1) {
        const line = view.state.doc.line(lineNumber);
        const fence = line.text.match(/^ {0,3}(`{3,}|~{3,})/u);
        const latin = line.text.match(/[A-Za-z]/gu)?.length ?? 0;
        const arabic = line.text.match(/[\u0600-\u06ff]/gu)?.length ?? 0;
        const direction = fenceMarker || fence || latin > arabic * 1.4 ? "ltr" : "rtl";
        builder.add(
          line.from,
          line.from,
          Decoration.line({
            attributes: {
              class: `cm-line-${direction}`,
              dir: direction,
            },
          }),
        );
        if (fence) {
          const marker = fence[1][0];
          fenceMarker = fenceMarker === marker ? "" : fenceMarker || marker;
        }
      }
      return builder.finish();
    }
  },
  { decorations: (plugin) => plugin.decorations },
);

export const MarkdownCodeEditor = forwardRef<
  MarkdownCodeEditorHandle,
  MarkdownCodeEditorProps
>(function MarkdownCodeEditor(
  {
    ariaDescribedBy,
    className,
    id,
    onChange,
    onScroll,
    onSelectionChange,
    transformPastedText,
    value,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialValueRef = useRef(value);
  const externalUpdateRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onScrollRef = useRef(onScroll);
  const onSelectionChangeRef = useRef(onSelectionChange);
  const transformPastedTextRef = useRef(transformPastedText);

  onChangeRef.current = onChange;
  onScrollRef.current = onScroll;
  onSelectionChangeRef.current = onSelectionChange;
  transformPastedTextRef.current = transformPastedText;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        persianEditorSetup,
        markdown(),
        persianEditorPhrases,
        syntaxHighlighting(markdownHighlightStyle),
        lineDirectionPlugin,
        EditorView.perLineTextDirection.of(true),
        placeholder("شروع به نوشتن Markdown کنید…"),
        EditorView.lineWrapping,
        EditorView.contentAttributes.of({
          "aria-label": "متن Markdown",
          ...(ariaDescribedBy
            ? { "aria-describedby": ariaDescribedBy }
            : {}),
          "data-editable-kind": "editor",
          dir: "auto",
          spellcheck: "true",
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !externalUpdateRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
          if (update.selectionSet) onSelectionChangeRef.current();
        }),
        EditorView.domEventHandlers({
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
        }),
      ],
    });
    const view = new EditorView({ parent: host, state });
    viewRef.current = view;

    const handleScroll = () => onScrollRef.current();
    view.scrollDOM.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      view.scrollDOM.removeEventListener("scroll", handleScroll);
      view.destroy();
      viewRef.current = null;
    };
  }, [ariaDescribedBy]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentValue = view.state.doc.toString();
    if (currentValue === value) return;

    externalUpdateRef.current = true;
    view.dispatch({
      changes: { from: 0, to: currentValue.length, insert: value },
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
      getSelectionAnchor() {
        const view = viewRef.current;
        if (!view) return null;
        const selection = view.state.selection.main;
        const side = selection.head === selection.to ? -1 : 1;
        const rect = view.coordsAtPos(selection.head, side);
        if (!rect) return null;
        return {
          clientX: (rect.left + rect.right) / 2,
          clientY: rect.top + rect.height / 2,
        };
      },
      openSearch() {
        const view = viewRef.current;
        if (view) openSearchPanel(view);
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
      setSelectionRange(start, end) {
        const view = viewRef.current;
        if (!view) return;
        const length = view.state.doc.length;
        const anchor = Math.max(0, Math.min(start, length));
        const head = Math.max(anchor, Math.min(end, length));
        view.dispatch({
          selection: { anchor, head },
          effects: EditorView.scrollIntoView(head, { y: "center" }),
        });
      },
      undo() {
        const view = viewRef.current;
        if (view) undo(view);
      },
    }),
    [value],
  );

  return (
    <div
      ref={hostRef}
      id={id}
      className={`markdown-code-editor ${className ?? ""}`.trim()}
    />
  );
});
