import { expect, test, type Page } from "@playwright/test";
import { openWritingDocument } from "./helpers/open-writing-document";

const FIXTURE = [
  "واژه فارسی پایدار",
  "",
  "متن ترکیبی فارسیEnglish پایان",
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
      for (const line of content.querySelectorAll(".cm-line")) {
        const walker = document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
        const nodes: Text[] = [];
        let text = "";
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          nodes.push(node as Text);
          text += node.textContent ?? "";
        }
        const index = text.indexOf(target);
        if (index < 0) continue;
        const endIndex = index + target.length;
        let consumed = 0;
        let startNode: Text | null = null;
        let endNode: Text | null = null;
        let startOffset = 0;
        let endOffset = 0;
        for (const node of nodes) {
          const length = node.data.length;
          if (!startNode && index <= consumed + length) {
            startNode = node;
            startOffset = Math.max(0, index - consumed);
          }
          if (endIndex <= consumed + length) {
            endNode = node;
            endOffset = Math.max(0, endIndex - consumed);
            break;
          }
          consumed += length;
        }
        if (!startNode || !endNode) continue;
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
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
    {
      fragment: "فارسیEnglish",
      expected: "فارسیEnglish",
      line: "متن ترکیبی فارسیEnglish پایان",
    },
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
    { fragment: "inlineCode", expected: "inlineCode", line: "پایان inlineCode خط" },
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
