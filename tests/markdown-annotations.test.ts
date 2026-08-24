import assert from "node:assert/strict";
import test from "node:test";
import {
  readMarkdownAnnotations,
  reconnectMarkdownAnnotations,
  stripMarkdownAnnotations,
  writeMarkdownAnnotations,
} from "../app/markdown/annotations";
import type { RaaviAnnotation } from "../app/raavi";

const source = "# عنوان\n\nاین تصمیم در مرحلهٔ بعد اجرا می‌شود.\n";
const start = source.indexOf("این تصمیم");
const annotation: RaaviAnnotation = {
  id: "smart-1",
  kind: "comment",
  start,
  end: start + "این تصمیم در مرحلهٔ بعد اجرا می‌شود.".length,
  quote: "این تصمیم در مرحلهٔ بعد اجرا می‌شود.",
  prefix: source.slice(Math.max(0, start - 20), start),
  suffix: "",
  body: "مرحلهٔ بعد مشخص نیست.",
  createdAt: "2026-08-23T00:00:00.000Z",
  source: "raavi-ai",
  category: "ابهام",
  suggestion: "این تصمیم پس از تأیید مدیر محصول اجرا می‌شود.",
  confidence: 0.88,
  status: "open",
};

test("Markdown annotations round-trip without changing visible text", () => {
  const saved = writeMarkdownAnnotations(source, [annotation]);
  assert.match(saved, /<!-- raavi:annotations:v1/u);
  const opened = readMarkdownAnnotations(saved);
  assert.equal(opened.hadBlock, true);
  assert.equal(opened.invalidBlock, false);
  assert.equal(opened.annotations.length, 1);
  assert.equal(opened.annotations[0].suggestion, annotation.suggestion);
  assert.equal(stripMarkdownAnnotations(saved), source.trimEnd());
});

test("annotation reconnects after unrelated text is inserted before it", () => {
  const changed = `مقدمهٔ تازه\n\n${source}`;
  const [reconnected] = reconnectMarkdownAnnotations(changed, [annotation]);
  assert.notEqual(reconnected.status, "detached");
  assert.equal(changed.slice(reconnected.start, reconnected.end), annotation.quote);
});

test("ambiguous annotation is detached instead of guessed", () => {
  const ambiguous = `${annotation.quote}\n\n${annotation.quote}`;
  const [reconnected] = reconnectMarkdownAnnotations(ambiguous, [
    { ...annotation, start: 999, end: 1000, prefix: "", suffix: "" },
  ]);
  assert.equal(reconnected.status, "detached");
});
