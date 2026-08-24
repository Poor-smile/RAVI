import assert from "node:assert/strict";
import test from "node:test";
import {
  frozenBlockIsCurrent,
  frozenContextIsCurrent,
  insertionAfterBlock,
} from "../app/ai/apply";
import type { AiFrozenContext } from "../app/ai/types";

const selection: AiFrozenContext = {
  sessionId: "selection-1",
  kind: "selection",
  label: "متن انتخاب‌شده",
  content: "فرمول غلط",
  editor: "main",
  source: "editor",
  from: "متن: فرمول غلط".indexOf("فرمول غلط"),
  to: "متن: فرمول غلط".indexOf("فرمول غلط") + "فرمول غلط".length,
};

test("AI apply refuses a stale frozen range", () => {
  assert.equal(frozenContextIsCurrent(selection, "متن: فرمول غلط"), true);
  assert.equal(frozenContextIsCurrent(selection, "متن: فرمول درست"), false);
});

test("AI insertion keeps Markdown blocks separated", () => {
  assert.deepEqual(insertionAfterBlock("بلاک اول\nبلاک دوم", 8, "پیشنهاد"), {
    from: 8,
    to: 8,
    insert: "\n\nپیشنهاد\n",
  });
  assert.equal(insertionAfterBlock("بلاک اول", 8, "پیشنهاد").insert, "\n\nپیشنهاد");
});

test("AI apply keeps the frozen table cell identity", () => {
  const tableSelection: AiFrozenContext = {
    ...selection,
    sessionId: "table-1",
    source: "table",
    tableKey: "row-1:cell-2",
  };
  assert.equal(
    frozenContextIsCurrent(tableSelection, "", "فرمول غلط", "row-1:cell-2"),
    true,
  );
  assert.equal(
    frozenContextIsCurrent(tableSelection, "", "فرمول غلط", "row-2:cell-2"),
    false,
  );
});

test("AI insertion refuses a block whose non-selected text changed", () => {
  const blockSelection: AiFrozenContext = {
    ...selection,
    sessionId: "block-1",
    blockFrom: 0,
    blockTo: 16,
    blockContent: "متن: فرمول غلط",
  };
  assert.equal(frozenBlockIsCurrent(blockSelection, "متن: فرمول غلط"), true);
  assert.equal(frozenBlockIsCurrent(blockSelection, "شرح: فرمول غلط"), false);
});
