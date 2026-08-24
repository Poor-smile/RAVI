import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { expect, test } from "@playwright/test";

const stressFixturePath = process.env.RAAVI_STRESS_FIXTURE;

test("R10 fills the Graph Viewer canvas with the supplied Mermaid stress document", async ({
  page,
}) => {
  test.setTimeout(180_000);
  test.skip(
    !stressFixturePath || !existsSync(stressFixturePath),
    "Set RAAVI_STRESS_FIXTURE to the supplied Markdown stress document.",
  );
  const content = readFileSync(stressFixturePath!, "utf8");
  const fileName = basename(stressFixturePath!);
  await page.setViewportSize({ width: 1917, height: 1078 });
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  await page.addInitScript(
    ({ markdown, name }) => {
      localStorage.clear();
      localStorage.setItem("raavi:theme:v1", "dark");
      localStorage.setItem(
        "raavi:document:v1",
        JSON.stringify({
          fileName: name,
          content: markdown,
          readerSize: 18,
          annotations: [],
          assets: [],
          revision: 1,
          versions: [],
          documentType: "ravi",
          lastSavedSnapshot: markdown,
          draftId: "r10-user-mermaid-stress",
          viewMode: "reading",
          readingOutlineOpen: false,
          readingPositions: {},
          annotationComposer: null,
        }),
      );
    },
    { markdown: content, name: fileName },
  );
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");

  const firstDiagram = page.locator(".mermaid-diagram.is-reading").first();
  await firstDiagram.scrollIntoViewIfNeeded();
  const blockId = await firstDiagram.getAttribute("data-mermaid-block-id");
  expect(blockId).toBeTruthy();
  const diagram = page.locator(
    `.mermaid-diagram.is-reading[data-mermaid-block-id="${blockId}"]`,
  );
  const surface = diagram.locator(".mermaid-render-surface");
  await diagram.getByRole("button", { name: "نمایش تمام‌صفحهٔ نمودار" }).click();
  await expect(diagram).toHaveAttribute("data-mermaid-view", "graph-viewer");
  await expect(surface).toHaveAttribute("src", /^blob:/u, { timeout: 120_000 });

  const svgDiagnostics = await surface.evaluate(async (image) => {
    const response = await fetch((image as HTMLImageElement).src);
    const source = await response.text();
    const parsed = new DOMParser().parseFromString(source, "image/svg+xml");
    const svg = parsed.documentElement as unknown as SVGSVGElement;
    const host = document.createElement("div");
    host.style.cssText =
      "position:fixed;left:-100000px;top:0;visibility:hidden;width:10000px;height:10000px;overflow:visible";
    const mounted = document.importNode(svg, true) as SVGSVGElement;
    mounted.style.maxWidth = "none";
    mounted.style.width = "auto";
    mounted.style.height = "auto";
    host.append(mounted);
    document.body.append(host);
    const viewBox = mounted.viewBox.baseVal;
    const content = mounted.querySelector<SVGGraphicsElement>("g.output, svg > g, g");
    const bounds = (content ?? mounted).getBBox();
    const diagnostics = {
      viewBox: { x: viewBox.x, y: viewBox.y, width: viewBox.width, height: viewBox.height },
      bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height },
      hasArchitectureRegions: [
        "Clients",
        "Edge & Security",
        "Application Platform",
        "Data Plane",
        "Observability & Operations",
      ].every((label) => parsed.documentElement.textContent?.includes(label)),
    };
    host.remove();
    return diagnostics;
  });

  const geometry = await diagram.evaluate((node) => {
    const rect = (selector: string) => {
      const bounds = node.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      return {
        x: bounds.x,
        y: bounds.y,
        right: bounds.right,
        bottom: bounds.bottom,
        width: bounds.width,
        height: bounds.height,
      };
    };
    return {
      canvas: rect(".mermaid-diagram-canvas"),
      render: rect(".mermaid-graph-viewer-render"),
      surface: rect(".mermaid-render-surface"),
    };
  });
  expect(geometry.render.width).toBeGreaterThan(geometry.canvas.width * 0.88);
  expect(geometry.render.height).toBeGreaterThan(geometry.canvas.height * 0.8);
  expect(geometry.surface.height).toBeGreaterThan(geometry.render.height * 0.85);
  expect(geometry.surface.x).toBeGreaterThanOrEqual(geometry.render.x + 20);
  expect(geometry.surface.y).toBeGreaterThanOrEqual(geometry.render.y + 20);
  expect(geometry.surface.right).toBeLessThanOrEqual(geometry.render.right - 20);
  expect(geometry.surface.bottom).toBeLessThanOrEqual(geometry.render.bottom - 20);
  expect(svgDiagnostics.hasArchitectureRegions).toBe(true);
  expect(svgDiagnostics.bounds.x).toBeGreaterThanOrEqual(svgDiagnostics.viewBox.x - 1);
  expect(svgDiagnostics.bounds.y).toBeGreaterThanOrEqual(svgDiagnostics.viewBox.y - 1);
  expect(svgDiagnostics.bounds.x + svgDiagnostics.bounds.width).toBeLessThanOrEqual(
    svgDiagnostics.viewBox.x + svgDiagnostics.viewBox.width + 1,
  );
  expect(svgDiagnostics.bounds.y + svgDiagnostics.bounds.height).toBeLessThanOrEqual(
    svgDiagnostics.viewBox.y + svgDiagnostics.viewBox.height + 1,
  );
  await expect(diagram.locator(".mermaid-graph-viewer-meta")).toHaveCount(0);
  await expect(diagram.locator(".mermaid-graph-viewer-native-fullscreen")).toHaveCount(0);

  await page.screenshot({
    path: ".artifacts/r10-user-mermaid-stress-fullscreen.png",
    fullPage: true,
  });
});
