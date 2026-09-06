import assert from "node:assert/strict";
import test from "node:test";
import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { ensureSyntaxTree, foldable } from "@codemirror/language";
import {
  findHighlightRanges,
  findUnderlineRanges,
} from "../app/editor/live-preview";
import {
  safeExternalLink,
  validateMarkdownLinkDestination,
} from "../app/editor/live-preview-widgets";
import { splitHighlightText } from "../app/markdown/remark-highlight";

test("highlight ranges ignore escaped delimiters and preserve exact offsets", () => {
  assert.deepEqual(findHighlightRanges("الف ==متن فارسی== ب"), [
    { from: 4, to: 17, contentFrom: 6, contentTo: 15 },
  ]);
  assert.deepEqual(findHighlightRanges("\\==خام=="), []);
});

test("underline ranges preserve HTML markers outside the visible content", () => {
  assert.deepEqual(findUnderlineRanges("الف <u>راوی</u> ب"), [
    { from: 4, to: 15, contentFrom: 7, contentTo: 11 },
  ]);
});

test("remark highlight creates semantic mark nodes without touching plain text", () => {
  assert.deepEqual(splitHighlightText("قبل ==مهم== بعد"), [
    { type: "text", value: "قبل " },
    {
      type: "highlight",
      data: { hName: "mark" },
      children: [{ type: "text", value: "مهم" }],
    },
    { type: "text", value: " بعد" },
  ]);
  assert.deepEqual(splitHighlightText("بدون نشان"), [
    { type: "text", value: "بدون نشان" },
  ]);
});

test("link editor separates safe external opening from portable destinations", () => {
  assert.equal(safeExternalLink("https://ravi.poorsmile.ir/docs"), "https://ravi.poorsmile.ir/docs");
  assert.equal(safeExternalLink("javascript:alert(1)"), null);
  assert.equal(validateMarkdownLinkDestination("../relative/file.md"), "");
  assert.match(validateMarkdownLinkDestination("\n"), /خالی/u);
  assert.match(validateMarkdownLinkDestination("https://a.test/\nnext"), /خط تازه/u);
});

test("heading and nested list folding is editor state, not Markdown data", () => {
  const source = "# فصل\nمتن\n## زیرفصل\nمتن\n\n- مادر\n  - فرزند\n  - فرزند دوم\nپایان";
  const state = EditorState.create({
    doc: source,
    extensions: [markdown({ base: markdownLanguage })],
  });
  assert.ok(ensureSyntaxTree(state, state.doc.length, 1_000));
  const heading = state.doc.line(1);
  const list = state.doc.line(6);
  assert.ok(foldable(state, heading.from, heading.to));
  assert.ok(foldable(state, list.from, list.to));
  assert.equal(state.doc.toString(), source);
});
