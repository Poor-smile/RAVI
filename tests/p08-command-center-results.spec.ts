import { expect, test } from "@playwright/test";

test("P08 matches the compact Figma command-center results state", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "light");
    const content = "# راهنمای راوی\n\nاین یک سند نمونه برای مرکز فرمان است.";
    window.localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        fileName: "راهنمای راوی.ravi",
        content,
        readerSize: 18,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        activeDocumentPath: "C:\\Raavi\\راهنمای راوی.ravi",
        documentType: "ravi",
        lastSavedSnapshot: content,
        draftId: "p08-command-center",
        viewMode: "desk",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
    const now = Date.now();
    window.localStorage.setItem(
      "raavi:command-usage:v1",
      JSON.stringify({
        "view.reading": { count: 8, lastUsedAt: now },
        "view.editor.proof": { count: 7, lastUsedAt: now - 1 },
        "view.outline": { count: 6, lastUsedAt: now - 2 },
        "view.editor.live": { count: 5, lastUsedAt: now - 3 },
        "file.quickOpen": { count: 4, lastUsedAt: now - 4 },
      }),
    );
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );

  const returnTarget = page
    .locator('[data-command-id="view.commandPalette"]:visible')
    .first();
  await expect(returnTarget).toBeVisible();
  await returnTarget.focus();
  await page.keyboard.press("Control+K");

  const dialog = page.getByRole("dialog", { name: "مرکز فرمان راوی" });
  const input = dialog.getByRole("combobox", { name: "جست‌وجوی فرمان" });
  const rows = dialog.locator(".command-result-row");
  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();
  await expect(dialog.getByRole("heading", { name: "نتیجه‌ها" })).toBeVisible();
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toHaveAttribute("aria-selected", "true");
  await expect(rows.nth(0)).toContainText("حالت مطالعه");
  await expect(rows.nth(1)).toContainText("نمونه‌خوانی دوبرگی");
  await expect(rows.nth(2)).toContainText("ساختار سند");
  await expect(rows.nth(3)).toContainText("ویرایش روان");
  await expect(dialog.locator(".command-result-row svg")).toHaveCount(0);

  const dialogBox = await dialog.boundingBox();
  const backdropBox = await page
    .locator(".command-palette-backdrop")
    .boundingBox();
  const headerBox = await dialog.locator(".command-palette-header").boundingBox();
  const searchBox = await dialog.locator(".command-palette-search").boundingBox();
  const firstRowBox = await rows.first().boundingBox();
  expect(dialogBox).toMatchObject({ x: 340, y: 150, width: 600, height: 520 });
  expect(backdropBox).toMatchObject({ x: 0, y: 92, width: 1280, height: 822 });
  expect(headerBox?.height).toBe(48);
  expect(searchBox).toMatchObject({ x: 360, width: 560, height: 52 });
  expect(firstRowBox?.height).toBe(52);

  const quickOpen = dialog.getByRole("option", {
    name: /بازکردن سریع از کتابخانه/,
  });
  await expect(quickOpen).toHaveAttribute("aria-disabled", "true");
  await expect(quickOpen).toContainText("پس از اتصال یک پوشه فعال می‌شود");
  const footerPositions = await dialog
    .locator(".command-palette-footer > span")
    .evaluateAll((items) =>
      items.map((item) => item.getBoundingClientRect().x),
    );
  expect(footerPositions[0]).toBeLessThan(footerPositions[1]);
  expect(footerPositions[1]).toBeLessThan(footerPositions[2]);
  expect(footerPositions[2]).toBeLessThan(footerPositions[3]);
  await page.screenshot({
    path: ".artifacts/p08-command-center-results.png",
    fullPage: true,
  });

  await page.keyboard.press("End");
  await expect(rows.last()).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(rows.first()).toHaveAttribute("aria-selected", "true");

  await input.fill("dark");
  const theme = dialog.getByRole("option", { name: /تغییر تم روشن و تاریک/ });
  await expect(theme).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(dialog).toBeHidden();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(returnTarget).toBeFocused();

  await page.keyboard.press("Control+K");
  await expect(dialog.locator(".command-palette-footer")).toContainText(
    "سابقه فقط روی همین دستگاه",
  );
  const recordedUsage = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("raavi:command-usage:v1") ?? "{}"),
  );
  expect(recordedUsage["view.theme"]?.count).toBe(1);
  // Reopening has the same focus-ready contract as the first opening.
  await expect(input).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(returnTarget).toBeFocused();
});

test("P08 keeps interactive targets usable on compact viewports", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page.keyboard.press("Control+K");
  const dialog = page.getByRole("dialog", { name: "مرکز فرمان راوی" });
  const close = dialog.getByRole("button", { name: "بستن مرکز فرمان راوی" });
  const closeBox = await close.boundingBox();
  const searchBox = await dialog.locator(".command-palette-search").boundingBox();
  const rowBox = await dialog.locator(".command-result-row").first().boundingBox();
  expect(closeBox?.width).toBeGreaterThanOrEqual(44);
  expect(closeBox?.height).toBeGreaterThanOrEqual(44);
  expect(searchBox?.height).toBeGreaterThanOrEqual(44);
  expect(rowBox?.height).toBeGreaterThanOrEqual(44);
});
