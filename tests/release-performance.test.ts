import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  RELEASE_PERFORMANCE_BUDGETS,
  withinReleaseBudget,
} from "../app/release/performance-budgets";

test("release budgets cover every OBL-12 performance surface", () => {
  assert.deepEqual(Object.keys(RELEASE_PERFORMANCE_BUDGETS).sort(), [
    "imagePlaceholderReadyMs",
    "largeDocumentInputResponseMs",
    "maximumLongTaskMs",
    "mermaidStableRenderMs",
    "startupInteractiveMs",
    "thousandFileShelfReadyMs",
    "virtualTreeResponseMs",
  ]);
});

test("budget checks reject negative, non-finite and over-budget samples", () => {
  assert.equal(withinReleaseBudget("startupInteractiveMs", 2_999), true);
  assert.equal(withinReleaseBudget("startupInteractiveMs", 3_001), false);
  assert.equal(withinReleaseBudget("startupInteractiveMs", Number.NaN), false);
  assert.equal(withinReleaseBudget("startupInteractiveMs", -1), false);
});

test("reduced motion is targeted instead of globally killing every transition", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const reducedMotionBlocks = css.match(
    /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{[\s\S]*?\n\}/gu,
  );
  assert.ok(reducedMotionBlocks?.length);
  assert.doesNotMatch(reducedMotionBlocks!.join("\n"), /\*\s*,\s*\*::before/gu);
  assert.match(reducedMotionBlocks!.join("\n"), /\.theme-transition-overlay/gu);
  assert.match(reducedMotionBlocks!.join("\n"), /\.sidebar-shell/gu);
});
