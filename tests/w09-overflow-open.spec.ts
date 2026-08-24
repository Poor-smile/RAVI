import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";

test("W09 opens the exact compact overflow menu with real commands and keyboard flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
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
      buffer: Buffer.from("## نوشتن برای خوانده‌شدن\n"),
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
  await page.keyboard.insertText(" ");
  await page
    .getByRole("button", { name: "فعال‌کردن تم تاریک", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).not.toHaveClass(/theme-is-changing/);

  const trigger = page.locator(".header-overflow-trigger");
  await trigger.click();
  const menu = page.getByRole("menu", { name: "فرمان‌های بیشتر" });
  const items = menu.getByRole("menuitem");
  await expect(menu).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveClass(/is-overflow-open/);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(items).toHaveCount(7);
  await expect(items.locator("strong")).toHaveText([
    "فرمان‌های راوی",
    "میان‌برهای صفحه‌کلید",
    "تنظیمات",
    "خروجی Word یا PDF",
    "تم روشن",
    "حمایت از راوی",
    "دربارهٔ راوی",
  ]);
  await expect(items.locator(".header-overflow-shortcut")).toHaveText([
    "Ctrl+K",
    "Ctrl+/",
    "Ctrl+Shift+E",
    "Alt+T",
  ]);
  await expect(menu.getByRole("separator")).toHaveCount(2);
  await expect(items.first()).toBeFocused();
  await expect(page.locator(".writing-block-gutter")).toBeHidden();

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
    const firstItem = element(
      '.header-overflow-grid [data-overflow-action="commands"]',
    );
    const firstItemStyle = getComputedStyle(firstItem);
    const firstItemLabelStyle = getComputedStyle(
      firstItem.querySelector<HTMLElement>("strong")!,
    );
    const shortcutStyle = style(".header-overflow-shortcut");

    return {
      geometry: {
        menu: rect(".header-overflow-menu"),
        header: rect(".header-overflow-header"),
        grid: rect(".header-overflow-grid"),
        firstItem: rect(
          '.header-overflow-grid [data-overflow-action="commands"]',
        ),
        firstDivider: rect(".header-overflow-divider"),
        document: rect('[data-workspace-screen="writing"] .editor-pane'),
        status: rect(".document-status-bar"),
      },
      surface: {
        background: style(".header-overflow-menu").backgroundColor,
        border: style(".header-overflow-menu").borderColor,
        borderWidth: style(".header-overflow-menu").borderWidth,
        radius: style(".header-overflow-menu").borderRadius,
        shadow: style(".header-overflow-menu").boxShadow,
        backdrop: style(".header-overflow-backdrop").backgroundColor,
        itemBackground: firstItemStyle.backgroundColor,
        itemBorder: firstItemStyle.borderWidth,
        itemRadius: firstItemStyle.borderRadius,
        divider: style(".header-overflow-divider").backgroundColor,
        trigger: style(".header-overflow-trigger").backgroundColor,
      },
      type: {
        titleSize: style(".header-overflow-header strong").fontSize,
        titleLineHeight: style(".header-overflow-header strong").lineHeight,
        itemSize: firstItemLabelStyle.fontSize,
        shortcutSize: shortcutStyle.fontSize,
        shortcutLineHeight: shortcutStyle.lineHeight,
        shortcutFont: shortcutStyle.fontFamily,
        documentTitleSize: style(".cm-live-heading-2").fontSize,
        documentTitleLineHeight: style(".cm-live-heading-2").lineHeight,
      },
    };
  });

  expect(contract.geometry).toEqual({
    menu: { x: 16, y: 96, width: 320, height: 294 },
    header: { x: 20, y: 100, width: 312, height: 36 },
    grid: { x: 20, y: 140, width: 312, height: 246 },
    firstItem: { x: 20, y: 140, width: 312, height: 36 },
    firstDivider: { x: 24, y: 260, width: 304, height: 1 },
    document: { x: 232, y: 144, width: 760, height: 754 },
    status: { x: 502, y: 869, width: 220, height: 20 },
  });
  expect(contract.surface).toEqual({
    background: "rgb(24, 30, 26)",
    border: "rgb(53, 64, 57)",
    borderWidth: "1px",
    radius: "6px",
    shadow: "none",
    backdrop: "rgba(0, 0, 0, 0)",
    itemBackground: "rgb(24, 30, 26)",
    itemBorder: "0px",
    itemRadius: "4px",
    divider: "rgb(53, 64, 57)",
    trigger: "rgb(20, 26, 22)",
  });
  expect(contract.type).toEqual({
    titleSize: "12px",
    titleLineHeight: "18px",
    itemSize: "12px",
    shortcutSize: "13px",
    shortcutLineHeight: "23px",
    shortcutFont: '"Cascadia Code", "Vazir Code", Consolas, monospace',
    documentTitleSize: "20px",
    documentTitleLineHeight: "30px",
  });

  await expect(page.locator(".toast")).toBeHidden({ timeout: 8_000 });
  await page.screenshot({
    path: ".artifacts/w09-overflow-open.png",
    fullPage: true,
  });

  await page.keyboard.press("ArrowDown");
  await expect(items.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("End");
  await expect(items.last()).toBeFocused();
  await page.keyboard.press("Home");
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.keyboard.press("Tab");
  await expect(menu).toBeHidden();
  await expect(page.locator(".document-identity")).toBeFocused();

  await trigger.focus();
  await trigger.click();
  await page.keyboard.press("Shift+Tab");
  await expect(menu).toBeHidden();
  await expect(page.locator(".topbar-action--find")).toBeFocused();

  await trigger.click();
  await expect(items.first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  const palette = page.getByRole("dialog", { name: "مرکز فرمان راوی" });
  await expect(palette).toBeVisible();
  await expect(
    palette.getByRole("combobox", { name: "جست‌وجوی فرمان" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();

  await editor.focus();
  await page.keyboard.press("Control+K");
  await expect(
    palette.getByRole("combobox", { name: "جست‌وجوی فرمان" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(editor).toBeFocused();
});
