import { expect, test, type Page } from "@playwright/test";

async function openGeneralSettings(page: Page) {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page.locator(".header-overflow-trigger").click();
  await page.locator('[data-overflow-action="shortcut-settings"]').click();
  const dialog = page.getByRole("dialog", { name: "عمومی" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".general-startup-choice")).toHaveCount(3);
  return dialog;
}

test("General Settings fits scaled Full HD and persists real recovery controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 864 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => window.localStorage.clear());

  const dialog = await openGeneralSettings(page);
  const sections = dialog.locator(".general-settings-section");
  await expect(sections).toHaveCount(3);

  const startup = dialog.getByRole("radiogroup", {
    name: "صفحهٔ آغاز راوی",
  });
  await expect(startup.getByRole("radio")).toHaveCount(3);
  await expect(
    startup.getByRole("radio", { name: /فایل‌های اخیر/ }),
  ).toHaveAttribute("aria-checked", "true");

  const restoreTabs = dialog.getByRole("switch", {
    name: "بازیابی تب‌ها و پنل‌ها",
  });
  const restoreReading = dialog.getByRole("switch", {
    name: "باز کردن آخرین مکان مطالعه",
  });
  await expect(restoreTabs).toHaveAttribute("aria-checked", "true");
  await expect(restoreReading).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByText("اسناد / Raavi")).toBeVisible();

  const geometry = await page.evaluate(() => {
    const content = document.querySelector<HTMLElement>(
      ".shortcut-settings-content",
    )!;
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>(".general-settings-section"),
    );
    return {
      horizontalOverflow: content.scrollWidth - content.clientWidth,
      verticalOverflow: content.scrollHeight - content.clientHeight,
      allSectionsVisible: sections.every(
        (section) =>
          section.getBoundingClientRect().bottom <=
          content.getBoundingClientRect().bottom,
      ),
      choiceWidths: Array.from(
        document.querySelectorAll<HTMLElement>(".general-startup-choice"),
        (choice) => Math.round(choice.getBoundingClientRect().width),
      ),
    };
  });
  expect(geometry.horizontalOverflow).toBeLessThanOrEqual(0);
  expect(geometry.verticalOverflow).toBeLessThanOrEqual(0);
  expect(geometry.allSectionsVisible).toBe(true);
  expect(new Set(geometry.choiceWidths).size).toBe(1);
  await expect(dialog.locator(".general-startup-choice").first()).toHaveCSS(
    "height",
    "64px",
  );

  const workspace = startup.getByRole("radio", { name: /آخرین فضای کار/ });
  await workspace.click();
  await restoreTabs.click();
  await restoreReading.click();
  await expect.poll(() =>
    page.evaluate(() => ({
      general: JSON.parse(
        window.localStorage.getItem("raavi:general-preferences:v1") || "{}",
      ),
      files: JSON.parse(
        window.localStorage.getItem("raavi:file-library-preferences:v1") ||
          "{}",
      ),
      reading: JSON.parse(
        window.localStorage.getItem("raavi:reading-preferences:v1") || "{}",
      ),
    })),
  ).toMatchObject({
    general: { startupView: "workspace" },
    files: { restoreDocumentTabs: false },
    reading: { rememberPosition: false },
  });

  await page.screenshot({
    path: ".artifacts/p14-settings-general-desktop.png",
    fullPage: false,
  });
});

test("General Settings is touch-safe and overflow-free", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.clear());
  const dialog = await openGeneralSettings(page);

  const contract = await page.evaluate(() => ({
    overflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
    widths: Array.from(
      document.querySelectorAll<HTMLElement>(".general-startup-choice"),
      (choice) => Math.round(choice.getBoundingClientRect().width),
    ),
    heights: Array.from(
      document.querySelectorAll<HTMLElement>(
        ".general-settings button, .general-settings [role=radio]",
      ),
      (target) => Math.round(target.getBoundingClientRect().height),
    ),
  }));
  expect(contract.overflow).toBeLessThanOrEqual(0);
  expect(new Set(contract.widths).size).toBe(1);
  for (const height of contract.heights) {
    expect(height).toBeGreaterThanOrEqual(44);
  }
  await expect(dialog.getByRole("radio", { name: /فایل‌های اخیر/ })).toBeVisible();
});

test("blank startup opens a fresh untitled document without deleting stored sessions", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "raavi:general-preferences:v1",
      JSON.stringify({ startupView: "blank" }),
    );
    window.localStorage.setItem(
      "raavi:file-library-preferences:v1",
      JSON.stringify({ restoreDocumentTabs: false }),
    );
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await expect(page.locator(".app-shell")).not.toHaveClass(/is-empty-workspace/);
  await expect(page.getByRole("tab", { name: "بدون عنوان.md" })).toBeVisible();
  await expect(page.getByRole("region", { name: "ویرایشگر Markdown" })).toBeVisible();
});
