import { expect, test, type Page } from "@playwright/test";

const READING_HIGHLIGHTS_FIXTURE = [
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

const READING_HIGHLIGHTS_SCROLL_FIXTURE = [
  "# مقدمه",
  "",
  "نخستین نشانه در ابتدای سند قرار دارد.",
  "",
  ...Array.from(
    { length: 18 },
    (_, index) =>
      `بند میانی ${(index + 1).toLocaleString("fa-IR")} برای سنجش همگام‌سازی هایلایت با موقعیت واقعی مطالعه نوشته شده است.`,
  ).flatMap((line) => [line, ""]),
  "# نتیجه",
  "",
  "نشانهٔ پایانی نزدیک انتهای سند قرار دارد.",
  "",
  ...Array.from(
    { length: 8 },
    (_, index) =>
      `بند پایانی ${(index + 1).toLocaleString("fa-IR")} فضای کافی برای پیمایش ایجاد می‌کند.`,
  ).flatMap((line) => [line, ""]),
].join("\n");

type HighlightFixture = {
  id: string;
  quote: string;
  dayOffset?: number;
  hour?: number;
  minute?: number;
};

async function openReadingFixture(
  page: Page,
  content: string,
  draftId: string,
  highlights: readonly HighlightFixture[],
) {
  await page.addInitScript(
    ({ markdown, id, entries }) => {
      window.localStorage.clear();
      const now = new Date();
      const annotations = entries.map((entry) => {
        const createdAt = new Date(now);
        createdAt.setDate(createdAt.getDate() - (entry.dayOffset ?? 0));
        createdAt.setHours(entry.hour ?? 12, entry.minute ?? 0, 0, 0);
        return {
          id: entry.id,
          kind: "highlight",
          start: 0,
          end: entry.quote.length,
          quote: entry.quote,
          prefix: "",
          suffix: "",
          body: "",
          createdAt: createdAt.toISOString(),
        };
      });
      window.localStorage.setItem(
        "raavi:document:v1",
        JSON.stringify({
          fileName: "راهنمای نگارش.md",
          content: markdown,
          readerSize: 18,
          annotations,
          assets: [],
          revision: 1,
          versions: [],
          activeDocumentPath: "C:\\Raavi\\راهنمای نگارش.md",
          documentType: "ravi",
          lastSavedSnapshot: markdown,
          draftId: id,
          viewMode: "reading",
          readingOutlineOpen: false,
          readingPositions: {},
          annotationComposer: null,
        }),
      );
    },
    { markdown: content, id: draftId, entries: highlights },
  );
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
}

const FOUR_HIGHLIGHTS = [
  {
    id: "r05-intro",
    quote: "پیش از پیاده‌سازی، مسئله را با زبان روشن تعریف کنید.",
    hour: 12,
    minute: 40,
  },
  {
    id: "r05-spacing",
    quote: "فاصله‌گذاری باید از ریتم ثابت رابط پیروی کند.",
    hour: 11,
    minute: 18,
  },
  {
    id: "r05-local",
    quote: "همهٔ داده‌ها محلی‌اند.",
    dayOffset: 1,
  },
  {
    id: "r05-version",
    quote: "نسخهٔ فعلی حفظ می‌شود.",
    dayOffset: 1,
  },
] satisfies readonly HighlightFixture[];

test("R05 renders real local highlights in the docked Reading pane", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1180, height: 858 });
  await openReadingFixture(
    page,
    READING_HIGHLIGHTS_FIXTURE,
    "r05-reading-highlights",
    FOUR_HIGHLIGHTS,
  );

  const shell = page.locator(".app-shell");
  const workspace = page.locator('[data-workspace-screen="reading"]');
  const sidebar = page.locator("#library-panel");
  const pane = sidebar.locator(".sidebar-pane");
  const rail = sidebar.locator(".sidebar-rail");
  const trigger = rail.getByRole("button", {
    name: "هایلایت‌ها",
    exact: true,
  });
  const sheet = workspace.locator(".preview-pane");

  await expect(sidebar).toHaveClass(/is-collapsed/);
  await trigger.click();
  await expect(sidebar).toHaveClass(/is-open/);
  await expect(sidebar).toHaveAttribute("role", "complementary");
  await expect(sidebar).not.toHaveAttribute("aria-modal");
  await expect(trigger).toHaveAttribute("aria-current", "page");
  await expect(rail.getByRole("button")).toHaveCount(5);

  await expect(pane.locator("#sidebar-pane-title")).toHaveText("هایلایت‌ها");
  await expect(pane.locator(".sidebar-pane-heading > span")).toHaveCount(0);
  await expect(pane.locator(".sidebar-pane-actions > button")).toHaveCount(2);
  await expect(
    pane.getByRole("button", { name: "جمع‌کردن نوار کناری" }),
  ).toBeVisible();
  await expect(pane.locator(".reading-highlights-summary")).toHaveText(
    "هایلایت‌ها · ۴ مورد",
  );

  const rows = pane.locator(".reading-highlight-row");
  const rowActions = rows.locator(".reading-highlight-row-main");
  await expect(rows).toHaveCount(4);
  await expect(rowActions.locator("svg")).toHaveCount(0);
  await expect(rows.locator(".reading-highlight-row-delete").first()).toHaveCSS(
    "opacity",
    "0",
  );
  await expect(rowActions.nth(0)).toContainText("پیش از پیاده‌سازی");
  await expect(rowActions.nth(0)).toContainText("مقدمه · بند");
  await expect(rowActions.nth(2)).toContainText("دیروز");
  await expect(rowActions.nth(0)).toHaveAttribute("aria-current", "location");
  await expect(page.locator(".library-privacy")).toBeHidden();
  await expect(page.locator(".library-footer")).toHaveText(
    "Markdown · محلی و قابل‌حمل",
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
        summary: rect(".reading-highlights-summary"),
        firstRow: rect(".reading-highlight-row"),
        sheet: rect('[data-workspace-screen="reading"] .preview-pane'),
      },
      surfaces: {
        sidebarBackground: style("#library-panel").backgroundColor,
        sidebarRadius: style("#library-panel").borderTopLeftRadius,
        rowBorder: style(".reading-highlight-row-main").borderWidth,
        activeBackground: style(
          ".reading-highlight-row.is-active .reading-highlight-row-main",
        ).backgroundColor,
        activeColor: style(
          ".reading-highlight-row.is-active .reading-highlight-row-main",
        ).color,
        activeLocationColor: style(
          ".reading-highlight-row.is-active .reading-highlight-row-copy span",
        ).color,
        activeTimeColor: style(
          ".reading-highlight-row.is-active .reading-highlight-row-main time",
        ).color,
        activeRailBackground: style(
          '#library-panel .sidebar-rail > button[aria-current="page"]',
        ).backgroundColor,
      },
    };
  });

  const { sheet: sheetGeometry, ...shellGeometry } = contract.geometry;
  expect(shellGeometry).toEqual({
    header: { x: 0, y: 36, width: 820, height: 64 },
    workspace: { x: 0, y: 36, width: 820, height: 822 },
    sidebar: { x: 820, y: 36, width: 360, height: 822 },
    pane: { x: 820, y: 36, width: 304, height: 822 },
    rail: { x: 1124, y: 36, width: 56, height: 822 },
    panelHeader: { x: 834, y: 50, width: 276, height: 52 },
    summary: { x: 834, y: 110, width: 276, height: 18 },
    firstRow: { x: 834, y: 132, width: 276, height: 64 },
  });
  expect(sheetGeometry).toMatchObject({ x: 30, y: 120, width: 760 });
  expect(sheetGeometry.height).toBeGreaterThanOrEqual(680);
  expect(contract.surfaces).toEqual({
    sidebarBackground: "rgb(232, 235, 226)",
    sidebarRadius: "14px",
    rowBorder: "0px",
    activeBackground: "rgb(233, 239, 255)",
    activeColor: "rgb(37, 87, 229)",
    activeLocationColor: "rgb(80, 88, 79)",
    activeTimeColor: "rgb(104, 113, 104)",
    activeRailBackground: "rgb(252, 253, 249)",
  });

  await page.screenshot({
    path: ".artifacts/r05-reading-highlights.png",
    fullPage: true,
  });

  const searchAction = pane.getByRole("button", {
    name: "جست‌وجو در هایلایت‌ها",
  });
  await searchAction.click();
  const search = pane.getByRole("searchbox", {
    name: "جست‌وجو در هایلایت‌های سند",
  });
  await expect(search).toBeFocused();
  await search.fill("حریم خصوصی");
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("همهٔ داده‌ها محلی‌اند");
  await pane
    .getByRole("button", { name: "پاک‌کردن جست‌وجوی هایلایت‌ها" })
    .click();
  await expect(rows).toHaveCount(4);
  await searchAction.click();
  await expect(search).toBeHidden();

  await rowActions.nth(0).focus();
  await rowActions.nth(0).press("ArrowDown");
  await expect(rowActions.nth(1)).toBeFocused();
  await rowActions.nth(1).press("Enter");
  await expect(rowActions.nth(1)).toHaveAttribute("aria-current", "location");

  await rowActions.nth(1).press("Delete");
  await expect(rows).toHaveCount(3);
  await expect(page.locator(".annotation-undo-notice")).toContainText(
    "هایلایت حذف شد.",
  );
  await page.getByRole("button", { name: "واگرد" }).click();
  await expect(rows).toHaveCount(4);
  await expect(rowActions.nth(1)).toBeFocused();

  await rowActions.nth(1).press("Escape");
  await expect(sidebar).toHaveClass(/is-collapsed/);
  await expect(trigger).toBeFocused();
  await expect(shell).toHaveClass(/is-reading/);
  await expect(workspace).toHaveCSS("width", "1124px");
  await expect(sheet).toHaveCSS("width", "760px");
});

test("R05 keeps rapid highlight deletions independently undoable and ordered", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1180, height: 858 });
  await openReadingFixture(
    page,
    READING_HIGHLIGHTS_FIXTURE,
    "r05-reading-highlights-undo-queue",
    FOUR_HIGHLIGHTS.slice(0, 2),
  );

  const sidebar = page.locator("#library-panel");
  await sidebar
    .getByRole("button", { name: "هایلایت‌ها", exact: true })
    .click();
  const rows = sidebar.locator(".reading-highlight-row-main");

  await rows.nth(0).focus();
  await rows.nth(0).press("Delete");
  await expect(rows).toHaveCount(1);
  await rows.nth(0).focus();
  await rows.nth(0).press("Delete");
  await expect(rows).toHaveCount(0);
  await expect(page.locator(".annotation-undo-notice")).toHaveCount(2);

  await page
    .locator(".annotation-undo-notice")
    .filter({ hasText: "پیش از پیاده‌سازی" })
    .getByRole("button", { name: "واگرد", exact: true })
    .click();
  await expect(rows).toHaveCount(1);
  await expect(rows.nth(0)).toContainText("پیش از پیاده‌سازی");

  await page
    .locator(".annotation-undo-notice")
    .filter({ hasText: "فاصله‌گذاری باید" })
    .getByRole("button", { name: "واگرد", exact: true })
    .click();
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("پیش از پیاده‌سازی");
  await expect(rows.nth(1)).toContainText("فاصله‌گذاری باید");
  await expect(rows.nth(1)).toBeFocused();
});

test("R05 scroll spy keeps the active highlight synchronized with Reading", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1180, height: 858 });
  await openReadingFixture(
    page,
    READING_HIGHLIGHTS_SCROLL_FIXTURE,
    "r05-reading-highlights-scroll",
    [
      {
        id: "r05-scroll-start",
        quote: "نخستین نشانه در ابتدای سند قرار دارد.",
      },
      {
        id: "r05-scroll-end",
        quote: "نشانهٔ پایانی نزدیک انتهای سند قرار دارد.",
      },
    ],
  );

  const sidebar = page.locator("#library-panel");
  await sidebar
    .getByRole("button", { name: "هایلایت‌ها", exact: true })
    .click();
  const rows = sidebar.locator(".reading-highlight-row-main");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute("aria-current", "location");
  await expect(page.locator("html")).not.toHaveClass(
    /reading-layout-is-changing/,
  );

  const target = page.getByText("نشانهٔ پایانی نزدیک انتهای سند قرار دارد.", {
    exact: true,
  });
  // Real scroll intent cancels pending layout restoration. A synthetic scroll
  // alone can race initial font/layout settling and is not a user gesture.
  await page.locator('[data-workspace-screen="reading"]').hover({ position: { x: 200, y: 200 } });
  await page.mouse.wheel(0, 1);
  await target.evaluate((node) => {
    const workspace = document.querySelector<HTMLElement>(
      '[data-workspace-screen="reading"]',
    )!;
    const workspaceRect = workspace.getBoundingClientRect();
    const targetRect = node.getBoundingClientRect();
    workspace.scrollTop +=
      targetRect.top -
      workspaceRect.top -
      workspace.clientHeight / 2 +
      targetRect.height / 2;
    workspace.dispatchEvent(new Event("scroll"));
  });
  await expect(rows.nth(1)).toHaveAttribute("aria-current", "location");
});

// Mobile editor contract retired; device access is covered in desktop-access.spec.ts.
