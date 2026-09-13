import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

const packageMetadata = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { version: string };

for (const width of [1280, 1024]) {
  for (const theme of ["light", "dark"] as const) {
    test(`About opens from the header and overflow at ${width}px in ${theme} mode`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
      await page.locator('input[type="file"][accept*=".md"]').first().setInputFiles({
        name: "سند درباره.md",
        mimeType: "text/markdown",
        buffer: Buffer.from("# سند آزمایشی\n\nاین متن باید پس از بستن درباره باقی بماند.\n"),
      });
      const leaveReading = page.getByRole("button", { name: "بازگشت به میز", exact: true });
      if (await leaveReading.isVisible()) await leaveReading.click();
      await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
      const editor = page.locator("#markdown-editor .cm-content");
      await editor.focus();
      await page.keyboard.press("Control+End");
      await page.keyboard.insertText("\nتغییر ذخیره‌نشده برای بررسی حفظ سند.");
      const editedText = await editor.innerText();
      await page.evaluate((mode) => document.documentElement.setAttribute("data-theme", mode), theme);

      const brand = page.locator(".topbar").getByRole("button", { name: "دربارهٔ راوی", exact: true });
      await expect(brand).toHaveText(/راوی/);
      await expect(brand).toHaveAttribute("aria-haspopup", "dialog");
      await expect(brand).toHaveCSS("cursor", "pointer");
      await expect(brand).toHaveCSS("-webkit-app-region", "no-drag");
      const dialog = page.getByRole("dialog", { name: "دربارهٔ راوی", exact: true });

      await brand.click();
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveCount(1);
      await expect(dialog.locator("#about-modal-title")).toBeFocused();
      await expect(dialog.getByText(packageMetadata.version, { exact: true })).toBeVisible();
      await page.screenshot({ path: testInfo.outputPath("about.png"), animations: "disabled" });
      const currentRelease = dialog.locator("article[aria-current='true']");
      await expect(currentRelease).toContainText(`v${packageMetadata.version}`);
      await expect(currentRelease.getByText(/انتخاب هم‌وزن Word و PDF/)).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(brand).toBeFocused();

      // The same native button must also be operable from the keyboard.
      await page.keyboard.press("Enter");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "بستن دربارهٔ راوی" }).click();
      await expect(brand).toBeFocused();

      const overflow = page.locator(".header-overflow-trigger");
      await overflow.click();
      await page.locator('[data-overflow-action="about"]').click();
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveCount(1);
      await expect(page.locator(".header-overflow-grid")).toBeHidden();
      await expect(dialog.locator("#about-modal-title")).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
      await expect(overflow).toBeFocused();
      await expect(editor).toHaveText(editedText, { useInnerText: true });
    });
  }
}
