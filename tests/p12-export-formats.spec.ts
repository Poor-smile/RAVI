import { Buffer } from "node:buffer";
import { expect, test, type Page } from "@playwright/test";
import { installPdfBackend } from "./helpers/pdf-backend";

const source = "## نوشتن برای خوانده‌شدن\n\nمتن خوب پیش از آن‌که زیبا باشد، مسیر خواندن را روشن می‌کند.";

async function openDocument(page: Page) {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.locator('input[type="file"][accept*=".md"]').first().setInputFiles({
    name: "راهنمای نگارش.md", mimeType: "text/markdown", buffer: Buffer.from(source),
  });
  const leaveReading = page.getByRole("button", { name: "بازگشت به میز", exact: true });
  if (await leaveReading.isVisible()) await leaveReading.click();
}

async function openFromOverflow(page: Page) {
  const trigger = page.locator(".header-overflow-trigger");
  await trigger.click();
  await page.locator('[data-overflow-action="export"]').click();
  return trigger;
}

// The approved REM design replaced radio rows and a separate submit button with
// two equal actions. Keep cancellation, keyboard, theme and source-safety coverage.
test("P12 equal Word/PDF actions preserve keyboard flow and the source document", async ({ page }, info) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "light");
  });
  await openDocument(page);
  const documentText = await page.getByRole("textbox", { name: "متن Markdown", exact: true }).textContent();
  await installPdfBackend(page, info);
  const dialog = page.getByRole("dialog", { name: "خروجی سند", exact: true });
  const word = dialog.getByRole("button", { name: "Word", exact: true });
  const pdf = dialog.getByRole("button", { name: "PDF", exact: true });
  for (const theme of ["light", "dark"] as const) {
    await page.evaluate(mode => document.documentElement.dataset.theme = mode, theme);
    const returnTarget = await openFromOverflow(page);
    await expect(word).toBeFocused();
    await expect(word).toBeEnabled();
    await expect(pdf).toBeEnabled();
    const wordBounds = (await word.boundingBox())!;
    const pdfBounds = (await pdf.boundingBox())!;
    expect(wordBounds.width).toBe(pdfBounds.width);
    expect(wordBounds.height).toBe(pdfBounds.height);
    expect(wordBounds.height).toBeGreaterThanOrEqual(36);
    await expect(word).toBeInViewport();
    await expect(pdf).toBeInViewport();
    await page.keyboard.press("Tab");
    await expect(pdf).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(word).toBeFocused();
    await page.screenshot({ path: info.outputPath(`formats-${theme}.png`) });
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(returnTarget).toBeFocused();
    await openFromOverflow(page);
    await page.locator(".export-modal-backdrop").click({ position: { x: 20, y: 20 } });
    await expect(dialog).toBeHidden();
    await expect(returnTarget).toBeFocused();
  }
  await openFromOverflow(page);
  await pdf.click();
  await expect(page.getByRole("dialog", { name: /پیش‌نمایش PDF/ })).toBeVisible();
  await expect(page.locator(".pdf-preview-canvas")).toBeVisible();
  await page.getByRole("button", { name: "بازگشت به سند", exact: true }).click();
  await expect(page.locator(".export-modal")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "متن Markdown", exact: true })).toHaveText(documentText!);
});
