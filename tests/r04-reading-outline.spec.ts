import { expect, test } from "@playwright/test";

const READING_OUTLINE_FIXTURE = [
  "---",
  "subject: راهنمای نگارش فارسی",
  "---",
  "",
  "# مقدمه",
  "",
  "متن خوب مسیر خواندن را روشن می‌کند و به هر بخش هدفی مشخص می‌دهد.",
  "",
  "# مسئلهٔ اصلی",
  "",
  "## محدودهٔ پژوهش",
  "",
  "## روش اجرا",
  "",
  "# نتیجه‌گیری",
].join("\n");

const READING_OUTLINE_SCROLL_FIXTURE = [
  "# مقدمه",
  "",
  ...Array.from(
    { length: 14 },
    (_, index) =>
      `بند مقدمهٔ ${(index + 1).toLocaleString("fa-IR")} برای سنجش همگام‌سازی فهرست با موقعیت واقعی مطالعه نوشته شده است.`,
  ).flatMap((line) => [line, ""]),
  "# مسئلهٔ اصلی",
  "",
  ...Array.from(
    { length: 12 },
    (_, index) =>
      `بند مسئلهٔ ${(index + 1).toLocaleString("fa-IR")} جایگاه تیتر دوم را در سطح خواندن اندازه‌پذیر نگه می‌دارد.`,
  ).flatMap((line) => [line, ""]),
  "## روش اجرا",
  "",
  "این بخش هدف پرش و ردیف فعال فهرست است.",
  "",
  ...Array.from(
    { length: 10 },
    (_, index) =>
      `بند پایانی ${(index + 1).toLocaleString("fa-IR")} فضای کافی برای قرارگرفتن تیتر فعال در آستانهٔ خواندن فراهم می‌کند.`,
  ).flatMap((line) => [line, ""]),
].join("\n");

const READING_OUTLINE_GAP_FIXTURE = [
  "# ریشه",
  "",
  "### شاخهٔ عمیق",
  "",
  "## شاخهٔ بعدی",
].join("\n");

async function openReadingFixture(
  page: import("@playwright/test").Page,
  content: string,
  draftId: string,
) {
  await page.addInitScript(
    ({ markdown, id }) => {
      window.localStorage.clear();
      window.localStorage.setItem(
        "raavi:document:v1",
        JSON.stringify({
          fileName: "راهنمای نگارش.md",
          content: markdown,
          readerSize: 18,
          annotations: [],
          assets: [],
          revision: 1,
          versions: [],
          activeDocumentPath: "C:\\Raavi\\راهنمای نگارش.md",
          documentType: "markdown",
          lastSavedSnapshot: markdown,
          draftId: id,
          viewMode: "reading",
          readingOutlineOpen: false,
          readingPositions: {},
          annotationComposer: null,
        }),
      );
    },
    { markdown: content, id: draftId },
  );
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
}

test("R04 renders the real hierarchical outline in the docked Reading pane", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1180, height: 858 });
  await openReadingFixture(
    page,
    READING_OUTLINE_FIXTURE,
    "r04-reading-outline",
  );

  const shell = page.locator(".app-shell");
  const workspace = page.locator('[data-workspace-screen="reading"]');
  const sidebar = page.locator("#library-panel");
  const pane = sidebar.locator(".sidebar-pane");
  const rail = sidebar.locator(".sidebar-rail");
  const outlineTrigger = rail.getByRole("button", {
    name: "فهرست سند",
    exact: true,
  });
  const sheet = workspace.locator(".preview-pane");

  await expect(sidebar).toHaveClass(/is-collapsed/);
  await outlineTrigger.click();
  await expect(sidebar).toHaveClass(/is-open/);
  await expect(sidebar).toHaveAttribute("role", "complementary");
  await expect(sidebar).not.toHaveAttribute("aria-modal");
  await expect(outlineTrigger).toHaveAttribute("aria-current", "page");
  await expect(rail.getByRole("button")).toHaveCount(4);

  await expect(pane.locator("#sidebar-pane-title")).toHaveText("فهرست سند");
  await expect(pane.locator(".sidebar-pane-heading > span")).toHaveCount(0);
  await expect(pane.locator(".sidebar-pane-actions > button")).toHaveCount(2);
  await expect(
    pane.getByRole("button", { name: "جمع‌کردن نوار کناری" }),
  ).toBeVisible();
  await expect(pane.locator(".reading-document-outline-summary")).toHaveText(
    "ساختار سند · ۵ بخش",
  );

  const rows = pane.locator(".reading-document-outline-list .sidebar-row");
  await expect(rows).toHaveCount(5);
  await expect(rows.locator("svg")).toHaveCount(0);
  await expect(rows.nth(0)).toContainText("مقدمه");
  await expect(rows.nth(0).locator(".sidebar-row-meta")).toHaveText("۰۱");
  await expect(rows.nth(1).locator(".sidebar-row-meta")).toHaveText("۰۲");
  await expect(rows.nth(2).locator(".sidebar-row-meta")).toHaveText("۲٫۱");
  await expect(rows.nth(3).locator(".sidebar-row-meta")).toHaveText("۲٫۲");
  await expect(rows.nth(4).locator(".sidebar-row-meta")).toHaveText("۰۳");
  await expect(rows.nth(0)).toHaveAttribute("aria-current", "location");
  await expect(page.locator(".library-privacy")).toBeHidden();
  await expect(page.locator(".library-footer")).toHaveText(
    "محلی · فقط تیترهای همین سند",
  );

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
        header: rect(".reading-header-document"),
        workspace: rect('[data-workspace-screen="reading"]'),
        sidebar: rect("#library-panel"),
        pane: rect("#library-panel .sidebar-pane"),
        rail: rect("#library-panel .sidebar-rail"),
        panelHeader: rect("#library-panel .sidebar-pane-header"),
        summary: rect(".reading-document-outline-summary"),
        firstRow: rect(".reading-document-outline-list .sidebar-row"),
        sheet: rect('[data-workspace-screen="reading"] .preview-pane'),
      },
      surfaces: {
        sidebarBackground: style("#library-panel").backgroundColor,
        sidebarRadius: style("#library-panel").borderTopLeftRadius,
        rowBorder: style(".reading-document-outline-list .sidebar-row")
          .borderWidth,
        activeBackground: style(
          ".reading-document-outline-list .sidebar-row.is-active",
        ).backgroundColor,
        activeColor: style(
          ".reading-document-outline-list .sidebar-row.is-active",
        ).color,
        activeRailBackground: style(
          '#library-panel .sidebar-rail > button[aria-current="page"]',
        ).backgroundColor,
        parentIndent: style(
          ".reading-document-outline-list .sidebar-row:nth-child(1)",
        ).paddingInlineStart,
        childIndent: style(
          ".reading-document-outline-list .sidebar-row:nth-child(3)",
        ).paddingInlineStart,
      },
    };
  });

  expect(contract.geometry).toEqual({
    header: { x: 0, y: 36, width: 820, height: 64 },
    workspace: { x: 0, y: 36, width: 820, height: 822 },
    sidebar: { x: 820, y: 36, width: 360, height: 822 },
    pane: { x: 820, y: 36, width: 304, height: 822 },
    rail: { x: 1124, y: 36, width: 56, height: 822 },
    panelHeader: { x: 834, y: 50, width: 276, height: 52 },
    summary: { x: 834, y: 110, width: 276, height: 18 },
    firstRow: { x: 834, y: 132, width: 276, height: 40 },
    sheet: { x: 30, y: 120, width: 760, height: 680 },
  });
  expect(contract.surfaces).toEqual({
    sidebarBackground: "rgb(232, 235, 226)",
    sidebarRadius: "14px",
    rowBorder: "0px",
    activeBackground: "rgb(233, 239, 255)",
    activeColor: "rgb(37, 87, 229)",
    activeRailBackground: "rgb(252, 253, 249)",
    parentIndent: "8px",
    childIndent: "18px",
  });

  await page.screenshot({
    path: ".artifacts/r04-reading-outline.png",
    fullPage: true,
  });

  const searchAction = pane.getByRole("button", {
    name: "جست‌وجو در فهرست سند",
  });
  await searchAction.click();
  const outlineSearch = pane.getByRole("searchbox", {
    name: "جست‌وجو در فهرست سند",
  });
  await expect(outlineSearch).toBeFocused();
  await outlineSearch.fill("روش");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("روش اجرا");
  await expect(rows.first().locator("svg")).toHaveCount(0);
  await pane.getByRole("button", { name: "پاک‌کردن جست‌وجوی فهرست" }).click();
  await expect(rows).toHaveCount(5);
  await searchAction.click();
  await expect(outlineSearch).toBeHidden();

  await rows.nth(0).focus();
  await rows.nth(0).press("ArrowDown");
  await expect(rows.nth(1)).toBeFocused();
  await rows.nth(1).press("Enter");
  await expect(rows.nth(1)).toHaveAttribute("aria-current", "location");
  await expect(
    page.getByRole("heading", { name: "مسئلهٔ اصلی", exact: true }),
  ).toBeFocused();

  await rows.nth(1).focus();
  await rows.nth(1).press("Escape");
  await expect(sidebar).toHaveClass(/is-collapsed/);
  await expect(outlineTrigger).toBeFocused();
  await expect(shell).toHaveClass(/is-reading/);
  await expect(workspace).toHaveCSS("width", "1124px");
  await expect(sheet).toHaveCSS("width", "760px");
});

test("R04 scroll spy keeps the active outline row synchronized with Reading", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1180, height: 858 });
  await openReadingFixture(
    page,
    READING_OUTLINE_SCROLL_FIXTURE,
    "r04-reading-outline-scroll",
  );

  const sidebar = page.locator("#library-panel");
  await sidebar.getByRole("button", { name: "فهرست سند", exact: true }).click();
  const rows = sidebar.locator(".reading-document-outline-list .sidebar-row");
  await expect(rows).toHaveCount(3);
  await expect(page.locator("html")).not.toHaveClass(
    /reading-layout-is-changing/,
  );

  const methodHeading = page.getByRole("heading", {
    name: "روش اجرا",
    exact: true,
  });
  await methodHeading.evaluate((node) =>
    node.scrollIntoView({ block: "start", behavior: "auto" }),
  );
  await expect(rows.nth(2)).toHaveAttribute("aria-current", "location");

  const beforeCloseTop = await methodHeading.evaluate(
    (node) => node.getBoundingClientRect().top,
  );
  await rows.nth(2).focus();
  await rows.nth(2).press("Escape");
  await expect(sidebar).toHaveClass(/is-collapsed/);
  await expect
    .poll(async () => {
      const afterCloseTop = await methodHeading.evaluate(
        (node) => node.getBoundingClientRect().top,
      );
      return Math.abs(afterCloseTop - beforeCloseTop);
    })
    .toBeLessThan(80);
});

test("R04 keeps skipped heading levels distinct and exposes 44px mobile targets", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await openReadingFixture(
    page,
    READING_OUTLINE_GAP_FIXTURE,
    "r04-reading-outline-mobile",
  );

  const drawer = page.locator("#library-panel");
  const outlineTrigger = drawer.getByRole("button", {
    name: "فهرست سند",
    exact: true,
  });
  await outlineTrigger.click();

  await expect(drawer).toHaveAttribute("role", "dialog");
  await expect(drawer).toHaveAttribute("aria-modal", "true");
  const rows = drawer.locator(".reading-document-outline-list .sidebar-row");
  await expect(rows).toHaveCount(3);
  await expect(rows.nth(0).locator(".sidebar-row-meta")).toHaveText("۰۱");
  await expect(rows.nth(1).locator(".sidebar-row-meta")).toHaveText("۱٫۱٫۱");
  await expect(rows.nth(2).locator(".sidebar-row-meta")).toHaveText("۱٫۲");

  await drawer.getByRole("button", { name: "جست‌وجو در فهرست سند" }).click();
  const dismissSearch = drawer.getByRole("button", {
    name: "بستن جست‌وجوی فهرست",
  });
  const targets = await page.evaluate(() => {
    const dismiss = document.querySelector<HTMLElement>(
      ".reading-outline-search-control button",
    )!;
    const row = document.querySelector<HTMLElement>(
      ".reading-document-outline-list .sidebar-row",
    )!;
    const dismissRect = dismiss.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    return {
      dismiss: {
        width: Math.round(dismissRect.width),
        height: Math.round(dismissRect.height),
      },
      rowHeight: Math.round(rowRect.height),
    };
  });
  expect(targets).toEqual({
    dismiss: { width: 44, height: 44 },
    rowHeight: 44,
  });

  await dismissSearch.click();
  await expect(
    drawer.getByRole("searchbox", {
      name: "جست‌وجو در فهرست سند",
    }),
  ).toBeHidden();
});
