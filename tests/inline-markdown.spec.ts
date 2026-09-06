import { expect, test, type Page } from "@playwright/test";
import { openWritingDocument } from "./helpers/open-writing-document";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixture = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "live-edit-inline.fa.md"),
  "utf8",
).replace(/\r\n/gu, "\n");

async function openFixture(page: Page) {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await openWritingDocument(page);
  const editor = page.locator("#markdown-editor .cm-content");
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await editor.fill(fixture);
  await editor.focus();
  await page.keyboard.press("Control+Home");
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
  await expect(page.locator("#markdown-editor .cm-editor")).toHaveAttribute(
    "data-editor-mode",
    "live",
  );
  return editor;
}

async function copiedMarkdown(page: Page) {
  const editor = page.locator("#markdown-editor .cm-content");
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await editor.focus();
  return (await editor.locator(".cm-line").allTextContents()).join("\n");
}

test.describe("Markdown درون‌خطی راوی", () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  });

  test("renders scoped inline syntax and reveals the complete active block", async ({ page }) => {
    const editor = await openFixture(page);
    for (let level = 1; level <= 6; level += 1) {
      await expect(page.locator(`.cm-live-heading-${level}`)).toHaveCount(1);
    }
    await expect(page.locator(".cm-live-strong").first()).toContainText("پررنگ");
    await expect(page.locator(".cm-live-emphasis").first()).toContainText("مورب");
    await expect(page.locator(".cm-live-strike")).toContainText("حذف‌شده");
    await expect(page.locator(".cm-live-highlight")).toHaveText("نشان‌شده");
    await expect(page.locator(".cm-live-inline-code").first()).toContainText("const n = ۱۲");

    const formattedLine = page.locator("#markdown-editor .cm-line").filter({ hasText: "پررنگ" }).first();
    await expect(formattedLine).not.toContainText("**پررنگ**");
    await formattedLine.click();
    await expect(formattedLine).toContainText("**پررنگ**");
    await expect(formattedLine).toContainText("مورب");
    await expect(
      page.locator("#markdown-editor .cm-line").filter({ hasText: "عنوان دو" }),
    ).not.toContainText("## عنوان دو");
    await expect(editor).toBeFocused();
    await page.keyboard.press("Home");
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowLeft");
    await expect(editor).toBeFocused();
  });

  test("edits a readable link and uses safe image/comment placeholders", async ({ page }) => {
    await openFixture(page);
    const link = page.locator(".cm-live-link").filter({ hasText: "راوی" }).first();
    await expect(link).toHaveAttribute("title", "https://ravi.poorsmile.ir/docs?q=فارسی");
    await link.click();
    const popover = page.getByRole("dialog", { name: "ویرایش پیوند" });
    const input = popover.getByRole("textbox", { name: "نشانی" });
    await expect(input).toBeFocused();
    await expect(popover.getByRole("link", { name: "بازکردن پیوند" })).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    await input.fill("https://example.org/new-path");
    await popover.getByRole("button", { name: "ثبت نشانی" }).click();
    await expect(popover).toBeHidden();

    const editor = page.locator("#markdown-editor .cm-content");
    await editor.focus();
    await page.keyboard.press("Control+End");
    await expect(page.getByRole("group", { name: "طرح نمونه" })).toBeVisible();
    await expect(page.getByRole("button", { name: /یادداشت پنهان/u })).toBeVisible();
    await expect(page.getByRole("button", { name: /خط جداکننده/u })).toBeVisible();

    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    expect(await copiedMarkdown(page)).toBe(
      fixture.replace("https://ravi.poorsmile.ir/docs?q=فارسی", "https://example.org/new-path"),
    );
  });

  test("toggles only one task marker in one undo step", async ({ page }) => {
    await openFixture(page);
    const unchecked = page.getByRole("checkbox", {
      name: "علامت‌گذاری به‌عنوان انجام‌شده",
    });
    await expect(unchecked).toHaveCount(1);
    await unchecked.click();
    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    expect(await copiedMarkdown(page)).toBe(fixture.replace("- [ ] کار باز", "- [x] کار باز"));
    await page.keyboard.press("Control+z");
    expect(await copiedMarkdown(page)).toBe(fixture);
  });

  test("keeps source portable across Live, Preview, and rendered copy contract", async ({ page }) => {
    await openFixture(page);
    await expect(page.locator("#editor-copy-contract")).toContainText(
      "کپی در ویرایشگر همیشه Markdown قابل‌حمل را برمی‌دارد",
    );
    expect(await copiedMarkdown(page)).toBe(fixture);

    await page.getByRole("button", { name: "نمونه‌خوانی دوبرگی", exact: true }).click();
    const writingPane = page.locator("#writing-editor");
    await expect(writingPane.locator(".cm-live-highlight")).toHaveText("نشان‌شده");
    await expect(writingPane).not.toContainText("این یادداشت در نتیجه نمایش داده نمی‌شود");
    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    expect(await copiedMarkdown(page)).toBe(fixture);
  });

  test("isolates mixed punctuation, URL, emoji, numbers, and inline code", async ({ page }) => {
    await openFixture(page);
    const quoteLine = page.locator("#markdown-editor .cm-line").filter({ hasText: "نقل‌قول فارسی" });
    const englishLine = page.locator("#markdown-editor .cm-line").filter({ hasText: "English line" });
    await expect(quoteLine).toHaveAttribute("dir", "rtl");
    await expect(englishLine).toHaveAttribute("dir", "ltr");
    await expect(englishLine).toContainText("https://example.com");
    await expect(englishLine).toContainText("🚀");
    await expect(englishLine).toContainText("2026");
    await expect(page.locator(".cm-live-inline-code").last()).toHaveCSS("direction", "ltr");
    await expect(page.locator(".cm-live-list-item")).not.toHaveCount(0);
    await expect(page.locator(".cm-live-quote")).not.toHaveCount(0);
  });
});
