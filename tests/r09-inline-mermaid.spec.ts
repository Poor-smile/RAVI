import { expect, test, type Page } from "@playwright/test";

const GRAPH_SOURCE = [
  "```mermaid",
  "flowchart RL",
  "  A[ایده] --> B[ساختار] --> C[متن نهایی]",
  "  style A fill:#fcfdf9,stroke:#cbd0c6,color:#171b18",
  "  style B fill:#e9efff,stroke:#2557e5,color:#1742bd",
  "  style C fill:#fcfdf9,stroke:#cbd0c6,color:#171b18",
  "  linkStyle default stroke:#50584f",
  "```",
].join("\n");

const INVALID_GRAPH_SOURCE = [
  "```mermaid",
  "flowchart RL",
  "  A[ایده --> B[ساختار]",
  "```",
].join("\n");

const READING_FIXTURE = [
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
  GRAPH_SOURCE,
].join("\n");

const LONG_READING_FIXTURE = [
  "---",
  "subject: راهنمای نگارش فارسی",
  "---",
  "",
  "# نوشتن برای خوانده‌شدن",
  "",
  ...Array.from(
    { length: 14 },
    (_, index) =>
      `بند آزمایشی ${index + 1} برای سنجش بازگشت دقیق به جای گراف پس از خروج از Graph Viewer.`,
  ).flatMap((line) => [line, ""]),
  GRAPH_SOURCE,
].join("\n");

async function openReadingFixture(
  page: Page,
  content = READING_FIXTURE,
  viewport = { width: 1180, height: 858 },
) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((markdown) => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "light");
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
        documentType: "ravi",
        lastSavedSnapshot: markdown,
        draftId: "r09-inline-mermaid",
        viewMode: "reading",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, content);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
}

test("R09 matches the focused 664×172 Inline Mermaid reference from Figma", async ({
  page,
}) => {
  await openReadingFixture(page);
  const diagram = page.locator(".mermaid-diagram.is-reading");
  await diagram.scrollIntoViewIfNeeded();
  const action = diagram.getByRole("button", {
    name: "نمایش تمام‌صفحهٔ نمودار",
  });
  const surface = diagram.locator(".mermaid-render-surface");

  await expect(surface).toHaveAttribute("src", /^blob:/u, { timeout: 30_000 });
  await expect(diagram.locator(".mermaid-reading-meta strong")).toHaveText(
    "نمودار فرایند",
  );
  await expect(diagram.locator(".mermaid-reading-meta span")).toHaveText(
    "Mermaid · رندر شده در سند",
  );
  await expect(
    action.locator('[data-material-symbol="fullscreen"]'),
  ).toBeVisible();
  const physicalOrder = await action.evaluate((element) => {
    const icon = element.querySelector<HTMLElement>(
      '[data-material-symbol="fullscreen"]',
    )!;
    const label = element.querySelector<HTMLElement>("span")!;
    return {
      iconLeft: icon.getBoundingClientRect().left,
      labelLeft: label.getBoundingClientRect().left,
    };
  });
  expect(physicalOrder.iconLeft).toBeLessThan(physicalOrder.labelLeft);
  await expect(action).toHaveAttribute("aria-haspopup", "dialog");
  await action.focus();

  const contract = await diagram.evaluate((node) => {
    const figure = node as HTMLElement;
    const actionElement = figure.querySelector<HTMLElement>(
      ".mermaid-diagram-action",
    )!;
    const meta = figure.querySelector<HTMLElement>(".mermaid-reading-meta")!;
    const renderSurface = figure.querySelector<HTMLElement>(
      ".mermaid-render-surface",
    )!;
    const rect = (element: Element) => {
      const bounds = element.getBoundingClientRect();
      return {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    const figureStyle = getComputedStyle(figure);
    const actionStyle = getComputedStyle(actionElement);
    const metaTitleStyle = getComputedStyle(meta.querySelector("strong")!);
    const metaCaptionStyle = getComputedStyle(meta.querySelector("span")!);
    const renderStyle = getComputedStyle(renderSurface);
    return {
      geometry: {
        figure: rect(figure),
        action: rect(actionElement),
        meta: rect(meta),
        render: rect(renderSurface),
      },
      figure: {
        background: figureStyle.backgroundColor,
        border: figureStyle.borderWidth,
        radius: figureStyle.borderRadius,
        shadow: figureStyle.boxShadow,
      },
      action: {
        background: actionStyle.backgroundColor,
        color: actionStyle.color,
        border: actionStyle.borderWidth,
        radius: actionStyle.borderRadius,
        padding: actionStyle.paddingInline,
        gap: actionStyle.gap,
        size: actionStyle.fontSize,
        weight: actionStyle.fontWeight,
        line: actionStyle.lineHeight,
        focus: actionStyle.boxShadow,
      },
      meta: {
        titleSize: metaTitleStyle.fontSize,
        titleWeight: metaTitleStyle.fontWeight,
        titleLine: metaTitleStyle.lineHeight,
        captionSize: metaCaptionStyle.fontSize,
        captionWeight: metaCaptionStyle.fontWeight,
        captionLine: metaCaptionStyle.lineHeight,
      },
      render: {
        background: renderStyle.backgroundColor,
        radius: renderStyle.borderRadius,
      },
    };
  });

  expect(contract.geometry.figure.width).toBe(664);
  expect(contract.geometry.figure.height).toBe(172);
  expect(contract.geometry.action).toEqual({
    x: contract.geometry.figure.x + 16,
    y: contract.geometry.figure.y + 16,
    width: 142,
    height: 36,
  });
  expect(contract.geometry.render).toEqual({
    x: contract.geometry.figure.x + 16,
    y: contract.geometry.figure.y + 72,
    width: 632,
    height: 84,
  });
  expect(contract.figure).toEqual({
    background: "rgb(245, 246, 240)",
    border: "0px",
    radius: "14px",
    shadow: "none",
  });
  expect(contract.action).toEqual({
    background: "rgb(233, 239, 255)",
    color: "rgb(37, 87, 229)",
    border: "0px",
    radius: "6px",
    padding: "10px",
    gap: "6px",
    size: "12px",
    weight: "700",
    line: "18px",
    focus: expect.stringContaining("inset"),
  });
  expect(contract.meta).toEqual({
    titleSize: "12px",
    titleWeight: "700",
    titleLine: "18px",
    captionSize: "11px",
    captionWeight: "400",
    captionLine: "17px",
  });
  expect(contract.render).toEqual({
    background: "rgb(252, 253, 249)",
    radius: "6px",
  });
  await page.screenshot({
    path: ".artifacts/r09-inline-mermaid.png",
    fullPage: true,
  });
});

test("R09 keeps invalid Mermaid read-only and never routes Reading to Studio", async ({
  page,
}) => {
  const fixture = READING_FIXTURE.replace(GRAPH_SOURCE, INVALID_GRAPH_SOURCE);
  await openReadingFixture(page, fixture);
  const diagram = page.locator(".mermaid-diagram.is-reading");
  await diagram.scrollIntoViewIfNeeded();

  await expect(diagram).toHaveClass(/is-invalid/u, { timeout: 30_000 });
  await expect(diagram.locator(".mermaid-inline-error")).toBeVisible();
  await expect(
    diagram.getByRole("button", { name: "اصلاح در استودیو" }),
  ).toHaveCount(0);
  await expect(page.locator(".mermaid-studio-backdrop")).toHaveCount(0);
});

test("R09 opens the same rendered SVG in Graph Viewer and restores its Reading anchor", async ({
  page,
}) => {
  await openReadingFixture(page, LONG_READING_FIXTURE, {
    width: 1180,
    height: 640,
  });
  const diagram = page.locator(".mermaid-diagram.is-reading");
  const action = diagram.getByRole("button", {
    name: "نمایش تمام‌صفحهٔ نمودار",
  });
  const surface = diagram.locator(".mermaid-render-surface");
  await diagram.scrollIntoViewIfNeeded();
  await expect(surface).toHaveAttribute("src", /^blob:/u, { timeout: 30_000 });
  const scrollRoot = page.locator(".preview-scroll");
  const scrollBefore = await scrollRoot.evaluate((element) => element.scrollTop);
  const renderBefore = await surface.evaluate((element) => ({
    src: (element as HTMLImageElement).src,
    key: element.getAttribute("data-mermaid-render-key"),
  }));

  await diagram.evaluate((node) => {
    Object.defineProperty(node, "requestFullscreen", {
      configurable: true,
      value: async () => {
        throw new Error("Fullscreen unavailable in this test context");
      },
    });
  });
  await action.click();

  await expect(diagram).toHaveAttribute("data-mermaid-view", "graph-viewer");
  await expect(diagram).toHaveAttribute("role", "dialog");
  await expect(diagram).toHaveAttribute("aria-modal", "true");
  await expect(
    diagram.getByRole("toolbar", { name: "کنترل نمای نمودار" }),
  ).toBeVisible();
  await expect(page.locator(".mermaid-studio-backdrop")).toHaveCount(0);
  await expect(surface).toHaveAttribute("src", renderBefore.src);
  await expect(surface).toHaveAttribute(
    "data-mermaid-render-key",
    renderBefore.key ?? "",
  );

  await page.keyboard.press("Escape");
  await expect(diagram).toHaveAttribute("data-mermaid-view", "inline");
  await expect(action).toBeFocused();
  await expect
    .poll(async () =>
      Math.abs(
        (await scrollRoot.evaluate((element) => element.scrollTop)) - scrollBefore,
      ),
    )
    .toBeLessThanOrEqual(2);
});

test("R09 stacks its touch-safe action without horizontal overflow on mobile", async ({
  page,
}) => {
  await openReadingFixture(page, READING_FIXTURE, { width: 390, height: 844 });
  const diagram = page.locator(".mermaid-diagram.is-reading");
  const surface = diagram.locator(".mermaid-render-surface");
  await expect(surface).toHaveAttribute("src", /^blob:/u, { timeout: 30_000 });

  const geometry = await page.evaluate(() => {
    const figure = document.querySelector<HTMLElement>(
      ".mermaid-diagram.is-reading",
    )!;
    const actionElement = figure.querySelector<HTMLElement>(
      ".mermaid-diagram-action",
    )!;
    const render = figure.querySelector<HTMLElement>(
      ".mermaid-render-surface",
    )!;
    const bounds = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      };
    };
    return {
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      figure: bounds(figure),
      action: bounds(actionElement),
      render: bounds(render),
    };
  });

  expect(Math.round(geometry.figure.height)).toBe(228);
  expect(Math.round(geometry.action.width)).toBe(142);
  expect(Math.round(geometry.action.height)).toBe(44);
  expect(Math.round(geometry.render.height)).toBe(84);
  expect(geometry.figure.left).toBeGreaterThanOrEqual(0);
  expect(geometry.figure.right).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.action.left).toBeGreaterThanOrEqual(geometry.figure.left);
  expect(geometry.action.right).toBeLessThanOrEqual(geometry.figure.right);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport);
});
