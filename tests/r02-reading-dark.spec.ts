import { expect, test } from "@playwright/test";

const DARK_READING_FIXTURE = [
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

test("R02 maps Reading Closed to the exact dark Foundation surfaces", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1180, height: 858 });
  await page.addInitScript((content) => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "dark");
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
        draftId: "r02-reading-dark",
        viewMode: "reading",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, DARK_READING_FIXTURE);

  await page.goto("/");

  const root = page.locator("html");
  const shell = page.locator(".app-shell");
  const workspace = page.locator('[data-workspace-screen="reading"]');
  const rail = page.locator(".sidebar-rail");
  const sheet = workspace.locator(".preview-pane");
  const article = sheet.locator(".markdown-body");
  const diagram = sheet.locator(".mermaid-diagram.is-reading");

  await expect(shell).toHaveAttribute("data-hydrated", "true");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(shell).toHaveClass(/is-reading/);
  await expect(rail.getByRole("button")).toHaveCount(5);
  await expect(rail.locator('[aria-current="page"]')).toHaveCount(0);
  await expect(page.locator("#library-panel")).toHaveClass(/is-collapsed/);
  await expect(diagram.locator(".mermaid-render-surface")).toBeVisible({
    timeout: 15_000,
  });
  await expect(diagram.locator(".mermaid-render-surface")).toHaveAttribute(
    "data-mermaid-render-key",
    /^dark:/,
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
        titlebar: rect(".topbar"),
        header: rect(".reading-header-document"),
        workspace: rect('[data-workspace-screen="reading"]'),
        rail: rect(".sidebar-rail"),
        sheet: rect('[data-workspace-screen="reading"] .preview-pane'),
        diagram: rect(".mermaid-diagram.is-reading"),
        status: rect(".reading-document-status"),
      },
      colors: {
        shell: style(".app-shell").backgroundColor,
        titlebar: style(".topbar").backgroundColor,
        brand: style(".brand-copy strong").color,
        localNote: style(".reading-local-note").color,
        workspace: style('[data-workspace-screen="reading"]').backgroundColor,
        header: style(".reading-header-document").backgroundColor,
        headerText: style(".reading-header-identity > strong").color,
        headerIcon: style(".reading-header-identity > svg").color,
        toolsIcon: style(".reading-header-tools-toggle").color,
        returnSurface: style(".reading-return-to-desk").backgroundColor,
        rail: style(".sidebar-rail").backgroundColor,
        railIcon: style(".sidebar-rail > button:first-child").color,
        sheet: style('[data-workspace-screen="reading"] .preview-pane')
          .backgroundColor,
        kicker: style(".reading-document-kicker").color,
        heading: style(".markdown-body > h1").color,
        body: style(".markdown-body").color,
        quote: style(".markdown-body > blockquote").backgroundColor,
        quoteText: style(".markdown-body > blockquote").color,
        graph: style(".mermaid-diagram.is-reading").backgroundColor,
        graphInner: style(".mermaid-render-surface").backgroundColor,
        graphAction: style(".mermaid-diagram-action").backgroundColor,
        graphActionText: style(".mermaid-diagram-action").color,
        status: style(".reading-document-status").backgroundColor,
        statusText: style(".reading-document-status").color,
      },
      states: {
        headerBorder: style(".reading-header-document").borderWidth,
        railBorder: style(".sidebar-rail > button:first-child").borderWidth,
        sheetBorder: style(
          '[data-workspace-screen="reading"] .preview-pane',
        ).borderWidth,
        sheetRadius: style(
          '[data-workspace-screen="reading"] .preview-pane',
        ).borderRadius,
        sheetShadow: style(
          '[data-workspace-screen="reading"] .preview-pane',
        ).boxShadow,
        quoteRadius: style(".markdown-body > blockquote").borderRadius,
        graphRadius: style(".mermaid-diagram.is-reading").borderRadius,
        graphInnerRadius: style(".mermaid-render-surface").borderRadius,
        actionRadius: style(".mermaid-diagram-action").borderRadius,
      },
      type: {
        kicker: style(".reading-document-kicker").fontSize,
        kickerWeight: style(".reading-document-kicker").fontWeight,
        heading: style(".markdown-body > h1").fontSize,
        headingLine: style(".markdown-body > h1").lineHeight,
        headingTracking: style(".markdown-body > h1").letterSpacing,
        body: style(".markdown-body").fontSize,
        bodyLine: style(".markdown-body").lineHeight,
      },
    };
  });

  expect(contract.geometry.diagram.height).toBeGreaterThanOrEqual(380);
  expect(contract.geometry.sheet.y + contract.geometry.sheet.height).toBeGreaterThan(contract.geometry.diagram.y + contract.geometry.diagram.height);
  expect(contract.geometry).toEqual({
    titlebar: { x: 0, y: 0, width: 1180, height: 36 },
    header: { x: 0, y: 36, width: 1124, height: 64 },
    workspace: { x: 0, y: 36, width: 1124, height: 822 },
    rail: { x: 1124, y: 36, width: 56, height: 822 },
    sheet: { x: 182, y: 120, width: 760, height: contract.geometry.sheet.height },
    diagram: { x: 230, y: 472, width: 664, height: contract.geometry.diagram.height },
    status: { x: 394, y: contract.geometry.sheet.y + contract.geometry.sheet.height - 44, width: 336, height: 28 },
  });
  expect(contract.colors).toEqual({
    shell: "rgb(14, 19, 15)",
    titlebar: "rgb(20, 26, 22)",
    brand: "rgb(189, 198, 189)",
    localNote: "rgb(174, 184, 175)",
    workspace: "rgb(14, 19, 15)",
    header: "rgb(24, 30, 26)",
    headerText: "rgb(242, 245, 241)",
    headerIcon: "rgb(189, 198, 189)",
    toolsIcon: "rgb(189, 198, 189)",
    returnSurface: "rgb(14, 19, 15)",
    rail: "rgb(16, 20, 17)",
    railIcon: "rgb(189, 198, 189)",
    sheet: "rgb(24, 30, 26)",
    kicker: "rgb(134, 168, 255)",
    heading: "rgb(240, 244, 239)",
    body: "rgb(240, 244, 239)",
    quote: "rgb(20, 26, 22)",
    quoteText: "rgb(240, 244, 239)",
    graph: "rgb(24, 30, 26)",
    graphInner: "rgba(0, 0, 0, 0)",
    graphAction: "rgb(32, 46, 80)",
    graphActionText: "rgb(134, 168, 255)",
    status: "rgb(20, 26, 22)",
    statusText: "rgb(189, 198, 189)",
  });
  expect(contract.states).toEqual({
    headerBorder: "0px",
    railBorder: "0px",
    sheetBorder: "0px",
    sheetRadius: "14px",
    sheetShadow: expect.stringContaining("18px 54px"),
    quoteRadius: "6px",
    graphRadius: "0px",
    graphInnerRadius: "0px",
    actionRadius: "6px",
  });
  expect(contract.type).toEqual({
    kicker: "11px",
    kickerWeight: "400",
    heading: "50px",
    headingLine: "75px",
    headingTracking: "normal",
    body: "18px",
    bodyLine: "36px",
  });

  const renderedSvg = await diagram
    .locator(".mermaid-render-surface")
    .evaluate(async (node) => {
      const response = await fetch((node as HTMLImageElement).src);
      return response.text();
    });
  expect(renderedSvg).toContain("#101612");
  expect(renderedSvg).toContain("#202e50");
  expect(renderedSvg).toContain("#86a8ff");
  expect(renderedSvg).not.toContain("#ececff");

  await expect(article.getByRole("heading", { level: 1 })).toHaveText(
    "نوشتن برای خوانده‌شدن",
  );
  await page.screenshot({
    path: ".artifacts/r02-reading-dark.png",
    fullPage: true,
  });
});
