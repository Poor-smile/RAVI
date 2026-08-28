import { Buffer } from "node:buffer";
import { expect, test, type Page } from "@playwright/test";

async function openSettings(page: Page) {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page.locator(".header-overflow-trigger").click();
  await page.locator('[data-overflow-action="shortcut-settings"]').click();
}

test("P15 Appearance matches Figma and applies persistent theme, accent and motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("p15-appearance-ready")) return;
    window.localStorage.clear();
    window.sessionStorage.setItem("p15-appearance-ready", "true");
  });
  await openSettings(page);
  await page
    .getByRole("navigation", { name: "دسته‌های تنظیمات" })
    .getByRole("button", { name: "ظاهر" })
    .click();

  const dialog = page.getByRole("dialog", { name: "ظاهر" });
  const themes = dialog.getByRole("radiogroup", { name: "حالت نمایش" });
  const accents = dialog.getByRole("radiogroup", { name: "رنگ رابط" });
  const motion = dialog.getByRole("radiogroup", { name: "حرکت رابط" });
  await expect(themes.getByRole("radio")).toHaveCount(3);
  await expect(accents.getByRole("radio")).toHaveCount(13);
  await expect(motion.getByRole("radio")).toHaveCount(3);
  await expect(themes.getByRole("radio", { name: /سیستم/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await themes.getByRole("radio", { name: /سیستم/ }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(themes.getByRole("radio", { name: /روشن/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await themes.getByRole("radio", { name: /سیستم/ }).click();

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const bounds = document
        .querySelector<HTMLElement>(selector)!
        .getBoundingClientRect();
      return {
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    return {
      section: rect(".appearance-theme-section"),
      accentSection: rect(".appearance-accent-section"),
      motionSection: rect(".appearance-motion-section"),
      swatches: Array.from(
        document.querySelectorAll<HTMLElement>(
          ".appearance-accent-options > button",
        ),
        (button) => Math.round(button.getBoundingClientRect().height),
      ),
      motion: rect(".appearance-motion-control"),
      horizontalOverflow:
        document.querySelector<HTMLElement>(".shortcut-settings-content")!
          .scrollWidth -
        document.querySelector<HTMLElement>(".shortcut-settings-content")!
          .clientWidth,
    };
  });
  expect(geometry.section.width).toBe(geometry.accentSection.width);
  expect(geometry.section.width).toBe(geometry.motionSection.width);
  expect(geometry.section.height).toBeLessThan(200);
  expect(geometry.accentSection.height).toBeLessThan(220);
  expect(geometry.motionSection.height).toBeLessThan(180);
  expect(geometry.swatches).toEqual(Array(13).fill(44));
  expect(geometry.motion).toEqual({ width: 270, height: 40 });
  expect(geometry.horizontalOverflow).toBeLessThanOrEqual(0);

  await page.screenshot({
    path: ".artifacts/p15-settings-appearance.png",
    fullPage: false,
  });

  await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await motion.getByRole("radio", { name: "معمولی", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "normal");
  await expect(page.locator(".shortcut-settings-backdrop")).toHaveCSS(
    "animation-duration",
    "0.16s",
  );

  await themes.getByRole("radio", { name: /تاریک/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await accents.getByRole("radio", { name: "جنگلی" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-accent", "forest");
  await motion.getByRole("radio", { name: "کم‌شده" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(
          localStorage.getItem("raavi:appearance-preferences:v1") ?? "{}",
        ),
      ),
    )
    .toEqual({ theme: "dark", accent: "forest", motion: "reduced" });

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-accent", "forest");
  await expect(page.locator("html")).toHaveAttribute("data-motion", "reduced");
});

test("P15 Editing settings persist and drive the real Code surface", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "light");
    window.localStorage.setItem(
      "raavi:file-library-preferences:v1",
      JSON.stringify({
        defaultOpenMode: "writing",
        fileVisibility: "all",
        autoRefresh: true,
      }),
    );
  });
  await openSettings(page);
  await page
    .getByRole("navigation", { name: "دسته‌های تنظیمات" })
    .getByRole("button", { name: "ویرایش" })
    .click();

  const dialog = page.getByRole("dialog", { name: "ویرایش و نمای کد" });
  const editingGeometry = await dialog.evaluate((node) => {
    const card = node.querySelector<HTMLElement>(".code-view-settings-card")!;
    const controls = node.querySelector<HTMLElement>(
      ".code-view-settings-controls",
    )!;
    const content = node.querySelector<HTMLElement>(
      ".shortcut-settings-content",
    )!;
    return {
      cardHeight: Math.round(card.getBoundingClientRect().height),
      controlsWidth: Math.round(controls.getBoundingClientRect().width),
      horizontalOverflow: content.scrollWidth - content.clientWidth,
    };
  });
  expect(editingGeometry.cardHeight).toBeLessThan(360);
  expect(editingGeometry.controlsWidth).toBeLessThanOrEqual(860);
  expect(editingGeometry.horizontalOverflow).toBeLessThanOrEqual(0);
  const toolbarSwitch = dialog.getByRole("switch", {
    name: "تولبار پایین نمای کد",
  });
  const contextualHintsSwitch = dialog.getByRole("switch", {
    name: "راهنمای کلیدهای بلاک فعال",
  });
  await expect(contextualHintsSwitch).toHaveAttribute("aria-checked", "true");
  await contextualHintsSwitch.click();
  await toolbarSwitch.click();
  await dialog
    .getByRole("radiogroup", { name: "جهت پیش‌فرض خطوط" })
    .getByRole("radio", { name: "RTL" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(
          localStorage.getItem("raavi:code-view-preferences:v1") ?? "{}",
        ),
      ),
    )
    .toEqual({
      toolbarVisible: false,
      contextualHintsVisible: false,
      lineDirection: "rtl",
    });
  await page.screenshot({
    path: ".artifacts/p15-settings-editing.png",
    fullPage: false,
  });

  await page.keyboard.press("Escape");
  await page
    .locator('input[type="file"][accept*=".md"]')
    .first()
    .setInputFiles({
      name: "p15.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# P15\n\nمتن نمونه"),
    });
  await expect(page.locator(".cm-contextual-shortcut-hint")).toHaveCount(0);
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect(page.locator("#markdown-editor .cm-editor")).toHaveAttribute(
    "data-line-direction",
    "rtl",
  );
  await expect(
    page.getByRole("toolbar", { name: "ابزارهای نمای کد" }),
  ).toHaveCount(0);
});

test("P15 remains touch-safe and overflow-free on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.clear());
  await openSettings(page);
  await page
    .getByRole("navigation", { name: "دسته‌های تنظیمات" })
    .getByRole("button", { name: "ظاهر" })
    .click();

  const contract = await page.evaluate(() => {
    const targets = document.querySelectorAll<HTMLElement>(
      ".appearance-theme-card, .appearance-accent-options > button, .appearance-motion-control > button",
    );
    return {
      targetHeights: Array.from(targets, (target) =>
        Math.round(target.getBoundingClientRect().height),
      ),
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });
  expect(contract.overflow).toBeLessThanOrEqual(0);
  for (const height of contract.targetHeights) {
    expect(height).toBeGreaterThanOrEqual(44);
  }
});
