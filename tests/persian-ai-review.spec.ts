import { expect, test } from "@playwright/test";

const FIXTURE = [
  "# گزارش فروش",
  "اين يك متن است که باید روشن‌تر نوشته شود.",
  "اصطلاح AI و هوش مصنوعی در این سند یک معنی دارند.",
].join("\n\n");

test("advanced Persian review stays in the existing panel and applies validated suggestions", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript((content) => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        fileName: "بازبینی هوشمند.md",
        content,
        readerSize: 18,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        activeDocumentPath: "C:\\Raavi\\بازبینی هوشمند.md",
        documentType: "markdown",
        lastSavedSnapshot: content,
        draftId: "persian-ai-review",
        viewMode: "desk",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, FIXTURE);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.evaluate(() => {
    Object.defineProperty(window, "raaviDesktop", {
      configurable: true,
      value: {
        getCodexConnectionStatus: async () => ({ state: "connected" }),
        runCodexPersianReview: async () => ({
          summary: "۲ پیشنهاد هوشمند · ۱ نیازمند توجه",
          suggestions: [
            {
              category: "وضوح",
              reason: "عبارت می‌تواند مستقیم‌تر باشد.",
              current: "اين يك متن است که باید روشن‌تر نوشته شود.",
              replacement: "این متن باید روشن‌تر نوشته شود.",
              occurrence: 1,
            },
            {
              category: "یکدستی اصطلاحات",
              reason: "دو اصطلاح برای یک مفهوم آمده است.",
              current: "اصطلاح AI و هوش مصنوعی در این سند یک معنی دارند.",
              replacement: "اصطلاح هوش مصنوعی (AI) در این سند یک معنی دارد.",
              occurrence: 1,
            },
          ],
        }),
        runCodexPrompt: async () => ({ answer: "", replacement: null }),
      },
    });
  });

  await page.getByRole("button", { name: "اصلاحات فارسی", exact: true }).click();
  const panel = page.locator("#persian-corrections-panel");
  await panel.getByRole("button", { name: "بررسی با هوش مصنوعی" }).click();
  await expect(panel).toContainText("کل سند بررسی شود؟");
  await expect(panel).toContainText("مصرف تقریبی کم");
  await panel.getByRole("button", { name: "شروع بررسی" }).click();

  await expect(panel.locator(".persian-ai-suggestion-card")).toHaveCount(2);
  await expect(panel.locator(".persian-ai-badge .magic-wand-icon")).toHaveCount(2);
  await expect(panel).toContainText("۲ پیشنهاد هوشمند");
  await expect
    .poll(() =>
      panel.locator(".persian-ai-suggestion-card").first().evaluate(
        (node) => getComputedStyle(node).backgroundImage,
      ),
    )
    .toContain("linear-gradient");
  await page.screenshot({
    path: ".artifacts/persian-ai-review-light.png",
    fullPage: true,
  });

  const appliedCard = panel.locator(".persian-ai-suggestion-card").first();
  await appliedCard.getByRole("button", { name: /اعمال/ }).click();
  await expect(appliedCard).toHaveClass(/is-exiting-applied/);
  await expect(panel.locator(".persian-ai-suggestion-card")).toHaveCount(1);
  await expect(panel).toContainText("پیشنهاد اعمال و نسخهٔ پیش از تغییر ذخیره شد");
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await expect(page.locator("#markdown-editor .cm-content")).toContainText(
    "این متن باید روشن‌تر نوشته شود.",
  );
});

test("advanced Persian suggestions remain readable in dark theme and keyboard order", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript((content) => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "dark");
    window.localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        fileName: "بازبینی تاریک.md",
        content,
        readerSize: 18,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        activeDocumentPath: "C:\\Raavi\\بازبینی تاریک.md",
        documentType: "markdown",
        lastSavedSnapshot: content,
        draftId: "persian-ai-review-dark",
        viewMode: "desk",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, FIXTURE);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.evaluate(() => {
    Object.defineProperty(window, "raaviDesktop", {
      configurable: true,
      value: {
        getCodexConnectionStatus: async () => ({ state: "connected" }),
        runCodexPersianReview: async () => ({
          summary: "۱ پیشنهاد هوشمند",
          suggestions: [
            {
              category: "وضوح",
              reason: "عبارت مستقیم‌تر می‌شود.",
              current: "اين يك متن است که باید روشن‌تر نوشته شود.",
              replacement: "این متن باید روشن‌تر نوشته شود.",
              occurrence: 1,
            },
          ],
        }),
      },
    });
  });
  await page.getByRole("button", { name: "اصلاحات فارسی", exact: true }).click();
  const panel = page.locator("#persian-corrections-panel");
  await panel.getByRole("button", { name: "بررسی با هوش مصنوعی" }).click();
  await expect(panel).toContainText("کل سند بررسی شود؟");
  await panel.getByRole("button", { name: "شروع بررسی" }).click();
  const card = panel.locator(".persian-ai-suggestion-card");
  await expect(card).toBeVisible();
  const reject = card.getByRole("button", { name: /رد/ });
  await reject.focus();
  await page.keyboard.press("Tab");
  await expect(card.getByRole("button", { name: "بازنویسی" })).toBeFocused();
  await page.screenshot({
    path: ".artifacts/persian-ai-review-dark.png",
    fullPage: true,
  });
});

test("a document review keeps running while another tab is active", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript((content) => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        fileName: "بازبینی ماندگار.md",
        content,
        readerSize: 18,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        activeDocumentPath: "C:\\Raavi\\بازبینی ماندگار.md",
        documentType: "markdown",
        lastSavedSnapshot: content,
        draftId: "persian-ai-review-persistent",
        viewMode: "desk",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, FIXTURE);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.evaluate(() => {
    Object.defineProperty(window, "raaviDesktop", {
      configurable: true,
      value: {
        getCodexConnectionStatus: async () => ({ state: "connected" }),
        runCodexPersianReview: async () => {
          await new Promise((resolve) => window.setTimeout(resolve, 450));
          return {
            summary: "۱ پیشنهاد هوشمند",
            suggestions: [
              {
                category: "وضوح",
                reason: "عبارت مستقیم‌تر می‌شود.",
                current: "اين يك متن است که باید روشن‌تر نوشته شود.",
                replacement: "این متن باید روشن‌تر نوشته شود.",
                occurrence: 1,
              },
            ],
          };
        },
      },
    });
  });

  await page.getByRole("button", { name: "اصلاحات فارسی", exact: true }).click();
  let panel = page.locator("#persian-corrections-panel");
  await panel.getByRole("button", { name: "بررسی با هوش مصنوعی" }).click();
  await panel.getByRole("button", { name: "شروع بررسی" }).click();
  await expect(panel).toContainText("در حال بررسی سند");

  await page.locator(".document-tabs__new").click();
  await expect(page.getByRole("tab", { name: "تب جدید", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.waitForTimeout(650);

  await page.getByRole("tab", { name: /^بازبینی ماندگار\.md/ }).click();
  await page.getByRole("button", { name: "اصلاحات فارسی", exact: true }).click();
  panel = page.locator("#persian-corrections-panel");
  await expect(panel.locator(".persian-ai-suggestion-card")).toHaveCount(1);
  await expect(panel).toContainText("۱ پیشنهاد هوشمند");
});
