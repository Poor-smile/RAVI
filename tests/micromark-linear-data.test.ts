import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { micromark } from "micromark";
import { gfm, gfmHtml } from "micromark-extension-gfm";
import { linearizeMicromarkData } from "../build/micromark-linear-data-plugin";

const require = createRequire(import.meta.url);
const file = path.join(path.dirname(require.resolve("micromark")), "lib/initialize/text.js");
const source = await readFile(file, "utf8");
const original = await import(pathToFileURL(file).href);
const optimized = await import(`data:text/javascript;base64,${Buffer.from(linearizeMicromarkData(source)).toString("base64")}`);

test("linear event compaction matches the installed resolver on varied token runs", () => {
  let seed = 481;
  for (let trial = 0; trial < 300; trial++) {
    const events = [];
    for (let index = 0; index < 100; index++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const token = { type: seed % 4 ? "data" : "lineEnding", start: { offset: index }, end: { offset: index + 1 } };
      events.push(["enter", token, {}], ["exit", token, {}]);
    }
    const expected = original.resolver.resolveAll(structuredClone(events), {});
    const actual = optimized.resolver.resolveAll(structuredClone(events), {});
    assert.deepEqual(actual, expected);
  }
});

test("optimized Markdown preserves HTML for Persian, GFM, whitespace and inline syntax", () => {
  const parts = ["فارسی و English", "*تأکید* **قوی**", "[پیوند](https://example.com)", "`کد`", "~~حذف~~", "www.example.com", "a@b.example", "&amp; &#160;", "پایان  \nخط", "خط\t\nبعد", "![تصویر](image.png)", "[x][ref]\n\n[ref]: /path", "متن _نیمه", "\\*نشان\\*", "\u200c العربية"];
  const fixtures = ["# عنوان\n\n> نقل قول\n\n- [x] انجام\n- [ ] بعد\n\n| الف | ب |\n|---|---|\n| یک | دو |", "```mermaid\ngraph TD; A-->B\n```\n\n$$\nx+y\n$$", ...parts];
  for (let i = 0; i < 80; i++) fixtures.push(Array.from({ length: 12 }, (_, n) => parts[(i * 7 + n * 3) % parts.length]).join(i % 2 ? "\n" : " "));
  const options = { extensions: [gfm()], htmlExtensions: [gfmHtml()] };
  const expected = fixtures.map(value => micromark(value, options));
  const constructs = ["resolver", "text", "string"];
  const saved = constructs.map(name => original[name].resolveAll);
  try {
    constructs.forEach(name => { original[name].resolveAll = optimized[name].resolveAll; });
    fixtures.forEach((value, index) => assert.equal(micromark(value, options), expected[index], value));
  } finally { constructs.forEach((name, index) => { original[name].resolveAll = saved[index]; }); }
});

test("large token streams compact without shifting the unprocessed suffix", () => {
  const events = [];
  for (let index = 0; index < 100_000; index++) {
    for (const type of ["data", "data", "lineEnding"]) {
      const token = { type, start: { offset: index }, end: { offset: index + 1 } };
      events.push(["enter", token, {}], ["exit", token, {}]);
    }
  }
  Object.defineProperty(events, "splice", { value: () => { throw new Error("Quadratic suffix shifting"); } });
  const output = optimized.resolver.resolveAll(events, {});
  assert.equal(output.length, 400_000);
  assert.equal(output.at(-1)[1].end.offset, 100_000);
  assert.throws(() => linearizeMicromarkData("changed implementation"), /revalidate/);
});
