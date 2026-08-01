"use client";

import { autocompletion, CompletionContext } from "@codemirror/autocomplete";
import { StreamLanguage } from "@codemirror/language";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  WidgetType,
} from "@codemirror/view";
import { basicSetup } from "codemirror";
import { useEffect, useLayoutEffect, useRef } from "react";

const KEYWORDS = [
  "flowchart",
  "graph",
  "sequenceDiagram",
  "classDiagram",
  "stateDiagram-v2",
  "erDiagram",
  "gantt",
  "pie",
  "gitGraph",
  "mindmap",
  "timeline",
  "journey",
  "quadrantChart",
  "requirementDiagram",
  "architecture-beta",
  "kanban",
  "sankey-beta",
  "xychart-beta",
  "subgraph",
  "participant",
  "section",
  "title",
  "direction",
  "end",
];

const mermaidLanguage = StreamLanguage.define({
  startState: () => ({ inString: false }),
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/%%.*/u)) return "comment";
    if (stream.match(/"(?:[^"\\]|\\.)*"/u)) return "string";
    if (
      stream.match(
        /(?:flowchart|graph|sequenceDiagram|classDiagram|stateDiagram-v2|erDiagram|gantt|pie|gitGraph|mindmap|timeline|journey|quadrantChart|requirementDiagram|architecture-beta|kanban|sankey-beta|xychart-beta|subgraph|participant|section|title|direction|end)\b/u,
      )
    ) {
      return "keyword";
    }
    if (stream.match(/-->|---|==>|-.->|<-->|--x|--o/u)) return "operator";
    if (stream.match(/\b\d+(?:\.\d+)?\b/u)) return "number";
    if (stream.match(/[()[\]{}]/u)) return "bracket";
    stream.next();
    return null;
  },
});

type EditorError = { line?: number; message?: string };

const setEditorError = StateEffect.define<EditorError>();

class ErrorNoteWidget extends WidgetType {
  constructor(readonly message: string) {
    super();
  }

  eq(other: ErrorNoteWidget) {
    return other.message === this.message;
  }

  toDOM() {
    const note = document.createElement("div");
    note.className = "cm-mermaid-error-note";
    note.dir = "rtl";
    note.setAttribute("role", "note");
    note.setAttribute("contenteditable", "false");
    note.textContent = this.message;
    return note;
  }
}

const editorErrorField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, transaction) {
    let next = decorations.map(transaction.changes);
    for (const effect of transaction.effects) {
      if (!effect.is(setEditorError)) continue;
      const { line, message } = effect.value;
      if (!line || !message) {
        next = Decoration.none;
        continue;
      }
      const lineNumber = Math.max(1, Math.min(line, transaction.state.doc.lines));
      const documentLine = transaction.state.doc.line(lineNumber);
      next = Decoration.set([
        Decoration.line({
          attributes: {
            class: "cm-mermaid-error-line",
            "aria-invalid": "true",
          },
        }).range(documentLine.from),
        Decoration.widget({
          widget: new ErrorNoteWidget(message),
          block: true,
          side: 1,
        }).range(documentLine.to),
      ]);
    }
    return next;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function completeMermaid(context: CompletionContext) {
  const word = context.matchBefore(/[\w-]*/u);
  if (!word || (word.from === word.to && !context.explicit)) return null;
  return {
    from: word.from,
    options: KEYWORDS.map((label) => ({ label, type: "keyword" })),
  };
}

export function MermaidCodeEditor({
  value,
  onChange,
  onApply,
  onRenderNow,
  onRequestClose,
  errorLine,
  errorMessage,
  focusErrorRequest = 0,
}: {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onRenderNow: () => void;
  onRequestClose: () => void;
  errorLine?: number;
  errorMessage?: string;
  focusErrorRequest?: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const initialValueRef = useRef(value);
  const callbacksRef = useRef({
    onChange,
    onApply,
    onRenderNow,
    onRequestClose,
  });
  useLayoutEffect(() => {
    callbacksRef.current = {
      onChange,
      onApply,
      onRenderNow,
      onRequestClose,
    };
  }, [onApply, onChange, onRenderNow, onRequestClose]);

  useEffect(() => {
    if (!hostRef.current) return;
    const state = EditorState.create({
      doc: initialValueRef.current,
      extensions: [
        basicSetup,
        editorErrorField,
        mermaidLanguage,
        autocompletion({ override: [completeMermaid] }),
        EditorView.lineWrapping,
        EditorView.perLineTextDirection.of(true),
        EditorView.contentAttributes.of({
          dir: "ltr",
          "data-editable-kind": "mermaidEditor",
          "aria-label": "کد Mermaid",
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            callbacksRef.current.onChange(update.state.doc.toString());
          }
        }),
        EditorView.domEventHandlers({
          keydown(event) {
            const primary = event.ctrlKey || event.metaKey;
            if (primary && event.code === "Enter") {
              event.preventDefault();
              callbacksRef.current.onRenderNow();
              return true;
            }
            if (primary && event.code === "KeyS") {
              event.preventDefault();
              callbacksRef.current.onApply();
              return true;
            }
            if (event.code === "Escape") {
              event.preventDefault();
              callbacksRef.current.onRequestClose();
              return true;
            }
            return false;
          },
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    view.focus();
    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || view.state.doc.toString() === value) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: setEditorError.of({ line: errorLine, message: errorMessage }),
    });
  }, [errorLine, errorMessage]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || !errorLine || focusErrorRequest < 1) return;
    const lineNumber = Math.max(1, Math.min(errorLine, view.state.doc.lines));
    const line = view.state.doc.line(lineNumber);
    view.dispatch({
      selection: { anchor: line.from },
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
    });
    view.focus();
  }, [errorLine, focusErrorRequest]);

  return (
    <div
      ref={hostRef}
      className="mermaid-code-editor"
      data-error-line={errorLine || undefined}
    />
  );
}
