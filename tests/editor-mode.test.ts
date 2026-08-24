import assert from "node:assert/strict";
import test from "node:test";
import {
  effectiveEditorMode,
  liveEditFeatureEnabled,
  parseSingleEditorMode,
} from "../app/editor/mode";
import { safelyBuildLiveDecorations } from "../app/editor/live-preview";

test("editor mode storage migrates invalid and legacy values safely", () => {
  assert.equal(parseSingleEditorMode("source"), "source");
  assert.equal(parseSingleEditorMode("live"), "live");
  assert.equal(parseSingleEditorMode("split"), "live");
  assert.equal(parseSingleEditorMode(null), "live");
});

test("proof mode is derived from any preview-bearing pane layout", () => {
  assert.equal(effectiveEditorMode({ paneMode: "editor", singleMode: "live" }), "live");
  assert.equal(effectiveEditorMode({ paneMode: "editor", singleMode: "source" }), "source");
  assert.equal(effectiveEditorMode({ paneMode: "split", singleMode: "live" }), "proof");
  assert.equal(effectiveEditorMode({ paneMode: "preview", singleMode: "source" }), "proof");
});

test("live edit feature flag is opt-out and recognizes deployment values", () => {
  assert.equal(liveEditFeatureEnabled(undefined), true);
  for (const value of ["0", "false", "OFF", " disabled "]) {
    assert.equal(liveEditFeatureEnabled(value), false, value);
  }
});

test("decoration failure returns an inert fallback without touching source", () => {
  const source = "# فارسی\n\n**متن**";
  const fallback = { decorations: "none", source };
  let reported: unknown;
  const result = safelyBuildLiveDecorations(
    () => {
      throw new Error("parser failed");
    },
    fallback,
    (failure) => {
      reported = failure;
    },
  );
  assert.equal(result, fallback);
  assert.match((reported as { message: string }).message, /parser failed/u);
  assert.equal(result.source, source);
});
