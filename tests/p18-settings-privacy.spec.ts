import { expect, test, type Page } from "@playwright/test";

async function openPrivacySettings(page: Page) {
  await page.locator(".header-overflow-trigger").click();
  await page.locator('[data-overflow-action="shortcut-settings"]').click();
  await page
    .getByRole("navigation", { name: "دسته‌های تنظیمات" })
    .getByRole("button", { name: "حریم خصوصی و داده‌ها" })
    .click();
}

test("P18 Privacy & Data matches Figma, persists and clears only local recents", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await openPrivacySettings(page);

  const dialog = page.getByRole("dialog", { name: "حریم خصوصی و داده‌ها" });
  const imagePolicy = dialog.getByRole("radiogroup", {
    name: "شیوهٔ بارگیری تصاویر بیرونی",
  });
  await expect(imagePolicy.getByRole("radio")).toHaveCount(3);
  await expect(imagePolicy.getByRole("radio", { name: /هر بار بپرس/ })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(dialog.getByRole("switch", { name: "هشدار پیش از باز کردن لینک بیرونی" })).toHaveAttribute(
    "aria-checked",
    "true",
  );

  const geometry = await dialog.evaluate((node) => {
    const size = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { width: Math.round(rect.width), height: Math.round(rect.height) };
    };
    return {
      surface: size(node.querySelector(".privacy-settings")!),
      choices: Array.from(node.querySelectorAll(".privacy-image-choice"), size),
      row: size(node.querySelector(".privacy-link-section .settings-preference-row")!),
    };
  });
  expect(geometry.surface.width).toBe(1040);
  expect(geometry.choices).toEqual(Array(3).fill({ width: 252, height: 96 }));
  expect(geometry.row).toEqual({ width: 992, height: 88 });

  await imagePolicy.getByRole("radio", { name: /همیشه مسدود/ }).click();
  await dialog.getByRole("switch", { name: "هشدار پیش از باز کردن لینک بیرونی" }).click();
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem("raavi:privacy-preferences:v1") ?? "{}"),
  )).toEqual({ externalImagePolicy: "block", warnBeforeExternalLinks: false });

  const clearTrigger = dialog.getByRole("button", { name: "پاک کردن", exact: true });
  await clearTrigger.click();
  const clearGroup = dialog.getByRole("group", { name: "تأیید پاک کردن فهرست فایل‌های اخیر" });
  await expect(clearGroup.getByRole("button", { name: "تأیید" })).toBeFocused();
  await clearGroup.getByRole("button", { name: "انصراف" }).click();
  await expect(clearTrigger).toBeFocused();
  await clearTrigger.click();
  await clearGroup.getByRole("button", { name: "تأیید" }).click();
  await expect(page.locator(".toast")).toContainText("هیچ فایلی حذف نشد");
  await page.screenshot({ path: ".artifacts/p18-settings-privacy.png" });
});

test("P18 external image asks before any network request and external links warn", async ({ page }) => {
  let imageRequests = 0;
  await page.route("https://assets.example.test/**", async (route) => {
    imageRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90"/>',
    });
  });
  const content = [
    "# آزمون حریم خصوصی",
    "",
    "![نمونه](https://assets.example.test/image.svg)",
    "",
    "[مقصد بیرونی](https://example.com/path)",
  ].join("\n");
  await page.addInitScript((markdown) => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:privacy-preferences:v1", JSON.stringify({
      externalImagePolicy: "ask",
      warnBeforeExternalLinks: true,
    }));
    window.localStorage.setItem("raavi:document:v1", JSON.stringify({
      fileName: "privacy.md", content: markdown, readerSize: 18, annotations: [], assets: [],
      revision: 1, versions: [], activeDocumentPath: "", documentType: "markdown",
      lastSavedSnapshot: markdown, draftId: "p18", viewMode: "reading",
      readingOutlineOpen: false, readingPositions: {}, annotationComposer: null,
    }));
  }, content);
  await page.goto("/");
  const blocked = page.locator(".remote-media-blocked");
  await expect(blocked).toContainText("آمادهٔ بارگیری");
  expect(imageRequests).toBe(0);
  await blocked.getByRole("button", { name: "اجازه و بارگیری" }).click();
  await expect(page.locator('img[src="https://assets.example.test/image.svg"]')).toBeVisible();
  await expect.poll(() => imageRequests).toBe(1);

  await page.getByRole("link", { name: "مقصد بیرونی" }).click();
  const warning = page.getByRole("dialog", { name: "باز کردن لینک بیرونی؟" });
  await expect(warning).toContainText("https://example.com/path");
  await warning.getByRole("button", { name: "انصراف" }).click();
  await expect(warning).toHaveCount(0);

  await page.getByRole("button", { name: "بازگشت به میز", exact: true }).click();
  await expect(page.locator('.cm-rich-image img[src="https://assets.example.test/image.svg"]')).toBeVisible();
  expect(imageRequests).toBe(2);
});

test("P18 remains touch-safe and reset preserves the document snapshot", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("p18-reset")) return;
    localStorage.clear();
    localStorage.setItem("raavi:document:v1", JSON.stringify({
      fileName: "preserve.md", content: "# محفوظ", readerSize: 18,
      annotations: [], assets: [], revision: 1, versions: [],
      activeDocumentPath: "", documentType: "markdown",
      lastSavedSnapshot: "# محفوظ", draftId: "p18-preserve", viewMode: "writing",
      readingOutlineOpen: false, readingPositions: {}, annotationComposer: null,
    }));
    localStorage.setItem("raavi:privacy-preferences:v1", JSON.stringify({
      externalImagePolicy: "allow", warnBeforeExternalLinks: false,
    }));
    sessionStorage.setItem("p18-reset", "ready");
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  const editor = page.getByRole("textbox", { name: "متن Markdown" });
  await editor.click();
  await page.keyboard.press("End");
  await page.keyboard.type(" آخرین ویرایش");
  await page.evaluate(() => {
    window.raaviDesktop = {
      isDesktop: true,
      saveLocalDocumentSnapshot: async (snapshot: { content: string }) => {
        sessionStorage.setItem("p18-reset-flush", snapshot.content);
        await new Promise((resolve) => setTimeout(resolve, 40));
        return { saved: true };
      },
      saveReadingPositions: async () => ({ saved: true }),
    } as unknown as typeof window.raaviDesktop;
  });
  await openPrivacySettings(page);
  const dialog = page.getByRole("dialog", { name: "حریم خصوصی و داده‌ها" });
  const contract = await page.evaluate(() => ({
    heights: Array.from(document.querySelectorAll<HTMLElement>(".privacy-settings button"),
      (button) => Math.round(button.getBoundingClientRect().height)),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(contract.overflow).toBeLessThanOrEqual(0);
  for (const height of contract.heights) expect(height).toBeGreaterThanOrEqual(44);

  await dialog.getByRole("button", { name: "بازنشانی", exact: true }).click();
  await Promise.all([
    page.waitForEvent("framenavigated"),
    dialog.getByRole("group", { name: "تأیید بازنشانی همهٔ تنظیمات" })
      .getByRole("button", { name: "تأیید" }).click(),
  ]);
  expect(await page.evaluate(() =>
    JSON.parse(localStorage.getItem("raavi:document:v1") ?? "{}").fileName,
  )).toBe("preserve.md");
  expect(await page.evaluate(() => sessionStorage.getItem("p18-reset-flush"))).toContain(
    "آخرین ویرایش",
  );
  await expect.poll(() => page.evaluate(() =>
    JSON.parse(localStorage.getItem("raavi:privacy-preferences:v1") ?? "{}"),
  )).toEqual({ externalImagePolicy: "ask", warnBeforeExternalLinks: true });
});
