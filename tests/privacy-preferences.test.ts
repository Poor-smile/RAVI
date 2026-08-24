import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PRIVACY_PREFERENCES,
  parsePrivacyPreferences,
} from "../app/settings/privacy-preferences";

test("privacy preferences use local-first defaults", () => {
  assert.deepEqual(parsePrivacyPreferences(null), DEFAULT_PRIVACY_PREFERENCES);
  assert.deepEqual(parsePrivacyPreferences("not-json"), DEFAULT_PRIVACY_PREFERENCES);
});

test("privacy preferences preserve valid values and reject unknown policies", () => {
  assert.deepEqual(
    parsePrivacyPreferences(
      JSON.stringify({ externalImagePolicy: "allow", warnBeforeExternalLinks: false }),
    ),
    { externalImagePolicy: "allow", warnBeforeExternalLinks: false },
  );
  assert.deepEqual(
    parsePrivacyPreferences(
      JSON.stringify({ externalImagePolicy: "upload", warnBeforeExternalLinks: "yes" }),
    ),
    DEFAULT_PRIVACY_PREFERENCES,
  );
});
