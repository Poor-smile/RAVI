import { Buffer } from "node:buffer";
import { expect, test, type Page } from "@playwright/test";

const REVIEW_MARKDOWN = [
  "# راهنمای نگارش",
  "",
  "![تصویر محلی](raavi-image://missing-asset)",
  "",
  "<aside>یادداشت خروجی</aside>",
].join("\n");

async function openDocument(page: Page, markdown = REVIEW_MARKDOWN) {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page
    .locator('input[type="file"][accept*=".md"]')
    .first()
    .setInputFiles({
      name: "راهنمای نگارش.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(markdown),
    });
  const leaveReading = page.getByRole("button", {
    name: "بازگشت به میز",
    exact: true,
  });
  if (await leaveReading.isVisible()) await leaveReading.click();
}

async function openExport(page: Page) {
  const trigger = page.locator(".header-overflow-trigger");
  await trigger.click();
  await page.locator('[data-overflow-action="export"]').click();
  return trigger;
}

async function installSuccessfulDesktopExport(page: Page, delay = 700) {
  await page.evaluate((saveDelay) => {
    const browserWindow = window as typeof window & {
      __p13RevealCount?: number;
    };
    browserWindow.__p13RevealCount = 0;
    browserWindow.raaviDesktop = {
      isDesktop: true,
      saveLocalDocumentSnapshot: async () => ({ saved: true }),
      saveReadingPositions: async () => ({ saved: true }),
      saveReadingPositionsSync: () => ({ saved: true }),
      saveWordExport: async () => {
        await new Promise((resolve) => window.setTimeout(resolve, saveDelay));
        return {
          saved: true,
          filePath: "C:\\Users\\Raavi\\Downloads\\راهنمای نگارش.docx",
        };
      },
      revealExport: async () => {
        browserWindow.__p13RevealCount =
          (browserWindow.__p13RevealCount ?? 0) + 1;
        return { revealed: true };
      },
    } as unknown as NonNullable<typeof window.raaviDesktop>;
  }, delay);
}

test("P13 connects Review, Preparing and Success to the real DOCX flow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "light");
  });
  await openDocument(page);
  await installSuccessfulDesktopExport(page);
  const returnTarget = await openExport(page);
  const dialog = page.locator(".export-modal");

  await dialog.getByRole("button", { name: "Word", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "بازبینی خروجی" })).toBeVisible();
  await expect(page.locator(".export-review li")).toHaveCount(2);
  await expect(page.getByText("۲ مورد نیاز به بازبینی است")).toBeVisible();
  const reducedMotionDurations = await page.evaluate(() =>
    [".export-modal-backdrop", ".export-modal"].map((selector) =>
      Number.parseFloat(
        getComputedStyle(document.querySelector<HTMLElement>(selector)!)
          .animationDuration,
      ),
    ),
  );
  for (const duration of reducedMotionDurations) {
    expect(duration).toBeLessThanOrEqual(0.00001);
  }

  const confirmation = page.getByRole("checkbox", {
    name: "با این تغییرها موافقم",
  });
  const continueButton = page.getByRole("button", { name: "ادامه و ذخیره" });
  await expect(confirmation).toBeFocused();
  await expect(continueButton).toBeDisabled();

  const reviewGeometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const bounds = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      return {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    return {
      dialog: rect(".export-modal"),
      body: rect(".export-modal-body--review"),
      warning: rect(".export-review"),
      target: rect(".export-review-target"),
      footer: rect(".export-modal-actions"),
    };
  });
  expect(reviewGeometry).toEqual({
    dialog: { x: 340, y: 275, width: 600, height: 457 },
    body: { x: 340, y: 340, width: 600, height: 327 },
    warning: { x: 364, y: 412, width: 552, height: 130 },
    target: { x: 364, y: 556, width: 552, height: 37 },
    footer: { x: 340, y: 668, width: 600, height: 64 },
  });
  await expect(page.locator(".toast")).toBeHidden({ timeout: 8_000 });
  await page.screenshot({ path: ".artifacts/p13-export-review.png", fullPage: true });

  await page.getByRole("button", { name: "بازگشت" }).click();
  await expect(page.getByRole("dialog", { name: "خروجی سند" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Word", exact: true })).toBeFocused();
  await dialog.getByRole("button", { name: "Word", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "بازبینی خروجی" })).toBeVisible();
  await confirmation.check();
  await continueButton.click();
  const preparingDialog = page.getByRole("dialog", { name: "در حال ساخت خروجی" });
  await expect(preparingDialog).toBeVisible();
  await expect(
    preparingDialog.getByRole("button", { name: "بستن پنجره‌ی خروجی" }),
  ).toBeDisabled();
  await expect(preparingDialog).toBeFocused();
  await expect(preparingDialog.getByText("۹۶٪", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(preparingDialog).toBeVisible();
  await expect(dialog).toHaveCSS("height", "395px");
  await page.screenshot({
    path: ".artifacts/p13-export-preparing.png",
    fullPage: true,
  });

  const successDialog = page.getByRole("dialog", { name: "خروجی آماده است" });
  await expect(successDialog).toBeVisible();
  await expect(successDialog).toHaveCSS("height", "374px");
  await expect(successDialog.getByText("راهنمای نگارش.docx", { exact: true })).toBeVisible();
  await expect(successDialog.getByText(/C: \/ Users \/ Raavi \/ Downloads/u)).toBeVisible();
  await expect(successDialog.getByRole("button", { name: "نمایش در پوشه" })).toBeFocused();
  await page.screenshot({ path: ".artifacts/p13-export-success.png", fullPage: true });

  await successDialog.getByRole("button", { name: "نمایش در پوشه" }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __p13RevealCount?: number })
            .__p13RevealCount ?? 0,
      ),
    )
    .toBe(1);
  await successDialog.getByRole("button", { name: "تمام" }).click();
  await expect(successDialog).toBeHidden();
  await expect(returnTarget).toBeFocused();
});

test("P13 exposes a recoverable Error state and retries without changing the document", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript(() => window.localStorage.clear());
  await openDocument(page, "# سند سالم\n\nمتن نمونه");
  await page.evaluate(() => {
    const browserWindow = window as typeof window & {
      __p13SaveAttempt?: number;
    };
    browserWindow.__p13SaveAttempt = 0;
    browserWindow.raaviDesktop = {
      isDesktop: true,
      saveLocalDocumentSnapshot: async () => ({ saved: true }),
      saveReadingPositions: async () => ({ saved: true }),
      saveReadingPositionsSync: () => ({ saved: true }),
      saveWordExport: async () => {
        browserWindow.__p13SaveAttempt = (browserWindow.__p13SaveAttempt ?? 0) + 1;
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        if (browserWindow.__p13SaveAttempt === 1) throw new Error("WRITE_DENIED");
        return {
          saved: true,
          filePath: "C:\\Users\\Raavi\\Downloads\\راهنمای نگارش.docx",
        };
      },
      revealExport: async () => ({ revealed: true }),
    } as unknown as NonNullable<typeof window.raaviDesktop>;
  });
  await openExport(page);
  await page.getByRole("button", { name: "Word", exact: true }).click();

  const errorDialog = page.getByRole("dialog", { name: "خروجی ساخته نشد" });
  await expect(errorDialog).toBeVisible();
  await expect(errorDialog).toHaveCSS("height", "301px");
  await expect(errorDialog.getByText("ذخیرهٔ فایل ممکن نشد")).toBeVisible();
  const retry = errorDialog.getByRole("button", { name: "تلاش دوباره" });
  await expect(retry).toBeFocused();
  await page.screenshot({ path: ".artifacts/p13-export-error.png", fullPage: true });

  await retry.click();
  await expect(page.getByRole("dialog", { name: "خروجی آماده است" })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as typeof window & { __p13SaveAttempt?: number })
            .__p13SaveAttempt ?? 0,
      ),
    )
    .toBe(2);
});

// Mobile editor contract retired; device access is covered in desktop-access.spec.ts.
