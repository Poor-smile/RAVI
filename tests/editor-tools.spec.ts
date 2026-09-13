import { expect, test, type Page } from "@playwright/test";
import { openWritingDocument } from "./helpers/open-writing-document";

async function writingEditor(page: Page) {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await openWritingDocument(page, { content: "" });
  const editor = page.locator("#markdown-editor .cm-content");
  await expect(editor).toBeVisible();
  return editor;
}

async function markdownFromClipboard(page: Page) {
  const editor = page.locator("#markdown-editor .cm-content");
  await editor.focus();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Control+c");
  return page.evaluate(() => navigator.clipboard.readText());
}

async function selectedTextFromClipboard(page: Page) {
  await page.keyboard.press("Control+c");
  return page.evaluate(() => navigator.clipboard.readText());
}

async function replaceDocumentInLiveEdit(
  page: Page,
  editor: ReturnType<Page["locator"]>,
  source: string,
) {
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await editor.fill(source);
  await page
    .getByRole("button", { name: "ویرایش روان", exact: true })
    .click();
}

test.describe("ابزارهای contextual ویرایش", () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  });

  test("keeps editing contextual and preserves multiline undo from the command bar", async ({ page }) => {
    const editor = await writingEditor(page);
    await expect(
      page.getByRole("toolbar", { name: "ابزارهای اصلی ویرایش" }),
    ).toBeHidden();
    await expect(
      page.locator(".topbar-primary-actions > button:visible"),
    ).toHaveCount(7);
    await editor.fill("خط اول\nخط دوم");
    await editor.focus();
    await page.keyboard.press("Control+a");
    const selectionToolbar = page.getByRole("toolbar", {
      name: "قالب‌بندی متن انتخاب‌شده",
    });
    await expect(selectionToolbar).toBeVisible();
    await expect(selectionToolbar.getByRole("button")).toHaveCount(8);
    await selectionToolbar
      .getByRole("button", { name: "پررنگ", exact: true })
      .click();
    expect(await markdownFromClipboard(page)).toBe("**خط اول\nخط دوم**");

    await page
      .getByRole("button", { name: "واگرد آخرین تغییر", exact: true })
      .click();
    expect(await markdownFromClipboard(page)).toBe("خط اول\nخط دوم");
  });

  test("copies and pastes the active selection from the mini menu", async ({ page }) => {
    const editor = await writingEditor(page);
    const toolbar = page.getByRole("toolbar", {
      name: "قالب‌بندی متن انتخاب‌شده",
    });

    await editor.fill("متن نخست");
    await editor.focus();
    await page.keyboard.press("Control+Home");
    await page.keyboard.press("Shift+End");
    await expect(toolbar).toBeVisible();

    const copy = toolbar.getByRole("button", { name: "کپی", exact: true });
    const paste = toolbar.getByRole("button", {
      name: "جای‌گذاری",
      exact: true,
    });
    await expect(copy).toHaveAttribute("aria-keyshortcuts", "Control+C Meta+C");
    await expect(paste).toHaveAttribute("aria-keyshortcuts", "Control+V Meta+V");
    const more = toolbar.getByRole("button", {
      name: "ابزارهای بیشتر",
      exact: true,
    });
    await more.click();
    const moreMenu = page.getByRole("menu", {
      name: "ابزارهای بیشتر متن انتخاب‌شده",
    });
    await expect(moreMenu).toBeVisible();
    await expect(moreMenu.getByRole("menuitem")).toHaveCount(5);
    await page.waitForTimeout(180);
    await page.screenshot({
      path: ".artifacts/editor-mini-menu-copy-paste.png",
      fullPage: true,
    });
    await moreMenu.screenshot({
      path: ".artifacts/editor-mini-menu-more.png",
    });
    await page.keyboard.press("Escape");
    await expect(moreMenu).toBeHidden();
    await expect(more).toBeFocused();

    await copy.click();
    await expect
      .poll(() => page.evaluate(() => navigator.clipboard.readText()))
      .toContain("متن نخست");

    await page.evaluate(() => navigator.clipboard.writeText("متن جایگزین"));
    await paste.click();
    await expect(editor).toContainText("متن جایگزین");
    await expect(page.locator(".toast")).toContainText("متن جای‌گذاری شد");
  });

  test("inserts a link without syntax knowledge and restores focus on Escape", async ({ page }) => {
    const editor = await writingEditor(page);
    await editor.fill("راوی");
    await editor.focus();
    await page.keyboard.press("Control+a");
    const linkButton = page
      .getByRole("toolbar", { name: "قالب‌بندی متن انتخاب‌شده" })
      .getByRole("button", { name: "افزودن پیوند", exact: true });
    await linkButton.click();
    const helper = page.getByRole("dialog", { name: "پیوند" });
    const url = helper.getByRole("textbox", { name: "نشانی پیوند" });
    await expect(url).toBeFocused();
    await url.fill("https://ravi.example/docs");
    await helper.getByRole("button", { name: "درج پیوند" }).click();
    expect(await markdownFromClipboard(page)).toBe("[راوی](https://ravi.example/docs)");

    await editor.focus();
    await page.keyboard.press("Control+a");
    await expect(linkButton).toBeVisible();
    await linkButton.click();
    await page.keyboard.press("Escape");
    await expect(helper).toBeHidden();
    await expect(editor).toBeFocused();
  });

  test("applies the complete selection toolbar without losing selection", async ({ page }) => {
    const editor = await writingEditor(page);
    const toolbar = page.getByRole("toolbar", {
      name: "قالب‌بندی متن انتخاب‌شده",
    });

    const applyAndRead = async (buttonName: string, source: string) => {
      await replaceDocumentInLiveEdit(page, editor, source);
      await editor.focus();
      await page.keyboard.press("Control+a");
      await expect(toolbar).toBeVisible();
      const primaryAction = toolbar.getByRole("button", {
        name: buttonName,
        exact: true,
      });
      if (await primaryAction.count()) {
        await primaryAction.click();
      } else {
        await toolbar
          .getByRole("button", { name: "ابزارهای بیشتر", exact: true })
          .click();
        await page
          .getByRole("menu", { name: "ابزارهای بیشتر متن انتخاب‌شده" })
          .getByRole("menuitem", { name: buttonName, exact: true })
          .click();
      }
      expect(await selectedTextFromClipboard(page)).toBe("راوی");
      return markdownFromClipboard(page);
    };

    expect(await applyAndRead("زیرخط‌دار", "راوی")).toBe("<u>راوی</u>");
    expect(await applyAndRead("خط‌خورده", "راوی")).toBe("~~راوی~~");
    expect(await applyAndRead("کد درون‌خطی", "راوی")).toBe("`راوی`");
    expect(
      await applyAndRead("پاک‌کردن قالب‌بندی", "**_<u>راوی</u>_**"),
    ).toBe("راوی");

    await replaceDocumentInLiveEdit(page, editor, "<u>راوی</u>");
    await page
      .getByRole("button", { name: "نمونه‌خوانی دوبرگی", exact: true })
      .click();
    await expect(page.locator("#writing-editor .cm-live-underline")).toHaveText("راوی");
  });

  test("supports Alt+F10 and roving keyboard focus without losing selection", async ({ page }) => {
    const editor = await writingEditor(page);
    const toolbar = page.getByRole("toolbar", {
      name: "قالب‌بندی متن انتخاب‌شده",
    });
    const copy = toolbar.getByRole("button", { name: "کپی", exact: true });
    const paste = toolbar.getByRole("button", { name: "جای‌گذاری", exact: true });
    const bold = toolbar.getByRole("button", { name: "پررنگ", exact: true });
    const italic = toolbar.getByRole("button", { name: "مورب", exact: true });
    const more = toolbar.getByRole("button", {
      name: "ابزارهای بیشتر",
      exact: true,
    });
    const moreMenu = page.getByRole("menu", {
      name: "ابزارهای بیشتر متن انتخاب‌شده",
    });

    await editor.fill("راوی");
    await editor.focus();
    await page.keyboard.press("Control+a");
    await expect(toolbar).toBeVisible();
    await editor.dispatchEvent("keydown", {
      key: "F10",
      code: "F10",
      altKey: true,
    });
    await expect(toolbar).toHaveAttribute("aria-keyshortcuts", "Alt+F10");
    await expect(copy).toBeFocused();
    await expect(toolbar.locator('button[tabindex="0"]')).toHaveCount(1);
    await expect(toolbar.locator('button[tabindex="-1"]')).toHaveCount(7);

    await page.keyboard.press("ArrowLeft");
    await expect(more).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(copy).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(paste).toBeFocused();
    await page.keyboard.press("End");
    await expect(more).toBeFocused();
    await page.keyboard.press("Home");
    await expect(copy).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(bold).toBeFocused();
    await page.keyboard.press("End");
    await expect(more).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(moreMenu).toBeVisible();
    const underline = moreMenu.getByRole("menuitem", {
      name: "زیرخط‌دار",
      exact: true,
    });
    await expect(underline).toBeFocused();
    await page.keyboard.press("Enter");
    expect(await selectedTextFromClipboard(page)).toBe("راوی");
    expect(await markdownFromClipboard(page)).toBe("<u>راوی</u>");

    await replaceDocumentInLiveEdit(page, editor, "راوی");
    await expect(toolbar).toBeHidden();
    await editor.focus();
    await page.keyboard.press("Control+a");
    await expect(toolbar).toBeVisible();
    await editor.dispatchEvent("keydown", {
      key: "F10",
      code: "F10",
      altKey: true,
    });
    await expect(page.locator(".editor-selection-mini-menu button:focus")).toHaveCount(1);
    await page.keyboard.press("Home");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect(italic).toBeFocused();
    await page.keyboard.press("Space");
    expect(await selectedTextFromClipboard(page)).toBe("راوی");
    expect(await markdownFromClipboard(page)).toBe("_راوی_");

    await replaceDocumentInLiveEdit(page, editor, "راوی");
    await expect(toolbar).toBeHidden();
    await editor.focus();
    await page.keyboard.press("Control+a");
    await expect(toolbar).toBeVisible();
    await editor.dispatchEvent("keydown", {
      key: "F10",
      code: "F10",
      altKey: true,
    });
    await expect(page.locator(".editor-selection-mini-menu button:focus")).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(toolbar).toBeHidden();
    await expect(editor).toBeFocused();
    expect(await selectedTextFromClipboard(page)).toBe("راوی");
  });

  test("executes all nine Selection Toolbar actions from the keyboard", async ({ page }) => {
    const editor = await writingEditor(page);
    const toolbar = page.getByRole("toolbar", {
      name: "قالب‌بندی متن انتخاب‌شده",
    });
    const focusToolbar = async (source = "راوی") => {
      await page.getByRole("button", { name: "متن خام", exact: true }).click();
      await editor.fill(source);
      await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
      await expect(toolbar).toBeHidden();
      await editor.focus();
      await expect(editor).toBeFocused();
      await editor.press("Control+a");
      await expect(toolbar).toBeVisible();
      await editor.dispatchEvent("keydown", {
        key: "F10",
        code: "F10",
        altKey: true,
      });
      await expect(toolbar.locator("button:focus")).toHaveCount(1);
      await page.keyboard.press("Home");
      await expect(toolbar.getByRole("button").first()).toBeFocused();
    };

    const focusPrimaryAction = async (index: number, source = "راوی") => {
      await focusToolbar(source);
      for (let step = 0; step < index; step += 1) {
        await page.keyboard.press("ArrowRight");
      }
      await expect(toolbar.getByRole("button").nth(index)).toBeFocused();
    };

    const focusMoreAction = async (index: number, source = "راوی") => {
      await focusPrimaryAction(7, source);
      await page.keyboard.press("Enter");
      const menu = page.getByRole("menu", {
        name: "ابزارهای بیشتر متن انتخاب‌شده",
      });
      await expect(menu).toBeVisible();
      await page.keyboard.press("Home");
      for (let step = 0; step < index; step += 1) {
        await page.keyboard.press("ArrowDown");
      }
      await expect(menu.getByRole("menuitem").nth(index)).toBeFocused();
      return menu;
    };

    await focusPrimaryAction(2);
    await page.keyboard.press("Enter");
    expect(await markdownFromClipboard(page)).toBe("**راوی**");

    await focusPrimaryAction(3);
    await page.keyboard.press("Space");
    expect(await markdownFromClipboard(page)).toBe("_راوی_");

    await focusPrimaryAction(4);
    await page.keyboard.press("Enter");
    const linkDialog = page.getByRole("dialog", { name: "پیوند" });
    await expect(linkDialog).toBeVisible();
    await linkDialog
      .getByRole("textbox", { name: "نشانی پیوند" })
      .fill("https://ravi.example/keyboard");
    await page.keyboard.press("Enter");
    await expect(linkDialog).toBeHidden();
    expect(await markdownFromClipboard(page)).toBe(
      "[راوی](https://ravi.example/keyboard)",
    );

    await focusPrimaryAction(5);
    await page.keyboard.press("Enter");
    await expect(page.getByText("هایلایت ثبت شد.", { exact: true })).toBeVisible();

    for (const action of [
      { index: 0, expected: "<u>راوی</u>" },
      { index: 1, expected: "~~راوی~~" },
      { index: 2, expected: "`راوی`" },
    ]) {
      await focusMoreAction(action.index);
      await page.keyboard.press(action.index % 2 === 0 ? "Enter" : "Space");
      expect(await markdownFromClipboard(page)).toBe(action.expected);
    }

    await focusMoreAction(3);
    await page.keyboard.press("Enter");
    const commentComposer = page.locator(".annotation-toolbar:not([hidden])");
    await expect(commentComposer).toBeVisible();
    await expect(commentComposer.locator("textarea")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(commentComposer).toBeHidden();

    await focusMoreAction(4, "**راوی**");
    await page.keyboard.press("Enter");
    expect(await markdownFromClipboard(page)).toBe("راوی");
  });

  test("routes Mod+K and reuses annotations for editor selections", async ({ page }) => {
    const editor = await writingEditor(page);
    await editor.fill("راوی");
    await editor.focus();
    await page.keyboard.press("Control+a");

    await page.keyboard.press("Control+k");
    const linkDialog = page.getByRole("dialog", { name: "پیوند" });
    await expect(linkDialog).toBeVisible();
    await expect(linkDialog.getByRole("textbox", { name: "نشانی پیوند" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(editor).toBeFocused();
    expect(await selectedTextFromClipboard(page)).toBe("راوی");

    await page.keyboard.press("End");
    await page.keyboard.press("Control+k");
    const commandCenter = page.getByRole("dialog", { name: "مرکز فرمان راوی" });
    await expect(commandCenter).toBeVisible();
    await page.keyboard.press("Escape");

    await editor.focus();
    await page.keyboard.press("Control+a");
    const toolbar = page.getByRole("toolbar", {
      name: "قالب‌بندی متن انتخاب‌شده",
    });
    await toolbar.getByRole("button", { name: "هایلایت", exact: true }).click();
    await expect(page.getByText("هایلایت ثبت شد.", { exact: true })).toBeVisible();
    expect(await selectedTextFromClipboard(page)).toBe("راوی");

    await editor.focus();
    await page.keyboard.press("Control+a");
    await toolbar
      .getByRole("button", { name: "ابزارهای بیشتر", exact: true })
      .click();
    await page
      .getByRole("menu", { name: "ابزارهای بیشتر متن انتخاب‌شده" })
      .getByRole("menuitem", { name: "نظر", exact: true })
      .click();
    const composer = page.locator(".annotation-toolbar:not([hidden])");
    await expect(composer).toBeVisible();
    await expect(composer.locator("q")).toHaveText("راوی");
    await expect(composer.locator("textarea")).toBeFocused();
    await page.keyboard.press("Escape");
    await editor.focus();
    expect(await selectedTextFromClipboard(page)).toBe("راوی");
  });

  test("opens the active-line block menu and lightweight table/image helpers", async ({ page }) => {
    const editor = await writingEditor(page);
    await editor.fill("یک بند ساده");
    await editor.focus();
    await page.keyboard.press("Home");
    const trigger = page.locator(".writing-block-type-trigger");
    await expect(trigger).toHaveAttribute("aria-label", "بازکردن منوی ساختار خط فعال");
    await trigger.click();
    const blockMenu = page.getByRole("menu", { name: "نوع بلوک" });
    await expect(blockMenu).toBeVisible();
    await expect(blockMenu.getByRole("menuitemradio")).toHaveCount(15);
    await expect(
      blockMenu.getByRole("menuitemradio", { name: "جداکننده" }),
    ).toBeVisible();
    await page.screenshot({
      path: ".artifacts/divider-block-menu.png",
      fullPage: false,
    });
    await blockMenu.getByRole("menuitemradio", { name: "جدول" }).click();
    const table = page.getByRole("dialog", { name: "جدول" });
    const tableGrid = table.getByRole("grid", {
      name: "انتخاب تعداد ستون و ردیف جدول",
    });
    await expect(tableGrid).toBeFocused();
    await table
      .getByRole("gridcell", { name: "۳ ستون و ۲ ردیف", exact: true })
      .click();
    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    await expect(editor).toContainText("| ستون 1 | ستون 2 | ستون 3 |");
    await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();

    await editor.focus();
    await page.keyboard.press("Control+End");
    await trigger.click();
    await page
      .getByRole("menu", { name: "نوع بلوک" })
      .getByRole("menuitemradio", { name: "تصویر" })
      .click();
    const image = page.getByRole("dialog", { name: "تصویر" });
    await expect(image.getByRole("button", { name: "انتخاب فایل" })).toBeVisible();
    await expect(image.getByRole("button", { name: "درج نشانی" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "افزودن تصویر" })).toHaveCount(0);
  });

  test("keeps one block-only slash menu open for Persian and English queries", async ({ page }) => {
    const editor = await writingEditor(page);
    await editor.fill("");
    await editor.focus();
    await page.keyboard.type("/");
    const slash = page.getByRole("menu", { name: "نوع بلوک" });
    await expect(slash).toBeVisible();
    await expect(slash.getByRole("menuitemradio")).toHaveCount(15);
    await expect(slash.getByRole("menuitemradio", { name: "بلوک کد" })).toBeVisible();
    await expect(slash.getByRole("menuitemradio", { name: "فرمول" })).toBeVisible();

    await page.keyboard.type("tbl");
    await expect(slash).toBeVisible();
    await expect(slash.getByRole("menuitemradio")).toHaveCount(1);
    await expect(slash.getByRole("menuitemradio", { name: "جدول" })).toBeVisible();
    await page.keyboard.press("Escape");
    await editor.fill("");
    await page.keyboard.type("/تصویر");
    await expect(slash).toBeVisible();
    await expect(slash.getByRole("menuitemradio", { name: "تصویر" })).toBeVisible();

    await page.keyboard.press("Escape");
    await editor.fill("متن");
    await editor.focus();
    await page.keyboard.press("End");
    await page.keyboard.type("/");
    await expect(slash).toBeHidden();

    await editor.fill("");
    await editor.focus();
    await page.keyboard.type("/formula");
    await expect(slash).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(slash).toBeHidden();
    const formulaStudio = page.getByRole("dialog", { name: "استودیو فرمول" });
    await expect(formulaStudio).toBeVisible();
    await formulaStudio.getByRole("button", { name: "بازگشت به سند" }).click();
    await expect(formulaStudio).toBeHidden();
    expect(await markdownFromClipboard(page)).toBe("");

    await page.setViewportSize({ width: 375, height: 760 });
    await expect(page.locator('.mobile-tabs')).toHaveCount(0);
    await expect(editor).toBeVisible();
    await expect(page.locator('.editor-mode-switcher button[aria-pressed="true"]'))
      .toHaveAttribute("aria-label", "ویرایش روان");
    expect(await markdownFromClipboard(page)).toBe("");
  });

  test("inserts a portable divider with its registered shortcut", async ({ page }) => {
    const editor = await writingEditor(page);
    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    await editor.focus();
    await page.keyboard.press("Control+a");
    await page.keyboard.insertText("بخش نخست");
    await page.waitForTimeout(100);
    await editor.focus();
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Alt+Shift+H");
    expect(
      (await editor.locator(".cm-line").allTextContents()).join("\n"),
    ).toBe("بخش نخست\n\n---");
  });
});
