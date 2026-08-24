import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_CODE_VIEW_PREFERENCES,
  parseCodeViewPreferences,
} from "../app/editor/code-view-preferences";
import { planMarkdownTableRowInsertion } from "../app/editor/code-view-table";

test("code view preferences use safe defaults and preserve valid choices", () => {
  assert.deepEqual(parseCodeViewPreferences(null), DEFAULT_CODE_VIEW_PREFERENCES);
  assert.deepEqual(parseCodeViewPreferences("not-json"), DEFAULT_CODE_VIEW_PREFERENCES);
  assert.deepEqual(
    parseCodeViewPreferences(
      JSON.stringify({ toolbarVisible: false, lineDirection: "ltr" }),
    ),
    {
      toolbarVisible: false,
      contextualHintsVisible: true,
      lineDirection: "ltr",
    },
  );
  assert.deepEqual(
    parseCodeViewPreferences(
      JSON.stringify({ toolbarVisible: false, lineDirection: "sideways" }),
    ),
    {
      toolbarVisible: false,
      contextualHintsVisible: true,
      lineDirection: "auto",
    },
  );
  assert.deepEqual(
    parseCodeViewPreferences(
      JSON.stringify({
        toolbarVisible: true,
        contextualHintsVisible: false,
        lineDirection: "rtl",
      }),
    ),
    {
      toolbarVisible: true,
      contextualHintsVisible: false,
      lineDirection: "rtl",
    },
  );
});

test("adding a row preserves the table block and positions the caret in its first cell", () => {
  const source = [
    "پیش",
    "",
    "| نام | مقدار |",
    "| --- | --- |",
    "| الف | ۱ |",
    "",
    "پس",
  ].join("\n");
  const from = source.indexOf("| نام");
  const to = source.indexOf("\n\nپس", from) + 2;
  const plan = planMarkdownTableRowInsertion(source, from, to);
  assert.ok(plan);
  const result =
    source.slice(0, plan.from) + plan.insert + source.slice(plan.from);
  assert.equal(
    result,
    [
      "پیش",
      "",
      "| نام | مقدار |",
      "| --- | --- |",
      "| الف | ۱ |",
      "|  |  |",
      "",
      "پس",
    ].join("\n"),
  );
  assert.equal(result.slice(plan.selectionFrom, plan.selectionFrom + 2), " |");
});

test("row insertion rejects non-table blocks", () => {
  assert.equal(planMarkdownTableRowInsertion("متن ساده", 0, 8), null);
});
