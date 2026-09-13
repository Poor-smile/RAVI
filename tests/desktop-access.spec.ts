import { Buffer } from "node:buffer";
import { devices, expect, test } from "@playwright/test";

const clients = [
  { name: "iPhone", ...devices["iPhone 13"] },
  { name: "Android phone", ...devices["Pixel 7"] },
  { name: "iPad", ...devices["iPad Pro 11"] },
  { name: "Android tablet", ...devices["Galaxy Tab S4"] },
  { name: "iPad desktop mode", userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15", viewport: { width: 1366, height: 1024 }, isMobile: true, hasTouch: true, platform: "MacIntel" },
];

for (const client of clients) {
  for (const theme of ["light", "dark"] as const) {
    test(`${client.name}: desktop-only notice in ${theme}, no editor or document mutation`, async ({ browser }, info) => {
      const options = { ...client };
      const context = await browser.newContext({ ...options, colorScheme: theme });
      await context.addInitScript(({ theme, platform }) => {
        localStorage.setItem("raavi:theme:v1", theme);
        localStorage.setItem("raavi:pane-layout:v1", '{"mode":"split","previewPercent":42}');
        if (platform) Object.defineProperty(navigator, "platform", { get: () => platform });
      }, { theme, platform: "platform" in client ? client.platform : undefined });
      const page = await context.newPage();
      const errors: string[] = [];
      const editorRequests: string[] = [];
      page.on("pageerror", error => errors.push(error.message));
      page.on("request", request => {
        if (/markdown-code-editor-[^/]+\.js|\/api\//.test(request.url())) editorRequests.push(request.url());
      });
      await page.goto("/");
      await expect(page.locator('[data-device-access="mobile"]')).toBeVisible();
      await expect(page.getByRole("heading", { name: "راوی یک نرم‌افزار دسکتاپ است" })).toBeVisible();
      await expect(page.getByText("برای استفاده از راوی، همین نشانی را در مرورگر رایانه یا لپ‌تاپ خود باز کنید.")).toBeVisible();
      await expect(page.locator(".app-shell, #markdown-editor, input[type=file], .mobile-tabs")).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => document.fonts.status)).toBe("loaded");
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.evaluate(() => localStorage.getItem("raavi:pane-layout:v1"))).toBe('{"mode":"split","previewPercent":42}');
      await page.screenshot({ path: info.outputPath("desktop-notice.png"), animations: "disabled" });
      await page.setViewportSize({ width: 1440, height: 900 });
      await expect(page.locator('[data-device-access="mobile"]')).toBeVisible();
      await page.reload();
      await expect(page.locator('[data-device-access="mobile"]')).toBeVisible();
      expect(editorRequests).toEqual([]);
      expect(errors).toEqual([]);
      await context.close();
    });
  }
}

test("desktop keeps its document and split layout when narrowed; touch alone is allowed", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true });
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.locator('input[type=file][accept*=".md"]').first().setInputFiles({ name: "رایانه.md", mimeType: "text/markdown", buffer: Buffer.from("# سند دسکتاپ\n\nاین متن باید حفظ شود.") });
  await page.getByRole("button", { name: "بازگشت به میز", exact: true }).click();
  await page.locator('[data-command-id="view.editor.proof"]').first().click();
  const screen = await page.locator(".workspace").getAttribute("data-workspace-screen");
  for (const width of [600, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(page.locator(".app-shell")).toBeVisible();
    await expect(page.locator(".workspace")).toHaveAttribute("data-workspace-screen", screen!);
    await expect(page.locator("#markdown-editor .cm-content")).toContainText("این متن باید حفظ شود.");
    await expect(page.locator('[data-device-access="mobile"], .mobile-tabs, .overflow-mobile-only')).toHaveCount(0);
    expect(await page.locator(".app-shell").evaluate(el => el.getBoundingClientRect().width)).toBeGreaterThanOrEqual(1024);
  }
  await context.close();
});
