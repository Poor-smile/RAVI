"use client";

import { autocompletion, CompletionContext } from "@codemirror/autocomplete";
import { StreamLanguage } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
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
}: {
  value: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onRenderNow: () => void;
  onRequestClose: () => void;
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
        mermaidLanguage,
        autocompletion({ override: [completeMermaid] }),
        EditorView.lineWrapping,
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

  return <div ref={hostRef} className="mermaid-code-editor" />;
}
