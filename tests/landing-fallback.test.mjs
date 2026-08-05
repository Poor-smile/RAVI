import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const projectUrl = new URL("../", import.meta.url);

test("keeps the landing Markdown demo usable when landing.md is unavailable", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("landing/index.html", projectUrl), "utf8"),
    readFile(new URL("landing/app.js", projectUrl), "utf8"),
  ]);
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "https://ravi.poorsmile.ir/",
  });
  const { window } = dom;
  window.fetch = async () => {
    throw new Error("landing.md is unavailable");
  };
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
  window.matchMedia = () => ({ matches: false });

  window.eval(script);
  await new Promise((resolve) => window.setTimeout(resolve, 0));

  const source = window.document.querySelector("#markdown-source");
  const preview = window.document.querySelector("#markdown-preview");
  const status = window.document.querySelector("#editor-status");
  const stats = window.document.querySelector("#editor-stats");

  assert.equal(source.disabled, false);
  assert.match(source.value, /Markdown فارسی را ساده شروع کنید/);
  assert.match(preview.textContent, /ویرایش و پیش‌نمایش زنده/);
  assert.match(status.textContent, /نسخهٔ داخلی نمونه نمایش داده شد/);
  assert.match(stats.textContent, /واژه/);

  dom.window.close();
});
