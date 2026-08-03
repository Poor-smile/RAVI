import { chromium } from "playwright";

const endpoint = process.env.RAAVI_TAURI_CDP ?? "http://127.0.0.1:9333";
const expectedDiagrams = 26;

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const browser = await chromium.connectOverCDP(endpoint);
try {
  const pages = browser.contexts().flatMap((context) => context.pages());
  const page = pages.find((candidate) => !candidate.url().includes("raavi-mermaid-renderer"));
  invariant(page, "Main Tauri WebView was not found.");
  await page.waitForSelector(".mermaid-diagram", { timeout: 20_000 });
  const figures = page.locator(".mermaid-diagram");
  invariant(
    (await figures.count()) === expectedDiagrams,
    `Expected ${expectedDiagrams} document diagrams.`,
  );

  const memoryBefore = await page.evaluate(() =>
    "memory" in performance
      ? performance.memory.usedJSHeapSize
      : 0,
  );
  await page.evaluate(() => {
    const sample = { maxLag: 0, longTasks: 0, expectedAt: performance.now() + 50 };
    const timer = window.setInterval(() => {
      const now = performance.now();
      sample.maxLag = Math.max(sample.maxLag, now - sample.expectedAt);
      sample.expectedAt = now + 50;
    }, 50);
    const observer = new PerformanceObserver((list) => {
      sample.longTasks += list.getEntries().filter((entry) => entry.duration > 100).length;
    });
    try {
      observer.observe({ entryTypes: ["longtask"] });
    } catch {
      // The interval probe remains available on older WebView2 builds.
    }
    window.__RAAVI_TAURI_STRESS__ = { sample, timer, observer };
  });

  const timings = [];
  let peakMounted = 0;
  const article = page.locator(".markdown-body");
  for (let index = 0; index < expectedDiagrams; index += 1) {
    const startedAt = performance.now();
    const figure = figures.nth(index);
    await figure.evaluate((element) => element.scrollIntoView({ block: "center" }));
    const fullRender = figure.getByRole("button", { name: "رندر کامل" });
    if (await fullRender.count()) await fullRender.click();
    const surface = figure.locator("img.mermaid-render-surface");
    await surface.waitFor({ state: "attached", timeout: 15_000 });
    const result = await surface.evaluate(async (image) => {
      if (!image.complete) {
        await new Promise((resolve, reject) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", reject, { once: true });
        });
      }
      const svg = await fetch(image.src).then((response) => response.text());
      return {
        width: image.naturalWidth,
        height: image.naturalHeight,
        safe: !/<script|\son\w+\s*=|(?:href|src)=["']https?:\/\//iu.test(svg),
        titled: /<title(?:\s|>)/u.test(svg),
      };
    });
    invariant(result.width > 0 && result.height > 0, `Diagram ${index + 1} has no dimensions.`);
    invariant(result.safe, `Diagram ${index + 1} contains unsafe SVG.`);
    invariant(result.titled, `Diagram ${index + 1} has no accessible title.`);
    invariant(
      (await figure.locator(".mermaid-inline-error").count()) === 0,
      `Diagram ${index + 1} rendered an error.`,
    );
    peakMounted = Math.max(peakMounted, await page.locator("img.mermaid-render-surface").count());
    timings.push(performance.now() - startedAt);
  }

  const renderedHeight = await article.evaluate((element) => element.getBoundingClientRect().height);
  await page.waitForTimeout(1_000);
  const settledMounted = await page.locator("img.mermaid-render-surface").count();
  const finalHeight = await article.evaluate((element) => element.getBoundingClientRect().height);

  const targetFigure = figures.nth(1);
  await targetFigure.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await targetFigure.getByRole("button", { name: "نمایش تمام‌صفحهٔ نمودار" }).click();
  await page.waitForTimeout(1_000);
  invariant(
    (await targetFigure.locator("img.mermaid-render-surface").count()) === 1,
    "Fullscreen virtualization removed the diagram surface.",
  );
  const canvas = targetFigure.locator(".mermaid-diagram-canvas");
  const bounds = await canvas.boundingBox();
  invariant(bounds, "Fullscreen canvas has no bounds.");
  const frameProbe = page.evaluate(async () => {
    let frames = 0;
    let active = true;
    const startedAt = performance.now();
    const tick = () => {
      frames += 1;
      if (active) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    await new Promise((resolve) => window.setTimeout(resolve, 2_000));
    active = false;
    return { frames, duration: performance.now() - startedAt };
  });
  await page.mouse.move(bounds.x + bounds.width * 0.45, bounds.y + bounds.height * 0.45);
  await page.mouse.down();
  for (let index = 0; index < 120; index += 1) {
    await page.mouse.move(
      bounds.x + bounds.width * (0.35 + (index % 30) / 100),
      bounds.y + bounds.height * (0.35 + ((index * 3) % 30) / 100),
    );
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  const frames = await frameProbe;
  await page.keyboard.press("Escape");

  const probe = await page.evaluate(() => {
    const value = window.__RAAVI_TAURI_STRESS__;
    window.clearInterval(value.timer);
    value.observer.disconnect();
    return value.sample;
  });
  const memoryAfter = await page.evaluate(() =>
    "memory" in performance
      ? performance.memory.usedJSHeapSize
      : 0,
  );
  const debug = await page.evaluate(() => window.__RAAVI_MERMAID_DEBUG__ ?? null);
  const metrics = {
    diagrams: expectedDiagrams,
    averageRenderMs: timings.reduce((sum, value) => sum + value, 0) / timings.length,
    slowestRenderMs: Math.max(...timings),
    peakMounted,
    settledMounted,
    heightDelta: Math.abs(finalHeight - renderedHeight),
    maxEventLoopLagMs: probe.maxLag,
    longTasksOver100Ms: probe.longTasks,
    panZoomFps: (frames.frames * 1_000) / frames.duration,
    mainHeapDeltaBytes: Math.max(0, memoryAfter - memoryBefore),
    cacheBytes: debug?.cache?.totalBytes ?? 0,
    restarts: debug?.restartCount ?? 0,
  };
  console.log(`[TAURI_MERMAID_STRESS] ${JSON.stringify(metrics)}`);

  invariant(metrics.settledMounted <= 10, "Too many diagram surfaces remain mounted.");
  invariant(metrics.heightDelta <= 2, "Virtualization changed the document height.");
  invariant(metrics.maxEventLoopLagMs <= 100, "The main WebView event loop stalled over 100ms.");
  invariant(metrics.longTasksOver100Ms === 0, "The main WebView recorded a Mermaid long task.");
  invariant(metrics.panZoomFps >= 50, "Pan/zoom dropped below 50 FPS.");
  invariant(metrics.cacheBytes <= 28 * 1024 * 1024, "Mermaid cache exceeded 28 MiB.");
} finally {
  await browser.close();
}
