import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  countDirectionalLetters,
  detectBlockTextDirection,
  detectDocumentTextDirection,
  LATIN_DIRECTION_THRESHOLD,
} from "../app/markdown/text-direction";
import { splitMarkdownForProgressiveRender } from "../app/markdown/progressive-render";

function mixedLetters(latin: number, arabic: number) {
  return `${"a".repeat(latin)}${"ف".repeat(arabic)}`;
}

test("uses the documented strict 70 percent Latin threshold", () => {
  assert.equal(LATIN_DIRECTION_THRESHOLD, 0.7);
  assert.equal(detectBlockTextDirection(mixedLetters(69, 31)), "rtl");
  assert.equal(detectBlockTextDirection(mixedLetters(70, 30)), "rtl");
  assert.equal(detectBlockTextDirection(mixedLetters(71, 29)), "ltr");
});

test("ignores punctuation, numerals, and emoji when counting direction", () => {
  const neutralNoise = " ۱۲۳۴۵ — !? 🙂 https://example.com `const x = 1` ";
  const value = `${mixedLetters(71, 29)}${neutralNoise}`;

  const counts = countDirectionalLetters(value);
  assert.equal(counts.arabic, 29);
  assert.ok(counts.latin > 71);
  assert.equal(detectBlockTextDirection(value), "ltr");
});

test("keeps a mixed document RTL while allowing Latin-dominant blocks", () => {
  const document = "# راهنمای راوی\n\nA fully Latin paragraph.";

  assert.equal(detectDocumentTextDirection(document), "rtl");
  assert.equal(
    detectBlockTextDirection("A fully Latin paragraph.", "rtl"),
    "ltr",
  );
  assert.equal(detectBlockTextDirection("متن فارسی", "rtl"), "rtl");
});

test("treats a Latin-only document as LTR and empty content as RTL", () => {
  assert.equal(detectDocumentTextDirection("# English note"), "ltr");
  assert.equal(detectDocumentTextDirection("۱۲۳ — 🙂"), "rtl");
  assert.equal(detectBlockTextDirection("", "rtl"), "rtl");
  assert.equal(detectBlockTextDirection("متن فارسی", "ltr"), "ltr");
});

test("keeps the identity corpus byte-for-byte stable across render chunking", async () => {
  const fixturePath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "fixtures",
    "identity-baseline.md",
  );
  const source = await readFile(fixturePath, "utf8");
  const chunks = splitMarkdownForProgressiveRender(source, 80);

  assert.ok(chunks.length > 1);
  assert.equal(chunks.map((chunk) => chunk.content).join(""), source);
  assert.deepEqual(
    chunks.map(({ end, start }) => source.slice(start, end)),
    chunks.map((chunk) => chunk.content),
  );
});
