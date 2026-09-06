import { expect, test, type Page } from "@playwright/test";

async function openReading(page: Page, content: string) {
  await page.addInitScript((content) => {
    if (sessionStorage.getItem("reading-navigation-seeded")) return;
    sessionStorage.setItem("reading-navigation-seeded", "true");
    localStorage.clear();
    localStorage.setItem("raavi:document:v1", JSON.stringify({
      content, fileName: "navigation.md", readerSize: 18, annotations: [],
      assets: [], revision: 1, versions: [], documentType: "markdown",
      viewMode: "reading", draftId: "navigation-regression", readingPositions: {},
    }));
  }, content);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
}

test("reading search stays reachable beneath the header at desktop breakpoints", async ({ page }) => {
  await openReading(page, "# پیمایش\n\nمتن قابل جست‌وجو");
  const trigger = page.locator('[data-sidebar-destination="search"]:visible');
  for (const width of [821, 1024, 1180, 1240, 1536]) {
    await page.setViewportSize({ width, height: 858 });
    await expect.poll(() => trigger.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return button.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }), { message: `Search is covered at ${width}px` }).toBe(true);
    await trigger.click();
    const search = page.getByRole("searchbox", { name: "جست‌وجو در متن سند" });
    await expect(search).toBeFocused();
    await search.press("Escape");
    await expect(trigger).toBeFocused();
  }
});

for (const newline of ["\n", "\r\n"]) {
  test(`outline reaches late chunks and earlier headings with ${newline === "\n" ? "LF" : "CRLF"} source`, async ({ page }) => {
    await page.setViewportSize({ width: 1180, height: 858 });
    const content = Array.from({ length: 32 }, (_, index) => [
      `## فصل ${index + 1}`, "",
      ...Array.from({ length: 12 }, (_, paragraph) =>
        `بند ${paragraph + 1} از فصل ${index + 1}. ${"پیمایش باید جملهٔ مقصد را در دید نگه دارد. ".repeat(6)}\n`),
    ].join("\n")).join("\n").replaceAll("\n", newline);
    await openReading(page, content);
    await page.locator('[data-sidebar-destination="outline"]:visible').click();
    for (const chapter of [28, 12, 32, 1, 28]) {
      const label = `فصل ${chapter}`;
      await page.locator("#reading-document-outline-list .sidebar-row").filter({ has: page.locator(".sidebar-row-label", { hasText: new RegExp(`^${label}$`) }) }).click();
      const heading = page.locator('.workspace--reading .markdown-body h2').filter({ hasText: new RegExp(`^${label}$`) });
      await expect(heading).toBeFocused();
      await expect.poll(() => heading.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const header = document.querySelector(".reading-header-document")!.getBoundingClientRect();
        return box.top >= header.bottom && box.bottom <= innerHeight;
      })).toBe(true);
      // A late animation frame or media reflow must not undo the destination.
      await page.waitForTimeout(1600);
      await expect(heading).toBeInViewport();
      if (chapter === 28) {
        expect(await heading.evaluate(node => Number(node.closest<HTMLElement>("[data-source-start]")?.dataset.sourceStart))).toBeGreaterThan(0);
      }
    }
    await page.reload();
    await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
    const restoredHeading = page.locator(".workspace--reading h2").filter({ hasText: /^فصل 28$/ });
    await expect(restoredHeading).toBeInViewport();
    await page.waitForTimeout(1600);
    await expect(restoredHeading).toBeInViewport();
  });
}
