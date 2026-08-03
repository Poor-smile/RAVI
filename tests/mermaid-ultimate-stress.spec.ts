import { expect, test, type ElectronApplication, type Page } from "@playwright/test";
import { _electron as electron } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const EXPECTED_DIAGRAMS = 26;

type StressMetrics = {
  theme: "light" | "dark";
  totalMs: number;
  slowestMs: number;
  averageMs: number;
  peakMounted: number;
  settledMounted: number;
  heightDelta: number;
  maxEventLoopLag: number;
  longTasks: number;
  cacheBytes: number;
};

async function startResponsivenessProbe(page: Page) {
  await page.evaluate(() => {
    const target = window as unknown as Record<string, unknown>;
    const sample = {
      maxEventLoopLag: 0,
      longTasks: 0,
      expectedAt: performance.now() + 50,
    };
    const timer = window.setInterval(() => {
      const now = performance.now();
      sample.maxEventLoopLag = Math.max(0, sample.maxEventLoopLag, now - sample.expectedAt);
      sample.expectedAt = now + 50;
    }, 50);
    const observer = typeof PerformanceObserver === "undefined"
      ? null
      : new PerformanceObserver((list) => {
          sample.longTasks += list.getEntries().filter((entry) => entry.duration > 100).length;
        });
    try {
      observer?.observe({ entryTypes: ["longtask"] });
    } catch {
      // WebKit/WebView versions without Long Tasks still use the interval probe.
    }
    target.__RAAVI_STRESS_PROBE__ = { sample, timer, observer };
  });
}

async function finishResponsivenessProbe(page: Page) {
  return page.evaluate(() => {
    const target = window as unknown as Record<string, unknown>;
    const probe = target.__RAAVI_STRESS_PROBE__ as {
      sample: { maxEventLoopLag: number; longTasks: number };
      timer: number;
      observer: PerformanceObserver | null;
    };
    window.clearInterval(probe.timer);
    probe.observer?.disconnect();
    return probe.sample;
  });
}

async function verifyEveryDiagram(
  page: Page,
  theme: "light" | "dark",
  previousKeys: string[] = [],
) {
  const figures = page.locator(".mermaid-diagram");
  const article = page.locator(".markdown-body");
  const durations: number[] = [];
  const renderKeys: string[] = [];
  let peakMounted = 0;
  const startedAt = performance.now();

  await startResponsivenessProbe(page);
  for (let index = 0; index < EXPECTED_DIAGRAMS; index += 1) {
    const figure = figures.nth(index);
    const diagramStartedAt = performance.now();
    await figure.evaluate((element) => element.scrollIntoView({ block: "center" }));

    const fullRender = figure.getByRole("button", { name: "رندر کامل" });
    if (await fullRender.count()) await fullRender.click();

    const surface = figure.locator("img.mermaid-render-surface");
    if (previousKeys[index]) {
      await expect
        .poll(async () => {
          if ((await surface.count()) !== 1) return false;
          const key = await surface.getAttribute("data-mermaid-render-key");
          return Boolean(key && key !== previousKeys[index]);
        }, { timeout: 15_000 })
        .toBe(true);
    } else {
      await expect(surface, `diagram ${index + 1} in ${theme}`).toHaveCount(1, {
        timeout: 15_000,
      });
    }
    await expect
      .poll(() => surface.evaluate((image) => ({
        complete: image.complete,
        width: image.naturalWidth,
        height: image.naturalHeight,
      })))
      .toMatchObject({ complete: true });
    const dimensions = await surface.evaluate((image) => ({
      width: image.naturalWidth,
      height: image.naturalHeight,
      renderKey: image.dataset.mermaidRenderKey ?? "",
    }));
    expect(dimensions.width, `diagram ${index + 1} width`).toBeGreaterThan(0);
    expect(dimensions.height, `diagram ${index + 1} height`).toBeGreaterThan(0);

    let svg = "";
    for (let attempt = 0; attempt < 12 && !svg; attempt += 1) {
      svg = await surface.evaluate(async (image) => {
        try {
          const response = await fetch(image.src);
          return response.ok ? response.text() : "";
        } catch {
          return "";
        }
      });
      if (!svg) await page.waitForTimeout(50);
    }
    expect(svg).toContain("<svg");
    expect(svg).toMatch(/<title(?:\s|>)/u);
    expect(svg).not.toMatch(/<script|\son\w+\s*=|(?:href|src)=["']https?:\/\//iu);
    expect(await figure.locator(".mermaid-inline-error").count()).toBe(0);
    renderKeys.push(dimensions.renderKey);

    peakMounted = Math.max(
      peakMounted,
      await page.locator("img.mermaid-render-surface").count(),
    );
    durations.push(performance.now() - diagramStartedAt);
  }

  const renderedHeight = await article.evaluate((element) => element.getBoundingClientRect().height);
  await page.waitForTimeout(1_000);
  const settledMounted = await page.locator("img.mermaid-render-surface").count();
  const finalHeight = await article.evaluate((element) => element.getBoundingClientRect().height);
  const responsiveness = await finishResponsivenessProbe(page);
  const debug = await page.evaluate(() => {
    const value = (window as unknown as Record<string, unknown>).__RAAVI_MERMAID_DEBUG__ as
      | { cache?: { totalBytes?: number } }
      | undefined;
    return { cacheBytes: value?.cache?.totalBytes ?? 0 };
  });

  const metrics: StressMetrics = {
    theme,
    totalMs: performance.now() - startedAt,
    slowestMs: Math.max(...durations),
    averageMs: durations.reduce((sum, value) => sum + value, 0) / durations.length,
    peakMounted,
    settledMounted,
    heightDelta: Math.abs(finalHeight - renderedHeight),
    maxEventLoopLag: responsiveness.maxEventLoopLag,
    longTasks: responsiveness.longTasks,
    cacheBytes: debug.cacheBytes,
  };
  console.log(`[MERMAID_STRESS] ${JSON.stringify(metrics)}`);

  expect(metrics.settledMounted).toBeLessThanOrEqual(10);
  expect(metrics.heightDelta).toBeLessThanOrEqual(2);
  expect(metrics.cacheBytes).toBeLessThanOrEqual(28 * 1024 * 1024);
  return { metrics, renderKeys };
}

test("renders the ultimate Persian stress document in light and dark themes", async () => {
  test.skip(process.platform !== "win32", "The packaged desktop target is Windows.");
  test.setTimeout(360_000);
  const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const documentPath = path.join(projectRoot, "docs", "MERMAID_ULTIMATE_STRESS_TEST_FA.md");
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "raavi-mermaid-ultimate-"));
  let app: ElectronApplication | null = null;
  try {
    app = await electron.launch({
      cwd: projectRoot,
      args: [
        path.join(projectRoot, "desktop", "main.mjs"),
        `--user-data-dir=${path.join(temporaryRoot, "profile")}`,
        documentPath,
      ],
      timeout: 20_000,
    });
    const page = await app.firstWindow();
    const figures = page.locator(".mermaid-diagram");
    await expect(figures).toHaveCount(EXPECTED_DIAGRAMS, { timeout: 20_000 });
    expect(await page.locator(".markdown-body pre code.language-mermaid").count()).toBe(0);

    const themeToggle = page.locator(".theme-toggle");
    if ((await themeToggle.getAttribute("aria-label")) === "فعال‌کردن تم روشن") {
      await themeToggle.evaluate((button: HTMLButtonElement) => button.click());
    }
    await expect(themeToggle).toHaveAttribute("aria-label", "فعال‌کردن تم تاریک");
    const light = await verifyEveryDiagram(page, "light");

    const fullscreenFigure = figures.nth(1);
    await fullscreenFigure.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await fullscreenFigure
      .getByRole("button", { name: "نمایش تمام‌صفحهٔ نمودار" })
      .click();
    await page.waitForTimeout(1_200);
    await expect(fullscreenFigure.locator("img.mermaid-render-surface")).toHaveCount(1);
    await expect(fullscreenFigure.locator("img.mermaid-render-surface")).toBeVisible();
    await page.keyboard.press("Escape");

    await themeToggle.evaluate((button: HTMLButtonElement) => button.click());
    await expect(themeToggle).toHaveAttribute("aria-label", "فعال‌کردن تم روشن");
    await verifyEveryDiagram(page, "dark", light.renderKeys);
  } finally {
    await app?.close();
    await rm(temporaryRoot, { recursive: true, force: true });
  }
});
