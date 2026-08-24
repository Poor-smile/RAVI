import assert from "node:assert/strict";
import test from "node:test";
import { convertMarkdownBlockToType } from "../app/editor/block-types";
import {
  planMarkdownBlockDuplicate,
  planMarkdownBlockInsertion,
  planMarkdownBlockMove,
  resolveAdjacentMarkdownBlockRange,
  resolveMarkdownBlockRange,
  resolveMarkdownBlockRanges,
  type MarkdownBlockChange,
} from "../app/editor/rich-blocks";

function applyChanges(source: string, changes: MarkdownBlockChange[]) {
  return [...changes]
    .sort((left, right) => right.from - left.from)
    .reduce(
      (markdown, change) =>
        `${markdown.slice(0, change.from)}${change.insert}${markdown.slice(change.to)}`,
      source,
    );
}

test("consecutive RTL lines form one multiline Text Block without consuming headings", () => {
  const source = [
    "متن راست‌به‌چپ",
    "ادامهٔ همان بند",
    "",
    "## تیتر همسایه",
    "",
    "متن بعدی",
  ].join("\n");
  const range = resolveMarkdownBlockRange(source, source.indexOf("ادامه"));

  assert.equal(range.kind, "text");
  assert.equal(
    source.slice(range.from, range.to),
    "متن راست‌به‌چپ\nادامهٔ همان بند",
  );
  assert.equal(range.lineFrom, 1);
  assert.equal(range.lineTo, 2);

  const firstRange = resolveMarkdownBlockRange(source, source.indexOf("راست‌به‌چپ"));
  assert.equal(
    source.slice(firstRange.from, firstRange.to),
    "متن راست‌به‌چپ\nادامهٔ همان بند",
  );
  assert.equal(firstRange.lineFrom, 1);
  assert.equal(firstRange.lineTo, 2);

  const converted = convertMarkdownBlockToType(
    source.slice(firstRange.from, firstRange.to),
    source.indexOf("راست") - firstRange.from,
    "heading-1",
  );
  const result = `${source.slice(0, firstRange.from)}${converted.markdown}${source.slice(firstRange.to)}`;
  assert.equal(
    result,
    ["# متن راست‌به‌چپ", "ادامهٔ همان بند", "", "## تیتر همسایه", "", "متن بعدی"].join("\n"),
  );
});

test("consecutive list items, continuations and nested items form one List Block", () => {
  const source = [
    "قبل",
    "",
    "- مورد یک",
    "  ادامهٔ مورد یک",
    "- [ ] مورد دو",
    "  - زیرمورد",
    "",
    "بعد",
  ].join("\n");
  const range = resolveMarkdownBlockRange(source, source.indexOf("مورد دو"));

  assert.equal(range.kind, "list");
  assert.equal(
    source.slice(range.from, range.to),
    ["- مورد یک", "  ادامهٔ مورد یک", "- [ ] مورد دو", "  - زیرمورد"].join("\n"),
  );
  assert.equal(
    resolveAdjacentMarkdownBlockRange(source, range.from, -1)?.kind,
    "text",
  );
  assert.equal(
    resolveAdjacentMarkdownBlockRange(source, range.from, 1)?.kind,
    "text",
  );
});

test("quote, table, Mermaid, image and formula resolve to their complete ranges", () => {
  const source = [
    "> نقل‌قول",
    "> ادامهٔ نقل‌قول",
    "",
    "| نام | مقدار |",
    "| --- | --- |",
    "| الف | ب |",
    "",
    "```mermaid",
    "flowchart RL",
    "A --> B",
    "```",
    "",
    "![طرح](images/diagram.png)",
    "",
    "$$",
    "x^2 + y^2 = z^2",
    "$$",
  ].join("\n");

  const cases = [
    ["ادامهٔ نقل", "quote", "> نقل‌قول\n> ادامهٔ نقل‌قول"],
    ["الف", "table", "| نام | مقدار |\n| --- | --- |\n| الف | ب |"],
    ["A --> B", "mermaid", "```mermaid\nflowchart RL\nA --> B\n```"],
    ["diagram.png", "image", "![طرح](images/diagram.png)"],
    ["y^2", "formula", "$$\nx^2 + y^2 = z^2\n$$"],
  ] as const;

  for (const [needle, kind, expected] of cases) {
    const range = resolveMarkdownBlockRange(source, source.indexOf(needle));
    assert.equal(range.kind, kind, needle);
    assert.equal(source.slice(range.from, range.to), expected, needle);
  }
});

test("duplicate and insertion plans use the entire active block and preserve both neighbors", () => {
  const source = ["قبل", "", "- یک", "- دو", "", "بعد"].join("\n");
  const duplicate = planMarkdownBlockDuplicate(source, source.indexOf("دو"));
  const duplicated = applyChanges(source, duplicate.changes);
  assert.equal(
    duplicated,
    ["قبل", "", "- یک", "- دو", "", "- یک", "- دو", "", "بعد"].join("\n"),
  );
  assert.equal(source.slice(duplicate.sourceRange.from, duplicate.sourceRange.to), "- یک\n- دو");

  const tableSource = [
    "قبل",
    "",
    "| الف | ب |",
    "| --- | --- |",
    "| ۱ | ۲ |",
    "",
    "بعد",
  ].join("\n");
  const insertion = planMarkdownBlockInsertion(
    tableSource,
    tableSource.indexOf("۱"),
    "> یادداشت تازه",
  );
  assert.equal(
    applyChanges(tableSource, insertion.changes),
    [
      "قبل",
      "",
      "| الف | ب |",
      "| --- | --- |",
      "| ۱ | ۲ |",
      "",
      "> یادداشت تازه",
      "",
      "بعد",
    ].join("\n"),
  );
});

test("reorder moves a complete multiline block and never consumes an adjacent block", () => {
  const mermaid = ["```mermaid", "flowchart RL", "A --> B", "```"].join("\n");
  const source = ["قبل", "", mermaid, "", "بعد"].join("\n");
  const plan = planMarkdownBlockMove(
    source,
    source.indexOf("A --> B"),
    source.indexOf("بعد"),
  );
  assert.ok(plan);
  assert.equal(
    applyChanges(source, plan.changes),
    ["قبل", "", "بعد", "", mermaid].join("\n"),
  );
  assert.equal(source.slice(plan.sourceRange.from, plan.sourceRange.to), mermaid);
});

test("CRLF offsets and adjacent structural blocks remain lossless", () => {
  const source = "عنوان\r\n---\r\n\r\n$$\r\nx + y\r\n$$\r\n\r\nپایان";
  const ranges = resolveMarkdownBlockRanges(source).filter((range) => range.kind !== "blank");
  assert.deepEqual(
    ranges.map((range) => [range.kind, source.slice(range.from, range.to)]),
    [
      ["heading", "عنوان\r\n---"],
      ["formula", "$$\r\nx + y\r\n$$"],
      ["text", "پایان"],
    ],
  );
});
