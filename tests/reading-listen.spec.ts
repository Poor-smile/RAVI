import { expect, test } from "@playwright/test";

const DOCUMENT = [
  "# روایت فردا",
  "",
  "پاراگراف نخست برای شنیدن از ابتدای سند است. جملهٔ دوم همین بند است.",
  "",
  "پاراگراف دوم باید با کلید پایین در دسترس باشد.",
  "",
  "```js",
  "const rawSourceMustNotBeRead = true;",
  "```",
].join("\n");

test("local reading narration starts at the beginning and exposes paragraph controls", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript((content) => {
    localStorage.clear();
    localStorage.setItem("raavi:document:v1", JSON.stringify({
      fileName: "روایت-فردا.md",
      content,
      readerSize: 18,
      annotations: [],
      assets: [],
      revision: 1,
      versions: [],
      activeDocumentPath: "C:\\Raavi\\روایت-فردا.md",
      documentType: "markdown",
      lastSavedSnapshot: content,
      draftId: "reading-listen",
      viewMode: "writing",
      readingOutlineOpen: false,
      readingPositions: {},
      annotationComposer: null,
    }));
  }, DOCUMENT);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.evaluate(() => {
    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: class MockAudio extends EventTarget {
        playbackRate = 1;
        constructor(public src = "") { super(); }
        async play() {}
        pause() {}
        load() {}
        removeAttribute(name: string) { if (name === "src") this.src = ""; }
      },
    });
    (window as unknown as { raaviTtsCalls: string[] }).raaviTtsCalls = [];
    (window as unknown as { raaviDesktop: unknown }).raaviDesktop = {
      isDesktop: true,
      getTtsModelState: async () => ({
        supported: true,
        activeEngine: "mana",
        installState: "idle",
        installEngine: null,
        installComponent: null,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        error: "",
        engines: [{
          id: "mana",
          label: "مانا / Piper",
          description: "سبک و سریع",
          downloadBytes: 153647797,
          requiredDownloadBytes: 0,
          sizeBreakdown: { primaryModelBytes: 63531379, supportFilesBytes: 7088, runtimeBytes: 62381031, sharedPythonBytes: 27728299 },
          installed: true,
          selected: true,
          version: "2025-02-14",
          license: "MIT",
          verification: "verified",
          checksum: "e390c0e74ba71fd97c49ba662ee0c6e1724b462ba2d4561698af4f564840f126",
        }],
      }),
      synthesizeTts: async ({ text }: { text: string }) => {
        (window as unknown as { raaviTtsCalls: string[] }).raaviTtsCalls.push(text);
        return { engine: "mana", source: "mock://audio", cached: false };
      },
      cancelTts: async () => ({ cancelled: true }),
    };
  });

  await page.keyboard.press("F9");
  await expect(page.locator(".app-shell")).toHaveClass(/is-reading/u);
  const trigger = page.locator(".reading-listen-trigger");
  await expect(trigger).toBeVisible();
  await trigger.click();

  const toolbar = page.getByRole("region", { name: "کنترل شنیدن متن" });
  await expect(toolbar).toBeVisible();
  await expect(toolbar).toContainText("مانا / Piper");
  await expect(toolbar).toContainText("خوانش محلی آماده است");
  await expect(toolbar.getByRole("button", { name: "شروع خواندن" })).toBeVisible();
  await expect(trigger).toHaveClass(/is-active/u);
  await expect(page.locator(".reading-narration-highlight").first()).toBeVisible();
  await expect(page.locator(".is-reading-aloud")).toContainText("روایت فردا");
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as { raaviTtsCalls: string[] }).raaviTtsCalls.length
  ))).toBeGreaterThanOrEqual(3);
  await page.screenshot({ path: ".artifacts/reading-listen-toolbar.png" });

  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".is-reading-aloud")).toContainText("پاراگراف نخست");
  await toolbar.getByRole("button", { name: "توقف شنیدن" }).click();
  await expect(toolbar).toBeHidden();
  await expect(page.locator(".is-reading-aloud")).toHaveCount(0);

  await trigger.click();
  await expect(page.locator(".is-reading-aloud")).toContainText("روایت فردا");
  const speed = toolbar.getByRole("combobox", { name: "سرعت خواندن" });
  await speed.focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".is-reading-aloud")).toContainText("روایت فردا");

  await page.setViewportSize({ width: 1024, height: 720 });
  await expect(toolbar.locator(".reading-listen-engine")).toBeVisible();
  await expect(toolbar.locator(".reading-listen-engine")).toContainText("مانا");
  const compact = await toolbar.evaluate((node) => ({
    width: Math.round(node.getBoundingClientRect().width),
    buttonHeights: Array.from(node.querySelectorAll("button"), (button) =>
      Math.round(button.getBoundingClientRect().height),
    ),
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  expect(compact.width).toBeLessThanOrEqual(1000);
  expect(compact.buttonHeights.every((height) => height >= 38)).toBe(true);
  expect(compact.overflow).toBeLessThanOrEqual(0);

  await toolbar.getByRole("button", { name: "توقف شنیدن" }).click();
  await page.evaluate(() => {
    const desktop = (window as unknown as { raaviDesktop: { synthesizeTts: () => Promise<never> } }).raaviDesktop;
    desktop.synthesizeTts = async () => { throw new Error("خطای آزمایشی موتور"); };
  });
  await trigger.click();
  await expect(toolbar.getByRole("button", { name: "تلاش دوباره برای خواندن" })).toBeVisible();
  await expect(trigger).not.toHaveClass(/is-active/u);
  await page.keyboard.press("F9");
  await expect(toolbar).toBeHidden();
});

test("smart Persian direction prepares a temporary spoken copy without changing the document", async ({ page }) => {
  await page.addInitScript((content) => {
    localStorage.clear();
    localStorage.setItem("raavi:document:v1", JSON.stringify({
      fileName: "خوانش-هوشمند.md",
      content,
      readerSize: 18,
      annotations: [],
      assets: [],
      revision: 1,
      versions: [],
      activeDocumentPath: "C:\\Raavi\\خوانش-هوشمند.md",
      documentType: "markdown",
      lastSavedSnapshot: content,
      draftId: "smart-reading-listen",
      viewMode: "writing",
      readingOutlineOpen: false,
      readingPositions: {},
      annotationComposer: null,
    }));
    localStorage.setItem("raavi:reading-preferences:v1", JSON.stringify({
      textSize: "normal",
      lineSpacing: "normal",
      textWidth: "balanced",
      rememberPosition: true,
      autoHideHeader: true,
      openOutlineOnEnter: false,
      narrationSpeed: 1,
      smartNarration: true,
    }));
  }, DOCUMENT);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.evaluate(() => {
    (window as unknown as { raaviDirectedSpeech: string[] }).raaviDirectedSpeech = [];
    Object.defineProperty(window, "Audio", {
      configurable: true,
      value: class MockAudio extends EventTarget {
        constructor(public src = "") { super(); }
        async play() {}
        pause() {}
        load() {}
        removeAttribute(name: string) { if (name === "src") this.src = ""; }
      },
    });
    (window as unknown as { raaviDesktop: unknown }).raaviDesktop = {
      isDesktop: true,
      getAiPreferences: async () => ({ model: "test-model" }),
      getTtsModelState: async () => ({
        supported: true,
        activeEngine: "ava",
        installState: "idle",
        installEngine: null,
        installComponent: null,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        error: "",
        engines: [{
          id: "ava",
          label: "آوا / Ava-82M",
          description: "پژوهشی و دقیق‌تر",
          downloadBytes: 560850159,
          requiredDownloadBytes: 0,
          sizeBreakdown: { primaryModelBytes: 327191691, supportFilesBytes: 31242849, runtimeBytes: 174687320, sharedPythonBytes: 27728299 },
          installed: true,
          selected: true,
          version: "0.2.0",
          license: "Apache-2.0",
          verification: "verified",
          checksum: "5d882cf0a3",
        }],
      }),
      prepareTtsNarration: async ({ segments }: { segments: Array<{ id: string; sourceText: string }> }) => ({
        mode: "smart",
        cached: false,
        segments: segments.map((segment) => ({
          ...segment,
          spokenText: segment.sourceText.replace("روایت", "رِوایت"),
          pauseAfterMs: 420,
        })),
      }),
      synthesizeTts: async ({ text }: { text: string }) => {
        (window as unknown as { raaviDirectedSpeech: string[] }).raaviDirectedSpeech.push(text);
        return { engine: "ava", source: "mock://smart-audio", cached: false };
      },
      cancelTts: async () => ({ cancelled: true }),
    };
  });

  await page.keyboard.press("F9");
  await page.locator(".reading-listen-trigger").click();
  const toolbar = page.getByRole("region", { name: "کنترل شنیدن متن" });
  await expect(toolbar).toContainText("خوانش هوشمند آماده است");
  await expect(page.locator("article.markdown-body h1")).toHaveText("روایت فردا");
  await expect.poll(() => page.evaluate(() => (
    (window as unknown as { raaviDirectedSpeech: string[] }).raaviDirectedSpeech[0] ?? ""
  ))).toContain("رِوایت");
});

test("reading settings exposes all downloadable local engines and their size breakdown", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.evaluate(() => {
    (window as unknown as { raaviDesktop: unknown }).raaviDesktop = {
      isDesktop: true,
      getTtsModelState: async () => ({
        supported: true,
        activeEngine: null,
        installState: "error",
        installEngine: "mms",
        installComponent: null,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: 0,
        error: "Traceback: spawn C:\\runtime\\python.exe failed with errno 1",
        engines: [
          { id: "mana", label: "مانا / Piper", description: "سبک و سریع", downloadBytes: 153647797, requiredDownloadBytes: 153647797, sizeBreakdown: { primaryModelBytes: 63531379, supportFilesBytes: 7088, runtimeBytes: 62381031, sharedPythonBytes: 27728299 }, installed: false, selected: false, version: "2025-02-14", license: "MIT", verification: "not-installed", checksum: "e390c0e74b" },
          { id: "ava", label: "آوا / Ava-82M", description: "پژوهشی و سنگین‌تر", downloadBytes: 560850159, requiredDownloadBytes: 560850159, sizeBreakdown: { primaryModelBytes: 327191691, supportFilesBytes: 31242849, runtimeBytes: 174687320, sharedPythonBytes: 27728299 }, installed: false, selected: false, version: "0.2.0", license: "Apache-2.0", verification: "not-installed", checksum: "5d882cf0a3" },
          { id: "mms", label: "متا / MMS فارسی", description: "سبک‌تر از آوا", downloadBytes: 347650764, requiredDownloadBytes: 347650764, sizeBreakdown: { primaryModelBytes: 145232120, supportFilesBytes: 3025, runtimeBytes: 174687320, sharedPythonBytes: 27728299 }, installed: false, selected: false, version: "2023-09-01", license: "CC BY-NC 4.0 · فقط غیرتجاری", restriction: "فقط برای استفادهٔ شخصی، آموزشی و پژوهشیِ غیرتجاری", verification: "not-installed", checksum: "e8c9bcaa7b" },
        ],
      }),
      onTtsLocalEvent: () => () => {},
    };
  });
  await page.locator(".header-overflow-trigger").click();
  await page.locator('[data-overflow-action="shortcut-settings"]').click();
  await page.getByRole("navigation", { name: "دسته‌های تنظیمات" }).getByRole("button", { name: "مطالعه" }).click();
  const section = page.locator(".reading-tts-settings");
  await expect(section).toContainText("مانا / Piper");
  await expect(section).toContainText("آوا / Ava-82M");
  await expect(section).toContainText("متا / MMS فارسی");
  await expect(section).toContainText("فایل اصلی مدل");
  await expect(section).toContainText("Python مشترک");
  await expect(section).toContainText("فقط برای استفادهٔ شخصی، آموزشی و پژوهشیِ غیرتجاری");
  await expect(section).toContainText("کارگردان هوشمند فارسی");
  await expect(section).toContainText("متن اصلی سند هرگز تغییر نمی‌کند");
  await expect(section.getByRole("switch", { name: "کارگردان هوشمند فارسی" })).toHaveAttribute("aria-checked", "false");
  await expect(section).not.toContainText("Traceback");
  await expect(section).toContainText("این کار کامل نشد");
  await expect(section.getByRole("button", { name: "تلاش دوباره" })).toBeVisible();
  await expect(section.getByRole("button", { name: "دریافت" })).toHaveCount(2);
  await page.screenshot({ path: ".artifacts/reading-tts-settings.png" });
});
