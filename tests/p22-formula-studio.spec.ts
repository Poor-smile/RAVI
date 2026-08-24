import { expect, test, type Page } from "@playwright/test";

async function openFormulaStudio(
  page: Page,
  viewport = { width: 1366, height: 768 },
) {
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
        draftId: "p22-formula-studio",
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
  await editor.fill("");
  await editor.focus();
  await page.keyboard.type("/");
  const menu = page.getByRole("menu", { name: "نوع بلوک" });
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitemradio", { name: "فرمول" }).click();
  const studio = page.getByRole("dialog", { name: "استودیو فرمول", exact: true });
  await expect(studio).toBeVisible();
  return { studio, editor };
}

test("P27 builds a nested Expression Tree and inserts one formula block", async ({
  page,
}) => {
  const { studio, editor } = await openFormulaStudio(page);
  await expect(studio.getByText("فرمول را بدون کد بسازید", { exact: true })).toBeVisible();
  await expect(studio.getByRole("button", { name: "افزودن به سند" })).toBeDisabled();
  await expect(studio.locator(".formula-template-grid > button")).toHaveCount(6);
  await expect(studio.getByText("۱۰۰٪", { exact: true })).not.toHaveRole("button");

  const emptyGeometry = await studio.evaluate((node) => {
    const rect = (selector: string) => {
      const bounds = node.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      return { width: Math.round(bounds.width), height: Math.round(bounds.height), y: Math.round(bounds.y) };
    };
    return {
      header: rect(".formula-studio-header"),
      ribbon: rect(".formula-ribbon"),
      palette: rect(".formula-template-palette"),
      tile: rect(".formula-template-grid > button"),
    };
  });
  expect(emptyGeometry.header.height).toBe(68);
  expect(emptyGeometry.ribbon.height).toBe(72);
  expect(emptyGeometry.palette.width).toBe(336);
  expect(emptyGeometry.tile).toMatchObject({ width: 132, height: 112 });

  await studio.getByRole("button", { name: "کسر", exact: true }).click();
  const slots = studio.locator(".formula-slot");
  await expect(slots).toHaveCount(2);
  await expect(slots.nth(0)).toBeFocused();
  await slots.nth(0).fill("x");
  await page.keyboard.press("Tab");
  await expect(slots.nth(1)).toBeFocused();
  await studio.getByRole("button", { name: "توان", exact: true }).click();
  await expect(studio.getByRole("navigation", { name: "مسیر ساختار فرمول" })).toBeVisible();
  await expect(studio.getByRole("region", { name: "بازرس ساختار فعال" })).toBeVisible();
  await expect(slots).toHaveCount(3);
  await expect(slots.nth(1)).toBeFocused();
  await slots.nth(1).fill("y");
  await page.keyboard.press("Tab");
  await slots.nth(2).fill("2");
  await expect(studio.getByRole("button", { name: "افزودن به سند" })).toBeEnabled();
  await expect(studio.locator(".formula-slot-navigation > span")).toContainText("3 از 3");
  await page.screenshot({ path: ".artifacts/p27-formula-studio-nested.png" });

  await studio.getByRole("button", { name: "افزودن به سند" }).click();
  await expect(studio).toBeHidden();
  const liveFormula = page.locator("#markdown-editor .cm-rich-formula");
  await expect(liveFormula).toBeVisible();
  await expect(liveFormula.locator(".cm-rich-formula-stage math")).toHaveCount(1);
  await expect(editor.locator(".cm-line").filter({ hasText: "$$" })).toHaveCount(0);
  const liveFormulaEdit = liveFormula.getByRole("button", { name: "ویرایش در استودیو" });
  await page.screenshot({ path: ".artifacts/p22-formula-writing.png" });
  await liveFormulaEdit.click();
  await expect(studio).toBeVisible();
  await expect(studio.locator(".formula-expression-fraction")).toBeVisible();
  await expect(studio.locator(".formula-expression-script")).toBeVisible();
  await studio.getByRole("button", { name: "بازگشت به سند" }).click();
  await expect(studio).toBeHidden();
  await expect(liveFormulaEdit).toBeFocused();
  await page.locator('[data-command-id="view.editor.source"]').click();
  await expect(editor).toContainText("$$");
  await expect(editor).toContainText("\\frac{x}{y^{2}}");
  await page.locator('[data-command-id="view.editor.live"]').click();
  await expect(liveFormula).toBeVisible();
  await page.getByRole("button", { name: "خواندن", exact: true }).click();
  const renderedFormula = page.locator(".formula-document-block");
  await expect(renderedFormula).toBeVisible();
  await expect(renderedFormula.locator(".formula-document-math")).toBeVisible();
  await expect(renderedFormula.locator("math")).toHaveCount(1);
  await expect(renderedFormula.getByRole("button")).toHaveCount(0);
  await page.screenshot({ path: ".artifacts/p22-formula-reading.png" });
});

test("P27 resizes matrices, preserves cells, changes delimiters and undoes each action once", async ({
  page,
}) => {
  const { studio, editor } = await openFormulaStudio(page);
  await studio.getByRole("button", { name: "ماتریس", exact: true }).click();

  const inspector = studio.getByRole("region", { name: "بازرس ساختار فعال" });
  const sizePicker = inspector.getByRole("group", { name: "انتخاب تعداد ردیف و ستون" });
  const slots = studio.locator(".formula-slot");
  await expect(inspector.getByText("اندازهٔ ماتریس", { exact: true })).toBeVisible();
  await expect(sizePicker.getByRole("button")).toHaveCount(64);
  await expect(slots).toHaveCount(4);

  for (const [index, value] of ["a", "b", "c", "d"].entries()) {
    await slots.nth(index).fill(value);
  }
  await expect(slots.nth(3)).toBeFocused();

  await sizePicker.getByRole("button", { name: "انتخاب ماتریس 3 در 3" }).click();
  await expect(slots).toHaveCount(9);
  await expect(slots.nth(0)).toHaveValue("a");
  await expect(slots.nth(1)).toHaveValue("b");
  await expect(slots.nth(3)).toHaveValue("c");
  await expect(slots.nth(4)).toHaveValue("d");
  await expect(slots.nth(4)).toBeFocused();

  await inspector.getByRole("button", { name: "جداکنندهٔ خط عمودی", exact: true }).click();
  await expect(studio.locator(".formula-expression-matrix > b").first()).toHaveText("|");

  await studio.getByRole("button", { name: "برگرداندن تغییر فرمول" }).click();
  await expect(studio.locator(".formula-expression-matrix > b").first()).toHaveText("[");
  await expect(slots).toHaveCount(9);
  await studio.getByRole("button", { name: "برگرداندن تغییر فرمول" }).click();
  await expect(slots).toHaveCount(4);
  await expect(slots.nth(0)).toHaveValue("a");
  await expect(slots.nth(3)).toHaveValue("d");

  await studio.getByRole("button", { name: "دوباره انجام دادن تغییر فرمول" }).click();
  await studio.getByRole("button", { name: "دوباره انجام دادن تغییر فرمول" }).click();
  await expect(slots).toHaveCount(9);
  await expect(studio.locator(".formula-expression-matrix > b").first()).toHaveText("|");

  for (const [index, value] of [[2, "e"], [5, "f"], [6, "g"], [7, "h"], [8, "i"]] as const) {
    await slots.nth(index).fill(value);
  }
  await expect(studio.getByRole("button", { name: "افزودن به سند" })).toBeEnabled();
  await page.screenshot({ path: ".artifacts/p27-formula-matrix-mode.png" });
  await studio.getByRole("button", { name: "افزودن به سند" }).click();
  await page.locator('[data-command-id="view.editor.source"]').click();
  await expect(editor).toContainText("\\begin{vmatrix}");
  await expect(editor).toContainText("a & b & e");
  await expect(editor).toContainText("g & h & i");
});

test("P27 builds and reconfigures common calculus operators entirely through GUI", async ({
  page,
}) => {
  const { studio, editor } = await openFormulaStudio(page);
  await studio.getByRole("tab", { name: "حسابان" }).click();
  await expect(studio.locator(".formula-template-grid > button")).toHaveCount(9);
  for (const label of [
    "انتگرال",
    "انتگرال دوگانه",
    "انتگرال سه‌گانه",
    "انتگرال مسیر بسته",
    "مشتق",
    "مشتق جزئی",
    "مجموع",
    "حاصل‌ضرب",
    "حد",
  ]) {
    await expect(studio.getByRole("button", { name: label, exact: true })).toBeVisible();
  }

  await studio.getByRole("button", { name: "انتگرال دوگانه", exact: true }).click();
  const slots = studio.locator(".formula-slot");
  await expect(slots).toHaveCount(4);
  // Visual DOM order is upper, lower, body, differential.
  for (const [index, value] of ["1", "0", "f", "x"].entries()) {
    await slots.nth(index).fill(value);
  }

  const inspector = studio.getByRole("region", { name: "بازرس ساختار فعال" });
  const operatorPicker = inspector.getByRole("group", { name: "انتخاب عملگر حسابان" });
  await expect(operatorPicker.getByRole("button")).toHaveCount(9);
  await expect(operatorPicker.getByRole("button", { name: "دوگانه", exact: true })).toHaveAttribute("aria-pressed", "true");
  await operatorPicker.getByRole("button", { name: "مشتق جزئی", exact: true }).click();

  await expect(slots).toHaveCount(3);
  // Visual DOM order is order, body, variable; the mirrored order is read-only.
  await expect(slots.nth(0)).toHaveValue("");
  await expect(slots.nth(1)).toHaveValue("f");
  await expect(slots.nth(2)).toHaveValue("x");
  await expect(slots.nth(2)).toBeFocused();

  await studio.getByRole("button", { name: "برگرداندن تغییر فرمول" }).click();
  await expect(slots).toHaveCount(4);
  await expect(slots.nth(0)).toHaveValue("1");
  await expect(slots.nth(1)).toHaveValue("0");
  await expect(slots.nth(2)).toHaveValue("f");
  await expect(slots.nth(3)).toHaveValue("x");
  await studio.getByRole("button", { name: "دوباره انجام دادن تغییر فرمول" }).click();
  await expect(slots).toHaveCount(3);
  await expect(slots.nth(0)).toHaveValue("");
  await slots.nth(0).fill("2");
  await expect(studio.getByRole("button", { name: "افزودن به سند" })).toBeEnabled();

  await page.screenshot({ path: ".artifacts/p27-formula-calculus-mode.png" });
  await studio.getByRole("button", { name: "افزودن به سند" }).click();
  await page.locator('[data-command-id="view.editor.source"]').click();
  await expect(editor).toContainText("\\frac{\\partial^{2}{f}}{\\partial{x}^{2}}");
});

test("P27 searches and inserts multiple symbols with keyboard navigation, recents and undo", async ({
  page,
}) => {
  const { studio, editor } = await openFormulaStudio(page);
  await studio.getByRole("tab", { name: "نمادها" }).click();

  const picker = studio.getByRole("region", { name: "انتخاب‌گر نماد" });
  const search = studio.getByRole("textbox", { name: "جست‌وجوی نماد" });
  await expect(picker).toBeVisible();
  const groupTabs = picker.getByRole("tab");
  await expect(groupTabs).toHaveCount(6);
  await groupTabs.first().focus();
  await page.keyboard.press("ArrowLeft");
  await expect(groupTabs.nth(1)).toBeFocused();
  await expect(groupTabs.nth(1)).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("Home");
  await expect(groupTabs.first()).toBeFocused();

  const firstSymbol = picker.getByRole("button", { name: "آلفا — alpha", exact: true });
  await firstSymbol.focus();
  await page.keyboard.press("ArrowRight");
  await expect(picker.getByRole("button", { name: "بتا — beta", exact: true })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(firstSymbol).toBeFocused();

  await search.fill("آلفا");
  const alpha = picker.getByRole("button", { name: "آلفا — alpha", exact: true });
  await expect(alpha).toBeVisible();
  await alpha.focus();
  await page.keyboard.press("Enter");
  await expect(studio.locator(".formula-inline-math")).toHaveCount(1);

  await search.fill("not equal");
  const notEqual = picker.getByRole("button", { name: "نامساوی — not equal", exact: true });
  await expect(notEqual).toBeVisible();
  await notEqual.click();
  await expect(studio.locator(".formula-inline-math")).toHaveCount(2);
  await expect(studio.getByRole("button", { name: "افزودن به سند" })).toBeEnabled();

  await studio.getByRole("button", { name: "برگرداندن تغییر فرمول" }).click();
  await expect(studio.locator(".formula-inline-math")).toHaveCount(1);
  await studio.getByRole("button", { name: "دوباره انجام دادن تغییر فرمول" }).click();
  await expect(studio.locator(".formula-inline-math")).toHaveCount(2);

  await search.fill("");
  await picker.getByRole("tab", { name: "همه", exact: true }).click();
  await expect(picker.getByText("اخیراً استفاده‌شده", { exact: true })).toBeVisible();
  await expect(picker.locator(".formula-symbol-recent button")).toHaveCount(2);
  await page.screenshot({ path: ".artifacts/p27-formula-symbol-picker.png" });

  await studio.getByRole("button", { name: "افزودن به سند" }).click();
  await page.locator('[data-command-id="view.editor.source"]').click();
  await expect(editor).toContainText("\\alpha\\neq");
});

test("P27 nests Binomial inside a configurable logarithmic function", async ({ page }) => {
  const { studio, editor } = await openFormulaStudio(page);
  await studio.getByRole("tab", { name: "توابع و جبر" }).click();
  await expect(studio.locator(".formula-template-grid > button")).toHaveCount(5);
  await studio.getByRole("button", { name: "تابع", exact: true }).click();

  const functionInspector = studio.getByRole("region", { name: "بازرس ساختار فعال" });
  await functionInspector.getByRole("combobox", { name: "نوع تابع" }).selectOption("log");
  await functionInspector.getByRole("button", { name: "2", exact: true }).click();
  await functionInspector.getByRole("button", { name: "پایه یا زیرنویس تابع" }).click();

  await studio.getByRole("textbox", { name: "خانهٔ function-subscript" }).fill("2");
  await studio.getByRole("textbox", { name: "خانهٔ argument-1" }).fill("x");
  const secondArgument = studio.getByRole("textbox", { name: "خانهٔ argument-2" });
  await secondArgument.focus();
  await studio.getByRole("button", { name: "دوجمله‌ای", exact: true }).click();
  await studio.getByRole("textbox", { name: "خانهٔ binomial-upper" }).fill("n");
  await studio.getByRole("textbox", { name: "خانهٔ binomial-lower" }).fill("k");

  await expect(studio.locator(".formula-expression-function .formula-expression-binomial")).toBeVisible();
  await studio.getByRole("button", { name: "برگرداندن تغییر فرمول" }).click();
  await expect(studio.getByRole("textbox", { name: "خانهٔ binomial-lower" })).toHaveValue("");
  await studio.getByRole("button", { name: "دوباره انجام دادن تغییر فرمول" }).click();
  await expect(studio.getByRole("textbox", { name: "مقدار فرمول" }).last()).toHaveValue("k");
  await page.screenshot({ path: ".artifacts/p27-formula-functions-binomial.png" });

  await studio.getByRole("button", { name: "افزودن به سند" }).click();
  const liveFormula = page.locator("#markdown-editor .cm-rich-formula");
  await liveFormula.getByRole("button", { name: "ویرایش در استودیو" }).click();
  await expect(studio.locator(".formula-expression-function .formula-expression-binomial")).toBeVisible();
  await studio.getByRole("button", { name: "بازگشت به سند" }).click();
  await page.locator('[data-command-id="view.editor.source"]').click();
  await expect(editor).toContainText("\\log_{2}\\left(x,\\binom{n}{k}\\right)");
});

test("P27 nests an Accent inside a configurable Fence", async ({ page }) => {
  const { studio, editor } = await openFormulaStudio(page);
  await studio.getByRole("tab", { name: "توابع و جبر" }).click();
  await studio.getByRole("button", { name: "پرانتز و حصار", exact: true }).click();
  await studio.getByRole("button", { name: "نشانهٔ بالا", exact: true }).click();
  await studio.getByRole("textbox", { name: "خانهٔ accented-expression" }).fill("x");

  const inspector = studio.getByRole("region", { name: "بازرس ساختار فعال" });
  await inspector.getByRole("button", { name: "بردار", exact: true }).click();
  await studio.getByRole("navigation", { name: "مسیر ساختار فرمول" }).getByRole("button", { name: "Fence", exact: true }).click();
  await inspector.getByRole("button", { name: "نُرم", exact: true }).click();
  await expect(studio.locator(".formula-expression-fence .formula-expression-accent")).toBeVisible();

  await studio.getByRole("button", { name: "افزودن به سند" }).click();
  await page.locator('[data-command-id="view.editor.source"]').click();
  await expect(editor).toContainText("\\left\\lVert\\vec{x}\\right\\rVert");
});

test("P27 resizes Cases without losing rows and round-trips the result", async ({ page }) => {
  const { studio, editor } = await openFormulaStudio(page);
  await studio.getByRole("tab", { name: "توابع و جبر" }).click();
  await studio.getByRole("button", { name: "چندضابطه‌ای", exact: true }).click();
  const slots = studio.locator(".formula-slot");
  await expect(slots).toHaveCount(4);
  for (const [index, value] of ["x", "x>0", "-x", "x<0"].entries()) await slots.nth(index).fill(value);

  const inspector = studio.getByRole("region", { name: "بازرس ساختار فعال" });
  await inspector.getByRole("button", { name: "3", exact: true }).click();
  await expect(slots).toHaveCount(6);
  await expect(studio.locator(".formula-expression-cases em")).toHaveText(["if", "if", "if"]);
  await expect(studio.locator(".formula-expression-cases")).not.toContainText("اگر");
  await expect(slots.nth(0)).toHaveValue("x");
  await expect(slots.nth(3)).toHaveValue("x<0");
  await studio.getByRole("button", { name: "برگرداندن تغییر فرمول" }).click();
  await expect(slots).toHaveCount(4);
  await studio.getByRole("button", { name: "دوباره انجام دادن تغییر فرمول" }).click();
  await expect(slots).toHaveCount(6);
  await slots.nth(4).fill("0");
  await slots.nth(5).fill("x=0");

  await page.screenshot({ path: ".artifacts/p27-formula-cases.png" });
  await studio.getByRole("button", { name: "افزودن به سند" }).click();
  await page.locator('[data-command-id="view.editor.source"]').click();
  await expect(editor).toContainText("\\begin{cases}x & x>0 \\\\ -x & x<0 \\\\ 0 & x=0\\end{cases}");
});

test("P27 uses the 820×980 compact canvas and non-overlay template sheet", async ({
  page,
}) => {
  const { studio } = await openFormulaStudio(page, { width: 820, height: 980 });
  const categoryTabs = studio
    .getByRole("navigation", { name: "ابزارها و دسته‌های فرمول" })
    .getByRole("tab");
  await expect(categoryTabs).toHaveCount(6);
  await expect(studio.locator('[role="tab"][tabindex="0"]')).toHaveCount(1);
  await categoryTabs.first().focus();
  await page.keyboard.press("End");
  await expect(categoryTabs.last()).toBeFocused();
  await expect(categoryTabs.last()).toHaveAttribute("aria-selected", "true");
  await studio.getByRole("button", { name: "مشاهدهٔ همه" }).click();
  await expect(categoryTabs.first()).toHaveAttribute("aria-selected", "true");
  await studio.getByRole("button", { name: "کسر", exact: true }).click();
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
      header: rect(".formula-studio-header"),
      ribbon: rect(".formula-ribbon"),
      canvas: rect(".formula-canvas-area"),
      palette: rect(".formula-template-palette"),
      primary: rect(".formula-primary-action"),
    };
  });
  expect(geometry.header).toMatchObject({ x: 0, y: 0, width: 820, height: 72 });
  expect(geometry.ribbon.height).toBe(64);
  expect(geometry.canvas).toMatchObject({ y: 136, width: 820, height: 424 });
  expect(geometry.palette).toMatchObject({ y: 560, width: 820, height: 420 });
  expect(geometry.primary.height).toBeGreaterThanOrEqual(48);
  await page.screenshot({ path: ".artifacts/p22-formula-studio-compact.png" });

  const first = studio.locator(".formula-slot").first();
  await first.fill("x");
  await studio.getByRole("button", { name: "بازگشت به سند" }).click();
  const confirm = studio.getByRole("alertdialog", { name: "تغییرات کنار گذاشته شوند؟" });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByRole("button", { name: "انصراف" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirm.getByRole("button", { name: "کنار گذاشتن" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(confirm.getByRole("button", { name: "انصراف" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(confirm.getByRole("button", { name: "کنار گذاشتن" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(confirm).toBeHidden();
  await expect(studio.getByRole("button", { name: "بازگشت به سند" })).toBeFocused();
});

test("P27 edits the exact existing formula block without consuming its neighbors", async ({
  page,
}) => {
  const content = "# پیش از فرمول\n\n$$\nx^2\n$$\n\nمتن پس از فرمول";
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.addInitScript((markdown) => {
    localStorage.clear();
    localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        fileName: "فرمول‌ها.ravi",
        content: markdown,
        readerSize: 18,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        documentType: "ravi",
        lastSavedSnapshot: markdown,
        draftId: "p22-edit-formula",
        viewMode: "live",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, content);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  const editor = page.locator("#markdown-editor .cm-content");
  const liveFormula = page.locator("#markdown-editor .cm-rich-formula");
  await expect(liveFormula).toBeVisible();
  await expect(editor.locator(".cm-line").filter({ hasText: "$$" })).toHaveCount(0);
  await liveFormula.getByRole("button", { name: "ویرایش در استودیو" }).click();

  const studio = page.getByRole("dialog", { name: "استودیو فرمول", exact: true });
  await studio.getByRole("button", { name: "Advanced LaTeX" }).click();
  const directInput = studio.getByRole("textbox", { name: "ورودی LaTeX پیشرفته" });
  await expect(directInput).toHaveValue("x^{2}");
  await directInput.fill("y^2 + 1");
  await studio.getByRole("button", { name: "ذخیرهٔ تغییرات" }).click();

  await expect(editor.locator(".cm-live-heading-1")).toContainText("پیش از فرمول");
  await expect(liveFormula.locator(".cm-rich-formula-stage math")).toHaveCount(1);
  await expect(liveFormula.getByRole("button", { name: "ویرایش در استودیو" })).toBeFocused();
  await expect(editor).toContainText("متن پس از فرمول");
  await page.getByRole("button", { name: "خواندن", exact: true }).click();
  await expect(page.locator(".formula-document-block")).toBeVisible();
});

test("P27 release gate completes Copy, Paste, Undo, Redo and Apply with keyboard only", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const { studio } = await openFormulaStudio(page);
  const fractionTile = studio.getByRole("button", { name: "کسر", exact: true });
  await fractionTile.focus();
  await page.keyboard.press("Enter");

  const slots = studio.locator(".formula-slot");
  await expect(slots).toHaveCount(2);
  await page.keyboard.type("x");
  await page.keyboard.press("Tab");
  await page.keyboard.type("y");

  await page.keyboard.press("Control+z");
  await expect(slots.nth(1)).toHaveValue("");
  await page.keyboard.press("Control+Shift+z");
  await expect(slots.nth(1)).toHaveValue("y");

  await page.keyboard.press("Control+c");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("\\frac{x}{y}");

  const clear = studio.getByRole("button", { name: "پاک‌کردن", exact: true });
  await clear.focus();
  await page.keyboard.press("Enter");
  await expect(studio.getByText("فرمول را بدون کد بسازید", { exact: true })).toBeVisible();

  await studio.getByRole("button", { name: "بازگشت به سند" }).focus();
  await page.keyboard.press("Control+v");
  await expect(studio.locator(".formula-expression-fraction")).toBeVisible();
  await page.keyboard.press("Control+z");
  await expect(studio.getByText("فرمول را بدون کد بسازید", { exact: true })).toBeVisible();
  await page.keyboard.press("Control+y");
  await expect(studio.locator(".formula-expression-fraction")).toBeVisible();

  await page.keyboard.press("Control+Enter");
  await expect(studio).toBeHidden();
  await expect(page.locator("#markdown-editor .cm-rich-formula")).toBeVisible();
});

test("P27 release gate pastes a complex tree and preserves it through Save/Open", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const { studio, editor } = await openFormulaStudio(page);
  const source = "\\begin{cases}\\frac{x}{y} & x>0 \\\\ \\sqrt{x} & x\\leq0\\end{cases}";
  await page.evaluate((latex) => navigator.clipboard.writeText(latex), source);
  await studio.getByRole("button", { name: "بازگشت به سند" }).focus();
  await page.keyboard.press("Control+v");

  await expect(studio.locator(".formula-expression-cases")).toBeVisible();
  await expect(studio.locator(".formula-expression-fraction")).toBeVisible();
  await expect(studio.locator(".formula-expression-radical")).toBeVisible();
  await page.keyboard.press("Control+Enter");

  const liveFormula = page.locator("#markdown-editor .cm-rich-formula");
  await liveFormula.getByRole("button", { name: "ویرایش در استودیو" }).click();
  await expect(studio.locator(".formula-expression-cases .formula-expression-fraction")).toBeVisible();
  await expect(studio.locator(".formula-expression-cases .formula-expression-radical")).toBeVisible();
  await studio.getByRole("button", { name: "بازگشت به سند" }).click();
  await page.locator('[data-command-id="view.editor.source"]').click();
  await expect(editor).toContainText("\\begin{cases}");
  await expect(editor).toContainText("\\frac{x}{y}");
  await expect(editor).toContainText("\\sqrt{x}");
});
