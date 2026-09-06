import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  inspectClientChunkBudgets,
  readClientChunkBudgets,
} from "../scripts/verify-client-chunk-budgets.mjs";

test("client chunk budgets cover Markdown, Mermaid and Graph", async () => {
  const config = await readClientChunkBudgets();
  assert.deepEqual(Object.keys(config.artifacts).sort(), [
    "graph",
    "markdown",
    "mermaid",
  ]);
  for (const budget of Object.values(config.artifacts)) {
    assert.ok(budget.baselineBytes > 0);
    assert.ok(budget.maxBytes > budget.baselineBytes);
  }
});

test("chunk inspection rejects an oversized production artifact", async () => {
  const config = await readClientChunkBudgets();
  const directory = await mkdtemp(path.join(os.tmpdir(), "raavi-chunk-budget-"));
  try {
    await Promise.all([
      writeFile(path.join(directory, "markdown-code-editor-test.js"), Buffer.alloc(config.artifacts.markdown.maxBytes + 1)),
      writeFile(path.join(directory, "mermaid-studio-test.js"), Buffer.alloc(1)),
      writeFile(path.join(directory, "cytoscape.esm-test.js"), Buffer.alloc(1)),
    ]);
    const results = await inspectClientChunkBudgets(directory);
    assert.equal(results.find((result) => result.id === "markdown")?.status, "over");
    assert.equal(results.find((result) => result.id === "mermaid")?.status, "pass");
    assert.equal(results.find((result) => result.id === "graph")?.status, "pass");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
