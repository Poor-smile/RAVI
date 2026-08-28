import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_AI_PREFERENCES,
  parseAiPreferences,
} from "../app/settings/ai-preferences";

describe("ChatGPT preferences", () => {
  it("falls back safely for malformed storage", () => {
    assert.deepEqual(parseAiPreferences("not-json"), DEFAULT_AI_PREFERENCES);
  });

  it("keeps and sanitizes the selected account model", () => {
    assert.deepEqual(
      parseAiPreferences(JSON.stringify({ model: "  gpt-5.6-sol\u0000  " })),
      { model: "gpt-5.6-sol" },
    );
  });

  it("migrates the previous Codex model preference", () => {
    assert.deepEqual(
      parseAiPreferences(JSON.stringify({ models: { codex: "  gpt-5.3-codex  " } })),
      { model: "gpt-5.3-codex" },
    );
  });
});
