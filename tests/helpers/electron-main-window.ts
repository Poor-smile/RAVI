import type { Page } from "@playwright/test";
import type { ElectronApplication } from "playwright";

const pause = (milliseconds: number) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function dismissFirstRunIfNeeded(page: Page) {
  const deadline = Date.now() + 6_000;
  const dialog = page.locator(".first-run-dialog");

  while (Date.now() < deadline) {
    if (await dialog.isVisible().catch(() => false)) {
      for (let step = 0; step < 3; step += 1) {
        const skip = page.getByRole("button", { name: "رد کردن", exact: true });
        if (!(await skip.isVisible().catch(() => false))) break;
        await skip.click();
      }
      const enter = page.getByRole("button", { name: "ورود به راوی", exact: true });
      if (await enter.isVisible().catch(() => false)) await enter.click();
      await dialog.waitFor({ state: "detached", timeout: 5_000 }).catch(() => {});
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
        observedUrls.add(page.url());
        const shell = page.locator('.app-shell[data-hydrated="true"]');
        if ((await shell.count()) === 0) continue;
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
