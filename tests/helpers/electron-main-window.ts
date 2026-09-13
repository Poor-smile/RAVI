import type { Page } from "@playwright/test";
import type { ElectronApplication } from "playwright";

const pause = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

export async function dismissFirstRunIfNeeded(page: Page) {
  const deadline = Date.now() + 6_000;
  const dialog = page.locator(".first-run-dialog");

  while (Date.now() < deadline) {
    if (await dialog.isVisible().catch(() => false)) {
      for (let step = 0; step < 3; step += 1) {
        const skip = page.getByRole("button", { name: "رد کردن", exact: true });
        const enter = page.getByRole("button", { name: "ورود به راوی", exact: true });
        await skip.or(enter).first().waitFor({ state: "visible", timeout: 5_000 });
        if (await enter.isVisible()) break;
        const heading = await dialog.locator("h1").textContent();
        await skip.click();
        await page.waitForFunction((previousHeading) => {
          const next = document.querySelector(".first-run-dialog h1");
          return next !== null && next.textContent !== previousHeading;
        }, heading, { timeout: 5_000 });
      }
      const enter = page.getByRole("button", { name: "ورود به راوی", exact: true });
      await enter.click({ timeout: 5_000 });
      await dialog.waitFor({ state: "detached", timeout: 5_000 });
      return;
    }
    await pause(100);
  }
}

export async function waitForRaaviWindow(
  app: ElectronApplication,
  timeout = 30_000,
) {
  const deadline = Date.now() + timeout;
  const observedUrls = new Set<string>();

  while (Date.now() < deadline) {
    for (const page of app.windows()) {
      try {
        if (page.isClosed()) continue;
        observedUrls.add(page.url().startsWith("data:") ? "data:startup-overlay" : page.url());
        // Read readiness only from the document route, not the startup overlay.
        if (!/^http:\/\/127\.0\.0\.1:\d+\/$/.test(page.url())) continue;
        const shell = page.locator('.app-shell[data-hydrated="true"]');
        await shell.waitFor({ state: "attached", timeout: Math.min(1_000, Math.max(1, deadline - Date.now())) });
        await dismissFirstRunIfNeeded(page);
        return page;
      } catch {
        // The startup WebContentsView is removed as soon as the renderer is ready.
      }
    }
    await pause(100);
  }

  throw new Error(
    `Raavi renderer did not become ready. Observed windows: ${[
      ...observedUrls,
    ].join(", ")}`,
  );
}
