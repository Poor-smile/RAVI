import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixture = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "live-edit-rich-blocks.fa.md"),
  "utf8",
).replace(/\r\n/gu, "\n");

async function openFixture(page: Page, content = fixture) {
  await page.addInitScript((content) => {
    localStorage.clear();
    localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        content,
        fileName: "جدول-آزمایشی.md",
        readerSize: 18,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        activeDocumentPath: "D:/Notes/جدول-آزمایشی.md",
        documentType: "markdown",
        lastSavedSnapshot: JSON.stringify({ content, annotations: [], assets: [] }),
        draftId: "rich-blocks-fixture",
        viewMode: "desk",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, content);
  await page.route("https://example.com/sample.png", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#e8edf4"/><text x="160" y="95" text-anchor="middle">Raavi</text></svg>',
    });
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  const editor = page.locator("#markdown-editor .cm-content");
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  if ((page.viewportSize()?.width ?? 1280) <= 820) {
    await page.getByRole("tab", { name: "ویرایش", exact: true }).click();
  }
  await expect(editor).toBeVisible();
  await editor.fill(content);
  await editor.focus();
  await page.keyboard.press("Control+Home");
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
  return editor;
}

async function copiedMarkdown(page: Page) {
  const editor = page.locator("#markdown-editor .cm-content");
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  const lines = await editor.locator(".cm-line").allTextContents();
  return lines.join("\n");
}

test.describe("بلوک‌های غنی در ویرایش روان", () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  });

  test("renders code, table, image, callout and footnotes without changing source", async ({ page }) => {
    const editor = await openFixture(page);
    const code = page.locator(".cm-rich-code").first();
    await expect(code).toBeVisible();
    await code.getByRole("button", { name: "کپی کد" }).click();
    await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("const پیام");
    await code.getByRole("button", { name: "ویرایش متن Markdown" }).click();
    await expect(editor).toContainText("```ts");
    await editor.focus();
    await page.keyboard.press("Control+Home");

    await expect(page.locator(".cm-rich-table").first()).toBeVisible();
    await expect(page.locator(".cm-rich-callout")).toContainText("یادداشت نمونه‌خوان");
    const image = page.getByRole("group", { name: "طرح نمونه" });
    await image.scrollIntoViewIfNeeded();
    await expect(image.getByRole("note")).toContainText(
      "این تصویر بیرونی هنوز اجازهٔ بارگیری ندارد",
    );
    await expect(page.locator(".cm-rich-footnote").first()).toHaveAccessibleName(/رفتن به تعریف/u);
    expect(await copiedMarkdown(page)).toBe(fixture);
  });

  test("edits a table as a keyboard-first grid while keeping Markdown portable", async ({ page }) => {
    const editor = await openFixture(page);
    const table = page.locator(".cm-rich-table").first();
    await expect(table).toBeVisible();
    await expect(table.locator("thead textarea")).toHaveCount(3);
    await expect(table.locator("tbody tr")).toHaveCount(2);

    const firstHeader = table.locator('textarea[data-table-row="-1"][data-table-column="0"]');
    const secondHeader = table.locator('textarea[data-table-row="-1"][data-table-column="1"]');
    const firstBodyCell = table.locator('textarea[data-table-row="0"][data-table-column="0"]');
    const secondBodyCell = table.locator('textarea[data-table-row="0"][data-table-column="1"]');
    const thirdBodyCell = table.locator('textarea[data-table-row="0"][data-table-column="2"]');
    const secondRowFirstCell = table.locator('textarea[data-table-row="1"][data-table-column="0"]');

    await firstHeader.focus();
    await firstHeader.press("Control+A");
    expect(
      await firstHeader.evaluate((element) => {
        const cell = element as HTMLTextAreaElement;
        return {
          start: cell.selectionStart,
          end: cell.selectionEnd,
          length: cell.value.length,
        };
      }),
    ).toEqual({ start: 0, end: 3, length: 3 });
    await page.keyboard.type("عنوان تازه");

    await firstHeader.press("ArrowDown");
    await expect(firstBodyCell).toBeFocused();
    await firstBodyCell.press("ArrowDown");
    await expect(secondRowFirstCell).toBeFocused();
    await secondRowFirstCell.press("ArrowUp");
    await expect(firstBodyCell).toBeFocused();

    await firstBodyCell.evaluate((element) => {
      const cell = element as HTMLTextAreaElement;
      cell.setSelectionRange(cell.value.length, cell.value.length);
    });
    await firstBodyCell.press("ArrowLeft");
    await expect(secondBodyCell).toBeFocused();
    await secondBodyCell.press("Control+ArrowLeft");
    await expect(thirdBodyCell).toBeFocused();
    await thirdBodyCell.press("Control+ArrowRight");
    await expect(secondBodyCell).toBeFocused();

    await firstHeader.focus();
    await firstHeader.press("Tab");
    await expect(secondHeader).toBeFocused();

    await table.getByRole("button", { name: "ردیف +" }).click();
    await expect(table.locator("tbody tr")).toHaveCount(3);
    await table.getByRole("button", { name: "ستون +" }).click();
    await expect(table.locator("thead textarea")).toHaveCount(4);
    await expect(table.locator(".cm-rich-table-meta")).toHaveText("جدول · ۴ × ۳");
    await table.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: ".artifacts/table-editor-implemented.png",
      fullPage: true,
    });

    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    await expect(editor).toContainText("| عنوان تازه | مقدار | وضعیت | ستون 4 |");
    await expect(editor).toContainText("|  |  |  |  |");
  });

  test("shows the compact mini menu for a text selection inside a table cell", async ({
    page,
  }) => {
    await openFixture(page);
    const cell = page
      .locator(".cm-rich-table")
      .first()
      .locator('textarea[data-table-row="0"][data-table-column="0"]');
    const toolbar = page.getByRole("toolbar", {
      name: "قالب‌بندی متن انتخاب‌شده",
    });

    await cell.focus();
    await cell.evaluate((element) => {
      const editor = element as HTMLTextAreaElement;
      editor.setSelectionRange(0, 3);
      editor.dispatchEvent(new Event("select", { bubbles: true }));
    });
    await expect(toolbar).toBeVisible();
    await expect(toolbar.getByRole("button")).toHaveCount(8);
    const blockGutter = page.locator("#markdown-editor .writing-block-gutter");
    await expect(blockGutter).toBeVisible();
    await expect(blockGutter).toHaveAttribute("data-block-selected", "true");
    await expect(blockGutter.getByRole("button")).toHaveCount(3);

    const [cellBox, toolbarBox, tableBox, gutterBox] = await Promise.all([
      cell.boundingBox(),
      toolbar.boundingBox(),
      page.locator(".cm-rich-table").first().boundingBox(),
      blockGutter.boundingBox(),
    ]);
    expect(cellBox).not.toBeNull();
    expect(toolbarBox).not.toBeNull();
    expect(tableBox).not.toBeNull();
    expect(gutterBox).not.toBeNull();
    expect(Math.abs((toolbarBox?.x ?? 0) - (cellBox?.x ?? 0))).toBeLessThan(520);
    expect(Math.abs((gutterBox?.y ?? 0) - (tableBox?.y ?? 0))).toBeLessThan(24);
    await page.screenshot({
      path: ".artifacts/table-cell-selection-toolbar.png",
      fullPage: true,
    });

    await cell.press("Alt+F10");
    await expect(
      toolbar.getByRole("button", { name: "کپی", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(toolbar).toBeHidden();
    await expect(cell).toBeFocused();
    expect(
      await cell.evaluate((element) => {
        const editor = element as HTMLTextAreaElement;
        return [editor.selectionStart, editor.selectionEnd];
      }),
    ).toEqual([0, 3]);

    await cell.evaluate((element) => {
      const editor = element as HTMLTextAreaElement;
      editor.setSelectionRange(0, 0);
      editor.dispatchEvent(new Event("select", { bubbles: true }));
      editor.setSelectionRange(0, 3);
      editor.dispatchEvent(new Event("select", { bubbles: true }));
    });
    await expect(toolbar).toBeVisible();
    await toolbar.getByRole("button", { name: "پررنگ", exact: true }).click();
    await expect(cell).toHaveValue("**فصل** نخست");

    const formattedCellEditor = cell.locator("xpath=..");
    await expect(cell).toBeFocused();
    await expect(formattedCellEditor).toHaveAttribute("data-editing", "false");
    await expect(
      formattedCellEditor.locator(".cm-rich-table-cell-preview strong"),
    ).toHaveText("فصل");
    const inactiveCell = page
      .locator(".cm-rich-table")
      .first()
      .locator('textarea[data-table-row="0"][data-table-column="1"]');
    await inactiveCell.focus();
    const formattedPreview = formattedCellEditor.locator(
      ".cm-rich-table-cell-preview",
    );
    await expect(formattedPreview.locator("strong")).toHaveText("فصل");
    await expect(formattedPreview).not.toContainText("**");
    await page.screenshot({
      path: ".artifacts/table-inline-format-preview.png",
      fullPage: true,
    });

    await cell.focus();
    await cell.press("Control+Enter");
    await expect.poll(() => copiedMarkdown(page)).toContain(
      "| **فصل** نخست | ۱۲ | آماده |",
    );
  });

  test("shows only table-valid shortcuts below the active rich table", async ({
    page,
  }) => {
    await openFixture(page);
    const table = page.locator(".cm-rich-table").first();
    const cell = table.locator("tbody textarea").first();
    const hint = page.getByRole("note", {
      name: "میان‌برهای بلاک فعال",
    });

    await cell.focus();
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("Ctrl+A");
    await expect(hint).toContainText("انتخاب محتوای سلول");
    await expect(hint).toContainText("Tab / Shift+Tab");
    await expect(hint).toContainText("حرکت عمودی؛ خروج در مرز");
    await expect(hint).toContainText("حرکت افقی در مرز متن");
    await expect(hint).toContainText("Ctrl+Enter");
    await expect(hint).not.toContainText("خط جدید در همین بلاک");
    const relativeOrder = await page.evaluate(() => {
      const table = document.querySelector(".cm-rich-table");
      const hint = document.querySelector(".cm-contextual-shortcut-hint");
      if (!table || !hint) return null;
      const tableBounds = table.getBoundingClientRect();
      const hintBounds = hint.getBoundingClientRect();
      return {
        tableBottom: Math.round(tableBounds.bottom),
        hintTop: Math.round(hintBounds.top),
      };
    });
    expect(relativeOrder).not.toBeNull();
    expect(relativeOrder?.hintTop ?? 0).toBeGreaterThanOrEqual(
      (relativeOrder?.tableBottom ?? 0) - 1,
    );
    await page.screenshot({
      path: ".artifacts/contextual-table-shortcuts.png",
      fullPage: true,
    });
  });

  test("updates the shortcut hint for empty and list editing contexts", async ({
    page,
  }) => {
    const editor = await openFixture(page, "");
    const hint = page.getByRole("note", {
      name: "میان‌برهای بلاک فعال",
    });

    await expect(hint).toContainText("Ctrl+Enter");
    await expect(hint).toContainText("فهرست بلاک‌ها");
    await expect(hint).toContainText("/");

    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    await editor.fill("- مورد نخست\n- مورد دوم");
    await editor.focus();
    await page.keyboard.press("Control+Home");
    await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();

    await expect(hint).toContainText("آیتم هم‌سطح");
    await expect(hint).toContainText("خط جدید در آیتم");
    await expect(hint).toContainText("تورفتگی / بیرون‌رفتگی");
    await expect(hint).not.toContainText("فهرست بلاک‌ها");
  });

  test("ArrowDown leaves the final table row and activates an adjacent multiline quote", async ({
    page,
  }) => {
    const content = [
      "# نام سند",
      "",
      "توضیحات مربوط به سند",
      "",
      "| ستون 1 | ستون 2 | ستون 3 | ستون 4 | ستون 5 |",
      "| :--- | :--- | :--- | :--- | :--- |",
      "| مقدار 1-1 | مقدار 1-2 | مقدار 1-3 | مقدار 1-4 | مقدار 1-5 |",
      "| مقدار 2-1 | مقدار 2-2 | مقدار 2-3 | مقدار 2-4 | مقدار 2-5 |",
      "| مقدار 3-1 | مقدار 3-2 | مقدار 3-3 | مقدار 3-4 | مقدار 3-5 |",
      "",
      "> سلام\\",
      ">",
      "",
    ].join("\n");
    await openFixture(page, content);
    const table = page.locator(".cm-rich-table").first();
    const lastRowCell = table.locator(
      'textarea[data-table-row="2"][data-table-column="0"]',
    );
    const editor = page.locator("#markdown-editor .cm-content");

    await lastRowCell.focus();
    await lastRowCell.press("ArrowDown");

    await expect(editor).toBeFocused();
    await expect(
      page.locator(".cm-line.cm-activeLine.cm-live-syntax-is-visible"),
    ).toContainText("سلام");
    await expect(page.getByRole("note", { name: "میان‌برهای بلاک فعال" }))
      .toContainText("خط جدید در همین بلاک");

    const firstHeaderCell = table.locator(
      'textarea[data-table-row="-1"][data-table-column="0"]',
    );
    await firstHeaderCell.focus();
    await firstHeaderCell.press("ArrowUp");

    await expect(editor).toBeFocused();
    await expect(
      page.locator(".cm-line.cm-activeLine.cm-live-syntax-is-visible"),
    ).toContainText("توضیحات مربوط به سند");
  });

  test("vertical arrows enter a rich table through its rightmost column before leaving it", async ({
    page,
  }) => {
    const content = [
      "متن بالای جدول",
      "",
      "| ستون 1 | ستون 2 |",
      "| :--- | :--- |",
      "| مقدار 1-1 | مقدار 1-2 |",
      "| مقدار 2-1 | مقدار 2-2 |",
      "| مقدار 3-1 | مقدار 3-2 |",
      "",
      "متن پایین جدول",
    ].join("\n");
    const editor = await openFixture(page, content);
    const table = page.locator(".cm-rich-table").first();
    const header = table.locator(
      'textarea[data-table-row="-1"][data-table-column="0"]',
    );
    const rowOne = table.locator(
      'textarea[data-table-row="0"][data-table-column="0"]',
    );
    const rowTwo = table.locator(
      'textarea[data-table-row="1"][data-table-column="0"]',
    );
    const rowThree = table.locator(
      'textarea[data-table-row="2"][data-table-column="0"]',
    );
    const hint = page.getByRole("note", { name: "میان‌برهای بلاک فعال" });

    await editor.focus();
    await page.keyboard.press("Control+Home");
    await page.keyboard.press("ArrowDown");
    await expect(header).toBeFocused();
    await expect(header).toHaveValue("ستون 1");
    await expect(header).toHaveCSS("opacity", "0");
    await expect(header.locator("xpath=..")).toHaveAttribute(
      "data-editing",
      "false",
    );
    await expect(
      header.locator("xpath=..").locator(".cm-rich-table-cell-preview"),
    ).toHaveText("ستون 1");
    await expect(hint).toBeVisible();
    await expect(hint).toContainText("حرکت عمودی؛ خروج در مرز");
    const hintBounds = await hint.boundingBox();
    const tableBounds = await table.boundingBox();
    expect(hintBounds).not.toBeNull();
    expect(tableBounds).not.toBeNull();
    expect(hintBounds?.y ?? 0).toBeGreaterThanOrEqual(
      (tableBounds?.y ?? 0) + (tableBounds?.height ?? 0) - 1,
    );
    expect((hintBounds?.y ?? 0) + (hintBounds?.height ?? 0)).toBeLessThanOrEqual(
      page.viewportSize()?.height ?? 914,
    );
    await page.screenshot({
      path: ".artifacts/table-vertical-entry.png",
      fullPage: true,
    });

    await header.press("ArrowDown");
    await expect(rowOne).toBeFocused();
    await rowOne.press("ArrowDown");
    await expect(rowTwo).toBeFocused();
    await rowTwo.press("ArrowDown");
    await expect(rowThree).toBeFocused();
    await rowThree.press("ArrowDown");
    await expect(editor).toBeFocused();
    await expect(
      page.locator(".cm-line.cm-activeLine.cm-live-syntax-is-visible"),
    ).toContainText("متن پایین جدول");

    await page.keyboard.press("ArrowUp");
    await expect(rowThree).toBeFocused();
    await rowThree.press("ArrowUp");
    await expect(rowTwo).toBeFocused();
    await rowTwo.press("ArrowUp");
    await expect(rowOne).toBeFocused();
    await rowOne.press("ArrowUp");
    await expect(header).toBeFocused();
    await header.press("ArrowUp");
    await expect(editor).toBeFocused();
    await expect(
      page.locator(".cm-line.cm-activeLine.cm-live-syntax-is-visible"),
    ).toContainText("متن بالای جدول");
  });

  test("Ctrl+Enter leaves every rich block rendered and focuses a new Text Block after it", async ({
    page,
  }) => {
    const editor = await openFixture(page);
    const code = page.locator(".cm-rich-code").first();
    const table = page.locator(".cm-rich-table").first();

    await code.focus();
    await code.press("Control+Enter");
    await expect(editor).toBeFocused();
    await expect(code).toBeVisible();

    const firstCell = table.locator("tbody textarea").first();
    await firstCell.focus();
    await firstCell.press("Control+Enter");
    await expect(editor).toBeFocused();
    await expect(table).toBeVisible();

    const expected = fixture
      .replace(
        "console.log(پیام);\n```\n\n| نام",
        "console.log(پیام);\n```\n\n\n\n| نام",
      )
      .replace(
        "| مسیر `A\\|B` | ۲۴ | بازبینی |\n\n![طرح نمونه]",
        "| مسیر `A\\|B` | ۲۴ | بازبینی |\n\n\n\n![طرح نمونه]",
      );
    await expect.poll(() => copiedMarkdown(page)).toBe(expected);
  });

  test("Ctrl+Enter uses the same insert-after contract for image, callout, Mermaid and Formula", async ({
    page,
  }) => {
    const content = [
      "# بلوک‌های نتیجه‌محور",
      "",
      '![طرح نمونه](https://example.com/sample.png "نمونهٔ بیرونی")',
      "",
      "> [!NOTE] یادداشت نمونه‌خوان",
      "> بدنهٔ یادداشت",
      "",
      "```mermaid",
      "flowchart RL",
      "  A[آغاز] --> B[پایان]",
      "```",
      "",
      "$$",
      "x^2 + y^2 = z^2",
      "$$",
    ].join("\n");
    const editor = await openFixture(page, content);
    const blocks = [
      page.locator(".cm-rich-image"),
      page.locator(".cm-rich-callout"),
      page.locator(".cm-rich-mermaid"),
      page.locator(".cm-rich-formula"),
    ];

    for (const block of blocks) {
      await expect(block).toBeVisible();
      await block.focus();
      await block.press("Control+Enter");
      await expect(editor).toBeFocused();
      await expect(block).toBeVisible();
    }

    const expected = content
      .replace("\")\n\n> [!NOTE]", "\")\n\n\n\n> [!NOTE]")
      .replace("> بدنهٔ یادداشت\n\n```mermaid", "> بدنهٔ یادداشت\n\n\n\n```mermaid")
      .replace(
        "  A[آغاز] --> B[پایان]\n```\n\n$$",
        () => "  A[آغاز] --> B[پایان]\n```\n\n\n\n$$",
      )
      .concat("\n\n");
    await expect.poll(() => copiedMarkdown(page)).toBe(expected);
  });

  test("renders an underlined-adjacent RTL table without a trailing active-line artifact", async ({
    page,
  }) => {
    const content = [
      "# نام سند",
      "",
      "توضیحات مربوط به سند",
      "",
      "- [ ] توضیح ۱",
      "  - [ ] توضیح ۲",
      "  - [ ] توضیح ۳",
      "    - [ ] توضیح چهار",
      "- [ ] توضیح اول",
      "<u>",
      "| ستون 1 | ستون 2 | ستون 3 | ستون 4 | ستون 5 |",
      "| :--- | :--- | :--- | :--- | :--- |",
      "| مقدار 1-1 | مقدار 1-2 | مقدار 1-3 | مقدار 1-4 | مقدار 1-5 |",
      "| مقدار 2-1 | مقدار 2-2 | مقدار 2-3 | مقدار 2-4 | مقدار 2-5 |",
      "| </u> مقدار 3-1 | مقدار 3-2 | مقدار 3-3 | مقدار 3-4 | مقدار 3-5 |",
    ].join("\n");
    await openFixture(page, content);
    const table = page.locator(".cm-rich-table").first();
    await expect(table).toBeVisible();
    await table.locator("tbody textarea").first().focus();
    const inactiveSourceHighlights = await page
      .locator("#markdown-editor .cm-activeLine")
      .evaluateAll((lines) =>
        lines.map((line) => {
          const style = getComputedStyle(line);
          return {
            background: style.backgroundColor,
            boxShadow: style.boxShadow,
            borderTop: style.borderTopWidth,
            borderBottom: style.borderBottomWidth,
          };
        }),
      );
    expect(inactiveSourceHighlights.length).toBeGreaterThan(0);
    expect(inactiveSourceHighlights).toEqual(
      inactiveSourceHighlights.map(() => ({
        background: "rgba(0, 0, 0, 0)",
        boxShadow: "none",
        borderTop: "0px",
        borderBottom: "0px",
      })),
    );
    await page.screenshot({
      path: ".artifacts/table-no-trailing-active-line.png",
      fullPage: true,
    });
  });

  test("removes the active table row and column while preserving a valid GFM table", async ({ page }) => {
    const editor = await openFixture(page);
    const table = page.locator(".cm-rich-table").first();
    const removeRow = table.getByRole("button", { name: "حذف ردیف فعال" });
    const removeColumn = table.getByRole("button", {
      name: "حذف ستون فعال",
    });

    await table
      .locator('textarea[data-table-row="0"][data-table-column="0"]')
      .focus();
    await removeRow.click();
    await expect(table.locator("tbody tr")).toHaveCount(1);
    await expect(table.locator("tbody textarea").first()).toHaveValue(
      "مسیر `A\\|B`",
    );
    await page
      .getByRole("button", { name: "واگرد آخرین تغییر", exact: true })
      .click();
    await expect(table.locator("tbody tr")).toHaveCount(2);
    await page
      .getByRole("button", { name: "انجام دوبارهٔ تغییر", exact: true })
      .click();
    await expect(table.locator("tbody tr")).toHaveCount(1);

    await table
      .locator('textarea[data-table-row="-1"][data-table-column="1"]')
      .focus();
    await removeColumn.click();
    await expect(table.locator("thead textarea")).toHaveCount(2);
    await expect(table.locator("thead textarea").nth(0)).toHaveValue("نام");
    await expect(table.locator("thead textarea").nth(1)).toHaveValue("وضعیت");
    await expect(table.locator(".cm-rich-table-meta")).toHaveText("جدول · ۲ × ۱");
    await expect(removeColumn).toBeDisabled();

    await removeRow.click();
    await expect(table.locator("tbody tr")).toHaveCount(0);
    await expect(removeRow).toBeDisabled();

    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    await expect(editor).toContainText("| نام | وضعیت |");
    await expect(editor).toContainText("| :--- | :---: |");
    await expect(editor).not.toContainText("| فصل نخست | ۱۲ | آماده |");
  });

  test("opens the RTL cell menu, wraps text and clears a rectangular selection without Merge", async ({ page }) => {
    const multiTableFixture = fixture.replace(
      "![طرح نمونه]",
      "| کلید | توضیح |\n| :--- | :--- |\n| دوم | جدول دوم |\n\n![طرح نمونه]",
    );
    await openFixture(page, multiTableFixture);
    await expect(page.locator(".cm-rich-table")).toHaveCount(2);
    const table = page.locator(".cm-rich-table").first();
    const first = table.locator('textarea[data-table-row="0"][data-table-column="0"]');
    const second = table.locator('textarea[data-table-row="0"][data-table-column="1"]');
    const allCells = table.locator("textarea[data-table-row][data-table-column]");
    const allTableCells = page.locator(
      ".cm-rich-table textarea[data-table-row][data-table-column]",
    );

    await expect(allCells).toHaveCount(9);
    await expect
      .poll(() => allTableCells.evaluateAll((cells) => cells.every((cell) => cell.getAttribute("data-wrap") === "true")))
      .toBe(true);

    await first.click();
    await second.click({ modifiers: ["Shift"] });
    await second.click({ button: "right" });

    const menu = page.getByRole("menu", { name: "عملیات سلول‌های جدول" });
    await expect(menu).toBeVisible();
    await expect(menu).toContainText("حذف ردیف‌های انتخابی");
    await expect(menu).toContainText("حذف ستون‌های انتخابی");
    await expect(menu).not.toContainText(/Merge|ادغام/u);
    await expect
      .poll(() => menu.evaluate((element) => element.parentElement === document.body))
      .toBe(true);
    const menuGeometry = await menu.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      return {
        left: bounds.left,
        top: bounds.top,
        right: bounds.right,
        bottom: bounds.bottom,
        viewportWidth: innerWidth,
        viewportHeight: innerHeight,
      };
    });
    expect(menuGeometry.left).toBeGreaterThanOrEqual(8);
    expect(menuGeometry.top).toBeGreaterThanOrEqual(8);
    expect(menuGeometry.right).toBeLessThanOrEqual(menuGeometry.viewportWidth - 8);
    expect(menuGeometry.bottom).toBeLessThanOrEqual(menuGeometry.viewportHeight - 8);
    await page.screenshot({
      path: ".artifacts/table-context-menu-v1.7.2.png",
      fullPage: true,
    });

    await menu.getByRole("menuitem", { name: "Wrap Text" }).click();
    await expect
      .poll(() => allTableCells.evaluateAll((cells) => cells.every((cell) => cell.getAttribute("data-wrap") === "false")))
      .toBe(true);

    await second.click({ button: "right" });
    await menu.getByRole("menuitem", { name: "Wrap Text" }).click();
    await expect
      .poll(() => allTableCells.evaluateAll((cells) => cells.every((cell) => cell.getAttribute("data-wrap") === "true")))
      .toBe(true);

    await second.click({ button: "right" });
    await menu
      .getByRole("menuitem", { name: /پاک‌کردن سلول‌های انتخابی/u })
      .click();
    await expect(first).toHaveValue("");
    await expect(second).toHaveValue("");
  });

  test("runs structural row and column actions from the cell context menu", async ({ page }) => {
    await openFixture(page);
    const table = page.locator(".cm-rich-table").first();
    const menu = page.getByRole("menu", { name: "عملیات سلول‌های جدول" });

    await table
      .locator('textarea[data-table-row="0"][data-table-column="0"]')
      .click({ button: "right" });
    await menu.getByRole("menuitem", { name: "افزودن ردیف" }).click();
    await expect(table.locator("tbody tr")).toHaveCount(3);

    await table
      .locator('textarea[data-table-row="-1"][data-table-column="0"]')
      .click({ button: "right" });
    await menu.getByRole("menuitem", { name: "افزودن ستون" }).click();
    await expect(table.locator("thead textarea")).toHaveCount(4);

    await table
      .locator('textarea[data-table-row="0"][data-table-column="0"]')
      .click({ button: "right" });
    await menu.getByRole("menuitem", { name: "حذف ردیف", exact: true }).click();
    await expect(table.locator("tbody tr")).toHaveCount(2);

    await table
      .locator('textarea[data-table-row="-1"][data-table-column="0"]')
      .click({ button: "right" });
    await menu.getByRole("menuitem", { name: "حذف ستون", exact: true }).click();
    await expect(table.locator("thead textarea")).toHaveCount(3);
  });

  test("lazy-renders Mermaid, keeps a textual alternative and opens the existing Studio", async ({ page }) => {
    const editor = await openFixture(page);
    await editor.focus();
    await page.keyboard.press("Control+End");
    const diagrams = page.locator(".cm-rich-mermaid");
    await expect(diagrams.first()).toBeVisible();
    const rendered = diagrams.first().locator("img.cm-rich-mermaid-svg");
    await expect(rendered).toHaveAttribute("src", /^blob:/u, { timeout: 30_000 });
    await rendered.scrollIntoViewIfNeeded();
    await expect(rendered).toBeVisible();
    await expect(diagrams.first().locator("details")).toContainText("flowchart RL");
    await diagrams.first().getByRole("button", { name: "بازکردن در استودیو" }).click();
    const studio = page.getByRole("dialog", { name: "استودیو گراف" });
    await expect(studio).toBeVisible();
    await expect(studio).toContainText("ویرایش نمودار");
    await studio.getByRole("button", { name: /بازگشت به سند/u }).click();
    await expect(studio).toBeHidden();

    const invalidRevision = fixture.replace(
      "A[متن خام] --> B[نمونهٔ چاپی]",
      "A[متن خام] -->",
    );
    await page.getByRole("button", { name: "متن خام", exact: true }).click();
    await editor.fill(invalidRevision);
    await editor.focus();
    await page.keyboard.press("Control+End");
    await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
    const preserved = page.locator(".cm-rich-mermaid").first();
    await expect(preserved.locator("img.cm-rich-mermaid-svg")).toHaveAttribute(
      "src",
      /^blob:/u,
      { timeout: 30_000 },
    );
    await expect(preserved).toContainText("آخرین نمودار سالم نگه داشته شد", {
      timeout: 30_000,
    });
    expect(await copiedMarkdown(page)).toBe(invalidRevision);
  });

  test("reflows rich blocks at 320px and 200% zoom", async ({ page }) => {
    await openFixture(page);
    await page.setViewportSize({ width: 320, height: 720 });
    await page.getByRole("tab", { name: "نوشتن", exact: true }).click();
    await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
    const code = page.locator(".cm-rich-code").first();
    await expect(code).toBeVisible();
    const overflow = await code.evaluate((element) => element.scrollWidth - element.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    const actions = code.locator(".cm-rich-action");
    for (let index = 0; index < await actions.count(); index += 1) {
      const box = await actions.nth(index).boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(43);
    }
  });
});
