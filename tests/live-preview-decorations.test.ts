import assert from "node:assert/strict";
import test from "node:test";

import { EditorState } from "@codemirror/state";
import { Decoration } from "@codemirror/view";

import { pluginSafeDecorationRanges } from "../app/editor/live-preview";

test("view-plugin replacements never cross a Markdown line break", () => {
  const state = EditorState.create({ doc: "<!--\nmetadata\n-->\n# title" });
  const singleLineReplacement = Decoration.replace({}).range(0, 4);
  const multilineReplacement = Decoration.replace({}).range(
    0,
    state.doc.line(3).to,
  );
  const multilineMark = Decoration.mark({ class: "kept" }).range(
    0,
    state.doc.line(3).to,
  );

  const safe = pluginSafeDecorationRanges(state, [
    singleLineReplacement,
    multilineReplacement,
    multilineMark,
  ]);

  assert.deepEqual(safe, [singleLineReplacement, multilineMark]);
});
