import { expect, test } from "@playwright/test";

const READING_SEARCH_FIXTURE = [
  "---",
  "subject: راهنمای نگارش فارسی",
  "---",
  "",
  "# نوشتن برای خوانده‌شدن",
  "",
  "متن خوب پیش از آن‌که زیبا باشد، مسیر خواندن را روشن می‌کند. هر بخش باید یک ایدهٔ مشخص داشته باشد و فاصله‌ها به چشم فرصت مکث بدهند.",
  "",
  "> ساختار، پیش از تزئین، به خواننده اطمینان می‌دهد.",
  "",
  "```mermaid",
  "flowchart RL",
  "  A[ایده] --> B[ساختار] --> C[متن نهایی]",
  "```",
].join("\n");

const READING_SEARCH_CONTINUITY_FIXTURE = [
  "# نقشهٔ راه محصول",
  "",
  ...Array.from(
    { length: 10 },
    (_, index) =>
      `پاراگراف زمینهٔ ${(index + 1).toLocaleString("fa-IR")} برای سنجش حفظ موقعیت مطالعه پس از تغییر عرض پنل و بازچینی سطرهای طولانی سند نوشته شده است.`,
  ).flatMap((line) => [line, ""]),
  "## دنیای بصری محصول",
  "",
  "سامانه باید زبان بصری آرام و منسجمی داشته باشد.",
  "",
  ...Array.from(
    { length: 8 },
    (_, index) =>
      `متن میانی ${(index + 1).toLocaleString("fa-IR")} برای ایجاد فاصلهٔ واقعی میان نتیجه‌های جست‌وجو و آزمودن anchor معنایی سند است.`,
  ).flatMap((line) => [line, ""]),
  "## پیش از پیاده‌سازی",
  "",
  "سامانه پیش از کدنویسی به قرارداد روشن نیاز دارد.",
  "",
  ...Array.from(
    { length: 8 },
    (_, index) =>
      `متن پایانی ${(index + 1).toLocaleString("fa-IR")} بازچینی سند را هنگام جمع‌شدن پنل قابل اندازه‌گیری نگه می‌دارد.`,
  ).flatMap((line) => [line, ""]),
  "## نقش‌های رنگ و فاصله",
  "",
  "سامانه با رنگ و فاصله مسیر خواندن را نشان می‌دهد.",
].join("\n");

test("R03 docks local document search between the reading sheet and four-item rail", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1180, height: 858 });
  await page.addInitScript((content) => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        fileName: "راهنمای نگارش.md",
        content,
        readerSize: 18,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        activeDocumentPath: "C:\\Raavi\\راهنمای نگارش.md",
        documentType: "markdown",
        lastSavedSnapshot: content,
        draftId: "r03-reading-search",
        viewMode: "reading",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, READING_SEARCH_FIXTURE);

  await page.goto("/");

  const shell = page.locator(".app-shell");
  const workspace = page.locator('[data-workspace-screen="reading"]');
  const sidebar = page.locator("#library-panel");
  const pane = sidebar.locator(".sidebar-pane");
  const rail = sidebar.locator(".sidebar-rail");
  const searchTrigger = rail.getByRole("button", {
    name: "جست‌وجو در متن",
    exact: true,
  });
  const sheet = workspace.locator(".preview-pane");

  await expect(shell).toHaveAttribute("data-hydrated", "true");
  await expect(sidebar).toHaveClass(/is-collapsed/);
  await searchTrigger.click();

  await expect(sidebar).toHaveClass(/is-open/);
  await expect(sidebar).toHaveAttribute("role", "complementary");
  await expect(sidebar).not.toHaveAttribute("aria-modal");
  await expect(searchTrigger).toHaveAttribute("aria-current", "page");
  await expect(rail.getByRole("button")).toHaveCount(4);

  const panelTitle = pane.locator("#sidebar-pane-title");
  await expect(panelTitle).toBeVisible();
  await expect(panelTitle).toHaveText("جست‌وجو در متن");
  await expect(pane.locator(".sidebar-pane-heading > span")).toHaveCount(0);
  await expect(pane.locator(".sidebar-pane-actions > button")).toHaveCount(2);
  await expect(
    pane.getByRole("button", { name: "جمع‌کردن نوار کناری" }),
  ).toBeVisible();

  const searchInput = pane.getByRole("searchbox", {
    name: "جست‌وجو در متن سند",
  });
  await expect(searchInput).toBeFocused();
  await expect(searchInput).toHaveAttribute(
    "placeholder",
    "جست‌وجو در متن سند…",
  );
  await searchInput.fill("خوان");

  await expect(pane.locator(".reading-document-search-summary")).toHaveText(
    "۳ نتیجه در همین سند",
  );
  const resultButtons = pane.locator(".reading-document-search-results button");
  await expect(resultButtons).toHaveCount(3);
  await expect(resultButtons.nth(0)).toContainText("نوشتن برای خوانده‌شدن");
  await expect(resultButtons.nth(1)).toContainText("نوشتن برای خوانده‌شدن");
  await expect(resultButtons.nth(2)).toContainText("نوشتن برای خوانده‌شدن");
  await expect(resultButtons.nth(0)).toHaveClass(/is-active/);
  await expect(resultButtons.locator("svg")).toHaveCount(0);
  await expect(page.locator(".library-privacy")).toBeHidden();
  await expect(page.locator(".library-footer")).toHaveText(
    "محلی · فقط متن همین سند",
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
        search: rect(".reading-document-search-control"),
        firstResult: rect(".reading-document-search-results button"),
        sheet: rect('[data-workspace-screen="reading"] .preview-pane'),
      },
      surfaces: {
        sidebarBackground: style("#library-panel").backgroundColor,
        sidebarRadius: style("#library-panel").borderTopLeftRadius,
        paneBackground: style("#library-panel .sidebar-pane").backgroundColor,
        searchBackground: style(".reading-document-search-control")
          .backgroundColor,
        searchBorder: style(".reading-document-search-control").borderWidth,
        searchFocus: style(".reading-document-search-control").boxShadow,
        resultBorder: style(".reading-document-search-results button")
          .borderWidth,
        activeBackground: style(
          ".reading-document-search-results button.is-active",
        ).backgroundColor,
        activeRailBackground: style(
          '#library-panel .sidebar-rail > button[aria-current="page"]',
        ).backgroundColor,
      },
      highlightReady: Boolean(
        (
          CSS as typeof CSS & { highlights?: { has(name: string): boolean } }
        ).highlights?.has("raavi-search-active"),
      ),
    };
  });

  expect(contract.geometry).toEqual({
    header: { x: 0, y: 36, width: 820, height: 64 },
    workspace: { x: 0, y: 36, width: 820, height: 822 },
    sidebar: { x: 820, y: 36, width: 360, height: 822 },
    pane: { x: 820, y: 36, width: 304, height: 822 },
    rail: { x: 1124, y: 36, width: 56, height: 822 },
    panelHeader: { x: 834, y: 50, width: 276, height: 52 },
    search: { x: 834, y: 110, width: 276, height: 40 },
    firstResult: { x: 834, y: 188, width: 276, height: 40 },
    sheet: { x: 30, y: 120, width: 760, height: 680 },
  });
  expect(contract.surfaces).toEqual({
    sidebarBackground: "rgb(232, 235, 226)",
    sidebarRadius: "14px",
    paneBackground: "rgb(232, 235, 226)",
    searchBackground: "rgb(252, 253, 249)",
    searchBorder: "0px",
    searchFocus: expect.stringContaining("rgb(37, 87, 229)"),
    resultBorder: "0px",
    activeBackground: "rgb(233, 239, 255)",
    activeRailBackground: "rgb(252, 253, 249)",
  });
  expect(contract.highlightReady).toBe(true);

  await page.screenshot({
    path: ".artifacts/r03-reading-search.png",
    fullPage: true,
  });

  await searchInput.press("Enter");
  await expect(resultButtons.nth(1)).toHaveClass(/is-active/);
  await searchInput.press("Shift+Enter");
  await expect(resultButtons.nth(0)).toHaveClass(/is-active/);

  await resultButtons.nth(0).focus();
  await resultButtons.nth(0).press("Escape");
  await expect(sidebar).toHaveClass(/is-collapsed/);
  await expect(searchTrigger).toBeFocused();
  await expect(shell).toHaveClass(/is-reading/);
  await expect(workspace).toHaveCSS("width", "1124px");
  await expect(sheet).toHaveCSS("width", "760px");

  await searchTrigger.click();
  await expect(searchInput).toBeFocused();
  await expect(searchInput).toHaveValue("خوان");
  await expect(resultButtons).toHaveCount(3);

  const headerSearchAction = pane.getByRole("button", {
    name: "تمرکز روی جست‌وجوی متن",
  });
  await headerSearchAction.focus();
  await headerSearchAction.press("Escape");
  await expect(sidebar).toHaveClass(/is-collapsed/);
  await expect(shell).toHaveClass(/is-reading/);
});

test("R03 keeps the live search anchor when the pane closes immediately after navigation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1180, height: 858 });
  await page.addInitScript((content) => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        fileName: "نقشه راه.md",
        content,
        readerSize: 18,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        activeDocumentPath: "C:\\Raavi\\نقشه راه.md",
        documentType: "markdown",
        lastSavedSnapshot: content,
        draftId: "r03-reading-search-anchor",
        viewMode: "reading",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, READING_SEARCH_CONTINUITY_FIXTURE);

  await page.goto("/");
  const shell = page.locator(".app-shell");
  const sidebar = page.locator("#library-panel");
  const searchTrigger = sidebar.getByRole("button", {
    name: "جست‌وجو در متن",
    exact: true,
  });
  await expect(shell).toHaveAttribute("data-hydrated", "true");
  await searchTrigger.click();

  const searchInput = sidebar.getByRole("searchbox", {
    name: "جست‌وجو در متن سند",
  });
  await searchInput.fill("سامانه");
  const results = sidebar.locator(".reading-document-search-results button");
  await expect(results).toHaveCount(3);
  await searchInput.press("Enter");
  await expect(results.nth(1)).toHaveClass(/is-active/);

  const targetParagraph = page.getByText(
    "سامانه پیش از کدنویسی به قرارداد روشن نیاز دارد.",
    { exact: true },
  );
  const beforeCloseTop = await targetParagraph.evaluate(
    (node) => node.getBoundingClientRect().top,
  );
  expect(beforeCloseTop).toBeGreaterThan(150);
  expect(beforeCloseTop).toBeLessThan(560);

  await searchInput.press("Escape");
  await expect(sidebar).toHaveClass(/is-collapsed/);
  await expect(shell).toHaveClass(/is-reading/);
  await expect
    .poll(async () => {
      const afterCloseTop = await targetParagraph.evaluate(
        (node) => node.getBoundingClientRect().top,
      );
      return Math.abs(afterCloseTop - beforeCloseTop);
    })
    .toBeLessThan(80);
});
