import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_WRITING_COMMANDS,
  filterAiWritingCommands,
  getSuggestedAiWritingCommands,
} from "../app/ai/writing-commands";

test("AI writing catalog contains the approved 47 commands in four groups", () => {
  assert.equal(AI_WRITING_COMMANDS.length, 47);
  assert.deepEqual(
    Object.fromEntries(
      ["selection", "document", "persian", "structured"].map((category) => [
        category,
        AI_WRITING_COMMANDS.filter((item) => item.category === category).length,
      ]),
    ),
    {
      selection: 14,
      document: 13,
      persian: 9,
      structured: 11,
    },
  );
  assert.equal(new Set(AI_WRITING_COMMANDS.map((item) => item.id)).size, 47);
});

test("slash search normalizes Persian and Arabic glyphs", () => {
  assert.ok(
    filterAiWritingCommands("نيم فاصله").some(
      (item) => item.id === "persian.half-space",
    ),
  );
  assert.ok(
    filterAiWritingCommands("جدول").some(
      (item) => item.id === "structured.table",
    ),
  );
  assert.equal(filterAiWritingCommands("فرمان ناموجود").length, 0);
});

test("contextual suggestions stay compact and relevant", () => {
  assert.deepEqual(
    getSuggestedAiWritingCommands("selection").map((item) => item.id),
    [
      "selection.summary",
      "selection.proofread",
      "persian.half-space",
      "structured.table",
    ],
  );
  assert.equal(getSuggestedAiWritingCommands("document").length, 4);
});
