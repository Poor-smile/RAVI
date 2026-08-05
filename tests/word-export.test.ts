import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import {
  createWordExport,
  wordExportFileName,
} from "../app/export/word";
import { extractWordFrontmatter } from "../app/export/frontmatter";

test("creates an editable RTL Word document from mixed Markdown", async () => {
  const result = await createWordExport({
    markdown: [
      "# گزارش فارسی",
      "",
      "این یک متن **پررنگ** با [پیوند](https://example.com) است.",
      "",
      "- مورد نخست",
      "- مورد دوم",
      "",
      "| عنوان | مقدار |",
      "| --- | --- |",
      "| نمونه | ۱۲۳ |",
      "",
      "> نقل‌قول فارسی",
      "",
      "```ts",
      "const answer = 42;",
      "```",
    ].join("\n"),
    fileName: "گزارش.md",
    imageAssets: [],
  });

  assert.equal(result.warnings.length, 0);
  assert.ok(result.bytes.byteLength > 2_000);
  assert.deepEqual(
    Array.from(new Uint8Array(result.bytes.slice(0, 2))),
    [0x50, 0x4b],
  );

  const archive = await JSZip.loadAsync(result.bytes);
  const documentXml = await archive.file("word/document.xml")!.async("string");
  const stylesXml = await archive.file("word/styles.xml")!.async("string");

  assert.match(documentXml, /گزارش فارسی/u);
  assert.match(documentXml, /<w:bidi\/>/u);
  assert.match(documentXml, /<w:tbl>/u);
  assert.match(documentXml, /<w:hyperlink/u);
  assert.match(stylesXml, /IRANSansX/u);
});

test("normalizes a Word export file name", () => {
  assert.equal(wordExportFileName("  پیش‌نویس.ravi  "), "پیش‌نویس.docx");
  assert.equal(wordExportFileName(""), "نوشته-راوی.docx");
});

test("writes A4 page size and margins as numeric twips", async () => {
  const result = await createWordExport({
    markdown: "# صفحهٔ A4\n\nمتن نمونه",
    fileName: "a4.md",
    imageAssets: [],
  });
  const archive = await JSZip.loadAsync(result.bytes);
  const documentXml = await archive.file("word/document.xml")!.async("string");
  const pageSize = documentXml.match(/<w:pgSz\b[^>]*\/>/u)?.[0] ?? "";
  const pageMargin = documentXml.match(/<w:pgMar\b[^>]*\/>/u)?.[0] ?? "";

  assert.match(pageSize, /w:w="11906"/u);
  assert.match(pageSize, /w:h="16838"/u);
  assert.match(pageMargin, /w:top="1020"/u);
  assert.match(pageMargin, /w:right="1020"/u);
  assert.match(pageMargin, /w:bottom="1020"/u);
  assert.match(pageMargin, /w:left="1020"/u);
  assert.doesNotMatch(`${pageSize}${pageMargin}`, /(?:cm|mm|in)/iu);
});

test("moves YAML frontmatter into Word document properties", async () => {
  const result = await createWordExport({
    markdown: [
      "---",
      "title: «آزمایشگاه نهایی Markdown و Mermaid»",
      "description: «سند آزمون خروجی»",
      "author:",
      "  name: «تیم آزمون راوی»",
      "  role: «مهندسی کیفیت»",
      "lang: fa-IR",
      "dir: rtl",
      "version: 1.0.0",
      "date: 2026-08-03",
      "tags: [markdown, mermaid, rtl]",
      "features:",
      "  diagrams: true",
      "---",
      "",
      "# محتوای واقعی سند",
      "",
      "این متن باید در Word دیده شود.",
    ].join("\n"),
    fileName: "آزمایش.md",
    imageAssets: [],
  });

  const archive = await JSZip.loadAsync(result.bytes);
  const documentXml = await archive.file("word/document.xml")!.async("string");
  const coreXml = await archive.file("docProps/core.xml")!.async("string");
  const customXml = await archive.file("docProps/custom.xml")!.async("string");

  assert.doesNotMatch(documentXml, /title:/u);
  assert.doesNotMatch(documentXml, /تیم آزمون راوی/u);
  assert.doesNotMatch(documentXml, /w:val="Heading2"/u);
  assert.match(documentXml, /محتوای واقعی سند/u);
  assert.match(coreXml, /آزمایشگاه نهایی Markdown و Mermaid/u);
  assert.match(coreXml, /سند آزمون خروجی/u);
  assert.match(coreXml, /تیم آزمون راوی/u);
  assert.match(coreXml, /markdown, mermaid, rtl/u);
  assert.match(customXml, /Raavi\.author\.role/u);
  assert.match(customXml, /مهندسی کیفیت/u);
  assert.match(customXml, /Raavi\.lang/u);
  assert.match(customXml, /fa-IR/u);
  assert.match(customXml, /Raavi\.features\.diagrams/u);
  assert.match(customXml, />true</u);
});

test("keeps an unterminated frontmatter-like block in the document body", () => {
  const markdown = ["---", "title: نمونه", "# متن"].join("\n");
  const extracted = extractWordFrontmatter(markdown);

  assert.equal(extracted.markdown, markdown);
  assert.deepEqual(extracted.properties.customProperties, []);
});

test("preserves invalid YAML as a raw custom property", () => {
  const extracted = extractWordFrontmatter(
    ["---", "title: [بسته نشده", "---", "# متن"].join("\n"),
  );

  assert.equal(extracted.markdown, "# متن");
  assert.deepEqual(extracted.properties.customProperties, [
    { name: "Raavi.Frontmatter", value: "title: [بسته نشده" },
  ]);
});
