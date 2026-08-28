import { expect, test, type Locator } from "@playwright/test";
import { openWritingDocument } from "./helpers/open-writing-document";

async function sourceText(editor: Locator) {
  return (await editor.locator(".cm-line").allTextContents()).join("\n");
}

const ROUNDTRIP_SOURCE = [
  "# مرزهای پایدار",
  "",
  "متن فارسی مستقل",
  "",
  "- مورد اول",
  "  - زیرمورد اول",
  "    1. زیرمورد سطح سوم",
  "      ادامهٔ چندخطی همان آیتم",
  "  - [x] زیرمورد انجام‌شده",
  "- مورد دوم",
  "",
  "> نقل‌قول چندخطی",
  "> خط دوم",
  "",
  "| نام | مقدار |",
  "| --- | --- |",
  "| راوی | ۱۶ |",
  "",
  "```mermaid",
  "graph TD",
  "A[آغاز] --> B[پایان]",
  "```",
  "",
  "$$",
  "x + y = z",
  "$$",
  "",
  "پایان سند",
].join("\n");

test("saving and reopening a Markdown document preserves every block boundary", async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page, { content: "" });

  const editor = page.locator("#markdown-editor .cm-content");
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await editor.fill(ROUNDTRIP_SOURCE);
  await expect.poll(() => sourceText(editor)).toBe(ROUNDTRIP_SOURCE);

  await page.locator('.topbar [data-command-id="file.save"]').click();
  const saveDialog = page.getByRole("dialog", { name: "ذخیره فایل" });
  await expect(saveDialog).toBeVisible();
  await saveDialog.getByRole("radio", { name: /Markdown/u }).check();
  await saveDialog.locator('input[data-editable-kind="saveName"]').fill(
    "editor-kb-boundaries.md",
  );

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    saveDialog.getByRole("button", { name: "ذخیره فایل", exact: true }).click(),
  ]);
  const roundtripPath = testInfo.outputPath("editor-kb-boundaries.md");
  await download.saveAs(roundtripPath);

  await editor.fill("متن موقت که باید با بازکردن فایل جایگزین شود");
  await expect.poll(() => sourceText(editor)).not.toBe(ROUNDTRIP_SOURCE);
  await page
    .locator('input[type="file"][accept*=".md"]:not([multiple])')
    .setInputFiles(roundtripPath);
  const backToDesk = page.getByRole("button", { name: /بازگشت به میز/u });
  await expect(backToDesk).toBeVisible();
  await backToDesk.click();
  const rawMode = page.getByRole("button", { name: "متن خام", exact: true });
  await expect(rawMode).toBeVisible();
  await rawMode.click();

  await expect.poll(() => sourceText(editor)).toBe(ROUNDTRIP_SOURCE);

  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
  await expect(page.locator(".cm-live-heading-1")).toHaveCount(1);
  await expect(page.locator(".cm-live-list-item")).toHaveCount(5);
  await expect(page.locator(".cm-live-quote")).toHaveCount(2);
  await expect(page.locator(".cm-rich-table")).toHaveCount(1);
  await expect(page.locator(".cm-rich-mermaid")).toHaveCount(1);
});
