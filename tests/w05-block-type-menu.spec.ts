import { expect, test } from "@playwright/test";
import { openWritingDocument } from "./helpers/open-writing-document";

const BLOCK_TYPE_LABELS = [
  "تیتر ۱\n/h1",
  "تیتر ۲\n/h2",
  "تیتر ۳\n/h3",
  "متن معمولی\n/text",
  "جداکننده\n/divider",
  "چک‌لیست\n/todo",
  "فهرست بولت\n/bullet",
  "فهرست مراحل\n/number",
  "بلوک کد\n/code",
  "نقل‌قول\n/quote",
  "جدول\n/table",
  "Mermaid\n/mermaid",
  "تصویر\n/image",
  "صوت\n/audio",
  "فرمول\n/formula",
];

test("W05 matches the complete block menu and preserves keyboard editing flow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page);

  const editor = page.locator("#markdown-editor .cm-content");
  const trigger = page.locator(".writing-block-type-trigger");
  await editor.focus();
  await page.keyboard.press("Control+End");
  await trigger.click();

  const menu = page.getByRole("menu", { name: "نوع بلوک" });
  const items = menu.getByRole("menuitemradio");
  await expect(menu).toBeVisible();
  await expect(items).toHaveCount(15);
  expect(await items.allInnerTexts()).toEqual(BLOCK_TYPE_LABELS);
  await expect(menu.getByRole("separator")).toHaveCount(2);
  await expect(trigger).toHaveAttribute("aria-expanded", "true");

  const paragraph = menu.getByRole("menuitemradio", {
    name: "متن معمولی",
  });
  await expect(paragraph).toHaveAttribute("aria-checked", "true");
  await expect(paragraph).toBeFocused();

  const geometry = await page.evaluate(() => {
    const roundedRect = (selector: string) => {
      const bounds = document
        .querySelector<HTMLElement>(selector)!
        .getBoundingClientRect();
      return {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    const menuElement = document.querySelector<HTMLElement>(
      ".editor-block-menu",
    )!;
    const itemElements = Array.from(
      menuElement.querySelectorAll<HTMLElement>('[role="menuitemradio"]'),
    );
    const dividerElements = Array.from(
      menuElement.querySelectorAll<HTMLElement>('[role="separator"]'),
    );
    const menuStyle = getComputedStyle(menuElement);
    const triggerStyle = getComputedStyle(
      document.querySelector<HTMLElement>(".writing-block-type-trigger")!,
    );
    const heading = menuElement.querySelector<HTMLElement>(
      ".editor-context-menu-heading",
    )!;
    return {
      menu: roundedRect(".editor-block-menu"),
      gutter: roundedRect(".writing-block-gutter"),
      trigger: roundedRect(".writing-block-type-trigger"),
      itemHeights: itemElements.map((item) =>
        Math.round(item.getBoundingClientRect().height),
      ),
      itemContentPositions: itemElements.map((item) => ({
        titleX: Math.round(
          item.querySelector<HTMLElement>("span")!.getBoundingClientRect().x,
        ),
        aliasX: Math.round(
          item.querySelector<HTMLElement>("small")!.getBoundingClientRect().x,
        ),
      })),
      dividers: dividerElements.map((divider) => ({
        width: Math.round(divider.getBoundingClientRect().width),
        height: Math.round(divider.getBoundingClientRect().height),
      })),
      radius: menuStyle.borderRadius,
      borderWidth: menuStyle.borderWidth,
      background: menuStyle.backgroundColor,
      shadow: menuStyle.boxShadow,
      triggerColor: triggerStyle.color,
      triggerBackground: triggerStyle.backgroundColor,
      headingHeight: Math.round(heading.getBoundingClientRect().height),
      headingOverflow: heading.scrollHeight > heading.clientHeight,
    };
  });

  expect(geometry.menu).toEqual({
    x: 679,
    y: 171,
    width: 320,
    height: 378,
  });
  expect(geometry.gutter).toEqual({ x: 999, y: 323, width: 58, height: 28 });
  expect(geometry.trigger).toEqual({ x: 999, y: 323, width: 28, height: 28 });
  expect(new Set(geometry.itemHeights)).toEqual(new Set([26]));
  expect(
    geometry.itemContentPositions.every(({ titleX, aliasX }) => titleX > aliasX),
  ).toBe(true);
  expect(geometry.dividers).toEqual([
    { width: 304, height: 1 },
    { width: 304, height: 1 },
  ]);
  expect(geometry.radius).toBe("6px");
  expect(geometry.borderWidth).toBe("0px");
  expect(geometry.background).toBe("rgb(252, 253, 249)");
  expect(geometry.shadow).toContain("0px 14px 17px");
  expect(geometry.triggerColor).toBe("rgb(37, 87, 229)");
  expect(geometry.triggerBackground).toBe("rgb(233, 239, 255)");
  expect(geometry.headingHeight).toBe(28);
  expect(geometry.headingOverflow).toBe(false);

  await page.screenshot({
    path: ".artifacts/w05-block-type-menu.png",
    fullPage: true,
  });

  await page.keyboard.press("ArrowDown");
  await expect(
    menu.getByRole("menuitemradio", { name: "جداکننده" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(paragraph).toBeFocused();
  await page.keyboard.press("Home");
  await expect(
    menu.getByRole("menuitemradio", { name: "تیتر ۱" }),
  ).toBeFocused();
  await page.keyboard.press("End");
  await expect(
    menu.getByRole("menuitemradio", { name: "فرمول" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await editor.fill("");
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
  await editor.focus();
  await page.keyboard.type("/formula");
  await expect(menu).toBeVisible();
  await expect(items).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(editor).toBeFocused();
  await expect(editor.locator(".cm-line").first()).toHaveClass(
    /cm-live-empty-block/,
  );
  await expect(editor).not.toContainText("/formula");

  await page.keyboard.type("/zzzzzz");
  await expect(menu).toBeVisible();
  await expect(items).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(menu).toBeVisible();
  await expect(editor).toContainText("/zzzzzz");
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(editor).toBeFocused();
  await expect(editor.locator(".cm-line").first()).toHaveClass(
    /cm-live-empty-block/,
  );
  await expect(editor).not.toContainText("/zzzzzz");

  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("/code");
  await expect(menu).toBeVisible();
  await expect(items).toHaveCount(1);
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expect(page.locator(".cm-ch")).toContainText("text");
  // Code styling is applied to every rendered line in the block.
  await expect(page.locator(".cm-c").first()).toBeVisible();
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect(editor).toContainText("```text");
  await editor.fill("");
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();

  await editor.focus();
  await page.keyboard.press("Alt+Shift+C");
  await expect(page.locator(".cm-ch")).toContainText("text");
  await expect(page.locator(".cm-c").first()).toBeVisible();
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await editor.fill("");
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();

  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("/");
  await expect(menu).toBeVisible();
  await expect(editor).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expect(editor).toBeFocused();
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect(editor).not.toContainText("/");
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();

  await editor.fill("");
  await editor.focus();
  await page.keyboard.type("/");
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitemradio", { name: "جدول" }).click();
  const tableHelper = page.getByRole("dialog", { name: "جدول" });
  await expect(tableHelper).toBeVisible();
  const tableSizeGrid = tableHelper.getByRole("grid", {
    name: "انتخاب تعداد ستون و ردیف جدول",
  });
  await expect(tableSizeGrid).toBeFocused();
  await expect(tableHelper).toContainText("۳ × ۲");
  await page.keyboard.press("ArrowLeft");
  await expect(tableHelper).toContainText("۴ × ۲");
  await page.keyboard.press("ArrowDown");
  await expect(tableHelper).toContainText("۴ × ۳");
  await page.keyboard.press("Escape");
  await expect(tableHelper).toBeHidden();
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect(editor).not.toContainText("/");
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();

  await editor.fill("متن نمونه");
  await editor.focus();
  await page.keyboard.press("End");
  await trigger.click();
  const headingTwo = menu.getByRole("menuitemradio", { name: "تیتر ۲" });
  await headingTwo.focus();
  await page.keyboard.press("Enter");
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(editor).toBeFocused();

  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect(editor).toContainText("## متن نمونه");
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
  await editor.focus();
  await page.keyboard.press("End");
  await trigger.click();
  await expect(
    menu.getByRole("menuitemradio", { name: "تیتر ۲" }),
  ).toHaveAttribute("aria-checked", "true");
  await menu.getByRole("menuitemradio", { name: "متن معمولی" }).click();
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect(editor).toContainText("متن نمونه");
  await expect(editor).not.toContainText("## متن نمونه");

  await editor.fill("```text\nخط اول\n# کد خام\n```");
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
  await expect(editor).toContainText("# کد خام");
  await expect(page.locator(".cm-rich-code")).toHaveCount(0);
  await trigger.click();
  await menu.getByRole("menuitemradio", { name: "متن معمولی" }).click();
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect(editor).toContainText("خط اول");
  await expect(editor).toContainText("# کد خام");
  await expect(editor).not.toContainText("```");

  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
  await editor.fill("");
  await editor.focus();
  await page.keyboard.type("/");
  await menu.getByRole("menuitemradio", { name: "Mermaid" }).click();
  const graphStudio = page.getByRole("dialog", { name: "استودیو گراف" });
  await expect(graphStudio).toBeVisible();
  await graphStudio.getByRole("button", { name: "بازگشت به سند" }).click();
  await expect(graphStudio).toBeHidden();
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect(editor).not.toContainText("/");

});
