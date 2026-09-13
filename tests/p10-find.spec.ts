import { expect, test, type Page } from "@playwright/test";
import { openWritingDocument as openWritingWorkspace } from "./helpers/open-writing-document";

const QUERY = "اعتماد";
const DOCUMENT = Array.from(
  { length: 18 },
  (_, index) => `بند ${index + 1}: اعتماد پایهٔ همکاری و گفت‌وگو است.`,
).join("\n\n");

async function openWritingDocument(page: Page) {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingWorkspace(page);
  const editor = page.locator("#markdown-editor .cm-content");
  await expect(editor).toBeVisible();
  await editor.fill(DOCUMENT);
  await editor.focus();
  await page.keyboard.press("Control+Home");
  return editor;
}

test("P10 matches Find / Found and keeps local keyboard navigation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "light");
  });
  const editor = await openWritingDocument(page);

  await page.keyboard.press("Control+f");
  const panel = page.getByRole("search", { name: "جست‌وجو در سند" });
  const input = panel.getByRole("searchbox", { name: "جست‌وجو در سند" });
  const count = panel.getByRole("status", {
    name: "موقعیت نتیجهٔ جست‌وجو",
  });
  await expect(panel).toBeVisible();
  await expect(input).toBeFocused();
  await input.fill(QUERY);
  await expect(count).toHaveText("۱ از ۱۸");

  const caseButton = panel.getByRole("button", {
    name: "حساس به بزرگی و کوچکی حروف",
  });
  const wordButton = panel.getByRole("button", {
    name: "تطبیق تمام واژه",
  });
  const regexpButton = panel.getByRole("button", { name: "عبارت منظم" });
  await expect(caseButton).toHaveAttribute("aria-pressed", "false");
  await caseButton.click();
  await expect(caseButton).toHaveAttribute("aria-pressed", "true");
  await expect(wordButton).toHaveAttribute("aria-pressed", "false");
  await expect(regexpButton).toHaveAttribute("aria-pressed", "false");

  await input.press("F3");
  await expect(count).toHaveText("۲ از ۱۸");
  await input.press("Shift+F3");
  await expect(count).toHaveText("۱ از ۱۸");

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
    const options = Array.from(
      document.querySelectorAll<HTMLElement>(".raavi-find-option"),
    ).map((element) => Math.round(element.getBoundingClientRect().height));
    return {
      panel: rect(".raavi-find-panel"),
      field: rect(".raavi-search-field"),
      control: rect(".raavi-search-control"),
      close: rect(".raavi-find-close"),
      options,
      borderWidth: getComputedStyle(
        document.querySelector<HTMLElement>(".raavi-find-panel")!,
      ).borderWidth,
      radius: getComputedStyle(
        document.querySelector<HTMLElement>(".raavi-find-panel")!,
      ).borderRadius,
    };
  });
  // D01 adds a 1px border around the 760px editor paper.
  expect(geometry.panel).toEqual({ x: 233, y: 145, width: 758, height: 100 });
  expect(geometry.field.width).toBe(320);
  expect(geometry.field.height).toBe(84);
  expect(geometry.control.height).toBe(36);
  expect(geometry.close).toMatchObject({ width: 36, height: 36 });
  expect(geometry.options).toEqual([36, 36, 36]);
  expect(geometry.borderWidth).toBe("0px");
  expect(geometry.radius).toBe("14px");

  await panel.locator(".raavi-find-close").focus();
  await expect(panel.locator(".raavi-search-control")).toHaveCSS(
    "box-shadow",
    "none",
  );
  await input.focus();

  await page.screenshot({
    path: ".artifacts/p10-find-found.png",
    fullPage: true,
  });

  const clear = panel.getByRole("button", {
    name: "پاک‌کردن عبارت جست‌وجو",
  });
  await clear.click();
  await expect(input).toHaveValue("");
  await expect(count).toHaveText("۰ از ۰");
  await expect(input).toBeFocused();

  await input.fill(QUERY);
  await input.press("Escape");
  await expect(panel).toBeHidden();
  await expect(editor).toBeFocused();

  await editor.fill(Array.from({ length: 10_001 }, () => "ا").join(" "));
  await editor.focus();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Control+f");
  const largePanel = page.getByRole("search", { name: "جست‌وجو در سند" });
  const largeInput = largePanel.getByRole("searchbox", {
    name: "جست‌وجو در سند",
  });
  await largeInput.fill("ا");
  await expect(
    largePanel.getByRole("status", { name: "موقعیت نتیجهٔ جست‌وجو" }),
  ).toHaveText("۱ از ۱۰۰۰۱");
  const navigationStartedAt = Date.now();
  await largeInput.press("F3");
  await expect(
    largePanel.getByRole("status", { name: "موقعیت نتیجهٔ جست‌وجو" }),
  ).toHaveText("۲ از ۱۰۰۰۱");
  expect(Date.now() - navigationStartedAt).toBeLessThan(1_500);
  await largePanel.getByRole("button", { name: "بستن جست‌وجو" }).click();
  await expect(largePanel).toBeHidden();
});

// Mobile editor contract retired; device access is covered in desktop-access.spec.ts.
