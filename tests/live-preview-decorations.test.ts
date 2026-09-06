import assert from "node:assert/strict";
import test from "node:test";

import { EditorState } from "@codemirror/state";
import { Decoration } from "@codemirror/view";

import {
  activeEditingBlockRange,
  activeEditingBlockRangeExtension,
  pluginSafeDecorationRanges,
} from "../app/editor/live-preview";
import { resolveMarkdownBlockRange } from "../app/editor/rich-blocks";

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

test("a non-collapsed selection keeps the active editing block at its anchor", () => {
  const doc = [
    "پاراگراف آغاز انتخاب",
    "",
    "پاراگراف مقصد انتخاب",
  ].join("\n");
  const first = doc.indexOf("آغاز");
  const second = doc.indexOf("مقصد");
  const forward = EditorState.create({
    doc,
    selection: { anchor: first, head: second },
    extensions: [activeEditingBlockRangeExtension],
  });
  const backward = EditorState.create({
    doc,
    selection: { anchor: second, head: first },
    extensions: [activeEditingBlockRangeExtension],
  });

  const firstBlock = resolveMarkdownBlockRange(doc, first);
  const secondBlock = resolveMarkdownBlockRange(doc, second);
  assert.deepEqual(activeEditingBlockRange(forward, true), {
    from: firstBlock.from,
    to: firstBlock.to,
  });
  assert.deepEqual(activeEditingBlockRange(backward, true), {
    from: secondBlock.from,
    to: secondBlock.to,
  });
});
