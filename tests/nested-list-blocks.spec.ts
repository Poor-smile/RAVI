import { expect, test, type Locator, type Page } from "@playwright/test";
import { openWritingDocument } from "./helpers/open-writing-document";

async function sourceText(editor: Locator) {
  return (await editor.locator(".cm-line").allTextContents()).join("\n");
}

async function openWritingEditor(page: Page) {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page, { content: "" });
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  return page.locator("#markdown-editor .cm-content");
}

async function openWritingLiveEditor(page: Page) {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page, { content: "" });
  return page.locator("#markdown-editor .cm-content");
}

test("Enter keeps consecutive paragraph lines in one document block", async ({
  page,
}) => {
  const editor = await openWritingEditor(page);
  await editor.fill("خط اول");
  await editor.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.type("خط دوم");
  await expect.poll(() => sourceText(editor)).toBe("خط اول\nخط دوم");

  await editor.locator(".cm-line").first().click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Control+Enter");
  await page.keyboard.type("متن مستقل");
  await expect.poll(() => sourceText(editor)).toBe(
    "خط اول\nخط دوم\n\nمتن مستقل",
  );

  await editor.fill("بلاک اول");
  await editor.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Control+Enter");
  await page.keyboard.type("بلاک دوم");
  await editor.locator(".cm-line").filter({ hasText: "بلاک دوم" }).click();
  await page.keyboard.press("Home");
  await page.keyboard.press("Backspace");
  await expect.poll(() => sourceText(editor)).toBe("بلاک اول\n\nبلاک دوم");
  await editor.locator(".cm-line").filter({ hasText: "بلاک اول" }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Delete");
  await expect.poll(() => sourceText(editor)).toBe("بلاک اول\n\nبلاک دوم");
});

test("Enter never creates a document block and whole active content duplicates", async ({
  page,
}) => {
  const editor = await openWritingEditor(page);
  const activeBlock = "خط اول\n\nخط سوم";
  await editor.fill("خط اول");
  await editor.focus();
  await page.keyboard.press("End");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("خط سوم");
  await expect.poll(() => sourceText(editor)).toBe(activeBlock);

  await page.keyboard.press("Control+d");
  await expect.poll(() => sourceText(editor)).toBe(
    `${activeBlock}\n\n${activeBlock}`,
  );
  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(activeBlock);

  await page.keyboard.press("Control+Enter");
  await page.keyboard.type("بلاک مستقل");
  await expect.poll(() => sourceText(editor)).toBe(
    `${activeBlock}\n\nبلاک مستقل`,
  );
});

test("Live Edit exposes the complete active List Block as editable source", async ({
  page,
}) => {
  const editor = await openWritingLiveEditor(page);
  await editor.fill("- [ ] اول\n- [x] دوم\n\nمتن بعد");

  await editor.locator(".cm-line").filter({ hasText: "اول" }).click();
  await expect(editor.locator(".cm-live-task")).toHaveCount(0);
  await expect(
    editor.locator(".cm-line.cm-live-syntax-is-visible"),
  ).toHaveCount(2);

  await editor.locator(".cm-line").filter({ hasText: "متن بعد" }).click();
  await expect(editor.locator(".cm-live-task")).toHaveCount(2);
  await expect(
    editor.locator(".cm-line.cm-live-syntax-is-visible"),
  ).toHaveCount(1);

  const rhythm = await editor.locator(".cm-line").evaluateAll((lines) => {
    const [firstItem, secondItem, blockGap, nextBlock] = lines.map((line) =>
      line.getBoundingClientRect(),
    );
    return {
      listLineStep: Math.round(secondItem.top - firstItem.top),
      gapHeight: Math.round(blockGap.height),
      interBlockGap: Math.round(nextBlock.top - secondItem.bottom),
      gapClass: lines[2]?.classList.contains("cm-live-block-gap"),
      listClass: lines[0]?.classList.contains("cm-live-block-list"),
    };
  });
  expect(rhythm).toEqual({
    listLineStep: 18,
    gapHeight: 12,
    interBlockGap: 12,
    gapClass: true,
    listClass: true,
  });

  await editor.locator(".cm-line").filter({ hasText: "اول" }).click();
  await expect(
    editor.locator(".cm-line.cm-live-syntax-is-visible"),
  ).toHaveCount(2);
  const activeOutline = await editor
    .locator(".cm-line.cm-live-syntax-is-visible")
    .evaluateAll((lines) =>
      lines.map((line) => {
        const style = getComputedStyle(line);
        const outline = getComputedStyle(line, "::before");
        return {
          boxShadow: style.boxShadow,
          top: outline.borderTopWidth,
          bottom: outline.borderBottomWidth,
        };
      }),
    );
  expect(activeOutline).toEqual([
    { boxShadow: "none", top: "1px", bottom: "0px" },
    { boxShadow: "none", top: "0px", bottom: "1px" },
  ]);
});

test("Arrow navigation traverses every list item before crossing a block boundary", async ({
  page,
}) => {
  const editor = await openWritingLiveEditor(page);
  await editor.fill("متن بالا\n\n- [ ] اول\n- [ ] دوم\n- [ ] سوم\n\nمتن پایین");

  const activeLineText = () =>
    editor.locator(".cm-line.cm-activeLine").textContent();
  const secondItem = editor.locator(".cm-line").filter({ hasText: "دوم" });

  await secondItem.click();
  await page.keyboard.press("ArrowUp");
  await expect.poll(activeLineText).toContain("اول");

  await secondItem.click();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowDown");
  await expect.poll(activeLineText).toContain("سوم");
  await page.keyboard.press("ArrowUp");
  await expect.poll(activeLineText).toContain("دوم");
  await page.keyboard.press("ArrowUp");
  await expect.poll(activeLineText).toContain("اول");
  await page.keyboard.press("ArrowUp");
  await expect.poll(activeLineText).toContain("متن بالا");

  await secondItem.click();
  await page.keyboard.press("End");
  await page.keyboard.press("ArrowDown");
  await expect.poll(activeLineText).toContain("متن پایین");
});

test("Arrow navigation keeps the active line inside the central reading band", async ({
  page,
}) => {
  const editor = await openWritingLiveEditor(page);
  const lines = Array.from({ length: 80 }, (_, index) => `خط شماره ${index + 1}`);
  await editor.fill(lines.join("\n"));

  await editor.locator(".cm-line").first().click();
  for (let index = 0; index < 35; index += 1) {
    await page.keyboard.press("ArrowDown");
  }

  const assertInsideReadingBand = async () => {
    const geometry = await editor.evaluate((content) => {
      const scroller = content.closest(".cm-editor")?.querySelector<HTMLElement>(".cm-scroller");
      const activeLine = content.querySelector<HTMLElement>(".cm-activeLine");
      if (!scroller || !activeLine) throw new Error("Editor geometry is unavailable");
      const viewport = scroller.getBoundingClientRect();
      const line = activeLine.getBoundingClientRect();
      return {
        viewportTop: viewport.top,
        viewportBottom: viewport.bottom,
        viewportHeight: viewport.height,
        lineTop: line.top,
        lineBottom: line.bottom,
      };
    });
    const tolerance = 20;
    expect(geometry.lineTop).toBeGreaterThanOrEqual(
      geometry.viewportTop + geometry.viewportHeight * 0.3 - tolerance,
    );
    expect(geometry.lineBottom).toBeLessThanOrEqual(
      geometry.viewportBottom - geometry.viewportHeight * 0.3 + tolerance,
    );
  };

  await assertInsideReadingBand();
  for (let index = 0; index < 25; index += 1) {
    await page.keyboard.press("ArrowUp");
  }
  await assertInsideReadingBand();

  // The final line needs real trailing scroll space. Scroll margins alone
  // cannot keep it in the reading band once the document reaches its end.
  await page.keyboard.press("Control+End");
  await assertInsideReadingBand();
});

test("Ctrl or Cmd+A selects only the complete active block", async ({
  page,
}) => {
  const editor = await openWritingLiveEditor(page);
  const listBlock = "- [ ] اول\n- [ ] دوم\n  - [x] زیرمجموعه";
  const original = `متن بالا\n\n${listBlock}\n\nمتن پایین`;
  await editor.fill(original);

  await editor.locator(".cm-line").filter({ hasText: "دوم" }).click();
  await page.keyboard.press("Control+a");
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString() ?? ""))
    .toBe(listBlock);

  await page.keyboard.type("لیست جایگزین");
  await expect.poll(() => sourceText(editor)).toBe(
    "متن بالا\n\nلیست جایگزین\n\nمتن پایین",
  );
  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(original);
});

test("Tab and Shift+Tab move an item with its descendants in one undo step", async ({
  page,
}) => {
  const editor = await openWritingEditor(page);
  const original = ["- والد", "- فرزند", "  - نوه", "- بعدی"].join("\n");
  const nested = ["- والد", "  - فرزند", "    - نوه", "- بعدی"].join("\n");
  await editor.fill(original);
  const child = editor.locator(".cm-line").filter({ hasText: "فرزند" });
  await child.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Tab");
  await expect.poll(() => sourceText(editor)).toBe(nested);
  await expect(editor).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => sourceText(editor)).toBe(original);
  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(nested);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(() => sourceText(editor)).toBe(original);

  await child.click();
  await page.keyboard.press("End");
  await page.keyboard.press("Tab");
  await expect.poll(() => sourceText(editor)).toBe(nested);
  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(original);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(() => sourceText(editor)).toBe(nested);
  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(original);

  await editor.locator(".cm-line").first().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Tab");
  await expect.poll(() => sourceText(editor)).toBe(original);
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => sourceText(editor)).toBe(original);
  await expect(editor).toBeFocused();
});

test("ordered, todo and multiline list editing stays inside one List Block", async ({
  page,
}) => {
  const editor = await openWritingEditor(page);
  await editor.fill("1. اول\n2. دوم\n3. سوم");
  await editor.locator(".cm-line").filter({ hasText: /^2\. دوم$/u }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Tab");
  await expect.poll(() => sourceText(editor)).toBe(
    "1. اول\n  1. دوم\n2. سوم",
  );
  await page.keyboard.press("Shift+Tab");
  await expect.poll(() => sourceText(editor)).toBe("1. اول\n2. دوم\n3. سوم");

  await editor.fill("- [x] انجام‌شده\n- [ ] آیتم چندخطی");
  await editor.locator(".cm-line").filter({ hasText: "چندخطی" }).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Shift+Enter");
  await page.keyboard.type("ادامهٔ همان آیتم");
  await expect.poll(() => sourceText(editor)).toBe(
    "- [x] انجام‌شده\n- [ ] آیتم چندخطی\n      ادامهٔ همان آیتم",
  );

  await page.keyboard.press("Enter");
  await expect.poll(() => sourceText(editor)).toBe(
    "- [x] انجام‌شده\n- [ ] آیتم چندخطی\n      ادامهٔ همان آیتم\n- [ ] ",
  );
  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(
    "- [x] انجام‌شده\n- [ ] آیتم چندخطی\n      ادامهٔ همان آیتم",
  );
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(() => sourceText(editor)).toBe(
    "- [x] انجام‌شده\n- [ ] آیتم چندخطی\n      ادامهٔ همان آیتم\n- [ ] ",
  );
  await page.keyboard.type("آیتم تازه");
  await expect.poll(() => sourceText(editor)).toBe(
    "- [x] انجام‌شده\n- [ ] آیتم چندخطی\n      ادامهٔ همان آیتم\n- [ ] آیتم تازه",
  );
  await page.keyboard.press("Control+Enter");
  await page.keyboard.type("متن مستقل");
  await expect.poll(() => sourceText(editor)).toBe(
    "- [x] انجام‌شده\n- [ ] آیتم چندخطی\n      ادامهٔ همان آیتم\n- [ ] آیتم تازه\n\nمتن مستقل",
  );
});

test("Persian IME composition never triggers semantic indentation", async ({
  page,
}) => {
  const editor = await openWritingEditor(page);
  const source = "- والد\n- فرزند";
  await editor.fill(source);
  await editor.locator(".cm-line").last().click();
  await editor.dispatchEvent("compositionstart", { data: "ف" });
  await editor.dispatchEvent("keydown", {
    key: "Tab",
    code: "Tab",
    isComposing: true,
  });
  await editor.dispatchEvent("keydown", {
    key: "ArrowDown",
    code: "ArrowDown",
    altKey: true,
    isComposing: true,
  });
  await editor.dispatchEvent("compositionend", { data: "ف" });
  await expect.poll(() => sourceText(editor)).toBe(source);
  await expect(editor).toBeFocused();
});

test("Alt+Arrow reorders one sibling subtree and keeps one-step undo", async ({
  page,
}) => {
  const editor = await openWritingEditor(page);
  const original = [
    "- اول",
    "- دوم",
    "  ادامهٔ دوم",
    "  - [x] زیرکار",
    "- سوم",
  ].join("\n");
  const moved = [
    "- اول",
    "- سوم",
    "- دوم",
    "  ادامهٔ دوم",
    "  - [x] زیرکار",
  ].join("\n");
  await editor.fill(original);
  await editor.locator(".cm-line").filter({ hasText: /دوم$/u }).first().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Alt+ArrowDown");
  await expect.poll(() => sourceText(editor)).toBe(moved);
  await expect(editor).toBeFocused();
  await page.keyboard.type("!");
  await expect.poll(() => sourceText(editor)).toContain("- دوم!");
  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(moved);
  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(original);
  await page.keyboard.press("Control+Shift+z");
  await expect.poll(() => sourceText(editor)).toBe(moved);

  await editor.locator(".cm-line").filter({ hasText: /دوم$/u }).first().click();
  await page.keyboard.press("End");
  await page.keyboard.press("Alt+ArrowDown");
  await expect.poll(() => sourceText(editor)).toBe(moved);
});

test("deleting an empty list item promotes descendants and is undoable", async ({
  page,
}) => {
  const editor = await openWritingEditor(page);
  const original = [
    "- والد",
    "  - ",
    "    - [x] فرزند",
    "      ادامهٔ فرزند",
    "  - بعدی",
  ].join("\n");
  const deleted = [
    "- والد",
    "  - [x] فرزند",
    "    ادامهٔ فرزند",
    "  - بعدی",
  ].join("\n");
  await editor.fill(original);
  await editor.locator(".cm-line").nth(1).click();
  await page.keyboard.press("End");
  await page.keyboard.press("Backspace");
  await expect.poll(() => sourceText(editor)).toBe(deleted);
  await expect(editor).toBeFocused();
  await page.keyboard.type("حفظ‌شده ");
  await expect.poll(() => sourceText(editor)).toContain("حفظ‌شده فرزند");
  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(deleted);
  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(original);
});

test("pointer drag moves one list-item subtree exactly like Alt+Arrow and cleans up", async ({
  page,
}) => {
  const editor = await openWritingLiveEditor(page);
  const host = page.locator("#markdown-editor");
  const gutter = page.locator(".writing-block-gutter");
  const handle = page.locator(".writing-block-drag-handle");
  const indicator = page.locator(".writing-block-drop-indicator");
  const original = [
    "- اول",
    "- دوم",
    "  ادامهٔ دوم",
    "  - [x] زیرکار",
    "- سوم",
  ].join("\n");
  const moved = [
    "- اول",
    "- سوم",
    "- دوم",
    "  ادامهٔ دوم",
    "  - [x] زیرکار",
  ].join("\n");
  await editor.fill(original);
  await editor.locator(".cm-line").filter({ hasText: /دوم$/u }).first().click();
  await page.keyboard.press("End");
  await expect(gutter).toHaveAttribute("data-drag-scope", "list-item");
  await expect(handle).toHaveAttribute("aria-label", /آیتم فعال/u);

  const handleBox = (await handle.boundingBox())!;
  const targetBox = (await editor
    .locator(".cm-line")
    .filter({ hasText: /سوم$/u })
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
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height - 2,
    { steps: 6 },
  );
  await expect(indicator).toBeVisible();
  await expect(indicator).toHaveAttribute("data-drag-scope", "list-item");
  await expect(indicator).toHaveAttribute("data-placement", "after");
  await expect(host).toHaveAttribute("data-list-item-dragging", "true");
  await expect(host).not.toHaveAttribute("data-block-dragging", /.+/u);
  await page.mouse.up();

  await expect(editor).toBeFocused();
  await expect(indicator).toBeHidden();
  await expect(host).not.toHaveAttribute("data-list-item-dragging", /.+/u);
  await expect(handle).not.toHaveAttribute("data-pointer-id", /.+/u);
  expect(
    await handle.evaluate(
      (button, pointerId) => button.hasPointerCapture(pointerId),
      capture.pointerId,
    ),
  ).toBe(false);

  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect.poll(() => sourceText(editor)).toBe(moved);
  await page.keyboard.type("!");
  await expect.poll(() => sourceText(editor)).toContain("- دوم!");
  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(moved);
  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(original);

  await page
    .getByRole("button", { name: "ویرایش روان", exact: true })
    .click();
  await editor.locator(".cm-line").filter({ hasText: /دوم$/u }).first().click();
  await page.keyboard.press("End");
  await handle.focus();
  await handle.press("Alt+ArrowDown");
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect.poll(() => sourceText(editor)).toBe(moved);

  await page.keyboard.press("Control+z");
  await expect.poll(() => sourceText(editor)).toBe(original);
  await page
    .getByRole("button", { name: "ویرایش روان", exact: true })
    .click();
  await editor.locator(".cm-line").filter({ hasText: /دوم$/u }).first().click();
  const cancelHandleBox = (await handle.boundingBox())!;
  const cancelTargetBox = (await editor
    .locator(".cm-line")
    .filter({ hasText: /سوم$/u })
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
  await expect(indicator).toBeHidden();
  await expect(host).not.toHaveAttribute("data-list-item-dragging", /.+/u);
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect.poll(() => sourceText(editor)).toBe(original);
});
