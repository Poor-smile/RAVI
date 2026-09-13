import { expect, test, type Page } from "@playwright/test";

async function openShortcutSettings(page: Page) {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page.locator(".header-overflow-trigger").click();
  await page.locator('[data-overflow-action="shortcut-settings"]').click();
  await page
    .getByRole("navigation", { name: "دسته‌های تنظیمات" })
    .getByRole("button", { name: "میان‌برها" })
    .click();
}

test("P19 lists the complete active catalog with search and real keycaps", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "light");
  });
  await openShortcutSettings(page);

  const dialog = page.getByRole("dialog", { name: "میان‌برها" });
  await expect(
    dialog.getByRole("heading", { name: "میان‌برهای صفحه‌کلید" }),
  ).toBeVisible();
  await expect(dialog.locator(".shortcut-settings-autosave")).toHaveCount(0);

  const search = dialog.getByRole("searchbox", {
    name: "جست‌وجوی میان‌برها",
  });
  const summary = dialog.locator(".settings-shortcut-summary");
  await expect(search).toBeVisible();
  const totalCount = Number(await summary.getAttribute("data-total-count"));
  expect(totalCount).toBeGreaterThan(45);
  await expect(dialog.locator("[data-settings-shortcut-id]")).toHaveCount(
    totalCount,
  );
  expect(await dialog.locator(".settings-shortcut-section").count()).toBeGreaterThan(5);

  const saveRow = dialog.locator('[data-settings-shortcut-id="file.save"]');
  await expect(saveRow).toContainText("ذخیره");
  await expect(saveRow.locator("kbd")).toHaveText(["Ctrl", "S"]);
  await expect(
    dialog.locator('[data-settings-shortcut-id="block-insert-after"] kbd'),
  ).toHaveText(["Ctrl", "Enter"]);
  await expect(
    dialog.locator('[data-settings-shortcut-id="block-reorder"] kbd'),
  ).toHaveText(["Alt", "↑", "Alt", "↓"]);
  const dividerRow = dialog.locator(
    '[data-settings-shortcut-id="edit.divider"]',
  );
  await expect(dividerRow).toContainText("درج جداکننده");
  await expect(dividerRow.locator("kbd")).toHaveText(["Alt", "Shift", "H"]);
  const codeBlockRow = dialog.locator(
    '[data-settings-shortcut-id="edit.codeBlock"]',
  );
  await expect(codeBlockRow).toContainText("درج بلوک کد");
  await expect(codeBlockRow.locator("kbd")).toHaveText([
    "Alt",
    "Shift",
    "C",
  ]);
  await search.fill("بلوک کد");
  await expect(codeBlockRow).toBeVisible();
  await search.fill("");
  await search.fill("جداکننده");
  await expect(dividerRow).toBeVisible();
  await page.screenshot({
    path: ".artifacts/divider-shortcut-settings.png",
    fullPage: false,
  });
  await search.fill("");

  await search.fill("ذخیره");
  await expect(saveRow).toBeVisible();
  const persianResultCount = Number(
    await summary.getAttribute("data-visible-count"),
  );
  expect(persianResultCount).toBeGreaterThan(0);
  expect(persianResultCount).toBeLessThan(totalCount);

  await search.fill("Ctrl+S");
  await expect(saveRow).toBeVisible();
  await expect(
    dialog.locator('[data-settings-shortcut-id="file.saveAs"]'),
  ).toBeVisible();

  await search.fill("فرمان-ناموجود-راوی");
  await expect(dialog.getByText("میان‌بری پیدا نشد", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "نمایش همهٔ میان‌برها" }).click();
  await expect(search).toHaveValue("");
  await expect(dialog.locator("[data-settings-shortcut-id]")).toHaveCount(
    totalCount,
  );

  const geometry = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>(
      ".shortcut-settings-content",
    )!;
    const firstRow = document.querySelector<HTMLElement>(
      ".settings-shortcut-section li",
    )!;
    const copy = firstRow.querySelector<HTMLElement>(
      ".settings-shortcut-copy",
    )!;
    const keys = firstRow.querySelector<HTMLElement>(
      ".settings-shortcut-keycaps",
    )!;
    const toolbar = document.querySelector<HTMLElement>(
      ".settings-shortcut-toolbar",
    )!;
    return {
      rowHeight: Math.round(firstRow.getBoundingClientRect().height),
      keycapsArePhysicallyLeft:
        keys.getBoundingClientRect().right <= copy.getBoundingClientRect().left,
      horizontalOverflow: content.scrollWidth - content.clientWidth,
      toolbarPosition: getComputedStyle(toolbar).position,
      keycapElements: firstRow.querySelectorAll("kbd").length,
    };
  });
  expect(geometry.rowHeight).toBeGreaterThanOrEqual(60);
  expect(geometry.keycapsArePhysicallyLeft).toBe(true);
  expect(geometry.horizontalOverflow).toBeLessThanOrEqual(0);
  expect(geometry.toolbarPosition).toBe("sticky");
  expect(geometry.keycapElements).toBeGreaterThan(0);

  await page.screenshot({
    path: ".artifacts/p19-settings-shortcuts-desktop.png",
    fullPage: false,
  });
});

test("P19 formats macOS keycaps and keeps the full catalog responsive", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 844 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      get: () => "MacIntel",
    });
    Object.defineProperty(navigator, "userAgentData", {
      configurable: true,
      get: () => ({ platform: "macOS" }),
    });
  });
  await openShortcutSettings(page);

  const dialog = page.getByRole("dialog", { name: "میان‌برها" });
  const search = dialog.getByRole("searchbox", {
    name: "جست‌وجوی میان‌برها",
  });
  await expect(
    dialog.locator('[data-settings-shortcut-id="block-insert-after"] kbd'),
  ).toHaveText(["⌘", "Enter"]);
  await expect(
    dialog.locator('[data-settings-shortcut-id="block-reorder"] kbd'),
  ).toHaveText(["Option", "↑", "Option", "↓"]);

  await search.fill("⌘ S");
  await expect(
    dialog.locator('[data-settings-shortcut-id="file.save"]'),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "پاک‌کردن جست‌وجوی میان‌برها" })
    .click();

  const lastShortcut = dialog.locator('[data-settings-shortcut-id="layer.dismiss"]');
  await lastShortcut.scrollIntoViewIfNeeded();
  await expect(lastShortcut).toBeVisible();

  const compact = await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>(
      ".settings-shortcut-search input",
    )!;
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>(".settings-shortcut-section li"),
    );
    return {
      pageOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      contentOverflow:
        document.querySelector<HTMLElement>(".shortcut-settings-content")!
          .scrollWidth -
        document.querySelector<HTMLElement>(".shortcut-settings-content")!
          .clientWidth,
      inputHeight: Math.round(input.getBoundingClientRect().height),
      rowsStacked: rows.every((row) =>
        getComputedStyle(row).gridTemplateColumns.split(" ").length === 1,
      ),
    };
  });
  expect(compact.pageOverflow).toBeLessThanOrEqual(0);
  expect(compact.contentOverflow).toBeLessThanOrEqual(0);
  expect(compact.inputHeight).toBeGreaterThanOrEqual(42);
  expect(compact.rowsStacked).toBe(false);

  await dialog.locator(".shortcut-settings-content").evaluate((element) => {
    element.scrollTop = 0;
  });
  await page.screenshot({
    path: ".artifacts/p19-settings-shortcuts-compact.png",
    fullPage: false,
  });
});
