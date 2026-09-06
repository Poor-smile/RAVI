import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";

test("W08 assembles the editable Markdown source on the full Code surface", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );

  const fixture = [
    "# نوشتن برای خوانده‌شدن",
    "",
    "متن خوب پیش از آن‌که زیبا باشد، مسیر خواندن را روشن می‌کند.",
    "",
    "- ساختار روشن",
    "- فاصلهٔ کافی",
    "- مثال کوتاه",
    "",
    "```mermaid",
    "flowchart RL",
    "  A[ایده] --> B[ساختار] --> C[متن نهایی]",
    "```",
  ].join("\n");

  await page
    .locator('input[type="file"][accept*=".md"]')
    .first()
    .setInputFiles({
      name: "راهنمای نگارش.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(fixture),
    });
  const leaveReading = page.getByRole("button", {
    name: "بازگشت به میز",
    exact: true,
  });
  if (await leaveReading.isVisible()) await leaveReading.click();
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await page
    .getByRole("button", { name: "فعال‌کردن تم تاریک", exact: true })
    .click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).not.toHaveClass(/theme-is-changing/);

  const editor = page.locator("#markdown-editor .cm-content");
  const shell = page.locator(".app-shell");
  const workspace = page.locator('[data-workspace-screen="code"]');
  const codeToolbar = workspace.getByRole("toolbar", {
    name: "ابزارهای نمای کد",
  });
  await expect(shell).toHaveClass(/is-code-mode/);
  await expect(shell).not.toHaveClass(/is-split-mode|is-writing-mode/);
  await expect(workspace).toBeVisible();
  await expect(workspace.locator(".code-editor-heading")).toHaveCount(0);
  await expect(codeToolbar).toBeVisible();
  await expect(codeToolbar).toHaveCSS("height", "40px");
  await expect(codeToolbar.getByRole("button", { name: "درج بلوک" })).toHaveCount(0);
  await expect(codeToolbar.getByRole("button", { name: "تغییر نوع بلوک" })).toHaveCount(0);
  await expect(page.locator("#markdown-editor .cm-block-menu-trigger")).toHaveCount(0);
  const directionButton = codeToolbar.getByRole("button", {
    name: "جهت خطوط: Auto",
  });
  await directionButton.click();
  await page
    .getByRole("menu", { name: "جهت نمایش خطوط" })
    .getByRole("menuitemradio", { name: /LTR/ })
    .click();
  await expect(page.locator("#markdown-editor .cm-editor")).toHaveAttribute(
    "data-line-direction",
    "ltr",
  );
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(
          localStorage.getItem("raavi:code-view-preferences:v1") ?? "{}",
        ),
      ),
    )
    .toMatchObject({ toolbarVisible: true, lineDirection: "ltr" });
  await codeToolbar.getByRole("button", { name: "جهت خطوط: LTR" }).click();
  await page
    .getByRole("menu", { name: "جهت نمایش خطوط" })
    .getByRole("menuitemradio", { name: /Auto/ })
    .click();
  await expect
    .poll(async () =>
      (await page.locator("#markdown-editor .cm-line").allTextContents()).join(
        "\n",
      ),
    )
    .toBe(fixture);
  await editor.focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText("آزمون انتخاب کل فایل");
  await expect(page.locator("#markdown-editor .cm-line")).toHaveCount(1);
  await expect(editor).toHaveText("آزمون انتخاب کل فایل");
  await page.keyboard.press("Control+Z");
  await expect
    .poll(async () =>
      (await page.locator("#markdown-editor .cm-line").allTextContents()).join(
        "\n",
      ),
    )
    .toBe(fixture);
  await page.keyboard.press("Control+Enter");
  await expect
    .poll(async () =>
      (await page.locator("#markdown-editor .cm-line").allTextContents()).join(
        "\n",
      ),
    )
    .toBe(`${fixture}\n\n`);
  await expect(page.locator(".cm-structural-block-selected")).toHaveCount(0);
  await page.keyboard.press("Control+End");
  await page.keyboard.insertText("\u200b");
  await expect(page.locator(".save-indicator")).toContainText(
    "هشدار: ذخیره نشده",
  );
  await expect(
    page.locator('.editor-mode-switcher button[aria-pressed="true"]'),
  ).toHaveAttribute("aria-label", "متن خام");
  await expect(page.locator(".sidebar-rail > button:enabled")).toHaveCount(8);
  await expect(page.locator(".sidebar-shell")).not.toHaveClass(/is-open/);

  const contract = await page.evaluate(() => {
    const element = (selector: string) =>
      document.querySelector<HTMLElement>(selector)!;
    const rect = (selector: string) => {
      const bounds = element(selector).getBoundingClientRect();
      return {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    const style = (selector: string) => getComputedStyle(element(selector));
    const firstLine = element("#markdown-editor .cm-line");

    return {
      geometry: {
        titleBar: rect(".topbar"),
        commandBar: rect(".proofbar"),
        workspace: rect('[data-workspace-screen="code"]'),
        rail: rect(".sidebar-rail"),
        codeSurface: rect(
          '[data-workspace-screen="code"] .editor-pane',
        ),
        source: rect("#markdown-editor .cm-content"),
        firstLine: rect("#markdown-editor .cm-line"),
      },
      colors: {
        titleBar: style(".topbar").backgroundColor,
        commandBar: style(".proofbar").backgroundColor,
        workspace: style('[data-workspace-screen="code"]').backgroundColor,
        rail: style(".sidebar-rail").backgroundColor,
        codeSurface: style(
          '[data-workspace-screen="code"] .editor-pane',
        ).backgroundColor,
        source: style("#markdown-editor .cm-content").color,
        selectedMode: style(
          '.editor-mode-switcher button[aria-pressed="true"]',
        ).backgroundColor,
        selectedModeText: style(
          '.editor-mode-switcher button[aria-pressed="true"]',
        ).color,
      },
      details: {
        radius: style(
          '[data-workspace-screen="code"] .editor-pane',
        ).borderRadius,
        border: style(
          '[data-workspace-screen="code"] .editor-pane',
        ).borderWidth,
        shadow: style(
          '[data-workspace-screen="code"] .editor-pane',
        ).boxShadow,
        sourceSize: style("#markdown-editor .cm-content").fontSize,
        sourceLineHeight: style("#markdown-editor .cm-content").lineHeight,
        sourceFont: style("#markdown-editor .cm-content").fontFamily,
        sourcePadding: style("#markdown-editor .cm-content").padding,
        gutterDisplay: style("#markdown-editor .cm-gutters").display,
        activeLineBackground: getComputedStyle(firstLine).backgroundColor,
        activeLineBorder: getComputedStyle(firstLine).borderWidth,
        paneHeaderDisplay: style(
          '[data-workspace-screen="code"] .pane-header',
        ).display,
        documentMenuWidth: style(".document-menu-shell").width,
        modeControlWidth: style(".editor-mode-switcher").width,
      },
    };
  });

  expect(contract.geometry.titleBar).toEqual({ x: 0, y: 0, width: 1280, height: 36 });
  expect(contract.geometry.commandBar).toEqual({ x: 0, y: 36, width: 1280, height: 56 });
  expect(contract.geometry.workspace).toEqual({ x: 0, y: 128, width: 1224, height: 786 });
  expect(contract.geometry.rail).toEqual({ x: 1224, y: 92, width: 56, height: 822 });
  expect(contract.geometry.codeSurface).toEqual(contract.geometry.workspace);
  expect(contract.geometry.source.x).toBeLessThan(64);
  expect(contract.geometry.source.y).toBe(128);
  expect(contract.geometry.source.height).toBe(786);
  expect(contract.geometry.firstLine.y).toBe(148);
  expect(contract.colors).toEqual({
    titleBar: "rgb(14, 19, 15)",
    commandBar: "rgb(24, 30, 26)",
    workspace: "rgb(26, 33, 28)",
    rail: "rgb(16, 20, 17)",
    codeSurface: "rgb(24, 30, 26)",
    source: "rgb(240, 244, 239)",
    selectedMode: "rgb(8, 11, 9)",
    selectedModeText: "rgb(247, 250, 247)",
  });
  expect(contract.details).toEqual({
    radius: "0px",
    border: "0px",
    shadow: "none",
    sourceSize: "13px",
    sourceLineHeight: "23px",
    sourceFont: "Tahoma, Arial, sans-serif",
    sourcePadding: "20px 64px 96px",
    gutterDisplay: "flex",
    activeLineBackground: "rgba(0, 0, 0, 0)",
    activeLineBorder: "0px",
    paneHeaderDisplay: "none",
    documentMenuWidth: "132px",
    modeControlWidth: "156px",
  });

  await editor.evaluate((node) => (node as HTMLElement).blur());
  await page.mouse.move(8, 104);
  await expect(page.locator(".toast")).toBeHidden({ timeout: 8_000 });
  await page.screenshot({
    path: ".artifacts/w08-code.png",
    fullPage: true,
  });

  await editor.fill(`${fixture}\n\nویرایش محلی`);
  await expect(editor).toContainText("ویرایش محلی");
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect(editor).toContainText("ویرایش محلی");
});

test("Code view keeps slash literal and never opens the block menu", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "raavi:code-view-preferences:v1",
      JSON.stringify({ toolbarVisible: false, lineDirection: "auto" }),
    );
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page
    .locator('input[type="file"][accept*=".md"]')
    .first()
    .setInputFiles({
      name: "slash.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# عنوان\n\n"),
    });
  const leaveReading = page.getByRole("button", {
    name: "بازگشت به میز",
    exact: true,
  });
  if (await leaveReading.isVisible()) await leaveReading.click();
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect(page.locator(".code-view-toolbar")).toHaveCount(0);
  const editor = page.locator("#markdown-editor .cm-content");
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("/");
  await expect(page.locator(".editor-block-menu.is-slash")).toHaveCount(0);
  await expect(editor).toContainText("/");
  await expect(page.locator(".writing-block-gutter")).toHaveCount(0);
  await expect(page.locator(".cm-block-menu-trigger")).toHaveCount(0);
  await expect(page.locator(".cm-structural-block-selected")).toHaveCount(0);
});

test("Code view keeps a bounded reading inset on ultrawide screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 3440, height: 1440 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page
    .locator('input[type="file"][accept*=".md"]')
    .first()
    .setInputFiles({
      name: "ultrawide.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# نمای فوق‌عریض\n\nمتن و کد باید از لبه‌ها فاصله داشته باشند."),
    });
  const leaveReading = page.getByRole("button", {
    name: "بازگشت به میز",
    exact: true,
  });
  if (await leaveReading.isVisible()) await leaveReading.click();
  await page.getByRole("button", { name: "متن خام", exact: true }).click();

  await expect(page.locator("#markdown-editor .cm-content")).toHaveCSS(
    "padding",
    "20px 160px 96px",
  );
  await page.screenshot({
    path: ".artifacts/w08-code-ultrawide.png",
    fullPage: true,
  });
});
