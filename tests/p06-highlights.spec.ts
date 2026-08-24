import { expect, test } from "@playwright/test";

const HIGHLIGHTS_FIXTURE = [
  "# مقدمه",
  "",
  "پیش از پیاده‌سازی، مسئله را با زبان روشن تعریف کنید.",
  "",
  "# قواعد طراحی",
  "",
  "فاصله‌گذاری باید از ریتم ثابت رابط پیروی کند.",
  "",
  "# حریم خصوصی",
  "",
  "همهٔ داده‌ها محلی‌اند.",
  "",
  "# نسخه‌ها",
  "",
  "نسخهٔ فعلی حفظ می‌شود.",
].join("\n");

test("P06 assembles the independent local Highlights panel from Figma", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript((content) => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "light");
    const now = new Date();
    const entries = [
      { id: "p06-intro", quote: "پیش از پیاده‌سازی، مسئله را با زبان روشن تعریف کنید.", hour: 12, minute: 40 },
      { id: "p06-spacing", quote: "فاصله‌گذاری باید از ریتم ثابت رابط پیروی کند.", hour: 11, minute: 18 },
      { id: "p06-local", quote: "همهٔ داده‌ها محلی‌اند.", dayOffset: 1 },
      { id: "p06-version", quote: "نسخهٔ فعلی حفظ می‌شود.", dayOffset: 1 },
    ];
    const annotations = entries.map((entry) => {
      const createdAt = new Date(now);
      createdAt.setDate(createdAt.getDate() - (entry.dayOffset ?? 0));
      createdAt.setHours(entry.hour ?? 12, entry.minute ?? 0, 0, 0);
      const start = content.indexOf(entry.quote);
      return {
        id: entry.id,
        kind: "highlight",
        start,
        end: start + entry.quote.length,
        quote: entry.quote,
        prefix: content.slice(Math.max(0, start - 32), start),
        suffix: content.slice(start + entry.quote.length, start + entry.quote.length + 32),
        body: "",
        createdAt: createdAt.toISOString(),
      };
    });
    window.localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        fileName: "راهنمای نگارش.md",
        content,
        readerSize: 18,
        annotations,
        assets: [],
        revision: 1,
        versions: [],
        activeDocumentPath: "C:\\Raavi\\راهنمای نگارش.md",
        documentType: "ravi",
        lastSavedSnapshot: content,
        draftId: "p06-highlights",
        viewMode: "desk",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, HIGHLIGHTS_FIXTURE);

  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );

  const trigger = page.getByRole("button", {
    name: "هایلایت‌ها",
    exact: true,
  });
  await trigger.click();

  const sidebar = page.locator("#library-panel");
  const panel = page.locator("#highlights-panel");
  const rows = panel.locator(".reading-highlight-row");
  const rowActions = panel.locator(".reading-highlight-row-main");
  await expect(panel).toBeVisible();
  await expect(page.locator("#sidebar-pane-title")).toHaveText("هایلایت‌ها");
  await expect(
    sidebar.getByRole("button", { name: "جمع‌کردن نوار کناری" }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("button", { name: "جست‌وجو در هایلایت‌ها" }),
  ).toBeVisible();
  await expect(panel.locator(".reading-highlights-summary")).toHaveText(
    "هایلایت‌ها · ۴ مورد",
  );
  await expect(rows).toHaveCount(4);
  await expect(rowActions.locator("svg")).toHaveCount(0);
  await expect(rowActions.nth(0)).toContainText("پیش از پیاده‌سازی");
  await expect(rowActions.nth(0)).toContainText("مقدمه");
  await expect(rowActions.nth(2)).toContainText("دیروز");
  await expect(rowActions.nth(0)).toHaveAttribute("aria-current", "location");
  await expect(sidebar).toContainText("محلی · همراه فایل .ravi");

  await page.waitForTimeout(260);
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
    return {
      geometry: {
        shell: rect("#library-panel"),
        pane: rect("#library-panel .sidebar-pane"),
        rail: rect("#library-panel .sidebar-rail"),
        header: rect("#library-panel .sidebar-pane-header"),
        summary: rect(".reading-highlights-summary"),
        row: rect(".reading-highlight-row"),
        footer: rect("#library-panel .library-footer"),
      },
      surface: {
        rowBorder: style(".reading-highlight-row-main").borderWidth,
        activeBackground: style(
          ".reading-highlight-row.is-active .reading-highlight-row-main",
        ).backgroundColor,
        activeColor: style(
          ".reading-highlight-row.is-active .reading-highlight-row-main",
        ).color,
        quoteSize: style(".reading-highlight-row-copy strong").fontSize,
        metaSize: style(".reading-highlight-row-copy span").fontSize,
      },
    };
  });

  expect(contract.geometry).toEqual({
    shell: { x: 920, y: 92, width: 360, height: 822 },
    pane: { x: 920, y: 92, width: 304, height: 822 },
    rail: { x: 1224, y: 92, width: 56, height: 822 },
    header: { x: 934, y: 106, width: 276, height: 52 },
    summary: { x: 934, y: 166, width: 276, height: 18 },
    row: { x: 934, y: 188, width: 276, height: 64 },
    footer: { x: 934, y: 883, width: 276, height: 17 },
  });
  expect(contract.surface).toEqual({
    rowBorder: "0px",
    activeBackground: "rgb(233, 239, 255)",
    activeColor: "rgb(37, 87, 229)",
    quoteSize: "12px",
    metaSize: "11px",
  });

  await page.mouse.move(500, 500);
  await page.screenshot({
    path: ".artifacts/p06-highlights.png",
    fullPage: true,
  });

  await rowActions.nth(0).click();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        activeLabel: document.activeElement?.getAttribute("aria-label"),
        selection: window.getSelection()?.toString() ?? "",
      })),
    )
    .toEqual({
      activeLabel: "متن Markdown",
      selection: "پیش از پیاده‌سازی، مسئله را با زبان روشن تعریف کنید.",
    });

  const searchAction = sidebar.getByRole("button", {
    name: "جست‌وجو در هایلایت‌ها",
  });
  await searchAction.click();
  const search = panel.getByRole("searchbox", {
    name: "جست‌وجو در هایلایت‌های سند",
  });
  await expect(search).toBeFocused();
  await search.fill("حريم خصوصي");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("همهٔ داده‌ها محلی‌اند");
  await search.fill("ناموجود");
  await expect(panel).toContainText("هایلایت مطابق جست‌وجو پیدا نشد");
  await panel
    .getByRole("button", { name: "پاک‌کردن جست‌وجوی هایلایت‌ها" })
    .click();
  await expect(rows).toHaveCount(4);
  await searchAction.click();
  await expect(search).toBeHidden();

  await rowActions.nth(0).focus();
  await page.keyboard.press("ArrowDown");
  await expect(rowActions.nth(1)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(rowActions.nth(1)).toHaveAttribute("aria-current", "location");
  await rowActions.nth(1).press("Delete");
  await expect(rows).toHaveCount(3);
  await expect(page.locator(".annotation-undo-notice")).toContainText(
    "هایلایت حذف شد.",
  );
  await page.getByRole("button", { name: "واگرد", exact: true }).click();
  await expect(rows).toHaveCount(4);
  await expect(rowActions.nth(1)).toBeFocused();

  await rowActions.nth(1).press("Escape");
  await expect(sidebar).toHaveClass(/is-collapsed/);
  await expect(trigger).toBeFocused();

  await page.setViewportSize({ width: 375, height: 812 });
  const overflow = page.getByRole("button", {
    name: "بازکردن فرمان‌های بیشتر",
  });
  await overflow.click();
  await page
    .getByRole("button", { name: /بازکردن نوار کناری/ })
    .click();
  await expect(sidebar).toHaveAttribute("role", "dialog");
  await expect(sidebar).toHaveAttribute("aria-modal", "true");
  await sidebar
    .getByRole("button", { name: "جست‌وجو در هایلایت‌ها" })
    .click();
  await rowActions.first().focus();
  const mobileTargets = await page.evaluate(() => {
    const size = (selector: string) => {
      const bounds = document
        .querySelector<HTMLElement>(selector)!
        .getBoundingClientRect();
      return {
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    return {
      searchDismiss: size(".reading-highlights-search-control button"),
      deleteAction: size(".reading-highlight-row-delete"),
      row: size(".reading-highlight-row-main"),
    };
  });
  expect(mobileTargets).toMatchObject({
    searchDismiss: { width: 44, height: 44 },
    deleteAction: { width: 44, height: 44 },
    row: { height: 64 },
  });
  expect(mobileTargets.row.width).toBeGreaterThanOrEqual(276);
  await page.keyboard.press("Escape");
  await expect(sidebar).toBeHidden();
  await expect(overflow).toBeFocused();
});
