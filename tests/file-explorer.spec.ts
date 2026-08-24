import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("a 1000-file shelf stays virtualized, searchable and reveals the active dirty file", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), "raavi-tree-"));
  try {
    await mkdir(path.join(fixtureRoot, "English folder"));
    await Promise.all(
      Array.from({ length: 1_000 }, (_, index) => {
        const localized = index.toString().padStart(4, "0");
        const directory = index < 20 ? path.join(fixtureRoot, "English folder") : fixtureRoot;
        return writeFile(
          path.join(directory, `یادداشت ${localized} test.md`),
          `# سند ${localized}\n\nمتن آزمایشی`,
          "utf8",
        );
      }),
    );

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("raavi:sidebar:v1");
      localStorage.removeItem("raavi:file-tree:v1");
    });
    await page.reload();
    await expect(page.locator(".app-shell")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    await page.waitForTimeout(250);
    const directoryInput = page.locator('input[webkitdirectory]');
    const startedAt = Date.now();
    await directoryInput.setInputFiles(fixtureRoot);
    await page.getByRole("button", { name: "کتابخانه", exact: true }).click();
    expect(Date.now() - startedAt).toBeLessThan(15_000);

    const tree = page.getByRole("tree", { name: "کاوشگر فایل‌های محلی" });
    await expect(tree).toBeVisible();
    const root = tree.getByRole("treeitem", { name: path.basename(fixtureRoot) });
    await expect(root).toContainText("۱٬۰۰۰ فایل");
    await root.click();
    await tree.getByRole("treeitem", { name: "یادداشت 0020 test.md" }).click();
    await expect(page.getByRole("region", { name: "پیش‌نمایش Markdown" })).toContainText(
      "سند 0020",
    );
    await expect
      .poll(() => tree.locator(".file-explorer-row").count())
      .toBeLessThan(50);

    await page.getByRole("button", { name: "بازگشت به میز", exact: true }).click();
    await expect(page.locator("#markdown-editor .cm-content")).toBeVisible();
    await page.keyboard.press("Control+P");
    const quickOpen = page.getByRole("dialog", { name: "بازکردن سریع" });
    await expect(quickOpen).toBeVisible();
    await quickOpen.getByRole("combobox", { name: "نام فایل" }).fill("0999");
    await page.keyboard.press("Enter");
    await expect(quickOpen).toBeHidden();
    await expect(page.getByRole("region", { name: "پیش‌نمایش Markdown" })).toContainText(
      "سند 0999",
    );

    await page.getByRole("button", { name: "بازگشت به میز", exact: true }).click();
    await page.getByRole("button", { name: "کتابخانه", exact: true }).click();
    await page.getByRole("button", { name: "جست‌وجو در کتابخانه" }).click();
    await expect(page.locator(".library-search-status")).toContainText(
      "همه‌چیز روی همین دستگاه می‌ماند",
      { timeout: 60_000 },
    );
    const shelfSearch = page.getByRole("searchbox", { name: "جست‌وجو در قفسه" });
    await shelfSearch.fill("سند 0998");
    const searchResult = page.locator(".library-search-results .suggestion-row").filter({
      hasText: "یادداشت 0998 test.md",
    });
    await expect(searchResult).toBeVisible({ timeout: 60_000 });
    await expect(searchResult).toContainText("خط ۱");
    await searchResult.locator(".suggestion-row-main").click();
    await expect(page.getByRole("region", { name: "پیش‌نمایش Markdown" })).toContainText(
      "سند 0998",
    );

    await page.getByRole("button", { name: "بازگشت به میز", exact: true }).click();
    await page.getByRole("button", { name: "کتابخانه", exact: true }).click();
    const activeFile = tree.locator('[role="treeitem"][aria-current="page"]');
    await expect(activeFile).toBeVisible();
    await page.locator("#markdown-editor .cm-content").fill("# ویرایش محلی\n\nمتن تازه");
    await expect(tree.locator(".file-explorer-row.is-active .file-explorer-dirty")).toBeVisible();

    const scrollStart = Date.now();
    await tree.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll"));
    });
    await expect
      .poll(() => tree.locator(".file-explorer-row").count())
      .toBeLessThan(50);
    expect(Date.now() - scrollStart).toBeLessThan(1_500);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
});
