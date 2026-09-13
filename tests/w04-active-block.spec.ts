import { Buffer } from "node:buffer";
import { expect, test } from "@playwright/test";

test("W04 aligns a filled active block, its gutter and selection status", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );

  const activeCopy = "بلوک فعال مرز و کنترل‌های ویرایش را نشان می‌دهد.";
  const fixture = [
    "# نوشتن برای خوانده‌شدن",
    "این سند نمونه، ساختار بلوکی و رفتار ویرایش روان را نشان می‌دهد.",
    "",
    activeCopy,
  ].join("\n");
  await page
    .locator('input[type="file"][accept*=".md"]')
    .first()
    .setInputFiles({
      name: "راهنمای نگارش.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(fixture),
    });
  await page.getByRole("button", { name: "بازگشت به میز", exact: true }).click();
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();

  const editor = page.locator("#markdown-editor .cm-content");
  await expect(page.locator(".document-identity")).toContainText(
    "راهنمای نگارش.md",
  );
  await expect(page.locator(".save-indicator")).toContainText("ذخیره شده");
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.press("Shift+Home");

  const activeBlock = page.locator(
    ".cm-line.cm-activeLine.cm-live-syntax-is-visible",
  );
  const gutter = page.locator(".writing-block-gutter");
  const status = page.locator(".document-status-bar");

  await expect(activeBlock).toContainText(activeCopy);
  await expect(gutter).toBeVisible();
  await expect(status).toHaveAttribute("data-view", "selection");
  await expect(status).toHaveText("۹ واژهٔ انتخاب‌شده · ۴۸ نویسه");

  const selectionMenu = page.getByRole("toolbar", {
    name: "قالب‌بندی متن انتخاب‌شده",
  });
  await expect(selectionMenu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(selectionMenu).toBeHidden();
  await expect(status).toHaveAttribute("data-view", "selection");

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
    const active = document.querySelector<HTMLElement>(
      ".cm-line.cm-activeLine.cm-live-syntax-is-visible",
    )!;
    const activeFrame = getComputedStyle(active, "::before");
    const selectionStatus = document.querySelector<HTMLElement>(
      ".document-status-bar.is-selection",
    )!;
    return {
      document: rect('[data-workspace-screen="writing"] .editor-pane'),
      activeBlock: rect(
        ".cm-line.cm-activeLine.cm-live-syntax-is-visible",
      ),
      gutter: rect(".writing-block-gutter"),
      status: rect(".document-status-bar"),
      activeBackground: getComputedStyle(active).backgroundColor,
      activeColor: getComputedStyle(active).color,
      activeFocusEffect: getComputedStyle(active).boxShadow,
      activeFrame: {
        color: activeFrame.borderInlineStartColor,
        inlineWidth: activeFrame.borderInlineStartWidth,
        topWidth: activeFrame.borderTopWidth,
        bottomWidth: activeFrame.borderBottomWidth,
      },
      statusBackground: getComputedStyle(selectionStatus).backgroundColor,
      statusColor: getComputedStyle(selectionStatus).color,
      saveBorder: getComputedStyle(
        document.querySelector<HTMLElement>(".save-indicator")!,
      ).borderWidth,
      selectedModeBackground: getComputedStyle(
        document.querySelector<HTMLElement>(
          '.editor-mode-switcher button[aria-pressed="true"]',
        )!,
      ).backgroundColor,
    };
  });

  expect(geometry.document).toEqual({
    x: 232,
    y: 144,
    width: 760,
    height: 754,
  });
  expect(geometry.activeBlock).toEqual({
    x: 233,
    y: 277,
    width: 758,
    height: 34,
  });
  expect(geometry.gutter).toEqual({
    x: 999,
    y: 277,
    width: 58,
    height: 28,
  });
  expect(geometry.status).toEqual({
    x: 502,
    y: 868,
    width: 220,
    height: 20,
  });
  expect(geometry.activeBackground).toBe("rgb(233, 239, 255)");
  expect(geometry.activeColor).toBe("rgb(23, 27, 24)");
  expect(geometry.activeFocusEffect).toBe("none");
  expect(geometry.activeFrame).toEqual({
    color: "rgb(159, 181, 255)",
    inlineWidth: "1px",
    topWidth: "1px",
    bottomWidth: "1px",
  });
  expect(geometry.statusBackground).toBe("rgb(233, 239, 255)");
  expect(geometry.statusColor).toBe("rgb(37, 87, 229)");
  expect(geometry.saveBorder).toBe("0px");
  expect(geometry.selectedModeBackground).toBe("rgb(23, 27, 24)");

  await expect(page.locator(".toast")).toBeHidden({ timeout: 8_000 });
  await expect(selectionMenu).toBeHidden();

  await page.screenshot({
    path: ".artifacts/w04-active-block.png",
    fullPage: true,
  });

  await page.keyboard.press("ArrowRight");
  await expect(status).toHaveAttribute("data-view", "document");
  await expect(status).toHaveText("۲۴ واژه · ۴ خط");
});
