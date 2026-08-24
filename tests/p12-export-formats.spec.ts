import { Buffer } from "node:buffer";
import { expect, test, type Page } from "@playwright/test";

async function openDocument(page: Page) {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page
    .locator('input[type="file"][accept*=".md"]')
    .first()
    .setInputFiles({
      name: "راهنمای نگارش.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(
        "## نوشتن برای خوانده‌شدن\n\nمتن خوب پیش از آن‌که زیبا باشد، مسیر خواندن را روشن می‌کند.",
      ),
    });
  const leaveReading = page.getByRole("button", {
    name: "بازگشت به میز",
    exact: true,
  });
  if (await leaveReading.isVisible()) await leaveReading.click();
}

async function openFromOverflow(page: Page) {
  const trigger = page.locator(".header-overflow-trigger");
  await trigger.click();
  await page.locator('[data-overflow-action="export"]').click();
  return trigger;
}

test("P12 matches the DOCX/PDF Product Dialog and preserves keyboard flow", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "light");
  });
  await openDocument(page);
  const returnTarget = await openFromOverflow(page);

  const dialog = page.getByRole("dialog", { name: "خروجی سند" });
  const docx = dialog.getByRole("radio", {
    name: "Word (.docx) — قابل ویرایش",
  });
  const pdf = dialog.getByRole("radio", {
    name: "PDF — صفحه‌بندی ثابت A4",
  });
  const primary = dialog.locator(".export-modal-actions .button--primary");
  const cancel = dialog.getByRole("button", { name: "انصراف" });

  await expect(dialog).toBeVisible();
  await expect(docx).toBeChecked();
  await expect(docx).toBeFocused();
  await expect(
    dialog.getByText("DOCX · سند قابل ویرایش", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("راهنمای نگارش.docx", { exact: true })).toBeVisible();

  const contract = await page.evaluate(() => {
    const element = (selector: string) =>
      document.querySelector<HTMLElement>(selector)!;
    const rect = (selector: string) => {
      const bounds = element(selector).getBoundingClientRect();
      return {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    const style = (selector: string) => getComputedStyle(element(selector));
    return {
      geometry: {
        backdrop: rect(".export-modal-backdrop"),
        dialog: rect(".export-modal"),
        header: rect(".export-modal-header"),
        body: rect(".export-modal-body"),
        footer: rect(".export-modal-actions"),
        close: rect(".export-modal-header > button"),
        firstRadioRow: rect(".export-format-options label:first-of-type"),
        information: rect(".export-format-information"),
        fileName: rect(".export-result-name"),
        primary: rect(".export-modal-actions .button--primary"),
        cancel: rect(".export-modal-actions .button--quiet"),
      },
      surface: {
        dialogBackground: style(".export-modal").backgroundColor,
        dialogBorder: style(".export-modal").borderWidth,
        dialogRadius: style(".export-modal").borderRadius,
        headerBackground: style(".export-modal-header").backgroundColor,
        infoBackground: style(".export-format-information").backgroundColor,
        fileBackground: style(".export-result-name").backgroundColor,
        radioRowBorder: style(".export-format-options label:first-of-type")
          .borderWidth,
        neutralBorder: style(".export-modal-actions .button--quiet").borderWidth,
      },
      type: {
        titleSize: style(".export-modal-header strong").fontSize,
        titleLineHeight: style(".export-modal-header strong").lineHeight,
        descriptionSize: style("#export-modal-description").fontSize,
        descriptionLineHeight: style("#export-modal-description").lineHeight,
        labelSize: style(".export-format-options strong").fontSize,
        labelLineHeight: style(".export-format-options strong").lineHeight,
        captionSize: style(".export-format-information span").fontSize,
        captionLineHeight: style(".export-format-information span").lineHeight,
      },
    };
  });

  expect(contract.geometry).toEqual({
    backdrop: { x: 0, y: 92, width: 1280, height: 822 },
    dialog: { x: 340, y: 236, width: 600, height: 534 },
    header: { x: 340, y: 236, width: 600, height: 64 },
    body: { x: 340, y: 301, width: 600, height: 404 },
    footer: { x: 340, y: 706, width: 600, height: 64 },
    close: { x: 358, y: 250, width: 36, height: 36 },
    firstRadioRow: { x: 364, y: 439, width: 552, height: 36 },
    information: { x: 364, y: 533, width: 552, height: 61 },
    fileName: { x: 364, y: 608, width: 552, height: 73 },
    primary: { x: 354, y: 720, width: 104, height: 36 },
    cancel: { x: 466, y: 720, width: 72, height: 36 },
  });
  expect(contract.surface).toEqual({
    dialogBackground: "rgb(252, 253, 249)",
    dialogBorder: "0px",
    dialogRadius: "14px",
    headerBackground: "rgb(252, 253, 249)",
    infoBackground: "rgb(233, 239, 255)",
    fileBackground: "rgb(245, 246, 240)",
    radioRowBorder: "0px",
    neutralBorder: "0px",
  });
  expect(contract.type).toEqual({
    titleSize: "23px",
    titleLineHeight: "35px",
    descriptionSize: "16px",
    descriptionLineHeight: "34px",
    labelSize: "12px",
    labelLineHeight: "18px",
    captionSize: "11px",
    captionLineHeight: "17px",
  });

  await expect(page.locator(".toast")).toBeHidden({ timeout: 8_000 });
  await page.screenshot({
    path: ".artifacts/p12-export-docx.png",
    fullPage: true,
  });

  await docx.press("ArrowDown");
  await expect(pdf).toBeChecked();
  await expect(pdf).toBeFocused();
  await expect(
    dialog.getByText("PDF · صفحه‌بندی ثابت", { exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("راهنمای نگارش.pdf", { exact: true })).toBeVisible();
  await expect(primary).toHaveText("خروجی PDF");
  await pdf.evaluate((element) => (element as HTMLInputElement).blur());
  await page.screenshot({
    path: ".artifacts/p12-export-pdf.png",
    fullPage: true,
  });

  await cancel.click();
  await expect(dialog).toBeHidden();
  await expect(returnTarget).toBeFocused();

  await page
    .getByRole("button", { name: "فعال‌کردن تم تاریک", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await openFromOverflow(page);
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveCSS("background-color", "rgb(252, 253, 249)");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(returnTarget).toBeFocused();

  await openFromOverflow(page);
  await page.locator(".export-modal-backdrop").click({
    position: { x: 20, y: 20 },
  });
  await expect(dialog).toBeHidden();
  await expect(returnTarget).toBeFocused();
});

test("P12 becomes a mobile sheet with 44px controls and no overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.clear());
  await openDocument(page);
  await page.keyboard.press("Control+Shift+e");

  const dialog = page.getByRole("dialog", { name: "خروجی سند" });
  await expect(dialog).toBeVisible();
  const contract = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>(".export-modal")!;
    const backdrop = document.querySelector<HTMLElement>(
      ".export-modal-backdrop",
    )!;
    const targets = dialog.querySelectorAll<HTMLElement>(
      ".export-modal-header > button, .export-format-options label, .export-modal-actions .button",
    );
    const box = (element: HTMLElement) => {
      const bounds = element.getBoundingClientRect();
      return {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    return {
      dialog: box(dialog),
      backdrop: box(backdrop),
      targets: Array.from(targets, box),
      overflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(contract.backdrop).toEqual({ x: 0, y: 0, width: 390, height: 844 });
  expect(contract.dialog.x).toBe(10);
  expect(contract.dialog.width).toBe(370);
  expect(
    Math.abs(contract.dialog.y + contract.dialog.height - 844),
  ).toBeLessThanOrEqual(1);
  for (const target of contract.targets) {
    expect(target.height).toBeGreaterThanOrEqual(44);
  }
  expect(contract.overflow).toBeLessThanOrEqual(0);
});
