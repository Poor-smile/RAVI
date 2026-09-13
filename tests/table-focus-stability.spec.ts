import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";

const document = "| ردیف | توضیحات |\n| --- | --- |\n| ۱ | متن فارسی |\n| ۲ | نمونه دوم |\n\nپایان سند\n";

for (const mode of ["live", "proof"] as const) {
  test(`table presentation survives external focus and theme changes in ${mode}`, async ({ page }, info) => {
    await page.goto("/");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
    await page.locator('input[type=file][accept*=".md"]').first().setInputFiles({ name: "جدول.md", mimeType: "text/markdown", buffer: Buffer.from(document) });
    await page.getByRole("button", { name: "بازگشت به میز", exact: true }).click();
    await page.getByRole("button", { name: mode === "live" ? "ویرایش روان" : "نمونه‌خوانی دوبرگی", exact: true }).click();
    const host = page.locator(mode === "live" ? "#markdown-editor" : "#writing-editor");
    const table = host.locator(".cm-rich-table");
    await expect(table).toBeVisible();
    const cell = table.locator('textarea[data-table-row="0"][data-table-column="1"]');
    await cell.click();
    const geometry = await table.boundingBox();
    const element = await table.elementHandle();
    const activeCell = await table.getAttribute("data-active-cell");
    for (let round = 0; round < 2; round++) {
      await page.getByRole("button", { name: /فعال‌کردن تم (تاریک|روشن)/ }).first().click();
      await expect(table).toBeVisible();
      await expect.poll(() => element!.evaluate(node => node.isConnected)).toBe(true);
      await expect(table).toHaveAttribute("data-active-cell", activeCell!);
      const next = await table.boundingBox();
      expect(Math.abs(next!.height - geometry!.height)).toBeLessThan(2);
      await page.locator('.document-tab[aria-selected="true"], [role=tab][aria-selected="true"]').first().click();
      await expect(table).toBeVisible();
      await cell.click();
      await expect(cell).toBeFocused();
    }
    await page.screenshot({ path: info.outputPath("stable-table.png"), animations: "disabled" });
    await cell.fill("متن ویرایش‌شده");
    await page.getByRole("button", { name: /فعال‌کردن تم (تاریک|روشن)/ }).first().click();
    await expect(table).toBeVisible();
    await expect(cell).toHaveValue("متن ویرایش‌شده");
    await expect.poll(() => element!.evaluate(node => node.isConnected)).toBe(true);
    await page.getByRole("button", { name: "واگرد آخرین تغییر", exact: true }).click();
    await expect(cell).toHaveValue("متن فارسی");
    await page.getByRole("button", { name: "انجام دوبارهٔ تغییر", exact: true }).click();
    await expect(cell).toHaveValue("متن ویرایش‌شده");
    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    await expect(page.locator("#markdown-editor .cm-content")).toContainText("متن ویرایش‌شده");
  });
}

test("table source is explicit, survives blur, and returns to the grid with Escape", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.locator('input[type=file][accept*=".md"]').first().setInputFiles({ name: "بدون تغییر.md", mimeType: "text/markdown", buffer: Buffer.from(document) });
  await page.getByRole("button", { name: "بازگشت به میز", exact: true }).click();
  const table = page.locator("#markdown-editor .cm-rich-table");
  await expect(table).toBeVisible();
  await table.locator('textarea[data-table-row="0"][data-table-column="1"]').click();
  await page.getByRole("button", { name: /فعال‌کردن تم (تاریک|روشن)/ }).first().click();
  await expect(table).toBeVisible();
  await table.getByRole("button", { name: "گزینه‌های جدول", exact: true }).click();
  await table.getByRole("menuitem", { name: "ویرایش متن Markdown", exact: true }).click();
  await expect(table).toHaveCount(0);
  const editor = page.locator("#markdown-editor .cm-content");
  await expect(editor).toContainText("| --- | --- |");
  await page.getByRole("button", { name: /فعال‌کردن تم (تاریک|روشن)/ }).first().click();
  await expect(table).toHaveCount(0);
  await editor.focus();
  await page.keyboard.press("Escape");
  await expect(table).toBeVisible();
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  expect((await editor.locator(".cm-line").allTextContents()).join("\n")).toBe(document);
});
