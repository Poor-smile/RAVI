import { expect, test, type Locator, type Page } from "@playwright/test";
import { openWritingDocument as openWritingWorkspace } from "./helpers/open-writing-document";

const QUERY = "اعتماد";
const REPLACEMENT = "اطمینان";
const DOCUMENT = Array.from(
  { length: 18 },
  (_, index) => `بند ${index + 1}: اعتماد پایهٔ همکاری و گفت‌وگو است.`,
).join("\n\n");

async function editorSource(editor: Locator) {
  return (await editor.locator(".cm-line").allTextContents()).join("\n");
}

function occurrenceCount(source: string, value: string) {
  return source.split(value).length - 1;
}

async function openWritingDocument(page: Page) {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingWorkspace(page);
  const editor = page.locator("#markdown-editor");
  const content = editor.locator(".cm-content");
  await expect(content).toBeVisible();
  await content.fill(DOCUMENT);
  await content.focus();
  await page.keyboard.press("Control+Home");
  return { editor, content };
}

test("P11 matches Replace / Found and replaces locally with one-step undo", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "dark");
  });
  const { editor, content } = await openWritingDocument(page);

  await page.keyboard.press("Control+h");
  const panel = page.getByRole("search", {
    name: "جست‌وجو و جایگزینی در سند",
  });
  const searchInput = panel.getByRole("searchbox", {
    name: "جست‌وجو در سند",
  });
  const replaceInput = panel.getByRole("textbox", { name: "جایگزینی با" });
  const count = panel.getByRole("status", {
    name: "موقعیت نتیجهٔ جست‌وجو",
  });
  const replaceButton = panel.getByRole("button", {
    name: "جایگزینی نتیجهٔ فعلی",
  });
  const replaceAllButton = panel.getByRole("button", {
    name: "جایگزینی همهٔ نتیجه‌ها",
  });

  await expect(panel).toBeVisible();
  await expect(searchInput).toBeFocused();
  await searchInput.fill(QUERY);
  await expect(count).toHaveText("۱ از ۱۸");
  await replaceInput.fill(REPLACEMENT);
  await expect(replaceInput).toBeFocused();
  await panel
    .getByRole("button", { name: "حساس به بزرگی و کوچکی حروف" })
    .click();
  await searchInput.focus();

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
      panel: rect(".raavi-find-panel.is-replace"),
      queryRow: rect(".raavi-find-row"),
      replaceRow: rect(".raavi-replace-row"),
      field: rect(".raavi-replace-field"),
      control: rect(".raavi-replace-control"),
      replaceAction: rect(".raavi-replace-current"),
      allAction: rect(".raavi-replace-all"),
      borderWidth: getComputedStyle(
        document.querySelector<HTMLElement>(".raavi-replace-control")!,
      ).borderWidth,
      radius: getComputedStyle(
        document.querySelector<HTMLElement>(".raavi-find-panel")!,
      ).borderRadius,
    };
  });
  expect(geometry.panel).toEqual({ x: 232, y: 144, width: 760, height: 192 });
  expect(geometry.queryRow.height).toBe(84);
  expect(geometry.replaceRow.height).toBe(84);
  expect(geometry.field).toMatchObject({ width: 320, height: 84 });
  expect(geometry.control.height).toBe(36);
  expect(geometry.replaceAction.height).toBe(36);
  expect(geometry.allAction.height).toBe(36);
  expect(geometry.borderWidth).toBe("0px");
  expect(geometry.radius).toBe("14px");

  await page.screenshot({
    path: ".artifacts/p11-replace-found.png",
    fullPage: true,
  });

  await searchInput.press("Control+f");
  const compactFindPanel = page.getByRole("search", {
    name: "جست‌وجو در سند",
  });
  await expect(compactFindPanel).toBeVisible();
  await compactFindPanel
    .getByRole("searchbox", { name: "جست‌وجو در سند" })
    .press("Control+h");
  await expect(panel).toBeVisible();
  await expect(replaceInput).toBeFocused();

  await replaceButton.click();
  await expect(count).toHaveText("۱ از ۱۷");
  expect(occurrenceCount(await editorSource(editor), REPLACEMENT)).toBe(1);
  await page.locator('[data-command-id="edit.undo"]:visible').first().click();
  await expect(count).toHaveText("۱ از ۱۸");
  expect(occurrenceCount(await editorSource(editor), QUERY)).toBe(18);

  await replaceAllButton.click();
  await expect(count).toHaveText("۰ از ۰");
  expect(occurrenceCount(await editorSource(editor), REPLACEMENT)).toBe(18);
  expect(occurrenceCount(await editorSource(editor), QUERY)).toBe(0);
  await page.locator('[data-command-id="edit.undo"]:visible').first().click();
  await expect(count).toHaveText(/از ۱۸$/u);
  expect(occurrenceCount(await editorSource(editor), QUERY)).toBe(18);

  await replaceInput.focus();
  await replaceInput.press("Enter");
  await expect(count).toHaveText("۱ از ۱۷");
  expect(occurrenceCount(await editorSource(editor), REPLACEMENT)).toBe(1);
  await replaceInput.press("Escape");
  await expect(panel).toBeHidden();
  await expect(content).toBeFocused();

  await page.keyboard.press("Control+f");
  const findPanel = page.getByRole("search", { name: "جست‌وجو در سند" });
  await expect(findPanel).toBeVisible();
  await expect(findPanel.locator(".raavi-replace-row")).toBeHidden();
  await expect(findPanel).toHaveCSS("height", "100px");

  await findPanel
    .getByRole("searchbox", { name: "جست‌وجو در سند" })
    .press("Escape");
  await content.fill(Array.from({ length: 10_001 }, () => "ا").join(" "));
  await content.focus();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Control+h");
  const largePanel = page.getByRole("search", {
    name: "جست‌وجو و جایگزینی در سند",
  });
  await largePanel
    .getByRole("searchbox", { name: "جست‌وجو در سند" })
    .fill("ا");
  const largeCount = largePanel.getByRole("status", {
    name: "موقعیت نتیجهٔ جست‌وجو",
  });
  await expect(largeCount).toHaveText("۱ از ۱۰۰۰۱");
  const replacementTypingDuration = await largePanel
    .getByRole("textbox", { name: "جایگزینی با" })
    .evaluate((element, replacement) => {
      const input = element as HTMLInputElement;
      const startedAt = performance.now();
      for (const character of replacement) {
        input.value += character;
        input.dispatchEvent(
          new InputEvent("input", {
            bubbles: true,
            data: character,
            inputType: "insertText",
          }),
        );
      }
      return performance.now() - startedAt;
    }, "متن جایگزین بلند برای سنجش کارایی");
  await expect(largeCount).toHaveText("۱ از ۱۰۰۰۱");
  expect(replacementTypingDuration).toBeLessThan(250);
});

test("P11 mobile Replace stacks fields and keeps every action at 44px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "dark");
  });
  await openWritingDocument(page);
  await page.keyboard.press("Control+h");
  const panel = page.getByRole("search", {
    name: "جست‌وجو و جایگزینی در سند",
  });
  await expect(panel).toBeVisible();
  const targets = await panel
    .locator(
      ".raavi-find-control, .raavi-find-option, .raavi-search-control, .raavi-search-clear, .raavi-search-input, .raavi-replace-action, .raavi-replace-control, .raavi-replace-input",
    )
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      }),
    );
  for (const target of targets) {
    expect(target.width).toBeGreaterThanOrEqual(44);
    expect(target.height).toBeGreaterThanOrEqual(44);
  }
  const panelBox = await panel.boundingBox();
  expect(panelBox?.height).toBe(324);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});

test("P11 panel shortcuts remain platform-specific on macOS", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    Object.defineProperty(navigator, "userAgentData", {
      configurable: true,
      get: () => ({ platform: "macOS" }),
    });
    Object.defineProperty(navigator, "platform", {
      configurable: true,
      get: () => "MacIntel",
    });
  });
  const { content } = await openWritingDocument(page);
  await page.keyboard.press("Meta+f");
  const findPanel = page.getByRole("search", { name: "جست‌وجو در سند" });
  const searchInput = findPanel.getByRole("searchbox", {
    name: "جست‌وجو در سند",
  });
  await expect(findPanel).toBeVisible();

  await searchInput.dispatchEvent("keydown", {
    key: "h",
    code: "KeyH",
    ctrlKey: true,
    bubbles: true,
  });
  await expect(findPanel).toBeVisible();

  await searchInput.dispatchEvent("keydown", {
    key: "f",
    code: "KeyF",
    metaKey: true,
    altKey: true,
    bubbles: true,
  });
  const replacePanel = page.getByRole("search", {
    name: "جست‌وجو و جایگزینی در سند",
  });
  await expect(replacePanel).toBeVisible();
  const replaceInput = replacePanel.getByRole("textbox", {
    name: "جایگزینی با",
  });

  await replaceInput.dispatchEvent("keydown", {
    key: "f",
    code: "KeyF",
    ctrlKey: true,
    bubbles: true,
  });
  await expect(replacePanel).toBeVisible();

  await replaceInput.dispatchEvent("keydown", {
    key: "f",
    code: "KeyF",
    metaKey: true,
    bubbles: true,
  });
  await expect(findPanel).toBeVisible();
  await expect(content).not.toBeFocused();
});
