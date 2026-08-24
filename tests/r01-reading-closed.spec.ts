import { expect, test } from "@playwright/test";

const READING_FIXTURE = [
  "---",
  "subject: راهنمای نگارش فارسی",
  "---",
  "",
  "# نوشتن برای خوانده‌شدن",
  "",
  "متن خوب پیش از آن‌که زیبا باشد، مسیر خواندن را روشن می‌کند و به خواننده اجازه می‌دهد بدون مکث، معنا را دنبال کند.",
  "",
  "> ساختار، پیش از تزئین، به خواننده اطمینان می‌دهد.",
  "",
  "```mermaid",
  "flowchart RL",
  "  A[ایده] --> B[ساختار] --> C[متن نهایی]",
  "  style A fill:#fcfdf9,stroke:#cbd0c6,color:#171b18",
  "  style B fill:#e9efff,stroke:#2557e5,color:#1742bd",
  "  style C fill:#fcfdf9,stroke:#cbd0c6,color:#171b18",
  "  linkStyle default stroke:#50584f",
  "```",
].join("\n");

test("R01 assembles the closed 760px reading surface and four-item rail", async ({
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
        draftId: "r01-reading-closed",
        viewMode: "reading",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, READING_FIXTURE);

  await page.goto("/");

  const shell = page.locator(".app-shell");
  const workspace = page.locator('[data-workspace-screen="reading"]');
  const header = page.locator(".reading-header-document");
  const rail = page.locator(".sidebar-rail");
  const sheet = workspace.locator(".preview-pane");
  const article = sheet.locator(".markdown-body");
  const status = sheet.locator(".reading-document-status");
  const diagram = sheet.locator(".mermaid-diagram.is-reading");

  await expect(shell).toHaveAttribute("data-hydrated", "true");
  await expect(shell).toHaveClass(/is-reading/);
  await expect(workspace).toBeVisible();
  await expect(page.locator(".proofbar")).toBeHidden();
  await expect(page.locator(".document-tabs")).toHaveCount(0);
  await expect(page.locator(".workspace-frame")).not.toHaveClass(
    /has-document-tabs/,
  );
  await expect(header).toBeVisible();
  await expect(header.locator(".reading-header-identity strong")).toHaveText(
    "راهنمای نگارش.md",
  );
  await expect(page.locator(".reading-local-note")).toHaveText(
    "●فقط روی این دستگاه",
  );
  await expect(
    header.getByRole("button", { name: "بازگشت به میز", exact: true }),
  ).toBeVisible();
  await expect(
    header.getByRole("button", { name: "ابزار مطالعه", exact: true }),
  ).toBeVisible();
  await expect(header.locator(".reading-header-outline-toggle--mobile")).toBeHidden();

  const railButtons = rail.getByRole("button");
  await expect(railButtons).toHaveCount(4);
  await expect(railButtons.nth(0)).toHaveAttribute(
    "aria-label",
    "جست‌وجو در متن",
  );
  await expect(railButtons.nth(1)).toHaveAttribute("aria-label", "فهرست سند");
  await expect(railButtons.nth(2)).toHaveAttribute("aria-label", "هایلایت‌ها");
  await expect(railButtons.nth(3)).toHaveAttribute("aria-label", "نظرات");
  await expect(rail.locator('[aria-current="page"]')).toHaveCount(0);
  await expect(page.locator("#library-panel")).toHaveClass(/is-collapsed/);
  await expect(page.locator("#library-panel")).not.toHaveAttribute("role", "dialog");

  await expect(article.locator(".reading-document-kicker")).toHaveText(
    "راهنمای نگارش فارسی",
  );
  await expect(article.getByRole("heading", { level: 1 })).toHaveText(
    "نوشتن برای خوانده‌شدن",
  );
  await expect(article.locator("blockquote")).toContainText(
    "ساختار، پیش از تزئین",
  );
  await expect(status).toContainText(/واژه · .* خط/);
  await expect(diagram).toBeVisible();
  await expect(diagram.locator(".mermaid-reading-meta strong")).toHaveText(
    "نمودار فرایند",
  );
  await expect(diagram.locator(".mermaid-reading-meta span")).toHaveText(
    "Mermaid · رندر شده در سند",
  );
  await expect(
    diagram.getByRole("button", { name: "نمایش تمام‌صفحهٔ نمودار" }),
  ).toBeVisible();
  await expect(diagram.locator(".mermaid-render-surface")).toBeVisible({
    timeout: 15_000,
  });

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
        titlebar: rect(".topbar"),
        header: rect(".reading-header-document"),
        workspace: rect('[data-workspace-screen="reading"]'),
        rail: rect(".sidebar-rail"),
        firstRailItem: rect(".sidebar-rail > button:first-child"),
        sheet: rect('[data-workspace-screen="reading"] .preview-pane'),
        status: rect(".reading-document-status"),
        diagram: rect(".mermaid-diagram.is-reading"),
      },
      surfaces: {
        shellRadius: style(".app-shell").borderRadius,
        headerRadius: style(".reading-header-document").borderRadius,
        headerBorder: style(".reading-header-document").borderWidth,
        railBorder: style(".sidebar-rail > button:first-child").borderWidth,
        sheetRadius: style(
          '[data-workspace-screen="reading"] .preview-pane',
        ).borderRadius,
        sheetBorder: style(
          '[data-workspace-screen="reading"] .preview-pane',
        ).borderWidth,
        sheetShadow: style(
          '[data-workspace-screen="reading"] .preview-pane',
        ).boxShadow,
        quoteBorder: style(".markdown-body blockquote").borderWidth,
        quoteRadius: style(".markdown-body blockquote").borderRadius,
        diagramBorder: style(".mermaid-diagram.is-reading").borderWidth,
        diagramSurfaceRadius: style(".mermaid-render-surface").borderRadius,
        diagramActionRadius: style(".mermaid-diagram-action").borderRadius,
        returnBackground: style(".reading-return-to-desk").backgroundColor,
        returnRadius: style(".reading-return-to-desk").borderRadius,
        documentIconColor: style(".reading-header-identity > svg").color,
        localStatusDotColor: getComputedStyle(
          element(".reading-local-note"),
          "::before",
        ).color,
      },
      type: {
        kicker: style(".reading-document-kicker").fontSize,
        heading: style(".markdown-body > h1").fontSize,
        headingLine: style(".markdown-body > h1").lineHeight,
        body: style(".markdown-body").fontSize,
        bodyLine: style(".markdown-body").lineHeight,
      },
    };
  });

  expect(contract.geometry).toEqual({
    titlebar: { x: 0, y: 0, width: 1180, height: 36 },
    header: { x: 0, y: 36, width: 1124, height: 64 },
    workspace: { x: 0, y: 36, width: 1124, height: 822 },
    rail: { x: 1124, y: 36, width: 56, height: 822 },
    firstRailItem: { x: 1134, y: 48, width: 36, height: 36 },
    sheet: { x: 182, y: 120, width: 760, height: 680 },
    status: { x: 394, y: 756, width: 336, height: 28 },
    diagram: { x: 230, y: contract.geometry.diagram.y, width: 664, height: 172 },
  });
  expect(contract.geometry.diagram.y).toBe(472);
  expect(contract.surfaces).toEqual({
    shellRadius: "14px",
    headerRadius: "14px",
    headerBorder: "0px",
    railBorder: "0px",
    sheetRadius: "14px",
    sheetBorder: "0px",
    sheetShadow: expect.stringContaining("18px 54px"),
    quoteBorder: "0px",
    quoteRadius: "6px",
    diagramBorder: "0px",
    diagramSurfaceRadius: "6px",
    diagramActionRadius: "6px",
    returnBackground: "rgb(232, 235, 226)",
    returnRadius: "6px",
    documentIconColor: "rgb(80, 88, 79)",
    localStatusDotColor: "rgb(80, 88, 79)",
  });
  expect(contract.type).toEqual({
    kicker: "11px",
    heading: "50px",
    headingLine: "75px",
    body: "18px",
    bodyLine: "36px",
  });

  await page.screenshot({
    path: ".artifacts/r01-reading-closed.png",
    fullPage: true,
  });

  const fullscreenTrigger = diagram.getByRole("button", {
    name: "نمایش تمام‌صفحهٔ نمودار",
  });
  await diagram.evaluate((node) => {
    Object.defineProperty(node, "requestFullscreen", {
      configurable: true,
      value: async () => {
        throw new Error("Fullscreen unavailable in this test context");
      },
    });
  });
  await fullscreenTrigger.click();
  await expect(diagram).toHaveClass(/is-detail-open/);
  await expect(diagram).toHaveAttribute("role", "dialog");
  await expect(diagram).toHaveAttribute("aria-modal", "true");
  const fullscreenClose = diagram.getByRole("button", {
    name: "بازگشت به سند",
  });
  await expect(fullscreenClose).toBeFocused();
  await expect
    .poll(() =>
      header.evaluate((node) => Boolean(node.closest("[inert]"))),
    )
    .toBe(true);
  await page.keyboard.press("Tab");
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(document.activeElement?.closest(".mermaid-diagram.is-reading")),
      ),
    )
    .toBe(true);
  await page.keyboard.press("Escape");
  await expect(diagram).not.toHaveClass(/is-detail-open/);
  await expect(fullscreenTrigger).toBeFocused();
  await expect
    .poll(() =>
      header.evaluate((node) => Boolean(node.closest("[inert]"))),
    )
    .toBe(false);

  await header
    .getByRole("button", { name: "بازگشت به میز", exact: true })
    .click();
  await expect(shell).not.toHaveClass(/is-reading/);
  await expect(page.locator('[data-workspace-screen="reading"]')).toHaveCount(0);
});
