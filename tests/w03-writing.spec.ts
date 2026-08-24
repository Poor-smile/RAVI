import { expect, test } from "@playwright/test";
import { openWritingDocument } from "./helpers/open-writing-document";

const EMPTY_BLOCK_PLACEHOLDER =
  "برای نوشتن تایپ کنید؛ برای انتخاب نوع بلاک / را بزنید";

async function emptyBlockPlaceholder(page: import("@playwright/test").Page) {
  return page.locator(".cm-live-empty-block.cm-live-syntax-is-visible").evaluate(
    (element) => getComputedStyle(element, "::before").content,
  );
}

test("W03 assembles the viewport-sized 760px writing document, live blocks, gutter and local status", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );

  await openWritingDocument(page);

  const workspace = page.locator('[data-workspace-screen="writing"]');
  const editor = page.locator("#markdown-editor .cm-content");
  await expect(workspace).toBeVisible();
  await expect(editor).toBeVisible();
  await editor.focus();
  await page.keyboard.press("Control+End");

  await expect(page.locator(".editor-mode-switcher > button")).toHaveCount(4);
  await expect(
    page.locator('.editor-mode-switcher button[aria-pressed="true"]'),
  ).toHaveAttribute("aria-label", "ویرایش روان");
  await expect(page.locator(".sidebar-rail > button:enabled")).toHaveCount(8);
  await expect(page.locator(".document-identity")).toContainText("سند جدید");
  await expect(page.locator(".save-indicator")).toContainText(
    "هشدار: ذخیره نشده",
  );
  await expect(page.locator(".writing-block-gutter")).toBeVisible();
  await expect(page.locator(".writing-block-gutter > button")).toHaveCount(3);
  await expect(page.locator(".document-status-bar")).toHaveText(
    "۳۰ واژه · ۹ خط",
  );
  await expect(page.locator(".cm-live-heading-1")).toContainText(
    "نوشتن برای خوانده‌شدن",
  );
  await expect(page.locator(".cm-live-quote")).toContainText(
    "ساختار، پیش از تزئین",
  );
  await expect(page.locator(".cm-live-task")).toHaveCount(1);
  await expect(
    page.locator(".cm-live-empty-block.cm-live-syntax-is-visible"),
  ).toBeVisible();

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => {
      const bounds = document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      return {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    return {
      header: rect(".topbar"),
      commandBar: rect(".proofbar"),
      sideRail: rect(".sidebar-rail"),
      document: rect('[data-workspace-screen="writing"] .editor-pane'),
      firstBlock: rect(".cm-live-heading-1"),
      gutter: rect(".writing-block-gutter"),
      status: rect(".document-status-bar"),
      activeBlock: rect(
        ".cm-live-empty-block.cm-live-syntax-is-visible",
      ),
      radius: getComputedStyle(
        document.querySelector<HTMLElement>(
          '[data-workspace-screen="writing"] .editor-pane',
        )!,
      ).borderRadius,
      documentMenuBackground: getComputedStyle(
        document.querySelector<HTMLElement>(".document-identity")!,
      ).backgroundColor,
      saveBorder: getComputedStyle(
        document.querySelector<HTMLElement>(".save-indicator")!,
      ).borderWidth,
      saveRadius: getComputedStyle(
        document.querySelector<HTMLElement>(".save-indicator")!,
      ).borderRadius,
      bodyFontSize: getComputedStyle(
        document.querySelector<HTMLElement>("#markdown-editor .cm-content")!,
      ).fontSize,
      bodyLineHeight: getComputedStyle(
        document.querySelector<HTMLElement>("#markdown-editor .cm-content")!,
      ).lineHeight,
    };
  });

  expect(geometry.header).toEqual({ x: 0, y: 0, width: 1280, height: 36 });
  expect(geometry.commandBar).toEqual({ x: 0, y: 36, width: 1280, height: 56 });
  expect(geometry.sideRail).toEqual({ x: 1224, y: 92, width: 56, height: 822 });
  expect(geometry.document).toEqual({
    x: 232,
    y: 144,
    width: 760,
    height: 754,
  });
  expect(geometry.firstBlock.y - geometry.document.y).toBe(32);
  expect(geometry.radius).toBe("14px");
  expect(geometry.gutter.x).toBe(1000);
  expect(geometry.gutter.y).toBe(322);
  expect(geometry.gutter.width).toBe(58);
  expect(geometry.gutter.height).toBe(28);
  expect(geometry.activeBlock).toEqual({
    x: 232,
    y: 338,
    width: 760,
    height: 34,
  });
  expect(geometry.bodyFontSize).toBe("12px");
  expect(geometry.bodyLineHeight).toBe("18px");
  expect(geometry.documentMenuBackground).toBe("rgba(0, 0, 0, 0)");
  expect(geometry.saveBorder).toBe("1px");
  expect(geometry.saveRadius).toBe("4px");
  expect(geometry.status).toEqual({
    x: 502,
    y: 869,
    width: 220,
    height: 20,
  });

  await expect(page.locator(".toast")).toBeHidden({ timeout: 4_000 });
  await page.screenshot({
    path: ".artifacts/w03-writing.png",
    fullPage: true,
  });

  const documentMenuTrigger = page.getByRole("button", {
    name: /بازکردن منوی سند/,
  });
  await documentMenuTrigger.click();
  const documentMenu = page.getByRole("menu", { name: "منوی سند" });
  await expect(documentMenu).toBeVisible();
  await expect(documentMenu.getByRole("menuitem")).toHaveCount(3);
  const documentMenuBounds = await documentMenu.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      viewportWidth: window.innerWidth,
    };
  });
  expect(documentMenuBounds.left).toBeGreaterThanOrEqual(8);
  expect(documentMenuBounds.right).toBeLessThanOrEqual(
    documentMenuBounds.viewportWidth - 8,
  );
  await page.keyboard.press("Escape");
  await expect(documentMenu).toBeHidden();
  await expect(documentMenuTrigger).toBeFocused();

  await page.setViewportSize({ width: 850, height: 914 });
  const narrowGeometry = await page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>(
      '[data-workspace-screen="writing"]',
    )!.getBoundingClientRect();
    const documentSurface = document.querySelector<HTMLElement>(
      '[data-workspace-screen="writing"] .editor-pane',
    )!.getBoundingClientRect();
    const gutter = document
      .querySelector<HTMLElement>(".writing-block-gutter")!
      .getBoundingClientRect();
    return {
      documentWidth: Math.round(documentSurface.width),
      workspaceLeft: Math.round(workspace.left),
      workspaceRight: Math.round(workspace.right),
      gutterRight: Math.round(gutter.right),
    };
  });
  expect(narrowGeometry.documentWidth).toBeLessThan(760);
  expect(narrowGeometry.gutterRight).toBeLessThanOrEqual(
    narrowGeometry.workspaceRight,
  );
  expect(narrowGeometry.workspaceLeft).toBeGreaterThanOrEqual(0);

  const viewportGeometry: Array<{
    viewportHeight: number;
    documentHeight: number;
    documentBottomGap: number;
    statusBottomGap: number;
  }> = [];
  for (const viewportHeight of [720, 1200]) {
    await page.setViewportSize({ width: 1280, height: viewportHeight });
    viewportGeometry.push(
      await page.evaluate(() => {
        const documentSurface = document
          .querySelector<HTMLElement>(
            '[data-workspace-screen="writing"] .editor-pane',
          )!
          .getBoundingClientRect();
        const status = document
          .querySelector<HTMLElement>(".document-status-bar")!
          .getBoundingClientRect();
        return {
          viewportHeight: window.innerHeight,
          documentHeight: Math.round(documentSurface.height),
          documentBottomGap: Math.round(
            window.innerHeight - documentSurface.bottom,
          ),
          statusBottomGap: Math.round(window.innerHeight - status.bottom),
        };
      }),
    );
  }
  expect(viewportGeometry).toEqual([
    {
      viewportHeight: 720,
      documentHeight: 560,
      documentBottomGap: 16,
      statusBottomGap: 25,
    },
    {
      viewportHeight: 1200,
      documentHeight: 1040,
      documentBottomGap: 16,
      statusBottomGap: 25,
    },
  ]);

  await page.setViewportSize({ width: 1280, height: 914 });
  await editor.focus();
  await page.keyboard.press("Control+End");

  await page.locator(".writing-block-type-trigger").click();
  await expect(
    page.getByRole("menu", { name: "نوع بلوک" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");

  await editor.fill("بلوک اول\n\nبلوک دوم");
  await editor.focus();
  await page.keyboard.press("Control+End");
  const dragHandle = page.locator(".writing-block-drag-handle");
  await dragHandle.focus();
  await dragHandle.press("Alt+ArrowUp");
  await expect(page.locator("#markdown-editor .cm-line").first()).toContainText(
    "بلوک دوم",
  );

  await editor.fill([
    "بلوک اول",
    "",
    "```js",
    "const value = 1;",
    "console.log(value);",
    "```",
    "",
    "بلوک آخر",
  ].join("\n"));
  await page
    .locator(".cm-rich-code")
    .getByRole("button", { name: "ویرایش متن Markdown" })
    .click();
  await dragHandle.focus();
  await dragHandle.press("Alt+ArrowUp");
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  const movedSource = (
    await page.locator("#markdown-editor .cm-line").allTextContents()
  ).join("\n");
  expect(movedSource).toBe([
    "```js",
    "const value = 1;",
    "console.log(value);",
    "```",
    "",
    "بلوک اول",
    "",
    "بلوک آخر",
  ].join("\n"));
});

test("empty block placeholder stays visual-only and disappears on first input", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page);

  const editor = page.locator("#markdown-editor .cm-content");
  await editor.focus();
  await page.keyboard.press("Control+End");

  const emptyBlock = page.locator(
    ".cm-live-empty-block.cm-live-syntax-is-visible",
  );
  await expect(emptyBlock).toBeVisible();
  expect(await emptyBlockPlaceholder(page)).toBe(`"${EMPTY_BLOCK_PLACEHOLDER}"`);

  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  const sourceBeforeTyping = (
    await page.locator("#markdown-editor .cm-line").allTextContents()
  ).join("\n");
  expect(sourceBeforeTyping).not.toContain(EMPTY_BLOCK_PLACEHOLDER);

  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("ن");
  await expect(emptyBlock).toHaveCount(0);
  await expect(editor.locator(".cm-activeLine")).toContainText("ن");

  await page.keyboard.press("Control+z");
  await expect(emptyBlock).toBeVisible();
  expect(await emptyBlockPlaceholder(page)).toBe(`"${EMPTY_BLOCK_PLACEHOLDER}"`);

  await page.keyboard.press("Control+y");
  await expect(emptyBlock).toHaveCount(0);
  await expect(editor.locator(".cm-activeLine")).toContainText("ن");
});
