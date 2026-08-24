import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { _electron as electron } from "playwright";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

function diagramDocument(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return [
      `## نمودار ${number}`,
      "",
      "```mermaid",
      "flowchart LR",
      `  start${number}[\"شروع ${number}\"] --> review${number}{\"بازبینی ${number}\"}`,
      `  review${number} -->|بله| done${number}([\"پایان ${number}\"])`,
      `  review${number} -->|خیر| edit${number}[\"اصلاح ${number}\"]`,
      `  edit${number} --> review${number}`,
      "```",
      "",
      "متن نگه‌دارندهٔ ارتفاع سند برای آزمون پیوستگی پیمایش.",
      "",
    ].join("\n");
  }).join("\n");
}

async function launchDocument(
  projectRoot: string,
  userDataPath: string,
  documentPath: string,
): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({
    cwd: projectRoot,
    args: [
      path.join(projectRoot, "desktop", "main.mjs"),
      `--user-data-dir=${userDataPath}`,
      documentPath,
    ],
    timeout: 20_000,
  });
  return { app, page: await app.firstWindow() };
}

test.describe("Mermaid stability", () => {
  test.skip(process.platform !== "win32", "The packaged desktop target is Windows.");

  for (const diagramCount of [8, 20, 50]) {
    test(`virtualizes a document with ${diagramCount} diagrams without height jumps`, async () => {
      test.slow();
      const projectRoot = path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
      );
      const temporaryRoot = await mkdtemp(
        path.join(os.tmpdir(), `raavi-mermaid-${diagramCount}-`),
      );
      const documentPath = path.join(
        temporaryRoot,
        `سند-${diagramCount}-نمودار.md`,
      );
      await writeFile(documentPath, diagramDocument(diagramCount), "utf8");
      let app: ElectronApplication | null = null;
      try {
        const launchedAt = performance.now();
        const launched = await launchDocument(
          projectRoot,
          path.join(temporaryRoot, "profile"),
          documentPath,
        );
        app = launched.app;
        const page = launched.page;
        const figures = page.locator(".mermaid-diagram");
        await expect(figures).toHaveCount(diagramCount, { timeout: 20_000 });
        // Wait until every lazy Mermaid component has replaced its Suspense
        // fallback. The fallback intentionally has no caption and is therefore
        // not a valid baseline for document-height stability.
        await expect(
          page.locator(".mermaid-diagram[data-mermaid-block-id]"),
        ).toHaveCount(diagramCount, { timeout: 20_000 });
        const article = page.locator(".markdown-body");
        const initialHeight = await article.evaluate(
          (element) => element.getBoundingClientRect().height,
        );
        const initialSurfaceCount = await page
          .locator("img.mermaid-render-surface")
          .count();
        expect(initialSurfaceCount).toBeLessThan(diagramCount);
        expect(
          await page.locator(".mermaid-render-surface svg").count(),
        ).toBe(0);

        // Markdown reconciliation can replace a figure while the document is
        // being virtualized. Scroll the currently attached node directly and
        // reacquire the locator before asserting the rendered surface.
        await figures.nth(diagramCount - 1).evaluate((element) =>
          element.scrollIntoView({ block: "center" }),
        );
        const lastFigure = page.locator(".mermaid-diagram").nth(diagramCount - 1);
        await expect(lastFigure.locator("img.mermaid-render-surface")).toHaveCount(
          1,
          { timeout: 20_000 },
        );
        await page.waitForTimeout(1_000);
        const finalSurfaceCount = await page
          .locator("img.mermaid-render-surface")
          .count();
        const finalHeight = await article.evaluate(
          (element) => element.getBoundingClientRect().height,
        );

        expect(finalSurfaceCount).toBeLessThanOrEqual(10);
        expect(Math.abs(finalHeight - initialHeight)).toBeLessThanOrEqual(2);
        expect(performance.now() - launchedAt).toBeLessThan(30_000);
      } finally {
        await app?.close();
        await rm(temporaryRoot, { recursive: true, force: true });
      }
    });
  }

  test("restores the reading position after closing Mermaid fullscreen", async () => {
    test.slow();
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const temporaryRoot = await mkdtemp(
      path.join(os.tmpdir(), "raavi-mermaid-fullscreen-"),
    );
    const documentPath = path.join(temporaryRoot, "سند-تمام-صفحه.md");
    await writeFile(documentPath, diagramDocument(12), "utf8");
    let app: ElectronApplication | null = null;

    try {
      const launched = await launchDocument(
        projectRoot,
        path.join(temporaryRoot, "profile"),
        documentPath,
      );
      app = launched.app;
      const page = launched.page;
      await expect(page.locator(".mermaid-diagram")).toHaveCount(12, {
        timeout: 20_000,
      });
      const appShell = page.locator(".app-shell");
      if (!((await appShell.getAttribute("class")) ?? "").includes("is-reading")) {
        await page.locator(".topbar-action--reading").click();
      }
      await expect(appShell).toHaveClass(/is-reading/u);

      const target = page.locator(".mermaid-diagram").nth(10);
      await expect(target).toHaveAttribute("data-mermaid-block-id", /.+/u, {
        timeout: 20_000,
      });
      await target.evaluate((element) =>
        element.scrollIntoView({ block: "center" }),
      );
      const openFullscreen = target.getByRole("button", {
        name: "نمایش تمام‌صفحهٔ نمودار",
        exact: true,
      });
      await expect(openFullscreen).toBeVisible({ timeout: 20_000 });
      await openFullscreen.evaluate((element) =>
        element.scrollIntoView({ block: "nearest" }),
      );
      const workspace = page.locator(".workspace");
      const readingTop = await workspace.evaluate((element) => element.scrollTop);
      expect(readingTop).toBeGreaterThan(100);

      await openFullscreen.click();
      const detailedDiagram = page.locator(
        ".mermaid-diagram:fullscreen, .mermaid-diagram.is-detail-open",
      );
      await expect(detailedDiagram).toBeVisible();
      await detailedDiagram
        .getByRole("button", {
          name: "بازگشت به سند",
          exact: true,
        })
        .click();
      await expect(detailedDiagram).toBeHidden();

      await expect
        .poll(async () => workspace.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(readingTop * 0.5);

      await openFullscreen.evaluate((element) =>
        element.scrollIntoView({ block: "nearest" }),
      );
      const escapeReadingTop = await workspace.evaluate((element) => element.scrollTop);
      expect(escapeReadingTop).toBeGreaterThan(100);
      await openFullscreen.click();
      await expect(detailedDiagram).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(detailedDiagram).toBeHidden();
      await expect
        .poll(async () => workspace.evaluate((element) => element.scrollTop))
        .toBeGreaterThan(escapeReadingTop * 0.5);
    } finally {
      await app?.close();
      await rm(temporaryRoot, { recursive: true, force: true });
    }
  });
});
