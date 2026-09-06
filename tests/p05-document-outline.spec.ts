import { expect, test } from "@playwright/test";

const DOCUMENT_OUTLINE_FIXTURE = [
  "## مقدمه",
  "متن آغازین سند.",
  "",
  "## مسئلهٔ اصلی",
  "شرح مسئله.",
  "",
  "### محدودهٔ پژوهش",
  "مرزهای پژوهش.",
  "",
  "### روش اجرا",
  "گام‌های اجرا.",
  "",
  "## نتیجه‌گیری",
  "جمع‌بندی سند.",
].join("\n");

test("P05 assembles the hierarchical Document Outline panel from Figma", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript((content) => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "light");
    window.localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        fileName: "راهنمای نگارش.md",
        content,
        readerSize: 18,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        activeDocumentPath: "C:\\Raavi\\راهنمای نگارش.md",
        documentType: "markdown",
        lastSavedSnapshot: content,
        draftId: "p05-document-outline",
        viewMode: "desk",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, DOCUMENT_OUTLINE_FIXTURE);

  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );

  const outlineTrigger = page.getByRole("button", {
    name: "فهرست سند",
    exact: true,
  });
  await outlineTrigger.click();

  const sidebar = page.locator("#library-panel");
  const panel = page.locator("#document-outline-pane");
  const rows = panel.locator(".reading-document-outline-list .sidebar-row");
  await expect(panel).toBeVisible();
  await expect(page.locator("#sidebar-pane-title")).toHaveText("فهرست سند");
  await expect(
    sidebar.getByRole("button", { name: "جست‌وجو در فهرست سند" }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("button", { name: "جمع‌کردن نوار کناری" }),
  ).toBeVisible();
  await expect(panel.locator(".reading-document-outline-summary")).toHaveText(
    "ساختار سند · ۵ بخش",
  );
  await expect(rows).toHaveCount(5);
  await expect(rows.locator("svg")).toHaveCount(0);
  await expect(rows.nth(0)).toContainText("مقدمه");
  await expect(rows.nth(0)).toContainText("۰۱");
  await expect(rows.nth(1)).toContainText("۰۲");
  await expect(rows.nth(2)).toContainText("۲٫۱");
  await expect(rows.nth(3)).toContainText("۲٫۲");
  await expect(rows.nth(4)).toContainText("۰۳");
  await expect(rows.nth(0)).toHaveAttribute("aria-current", "location");
  await expect(sidebar).toContainText("محلی · فقط تیترهای همین سند");

  await page.waitForTimeout(260);
  const geometry = await page.evaluate(() => {
    const rect = (selector: string) => {
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
    const style = (selector: string) =>
      getComputedStyle(document.querySelector<HTMLElement>(selector)!);
    return {
      shell: rect("#library-panel"),
      pane: rect("#library-panel .sidebar-pane"),
      rail: rect("#library-panel .sidebar-rail"),
      header: rect("#library-panel .sidebar-pane-header"),
      rowHeight: rect("#document-outline-pane .sidebar-row").height,
      neutralBorder: style(
        "#document-outline-pane .sidebar-row:not(.is-active)",
      ).borderWidth,
      activeBackground: style(
        "#document-outline-pane .sidebar-row.is-active",
      ).backgroundColor,
      activeColor: style(
        "#document-outline-pane .sidebar-row.is-active",
      ).color,
      titleSize: style("#document-outline-pane .sidebar-row-label").fontSize,
      metaSize: style("#document-outline-pane .sidebar-row-meta").fontSize,
      parentIndent: style(
        "#document-outline-pane .sidebar-row:nth-child(1)",
      ).paddingRight,
      childIndent: style(
        "#document-outline-pane .sidebar-row:nth-child(3)",
      ).paddingRight,
      footerHeight: rect("#library-panel .library-footer").height,
    };
  });

  expect(geometry.shell).toEqual({ x: 920, y: 92, width: 360, height: 822 });
  expect(geometry.pane).toEqual({ x: 920, y: 92, width: 304, height: 822 });
  expect(geometry.rail).toEqual({ x: 1224, y: 92, width: 56, height: 822 });
  expect(geometry.header).toEqual({ x: 934, y: 106, width: 276, height: 52 });
  expect(geometry.rowHeight).toBe(40);
  expect(geometry.neutralBorder).toBe("0px");
  expect(geometry.activeBackground).toBe("rgb(233, 239, 255)");
  expect(geometry.activeColor).toBe("rgb(37, 87, 229)");
  expect(geometry.titleSize).toBe("12px");
  expect(geometry.metaSize).toBe("11px");
  expect(geometry.parentIndent).toBe("8px");
  expect(geometry.childIndent).toBe("18px");
  expect(geometry.footerHeight).toBe(17);

  await page.screenshot({
    path: ".artifacts/p05-document-outline.png",
    fullPage: true,
  });

  await rows.nth(0).focus();
  await page.keyboard.press("ArrowDown");
  await expect(rows.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(rows.nth(4)).toBeFocused();
  await rows.nth(3).click();
  await expect(rows.nth(3)).toHaveAttribute("aria-current", "location");

  const searchAction = sidebar.getByRole("button", {
    name: "جست‌وجو در فهرست سند",
  });
  await searchAction.click();
  const searchInput = sidebar.getByRole("searchbox", {
    name: "جست‌وجو در فهرست سند",
  });
  await expect(searchInput).toBeFocused();
  await searchInput.fill("روش");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("روش اجرا");
  await searchInput.fill("ناموجود");
  await expect(panel).toContainText("تیتر مطابق جست‌وجو پیدا نشد");
  await panel
    .getByRole("button", { name: "پاک‌کردن جست‌وجوی فهرست" })
    .click();
  await expect(rows).toHaveCount(5);
  await searchAction.click();
  await expect(searchInput).toBeHidden();

  const editor = page.locator("#markdown-editor .cm-content");
  await page.locator('[data-command-id="view.editor.source"]').click();
  await editor.press("ControlOrMeta+A");
  await page.keyboard.insertText("متن بدون تیتر");
  await expect.poll(() => page.evaluate(() => JSON.parse(
    localStorage.getItem("raavi:document:v1") ?? "{}",
  ).content)).toBe("متن بدون تیتر");
  await expect(panel.locator(".reading-document-outline-summary")).toHaveText(
    "ساختار سند · ۰ بخش",
  );
  await expect(panel).toContainText("این سند هنوز تیتر ندارد");

  await panel.focus();
  await page.keyboard.press("Escape");
  await expect(sidebar).toHaveClass(/is-collapsed/);
  await expect(outlineTrigger).toBeFocused();
});
