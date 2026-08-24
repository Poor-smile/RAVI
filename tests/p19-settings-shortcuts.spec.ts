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

test("P19 matches the compact Figma shortcut reference and real Windows bindings", async ({
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
    dialog.getByRole("heading", { name: "میان‌برهای ویرایش" }),
  ).toBeVisible();
  await expect(dialog.locator(".shortcut-settings-autosave")).toHaveCount(0);

  const sections = dialog.locator(".settings-shortcut-section");
  await expect(sections).toHaveCount(3);
  await expect(sections.getByRole("heading")).toHaveText([
    "ساخت و مدیریت بلاک",
    "منوی / و انتخاب نوع",
    "قالب‌بندی Selection",
  ]);
  await expect(dialog.locator("[data-settings-shortcut-id]")).toHaveCount(9);
  await expect(
    dialog.locator('[data-settings-shortcut-id="block-insert-after"]'),
  ).toContainText("Ctrl+Enter");
  await expect(
    dialog.locator('[data-settings-shortcut-id="block-insert-after"]'),
  ).toContainText("Enter در List Block برای آیتم داخلی آزاد می‌ماند.");
  await expect(
    dialog.locator('[data-settings-shortcut-id="selection-format"]'),
  ).toContainText("Ctrl+B · Ctrl+I · Ctrl+U · Ctrl+`");
  await expect(
    dialog.locator('[data-settings-shortcut-id="selection-format"]'),
  ).toHaveAttribute("data-context-dependent", "true");

  const geometry = await page.evaluate(() => {
    const rect = (element: Element) => {
      const bounds = element.getBoundingClientRect();
      return {
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    const section = document.querySelector(".settings-shortcut-section")!;
    const rows = Array.from(
      document.querySelectorAll(".settings-shortcut-section li"),
    );
    const firstRow = rows[0];
    const copy = firstRow.querySelector(".settings-shortcut-copy")!;
    const shortcut = firstRow.querySelector(".settings-shortcut-key")!;
    const sectionStyle = getComputedStyle(section);
    return {
      section: rect(section),
      rowWidths: rows.map((row) => Math.round(row.getBoundingClientRect().width)),
      rowHeights: rows.map((row) => Math.round(row.getBoundingClientRect().height)),
      radius: sectionStyle.borderRadius,
      border: sectionStyle.borderTopWidth,
      shortcutIsPhysicallyLeft:
        shortcut.getBoundingClientRect().right <= copy.getBoundingClientRect().left,
    };
  });
  expect(geometry.section.width).toBe(1040);
  expect(geometry.section.height).toBe(184);
  expect(new Set(geometry.rowWidths)).toEqual(new Set([1012]));
  expect(new Set(geometry.rowHeights)).toEqual(new Set([44]));
  expect(geometry.radius).toBe("14px");
  expect(geometry.border).toBe("0px");
  expect(geometry.shortcutIsPhysicallyLeft).toBe(true);

  await page.screenshot({
    path: ".artifacts/p19-settings-shortcuts-desktop.png",
    fullPage: false,
  });
});

test("P19 formats macOS bindings and keeps the compact page responsive", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  await expect(
    dialog.locator('[data-settings-shortcut-id="block-insert-after"]'),
  ).toContainText("⌘+Enter");
  await expect(
    dialog.locator('[data-settings-shortcut-id="block-reorder"]'),
  ).toContainText("Option+↑ / Option+↓");
  await expect(
    dialog.locator('[data-settings-shortcut-id="selection-format"]'),
  ).toContainText("⌘+B · ⌘+I · ⌘+U · Ctrl+`");

  const mobile = await page.evaluate(() => ({
    pageOverflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    sectionWidths: Array.from(
      document.querySelectorAll<HTMLElement>(".settings-shortcut-section"),
      (section) => Math.round(section.getBoundingClientRect().width),
    ),
    rowMinHeights: Array.from(
      document.querySelectorAll<HTMLElement>(".settings-shortcut-section li"),
      (row) => Math.round(row.getBoundingClientRect().height),
    ),
  }));
  expect(mobile.pageOverflow).toBeLessThanOrEqual(0);
  expect(new Set(mobile.sectionWidths)).toEqual(new Set([358]));
  for (const height of mobile.rowMinHeights) {
    expect(height).toBeGreaterThanOrEqual(68);
  }

  await page.screenshot({
    path: ".artifacts/p19-settings-shortcuts-mobile.png",
    fullPage: false,
  });
});
