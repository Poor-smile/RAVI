import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_APPEARANCE_PREFERENCES,
  effectiveTheme,
  parseAppearancePreferences,
} from "../app/settings/appearance-preferences";

test("appearance preferences use safe defaults and migrate the legacy theme", () => {
  assert.deepEqual(
    parseAppearancePreferences(null),
    DEFAULT_APPEARANCE_PREFERENCES,
  );
  assert.deepEqual(parseAppearancePreferences(null, "dark"), {
    ...DEFAULT_APPEARANCE_PREFERENCES,
    theme: "dark",
  });
  assert.deepEqual(
    parseAppearancePreferences(
      JSON.stringify({ theme: "light", accent: "forest", motion: "reduced" }),
    ),
    { theme: "light", accent: "forest", motion: "reduced" },
  );
  assert.deepEqual(
    parseAppearancePreferences(
      JSON.stringify({ theme: "neon", accent: "unknown", motion: "fast" }),
      "system",
    ),
    DEFAULT_APPEARANCE_PREFERENCES,
  );
});

test("system theme resolves from the operating-system preference", () => {
  assert.equal(effectiveTheme("system", true), "dark");
  assert.equal(effectiveTheme("system", false), "light");
  assert.equal(effectiveTheme("light", true), "light");
  assert.equal(effectiveTheme("dark", false), "dark");
});
