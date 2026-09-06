import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { closestSemanticOffset, findPreviewHeading } from "../app/context/semantic-anchor";

test("semantic anchor resolves an exact Markdown source offset", () => {
  assert.equal(closestSemanticOffset([0, 24, 80, 144], 80), 80);
});

test("semantic anchor resolves the nearest structural block", () => {
  assert.equal(closestSemanticOffset([0, 24, 80, 144], 70), 80);
  assert.equal(closestSemanticOffset([0, 24, 80, 144], 30), 24);
});

test("semantic anchor prefers the preceding block when distances tie", () => {
  assert.equal(closestSemanticOffset([0, 40, 80], 60), 40);
});

test("semantic anchor safely handles an empty document index", () => {
  assert.equal(closestSemanticOffset([], 120), null);
});

test("outline destinations use document offsets across progressive Markdown chunks", () => {
  const dom = new JSDOM(`<article>
    <section data-source-start="0"><h2 data-source-offset="24">First chapter</h2></section>
    <section data-source-start="1000"><h2 data-source-offset="24">Second chapter</h2><h3 data-source-offset="64">Details</h3></section>
  </article>`);
  try {
    const article = dom.window.document.querySelector("article")!;
    assert.equal(findPreviewHeading(article, { level: 2, offset: 24 })?.textContent, "First chapter");
    assert.equal(findPreviewHeading(article, { level: 2, offset: 1024 })?.textContent, "Second chapter");
    assert.equal(findPreviewHeading(article, { level: 3, offset: 1064 })?.textContent, "Details");
    assert.equal(findPreviewHeading(article, { level: 2, offset: 1064 }), null);
    assert.equal(findPreviewHeading(article, { level: 2, offset: 4000 }), null);
  } finally { dom.window.close(); }
});
