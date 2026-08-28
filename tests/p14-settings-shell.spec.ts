import { expect, test, type Page } from "@playwright/test";

async function openSettings(page: Page) {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  const returnTarget = page.locator(".header-overflow-trigger");
  await returnTarget.click();
  await page.locator('[data-overflow-action="shortcut-settings"]').click();
  return returnTarget;
}

test("Settings stays compact at scaled Full HD and supports keyboard category navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 864 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "light");
  });

  const returnTarget = await openSettings(page);
  const dialog = page.getByRole("dialog", { name: "عمومی" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "عمومی" })).toBeFocused();

  const navigation = page.getByRole("navigation", {
    name: "دسته‌های تنظیمات",
  });
  const categoryButtons = navigation.getByRole("button");
  await expect(categoryButtons).toHaveCount(8);
  await expect(categoryButtons).toHaveText([
    "عمومی",
    "ظاهر",
    "هوش مصنوعی و گفتار",
    "مطالعه",
    "ویرایش",
    "فایل‌ها و کتابخانه",
    "حریم خصوصی و داده‌ها",
    "میان‌برها",
  ]);

  const geometry = await page.evaluate(() => {
    const header = document.querySelector<HTMLElement>(
      ".shortcut-settings-header",
    )!;
    const layout = document.querySelector<HTMLElement>(
      ".shortcut-settings-layout",
    )!;
    const navigation = document.querySelector<HTMLElement>(
      ".shortcut-settings-nav",
    )!;
    const content = document.querySelector<HTMLElement>(
      ".shortcut-settings-content",
    )!;
    const lastSection = document.querySelector<HTMLElement>(
      ".general-settings-section:last-child",
    )!;
    return {
      headerHeight: Math.round(header.getBoundingClientRect().height),
      layoutHeight: Math.round(layout.getBoundingClientRect().height),
      navigationWidth: Math.round(navigation.getBoundingClientRect().width),
      navTargets: Array.from(
        document.querySelectorAll<HTMLElement>(
          ".shortcut-settings-nav li > button",
        ),
        (button) => Math.round(button.getBoundingClientRect().height),
      ),
      contentHorizontalOverflow: content.scrollWidth - content.clientWidth,
      contentVerticalOverflow: content.scrollHeight - content.clientHeight,
      pageHorizontalOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
      generalFitsViewport:
        lastSection.getBoundingClientRect().bottom <=
        content.getBoundingClientRect().bottom,
      iconIsPhysicallyRightOfLabel: (() => {
        const button = document.querySelector<HTMLElement>(
          ".shortcut-settings-nav li:first-child > button",
        )!;
        const icon = button.querySelector("svg")!.getBoundingClientRect();
        const label = button.querySelector("span")!.getBoundingClientRect();
        return icon.left > label.right;
      })(),
    };
  });
  expect(geometry.headerHeight).toBe(56);
  expect(geometry.layoutHeight).toBe(808);
  expect(geometry.navigationWidth).toBeGreaterThanOrEqual(212);
  expect(geometry.navigationWidth).toBeLessThanOrEqual(236);
  expect(geometry.navTargets).toEqual(Array(8).fill(40));
  expect(geometry.contentHorizontalOverflow).toBeLessThanOrEqual(0);
  expect(geometry.contentVerticalOverflow).toBeLessThanOrEqual(0);
  expect(geometry.pageHorizontalOverflow).toBeLessThanOrEqual(0);
  expect(geometry.generalFitsViewport).toBe(true);
  expect(geometry.iconIsPhysicallyRightOfLabel).toBe(true);

  await page.screenshot({
    path: ".artifacts/p14-settings-desktop.png",
    fullPage: false,
  });

  const general = navigation.getByRole("button", { name: "عمومی" });
  await general.focus();
  await page.keyboard.press("ArrowDown");
  const appearance = navigation.getByRole("button", { name: "ظاهر" });
  await expect(appearance).toBeFocused();
  await expect(appearance).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { name: "ظاهر" })).toBeVisible();

  await page.keyboard.press("End");
  const shortcuts = navigation.getByRole("button", { name: "میان‌برها" });
  await expect(shortcuts).toBeFocused();
  await expect(shortcuts).toHaveAttribute("aria-current", "page");
  await expect(
    page.getByRole("heading", { name: "میان‌برهای صفحه‌کلید" }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(returnTarget).toBeFocused();
});

test("P14 becomes a touch-safe mobile category strip without horizontal page overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.clear());
  await openSettings(page);

  const dialog = page.getByRole("dialog", { name: "عمومی" });
  const navigation = dialog.getByRole("navigation", {
    name: "دسته‌های تنظیمات",
  });
  await navigation.getByRole("button", { name: "ویرایش" }).click();
  await expect(page.getByRole("heading", { name: "ویرایش" })).toBeVisible();

  const contract = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>(".shortcut-settings")!;
    const navigation = document.querySelector<HTMLElement>(
      ".shortcut-settings-nav",
    )!;
    const content = document.querySelector<HTMLElement>(
      ".shortcut-settings-content",
    )!;
    const targets = dialog.querySelectorAll<HTMLElement>(
      ".shortcut-settings-header > button, .shortcut-settings-nav li > button, .settings-switch, .settings-segmented-control button",
    );
    return {
      dialogWidth: Math.round(dialog.getBoundingClientRect().width),
      navigationWidth: Math.round(navigation.getBoundingClientRect().width),
      contentWidth: Math.round(content.getBoundingClientRect().width),
      targetHeights: Array.from(targets, (target) =>
        Math.round(target.getBoundingClientRect().height),
      ),
      pageOverflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });
  expect(contract.dialogWidth).toBe(390);
  expect(contract.navigationWidth).toBe(358);
  expect(contract.contentWidth).toBe(358);
  for (const height of contract.targetHeights) {
    expect(height).toBeGreaterThanOrEqual(44);
  }
  expect(contract.pageOverflow).toBeLessThanOrEqual(0);

  await page.screenshot({
    path: ".artifacts/p14-settings-mobile.png",
    fullPage: false,
  });
});
