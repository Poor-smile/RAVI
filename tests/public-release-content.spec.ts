import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

async function openDocument(page: import("@playwright/test").Page, markdown: string) {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.locator('input[type="file"][accept*=".md"]:not([multiple])').first().setInputFiles({
    name: "public-release-audit.md", mimeType: "text/markdown", buffer: Buffer.from(markdown),
  });
  await expect(page.getByRole("region", { name: "پیش‌نمایش Markdown" })).toBeVisible();
}

test("untrusted Markdown cannot execute scripts or emit executable links", async ({ page }) => {
  await openDocument(page, [
    "# ممیزی محتوای ورودی", "",
    '<script>window.__raaviAuditXss = true</script>',
    '<img src="x" onerror="window.__raaviAuditXss = true">',
    '<svg onload="window.__raaviAuditXss = true"></svg>', "",
    "[اجرای ناامن](javascript:alert(document.domain))", "",
    '![تصویر](data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>)',
  ].join("\n"));
  const preview = page.getByRole("region", { name: "پیش‌نمایش Markdown" });
  expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__raaviAuditXss)).toBeUndefined();
  await expect(preview.locator("script, [onerror], [onload], iframe, object, embed")).toHaveCount(0);
  expect(await preview.locator("a").evaluateAll((links) =>
    links.some((link) => /^(?:javascript|vbscript|data):/i.test(link.getAttribute("href") ?? "")),
  )).toBe(false);
});

test("reading workspace has no serious or critical automated WCAG violations", async ({ page }, testInfo) => {
  await openDocument(page, "# سند دسترس‌پذیر\n\nمتن فارسی برای آزمون خواندن.\n\n## بخش دوم\n\nمتن English در سند فارسی.");
  await page.addScriptTag({ content: await readFile(require.resolve("axe-core/axe.min.js"), "utf8") });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (context: unknown, options: unknown) => Promise<{ violations: Array<{ id: string; impact: string; nodes: unknown[] }> }> } }).axe;
    return (await axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations;
  });
  await testInfo.attach("wcag-violations", { body: JSON.stringify(violations, null, 2), contentType: "application/json" });
  expect(violations.filter((violation) => ["serious", "critical"].includes(violation.impact)), JSON.stringify(violations)).toEqual([]);
});
