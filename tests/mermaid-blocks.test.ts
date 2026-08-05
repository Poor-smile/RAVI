import assert from "node:assert/strict";
import test from "node:test";
import {
  findMermaidBlocks,
  mermaidBlockAtOffset,
  insertMermaidBlock,
  makeMermaidFence,
  replaceMermaidBlock,
} from "../app/mermaid/blocks";

test("a Mermaid block does not capture an adjacent fenced code block", () => {
  const markdown = [
    "```mermaid",
    "flowchart LR",
    "  A --> B",
    "```",
    "",
    "```typescript",
    "const value = 1;",
    "```",
  ].join("\n");
  const [block] = findMermaidBlocks(markdown);
  assert.equal(mermaidBlockAtOffset([block], block.startOffset), block);
  assert.equal(mermaidBlockAtOffset([block], block.endOffset + 1), undefined);
});

test("ignores a Mermaid example nested inside a longer Markdown fence", () => {
  const markdown = [
    "````markdown",
    "```mermaid",
    "flowchart LR",
    "  Example --> Only",
    "```",
    "````",
    "",
    "```mermaid",
    "flowchart LR",
    "  Real --> Diagram",
    "```",
  ].join("\n");

  const blocks = findMermaidBlocks(markdown);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].code, "flowchart LR\n  Real --> Diagram");
  assert.equal(blocks[0].startLine, 8);
});

const FLOW = `flowchart LR
  A[شروع] --> B[پایان]`;

test("finds multiple Mermaid fences without changing their source", () => {
  const markdown = [
    "# سند",
    "",
    "```mermaid",
    FLOW,
    "```",
    "",
    "متن میانی",
    "",
    "~~~MERMAID",
    FLOW,
    "~~~~",
    "",
  ].join("\n");
  const blocks = findMermaidBlocks(markdown);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].code, FLOW);
  assert.equal(blocks[1].code, FLOW);
  assert.equal(
    markdown.slice(blocks[0].startOffset, blocks[0].endOffset),
    blocks[0].raw,
  );
  assert.equal(
    markdown.slice(blocks[1].startOffset, blocks[1].endOffset),
    blocks[1].raw,
  );
});

test("inserts a standard fence at the beginning, middle, and end", () => {
  for (const [source, offset] of [
    ["پایان", 0],
    ["پیش\nپس", 4],
    ["شروع", 5],
  ] as const) {
    const result = insertMermaidBlock(source, offset, FLOW);
    assert.equal(findMermaidBlocks(result.content).length, 1);
    assert.equal(result.block.raw.trim(), makeMermaidFence(FLOW));
    assert.equal(result.block.code, FLOW);
  }
});

test("edits only the selected duplicate block", () => {
  const fence = makeMermaidFence(FLOW);
  const markdown = `${fence}\n\nمیان\n\n${fence}`;
  const blocks = findMermaidBlocks(markdown);
  const result = replaceMermaidBlock(
    markdown,
    markdown,
    blocks[1],
    "flowchart TD\n  X --> Y",
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const nextBlocks = findMermaidBlocks(result.content);
  assert.equal(nextBlocks[0].code, FLOW);
  assert.equal(nextBlocks[1].code, "flowchart TD\n  X --> Y");
});

test("accepts unrelated external edits and follows a uniquely moved block", () => {
  const markdown = `عنوان\n\n${makeMermaidFence(FLOW)}\n`;
  const block = findMermaidBlocks(markdown)[0];
  const moved = `متن تازه\n\n${markdown}`;
  const result = replaceMermaidBlock(
    moved,
    markdown,
    block,
    "flowchart RL\n  A --> C",
  );
  assert.equal(result.ok, true);
  if (result.ok) assert.match(result.content, /متن تازه/);
});

test("reports a conflict instead of overwriting an externally changed block", () => {
  const markdown = makeMermaidFence(FLOW);
  const block = findMermaidBlocks(markdown)[0];
  const externallyChanged = makeMermaidFence("flowchart LR\n  A --> Z");
  const result = replaceMermaidBlock(
    externallyChanged,
    markdown,
    block,
    "flowchart RL\n  B --> C",
  );
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.reason, "conflict");
  assert.equal(externallyChanged.includes("A --> Z"), true);
});
