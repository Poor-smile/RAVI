import { expect, test, type Page } from "@playwright/test";
import {
  activatePointerAction,
  scrollIntoViewStable,
} from "./helpers/pointer-action";

const GRAPH_SOURCE = [
  "```mermaid",
  "flowchart RL",
  "  A[ایده] --> B[ساختار] --> C[متن نهایی]",
  "  style A fill:#101612,stroke:#101612,color:#f2f5f1",
  "  style B fill:#202e50,stroke:#202e50,color:#86a8ff",
  "  style C fill:#101612,stroke:#101612,color:#f2f5f1",
  "  linkStyle default stroke:#f2f5f1",
  "```",
].join("\n");

const READING_FIXTURE = [
  "---",
  "subject: راهنمای نگارش فارسی",
  "---",
  "",
  "# نوشتن برای خوانده‌شدن",
  "",
  "متن خوب پیش از آن‌که زیبا باشد، مسیر خواندن را روشن می‌کند.",
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
    (_, index) => `بند ${index + 1} برای سنجش بازگشت دقیق به سند.`,
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
        draftId: "r10-graph-viewer",
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

async function openGraphViewer(page: Page) {
  const diagram = page.locator(".mermaid-diagram.is-reading");
  const surface = diagram.locator(".mermaid-render-surface");
  await scrollIntoViewStable(diagram);
  await expect(surface).toHaveAttribute("src", /^blob:/u, { timeout: 30_000 });
  const render = await surface.evaluate((element) => ({
    src: (element as HTMLImageElement).src,
    key: element.getAttribute("data-mermaid-render-key"),
  }));
  const trigger = diagram.getByRole("button", {
    name: "نمایش تمام‌صفحهٔ نمودار",
  });
  await activatePointerAction(trigger);
  await expect(diagram).toHaveAttribute("data-mermaid-view", "graph-viewer");
  return { diagram, render, surface, trigger };
}

test("R10 preserves the active theme in the 1180×858 Graph Viewer", async ({
  page,
}) => {
  await openReadingFixture(page);
  const { diagram, render, surface } = await openGraphViewer(page);
  const header = diagram.locator(".mermaid-graph-viewer-header");
  const returnButton = header.getByRole("button", { name: "بازگشت به سند" });

  await expect(diagram).toHaveAttribute("role", "dialog");
  await expect(diagram).toHaveAttribute("aria-modal", "true");
  await expect(header.locator("h2")).toHaveText(
    "نمودار فرایند · راهنمای نگارش.md",
  );
  await expect(surface).toHaveAttribute("src", /^blob:/u);
  await expect(surface).toHaveAttribute(
    "data-mermaid-render-key",
    render.key ?? "",
  );
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator(".mermaid-studio-backdrop")).toHaveCount(0);
  await expect
    .poll(async () =>
      diagram.evaluate((node) => {
        const render = node
          .querySelector<HTMLElement>(".mermaid-graph-viewer-render")!
          .getBoundingClientRect();
        const graph = node
          .querySelector<HTMLElement>(".mermaid-render-surface")!
          .getBoundingClientRect();
        return Math.abs(
          graph.y + graph.height / 2 - (render.y + render.height / 2),
        );
      }),
    )
    .toBeLessThanOrEqual(2);

  const contract = await diagram.evaluate((node) => {
    const pick = (selector: string) => node.querySelector<HTMLElement>(selector)!;
    const rect = (element: Element) => {
      const bounds = element.getBoundingClientRect();
      return {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    const viewerStyle = getComputedStyle(node);
    const headerStyle = getComputedStyle(pick(".mermaid-graph-viewer-header"));
    const canvasStyle = getComputedStyle(pick(".mermaid-diagram-canvas"));
    const previewStyle = getComputedStyle(pick(".mermaid-graph-viewer-preview"));
    const toolbarElement = pick(".mermaid-diagram-viewport-tools");
    const buttons = Array.from(toolbarElement.querySelectorAll("button"));
    return {
      geometry: {
        viewer: rect(node),
        header: rect(pick(".mermaid-graph-viewer-header")),
        title: rect(pick(".mermaid-graph-viewer-header h2")),
        returnButton: rect(pick(".mermaid-graph-viewer-return")),
        canvas: rect(pick(".mermaid-diagram-canvas")),
        preview: rect(pick(".mermaid-graph-viewer-preview")),
        render: rect(pick(".mermaid-graph-viewer-render")),
        toolbar: rect(toolbarElement),
        tools: buttons.map(rect),
      },
      colors: {
        viewer: viewerStyle.backgroundColor,
        header: headerStyle.backgroundColor,
        canvas: canvasStyle.backgroundColor,
        preview: previewStyle.backgroundColor,
        toolbar: getComputedStyle(toolbarElement).backgroundColor,
      },
      previewRadius: previewStyle.borderRadius,
      toolbarRadius: getComputedStyle(toolbarElement).borderRadius,
      icons: buttons.map(
        (button) =>
          button.querySelector("[data-material-symbol]")?.getAttribute(
            "data-material-symbol",
          ) ?? "",
      ),
    };
  });

  expect(contract.geometry.viewer).toEqual({ x: 0, y: 0, width: 1180, height: 858 });
  expect(contract.geometry.header).toEqual({ x: 0, y: 0, width: 1180, height: 72 });
  expect(contract.geometry.title).toEqual({ x: 500, y: 19, width: 640, height: 35 });
  expect(contract.geometry.returnButton).toEqual({ x: 20, y: 14, width: 164, height: 44 });
  expect(contract.geometry.canvas).toEqual({ x: 0, y: 72, width: 1180, height: 786 });
  expect(contract.geometry.preview).toEqual({ x: 0, y: 72, width: 1180, height: 786 });
  expect(contract.geometry.render).toEqual({ x: 48, y: 160, width: 1084, height: 666 });
  expect(contract.geometry.toolbar).toEqual({ x: 24, y: 96, width: 184, height: 52 });
  expect(contract.geometry.tools).toEqual(
    Array.from({ length: 4 }, (_, index) => ({
      x: 32 + index * 44,
      y: 104,
      width: 36,
      height: 36,
    })),
  );
  expect(contract.colors).toEqual({
    viewer: "rgb(232, 235, 226)",
    header: "rgb(252, 253, 249)",
    canvas: "rgb(250, 251, 247)",
    preview: "rgba(0, 0, 0, 0)",
    toolbar: "rgb(255, 255, 255)",
  });
  expect(contract.previewRadius).toBe("0px");
  expect(contract.toolbarRadius).toBe("6px");
  expect(contract.icons).toEqual([
    "zoom_out",
    "zoom_in",
    "fit_screen",
    "fullscreen",
  ]);
  await expect(returnButton).toBeFocused();

  await page.screenshot({
    path: ".artifacts/r10-graph-viewer.png",
    fullPage: true,
  });
});

test("R10 keeps zoom, fit, pan, native fullscreen and Reading return semantics", async ({
  page,
}) => {
  await openReadingFixture(page, LONG_READING_FIXTURE, {
    width: 1180,
    height: 640,
  });
  const scrollRoot = page.locator(".preview-scroll");
  const { diagram, surface, trigger } = await openGraphViewer(page);
  const scrollBefore = await scrollRoot.evaluate((element) => element.scrollTop);
  const toolbar = diagram.getByRole("toolbar", { name: "کنترل نمای نمودار" });
  const zoomOut = toolbar.getByRole("button", { name: "کوچک‌نمایی نمودار" });
  const zoomIn = toolbar.getByRole("button", { name: "بزرگ‌نمایی نمودار" });
  const fit = toolbar.getByRole("button", {
    name: "جا دادن کامل نمودار در کادر",
  });
  const nativeFullscreen = toolbar.getByRole("button", {
    name: "نمایش Graph Viewer در تمام‌صفحهٔ سیستم",
  });
  const scale = toolbar.locator(".mermaid-graph-viewer-scale");

  await expect(diagram.getByRole("button", { name: "بازگشت به سند" })).toBeFocused();
  await page.waitForTimeout(300);
  await expect(diagram.getByRole("button", { name: "بازگشت به سند" })).toBeFocused();
  await zoomOut.focus();
  await expect(zoomOut).toBeFocused();
  await zoomIn.focus();
  await expect(zoomIn).toBeFocused();

  await zoomIn.click();
  await expect(scale).not.toHaveText("۱۰۰٪");
  const zoomed = await surface.evaluate((element) => element.style.transform);
  expect(zoomed).toContain("scale(");

  const canvasBox = await diagram.locator(".mermaid-diagram-canvas").boundingBox();
  expect(canvasBox).not.toBeNull();
  await page.mouse.move(canvasBox!.x + 500, canvasBox!.y + 360);
  await page.mouse.down();
  await page.mouse.move(canvasBox!.x + 550, canvasBox!.y + 390, { steps: 4 });
  await page.mouse.up();
  await expect
    .poll(() => surface.evaluate((element) => element.style.transform))
    .not.toBe(zoomed);

  await fit.click();
  await expect(scale).toHaveText("۱۰۰٪");

  await diagram.evaluate((node) => {
    Object.defineProperty(node, "requestFullscreen", {
      configurable: true,
      value: async () => node.setAttribute("data-native-fullscreen-requested", "true"),
    });
  });
  await nativeFullscreen.click();
  await expect(diagram).toHaveAttribute("data-native-fullscreen-requested", "true");
  await expect(diagram).toHaveAttribute("data-mermaid-view", "graph-viewer");

  await activatePointerAction(
    diagram.getByRole("button", { name: "بازگشت به سند" }),
  );
  await expect(diagram).toHaveAttribute("data-mermaid-view", "inline");
  await expect(trigger).toBeFocused();
  await expect
    .poll(async () =>
      Math.abs(
        (await scrollRoot.evaluate((element) => element.scrollTop)) - scrollBefore,
      ),
    )
    .toBeLessThanOrEqual(2);
});

test("R10 uses touch-safe controls without horizontal overflow on mobile", async ({
  page,
}) => {
  await openReadingFixture(page, READING_FIXTURE, { width: 390, height: 844 });
  const { diagram } = await openGraphViewer(page);
  const geometry = await diagram.evaluate((node) => {
    const rect = (selector: string) => {
      const bounds = node.querySelector(selector)!.getBoundingClientRect();
      return {
        left: bounds.left,
        right: bounds.right,
        width: bounds.width,
        height: bounds.height,
      };
    };
    return {
      viewport: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      header: rect(".mermaid-graph-viewer-header"),
      returnButton: rect(".mermaid-graph-viewer-return"),
      preview: rect(".mermaid-graph-viewer-preview"),
      render: rect(".mermaid-graph-viewer-render"),
      toolbar: rect(".mermaid-diagram-viewport-tools"),
      tools: Array.from(
        node.querySelectorAll(".mermaid-diagram-viewport-tools button"),
        (button) => {
          const bounds = button.getBoundingClientRect();
          return { width: bounds.width, height: bounds.height };
        },
      ),
    };
  });

  expect(Math.round(geometry.header.height)).toBe(64);
  expect(Math.round(geometry.returnButton.width)).toBe(44);
  expect(Math.round(geometry.returnButton.height)).toBe(44);
  expect(Math.round(geometry.preview.width)).toBe(390);
  expect(Math.round(geometry.preview.height)).toBe(780);
  expect(Math.round(geometry.render.width)).toBe(366);
  expect(Math.round(geometry.render.height)).toBe(684);
  expect(Math.round(geometry.toolbar.width)).toBe(208);
  expect(Math.round(geometry.toolbar.height)).toBe(60);
  expect(geometry.tools).toEqual(
    Array.from({ length: 4 }, () => ({ width: 44, height: 44 })),
  );
  expect(geometry.preview.left).toBeGreaterThanOrEqual(0);
  expect(geometry.preview.right).toBeLessThanOrEqual(geometry.viewport);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewport);
});

test("R10 separates its toolbar and preview in a short landscape viewport", async ({
  page,
}) => {
  await openReadingFixture(page, READING_FIXTURE, { width: 667, height: 375 });
  const { diagram } = await openGraphViewer(page);
  const geometry = await diagram.evaluate((node) => {
    const bounds = (selector: string) => {
      const rect = node.querySelector(selector)!.getBoundingClientRect();
      return {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      };
    };
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      toolbar: bounds(".mermaid-diagram-viewport-tools"),
      preview: bounds(".mermaid-graph-viewer-preview"),
      render: bounds(".mermaid-graph-viewer-render"),
    };
  });

  expect(geometry.toolbar.bottom).toBeLessThanOrEqual(geometry.render.top - 12);
  expect(geometry.preview.left).toBeGreaterThanOrEqual(0);
  expect(geometry.preview.right).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.documentWidth).toBeLessThanOrEqual(geometry.viewportWidth);
});
