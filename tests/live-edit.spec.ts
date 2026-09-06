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

const mixedCodeMarkdown = [
  "# آزمون بلوک کد",
  "",
  "```text",
  "selectableAlpha beta",
  "عبارتفارسی English",
  "```",
].join("\n");

async function textPoint(
  locator: import("@playwright/test").Locator,
  offset: number,
) {
  return locator.evaluate((element, requestedOffset) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    let remaining = requestedOffset;
    let node = walker.nextNode();
    while (node) {
      const length = node.textContent?.length ?? 0;
      if (remaining <= length) {
        const range = document.createRange();
        const localOffset = Math.min(remaining, length);
        range.setStart(node, localOffset);
        range.collapse(true);
        const rect = range.getBoundingClientRect();
        return {
          x: rect.left || element.getBoundingClientRect().left,
          y: (rect.top || element.getBoundingClientRect().top) +
            Math.max(rect.height, element.getBoundingClientRect().height) / 2,
        };
      }
      remaining -= length;
      node = walker.nextNode();
    }
    const rect = element.getBoundingClientRect();
    return { x: rect.right - 1, y: rect.top + rect.height / 2 };
  }, offset);
}

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

  test("shows editable code with a hover copy action without exposing raw Markdown fences", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
    await openWritingDocument(page);
    const editor = page.locator("#markdown-editor .cm-content");
    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    await editor.fill(markdown);

    await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
    await expect(page.locator("#markdown-editor .cm-editor")).toHaveAttribute(
      "data-editor-mode",
      "live",
    );
    await expect(editor).not.toContainText("```ts");
    await expect(editor).not.toContainText("```");
    await expect(editor).toContainText("const answer = 42;");
    await expect(editor.locator(".cm-live-code-fence")).toHaveCount(2);
    await expect(editor.locator(".cm-c")).toHaveCount(1);
    await expect(editor.locator(".cm-ch")).toHaveText("ts");
    const copyButton = editor.getByRole("button", { name: "کپی کد" });
    await expect(copyButton).toHaveCSS("opacity", "0");
    await editor.locator(".cm-ch").hover();
    await expect(copyButton).toHaveCSS("opacity", "1");
    await page.screenshot({
      path: ".artifacts/live-code-block.png",
      fullPage: false,
    });
    await copyButton.click();
    await expect(editor.getByRole("button", { name: "کپی شد" })).toBeVisible();
    await page.screenshot({
      path: ".artifacts/live-code-block-copy-feedback.png",
      fullPage: false,
    });
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe("const answer = 42;");
    await editor.locator(".cm-line").first().click();
    const codeAppearance = await editor.locator(".cm-c").evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        direction: style.direction,
        fontFamily: style.fontFamily,
        backgroundColor: style.backgroundColor,
      };
    });
    expect(codeAppearance.direction).toBe("ltr");
    expect(codeAppearance.fontFamily).toMatch(/Tahoma/iu);
    expect(codeAppearance.backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
    await expect(editor.locator(".cm-live-inline-code")).toHaveText("code");

    const codeLine = editor.locator(".cm-c");
    await codeLine.click();
    await page.keyboard.press("End");
    await page.keyboard.insertText(" // editable");
    await expect(codeLine).toContainText("const answer = 42; // editable");

    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    await expect(editor).toContainText("```ts");
    await expect(editor).toContainText("const answer = 42; // editable");
  });

  test("keeps code selection, mixed-script editing, feedback, and scroll stable", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
    await openWritingDocument(page);
    const editor = page.locator("#markdown-editor .cm-content");
    const scroller = page.locator("#markdown-editor .cm-scroller");
    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    await editor.fill(mixedCodeMarkdown);
    await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();

    const codeLines = editor.locator(".cm-c");
    const latinLine = codeLines.nth(0);
    const persianLine = codeLines.nth(1);
    await expect(codeLines).toHaveCount(2);
    await expect(persianLine).toHaveCSS("font-family", /Tahoma/iu);
    const initialScroll = await scroller.evaluate((element) => element.scrollTop);

    const dragStart = await textPoint(latinLine, 0);
    const dragEnd = await textPoint(latinLine, "selectableAlpha ".length);
    await page.mouse.move(dragStart.x, dragStart.y);
    await page.mouse.down();
    await page.mouse.move(dragEnd.x + 4, dragEnd.y, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator(".editor-selection-mini-menu")).toHaveCount(0);
    await page.keyboard.press("Control+c");
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText().then((text) => text.trim())))
      .toBe("selectableAlpha");

    const persianPoint = await textPoint(persianLine, 4);
    await page.mouse.dblclick(persianPoint.x, persianPoint.y);
    await expect(page.locator(".editor-selection-mini-menu")).toHaveCount(0);
    await page.keyboard.press("Control+c");
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toBe("عبارتفارسی");
    await page.keyboard.insertText("کد");
    await expect(persianLine).toContainText("کد English");

    const latinPoint = await textPoint(latinLine, 4);
    await page.mouse.click(latinPoint.x, latinPoint.y, {
      clickCount: 3,
      delay: 50,
    });
    await page.keyboard.press("Control+c");
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toMatch(/^selectableAlpha beta\r?\n?$/u);
    const finalScroll = await scroller.evaluate((element) => element.scrollTop);
    expect(Math.abs(finalScroll - initialScroll)).toBeLessThanOrEqual(2);

    const header = editor.locator(".cm-ch");
    await header.hover();
    await editor.getByRole("button", { name: "کپی کد" }).click();
    await expect(editor.getByRole("button", { name: "کپی شد" })).toContainText("کپی شد");
    await expect
      .poll(() =>
        page.evaluate(() =>
          navigator.clipboard.readText().then((text) => text.replace(/\r\n?/gu, "\n")),
        ),
      )
      .toBe("selectableAlpha beta\nکد English");
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
