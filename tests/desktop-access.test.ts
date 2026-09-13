import assert from "node:assert/strict";
import { test } from "node:test";
import { isMobileWebDevice } from "../app/platform/desktop-access";

test("phones and tablets are blocked, including iPad desktop user agents", () => {
  for (const userAgent of ["iPhone", "iPad", "Android", "Android Mobile", "Silk/3", "Kindle", "Windows Phone Mobile"]) {
    assert.equal(isMobileWebDevice({ userAgent }), true, userAgent);
  }
  assert.equal(isMobileWebDevice({ userAgent: "Mozilla/5.0 Macintosh Safari", platform: "MacIntel", maxTouchPoints: 5 }), true);
  assert.equal(isMobileWebDevice({ userAgent: "unknown", userAgentData: { mobile: true } }), true);
});

test("desktop touchscreens and native desktop remain allowed", () => {
  for (const platform of ["Win32", "Linux x86_64", "MacIntel"]) {
    assert.equal(isMobileWebDevice({ userAgent: "Desktop Chrome", platform, maxTouchPoints: platform === "MacIntel" ? 0 : 10 }), false);
  }
  assert.equal(isMobileWebDevice({ userAgent: "Android" }, true), false);
  assert.equal(isMobileWebDevice({ userAgent: "Macintosh Safari", platform: "MacIntel", maxTouchPoints: 1 }), false);
});
