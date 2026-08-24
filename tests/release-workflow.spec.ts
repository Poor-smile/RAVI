import { expect, test, type Page } from "@playwright/test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { RELEASE_PERFORMANCE_BUDGETS } from "../app/release/performance-budgets";

async function openOverflow(page: Page) {
  const trigger = page.locator(".mobile-topbar-menu-trigger");
  await trigger.click();
  await expect(page.locator(".mobile-topbar-menu")).toBeVisible();
}

test("open → search → edit → preview → read → save/export survives interruption", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const shelf = await mkdtemp(path.join(os.tmpdir(), "raavi-release-"));
  await mkdir(path.join(shelf, "English folder"));
  await writeFile(
    path.join(shelf, "سند اصلی.md"),
    "# سند اصلی\n\nمتن آغازین",
    "utf8",
  );
  await writeFile(
    path.join(shelf, "English folder", "بازیابی.md"),
    "# مسیر بازیابی\n\nعبارت قابل جست‌وجو",
    "utf8",
  );

  try {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    // Warm Vite's module graph first. The release budget belongs to Raavi's
    // hydration, not to the development compiler's one-time transformation.
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".app-shell")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    const startedAt = Date.now();
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator(".app-shell")).toBeVisible();
    expect(Date.now() - startedAt).toBeLessThanOrEqual(
      RELEASE_PERFORMANCE_BUDGETS.startupInteractiveMs,
    );
    await expect(page.getByRole("button", { name: "باز کردن فایل" })).toBeVisible();

    await expect(page.locator(".app-shell")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    await page
      .locator('input[type="file"][accept*=".ravi"]:not([multiple])')
      .setInputFiles(path.join(shelf, "سند اصلی.md"));
    await expect(page.locator(".document-identity")).toContainText("سند اصلی.md");
    await expect(page.getByRole("region", { name: "پیش‌نمایش Markdown" })).toBeVisible();
    await page.getByRole("button", { name: "بازگشت به میز", exact: true }).click();

    await page.locator("input[webkitdirectory]").setInputFiles(shelf);
    await openOverflow(page);
    await page
      .locator('.mobile-topbar-menu-grid [data-command-id="view.sidebar"]')
      .click();
    await expect(page.locator("#library-panel")).toBeVisible();
    await page
      .getByRole("button", { name: "جست‌وجو در کتابخانه", exact: true })
      .click();
    await page.getByRole("searchbox", { name: "جست‌وجو در قفسه" }).fill("عبارت قابل جست‌وجو");
    const result = page.locator(".library-search-results .suggestion-row").filter({
      hasText: "بازیابی.md",
    });
    await expect(result).toBeVisible();
    await result.locator(".suggestion-row-main").click();
    await expect(page.getByRole("region", { name: "پیش‌نمایش Markdown" })).toContainText(
      "مسیر بازیابی",
    );

    await expect(page.locator("#library-panel")).toHaveClass(/is-collapsed/u);
    await page.getByRole("button", { name: "بازگشت به میز", exact: true }).click();
    await page.locator('.mobile-tabs [role="tab"]').first().click();
    const editor = page.locator("#markdown-editor .cm-content");
    await editor.fill("# مسیر بازیابی\n\nمتن ویرایش‌شده و پایدار");
    const mobileModeControls = page.locator(".editor-mode-switcher > button:visible");
    const mobileViewTabs = page.locator('.mobile-tabs [role="tab"]:visible');
    await expect(mobileModeControls).toHaveCount(4);
    await expect(mobileViewTabs).toHaveCount(2);
    for (const control of await mobileModeControls.all()) {
      const box = await control.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    for (const tab of await mobileViewTabs.all()) {
      const box = await tab.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    await page.locator('.mobile-tabs [role="tab"]').nth(1).click();
    await expect(page.locator(".markdown-body")).toContainText("متن ویرایش‌شده و پایدار");
    await openOverflow(page);
    await page
      .locator('.mobile-topbar-menu-grid [data-command-id="view.reading"]')
      .click();
    await expect(page.locator(".app-shell")).toHaveClass(/is-reading/u);
    await expect(page.locator(".markdown-body")).toContainText("متن ویرایش‌شده و پایدار");
    await page.getByRole("button", { name: "بازگشت به میز" }).click();

    const saveButton = page.getByRole("button", { name: /ذخیره/u }).first();
    await saveButton.click();
    const saveDialog = page.getByRole("dialog", { name: "ذخیره فایل" });
    await expect(saveDialog).toBeVisible();
    const [saveDownload] = await Promise.all([
      page.waitForEvent("download"),
      saveDialog.getByRole("button", { name: "ذخیره فایل" }).click(),
    ]);
    expect(saveDownload.suggestedFilename()).toMatch(/\.md$/iu);

    await openOverflow(page);
    await page.locator('[data-overflow-action="export"]').click();
    const exportDialog = page.getByRole("dialog", { name: /خروجی/u });
    await expect(exportDialog).toBeVisible();
    const [exportDownload] = await Promise.all([
      page.waitForEvent("download"),
      exportDialog.locator(".export-modal-actions .button--primary").click(),
    ]);
    expect(exportDownload.suggestedFilename()).toMatch(/\.docx$/iu);
    await exportDialog.getByRole("button", { name: "تمام", exact: true }).click();
    await expect(exportDialog).toBeHidden();

    await page.locator('.mobile-tabs [role="tab"]').first().click();
    await editor.fill("# مسیر بازیابی\n\nپیش‌نویس پس از وقفه");
    await page.waitForTimeout(650);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.locator('.mobile-tabs [role="tab"]').first().click();
    await expect(page.locator("#markdown-editor .cm-content")).toContainText(
      "پیش‌نویس پس از وقفه",
    );
    expect(consoleErrors).toEqual([]);
  } finally {
    await rm(shelf, { recursive: true, force: true });
  }
});
