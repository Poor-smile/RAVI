import { expect, test, type Page } from "@playwright/test";
import { openWritingDocument } from "./helpers/open-writing-document";

const FIXTURE = [
  "واژه فارسی پایدار",
  "",
  "English stable word",
  "",
  "https://example.com/path?q=1",
  "",
  "[reference](https://docs.example.org/guide)",
  "",
  "پایان `inlineCode` خط",
].join("\n");

async function selectedText(page: Page) {
  return page.evaluate(() => window.getSelection()?.toString() ?? "");
}

async function doubleClickFragment(page: Page, fragment: string) {
  const point = await page.locator("#markdown-editor .cm-content").evaluate(
    (content, target) => {
      const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const index = node.textContent?.indexOf(target) ?? -1;
        if (index < 0) continue;
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + target.length);
        const rect = range.getBoundingClientRect();
        return {
          x: rect.left + Math.max(2, rect.width / 2),
          y: rect.top + Math.max(2, rect.height / 2),
        };
      }
      throw new Error(`Fragment not found: ${target}`);
    },
    fragment,
  );
  await page.mouse.dblclick(point.x, point.y, { delay: 70 });
}

test("double-click keeps RTL, LTR, URL and Inline Code selections in their source blocks", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page);

  const editor = page.locator("#markdown-editor .cm-content");
  const toolbar = page.getByRole("toolbar", {
    name: "قالب‌بندی متن انتخاب‌شده",
  });
  await editor.fill(FIXTURE);

  const cases = [
    { fragment: "فارسی", expected: "فارسی", line: "واژه فارسی پایدار" },
    { fragment: "stable", expected: "stable", line: "English stable word" },
    {
      fragment: "example",
      expected: "example",
      line: "https://example.com/path?q=1",
    },
    {
      fragment: "reference",
      expected: "reference",
      line: "[reference](https://docs.example.org/guide)",
    },
    { fragment: "inlineCode", expected: "inlineCode", line: "پایان `inlineCode` خط" },
  ];

  for (const item of cases) {
    await doubleClickFragment(page, item.fragment);
    await expect.poll(() => selectedText(page)).toBe(item.expected);
    await expect(editor).toBeFocused();
    await expect(page.locator("#markdown-editor .cm-activeLine")).toContainText(
      item.line,
    );

    const selectionBeforeToolbar = await selectedText(page);
    await expect(toolbar).toBeVisible();
    await expect.poll(() => selectedText(page)).toBe(selectionBeforeToolbar);
    await expect(editor).toBeFocused();
  }
});
