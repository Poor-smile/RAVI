import assert from "node:assert/strict";
import test from "node:test";
import { buildReadingDocumentIndex, searchReadingDocument } from "../app/search/reading-document-index";

test("search counts the entire document and pages beyond the old 100-result limit", () => {
  const index = buildReadingDocumentIndex(Array.from({ length: 207 }, (_, i) => `## فصل ${i + 1}\n\nنشانه مشترک ${i + 1}\n`).join("\n"));
  const first = searchReadingDocument(index, "نشانه مشترک");
  assert.equal(first.total, 207);
  assert.equal(first.results.length, 50);
  const last = searchReadingDocument(index, "نشانه مشترک", 4);
  assert.equal(last.total, 207);
  assert.equal(last.results.length, 7);
  assert.equal(last.results.at(-1)?.label, "فصل 207");
});

for (const newline of ["\n", "\r\n"]) {
  test(`search finds a phrase in an unrendered late chunk with ${JSON.stringify(newline)}`, () => {
    const source = Array.from({ length: 45 }, (_, i) => `## فصل ${i + 1}\n\n${"متن زمینه برای خواندن. ".repeat(180)}\n`).join("\n") + "\nعبارت یکتای انتهای سند\n";
    const index = buildReadingDocumentIndex(source.replaceAll("\n", newline));
    const result = searchReadingDocument(index, "عبارت یکتای انتهای سند");
    assert.equal(result.total, 1);
    assert.ok(result.results[0].chunkIndex > 0);
    assert.equal(result.results[0].label, "فصل 45");
  });
}

test("inline formatting and decoded entities are searchable without crossing paragraphs", () => {
  const index = buildReadingDocumentIndex("# فصل\n\nمتن **پررنگ** و [پیوند](https://example.org) &amp; کد `ساده`\n\nجمله اول\n\nجمله دوم\n");
  assert.equal(searchReadingDocument(index, "متن پررنگ و پیوند & کد ساده").total, 1);
  assert.equal(searchReadingDocument(index, "اولجمله").total, 0);
  assert.equal(searchReadingDocument(index, "example.org").total, 0);
});

test("normalization preserves Persian/Arabic matching and repeat identity", () => {
  const index = buildReadingDocumentIndex("## فارسی\n\nكتاب و کتاب و کتاب\n\nHELLO world\n");
  const result = searchReadingDocument(index, "کتاب");
  assert.equal(result.total, 3);
  assert.deepEqual(result.results.map(r => r.occurrence), [0, 1, 2]);
  assert.equal(searchReadingDocument(index, "hello WORLD").total, 1);
  assert.equal(searchReadingDocument(index, "  ").total, 0);
});

test("code, nested lists and table cells in all parts of the source are indexed", () => {
  const index = buildReadingDocumentIndex("# نمونه\n\n- فهرست یکتا\n  - زیرشاخه یکتا\n\n| نام | مقدار |\n| --- | --- |\n| جدول یکتا | داده |\n\n```js\nconst uniqueCode = 1;\n```\n");
  assert.equal(searchReadingDocument(index, "یکتا").total, 3);
  assert.equal(searchReadingDocument(index, "uniqueCode").total, 1);
});
