import assert from "node:assert/strict";
import test from "node:test";
import { analyzeDocument, analyzePersianMarkdown, countDocumentWords } from "../app/performance/document-analysis";
import { matchesSavedContent, parseSavedContent } from "../app/performance/saved-content";
import { detectDocumentTextDirection, countDirectionalLetters } from "../app/markdown/text-direction";
import { resolveMarkdownBlockRange, resolveMarkdownBlockRanges, markdownBlockRangesInView } from "../app/editor/rich-blocks";
import { buildDocumentSession, parseDocumentSession, serializeDocumentSession } from "../app/workspace/document-session";

test("fast document direction preserves Unicode script/letter semantics", () => {
  const samples = ["", "۱۲۳ 123 !🙂", "Hello", "مرحبا", "English\nفارسی", "\u064b", "\u061c", "é", "𞸀", "a".repeat(200000) + "ف"];
  for (const text of samples) {
    const count = countDirectionalLetters(text);
    for (const fallback of ["rtl", "ltr"] as const) assert.equal(detectDocumentTextDirection(text, fallback), count.arabic ? "rtl" : count.latin ? "ltr" : fallback);
  }
});

test("word count and review retain Persian, Markdown, fences and CRLF behavior", () => {
  assert.equal(countDocumentWords("# سلام دنیا\n- [x] می‌روم به [خانه](https://x.test)"), 5);
  const source = "#عنوان\r\nمي رود  \r\n\r\n\r\n```\r\nكي می رود  \r\n```";
  const counts = Object.fromEntries(analyzePersianMarkdown(source).map(row => [row.id, row.count]));
  assert.equal(counts["heading-spacing"], 1);
  assert.equal(counts["arabic-characters"], 1);
  assert.equal(counts["trailing-space"], 1);
  assert.equal(counts["blank-lines"], 1);
  assert.equal(analyzeDocument(source).lines, 7);
});

test("dirty comparison remains exact for undo, comments, images and invalid snapshots", () => {
  const value = { content: "متن\r\n", annotations: [{ id: "a", text: "نظر" }], assets: [{ id: "i", data: "bytes" }] };
  const saved = parseSavedContent(JSON.stringify(value));
  const metadata = JSON.stringify({ annotations: value.annotations, assets: value.assets });
  assert.equal(matchesSavedContent(saved, value.content, metadata), true);
  assert.equal(matchesSavedContent(saved, value.content + "تازه", metadata), false);
  assert.equal(matchesSavedContent(saved, value.content, metadata.replace("نظر", "تغییر")), false);
  assert.equal(matchesSavedContent(saved, value.content, metadata.replace("bytes", "other")), false);
  assert.equal(matchesSavedContent(saved, value.content, metadata), true);
  assert.equal(matchesSavedContent(parseSavedContent("broken"), value.content, metadata), false);
});

test("cached structural ranges preserve edits, line endings and callers cannot corrupt them", () => {
  for (const newline of ['\n', '\r\n', '\r']) {
    const source = ['# عنوان', '', 'متن', '', '```js', 'const a = 1;', '```', ''].join(newline);
    const first = resolveMarkdownBlockRanges(source);
    const expected = first.map(x => ({ ...x }));
    first[0].from = 999;
    assert.deepEqual(resolveMarkdownBlockRanges(source), expected);
    const position = source.indexOf('const');
    assert.equal(resolveMarkdownBlockRange(source, position).kind, 'code');
    assert.ok(markdownBlockRangesInView(source, [{ from: position, to: position }]).every(x => x.kind === 'code'));
    assert.equal(resolveMarkdownBlockRange(source + 'پایان', source.length + 1).kind, 'text');
  }
});

test("structured sessions retain legacy JSON compatibility and all unsaved tab data", () => {
  const tabs = [{ id: 'draft:one', title: 'فارسی', path: '', draftId: 'one', dirty: true, pinned: false, snapshot: { content: 'آخرین تغییر' } }];
  const valid = (value: unknown): value is { content: string } => typeof (value as { content?: unknown })?.content === 'string';
  assert.deepEqual(parseDocumentSession(buildDocumentSession(tabs[0].id, tabs), valid), parseDocumentSession(serializeDocumentSession(tabs[0].id, tabs), valid));
  assert.equal(parseDocumentSession(buildDocumentSession(tabs[0].id, tabs), valid)?.tabs[0].snapshot.content, 'آخرین تغییر');
});
