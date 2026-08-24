import { expect, test } from "@playwright/test";

const DOCUMENT = [
  "# اصلاح متن فارسی",
  "",
  "اين متن براي بررسي فاصله ها و نویسه‌های فارسی آماده شده است.",
].join("\n");

test("P09 matches the dark local execution state and opens Persian Corrections", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript((content) => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "dark");
    window.localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        fileName: "راهنمای نگارش.md",
        content,
        readerSize: 18,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        activeDocumentPath: "C:\\Raavi\\راهنمای نگارش.md",
        documentType: "markdown",
        lastSavedSnapshot: content,
        draftId: "p09-command-executing",
        viewMode: "desk",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, DOCUMENT);

  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  const returnTarget = page
    .locator('[data-command-id="view.commandPalette"]:visible')
    .first();
  await returnTarget.focus();
  await page.keyboard.press("Control+K");

  const dialog = page.getByRole("dialog", { name: "مرکز فرمان راوی" });
  const input = dialog.getByRole("combobox", { name: "جست‌وجوی فرمان" });
  await input.fill("اصلاحات فارسی");
  const correctionCommand = dialog.getByRole("option", {
    name: /اصلاحات فارسی/,
  });
  await expect(correctionCommand).toBeVisible();
  await page.keyboard.press("Enter");

  const shell = dialog.locator(".command-palette-shell");
  const query = dialog.locator(".command-palette-executing-query");
  const body = dialog.locator(".command-palette-executing-body");
  const status = dialog.getByRole("status");
  await expect(shell).toHaveAttribute("aria-busy", "true");
  await expect(input).toHaveCount(0);
  await expect(query).toContainText("در حال اجرای «اصلاحات فارسی»…");
  await expect(dialog.getByRole("heading", { name: "در حال اجرا" })).toBeVisible();
  await expect(status).toContainText("فرمان در حال اجراست");
  await expect(status).toContainText("پردازش فقط روی همین دستگاه انجام می‌شود");
  await expect(status).toBeFocused();

  const dialogBox = await dialog.boundingBox();
  const queryBox = await query.boundingBox();
  const bodyBox = await body.boundingBox();
  const statusBox = await status.boundingBox();
  expect(dialogBox).toMatchObject({ x: 340, y: 150, width: 600, height: 520 });
  expect(queryBox).toMatchObject({ x: 360, width: 560, height: 52 });
  expect(bodyBox).toMatchObject({ width: 560, height: 342 });
  expect(statusBox).toMatchObject({ width: 420, height: 140 });
  await expect(query).toHaveCSS("background-color", "rgb(32, 46, 80)");

  await page.screenshot({
    path: ".artifacts/p09-command-center-executing.png",
    fullPage: true,
  });

  await expect(dialog).toBeHidden();
  await expect(page.locator("#persian-corrections-panel")).toBeVisible();
  await expect(page.locator("#library-panel")).toContainText("اصلاحات فارسی");
  const usage = await page.evaluate(() =>
    JSON.parse(window.localStorage.getItem("raavi:command-usage:v1") ?? "{}"),
  );
  expect(usage["edit.reviewPersian"]?.count).toBe(1);

  // Running the same command while the destination is already open must keep
  // the P04 panel visible instead of toggling it closed.
  await page.keyboard.press("Control+K");
  await dialog.getByRole("combobox", { name: "جست‌وجوی فرمان" }).fill(
    "اصلاحات فارسی",
  );
  await page.keyboard.press("Enter");
  await expect(dialog.locator(".command-palette-shell")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(dialog).toBeHidden();
  await expect(page.locator("#persian-corrections-panel")).toBeVisible();

  // A dismissed executing instance may finish its command, but its stale
  // timeout must never close a newly opened Command Center.
  await page.keyboard.press("Control+K");
  await dialog.getByRole("combobox", { name: "جست‌وجوی فرمان" }).fill(
    "اصلاحات فارسی",
  );
  await page.keyboard.press("Enter");
  await expect(dialog.locator(".command-palette-shell")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page.keyboard.press("Control+K");
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(800);
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
});
