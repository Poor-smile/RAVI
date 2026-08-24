import { expect, test } from "@playwright/test";
import { openWritingDocument } from "./helpers/open-writing-document";

test("AI chat opens from the document, block and text selection contexts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page);

  const railTrigger = page.getByRole("button", {
    name: "راوی هوشمند",
    exact: true,
  });
  await railTrigger.click();
  await expect(page.locator("#sidebar-pane-title")).toHaveText("راوی هوشمند");
  await expect(page.locator(".ai-context-chip")).toContainText("کل سند");
  await expect(page.locator(".ai-chat-panel")).toContainText(
    "این اتصال در نسخهٔ دسکتاپ فعال است",
  );

  const editor = page.locator("#markdown-editor .cm-content");
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.locator(".writing-block-ai-trigger").click();
  await expect(page.locator(".ai-context-chip")).toContainText("بلاک فعال");

  await editor.fill("متن انتخاب‌شده برای گفتگو");
  await editor.focus();
  await page.keyboard.press("Control+a");
  const selectionToolbar = page.getByRole("toolbar", {
    name: "قالب‌بندی متن انتخاب‌شده",
  });
  await expect(selectionToolbar).toBeVisible();
  await expect(
    selectionToolbar
      .getByRole("button", { name: "پاک‌کردن قالب‌بندی" })
      .locator('[data-material-symbol="format_clear"]'),
  ).toHaveCount(1);
  await expect(selectionToolbar.locator(".magic-wand-icon")).toHaveCount(1);
  await selectionToolbar
    .getByRole("button", { name: "گفت‌وگو دربارهٔ متن انتخاب‌شده" })
    .click();
  await expect(page.locator(".ai-context-chip")).toContainText(
    "متن انتخاب‌شده",
  );
});

test("AI composer uses one input for free prompts and all 47 slash commands", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page);
  await page.evaluate(() => {
    Object.defineProperty(window, "raaviDesktop", {
      configurable: true,
      value: {
        getCodexConnectionStatus: async () => ({ state: "connected" }),
        runCodexPrompt: async () => ({
          answer: "پیشنهاد آزمایشی آماده شد.",
          replacement: null,
        }),
      },
    });
  });

  await page.getByRole("button", { name: "راوی هوشمند", exact: true }).click();
  const composer = page.getByRole("combobox", {
    name: "پیام به راوی هوشمند",
  });
  await expect(composer).toBeVisible();
  await expect(composer).toHaveAttribute("dir", "rtl");
  await expect(composer).toHaveAttribute(
    "placeholder",
    "درخواستتان را بنویسید…",
  );
  await expect(page.locator(".ai-quick-prompts .ai-command-button")).toHaveCount(
    4,
  );

  await composer.fill("/");
  await expect(
    page.getByRole("listbox", { name: "فرمان‌های نوشتاری راوی" }),
  ).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(47);
  await expect
    .poll(() =>
      page
        .locator(".ai-command-button")
        .first()
        .evaluate((node) => getComputedStyle(node).fontSize),
    )
    .toBe("11px");
  await expect
    .poll(() => composer.evaluate((node) => getComputedStyle(node).fontSize))
    .toBe("12px");
  for (let index = 0; index < 12; index += 1) {
    await composer.press("ArrowDown");
  }
  await expect(page.getByRole("option").nth(12)).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect
    .poll(() =>
      page.locator(".ai-command-results").evaluate((node) => node.scrollTop),
    )
    .toBeGreaterThan(0);
  await composer.fill("/جدول");
  await expect(page.getByRole("option")).toHaveCount(4);
  await expect(page.getByRole("option").first()).toContainText("جدول");

  await composer.fill("");
  await expect(
    page.getByRole("listbox", { name: "فرمان‌های نوشتاری راوی" }),
  ).toHaveCount(0);
  await expect(page.locator(".ai-quick-prompts .ai-command-button")).toHaveCount(
    4,
  );
});
