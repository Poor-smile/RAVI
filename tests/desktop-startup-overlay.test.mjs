import assert from "node:assert/strict";
import test from "node:test";

import {
  STARTUP_RECOVERY_TIMEOUT_MS,
  startupOverlayDataUrl,
  startupOverlayHtml,
} from "../desktop/startup-overlay.mjs";

test("startup overlay is a branded RTL loading surface", () => {
  const html = startupOverlayHtml({
    theme: "dark",
    state: "loading",
    logoDataUrl: "data:image/svg+xml;base64,cmFhdmk=",
  });

  assert.match(html, /<html lang="fa" dir="rtl" data-theme="dark">/);
  assert.match(html, /راوی در حال آماده‌کردن سند است/);
  assert.match(html, /role="status"/);
  assert.match(html, /prefers-reduced-motion/);
  assert.match(html, /raavi-window:\/\/minimize/);
  assert.match(html, /class="brand-icon"/);
  assert.match(html, /data:image\/svg\+xml;base64,cmFhdmk=/);
  assert.doesNotMatch(html, /تلاش دوباره/);
});

test("startup overlay exposes an actionable recovery state", () => {
  const html = startupOverlayHtml({ theme: "light", state: "error" });

  assert.match(html, /role="alert"/);
  assert.match(html, /فایل شما دست‌نخورده مانده است/);
  assert.match(html, /raavi-retry:\/\/reload/);
  assert.ok(STARTUP_RECOVERY_TIMEOUT_MS >= 10_000);
});

test("startup overlay data URL contains the complete document", () => {
  const url = startupOverlayDataUrl({ theme: "light", state: "loading" });
  assert.match(url, /^data:text\/html;charset=utf-8,/);
  assert.match(decodeURIComponent(url.split(",", 2)[1]), /<title>راوی<\/title>/);
});
