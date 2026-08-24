import assert from "node:assert/strict";
import test from "node:test";
import {
  createStructuralBlockOperations,
  type StructuralBlockOperation,
} from "../app/editor/block-operations";
import type { MarkdownBlockChange } from "../app/editor/rich-blocks";

function applyChanges(source: string, changes: MarkdownBlockChange[]) {
  return [...changes]
    .sort((left, right) => right.from - left.from)
    .reduce(
      (markdown, change) =>
        `${markdown.slice(0, change.from)}${change.insert}${markdown.slice(change.to)}`,
      source,
    );
}

function apply(source: string, operation: StructuralBlockOperation | null) {
  assert.ok(operation);
  return applyChanges(source, operation.changes);
}

test("insertAfter adds one empty Text Block without consuming either neighbor", () => {
  const source = "بلوک اول\n\nبلوک دوم";
  const caret = source.indexOf("اول") + 2;
  const service = createStructuralBlockOperations(source, {
    anchor: caret,
    head: caret,
  });
  const operation = service.insertAfter(service.blockIdAt(caret));

  assert.equal(apply(source, operation), "بلوک اول\n\n\n\nبلوک دوم");
  const insertedBlockCaret = "بلوک اول\n\n".length;
  assert.deepEqual(operation?.selection, {
    anchor: insertedBlockCaret,
    head: insertedBlockCaret,
  });
  assert.equal(operation?.focus, "editor");
  assert.equal(operation?.changes.length, 1);
});

test("duplicate copies a complete multiline RTL List Block and preserves relative caret", () => {
  const source = ["قبل", "", "- مورد یک", "- مورد دو", "", "بعد"].join("\n");
  const caret = source.indexOf("مورد دو") + 3;
  const service = createStructuralBlockOperations(source, {
    anchor: caret,
    head: caret,
  });
  const sourceId = service.blockIdAt(caret);
  const sourceBlock = service.blocks.find((block) => block.id === sourceId)!;
  const operation = service.duplicate(sourceId);

  assert.equal(
    apply(source, operation),
    [
      "قبل",
      "",
      "- مورد یک",
      "- مورد دو",
      "",
      "- مورد یک",
      "- مورد دو",
      "",
      "بعد",
    ].join("\n"),
  );
  assert.equal(
    operation?.selection.anchor,
    operation!.changes[0].from + 2 + (caret - sourceBlock.range.from),
  );
  assert.equal(operation?.selection.head, operation?.selection.anchor);
});

test("duplicate preserves a multiline block's metadata and inserts the copy immediately after it", () => {
  const block = [
    '```js title="نمونه" data-block-id="code-42"',
    'const metadata = { direction: "rtl" };',
    "console.log(metadata);",
    "```",
  ].join("\n");
  const source = ["قبل", "", block, "", "بعد"].join("\n");
  const caret = source.indexOf("metadata);") + 4;
  const service = createStructuralBlockOperations(source, {
    anchor: caret,
    head: caret,
  });
  const sourceId = service.blockIdAt(caret);
  const sourceRange = service.blocks.find((candidate) => candidate.id === sourceId)!.range;
  const operation = service.duplicate(sourceId);
  const duplicated = apply(source, operation);

  assert.equal(
    duplicated,
    ["قبل", "", block, "", block, "", "بعد"].join("\n"),
  );
  assert.equal(
    duplicated.slice(operation!.resultRange.from, operation!.resultRange.to),
    block,
  );
  assert.equal(
    operation!.selection.anchor - operation!.resultRange.from,
    caret - sourceRange.from,
  );
  assert.equal(operation?.changes.length, 1);
});

test("move preserves a caret's logical offset inside a complete Mermaid Block", () => {
  const mermaid = ["```mermaid", "flowchart RL", "A --> B", "```"].join("\n");
  const source = ["قبل", "", mermaid, "", "بعد"].join("\n");
  const caret = source.indexOf("A --> B") + 2;
  const service = createStructuralBlockOperations(source, {
    anchor: caret,
    head: caret,
  });
  const sourceId = service.blockIdAt(caret);
  const sourceRange = service.blocks.find((block) => block.id === sourceId)!.range;
  const operation = service.move(sourceId, "up");

  assert.equal(apply(source, operation), [mermaid, "", "قبل", "", "بعد"].join("\n"));
  assert.equal(operation?.selection.anchor, caret - sourceRange.from);
  assert.equal(operation?.selection.head, operation?.selection.anchor);
  assert.equal(operation?.operation, "move");
  assert.equal(operation?.announcement, "بلاک یک موقعیت به بالا منتقل شد.");
});

test("move is a directional no-op at the document boundaries", () => {
  const source = "اول\n\nدوم\n\nسوم";
  const service = createStructuralBlockOperations(source, { anchor: 0, head: 0 });
  const firstId = service.blockIdAt(source.indexOf("اول"));
  const lastId = service.blockIdAt(source.indexOf("سوم"));
  const downward = service.move(firstId, "down");

  assert.equal(service.move(firstId, "up"), null);
  assert.equal(service.move(lastId, "down"), null);
  assert.equal(downward?.announcement, "بلاک یک موقعیت به پایین منتقل شد.");
  assert.equal(apply(source, downward), "دوم\n\nاول\n\nسوم");
});

test("moveTo uses a block index and moves the complete target block range", () => {
  const source = ["یک", "", "> دو", "> ادامه", "", "سه"].join("\n");
  const sourcePosition = source.indexOf("دو");
  const service = createStructuralBlockOperations(source, {
    anchor: sourcePosition,
    head: sourcePosition,
  });
  const sourceId = service.blockIdAt(sourcePosition);
  const targetIndex = service.blockIndexAt(source.indexOf("سه"));
  const operation = service.moveTo(sourceId, targetIndex);

  assert.equal(
    apply(source, operation),
    ["یک", "", "سه", "", "> دو", "> ادامه"].join("\n"),
  );
  assert.equal(operation?.operation, "moveTo");
  assert.equal(operation?.focus, "editor");
});

test("stale or invalid block IDs fail safely without partial edits", () => {
  const source = "اول\nدوم";
  const service = createStructuralBlockOperations(source, { anchor: 0, head: 0 });
  const stale = createStructuralBlockOperations("متن دیگر", {
    anchor: 0,
    head: 0,
  }).blockIdAt(0);

  assert.equal(service.insertAfter(stale), null);
  assert.equal(service.duplicate(stale), null);
  assert.equal(service.move(stale, "down"), null);
  assert.equal(service.moveTo(stale, 0), null);
});

test("an active block retains internal blank lines for structural operations", () => {
  const activeText = "خط اول\n\nخط سوم";
  const source = `${activeText}\n\nبلاک بعد`;
  const activeRange = { from: 0, to: activeText.length };
  const caret = source.indexOf("سوم") + 2;
  const service = createStructuralBlockOperations(
    source,
    { anchor: caret, head: caret },
    activeRange,
  );
  const activeId = service.blockIdAt(caret);
  const operation = service.duplicate(activeId);

  assert.equal(
    apply(source, operation),
    `${activeText}\n\n${activeText}\n\nبلاک بعد`,
  );
  assert.deepEqual(operation?.sourceRange, {
    ...activeRange,
    kind: "text",
    lineFrom: 1,
    lineTo: 3,
  });
  assert.equal(
    operation?.selection.anchor - operation!.resultRange.from,
    caret - activeRange.from,
  );
});
