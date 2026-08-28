import { expect, test, type Locator } from "@playwright/test";
import { openWritingDocument } from "./helpers/open-writing-document";

async function sourceText(editor: Locator) {
  return (await editor.locator(".cm-line").allTextContents()).join("\n");
}

async function activeEditorLineIndex(editor: Locator) {
  return editor.evaluate((content) => {
    const selection = window.getSelection();
    const anchor = selection?.anchorNode;
    const line = anchor instanceof Element
      ? anchor.closest(".cm-line")
      : anchor?.parentElement?.closest(".cm-line");
    return line
      ? [...content.querySelectorAll(".cm-line")].indexOf(line)
      : -1;
  });
}

test("Ctrl+Enter and Duplicate share undoable whole-block operations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page, { content: "" });

  const editor = page.locator("#markdown-editor .cm-content");
  await editor.fill("بلوک اول\n\nبلوک دوم");
  await editor.focus();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Control+Enter");
  await expect.poll(() => sourceText(editor)).toBe(
    "بلوک اول\n\n\n\nبلوک دوم",
  );
  await expect(editor).toBeFocused();
  await expect.poll(() => activeEditorLineIndex(editor)).toBe(2);

  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe("بلوک اول\n\nبلوک دوم");

  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Control+D");
  await expect.poll(() => sourceText(editor)).toBe(
    "بلوک اول\n\nبلوک اول\n\nبلوک دوم",
  );

  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe("بلوک اول\n\nبلوک دوم");
});

test("Ctrl/Cmd+D prevents the browser default, duplicates multiline metadata and focuses the copy", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page, { content: "" });

  const editor = page.locator("#markdown-editor .cm-content");
  const block = [
    '```js title="نمونه" data-block-id="code-42"',
    'const metadata = { direction: "rtl" };',
    "console.log(metadata);",
    "```",
  ].join("\n");
  const original = ["قبل", "", block, "", "بعد"].join("\n");
  const duplicated = ["قبل", "", block, "", block, "", "بعد"].join("\n");
  await editor.fill(original);
  await page
    .locator(".cm-rich-code")
    .getByRole("button", { name: "ویرایش متن Markdown" })
    .click();
  await editor.focus();

  const shortcut = await editor.evaluate((content) => {
    const event = new KeyboardEvent("keydown", {
      key: "d",
      code: "KeyD",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    return {
      dispatchResult: content.dispatchEvent(event),
      defaultPrevented: event.defaultPrevented,
    };
  });
  expect(shortcut).toEqual({
    dispatchResult: false,
    defaultPrevented: true,
  });
  await expect(editor).toBeFocused();
  await expect
    .poll(() =>
      editor.evaluate(() => {
        const anchor = window.getSelection()?.anchorNode;
        const line = anchor instanceof Element
          ? anchor.closest(".cm-line")
          : anchor?.parentElement?.closest(".cm-line");
        return Boolean(line?.classList.contains("cm-structural-block-selected"));
      }),
    )
    .toBe(true);

  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect.poll(() => sourceText(editor)).toBe(duplicated);
  await editor.focus();
  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(original);
});

test("Enter continues a List Block while Ctrl+Enter exits to an independent Text Block", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page, { content: "" });

  const editor = page.locator("#markdown-editor .cm-content");
  await editor.fill("- مورد اول\n- مورد دوم");
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("مورد سوم");
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect.poll(() => sourceText(editor)).toBe(
    "- مورد اول\n- مورد دوم\n- مورد سوم",
  );
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
  await editor.focus();
  await page.keyboard.press("Control+End");

  // Empty list items remain inside the same List Block. Only Mod+Enter exits.
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect.poll(() => sourceText(editor)).toBe(
    "- مورد اول\n- مورد دوم\n- مورد سوم\n- \n- ",
  );
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
  await editor.focus();
  await page.keyboard.press("Control+End");

  await page.keyboard.press("Control+Enter");
  await expect(editor).toBeFocused();
  await expect.poll(() => activeEditorLineIndex(editor)).toBe(6);
  await page.keyboard.type("متن مستقل");
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect.poll(() => sourceText(editor)).toBe(
    "- مورد اول\n- مورد دوم\n- مورد سوم\n- \n- \n\nمتن مستقل",
  );
});

test("Alt+Arrow moves one complete multiline block in one undo step", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page, { content: "" });

  const editor = page.locator("#markdown-editor .cm-content");
  const original = [
    "بلوک اول",
    "",
    "```js",
    "const value = 1;",
    "console.log(value);",
    "```",
    "",
    "بلوک آخر",
  ].join("\n");
  await editor.fill(original);
  await page
    .locator(".cm-rich-code")
    .getByRole("button", { name: "ویرایش متن Markdown" })
    .click();

  const dragHandle = page.locator(".writing-block-drag-handle");
  await dragHandle.focus();
  await dragHandle.press("Alt+ArrowUp");
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect.poll(() => sourceText(editor)).toBe([
    "```js",
    "const value = 1;",
    "console.log(value);",
    "```",
    "",
    "بلوک اول",
    "",
    "بلوک آخر",
  ].join("\n"));

  await editor.focus();
  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(original);
});

test("Alt+Arrow announces direction, consumes document boundaries and ignores IME composition", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page, { content: "" });

  const editor = page.locator("#markdown-editor .cm-content");
  const announced = page.locator("#markdown-editor .cm-announced");
  const original = "بلوک اول\n\nبلوک دوم\n\nبلوک سوم";
  await editor.fill(original);
  await editor.focus();
  await page.keyboard.press("Control+Home");

  await page.keyboard.press("Alt+ArrowUp");
  await expect.poll(() => sourceText(editor)).toBe(original);
  await expect(announced).toContainText(
    "بلاک در ابتدای سند است و بالاتر نمی‌رود.",
  );

  await page.keyboard.press("Alt+ArrowDown");
  await expect.poll(() => sourceText(editor)).toBe(
    "بلوک دوم\n\nبلوک اول\n\nبلوک سوم",
  );
  await expect(announced).toContainText(
    "بلاک یک موقعیت به پایین منتقل شد.",
  );

  await page.keyboard.press("Alt+ArrowUp");
  await expect.poll(() => sourceText(editor)).toBe(original);
  await expect(announced).toContainText(
    "بلاک یک موقعیت به بالا منتقل شد.",
  );

  await editor.locator(".cm-line").filter({ hasText: "بلوک سوم" }).click();
  await page.keyboard.press("Alt+ArrowDown");
  await expect.poll(() => sourceText(editor)).toBe(original);
  await expect(announced).toContainText(
    "بلاک در انتهای سند است و پایین‌تر نمی‌رود.",
  );

  await editor.locator(".cm-line").filter({ hasText: "بلوک دوم" }).click();
  await editor.dispatchEvent("keydown", {
    key: "ArrowDown",
    code: "ArrowDown",
    altKey: true,
    isComposing: true,
  });
  await expect.poll(() => sourceText(editor)).toBe(original);
});

test("Drag routes through moveTo and remains one undoable operation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page, { content: "" });

  const editor = page.locator("#markdown-editor .cm-content");
  const original = ["بلوک اول", "", "بلوک دوم", "", "بلوک سوم"].join("\n");
  await editor.fill(original);
  await editor.focus();
  await page.keyboard.press("Control+Home");

  await page
    .locator(".writing-block-drag-handle")
    .dragTo(editor.locator(".cm-line").last());
  await expect.poll(() => sourceText(editor)).toBe(
    ["بلوک دوم", "", "بلوک سوم", "", "بلوک اول"].join("\n"),
  );

  await editor.focus();
  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(original);
});

test("Pointer Drag captures the handle, previews before/after, matches Alt+Arrow and cleans up cancellation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page, { content: "" });

  const editor = page.locator("#markdown-editor .cm-content");
  const host = page.locator("#markdown-editor");
  const handle = page.locator(".writing-block-drag-handle");
  const indicator = page.locator(".writing-block-drop-indicator");
  const selected = editor.locator(".cm-structural-block-selected");
  const original = "بلوک اول\n\nبلوک دوم\n\nبلوک سوم";
  await editor.fill(original);
  await editor.locator(".cm-line").filter({ hasText: "بلوک دوم" }).click();

  const handleBox = (await handle.boundingBox())!;
  const firstBox = (await editor
    .locator(".cm-line")
    .filter({ hasText: "بلوک اول" })
    .boundingBox())!;
  const lastBox = (await editor
    .locator(".cm-line")
    .filter({ hasText: "بلوک سوم" })
    .boundingBox())!;
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  );
  await page.mouse.down();

  const capture = await handle.evaluate((button) => {
    const pointerId = Number(button.getAttribute("data-pointer-id"));
    return {
      pointerId,
      captured: Number.isFinite(pointerId) && button.hasPointerCapture(pointerId),
    };
  });
  expect(capture.captured).toBe(true);

  await page.mouse.move(
    firstBox.x + firstBox.width / 2,
    firstBox.y + 2,
    { steps: 6 },
  );
  await expect(indicator).toBeVisible();
  await expect(indicator).toHaveAttribute("data-placement", "before");
  await expect(handle).toHaveAttribute("data-dragging", "true");
  await expect(host).toHaveAttribute("data-block-dragging", "true");

  await page.mouse.move(
    lastBox.x + lastBox.width / 2,
    lastBox.y + lastBox.height - 2,
    { steps: 6 },
  );
  await expect(indicator).toHaveAttribute("data-placement", "after");
  await page.mouse.up();

  const pointerOutput = "بلوک اول\n\nبلوک سوم\n\nبلوک دوم";
  await expect.poll(() => sourceText(editor)).toBe(pointerOutput);
  await expect(editor).toBeFocused();
  await expect(selected).toHaveText("بلوک دوم");
  await expect(indicator).toBeHidden();
  await expect(host).not.toHaveAttribute("data-block-dragging", /.+/u);
  await expect(handle).not.toHaveAttribute("data-pointer-id", /.+/u);
  await expect(handle).not.toHaveAttribute("data-dragging", /.+/u);
  expect(
    await handle.evaluate(
      (button, pointerId) => button.hasPointerCapture(pointerId),
      capture.pointerId,
    ),
  ).toBe(false);

  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(original);
  await editor.locator(".cm-line").filter({ hasText: "بلوک دوم" }).click();
  await handle.focus();
  await handle.press("Alt+ArrowDown");
  await expect.poll(() => sourceText(editor)).toBe(pointerOutput);

  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(original);
  await editor.locator(".cm-line").filter({ hasText: "بلوک دوم" }).click();
  const cancelHandleBox = (await handle.boundingBox())!;
  const cancelTargetBox = (await editor
    .locator(".cm-line")
    .filter({ hasText: "بلوک سوم" })
    .boundingBox())!;
  await page.mouse.move(
    cancelHandleBox.x + cancelHandleBox.width / 2,
    cancelHandleBox.y + cancelHandleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    cancelTargetBox.x + cancelTargetBox.width / 2,
    cancelTargetBox.y + cancelTargetBox.height - 2,
    { steps: 6 },
  );
  const cancelPointerId = Number(await handle.getAttribute("data-pointer-id"));
  await handle.dispatchEvent("pointercancel", {
    pointerId: cancelPointerId,
    pointerType: "mouse",
    isPrimary: true,
  });
  await page.mouse.up();

  await expect.poll(() => sourceText(editor)).toBe(original);
  await expect(indicator).toBeHidden();
  await expect(host).not.toHaveAttribute("data-block-dragging", /.+/u);
  await expect(handle).not.toHaveAttribute("data-pointer-id", /.+/u);
  await expect(handle).not.toHaveAttribute("data-dragging", /.+/u);
});
