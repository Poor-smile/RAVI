import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";

test("W07 keeps Code and block Writing synchronized and promotes either leaf to fullscreen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 900, height: 914 });
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
    "> ساختار به خواننده اطمینان می‌دهد.",
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

  await page
    .getByRole("button", { name: "نمونه‌خوانی دوبرگی", exact: true })
    .click();

  const shell = page.locator(".app-shell");
  const split = page.locator('[data-workspace-screen="split"]');
  const codePane = split.locator(".editor-pane");
  const writingPane = split.locator(".preview-pane");
  const separator = split.getByRole("separator", {
    name: "تغییر اندازهٔ کد و نوشتن",
    exact: true,
  });

  await expect(split).toHaveAttribute("data-pane-layout", "split");
  await expect(codePane.locator(".pane-title strong")).toHaveText("کد");
  await expect(writingPane.locator(".pane-title strong")).toHaveText("نوشتن");
  await expect(codePane.locator("#markdown-editor")).toBeVisible();
  await expect(writingPane.locator("#writing-editor")).toBeVisible();
  await expect(codePane.locator("#markdown-editor .cm-content")).toHaveCSS(
    "padding",
    "36px 24px 80px",
  );
  await expect(writingPane.locator(".writing-block-gutter")).toBeVisible();
  await expect(separator).toHaveAttribute("aria-valuenow", "50");

  const paneWidths = await Promise.all([
    codePane.evaluate((node) => node.getBoundingClientRect().width),
    writingPane.evaluate((node) => node.getBoundingClientRect().width),
  ]);
  expect(Math.min(...paneWidths)).toBeGreaterThanOrEqual(320);

  const writingContent = writingPane.locator("#writing-editor .cm-content");
  await writingContent.click();
  const activeWritingLine = writingPane.locator("#writing-editor .cm-activeLine");
  const writingGutter = writingPane.locator("#writing-editor .writing-block-gutter");
  const [activeLineBox, gutterBox, writingHeaderBox] = await Promise.all([
    activeWritingLine.boundingBox(),
    writingGutter.boundingBox(),
    writingPane.locator(".pane-header").boundingBox(),
  ]);
  expect(activeLineBox).not.toBeNull();
  expect(gutterBox).not.toBeNull();
  expect(writingHeaderBox).not.toBeNull();
  expect(gutterBox!.y).toBeGreaterThanOrEqual(writingHeaderBox!.y + writingHeaderBox!.height);
  expect(Math.abs(gutterBox!.y - activeLineBox!.y)).toBeLessThanOrEqual(12);
  expect(gutterBox!.x).toBeGreaterThanOrEqual(activeLineBox!.x + activeLineBox!.width);
  await page.screenshot({
    path: ".artifacts/w07-split-edit.png",
    fullPage: true,
  });
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Enter");
  await page.keyboard.insertText("یک بند تازه از نمای نوشتن");
  await expect(codePane.locator("#markdown-editor .cm-content")).toContainText(
    "یک بند تازه از نمای نوشتن",
  );
  await writingPane.locator(".writing-block-type-trigger").click();
  await expect(page.getByRole("menu", { name: "نوع بلوک" })).toBeVisible();
  await page.keyboard.press("Escape");

  const splitBox = await split.boundingBox();
  const separatorBox = await separator.boundingBox();
  expect(splitBox).not.toBeNull();
  expect(separatorBox).not.toBeNull();
  await page.mouse.move(
    separatorBox!.x + separatorBox!.width / 2,
    separatorBox!.y + separatorBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(splitBox!.x + splitBox!.width, separatorBox!.y + 20);
  await page.mouse.up();
  const code = page.locator('[data-workspace-screen="code"]');
  await expect(shell).toHaveClass(/is-code-mode/);
  await expect(shell).toHaveClass(/is-mode-swipe-to-code/);
  await expect(code.locator(".editor-pane > .pane-header")).toBeHidden();
  await expect(code.locator(".registration-spine")).toBeHidden();
  await expect(
    page.locator('.editor-mode-switcher button[aria-pressed="true"]'),
  ).toHaveAttribute("aria-label", "متن خام");

  await page
    .getByRole("button", { name: "نمونه‌خوانی دوبرگی", exact: true })
    .click();
  await expect(split).toBeVisible();
  const restoredSeparatorBox = await separator.boundingBox();
  expect(restoredSeparatorBox).not.toBeNull();
  await page.mouse.move(
    restoredSeparatorBox!.x + restoredSeparatorBox!.width / 2,
    restoredSeparatorBox!.y + restoredSeparatorBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(splitBox!.x, restoredSeparatorBox!.y + 20);
  await page.mouse.up();
  const writing = page.locator('[data-workspace-screen="writing"]');
  await expect(shell).toHaveClass(/is-writing-mode/);
  await expect(shell).toHaveClass(/is-mode-swipe-to-writing/);
  await expect(writing.locator(".editor-pane > .pane-header")).toBeHidden();
  await expect(writing.locator(".registration-spine")).toBeHidden();
  await expect(writing.locator("#markdown-editor .cm-content")).toContainText(
    "یک بند تازه از نمای نوشتن",
  );
});

test("W07 narrow desktop switches Code and Writing while preserving content", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page
    .locator('input[type="file"][accept*=".md"]')
    .first()
    .setInputFiles({
      name: "compact.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# نمای فشرده\n\nمتن آزمایشی"),
    });
  const leaveReading = page.getByRole("button", {
    name: "بازگشت به میز",
    exact: true,
  });
  if (await leaveReading.isVisible()) await leaveReading.click();

  await expect(page.getByRole("tablist", { name: "نمای موبایل" })).toHaveCount(0);
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect(page.locator('[data-workspace-screen="code"]')).toBeVisible();
  await expect(page.locator("#markdown-editor .cm-content")).toContainText("متن آزمایشی");
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
  await expect(page.locator('[data-workspace-screen="writing"]')).toBeVisible();
  await expect(page.locator("#markdown-editor .cm-content")).toContainText("متن آزمایشی");

});

test("W07 gives the Code leaf a bounded inset on ultrawide screens", async ({
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
      name: "ultrawide-split.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# نمای دوگانه\n\nفاصلهٔ بخش کد در نمایش فوق‌عریض."),
    });
  const leaveReading = page.getByRole("button", {
    name: "بازگشت به میز",
    exact: true,
  });
  if (await leaveReading.isVisible()) await leaveReading.click();
  await page
    .getByRole("button", { name: "نمونه‌خوانی دوبرگی", exact: true })
    .click();

  await expect(
    page.locator(
      '[data-workspace-screen="split"] .editor-pane #markdown-editor .cm-content',
    ),
  ).toHaveCSS("padding", "36px 48px 80px");
  await page.screenshot({
    path: ".artifacts/w07-split-edit-ultrawide.png",
    fullPage: true,
  });
});
