import assert from "node:assert/strict";
import test from "node:test";
import { contextualShortcutsFor } from "../app/editor/contextual-shortcuts";

test("empty blocks expose creation and block-menu shortcuts", () => {
  assert.deepEqual(
    contextualShortcutsFor({ blockKind: "blank", platform: "windows" })
      .slice(0, 2),
    [
      { keys: "Ctrl+Enter", label: "بلاک جدید" },
      { keys: "/", label: "فهرست بلاک‌ها" },
    ],
  );
});

test("list blocks expose item, nesting and explicit block boundaries", () => {
  const hints = contextualShortcutsFor({
    blockKind: "list",
    platform: "mac",
  });
  assert.ok(hints.some((hint) => hint.keys === "Enter"));
  assert.ok(hints.some((hint) => hint.keys === "Shift+Enter"));
  assert.ok(hints.some((hint) => hint.keys === "Tab / Shift+Tab"));
  assert.ok(hints.some((hint) => hint.keys === "Cmd+Enter"));
});

test("table blocks expose only table-valid navigation and selection hints", () => {
  assert.deepEqual(
    contextualShortcutsFor({ blockKind: "table", platform: "windows" }),
    [
      { keys: "Ctrl+A", label: "انتخاب محتوای سلول" },
      { keys: "Tab / Shift+Tab", label: "حرکت افقی" },
      { keys: "↑ / ↓", label: "حرکت عمودی؛ خروج در مرز" },
      { keys: "← / →", label: "حرکت افقی در مرز متن" },
      { keys: "Shift+جهت‌ها", label: "انتخاب محدوده" },
      { keys: "Ctrl+Enter", label: "بلاک جدید" },
    ],
  );
});

test("structural selection replaces editing hints with selection actions", () => {
  assert.deepEqual(
    contextualShortcutsFor({
      blockKind: "text",
      platform: "windows",
      structuralSelection: true,
    }),
    [
      { keys: "Esc", label: "لغو انتخاب بلاک" },
      { keys: "Ctrl+D", label: "تکثیر بلاک" },
      { keys: "Alt+↑/↓", label: "جابه‌جایی بلاک" },
    ],
  );
});

test("rendered non-table blocks expose only their valid document-level action", () => {
  assert.deepEqual(
    contextualShortcutsFor({
      blockKind: "quote",
      platform: "windows",
      rendered: true,
    }),
    [{ keys: "Ctrl+Enter", label: "بلاک جدید" }],
  );
});
