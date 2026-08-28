import { expect, test, type Locator } from "@playwright/test";
import { openWritingDocument as openWritingWorkspace } from "./helpers/open-writing-document";

async function sourceText(editor: Locator) {
  return (await editor.locator(".cm-line").allTextContents()).join("\n");
}

async function openWritingDocument(page: import("@playwright/test").Page) {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingWorkspace(page, { content: "" });
  const editor = page.locator("#markdown-editor .cm-content");
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await editor.fill("بلوک اول\n\nبلوک دوم\n\nبلوک سوم");
  await page
    .getByRole("button", { name: "ویرایش روان", exact: true })
    .click();
  return editor;
}

test("W14 keeps structural block selection separate from text selection and restores text focus on Escape", async ({
  page,
}) => {
  const editor = await openWritingDocument(page);
  const middleLine = editor.locator(".cm-line").filter({ hasText: "بلوک دوم" });
  await middleLine.click();

  const handle = page.getByRole("button", {
    name: "انتخاب و جابجایی بلوک فعال",
  });
  await handle.click();

  const selected = editor.locator(".cm-structural-block-selected");
  await expect(selected).toHaveCount(1);
  await expect(selected).toHaveText("بلوک دوم");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("toolbar", { name: "قالب‌بندی متن انتخاب‌شده" }),
  ).toBeHidden();

  const contract = await selected.evaluate((line) => {
    const bounds = line.getBoundingClientRect();
    const style = getComputedStyle(line);
    const frame = getComputedStyle(line, "::after");
    const selection = window.getSelection();
    return {
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      background: style.backgroundColor,
      radius: style.borderRadius,
      borderInlineStart: frame.borderInlineStartColor,
      borderInlineStartWidth: frame.borderInlineStartWidth,
      borderBlockStart: frame.borderBlockStartColor,
      borderBlockEnd: frame.borderBlockEndColor,
      textSelectionCollapsed: selection?.isCollapsed ?? false,
    };
  });
  expect(contract).toEqual({
    width: 760,
    height: 34,
    background: "rgb(233, 239, 255)",
    radius: "6px",
    borderInlineStart: "rgb(37, 87, 229)",
    borderInlineStartWidth: "1px",
    borderBlockStart: "rgb(37, 87, 229)",
    borderBlockEnd: "rgb(37, 87, 229)",
    textSelectionCollapsed: true,
  });

  await handle.press("Escape");
  await expect(selected).toHaveCount(0);
  await expect(handle).toHaveAttribute("aria-pressed", "false");
  await expect(editor).toBeFocused();

  await middleLine.dblclick();
  await expect(selected).toHaveCount(0);
  await expect(
    page.getByRole("toolbar", { name: "قالب‌بندی متن انتخاب‌شده" }),
  ).toBeVisible();
});

test("W14 Duplicate and Reorder target the structurally selected whole block", async ({
  page,
}) => {
  const editor = await openWritingDocument(page);
  await editor.locator(".cm-line").filter({ hasText: "بلوک دوم" }).click();

  const handle = page.getByRole("button", {
    name: "انتخاب و جابجایی بلوک فعال",
  });
  await handle.click();
  await handle.press("Control+D");

  await expect.poll(() => sourceText(editor)).toBe(
    "بلوک اول\n\nبلوک دوم\n\nبلوک دوم\n\nبلوک سوم",
  );
  await expect(editor.locator(".cm-structural-block-selected")).toHaveCount(1);
  await expect(editor.locator(".cm-structural-block-selected")).toHaveText(
    "بلوک دوم",
  );

  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(
    "بلوک اول\n\nبلوک دوم\n\nبلوک سوم",
  );

  await page.keyboard.press("Alt+ArrowUp");
  await expect.poll(() => sourceText(editor)).toBe(
    "بلوک دوم\n\nبلوک اول\n\nبلوک سوم",
  );
  await expect(editor.locator(".cm-structural-block-selected")).toHaveText(
    "بلوک دوم",
  );

  await page.keyboard.press("Escape");
  await expect(editor.locator(".cm-structural-block-selected")).toHaveCount(0);
  await expect(editor).toBeFocused();
});
