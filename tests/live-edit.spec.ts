import { expect, test } from "@playwright/test";
import { openWritingDocument } from "./helpers/open-writing-document";

const markdown = [
  "# عنوان فارسی",
  "",
  "پاراگراف **پررنگ** و `code`.",
  "",
  "```ts",
  "const answer = 42;",
  "```",
].join("\n");

async function visibleMarkdown(page: import("@playwright/test").Page) {
  return page.locator("#markdown-editor .cm-line").allTextContents().then((lines) => lines.join("\n"));
}

test.describe("ویرایش روان روی یک منبع Markdown", () => {
  test("switches all three modes without changing the document", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
    await openWritingDocument(page);
    const editor = page.locator("#markdown-editor .cm-content");
    await expect(editor).toBeVisible();

    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    await editor.fill(markdown);
    expect(await visibleMarkdown(page)).toBe(markdown);

    await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
    await expect(page.locator("#markdown-editor .cm-editor")).toHaveAttribute("data-editor-mode", "live");
    await expect(page.locator("#markdown-editor .cm-line").first()).toHaveText("عنوان فارسی");

    await page.getByRole("button", { name: "نمونه‌خوانی دوبرگی", exact: true }).click();
    await expect(page.locator(".editor-pane")).toBeVisible();
    await expect(page.locator(".preview-pane")).toBeVisible();

    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    await expect(page.locator("#markdown-editor .cm-editor")).toHaveAttribute("data-editor-mode", "source");
    expect(await visibleMarkdown(page)).toBe(markdown);
  });

  test("keeps CodeMirror history and Persian input across mode changes", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
    await openWritingDocument(page);
    const editor = page.locator("#markdown-editor .cm-content");
    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    await editor.fill("متن پایه");
    await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
    await editor.focus();
    await page.keyboard.press("End");
    await page.keyboard.insertText(" فارسی");
    await expect(editor).toContainText("متن پایه فارسی");
    await page.keyboard.press("Control+z");
    await expect(editor.locator(".cm-line")).toHaveText(["متن پایه"]);
    await page.keyboard.press("Control+Shift+z");
    await expect(editor).toContainText("متن پایه فارسی");
  });

  test("keeps the cursor and scroll position while the view changes", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
    await openWritingDocument(page);
    const editor = page.locator("#markdown-editor .cm-content");
    const scroller = page.locator("#markdown-editor .cm-scroller");
    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    await editor.fill(
      Array.from({ length: 300 }, (_, index) => `خط ${index + 1} — متن فارسی`).join("\n"),
    );
    await scroller.evaluate((element) => {
      element.scrollTop = 1_200;
    });
    const before = await scroller.evaluate((element) => element.scrollTop);

    await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    const after = await scroller.evaluate((element) => element.scrollTop);
    expect(Math.abs(after - before)).toBeLessThanOrEqual(4);

    await editor.focus();
    await page.keyboard.press("Control+End");
    await page.getByRole("button", { name: "نمونه‌خوانی دوبرگی", exact: true }).click();
    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    await page.keyboard.insertText(" — پایان");
    await expect(editor.locator(".cm-line").last()).toContainText("خط 300 — متن فارسی — پایان");
  });

  test("decorates only the viewport-sized region of a large document", async ({ page }) => {
    const stabilizationWarnings: string[] = [];
    page.on("console", (message) => {
      if (message.text().includes("Viewport failed to stabilize")) {
        stabilizationWarnings.push(message.text());
      }
    });
    await page.goto("/");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
    await openWritingDocument(page);
    const editor = page.locator("#markdown-editor .cm-content");
    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    const largeDocument = Array.from(
      { length: 2_000 },
      (_, index) => `## بخش ${index + 1} — متن فارسی برای سنجش viewport`,
    ).join("\n");
    await editor.fill(largeDocument);
    await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
    const root = page.locator("#markdown-editor .cm-editor");
    await expect(root).toHaveAttribute("data-editor-mode", "live");
    const metrics = await root.evaluate((element) => ({
      document: Number((element as HTMLElement).dataset.livePreviewDocument),
      scanned: Number((element as HTMLElement).dataset.livePreviewScanned),
    }));
    expect(metrics.document).toBeGreaterThan(50_000);
    expect(metrics.scanned).toBeGreaterThan(0);
    expect(metrics.scanned).toBeLessThan(metrics.document / 4);
    await page.locator("#markdown-editor .cm-scroller").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll"));
    });
    await page.waitForTimeout(250);
    expect(stabilizationWarnings).toEqual([]);
  });
});
