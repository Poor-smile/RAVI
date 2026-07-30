import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { MERMAID_SAMPLES } from "../app/mermaid/samples";
import { MERMAID_LIMITS, renderMermaid } from "../app/mermaid/renderer";

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
  suppressErrorRendering: true,
});

for (const sample of MERMAID_SAMPLES) {
  test(`official-style sample parses: ${sample.id}`, async () => {
    const result = await mermaid.parse(sample.code, { suppressErrors: false });
    assert.equal(typeof result.diagramType, "string");
    assert.ok(result.diagramType.length > 0);
  });
}

test("rejects oversized diagrams before loading the renderer", async () => {
  const result = await renderMermaid(
    "A".repeat(MERMAID_LIMITS.characters + 1),
    "light",
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.kind, "limit");
});
