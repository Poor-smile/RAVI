import { expect, test, type Page } from "@playwright/test";

const READING_COMMENTS_FIXTURE = [
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
  "  style A fill:#101612,stroke:#101612,color:#f2f5f1",
  "  style B fill:#202e50,stroke:#202e50,color:#86a8ff",
  "  style C fill:#101612,stroke:#101612,color:#f2f5f1",
  "  linkStyle default stroke:#f0f4ef",
  "```",
].join("\n");

const READING_COMMENTS_SCROLL_FIXTURE = [
  "# مقدمه",
  "",
  "نظر نخست در ابتدای سند قرار دارد.",
  "",
  ...Array.from(
    { length: 18 },
    (_, index) =>
      `بند میانی ${(index + 1).toLocaleString("fa-IR")} برای سنجش همگام‌سازی نظر با موقعیت واقعی مطالعه نوشته شده است.`,
  ).flatMap((line) => [line, ""]),
  "# نتیجه",
  "",
  "نظر پایانی نزدیک انتهای سند قرار دارد.",
  "",
  ...Array.from(
    { length: 8 },
    (_, index) =>
      `بند پایانی ${(index + 1).toLocaleString("fa-IR")} فضای کافی برای پیمایش ایجاد می‌کند.`,
  ).flatMap((line) => [line, ""]),
].join("\n");

type CommentFixture = {
  id: string;
  quote: string;
  body: string;
  dayOffset?: number;
  hour?: number;
  minute?: number;
};

async function openReadingFixture(
  page: Page,
  content: string,
  draftId: string,
  comments: readonly CommentFixture[],
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport);
  await page.addInitScript(
    ({ markdown, id, entries }) => {
      window.localStorage.clear();
      window.localStorage.setItem("raavi:theme:v1", "dark");
      const now = new Date();
      const annotations = entries.map((entry) => {
        const createdAt = new Date(now);
        createdAt.setDate(createdAt.getDate() - (entry.dayOffset ?? 0));
        createdAt.setHours(entry.hour ?? 12, entry.minute ?? 0, 0, 0);
        return {
          id: entry.id,
          kind: "comment",
          start: 0,
          end: entry.quote.length,
          quote: entry.quote,
          prefix: "",
          suffix: "",
          body: entry.body,
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
    { markdown: content, id: draftId, entries: comments },
  );
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
}

const THREE_COMMENTS = [
  {
    id: "r06-decision",
    quote: "این تصمیم باید مستند شود.",
    body: "به یک مرجع معتبر نیاز دارد.",
    hour: 12,
    minute: 40,
  },
  {
    id: "r06-behavior",
    quote: "رفتارها باید همان باشد…",
    body: "در تست پذیرش بررسی شود.",
    hour: 11,
    minute: 5,
  },
  {
    id: "r06-width",
    quote: "سند وسط‌چین شود.",
    body: "حداکثر عرض هم ثبت شود.",
    dayOffset: 1,
  },
] satisfies readonly CommentFixture[];

test("R06 renders the exact dark Comments pane and keeps comments editable", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openReadingFixture(
    page,
    READING_COMMENTS_FIXTURE,
    "r06-reading-comments",
    THREE_COMMENTS,
    { width: 1180, height: 858 },
  );

  const shell = page.locator(".app-shell");
  const workspace = page.locator('[data-workspace-screen="reading"]');
  const sidebar = page.locator("#library-panel");
  const pane = sidebar.locator(".sidebar-pane");
  const rail = sidebar.locator(".sidebar-rail");
  const trigger = rail.getByRole("button", { name: "نظرات", exact: true });
  const sheet = workspace.locator(".preview-pane");

  await expect(sidebar).toHaveClass(/is-collapsed/);
  await trigger.click();
  await expect(sidebar).toHaveClass(/is-open/);
  await expect(sidebar).toHaveAttribute("role", "complementary");
  await expect(sidebar).not.toHaveAttribute("aria-modal");
  await expect(trigger).toHaveAttribute("aria-current", "page");
  await expect(rail.getByRole("button")).toHaveCount(5);

  await expect(pane.locator("#sidebar-pane-title")).toHaveText("نظرات");
  await expect(pane.locator(".sidebar-pane-heading > span")).toHaveCount(0);
  await expect(pane.locator(".sidebar-pane-actions > button")).toHaveCount(2);
  await expect(
    pane.getByRole("button", { name: "جمع‌کردن نوار کناری" }),
  ).toBeVisible();
  await expect(pane.locator(".reading-comments-summary")).toHaveText(
    "نظرات · ۳ مورد",
  );

  const rows = pane.locator(".reading-comment-row");
  const rowActions = rows.locator(".reading-comment-row-jump");
  const bodies = rows.locator(".reading-comment-row-body");
  await expect(rows).toHaveCount(3);
  await expect(rows.locator(".reading-comment-row-main svg")).toHaveCount(0);
  await expect(rows.locator(".reading-comment-row-delete").first()).toHaveCSS(
    "opacity",
    "0",
  );
  await expect(rowActions.nth(0)).toContainText(
    "«این تصمیم باید مستند شود.»",
  );
  await expect(bodies.nth(0)).toHaveValue("به یک مرجع معتبر نیاز دارد.");
  await expect(bodies.nth(1)).toHaveValue("در تست پذیرش بررسی شود.");
  await expect(bodies.nth(2)).toHaveValue("حداکثر عرض هم ثبت شود.");
  await expect(rows.nth(2).locator("time")).toHaveText("دیروز");
  await expect(rowActions.nth(0)).toHaveAttribute(
    "aria-current",
    "location",
  );
  await expect(pane.getByRole("button", { name: /افزودن نظر/ })).toHaveCount(0);
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
        summary: rect(".reading-comments-summary"),
        firstRow: rect(".reading-comment-row"),
        sheet: rect('[data-workspace-screen="reading"] .preview-pane'),
      },
      surfaces: {
        sidebarBackground: style("#library-panel").backgroundColor,
        sidebarRadius: style("#library-panel").borderTopLeftRadius,
        rowBorder: style(".reading-comment-row-main").borderWidth,
        activeBackground: style(
          ".reading-comment-row.is-active .reading-comment-row-main",
        ).backgroundColor,
        activeQuoteColor: style(
          ".reading-comment-row.is-active .reading-comment-row-jump",
        ).color,
        activeBodyColor: style(
          ".reading-comment-row.is-active .reading-comment-row-body",
        ).color,
        activeTimeColor: style(
          ".reading-comment-row.is-active .reading-comment-row-main time",
        ).color,
        activeRailBackground: style(
          '#library-panel .sidebar-rail > button[aria-current="page"]',
        ).backgroundColor,
      },
      targetHeights: {
        jump: rect(".reading-comment-row-jump").height,
        body: rect(".reading-comment-row-body").height,
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
    summary: { x: 834, y: 138, width: 276, height: 18 },
    firstRow: { x: 834, y: 160, width: 276, height: 64 },
  });
  expect(sheetGeometry).toMatchObject({ x: 30, y: 120, width: 760 });
  expect(sheetGeometry.height).toBeGreaterThanOrEqual(680);
  expect(contract.surfaces).toEqual({
    sidebarBackground: "rgb(14, 19, 15)",
    sidebarRadius: "14px",
    rowBorder: "0px",
    activeBackground: "rgb(32, 46, 80)",
    activeQuoteColor: "rgb(134, 168, 255)",
    activeBodyColor: "rgb(189, 198, 189)",
    activeTimeColor: "rgb(174, 184, 175)",
    activeRailBackground: "rgb(59, 68, 61)",
  });
  expect(contract.targetHeights).toEqual({ jump: 24, body: 24 });

  await expect(
    sheet.locator(".mermaid-diagram .mermaid-render-surface"),
  ).toBeVisible({ timeout: 15_000 });
  await page.screenshot({
    path: ".artifacts/r06-reading-comments-dark.png",
    fullPage: true,
  });

  const searchAction = pane.getByRole("button", {
    name: "جست‌وجو در نظرات",
  });
  await searchAction.click();
  const search = pane.getByRole("searchbox", {
    name: "جست‌وجو در نظرات سند",
  });
  await expect(search).toBeFocused();
  await search.fill("پذیرش");
  await expect(rows).toHaveCount(1);
  await expect(bodies.first()).toHaveValue("در تست پذیرش بررسی شود.");
  await pane
    .getByRole("button", { name: "پاک‌کردن جست‌وجوی نظرات" })
    .click();
  await expect(rows).toHaveCount(3);
  await searchAction.click();
  await expect(search).toBeHidden();

  await rowActions.nth(0).focus();
  await rowActions.nth(0).press("ArrowDown");
  await expect(rowActions.nth(1)).toBeFocused();
  await rowActions.nth(1).press("Enter");
  await expect(rowActions.nth(1)).toHaveAttribute(
    "aria-current",
    "location",
  );

  await bodies.nth(1).fill("در پذیرش نهایی دوباره بررسی شود.");
  await expect(bodies.nth(1)).toHaveValue(
    "در پذیرش نهایی دوباره بررسی شود.",
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const snapshot = JSON.parse(
          window.localStorage.getItem("raavi:document:v1") ?? "{}",
        ) as { annotations?: Array<{ id: string; body: string }> };
        return snapshot.annotations?.find(
          (annotation) => annotation.id === "r06-behavior",
        )?.body;
      }),
    )
    .toBe("در پذیرش نهایی دوباره بررسی شود.");
  await bodies.nth(1).press("Escape");
  await expect(sidebar).toHaveClass(/is-open/);
  await expect(bodies.nth(1)).not.toBeFocused();
  await expect(rowActions.nth(1)).toBeFocused();

  await rowActions.nth(1).focus();
  await rowActions.nth(1).press("Delete");
  await expect(rows).toHaveCount(2);
  await expect(page.locator(".annotation-undo-notice")).toContainText(
    "نظر حذف شد.",
  );
  await page.getByRole("button", { name: "واگرد" }).click();
  await expect(rows).toHaveCount(3);
  await expect(bodies.nth(1)).toHaveValue(
    "در پذیرش نهایی دوباره بررسی شود.",
  );
  await expect(rowActions.nth(1)).toBeFocused();

  await rowActions.nth(1).press("Escape");
  await expect(sidebar).toHaveClass(/is-collapsed/);
  await expect(trigger).toBeFocused();
  await expect(shell).toHaveClass(/is-reading/);
  await expect(workspace).toHaveCSS("width", "1124px");
  await expect(sheet).toHaveCSS("width", "760px");
});

test("R06 scroll spy keeps the active comment synchronized with Reading", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openReadingFixture(
    page,
    READING_COMMENTS_SCROLL_FIXTURE,
    "r06-reading-comments-scroll",
    [
      {
        id: "r06-scroll-start",
        quote: "نظر نخست در ابتدای سند قرار دارد.",
        body: "نظر آغازین",
      },
      {
        id: "r06-scroll-end",
        quote: "نظر پایانی نزدیک انتهای سند قرار دارد.",
        body: "نظر پایانی",
      },
    ],
    { width: 1180, height: 858 },
  );

  const sidebar = page.locator("#library-panel");
  await sidebar.getByRole("button", { name: "نظرات", exact: true }).click();
  const rows = sidebar.locator(".reading-comment-row-jump");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute("aria-current", "location");
  await expect(page.locator("html")).not.toHaveClass(
    /reading-layout-is-changing/,
  );

  const target = page.getByText("نظر پایانی نزدیک انتهای سند قرار دارد.", {
    exact: true,
  });
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
