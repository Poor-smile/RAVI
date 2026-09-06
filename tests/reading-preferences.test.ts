import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_READING_PREFERENCES,
  parseReadingPreferences,
  READING_LINE_HEIGHT,
  READING_TEXT_SIZE_PX,
  READING_TEXT_WIDTH_PX,
} from "../app/settings/reading-preferences";

test("reading preferences use safe local defaults", () => {
  assert.deepEqual(parseReadingPreferences(null), DEFAULT_READING_PREFERENCES);
  assert.deepEqual(parseReadingPreferences("not-json"), DEFAULT_READING_PREFERENCES);
  assert.deepEqual(
    parseReadingPreferences(
      JSON.stringify({
        textSize: "large",
        lineSpacing: "open",
        textWidth: "narrow",
        rememberPosition: false,
        autoHideHeader: false,
        openOutlineOnEnter: true,
        narrationSpeed: 1.25,
        smartNarration: true,
      }),
    ),
    {
      textSize: "large",
      lineSpacing: "open",
      textWidth: "narrow",
      rememberPosition: false,
      autoHideHeader: false,
      openOutlineOnEnter: true,
      narrationSpeed: 1.25,
      smartNarration: true,
    },
  );
});

test("reading preferences reject unknown values without discarding valid ones", () => {
  assert.deepEqual(
    parseReadingPreferences(
      JSON.stringify({
        textSize: "huge",
        lineSpacing: "open",
        textWidth: "column",
        rememberPosition: "yes",
        autoHideHeader: false,
        openOutlineOnEnter: true,
        narrationSpeed: 9,
      }),
    ),
    {
      ...DEFAULT_READING_PREFERENCES,
      lineSpacing: "open",
      autoHideHeader: false,
      openOutlineOnEnter: true,
    },
  );
});

test("reading display tokens map to the approved size, rhythm and measure", () => {
  assert.deepEqual(READING_TEXT_SIZE_PX, { small: 16, normal: 18, large: 20 });
  assert.deepEqual(READING_LINE_HEIGHT, { compact: 1.7, normal: 2, open: 2.25 });
  assert.deepEqual(READING_TEXT_WIDTH_PX, {
    narrow: 640,
    balanced: 760,
    wide: 880,
  });
});
