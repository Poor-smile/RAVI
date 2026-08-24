import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SIDEBAR_PREFERENCES,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  clampSidebarWidth,
  parseSidebarPreferences,
} from "../app/sidebar-state";

test("sidebar width remains inside the spatial-memory contract", () => {
  assert.equal(clampSidebarWidth(120), SIDEBAR_MIN_WIDTH);
  assert.equal(clampSidebarWidth(360.4), 360);
  assert.equal(clampSidebarWidth(900), SIDEBAR_MAX_WIDTH);
  assert.equal(clampSidebarWidth(Number.NaN), DEFAULT_SIDEBAR_PREFERENCES.width);
});

test("sidebar preferences restore valid values and sanitize stale storage", () => {
  assert.deepEqual(
    parseSidebarPreferences('{"view":"outline","width":336,"collapsed":true}'),
    { view: "outline", width: 336, collapsed: true },
  );
  assert.deepEqual(
    parseSidebarPreferences('{"view":"plugins","width":12,"collapsed":"no"}'),
    {
      view: "files",
      width: SIDEBAR_MIN_WIDTH,
      collapsed: true,
    },
  );
  assert.deepEqual(parseSidebarPreferences("broken"), DEFAULT_SIDEBAR_PREFERENCES);
});
