import assert from "node:assert/strict";
import test from "node:test";
import { calculateMermaidFitScale } from "../app/mermaid/use-mermaid-viewport";

test("fits wide and tall diagrams completely inside the available canvas", () => {
  assert.equal(
    calculateMermaidFitScale({
      availableWidth: 800,
      availableHeight: 600,
      contentWidth: 1600,
      contentHeight: 400,
    }),
    0.5,
  );
  assert.equal(
    calculateMermaidFitScale({
      availableWidth: 800,
      availableHeight: 600,
      contentWidth: 500,
      contentHeight: 1500,
    }),
    0.4,
  );
});

test("does not enlarge a small diagram and keeps extreme diagrams recoverable", () => {
  assert.equal(
    calculateMermaidFitScale({
      availableWidth: 1200,
      availableHeight: 800,
      contentWidth: 600,
      contentHeight: 400,
    }),
    1,
  );
  assert.equal(
    calculateMermaidFitScale({
      availableWidth: 500,
      availableHeight: 500,
      contentWidth: 20_000,
      contentHeight: 20_000,
    }),
    0.05,
  );
});
