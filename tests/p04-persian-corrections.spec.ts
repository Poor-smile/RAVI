import { expect, test } from "@playwright/test";

const PERSIAN_CORRECTIONS_FIXTURE = [
  "#عنوان",
  "اين يك متن است",
  "می روم",
  "نمی مانم",
  "سلام !",
].join("\n");

test("P04 assembles the independent local Persian Corrections panel from Figma", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript((content) => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "dark");
    window.localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        fileName: "بازبینی فارسی.md",
        content,
        readerSize: 18,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        activeDocumentPath: "C:\\Raavi\\بازبینی فارسی.md",
        documentType: "markdown",
        lastSavedSnapshot: content,
        draftId: "p04-persian-corrections",
        viewMode: "desk",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, PERSIAN_CORRECTIONS_FIXTURE);

  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

  await page
    .getByRole("button", { name: "اصلاحات فارسی", exact: true })
    .click();

  const panel = page.locator("#persian-corrections-panel");
  await expect(panel).toBeVisible();
  await expect(page.locator("#sidebar-pane-title")).toHaveText(
    "اصلاحات فارسی",
  );
  await expect(
    page.getByRole("button", { name: "بازبینی دوبارهٔ متن فارسی" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "جمع‌کردن نوار کناری" }),
  ).toBeVisible();

  await expect(panel.locator(".persian-corrections-summary")).toContainText(
    "۷ مورد در ۴ دسته",
  );
  await expect(panel.locator(".persian-correction-row")).toHaveCount(4);
  await expect(panel.locator(".persian-correction-row:disabled")).toHaveCount(0);
  await expect(panel.locator(".persian-correction-row svg")).toHaveCount(0);
  await expect(panel).toContainText("نویسه‌های عربی");
  await expect(panel).toContainText("۳ مورد · ی و ک عربی → فارسی");
  await expect(panel).toContainText("۲ مورد · می/نمی و واژهٔ بعد");
  await expect(panel).toContainText("۱ مورد · پیش و پس از نشانه");
  await expect(panel).toContainText("۱ مورد · فاصلهٔ پس از #");
  await expect(panel).not.toContainText("۰ مورد · مشکلی پیدا نشد");
  await expect(panel).toContainText("محلی · متن ارسال نمی‌شود");

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
      summaryHeight: rect(".persian-corrections-summary").height,
      rowHeight: rect(".persian-correction-row").height,
      neutralBorder: style(
        ".persian-correction-row:not(:disabled)",
      ).borderWidth,
      titleSize: style(".persian-correction-row strong").fontSize,
      detailSize: style(".persian-correction-row small").fontSize,
    };
  });

  expect(geometry.shell).toEqual({ x: 920, y: 92, width: 360, height: 822 });
  expect(geometry.pane).toEqual({ x: 920, y: 92, width: 304, height: 822 });
  expect(geometry.rail).toEqual({ x: 1224, y: 92, width: 56, height: 822 });
  expect(geometry.header).toEqual({ x: 934, y: 106, width: 276, height: 52 });
  expect(geometry.summaryHeight).toBe(44);
  expect(geometry.rowHeight).toBe(56);
  expect(geometry.neutralBorder).toBe("0px");
  expect(geometry.titleSize).toBe("12px");
  expect(geometry.detailSize).toBe("11px");

  await page.screenshot({
    path: ".artifacts/p04-persian-corrections.png",
    fullPage: true,
  });

  await panel
    .getByRole("button", { name: /نویسه‌های عربی.*اصلاح این دسته/ })
    .click();
  await expect(panel.locator(".persian-corrections-summary")).toContainText(
    "۴ مورد در ۳ دسته",
  );
  await expect(panel).not.toContainText("نویسه‌های عربی");
  await expect(panel.locator(".persian-correction-row")).toHaveCount(3);
  await expect(panel).toBeFocused();

  await panel.getByRole("button", { name: /اصلاح همهٔ ۴ مورد/ }).click();
  await expect(panel.locator(".persian-corrections-summary")).toContainText(
    "۰ مورد در ۰ دسته",
  );
  await expect(panel.locator(".persian-correction-row")).toHaveCount(0);
  await expect(panel).toBeFocused();
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  const editorText = await page.locator("#markdown-editor .cm-content").innerText();
  expect(editorText).toContain("# عنوان");
  expect(editorText).toContain("این یک متن است");
  expect(editorText).toContain("می‌روم");
  expect(editorText).toContain("نمی‌مانم");
  expect(editorText).toContain("سلام!");
  expect(editorText).not.toMatch(/[يك]/u);

  const refresh = page.getByRole("button", {
    name: "بازبینی دوبارهٔ متن فارسی",
  });
  await refresh.click();
  await expect(panel).toBeFocused();
  await expect(page.locator(".toast")).toContainText("متن فارسی مرتب است");

  await page.getByRole("button", { name: "جمع‌کردن نوار کناری" }).click();
  await expect(page.locator("#library-panel")).toHaveClass(/is-collapsed/);
});
