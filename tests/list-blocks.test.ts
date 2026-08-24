import assert from "node:assert/strict";
import test from "node:test";
import {
  markdownListItemAt,
  parseMarkdownListBlock,
  planMarkdownEmptyListItemDeletion,
  planMarkdownListIndentation,
  planMarkdownListItemInsertion,
  planMarkdownListItemMove,
  planMarkdownListItemMoveTo,
  planMarkdownListItemSoftBreak,
} from "../app/editor/list-blocks";
import { makeRaaviDocument, parseRaaviDocument } from "../app/raavi";

test("a pasted mixed nested list becomes one parent/child model", () => {
  const source = [
    "- آیتم اصلی",
    "  1. زیرمجموعه اول",
    "    - [x] زیرمجموعه سطح سوم",
    "  2. زیرمجموعه دوم",
    "- آیتم اصلی بعدی",
  ].join("\n");
  const block = parseMarkdownListBlock(source);

  assert.equal(block.items.length, 5);
  assert.deepEqual(block.items.map((item) => item.depth), [0, 1, 2, 1, 0]);
  assert.deepEqual(block.roots, ["list-item:0", "list-item:4"]);
  assert.deepEqual(block.items[0].children, ["list-item:1", "list-item:3"]);
  assert.deepEqual(block.items[1].children, ["list-item:2"]);
  assert.equal(
    markdownListItemAt(block, source.indexOf("سطح سوم"))?.id,
    "list-item:2",
  );
});

test("nest and outdent move the complete subtree and preserve caret", () => {
  const source = [
    "- والد",
    "- فرزند",
    "  - نوه",
    "- بعدی",
  ].join("\n");
  const caret = source.indexOf("فرزند") + 3;
  const nested = planMarkdownListIndentation(source, caret, "in");
  assert.ok(nested?.changed);
  assert.equal(
    nested.markdown,
    ["- والد", "  - فرزند", "    - نوه", "- بعدی"].join("\n"),
  );
  assert.equal(
    nested.selectionOffset,
    nested.markdown.indexOf("فرزند") + 3,
  );

  const outdented = planMarkdownListIndentation(
    nested.markdown,
    nested.selectionOffset,
    "out",
  );
  assert.ok(outdented?.changed);
  assert.equal(outdented.markdown, source);
  assert.equal(
    outdented.selectionOffset,
    outdented.markdown.indexOf("فرزند") + 3,
  );
});

test("first sibling cannot nest and a root item cannot outdent", () => {
  const source = "- اول\n- دوم";
  const first = source.indexOf("اول");
  const second = source.indexOf("دوم");
  const nestFirst = planMarkdownListIndentation(source, first, "in");
  const outdentRoot = planMarkdownListIndentation(source, second, "out");

  assert.equal(nestFirst?.changed, false);
  assert.equal(nestFirst?.markdown, source);
  assert.equal(outdentRoot?.changed, false);
  assert.equal(outdentRoot?.markdown, source);
});

test("ordered siblings are renumbered after nest and outdent", () => {
  const source = "1. اول\n2. دوم\n3. سوم";
  const caret = source.indexOf("دوم");
  const nested = planMarkdownListIndentation(source, caret, "in");
  assert.equal(nested?.markdown, "1. اول\n  1. دوم\n2. سوم");

  const outdented = planMarkdownListIndentation(
    nested!.markdown,
    nested!.selectionOffset,
    "out",
  );
  assert.equal(outdented?.markdown, source);
});

test("todo state and descendants survive semantic indentation", () => {
  const source = [
    "- [x] انجام‌شده",
    "- [ ] در حال انجام",
    "  - [x] زیرکار",
  ].join("\n");
  const nested = planMarkdownListIndentation(
    source,
    source.indexOf("در حال"),
    "in",
  );
  assert.equal(
    nested?.markdown,
    [
      "- [x] انجام‌شده",
      "  - [ ] در حال انجام",
      "    - [x] زیرکار",
    ].join("\n"),
  );
});

test("Enter adds a same-level item while Shift+Enter adds a continuation line", () => {
  const source = "- [x] آیتم چندخطی";
  const end = source.length;
  const inserted = planMarkdownListItemInsertion(source, end);
  assert.equal(inserted?.markdown, "- [x] آیتم چندخطی\n- [ ] ");
  assert.equal(inserted?.selectionOffset, inserted?.markdown.length);

  const softBreak = planMarkdownListItemSoftBreak(source, end);
  assert.equal(softBreak?.markdown, "- [x] آیتم چندخطی\n      ");
  assert.equal(softBreak?.selectionOffset, softBreak?.markdown.length);

  const atStart = planMarkdownListItemInsertion("- متن", 2);
  assert.equal(atStart?.markdown, "- \n- متن");
  const inMiddle = planMarkdownListItemInsertion("- متن", 4);
  assert.equal(inMiddle?.markdown, "- مت\n- ن");
});

test("nested Markdown survives a Raavi save/open round-trip byte-for-byte", () => {
  const source = [
    "- آیتم اصلی",
    "  - زیرمجموعه اول",
    "    1. زیرمجموعه سطح سوم",
    "      ادامهٔ چندخطی",
    "  - [x] زیرمجموعه دوم",
    "- آیتم اصلی بعدی",
  ].join("\n");
  const saved = makeRaaviDocument("nested.md", source, [], 1, []);
  const opened = parseRaaviDocument(JSON.stringify(saved));

  assert.equal(opened.content, source);
  assert.equal(parseMarkdownListBlock(opened.content).items.length, 5);
});

test("Enter after an item with children keeps its subtree attached", () => {
  const source = "- والد\n  - فرزند\n- بعدی";
  const position = source.indexOf("والد") + "والد".length;
  const inserted = planMarkdownListItemInsertion(source, position);
  assert.equal(
    inserted?.markdown,
    "- والد\n  - فرزند\n- \n- بعدی",
  );
});

test("Alt+Arrow moves an item, its multiline content and descendants as one unit", () => {
  const source = [
    "- اول",
    "- دوم",
    "  ادامهٔ دوم",
    "  - فرزند",
    "- سوم",
  ].join("\n");
  const caret = source.indexOf("دوم") + 2;
  const movedDown = planMarkdownListItemMove(source, caret, "down");
  assert.equal(
    movedDown?.markdown,
    [
      "- اول",
      "- سوم",
      "- دوم",
      "  ادامهٔ دوم",
      "  - فرزند",
    ].join("\n"),
  );
  assert.equal(
    movedDown?.selectionOffset,
    movedDown!.markdown.indexOf("دوم") + 2,
  );

  const movedUp = planMarkdownListItemMove(
    movedDown!.markdown,
    movedDown!.selectionOffset,
    "up",
  );
  assert.equal(movedUp?.markdown, source);
  assert.equal(movedUp?.selectionOffset, caret);
});

test("pointer moveTo matches Alt+Arrow for the same sibling destination", () => {
  const source = [
    "- اول",
    "- دوم",
    "  ادامهٔ دوم",
    "  - [x] زیرکار",
    "- سوم",
  ].join("\n");
  const caret = source.indexOf("دوم") + 2;
  const keyboard = planMarkdownListItemMove(source, caret, "down");
  const pointer = planMarkdownListItemMoveTo(source, caret, 2);
  assert.equal(pointer?.markdown, keyboard?.markdown);
  assert.equal(pointer?.selectionOffset, keyboard?.selectionOffset);

  const movedToStart = planMarkdownListItemMoveTo(
    pointer!.markdown,
    pointer!.selectionOffset,
    0,
  );
  assert.equal(
    movedToStart?.markdown,
    [
      "- دوم",
      "  ادامهٔ دوم",
      "  - [x] زیرکار",
      "- اول",
      "- سوم",
    ].join("\n"),
  );
});

test("item movement is a no-op at sibling boundaries", () => {
  const source = "- اول\n- دوم";
  assert.equal(
    planMarkdownListItemMove(source, source.indexOf("اول"), "up")?.changed,
    false,
  );
  assert.equal(
    planMarkdownListItemMove(source, source.indexOf("دوم"), "down")?.changed,
    false,
  );
});

test("nested movement stays within the active parent", () => {
  const source = [
    "- والد",
    "  - فرزند اول",
    "  - فرزند دوم",
    "- والد بعدی",
  ].join("\n");
  const moved = planMarkdownListItemMove(
    source,
    source.indexOf("فرزند دوم"),
    "up",
  );
  assert.equal(
    moved?.markdown,
    [
      "- والد",
      "  - فرزند دوم",
      "  - فرزند اول",
      "- والد بعدی",
    ].join("\n"),
  );
});

test("ordered numbering and Todo metadata survive subtree movement", () => {
  const source = [
    "1. اول",
    "2. دوم",
    "   - [x] زیرکار",
    "3. سوم",
  ].join("\n");
  const moved = planMarkdownListItemMove(source, source.indexOf("دوم"), "down");
  assert.equal(
    moved?.markdown,
    [
      "1. اول",
      "2. سوم",
      "3. دوم",
      "   - [x] زیرکار",
    ].join("\n"),
  );
});

test("deleting an empty parent promotes every child without data loss", () => {
  const source = [
    "- [ ] ",
    "  - [x] فرزند",
    "    ادامهٔ چندخطی",
    "  - فرزند دوم",
    "- بعدی",
  ].join("\n");
  const deleted = planMarkdownEmptyListItemDeletion(source, 6);
  assert.equal(
    deleted?.markdown,
    [
      "- [x] فرزند",
      "  ادامهٔ چندخطی",
      "- فرزند دوم",
      "- بعدی",
    ].join("\n"),
  );
  assert.equal(
    deleted?.selectionOffset,
    deleted!.markdown.indexOf("فرزند"),
  );
});

test("deleting an empty ordered item renumbers siblings and a lone marker becomes text", () => {
  const source = "1. اول\n2. \n3. سوم";
  const deleted = planMarkdownEmptyListItemDeletion(
    source,
    source.indexOf("2. ") + 3,
  );
  assert.equal(deleted?.markdown, "1. اول\n2. سوم");
  assert.equal(
    planMarkdownEmptyListItemDeletion("- ", 2)?.markdown,
    "",
  );
  assert.equal(
    planMarkdownEmptyListItemDeletion("- متن", 5),
    null,
  );
  assert.equal(
    planMarkdownEmptyListItemDeletion("- \n  ادامهٔ واقعی", 2),
    null,
  );
  assert.equal(
    planMarkdownEmptyListItemDeletion("- اول\n- \n  \n- بعدی", 8)?.markdown,
    "- اول\n- بعدی",
  );
});
