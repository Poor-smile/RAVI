import { Buffer } from "node:buffer";
import { expect, type Page, test } from "@playwright/test";

async function openTestDocument(page: Page) {
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page
    .locator('input[type="file"][accept*=".md"]')
    .first()
    .setInputFiles({
      name: "سند-آزمون.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# سند آزمون\n\nیک متن کوتاه برای آزمون فرمان‌ها."),
    });
  await expect(page.getByRole("region", { name: "پیش‌نمایش Markdown" })).toBeVisible();
  await page.getByRole("button", { name: "بازگشت به میز", exact: true }).click();
  await expect(page.locator("#markdown-editor .cm-content")).toBeVisible();
}

test.describe("Persian command palette", () => {
  test("opens from the physical shortcut, searches bilingually, explains disabled commands, and restores focus", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".app-shell")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    const returnTarget = page.getByRole("button", { name: "فایل جدید", exact: true });
    await expect(
      page.getByRole("heading", {
        name: "یک پوشه را به‌عنوان دفتر مرکزی انتخاب کنید",
      }),
    ).toBeVisible();
    await returnTarget.focus();

    await page.keyboard.press("Control+K");
    const palette = page.getByRole("dialog", { name: "مرکز فرمان راوی" });
    const input = palette.getByRole("combobox", { name: "جست‌وجوی فرمان" });
    await expect(palette).toBeVisible();
    await expect(input).toBeFocused();
    await expect(page.locator(".workspace-frame")).toHaveAttribute("inert", "");

    await input.fill("quick open");
    const quickOpen = palette.getByRole("option", { name: /بازکردن سریع از کتابخانه/ });
    await expect(quickOpen).toHaveAttribute("aria-disabled", "true");
    await expect(quickOpen).toContainText("پس از اتصال یک پوشه فعال می‌شود");

    await input.fill("dark");
    const theme = palette.getByRole("option", { name: /تغییر تم روشن و تاریک/ });
    await expect(theme).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(palette).toBeHidden();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(returnTarget).toBeFocused();

    await page.keyboard.press("Control+K");
    await expect(input).toBeFocused();
    await expect(palette.getByRole("option").first()).toContainText(
      "تغییر تم روشن و تاریک",
    );
    await page.keyboard.press("Escape");
    await expect(palette).toBeHidden();
    await expect(returnTarget).toBeFocused();
  });

  test("exposes the same command IDs in header, overflow, editor, and palette", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".app-shell")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    for (const id of ["file.open", "file.new", "view.commandPalette"]) {
      await expect(page.locator(`[data-command-id="${id}"]`).first()).toBeVisible();
    }
    await expect(page.locator('[data-command-id="file.save"]').first()).toBeHidden();
    await expect(page.locator('[data-command-id="view.reading"]').first()).toBeHidden();

    await page.getByRole("button", { name: "بازکردن فرمان‌های بیشتر" }).click();
    await expect(
      page
        .getByRole("menu", { name: "فرمان‌های بیشتر" })
        .locator('[data-command-id="view.commandPalette"]'),
    ).toBeVisible();
    await expect(page.locator('[data-command-id="file.export"]')).toBeVisible();
    await expect(page.locator('[data-command-id="help.about"]')).toBeVisible();
    await page.keyboard.press("Escape");

    await openTestDocument(page);
    await expect(page.locator('[data-command-id="file.save"]').first()).toBeVisible();
    await expect(page.locator('[data-command-id="view.reading"]:visible')).toBeVisible();
    const editor = page.locator("#markdown-editor .cm-content");
    await editor.focus();
    await page.keyboard.press("Control+a");
    await expect(
      page.locator(
        '.editor-selection-mini-menu [data-command-id="edit.bold"]',
      ),
    ).toBeVisible();
    await editor.focus();
    await page.keyboard.press("End");
    await page.keyboard.press("Control+K");
    await expect(page.locator(".command-palette-list [role=option]")).not.toHaveCount(0);
  });

  test("keeps the editor slash surface limited to structural block types", async ({ page }) => {
    await page.goto("/");
    await openTestDocument(page);
    await page
      .getByRole("button", { name: "متن خام", exact: true })
      .click();
    const editor = page.locator("#markdown-editor .cm-content");
    await editor.fill("");
    await page
      .getByRole("button", { name: "ویرایش روان", exact: true })
      .click();
    await editor.focus();
    await page.keyboard.type("/");
    const slashMenu = page.getByRole("menu", { name: "نوع بلوک" });
    await expect(slashMenu).toBeVisible();
    await expect(slashMenu.getByRole("menuitemradio")).toHaveCount(12);
    await expect(slashMenu).toContainText("تیتر ۱");
    await expect(slashMenu).not.toContainText("تغییر تم روشن و تاریک");
  });
});
