import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Persian Markdown viewer", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /lang="fa"/i);
  assert.match(html, /dir="rtl"/i);
  assert.match(html, /راوی/);
  assert.match(html, /ویور Markdown فارسی/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape/i);
});

test("ships the viewer implementation instead of starter assets", async () => {
  const [page, layout, css, packageJson] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /ReactMarkdown/);
  assert.match(page, /localStorage/);
  assert.match(page, /text\/markdown/);
  assert.match(layout, /lang="fa"/);
  assert.match(layout, /dir="rtl"/);
  assert.match(css, /IRANSansX-Regular\.woff2/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(packageJson, /"react-markdown"/);
  assert.doesNotMatch(
    `${page}\n${layout}\n${css}\n${packageJson}`,
    /SkeletonPreview|react-loading-skeleton|codex-preview/,
  );
});
