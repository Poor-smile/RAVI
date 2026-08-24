import assert from "node:assert/strict";
import test from "node:test";
import {
  appendGfmTableColumn,
  appendGfmTableRow,
  clearGfmTableCells,
  cycleGfmTableAlignment,
  footnoteReferences,
  parseCallout,
  parseFence,
  parseGfmTable,
  parseMarkdownImage,
  insertGfmTableColumn,
  insertGfmTableRow,
  removeGfmTableColumn,
  removeGfmTableColumns,
  removeGfmTableRow,
  removeGfmTableRows,
  safeLiveImageSource,
  serializeGfmTable,
  splitMarkdownTableRow,
  updateGfmTableCell,
} from "../app/editor/rich-blocks";

test("fenced code stays source-compatible and identifies Mermaid", () => {
  assert.deepEqual(parseFence("```mermaid\nflowchart RL\nA-->B\n```"), {
    language: "mermaid",
    code: "flowchart RL\nA-->B",
    mermaid: true,
  });
  assert.deepEqual(parseFence("~~~~ts extra\nconst x = 1\n~~~~")?.language, "ts");
  assert.equal(parseFence("```ts\nmissing close"), null);
});

test("GFM table parsing preserves escaped pipes and alignment", () => {
  assert.deepEqual(splitMarkdownTableRow("| مسیر `A|B` | الف \\| ب |"), [
    "مسیر `A|B`",
    "الف \\| ب",
  ]);
  const table = parseGfmTable("| نام | مقدار |\n| :--- | ---: |\n| فصل | ۱۲ |");
  assert.deepEqual(table, {
    headers: ["نام", "مقدار"],
    rows: [["فصل", "۱۲"]],
    alignments: ["start", "end"],
  });
});

test("editable GFM tables serialize cell edits, dimensions and alignment", () => {
  const parsed = parseGfmTable(
    "| نام | مقدار |\n| :--- | ---: |\n| فصل | ۱۲ |",
  );
  assert.ok(parsed);

  const edited = updateGfmTableCell(parsed, 0, 0, "فصل | نخست");
  const withRow = appendGfmTableRow(edited);
  const withColumn = appendGfmTableColumn(withRow);
  const centered = cycleGfmTableAlignment(withColumn, 0);

  assert.deepEqual(centered.headers, ["نام", "مقدار", "ستون 3"]);
  assert.deepEqual(centered.rows, [
    ["فصل | نخست", "۱۲", ""],
    ["", "", ""],
  ]);
  assert.deepEqual(centered.alignments, ["center", "end", "start"]);
  assert.equal(
    serializeGfmTable(centered),
    [
      "| نام | مقدار | ستون 3 |",
      "| :---: | ---: | :--- |",
      "| فصل \\| نخست | ۱۲ |  |",
      "|  |  |  |",
    ].join("\n"),
  );
  assert.deepEqual(parseGfmTable(serializeGfmTable(centered)), {
    ...centered,
    rows: [["فصل \\| نخست", "۱۲", ""], ["", "", ""]],
  });
});

test("editable GFM tables remove the targeted row and column without becoming invalid", () => {
  const parsed = parseGfmTable(
    [
      "| نام | مقدار | وضعیت |",
      "| :--- | ---: | :---: |",
      "| فصل | ۱۲ | باز |",
      "| بخش | ۳ | بسته |",
    ].join("\n"),
  );
  assert.ok(parsed);

  const withoutFirstRow = removeGfmTableRow(parsed, 0);
  assert.deepEqual(withoutFirstRow.rows, [["بخش", "۳", "بسته"]]);

  const withoutMiddleColumn = removeGfmTableColumn(withoutFirstRow, 1);
  assert.deepEqual(withoutMiddleColumn, {
    headers: ["نام", "وضعیت"],
    rows: [["بخش", "بسته"]],
    alignments: ["start", "center"],
  });
  assert.ok(parseGfmTable(serializeGfmTable(withoutMiddleColumn)));

  assert.strictEqual(
    removeGfmTableColumn(withoutMiddleColumn, 0),
    withoutMiddleColumn,
    "a valid GFM table keeps at least two columns",
  );
  const withoutRows = removeGfmTableRow(withoutMiddleColumn, 0);
  assert.deepEqual(withoutRows.rows, []);
  assert.strictEqual(removeGfmTableRow(withoutRows, 0), withoutRows);
});

test("table context actions insert beside the selection and edit rectangular ranges", () => {
  const parsed = parseGfmTable(
    [
      "| نام | مقدار | وضعیت |",
      "| :--- | ---: | :---: |",
      "| فصل | ۱۲ | باز |",
      "| بخش | ۳ | بسته |",
    ].join("\n"),
  );
  assert.ok(parsed);

  const withRow = insertGfmTableRow(parsed, 1);
  assert.deepEqual(withRow.rows, [
    ["فصل", "۱۲", "باز"],
    ["", "", ""],
    ["بخش", "۳", "بسته"],
  ]);
  const withColumn = insertGfmTableColumn(withRow, 1);
  assert.deepEqual(withColumn.headers, ["نام", "ستون 2", "مقدار", "وضعیت"]);
  assert.deepEqual(withColumn.rows[0], ["فصل", "", "۱۲", "باز"]);

  const cleared = clearGfmTableCells(withColumn, {
    rowFrom: 0,
    rowTo: 1,
    columnFrom: 0,
    columnTo: 1,
  });
  assert.deepEqual(cleared.rows, [
    ["", "", "۱۲", "باز"],
    ["", "", "", ""],
    ["بخش", "", "۳", "بسته"],
  ]);

  const withoutRows = removeGfmTableRows(cleared, [0, 1]);
  assert.deepEqual(withoutRows.rows, [["بخش", "", "۳", "بسته"]]);
  const withoutColumns = removeGfmTableColumns(withoutRows, [0, 1]);
  assert.deepEqual(withoutColumns.headers, ["مقدار", "وضعیت"]);
  assert.strictEqual(
    removeGfmTableColumns(withoutColumns, [0]),
    withoutColumns,
    "range deletion must keep a valid two-column GFM table",
  );
});

test("image policy blocks active content and keeps portable paths", () => {
  assert.deepEqual(parseMarkdownImage('![طرح](<images/طرح ۱.png> "نمونه")'), {
    alt: "طرح",
    source: "images/طرح ۱.png",
    title: "نمونه",
  });
  assert.equal(safeLiveImageSource("javascript:alert(1)"), null);
  assert.equal(safeLiveImageSource("file:///C:/secret.png"), null);
  assert.equal(safeLiveImageSource("../images/طرح.png"), "../images/طرح.png");
  assert.equal(safeLiveImageSource("https://example.com/a.png"), "https://example.com/a.png");
});

test("callouts and footnotes remain ordinary Markdown", () => {
  assert.deepEqual(parseCallout("> [!WARNING] توجه\n> متن فارسی"), {
    kind: "warning",
    title: "توجه",
    body: "متن فارسی",
  });
  assert.deepEqual(footnoteReferences("ارجاع [^یک].\n\n[^یک]: تعریف"), [
    { id: "یک", from: 6, to: 11, definition: false },
    { id: "یک", from: 14, to: 19, definition: true },
  ]);
});
