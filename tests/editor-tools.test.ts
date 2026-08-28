import assert from "node:assert/strict";
import test from "node:test";
import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { scoreCommandText } from "../app/commands/command-palette";
import { editorFormattingContext } from "../app/components/markdown-code-editor";
import {
  convertMarkdownBlockToType,
  convertMarkdownLineToBlock,
} from "../app/editor/block-types";
import {
  rankSlashMenuItems,
  slashMenuQueryFromLine,
  SLASH_MENU_ITEMS,
} from "../app/editor/slash-menu";
import { clearInlineFormatting } from "../app/editor/inline-formatting";
import { COMMAND_REGISTRY } from "../app/keyboard/command-registry";

function context(source: string, needle: string) {
  const anchor = source.indexOf(needle);
  assert.notEqual(anchor, -1, `missing selection needle: ${needle}`);
  return editorFormattingContext(
    EditorState.create({
      doc: source,
      selection: { anchor: anchor + Math.max(1, Math.floor(needle.length / 2)) },
      extensions: [markdown()],
    }),
  );
}

test("formatting context comes from Markdown syntax and active block", () => {
  assert.equal(context("## تیتر", "تیتر").block, "heading");
  assert.equal(context("متن **پررنگ**", "پررنگ").bold, true);
  assert.equal(context("متن _مورب_", "مورب").italic, true);
  assert.equal(context("[راوی](https://ravi.example)", "راوی").link, true);
  assert.equal(context("- [ ] کار", "کار").block, "task");
  assert.equal(context("> [!NOTE] یادداشت", "یادداشت").block, "callout");
  assert.equal(context("قبل\n\n---\n\nبعد", "---").block, "divider");
  assert.equal(context("| نام | مقدار |\n| --- | --- |\n| الف | ب |", "الف").block, "table");
});

test("Mermaid remains identifiable from every line inside its fence", () => {
  const source = "```mermaid\ngraph TD\nA-->B\n```";
  assert.equal(context(source, "A-->B").block, "mermaid");
});

test("slash scorer accepts Persian, English and subsequence queries", () => {
  const table = COMMAND_REGISTRY.find((command) => command.id === "edit.table");
  const image = COMMAND_REGISTRY.find((command) => command.id === "edit.image");
  assert.ok(table);
  assert.ok(image);
  assert.ok(scoreCommandText(table, "tbl") > 0);
  assert.ok(scoreCommandText(table, "جدول") > scoreCommandText(table, "tbl"));
  assert.ok(scoreCommandText(image, "image") > 0);
  assert.ok(scoreCommandText(image, "تصویر") > 0);
});

test("slash menu exposes the approved structural block aliases", () => {
  assert.deepEqual(
    SLASH_MENU_ITEMS.map((item) => item.alias),
    [
      "/h1",
      "/h2",
      "/h3",
      "/text",
      "/divider",
      "/todo",
      "/bullet",
      "/number",
      "/quote",
      "/table",
      "/mermaid",
      "/image",
      "/audio",
      "/formula",
    ],
  );
  assert.equal(
    SLASH_MENU_ITEMS.map((item) => String(item.type)).includes("code-block"),
    false,
  );
});

test("slash query requires the beginning of an otherwise empty block", () => {
  assert.equal(slashMenuQueryFromLine("/"), "");
  assert.equal(slashMenuQueryFromLine("/h1"), "h1");
  assert.equal(slashMenuQueryFromLine("/فرمول"), "فرمول");
  assert.equal(slashMenuQueryFromLine(" /h1"), null);
  assert.equal(slashMenuQueryFromLine("متن /h1"), null);
  assert.equal(slashMenuQueryFromLine("/h1 ادامه"), null);
});

test("slash search normalizes Persian and fuzzily ranks English", () => {
  assert.equal(rankSlashMenuItems("تصوير")[0]?.type, "image");
  assert.equal(rankSlashMenuItems("tbl")[0]?.type, "table");
  assert.equal(rankSlashMenuItems("frml")[0]?.type, "formula");
  assert.equal(rankSlashMenuItems("جداکننده")[0]?.type, "divider");
});

test("block type conversion preserves content and the logical cursor", () => {
  const heading = convertMarkdownLineToBlock("- [ ] متن نمونه", 9, "heading-2");
  assert.equal(heading.markdown, "## متن نمونه");
  assert.equal(heading.selectionOffset, 6);

  const paragraph = convertMarkdownLineToBlock("### عنوان", 8, "paragraph");
  assert.equal(paragraph.markdown, "عنوان");
  assert.equal(paragraph.selectionOffset, 4);

  const emptyTask = convertMarkdownLineToBlock("/", 1, "task");
  assert.equal(emptyTask.markdown, "- [ ] ");
  assert.equal(emptyTask.selectionOffset, 6);

  const divider = convertMarkdownLineToBlock("/", 1, "divider");
  assert.equal(divider.markdown, "---");
  assert.equal(divider.selectionOffset, 3);
});

test("code conversion creates a fenced block without placeholder content", () => {
  const code = convertMarkdownLineToBlock("متن", 2, "code-block");
  assert.equal(code.markdown, "```text\nمتن\n```");
  assert.equal(code.selectionOffset, 10);
});

test("formula conversion creates an empty display-math block from slash input", () => {
  const formula = convertMarkdownBlockToType("/", 1, "formula");
  assert.equal(formula.markdown, "$$\n\n$$");
  assert.equal(formula.selectionOffset, 3);

  const paragraph = convertMarkdownBlockToType("$$\nx + y\n$$", 6, "paragraph");
  assert.equal(paragraph.markdown, "x + y");
  assert.equal(paragraph.selectionOffset, 3);
});

test("whole-block conversion removes fences and preserves literal multiline content", () => {
  const source = "```js\nconst value = 1;\n# raw code\n```";
  const cursor = source.indexOf("value") + 3;
  const paragraph = convertMarkdownBlockToType(source, cursor, "paragraph");
  assert.equal(paragraph.markdown, "const value = 1;\n# raw code");
  assert.equal(
    paragraph.markdown[paragraph.selectionOffset],
    source[cursor],
  );
});

test("whole-block code conversion strips list markers across every line", () => {
  const code = convertMarkdownBlockToType("- یک\n- دو", 7, "code-block");
  assert.equal(code.markdown, "```text\nیک\nدو\n```");
});

test("clear formatting removes nested wrappers and adjacent link syntax", () => {
  const nested = "**_<u>راوی</u>_**";
  assert.deepEqual(clearInlineFormatting(nested, 0, nested.length), {
    from: 0,
    to: nested.length,
    insert: "راوی",
    selectionFrom: 0,
    selectionTo: 4,
  });

  const link = "پیش [راوی](https://ravi.example) پس";
  const from = link.indexOf("راوی");
  assert.deepEqual(clearInlineFormatting(link, from, from + 4), {
    from: from - 1,
    to: link.indexOf(" پس"),
    insert: "راوی",
    selectionFrom: from - 1,
    selectionTo: from + 3,
  });
});
