import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { JSDOM } from "jsdom";

const projectUrl = new URL("../", import.meta.url);

test("keeps the single-screen landing usable without WebGL", async () => {
  const [html, script] = await Promise.all([
    readFile(new URL("landing/index.html", projectUrl), "utf8"),
    readFile(new URL("landing/app.js", projectUrl), "utf8"),
  ]);
  const dom = new JSDOM(html, {
    runScripts: "outside-only",
    url: "https://ravi.poorsmile.ir/",
  });
  const { window } = dom;
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 16);
  window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
  window.matchMedia = () => ({ matches: false });
  window.Math.random = () => 0;

  window.eval(script);
  await new Promise((resolve) => window.setTimeout(resolve, 20));

  const experience = window.document.querySelector("[data-experience]");
  const info = window.document.querySelector("[data-info-window]");
  const theme = window.document.querySelector("[data-theme-switch]");
  const logo = window.document.querySelector("[data-raavi-logo]");

  assert.equal(experience.classList.contains("is-webgl-fallback"), true);
  assert.equal(theme.getAttribute("aria-checked"), "false");
  theme.click();
  assert.equal(theme.getAttribute("aria-checked"), "true");
  assert.equal(info.classList.contains("is-dark"), true);

  logo.click();
  assert.equal(info.classList.contains("is-minimized"), true);
  for (let click = 0; click < 5; click += 1) logo.click();
  assert.equal(window.document.querySelectorAll(".feature-token").length, 5);
  assert.equal(window.document.querySelectorAll(".support-token").length, 1);

  dom.window.close();
});
