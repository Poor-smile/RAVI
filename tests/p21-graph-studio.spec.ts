import { expect, test, type Page } from "@playwright/test";
import { MERMAID_SAMPLES } from "../app/mermaid/samples";
import { SIMPLE_DIAGRAM_OPTIONS } from "../app/mermaid/simple-builder";

async function openGraphStudio(page: Page, viewport = { width: 1366, height: 768 }) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.clear();
    localStorage.setItem("raavi:theme:v1", "light");
    const content = "# سند جدید\n\n";
    localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        fileName: "سند جدید",
        content,
        readerSize: 18,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        documentType: "ravi",
        lastSavedSnapshot: content,
        draftId: "p21-graph-studio",
        viewMode: "live",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  const editor = page.locator("#markdown-editor .cm-content");
  await expect(editor).toBeVisible();
  await editor.focus();
  await page.keyboard.press("Alt+KeyM");
  const studio = page.getByRole("dialog", { name: "استودیو گراف", exact: true });
  await expect(studio).toBeVisible();
  return studio;
}

test("P21 matches Graph Studio type selection, builder and advanced-code frames", async ({
  page,
}) => {
  const studio = await openGraphStudio(page);
  const header = studio.locator(".mermaid-studio-header");
  const cards = studio.locator(".mermaid-ai-catalog > button");

  await expect(header.getByText("سند جدید · نمودار تازه", { exact: true })).toBeVisible();
  await expect(studio.getByText("انتخاب نوع", { exact: true })).toBeVisible();
  await expect(studio.getByRole("button", { name: "افزودن به سند" })).toBeDisabled();
  await expect(studio.getByRole("button", { name: "بازگشت به سند" })).toBeVisible();
  await expect(cards).toHaveCount(29);
  await expect(studio.getByText("۲۹ از ۲۹ نوع نمودار", { exact: true })).toBeVisible();

  const initialGeometry = await studio.evaluate((node) => {
    const rect = (selector: string) => {
      const element = selector === ":scope" ? node : node.querySelector<HTMLElement>(selector)!;
      const bounds = element.getBoundingClientRect();
      return {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    return {
      studio: rect(":scope"),
      header: rect(".mermaid-studio-header"),
      workspace: rect(".mermaid-studio-workspace"),
      editor: rect(".mermaid-studio-editor"),
      divider: rect(".mermaid-studio-divider"),
      preview: rect(".mermaid-studio-preview"),
      paneHeader: rect(".mermaid-studio-preview .mermaid-studio-pane-heading"),
      card: rect(".mermaid-ai-catalog > button"),
    };
  });
  expect(initialGeometry.studio).toEqual({ x: 0, y: 0, width: 1366, height: 768 });
  expect(initialGeometry.header.height).toBe(72);
  expect(initialGeometry.workspace.y).toBe(73);
  expect(initialGeometry.editor.width).toBeGreaterThanOrEqual(598);
  expect(initialGeometry.editor.width).toBeLessThanOrEqual(602);
  expect(initialGeometry.divider.width).toBe(8);
  expect(initialGeometry.paneHeader.height).toBe(52);
  expect(initialGeometry.card.width).toBeGreaterThanOrEqual(420);
  expect(initialGeometry.card.height).toBe(100);

  await page.screenshot({ path: ".artifacts/p21-graph-type-selection.png" });

  await studio.getByRole("option", { name: /^کلاس/u }).click();
  await expect(studio.getByText("آماده", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(studio.getByRole("region", { name: "ساخت آسان کلاس" })).toBeVisible();
  await expect(studio.getByRole("button", { name: "افزودن به سند" })).toBeEnabled();
  await expect(studio.locator("img.mermaid-render-surface")).toHaveAttribute("src", /^blob:/u, { timeout: 30_000 });
  await expect(studio.getByRole("button", { name: /^گسترش در عرض/u })).toHaveAttribute("aria-pressed", "true");
  await studio.getByRole("button", { name: /^گسترش در طول/u }).click();
  await expect(studio.getByRole("button", { name: /^گسترش در طول/u })).toHaveAttribute("aria-pressed", "true");

  const easyModeGeometry = await studio.evaluate((node) => {
    const row = node.querySelector<HTMLElement>(".mermaid-form-row")!;
    const inputs = Array.from(row.querySelectorAll<HTMLInputElement>("input"));
    const actions = row.querySelector<HTMLElement>(".mermaid-form-row-actions")!;
    const rowBounds = row.getBoundingClientRect();
    const actionBounds = actions.getBoundingClientRect();
    return {
      rowWidth: Math.round(rowBounds.width),
      inputWidths: inputs.map((input) => Math.round(input.getBoundingClientRect().width)),
      actionsBelowInputs: actionBounds.top > Math.max(...inputs.map((input) => input.getBoundingClientRect().bottom)),
      actionHeight: Math.round(actionBounds.height),
      visibleActions: actions.querySelectorAll("button:not([hidden])").length,
    };
  });
  expect(easyModeGeometry.rowWidth).toBeGreaterThanOrEqual(520);
  expect(Math.min(...easyModeGeometry.inputWidths)).toBeGreaterThanOrEqual(160);
  expect(easyModeGeometry.actionsBelowInputs).toBe(true);
  expect(easyModeGeometry.actionHeight).toBeGreaterThanOrEqual(44);
  expect(easyModeGeometry.visibleActions).toBe(4);
  await page.screenshot({ path: ".artifacts/p21-graph-easy-redesign.png" });

  await studio.getByRole("button", { name: "پیش‌نمایش تمام‌صفحه", exact: true }).click();
  await expect(studio).toHaveClass(/preview-is-fullscreen/);
  await expect(studio.locator(".mermaid-studio-editor")).toBeHidden();
  await expect(studio.getByRole("button", { name: "بستن پیش‌نمایش", exact: true })).toBeVisible();
  await studio.getByRole("button", { name: "بستن پیش‌نمایش", exact: true }).click();
  await expect(studio.locator(".mermaid-studio-editor")).toBeVisible();

  await studio.getByRole("button", { name: "کد پیشرفته", exact: true }).click();
  await expect(studio.getByText("کد Mermaid", { exact: true })).toBeVisible();
  await expect(studio.locator(".mermaid-code-editor .cm-content")).toContainText("classDiagram");
  await studio.getByRole("button", { name: "ساخت آسان", exact: true }).click();
  await studio.getByRole("button", { name: "برگرداندن تغییر فرم" }).click();
  await expect(studio.getByRole("button", { name: /^گسترش در عرض/u })).toHaveAttribute("aria-pressed", "true");
  await studio.getByRole("button", { name: "کد پیشرفته", exact: true }).click();
  await expect(studio.getByRole("button", { name: "نمونه‌ها", exact: true })).toBeVisible();
  await studio.getByRole("button", { name: "نمونه‌ها", exact: true }).click();
  await expect(studio.getByRole("complementary", { name: "نمونه‌های پیشرفتهٔ Mermaid" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(studio.locator(".mermaid-sample-library")).toBeHidden();

  await studio.locator(".mermaid-code-editor .cm-content").fill("flowchart TD\n  A[خطای باز");
  const localizedError = studio.locator(".mermaid-studio-canvas .mermaid-studio-error");
  await expect(localizedError).toBeVisible({ timeout: 30_000 });
  await expect(localizedError).toContainText("پیش‌نمایش ساخته نشد");
  await expect(localizedError.getByRole("button", { name: "رفتن به ردیف مشکل‌دار" })).toBeVisible();
  await expect(localizedError.getByText("جزئیات فنی", { exact: true })).toBeVisible();

  await studio.getByRole("button", { name: "بازگشت به سند" }).click();
  const confirm = studio.getByRole("alertdialog", { name: "تغییرات کنار گذاشته شوند؟" });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("پیش‌نویس محلی این نمودار حذف می‌شود");
  const cancel = confirm.getByRole("button", { name: "انصراف", exact: true });
  const discard = confirm.getByRole("button", { name: "کنار گذاشتن", exact: true });
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(discard).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancel).toBeFocused();
  const confirmRect = await confirm.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { width: Math.round(bounds.width), height: Math.round(bounds.height) };
  });
  expect(confirmRect.width).toBe(440);
  expect(confirmRect.height).toBeGreaterThanOrEqual(212);
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  await expect(studio.getByRole("button", { name: "بازگشت به سند" })).toBeFocused();
});

test("P21 uses the 820×980 compact Windows composition without overlay panes", async ({
  page,
}) => {
  const studio = await openGraphStudio(page, { width: 820, height: 980 });
  await studio.getByRole("option", { name: /^کلاس/u }).click();
  await expect(studio.locator("img.mermaid-render-surface")).toHaveAttribute("src", /^blob:/u, { timeout: 30_000 });

  const geometry = await studio.evaluate((node) => {
    const rect = (selector: string) => {
      const bounds = node.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      return {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    return {
      header: rect(".mermaid-studio-header"),
      editor: rect(".mermaid-studio-editor"),
      divider: rect(".mermaid-studio-divider"),
      preview: rect(".mermaid-studio-preview"),
      mode: rect(".mermaid-mode-switch"),
      actions: rect(".mermaid-studio-header-actions"),
    };
  });
  expect(geometry.header).toEqual({ x: 1, y: 1, width: 818, height: 164 });
  expect(geometry.editor.x).toBe(1);
  expect(geometry.editor.y).toBe(165);
  expect(geometry.editor.width).toBe(818);
  expect(geometry.editor.height).toBe(560);
  expect(geometry.divider.height).toBe(8);
  expect(geometry.preview.y).toBe(733);
  expect(geometry.preview.width).toBe(818);
  expect(geometry.mode.y).toBeGreaterThanOrEqual(61);
  expect(geometry.mode.y).toBeLessThanOrEqual(69);
  expect(geometry.mode.y + geometry.mode.height).toBeLessThanOrEqual(geometry.actions.y);
  await page.screenshot({ path: ".artifacts/p21-graph-compact.png" });
});

test("P21 universal catalog exposes all diagram types and the AI route keeps the selected type", async ({ page }) => {
  const studio = await openGraphStudio(page);
  await page.evaluate(() => {
    window.raaviDesktop = {
      ...(window.raaviDesktop ?? {}),
      runCodexPrompt: async () => ({
        answer: 'flowchart LR\n  A["شروع"] --> B["پایان"]',
        replacement: null,
      }),
    } as typeof window.raaviDesktop;
  });

  const catalog = studio.getByRole("listbox", { name: "نوع نمودار" });
  const options = catalog.getByRole("option");
  await expect(options).toHaveCount(29);
  await expect(catalog.locator(".ai-diagram-thumbnail img")).toHaveCount(29);
  const thumbnailSources = await catalog.locator(".ai-diagram-thumbnail img").evaluateAll((images) =>
    images.map((image) => (image as HTMLImageElement).getAttribute("src")),
  );
  expect(new Set(thumbnailSources).size).toBe(29);

  const pieOption = studio.getByRole("option", { name: /نمودار دایره‌ای/u });
  await pieOption.hover();
  const hoverPreview = studio.locator(".mermaid-ai-live-type-preview");
  await expect(hoverPreview).toBeVisible();
  await expect(hoverPreview.getByRole("img", { name: "پیش‌نمایش نمودار نمودار دایره‌ای" })).toHaveAttribute("src", "/mermaid-thumbnails/pie.png");
  await page.screenshot({ path: ".artifacts/p21-guided-catalog.png" });

  const search = studio.getByPlaceholder("نام نمودار را بنویسید…");
  await search.fill("رادار");
  await expect(catalog.getByRole("option")).toHaveCount(1);
  await expect(catalog.getByRole("option")).toContainText("Radar");
  await search.fill("sequence");
  await expect(catalog.getByRole("option")).toHaveCount(1);
  await expect(catalog.getByRole("option")).toContainText("توالی");
  await search.fill("");
  await expect(catalog.getByRole("option")).toHaveCount(29);
  await expect(studio.getByRole("option", { name: /فرایند/u })).toHaveAttribute("aria-selected", "true");
  await studio.getByRole("option", { name: /فرایند/u }).click();
  await studio.locator(".mermaid-mode-switch--pane").getByRole("button", { name: "ساخت با هوش مصنوعی", exact: true }).click();
  await expect(studio.getByRole("listbox", { name: "نوع نمودار" })).toBeHidden();
  await expect(studio.getByText("اطلاعات «فرایند» را وارد کنید", { exact: true })).toBeVisible();
  await studio.getByLabel("داده یا درخواست اصلاح").fill("شروع سپس پایان");
  await studio.getByRole("button", { name: "تحلیل اطلاعات و ساخت نمودار" }).click();
  await expect(studio.getByText("نمودار آماده است", { exact: true })).toBeVisible();
  await expect(studio.locator("img.mermaid-render-surface")).toHaveAttribute("src", /^blob:/u, { timeout: 30_000 });
  await expect(studio.getByRole("button", { name: "افزودن به سند" })).toBeEnabled();
});

test("P21 keeps the diagram type when an existing Mermaid block starts with an init directive", async ({ page }) => {
  const studio = await openGraphStudio(page);
  const source = `%%{init: {"theme": "dark", "themeVariables": {"pie1": "#1E3A5F", "pie2": "#5B2C6F", "pie3": "#145A32", "pie4": "#7D3C0C", "pie5": "#641E16"}}}%%
pie showData
  title فروش محصولات (میلیون تومان)
  "نرم‌افزار" : 58
  "خدمات مشاوره" : 28
  "آموزش" : 16
  "پشتیبانی" : 9
  "سایر" : 5`;

  await studio.getByRole("option", { name: /نمودار دایره‌ای/u }).click();
  await studio.getByRole("button", { name: "کد پیشرفته", exact: true }).click();
  await studio.locator(".mermaid-code-editor .cm-content").fill(source);
  await expect(studio.locator("img.mermaid-render-surface")).toHaveAttribute("src", /^blob:/u, { timeout: 30_000 });

  await studio.locator(".mermaid-mode-switch--pane").getByRole("button", { name: "ساخت با هوش مصنوعی", exact: true }).click();
  await expect(studio.getByText("اطلاعات «نمودار دایره‌ای» را وارد کنید", { exact: true })).toBeVisible();
  await expect(studio.getByText("نوع نمودار از کد فعلی تشخیص داده نشد", { exact: false })).toHaveCount(0);
});

test("P21 plays the approved Figma building timeline inside live preview", async ({ page }) => {
  const studio = await openGraphStudio(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.evaluate(() => {
    const state = window as typeof window & {
      __resolveGuidedBuild?: () => void;
    };
    window.raaviDesktop = {
      ...(window.raaviDesktop ?? {}),
      runCodexPrompt: () => new Promise((resolve) => {
        state.__resolveGuidedBuild = () => resolve({
          answer: 'flowchart LR\n  A["شروع"] --> B["پایان"]',
          replacement: null,
        });
      }),
    } as typeof window.raaviDesktop;
  });

  await studio.getByRole("option", { name: /^فرایند/u }).click();
  await studio.locator(".mermaid-mode-switch--pane").getByRole("button", { name: "ساخت با هوش مصنوعی", exact: true }).click();
  await studio.getByLabel("داده یا درخواست اصلاح").fill("شروع سپس پایان");
  await studio.getByRole("button", { name: "تحلیل اطلاعات و ساخت نمودار" }).click();

  const canvas = studio.locator(".mermaid-studio-canvas");
  const building = canvas.locator(".mermaid-building-preview");
  await expect(building).toBeVisible();
  await expect(building).toContainText("راوی در حال ساخت نمودار است…");
  await expect(building.locator(".mermaid-building-glass-node")).toHaveCount(5);
  await expect(building.locator(".mermaid-building-particle")).toHaveCount(8);
  await expect(building.locator(".mermaid-building-raavi-mark img")).toHaveAttribute("src", "/graph-studio/raavi-ai-approved.svg");
  await expect(canvas.locator("img.mermaid-render-surface")).toHaveCount(0);
  await expect(studio.getByText(/مرحله\s*[۰-۹0-9]+\s*از\s*[۰-۹0-9]+/u)).toHaveCount(0);

  const motionSnapshot = await building.evaluate(async (element) => {
    const sweep = element.querySelector<HTMLElement>(".mermaid-building-sweep-wrap")!;
    const firstNode = element.querySelector<HTMLElement>('[data-building-node="1"]')!;
    const frames: Array<{ sweep: string; node: string }> = [];
    for (let index = 0; index < 12; index += 1) {
      frames.push({
        sweep: getComputedStyle(sweep).transform,
        node: getComputedStyle(firstNode).opacity,
      });
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    return frames;
  });
  expect(new Set(motionSnapshot.map((frame) => frame.sweep)).size).toBeGreaterThan(1);
  expect(motionSnapshot.some((frame) => Number(frame.node) > 0)).toBe(true);
  await page.screenshot({ path: ".artifacts/p21-guided-building-motion.png" });

  await page.evaluate(() => (window as typeof window & { __resolveGuidedBuild?: () => void }).__resolveGuidedBuild?.());
  await expect(building).toBeHidden();
  await expect(studio.getByText("نمودار آماده است", { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(canvas.locator("img.mermaid-render-surface")).toHaveAttribute("src", /^blob:/u, { timeout: 30_000 });
});

test("P21 guided AI flow completes all 29 diagram contracts end to end", async ({ page }) => {
  test.setTimeout(180_000);
  const studio = await openGraphStudio(page);
  const codes = SIMPLE_DIAGRAM_OPTIONS.map((option) => {
    const sample = MERMAID_SAMPLES.find((candidate) => candidate.id === option.kind);
    if (!sample) throw new Error(`Missing Mermaid sample for ${option.kind}`);
    return sample.code;
  });
  await page.evaluate(() => {
    const state = window as typeof window & { __guidedMermaidCode?: string };
    window.raaviDesktop = {
      ...(window.raaviDesktop ?? {}),
      runCodexPrompt: async () => ({ answer: state.__guidedMermaidCode ?? "", replacement: null }),
    } as typeof window.raaviDesktop;
  });
  for (let index = 0; index < SIMPLE_DIAGRAM_OPTIONS.length; index += 1) {
    const option = SIMPLE_DIAGRAM_OPTIONS[index];
    await page.evaluate((code) => {
      (window as typeof window & { __guidedMermaidCode?: string }).__guidedMermaidCode = code;
    }, codes[index]);
    const choices = studio.getByRole("listbox", { name: "نوع نمودار" }).getByRole("option");
    await expect(choices).toHaveCount(29);
    await choices.nth(index).click();
    await studio.locator(".mermaid-mode-switch--pane").getByRole("button", { name: "ساخت با هوش مصنوعی", exact: true }).click();
    await studio.getByLabel("داده یا درخواست اصلاح").fill(`دادهٔ آزمون ${option.title}`);
    await studio.getByRole("button", { name: "تحلیل اطلاعات و ساخت نمودار" }).click();
    await expect(studio.getByText("نمودار آماده است", { exact: true })).toBeVisible({ timeout: 30_000 });
    await expect(studio.locator("img.mermaid-render-surface")).toHaveAttribute("src", /^blob:/u, { timeout: 30_000 });
    if (index < SIMPLE_DIAGRAM_OPTIONS.length - 1) {
      await studio.getByRole("button", { name: "ساخت نمودار دیگر" }).click();
    }
  }

  await studio.getByRole("button", { name: "افزودن به سند" }).click();
  await expect(studio).toBeHidden();
  await expect(page.locator("#markdown-editor .cm-content")).toContainText("treeView-beta");
});

test("P21 guided AI asks one essential clarification and then resumes", async ({ page }) => {
  const studio = await openGraphStudio(page);
  await page.evaluate(() => {
    const state = window as typeof window & { __guidedCallCount?: number };
    state.__guidedCallCount = 0;
    window.raaviDesktop = {
      ...(window.raaviDesktop ?? {}),
      runCodexPrompt: async () => {
        state.__guidedCallCount = (state.__guidedCallCount ?? 0) + 1;
        return state.__guidedCallCount === 1
          ? { answer: "QUESTION: نقطهٔ پایان فرایند چیست؟", replacement: null }
          : { answer: 'flowchart LR\n  A["شروع"] --> B["پایان"]', replacement: null };
      },
    } as typeof window.raaviDesktop;
  });
  await studio.getByRole("option", { name: /فرایند/u }).click();
  await studio.locator(".mermaid-mode-switch--pane").getByRole("button", { name: "ساخت با هوش مصنوعی", exact: true }).click();
  await studio.getByLabel("داده یا درخواست اصلاح").fill("فرایند از شروع آغاز می‌شود");
  await studio.getByRole("button", { name: "تحلیل اطلاعات و ساخت نمودار" }).click();
  await expect(studio.getByText("یک نکته را روشن کنید", { exact: true })).toBeVisible();
  await studio.getByLabel("پاسخ شما").fill("پایان فرایند، تحویل خروجی است");
  await studio.getByRole("button", { name: "ادامهٔ ساخت" }).click();
  await expect(studio.getByText("نمودار آماده است", { exact: true })).toBeVisible({ timeout: 30_000 });
});

test("P21 preserves one diagram across easy form, code and AI editing", async ({ page }) => {
  const studio = await openGraphStudio(page);
  await studio.getByRole("option", { name: /^فرایند/u }).click();

  const easyRegion = studio.getByRole("region", { name: "ساخت آسان فرایند" });
  const firstInput = easyRegion.locator(".mermaid-form-row input").first();
  await firstInput.fill("دریافت سفارش");
  await studio.getByRole("button", { name: "کد پیشرفته", exact: true }).click();
  const codeEditor = studio.locator(".mermaid-code-editor .cm-content");
  await expect(codeEditor).toContainText("دریافت سفارش");
  await codeEditor.press("Control+End");
  await codeEditor.pressSequentially('\n  QA["کنترل کیفیت"]');

  await page.evaluate(() => {
    const state = window as typeof window & { __aiContext?: string };
    window.raaviDesktop = {
      ...(window.raaviDesktop ?? {}),
      runCodexPrompt: async ({ context }) => {
        state.__aiContext = context;
        return { answer: 'flowchart LR\n  A["دریافت سفارش"] --> QA["کنترل کیفیت"] --> B["ارسال"]', replacement: null };
      },
    } as typeof window.raaviDesktop;
  });

  await studio.locator(".mermaid-mode-switch--pane").getByRole("button", { name: "ساخت با هوش مصنوعی", exact: true }).click();
  await studio.getByLabel("داده یا درخواست اصلاح").fill("مرحلهٔ ارسال را بعد از کنترل کیفیت اضافه کن");
  await studio.getByRole("button", { name: "تحلیل اطلاعات و ساخت نمودار" }).click();
  await expect(studio.getByText("نمودار آماده است", { exact: true })).toBeVisible({ timeout: 30_000 });
  const aiContext = await page.evaluate(() => (window as typeof window & { __aiContext?: string }).__aiContext ?? "");
  expect(aiContext).toContain("کنترل کیفیت");
  expect(aiContext).toContain("مرحلهٔ ارسال را بعد از کنترل کیفیت اضافه کن");

  await studio.getByRole("button", { name: "کد پیشرفته", exact: true }).click();
  await expect(codeEditor).toContainText("ارسال");
});
