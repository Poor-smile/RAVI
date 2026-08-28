import { expect, test } from "@playwright/test";

const SETTINGS_PAGES = [
  ["general", "عمومی"],
  ["appearance", "ظاهر"],
  ["ai", "هوش مصنوعی و گفتار"],
  ["reading", "مطالعه"],
  ["editing", "ویرایش"],
  ["files", "فایل‌ها و کتابخانه"],
  ["privacy", "حریم خصوصی و داده‌ها"],
  ["shortcuts", "میان‌برها"],
] as const;

test("captures every compact Settings page without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 864 });
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "light");
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page.locator(".header-overflow-trigger").click();
  await page.locator('[data-overflow-action="shortcut-settings"]').click();

  const navigation = page.getByRole("navigation", {
    name: "دسته‌های تنظیمات",
  });
  const content = page.locator(".shortcut-settings-content");

  for (const [id, label] of SETTINGS_PAGES) {
    await navigation.getByRole("button", { name: label, exact: true }).click();
    await expect(content).toHaveAttribute("data-settings-category", id);
    await expect
      .poll(() =>
        content.evaluate((node) => node.scrollWidth - node.clientWidth),
      )
      .toBeLessThanOrEqual(0);

    if (id === "general") {
      await expect
        .poll(() =>
          content.evaluate((node) => node.scrollHeight - node.clientHeight),
        )
        .toBeLessThanOrEqual(0);
    }

    await page.screenshot({
      path: `.artifacts/settings-redesign-${id}.png`,
      fullPage: false,
    });
  }
});
