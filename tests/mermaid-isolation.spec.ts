import { releaseElectron as electron } from "./helpers/release-electron";
import { expect, test, type Page } from "@playwright/test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { waitForRaaviWindow } from "./helpers/electron-main-window";
import type { MermaidRendererOutput } from "../app/mermaid/scheduler";

async function render(page: Page, id: string, code = 'flowchart LR\n A["آغاز"] --> B["پایان"]') {
  return page.evaluate(({ id, code }) => window.raaviMermaid!.render({
    id, code, theme: "light", documentId: "isolation", blockId: id,
    priority: "interactive", generation: 1,
    complexity: {} as never,
  }), { id, code });
}

test("Electron isolates Mermaid, terminates a synchronous hang and recovers after a crash", async () => {
  test.setTimeout(90_000);
  const root = fileURLToPath(new URL("..", import.meta.url));
  const profile = await mkdtemp(path.join(os.tmpdir(), "raavi-mermaid-isolation-"));
  const executablePath = process.env.RAAVI_TEST_EXECUTABLE;
  const app = await electron.launch({
    cwd: root,
    ...(executablePath ? { executablePath } : {}),
    args: [...(executablePath ? [] : [path.join(root, "desktop/main.mjs")]), `--user-data-dir=${profile}`],
  });
  try {
    expect(await app.evaluate(({ app }) => app.getPath("userData"))).toBe(profile);
    const page = await waitForRaaviWindow(app);
    const healthy = await render(page, "healthy");
    expect(healthy.ok, JSON.stringify(healthy)).toBe(true);
    if (healthy.ok) expect(healthy.svg).toContain("آغاز");
    const pids = await app.evaluate(({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      const host = windows.find((w) => w.webContents.getURL().endsWith("/mermaid-renderer"))!;
      const main = windows.find((w) => w.webContents.getURL().match(/^http:\/\/127\.0\.0\.1:\d+\/$/))!;
      return { host: host.webContents.getOSProcessId(), main: main.webContents.getOSProcessId() };
    });
    expect(pids.host).toBeGreaterThan(0);
    expect(pids.host).not.toBe(pids.main);
    const hostPage = app.windows().find((p) => p.url().endsWith("/mermaid-renderer"))!;
    expect(await hostPage.evaluate(() => typeof window.raaviDesktop)).toBe("undefined");
    expect(await hostPage.evaluate(() => typeof window.raaviMermaid)).toBe("undefined");
    const malformed = await render(page, "degenerate", "xychart\n x-axis 1 --> 1\n line [1, 2]");
    if (!malformed.ok) expect(malformed.error.kind).toBe("syntax");
    else expect(malformed.svg).toContain("<svg");

    // Inject a real synchronous stall only in the test renderer. No production
    // debug API or deliberately dangerous input is added to the application.
    await app.evaluate(({ BrowserWindow }) => {
      const host = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith("/mermaid-renderer"))!;
      void host.webContents.executeJavaScript("while (true) {}").catch(() => {});
    });
    await page.evaluate(() => {
      const target = window as unknown as { ticks: number; hung?: Promise<MermaidRendererOutput> };
      target.ticks = 0;
      const interval = setInterval(() => target.ticks++, 50);
      target.hung = window.raaviMermaid!.render({ id: "hung", code: "flowchart LR\nA-->B", theme: "light", documentId: "isolation", blockId: "hung", priority: "interactive", generation: 1, complexity: {} as never });
      void target.hung.finally(() => clearInterval(interval));
    });
    const hung = await page.evaluate(async () => (window as unknown as { hung: Promise<MermaidRendererOutput> }).hung);
    expect(hung.ok).toBe(false);
    if (!hung.ok) expect(hung.error.kind).toBe("timeout");
    expect(await page.evaluate(() => (window as unknown as { ticks: number }).ticks)).toBeGreaterThan(20);
    expect((await render(page, "after-timeout")).ok).toBe(true);
    await app.evaluate(({ BrowserWindow }) => {
      BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith("/mermaid-renderer"))!.webContents.forcefullyCrashRenderer();
    });
    await expect.poll(() => app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().filter((w) => w.webContents.getURL().endsWith("/mermaid-renderer")).length)).toBe(0);
    expect((await render(page, "after-crash")).ok).toBe(true);
    expect(await page.evaluate(() => window.raaviDesktop!.getLocalDocumentSnapshot())).toBeDefined();
  } finally {
    await app.close();
    await rm(profile, { recursive: true, force: true });
  }
});
