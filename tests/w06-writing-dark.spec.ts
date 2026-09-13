import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";

test("W06 maps the saved writing screen to the exact dark surfaces and active-block state", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );

  const fixture = [
    "# نوشتن برای خوانده‌شدن",
    "",
    "هر بخش باید یک ایدهٔ روشن داشته باشد و فاصله‌ها به چشم فرصت مکث بدهند.",
    "",
    "> ساختار، پیش از تزئین، به خواننده اطمینان می‌دهد.",
    "",
    "- [ ] مثال‌ها را بازبینی کن",
    "",
    "",
  ].join("\n");
  await page
    .locator('input[type="file"][accept*=".md"]')
    .first()
    .setInputFiles({
      name: "راهنمای نگارش.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(fixture),
    });
  const leaveReading = page.getByRole("button", {
    name: "بازگشت به میز",
    exact: true,
  });
  if (await leaveReading.isVisible()) await leaveReading.click();
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();

  const editor = page.locator("#markdown-editor .cm-content");
  await editor.focus();
  await page.keyboard.press("Control+End");

  await page
    .getByRole("button", { name: "فعال‌کردن تم تاریک", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).not.toHaveClass(/theme-is-changing/);
  await editor.focus();
  await page.keyboard.press("Control+End");

  const workspace = page.locator('[data-workspace-screen="writing"]');
  const activeBlock = page.locator(
    ".cm-live-empty-block.cm-live-syntax-is-visible",
  );
  await expect(workspace).toBeVisible();
  await expect(page.locator(".document-identity")).toContainText(
    "راهنمای نگارش.md",
  );
  await expect(page.locator(".save-indicator")).toContainText("ذخیره شده");
  await expect(activeBlock).toBeVisible();
  await expect(page.locator(".writing-block-gutter")).toBeVisible();
  await expect(page.locator(".document-status-bar")).toHaveText(
    "۳۰ واژه · ۹ خط",
  );

  const visualContract = await page.evaluate(() => {
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
    const inactiveLines = Array.from(
      document.querySelectorAll<HTMLElement>(
        '#markdown-editor .cm-line:not(.cm-activeLine)',
      ),
    );

    return {
      geometry: {
        document: rect('[data-workspace-screen="writing"] .editor-pane'),
        activeBlock: rect(
          ".cm-live-empty-block.cm-live-syntax-is-visible",
        ),
        gutter: rect(".writing-block-gutter"),
        status: rect(".document-status-bar"),
      },
      colors: {
        titleBar: style(".topbar").backgroundColor,
        commandBar: style(".proofbar").backgroundColor,
        stage: style('[data-workspace-screen="writing"]').backgroundColor,
        rail: style(".sidebar-rail").backgroundColor,
        document: style(
          '[data-workspace-screen="writing"] .editor-pane',
        ).backgroundColor,
        activeBlock: style(
          ".cm-live-empty-block.cm-live-syntax-is-visible",
        ).backgroundColor,
        activeText: style(
          ".cm-live-empty-block.cm-live-syntax-is-visible",
        ).color,
        activeFocus: style(
          ".cm-live-empty-block.cm-live-syntax-is-visible",
        ).boxShadow,
        quoteText: style(".cm-live-quote").color,
        quoteRule: style(".cm-live-quote").borderInlineStartColor,
        status: style(".document-status-bar").backgroundColor,
        statusText: style(".document-status-bar").color,
        selectedMode: style(
          '.editor-mode-switcher button[aria-pressed="true"]',
        ).backgroundColor,
        selectedModeText: style(
          '.editor-mode-switcher button[aria-pressed="true"]',
        ).color,
        themeControl: style(".titlebar-theme-control").backgroundColor,
      },
      states: {
        inactiveShellCount: inactiveLines.filter(
          (line) =>
            getComputedStyle(line).backgroundColor !== "rgba(0, 0, 0, 0)" ||
            getComputedStyle(line).boxShadow !== "none",
        ).length,
        documentRadius: style(
          '[data-workspace-screen="writing"] .editor-pane',
        ).borderRadius,
        documentBorder: style(
          '[data-workspace-screen="writing"] .editor-pane',
        ).borderWidth,
        saveBorder: style(".save-indicator").borderWidth,
      },
    };
  });

  expect(visualContract.geometry).toEqual({
    document: { x: 232, y: 144, width: 760, height: 754 },
    activeBlock: { x: 233, y: 339, width: 758, height: 34 },
    gutter: { x: 999, y: 323, width: 58, height: 28 },
    status: { x: 502, y: 868, width: 220, height: 20 },
  });
  expect(visualContract.colors).toEqual({
    titleBar: "rgb(14, 19, 15)",
    commandBar: "rgb(24, 30, 26)",
    stage: "rgb(12, 18, 14)",
    rail: "rgb(16, 20, 17)",
    document: "rgb(38, 56, 45)",
    activeBlock: "rgb(32, 46, 80)",
    activeText: "rgb(242, 245, 241)",
    activeFocus: "rgb(185, 201, 255) 0px 0px 0px 1px inset",
    quoteText: "rgb(189, 198, 189)",
    quoteRule: "rgb(134, 168, 255)",
    status: "rgb(20, 26, 22)",
    statusText: "rgb(189, 198, 189)",
    selectedMode: "rgb(8, 11, 9)",
    selectedModeText: "rgb(247, 250, 247)",
    themeControl: "rgb(24, 30, 26)",
  });
  expect(visualContract.states).toEqual({
    inactiveShellCount: 0,
    documentRadius: "14px",
    documentBorder: "1px",
    saveBorder: "0px",
  });

  await expect(page.locator(".toast")).toBeHidden({ timeout: 8_000 });
  await page.screenshot({
    path: ".artifacts/w06-writing-dark.png",
    fullPage: true,
  });
});
