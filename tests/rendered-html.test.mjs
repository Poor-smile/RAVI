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
  const [
    page,
    layout,
    css,
    raavi,
    main,
    preload,
    packageJson,
    commandRegistry,
    commandResolver,
    shortcutHelp,
  ] =
    await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/raavi.ts", import.meta.url), "utf8"),
    readFile(new URL("../desktop/main.mjs", import.meta.url), "utf8"),
    readFile(new URL("../desktop/preload.cjs", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(
      new URL("../app/keyboard/command-registry.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/keyboard/command-resolver.ts", import.meta.url),
      "utf8",
    ),
    readFile(
      new URL("../app/components/shortcut-help-dialog.tsx", import.meta.url),
      "utf8",
    ),
  ]);

  assert.match(page, /ReactMarkdown/);
  assert.match(page, /localStorage/);
  assert.match(page, /text\/markdown/);
  assert.match(page, /showDirectoryPicker/);
  assert.match(page, /scanMarkdownDirectory/);
  assert.match(page, /raaviDesktop/);
  assert.match(page, /کتابخانه/);
  assert.match(page, /تصویر خارجی بارگذاری نشد/);
  assert.match(page, /برای اشتراک سند همراه با هایلایت و کامنت/);
  assert.match(page, /\.ravi/);
  assert.match(page, /capturePreviewSelection/);
  assert.match(page, /addAnnotation/);
  assert.match(page, /findAnnotationAtPoint/);
  assert.match(page, /onPointerMove=\{handleAnnotationPointerMove\}/);
  assert.match(page, /onClick=\{handleAnnotationClick\}/);
  assert.match(page, /annotation-hover-preview/);
  assert.match(page, /background: #f8e69d/);
  assert.match(page, /حاشیه‌نویسی/);
  assert.match(page, /CSS[\s\S]*highlights/);
  assert.match(page, /saveCurrentFile/);
  assert.match(page, /saveAsFile/);
  assert.match(page, /فایل‌های اخیر/);
  assert.match(page, /افزودن پوشه/);
  assert.match(page, /role="tablist"/);
  assert.match(page, /library-history-panel/);
  assert.match(page, /library-catalog-panel/);
  assert.match(page, /جمع‌کردن سایدبار/);
  assert.match(page, /قفل کردن اسکرول ادیتور و پیش‌نمایش/);
  assert.match(page, /باز کردن قفل اسکرول هماهنگ/);
  assert.match(page, /فهرست فصل‌های سند/);
  assert.match(page, /جمع‌کردن فهرست فصل‌ها/);
  assert.match(page, /بازکردن فهرست فصل‌ها/);
  assert.match(page, /detectDocumentTextDirection/);
  assert.match(page, /latin \/ directionalLetterCount > 0\.7/);
  assert.match(page, /dir=\{documentTextDirection\}/);
  assert.match(page, /هشدار: ذخیره نشده/);
  assert.match(page, /تاریخچه‌ی نسخه‌ها/);
  assert.match(page, /بازیابی/);
  assert.match(page, /فقط متن ذخیره می‌شود/);
  assert.match(raavi, /RAVI_VERSION = 1/);
  assert.match(raavi, /makeRaaviDocument/);
  assert.match(raavi, /RaaviVersion/);
  assert.match(main, /document:save-ravi/);
  assert.match(main, /document:save-current/);
  assert.match(main, /renderer:ready/);
  assert.match(main, /openInReadingMode: true/);
  assert.match(preload, /saveRaavi/);
  assert.match(preload, /rendererReady/);
  assert.match(page, /<ul className="library-branch">/);
  assert.match(page, /useCommandSystem/);
  assert.match(page, /data-editable-kind="editor"/);
  assert.match(page, /aria-keyshortcuts/);
  assert.match(commandRegistry, /COMMAND_REGISTRY/);
  assert.match(commandRegistry, /code: "KeyS"/);
  assert.match(commandResolver, /event\.code === binding\.code/);
  assert.match(commandResolver, /event\.isComposing/);
  assert.match(shortcutHelp, /صفحه‌کلید فارسی/);
  assert.match(shortcutHelp, /CommandShortcutKeys/);
  assert.match(layout, /lang="fa"/);
  assert.match(layout, /dir="rtl"/);
  assert.match(css, /IRANSansX-Regular\.woff2/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /\.annotation-hover-preview/);
  assert.match(css, /\.markdown-body\.has-annotation-hover/);
  assert.match(css, /\.save-modal/);
  assert.match(css, /height: 100dvh/);
  assert.match(packageJson, /"react-markdown"/);
  assert.match(packageJson, /"desktop:pack"/);
  assert.match(packageJson, /"fileAssociations"/);
  assert.match(packageJson, /"ext": "ravi"/);
  assert.match(packageJson, /"perMachine":\s*true/);
  assert.doesNotMatch(
    `${page}\n${layout}\n${css}\n${packageJson}`,
    /SkeletonPreview|react-loading-skeleton|codex-preview/,
  );
});
