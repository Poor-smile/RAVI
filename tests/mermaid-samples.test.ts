import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import {
  findMermaidBlocks,
  insertMermaidBlock,
} from "../app/mermaid/blocks";
import { MERMAID_SAMPLES } from "../app/mermaid/samples";
import {
  MERMAID_LIMITS,
  renderMermaid,
  sanitizeMermaidSvg,
} from "../app/mermaid/renderer";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  DOMParser: dom.window.DOMParser,
  XMLSerializer: dom.window.XMLSerializer,
  Element: dom.window.Element,
  Node: dom.window.Node,
});
const mermaid = (await import("mermaid")).default;

mermaid.initialize({
  startOnLoad: false,
  securityLevel: "strict",
  htmlLabels: false,
  suppressErrorRendering: true,
});

for (const sample of MERMAID_SAMPLES) {
  test(`sample parses and round-trips without changing its source: ${sample.id}`, async () => {
    const result = await mermaid.parse(sample.code, { suppressErrors: false });
    assert.equal(typeof result.diagramType, "string");
    assert.ok(result.diagramType.length > 0);

    const inserted = insertMermaidBlock("", 0, sample.code);
    const [block] = findMermaidBlocks(inserted.content);
    assert.ok(block);
    assert.equal(block.code, sample.code);
  });
}

test("keeps safe Mermaid HTML labels while removing executable content", () => {
  const sanitized = sanitizeMermaidSvg(`
    <svg xmlns="http://www.w3.org/2000/svg">
      <foreignObject x="0" y="0" width="120" height="40">
        <div xmlns="http://www.w3.org/1999/xhtml">
          <p onclick="alert(1)">عنوان<br>امن<script>alert(1)</script></p>
          <img src="https://example.com/tracker.png" />
        </div>
      </foreignObject>
      <defs><path id="safe-shape" d="M0 0h1v1z" /></defs>
      <use href="#safe-shape" />
      <use href="https://example.com/external.svg#shape" />
    </svg>
  `);

  assert.match(sanitized, /foreignObject/u);
  assert.match(sanitized, /عنوان/u);
  assert.match(sanitized, /امن/u);
  assert.match(sanitized, /href="#safe-shape"/u);
  assert.doesNotMatch(sanitized, /script|onclick|<img|example\.com/iu);
});

test("rejects oversized diagrams before loading the renderer", async () => {
  const result = await renderMermaid(
    "A".repeat(MERMAID_LIMITS.characters + 1),
    "light",
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.kind, "limit");
});
