import { expect, test, type Page } from "@playwright/test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

async function openFileSettings(page: Page) {
  await page.locator(".header-overflow-trigger").click();
  await page.locator('[data-overflow-action="shortcut-settings"]').click();
  await page
    .getByRole("navigation", { name: "دسته‌های تنظیمات" })
    .getByRole("button", { name: "فایل‌ها و دفتر" })
    .click();
}

test("P17 Files & Library is persistent and drives the local library", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const fixtureBase = await mkdtemp(path.join(os.tmpdir(), "raavi-p17-"));
  const libraryRoot = path.join(fixtureBase, "کتابخانه آزمون");
  try {
    await mkdir(libraryRoot, { recursive: true });
    await writeFile(path.join(libraryRoot, "یادداشت.md"), "# یادداشت", "utf8");
    await writeFile(
      path.join(libraryRoot, "پروژه.ravi"),
      JSON.stringify({
        format: "ravi",
        version: 1,
        document: {
          name: "پروژه.md",
          markdown: "# پروژه راوی",
          revision: 1,
        },
        annotations: [],
        versions: [],
        assets: [],
        updatedAt: new Date(0).toISOString(),
      }),
      "utf8",
    );

    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto("/");
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
    await page.locator("input[webkitdirectory]").setInputFiles(libraryRoot);
    await openFileSettings(page);

    const dialog = page.getByRole("dialog", { name: "فایل‌ها و دفتر" });
    await expect(dialog.locator(".file-library-settings-section")).toHaveCount(3);
    await expect(dialog.getByRole("radiogroup")).toHaveCount(2);
    await expect(dialog.getByRole("switch", { name: "به‌روزرسانی خودکار" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(dialog.getByRole("list", { name: "پوشه‌های متصل" })).toContainText(
      "کتابخانه آزمون",
    );
    await expect(dialog.getByRole("list", { name: "پوشه‌های متصل" })).toContainText(
      "فقط تا بستن این صفحه",
    );

    const geometry = await dialog.evaluate((node) => {
      const size = (element: Element) => {
        const rect = element.getBoundingClientRect();
        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      };
      return {
        surface: size(node.querySelector(".file-library-settings")!),
        firstRow: size(node.querySelector(".settings-preference-row")!),
        segments: Array.from(
          node.querySelectorAll(".settings-segmented-control"),
          size,
        ),
      };
    });
    expect(geometry.surface.width).toBe(1040);
    expect(geometry.firstRow).toEqual({ width: 1008, height: 88 });
    expect(geometry.segments).toEqual([
      { width: 270, height: 40 },
      { width: 270, height: 40 },
    ]);

    await dialog
      .getByRole("radiogroup", { name: "نمایش در کتابخانه" })
      .getByRole("radio", { name: "Raavi" })
      .click();
    await dialog.getByRole("switch", { name: "به‌روزرسانی خودکار" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          JSON.parse(localStorage.getItem("raavi:file-library-preferences:v1") ?? "{}"),
        ),
      )
      .toEqual({
        defaultOpenMode: "reading",
        fileVisibility: "ravi",
        autoRefresh: false,
        activeWorkspaceRootId: "fallback:کتابخانه آزمون",
        restoreDocumentTabs: true,
      });

    await dialog.getByRole("button", { name: "بازگشت به سند" }).click();
    await page.getByRole("button", { name: "کتابخانه", exact: true }).click();
    const tree = page.getByRole("tree", { name: "کاوشگر فایل‌های محلی" });
    await tree.getByRole("treeitem", { name: "کتابخانه آزمون" }).click();
    await expect(tree.getByRole("treeitem", { name: "پروژه.ravi" })).toBeVisible();
    await expect(tree.getByRole("treeitem", { name: "یادداشت.md" })).toHaveCount(0);
    await tree.getByRole("treeitem", { name: "پروژه.ravi" }).click();
    await expect(page.locator(".app-shell")).toHaveClass(/is-reading/);

    await page.getByRole("button", { name: "بازگشت به میز" }).click();
    await openFileSettings(page);
    const disconnectTrigger = dialog.getByRole("button", { name: "قطع اتصال" });
    await disconnectTrigger.click();
    const confirmation = dialog.getByRole("group", {
      name: "قطع اتصال کتابخانه آزمون",
    });
    await expect(
      confirmation.getByRole("button", { name: "قطع اتصال" }),
    ).toBeFocused();
    await confirmation.getByRole("button", { name: "انصراف" }).click();
    await expect(disconnectTrigger).toBeFocused();
    await disconnectTrigger.click();
    await confirmation.getByRole("button", { name: "قطع اتصال" }).click();
    await expect(dialog.getByText("هنوز پوشه‌ای متصل نیست")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "افزودن پوشه" })).toBeFocused();
    await expect(page.locator(".toast")).toContainText("هیچ فایلی حذف نشد");
    await page.screenshot({ path: ".artifacts/p17-settings-files-library.png" });
  } finally {
    await rm(fixtureBase, { recursive: true, force: true });
  }
});

test("P17 Files & Library remains touch-safe and overflow-free", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await openFileSettings(page);

  const contract = await page.evaluate(() => ({
    heights: Array.from(
      document.querySelectorAll<HTMLElement>(
        ".file-library-settings button, .file-library-settings [role=radio]",
      ),
      (target) => Math.round(target.getBoundingClientRect().height),
    ),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(contract.overflow).toBeLessThanOrEqual(0);
  for (const height of contract.heights) expect(height).toBeGreaterThanOrEqual(44);
});
