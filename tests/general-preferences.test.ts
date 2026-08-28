import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_GENERAL_PREFERENCES,
  parseGeneralPreferences,
} from "../app/settings/general-preferences";

describe("general preferences", () => {
  it("uses the Figma default and survives malformed storage", () => {
    assert.deepEqual(parseGeneralPreferences(null), DEFAULT_GENERAL_PREFERENCES);
    assert.deepEqual(
      parseGeneralPreferences("not-json"),
      DEFAULT_GENERAL_PREFERENCES,
    );
  });

  it("accepts only supported startup surfaces", () => {
    assert.deepEqual(
      parseGeneralPreferences(JSON.stringify({ startupView: "workspace" })),
      { startupView: "workspace" },
    );
    assert.deepEqual(
      parseGeneralPreferences(JSON.stringify({ startupView: "blank" })),
      { startupView: "blank" },
    );
    assert.deepEqual(
      parseGeneralPreferences(JSON.stringify({ startupView: "unknown" })),
      DEFAULT_GENERAL_PREFERENCES,
    );
  });
});
