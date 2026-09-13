import { expect, test } from "@playwright/test";

async function openConnectionStep(page: import("@playwright/test").Page, loaded = false) {
  if (!loaded) await page.goto("/?onboarding=1&onboardingChatGPT=cli_missing");
  const vault = page.getByRole("dialog", { name: "پوشهٔ مخزن را انتخاب کنید" });
  await vault.getByRole("button", { name: "رد کردن", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "راوی را به ChatGPT متصل کنید" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("one action installs and logs in, shows retry progress, and detects login without a restart", async ({ page }) => {
  await page.goto("/?onboarding=1&onboardingChatGPT=cli_missing");
  await expect(page.getByRole("dialog", { name: "پوشهٔ مخزن را انتخاب کنید" })).toBeVisible();
  await page.evaluate(() => {
    const fixture = { attempts: 0, connected: false, release: () => {} };
    Object.assign(window, { connectionFixture: fixture });
    let listener: ((value: { phase: string; percent?: number }) => void) | undefined;
    window.raaviDesktop = {
      getCodexConnectionStatus: async () => ({ state: fixture.connected ? "connected" : "auth_required" }),
      getCodexSetupProgress: async () => ({ phase: "idle" }),
      onCodexSetupProgress: (callback: typeof listener) => { listener = callback; return () => { listener = undefined; }; },
      connectCodex: async () => {
        fixture.attempts++;
        listener?.({ phase: "downloading", percent: 40 });
        await new Promise<void>(resolve => { fixture.release = resolve; });
        if (fixture.attempts === 1) return { started: false, state: "connection_error", code: "CODEX_DOWNLOAD_FAILED" };
        return { started: true, state: "auth_waiting" };
      },
    } as unknown as typeof window.raaviDesktop;
  });
  const dialog = await openConnectionStep(page, true);
  await expect(dialog).not.toContainText("npm");
  await expect(dialog).not.toContainText("PowerShell");
  await dialog.getByRole("button", { name: "اتصال به ChatGPT", exact: true }).click();
  await expect(dialog.getByRole("progressbar")).toHaveAttribute("value", "40");
  await expect(dialog.getByRole("button", { name: "در حال آماده‌سازی…" })).toBeDisabled();
  const release = () => page.evaluate(() => (window as unknown as { connectionFixture: { release: () => void } }).connectionFixture.release());
  await release();
  await dialog.getByRole("button", { name: "تلاش دوباره", exact: true }).click();
  await expect(dialog.getByRole("progressbar")).toBeVisible();
  await release();
  await expect(dialog.getByRole("button", { name: "ادامهٔ ورود" })).toBeVisible();
  await page.evaluate(() => { (window as unknown as { connectionFixture: { connected: boolean } }).connectionFixture.connected = true; });
  await expect(dialog.getByRole("button", { name: "متصل شد", exact: true })).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByRole("button", { name: "متصل شد", exact: true })).toBeDisabled();
  expect(await page.evaluate(() => (window as unknown as { connectionFixture: { attempts: number } }).connectionFixture.attempts)).toBe(2);
});

test("one connection action remains keyboard accessible at narrow desktop width", async ({ page }) => {
  await page.setViewportSize({ width: 760, height: 900 });
  const dialog = await openConnectionStep(page);
  const button = dialog.getByRole("button", { name: "اتصال به ChatGPT", exact: true });
  await button.focus();
  await expect(button).toBeFocused();
  const geometry = await button.evaluate(element => ({ height: element.getBoundingClientRect().height, overflow: element.scrollWidth - element.clientWidth }));
  expect(geometry.height).toBeGreaterThanOrEqual(48);
  expect(geometry.overflow).toBeLessThanOrEqual(0);
  expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0);
});
