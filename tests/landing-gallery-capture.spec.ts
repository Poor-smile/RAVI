import { Buffer } from "node:buffer";
import { expect, test, type Page } from "@playwright/test";

const OUTPUT = "landing/assets/screens";
const FIRST_RUN_KEY = "raavi:first-run-onboarding:v1";

const SHOWCASE_DOCUMENT = [
  "# راوی؛ فضای آرام برای فکر کردن",
  "",
  "راوی یک میز یکپارچه برای نوشتن، خواندن و بازبینی متن فارسی است؛ جایی که ساختارهای پیچیده هم بدون فاصله‌گرفتن از جریان نوشتن شکل می‌گیرند.",
  "",
  "$$",
  String.raw`\mathcal{L}(\theta)=\frac{1}{n}\sum_{i=1}^{n}\left(y_i-\sigma\!\left(\theta^{\mathsf T}x_i\right)\right)^2+\lambda\lVert\theta\rVert_2^2`,
  "$$",
  "",
  "| قابلیت | وضعیت | نتیجه |",
  "|---|:---:|---|",
  "| نگارش فارسی | آماده | متن روان و راست‌به‌چپ |",
  "| فرمول و جدول | فعال | ساختار دقیق در همان سند |",
  "| خروجی | آماده | Word و PDF |",
].join("\n");

const AI_DOCUMENT = [
  "# برنامهٔ انتشار راوی ۲.۲",
  "",
  "نسخهٔ جدید با تمرکز بر نوشتن فارسی، بازبینی هوشمند و ساخت سندهای ساختاریافته منتشر می‌شود.",
  "",
  "تیم محصول باید وضعیت طراحی، توسعه، کنترل کیفیت و انتشار را در یک نمای روشن و قابل پیگیری جمع‌بندی کند.",
  "",
  "هر مرحله یک مسئول، زمان تحویل و وضعیت مشخص دارد تا تصمیم‌گیری سریع‌تر شود.",
].join("\n");

const MANAGEMENT_REPORT = [
  "# گزارش مدیریتی عملکرد راوی",
  "",
  "این گزارش تصویری فشرده از وضعیت محصول، کیفیت تجربه و اولویت‌های دورهٔ بعد ارائه می‌کند.",
  "",
  "## خلاصهٔ اجرایی",
  "",
  "رشد استفادهٔ مستمر همراه با کاهش اصطکاک در مسیر نوشتن، مهم‌ترین نتیجهٔ این دوره بوده است.",
  "",
  "حاشیهٔ رضایت کاربران در تجربهٔ نوشتن فارسی بهبود یافته و زمان رسیدن از ایده به فایل نهایی کوتاه‌تر شده است.",
  "",
  "## شاخص‌های کلیدی",
  "",
  "| شاخص | وضعیت فعلی | جهت حرکت |",
  "|---|---:|:---:|",
  "| پایداری ویرایشگر | ۹۹٫۸٪ | رو به رشد |",
  "| رضایت از نوشتن فارسی | ۹۲٪ | رو به رشد |",
  "| زمان آماده‌سازی خروجی | ۱۸ ثانیه | کاهشی |",
  "",
  "## تصمیم‌های محصول",
  "",
  "تمرکز دورهٔ بعد روی یکپارچگی هوش مصنوعی، پشتیبان‌گیری قابل اعتماد و تجربهٔ مطالعه خواهد بود.",
  "",
  "## برنامهٔ دورهٔ بعد",
  "",
  "تکمیل قابلیت‌های صوت، بهبود خروجی‌ها و ساده‌ترشدن گردش کار تیمی سه اولویت اصلی هستند.",
].join("\n");

const SPLIT_DOCUMENT = [
  "# معماری یک نوشتهٔ روشن",
  "",
  "متن خوب از یک ساختار قابل فهم شروع می‌شود و در هر مرحله امکان بازبینی دارد.",
  "",
  "## مسیر تولید محتوا",
  "",
  "1. ثبت ایدهٔ اولیه",
  "2. ساخت فصل‌ها و تیترها",
  "3. بازبینی و آماده‌سازی خروجی",
  "",
  "> راوی کد Markdown و نتیجهٔ نوشتاری را هم‌زمان کنار هم نگه می‌دارد.",
].join("\n");

const AUDIO_DOCUMENT = [
  "# یادداشت جلسهٔ محصول",
  "",
  "فایل صوتی جلسه برای تبدیل محلی و بازسازی متن فارسی به سند افزوده شده است.",
  "",
  '[🎧 جلسه-برنامه‌ریزی-محصول.mp3](./گزارش.assets/جلسه-برنامه‌ریزی-محصول.mp3 "raavi-audio")',
  "",
  "## نکته‌های تکمیلی",
  "",
  "رونوشت نهایی پس از پردازش دقیقاً زیر همین بلاک قرار می‌گیرد.",
].join("\n");

type SeedOptions = {
  content: string;
  fileName: string;
  theme?: "light" | "dark";
  viewMode?: "desk" | "reading";
  annotations?: Array<Record<string, unknown>>;
};

async function seedDocument(page: Page, options: SeedOptions) {
  await page.addInitScript(
    ({ content, fileName, theme, viewMode, annotations, firstRunKey }) => {
      window.localStorage.clear();
      window.localStorage.setItem(
        firstRunKey,
        JSON.stringify({ completed: true, version: 1 }),
      );
      window.localStorage.setItem("raavi:theme:v1", theme);
      window.localStorage.setItem(
        "raavi:document:v1",
        JSON.stringify({
          fileName,
          content,
          readerSize: 18,
          annotations,
          assets: [],
          revision: 4,
          versions: [],
          activeDocumentPath: `C:\\Raavi\\${fileName}`,
          documentType: "ravi",
          lastSavedSnapshot: content,
          draftId: `landing-gallery-${fileName}`,
          viewMode,
          readingOutlineOpen: false,
          readingPositions: {},
          annotationComposer: null,
        }),
      );
    },
    {
      ...options,
      theme: options.theme ?? "light",
      viewMode: options.viewMode ?? "desk",
      annotations: options.annotations ?? [],
      firstRunKey: FIRST_RUN_KEY,
    },
  );
  await page.goto("/");
  await expect(page.locator('.app-shell[data-hydrated="true"]')).toBeVisible();
  await expect(page.locator(".toast")).toBeHidden({ timeout: 8_000 });
}

async function openEmptyShell(page: Page, theme: "light" | "dark") {
  await page.addInitScript(
    ({ selectedTheme, firstRunKey }) => {
      window.localStorage.clear();
      window.localStorage.setItem(
        firstRunKey,
        JSON.stringify({ completed: true, version: 1 }),
      );
      window.localStorage.setItem("raavi:theme:v1", selectedTheme);
    },
    { selectedTheme: theme, firstRunKey: FIRST_RUN_KEY },
  );
  await page.goto("/");
  await expect(page.locator('.app-shell[data-hydrated="true"]')).toBeVisible();
}

async function capture(page: Page, name: string) {
  await page.screenshot({
    path: `${OUTPUT}/${name}`,
    fullPage: false,
    animations: "disabled",
  });
}

async function openSavedFile(page: Page, content: string, fileName: string) {
  await page
    .locator('input[type="file"][accept*=".md"]')
    .first()
    .setInputFiles({
      name: fileName,
      mimeType: "text/markdown",
      buffer: Buffer.from(content),
    });
  const leaveReading = page.getByRole("button", {
    name: "بازگشت به میز",
    exact: true,
  });
  if (await leaveReading.isVisible()) await leaveReading.click();
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
  await expect(page.locator(".toast")).toBeHidden({ timeout: 8_000 });
  await page
    .locator("#markdown-editor .cm-line")
    .filter({ hasText: "راوی یک میز یکپارچه" })
    .click();
}

test("captures 01 — a saved light document with heading, formula and table", async ({ page }) => {
  await openEmptyShell(page, "light");
  await openSavedFile(page, SHOWCASE_DOCUMENT, "معرفی راوی.md");
  await expect(page.locator(".save-indicator")).toContainText("ذخیره شده");
  await expect(page.locator(".cm-rich-formula")).toBeVisible();
  await expect(page.locator(".cm-rich-table")).toBeVisible();
  await capture(page, "gallery-01-writing-light.png");
});

test("captures 02 — the same saved document in dark mode", async ({ page }) => {
  await openEmptyShell(page, "dark");
  await openSavedFile(page, SHOWCASE_DOCUMENT, "معرفی راوی.md");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".save-indicator")).toContainText("ذخیره شده");
  await expect(page.locator(".cm-rich-formula")).toBeVisible();
  await expect(page.locator(".cm-rich-table")).toBeVisible();
  await capture(page, "gallery-02-writing-dark.png");
});

test("captures 03 — selected block with an AI table prompt", async ({ page }) => {
  await seedDocument(page, {
    content: AI_DOCUMENT,
    fileName: "برنامه انتشار راوی.ravi",
  });
  await page.evaluate(() => {
    Object.defineProperty(window, "raaviDesktop", {
      configurable: true,
      value: {
        getCodexConnectionStatus: async () => ({ state: "connected" }),
        runCodexPrompt: async () => ({ answer: "", replacement: null }),
      },
    });
  });
  const editor = page.locator("#markdown-editor .cm-content");
  await editor.locator(".cm-line").filter({ hasText: "تیم محصول باید" }).click();
  await page.locator(".writing-block-ai-trigger").click();
  await expect(page.locator(".ai-context-chip")).toContainText("بلاک فعال");
  const composer = page.getByRole("combobox", { name: "پیام به راوی هوشمند" });
  await composer.fill("این متن را تبدیل به جدول کن");
  await expect(composer).toHaveValue("این متن را تبدیل به جدول کن");
  await capture(page, "gallery-03-ai-table.png");
});

test("captures 04 — management report in reading mode with outline and highlight", async ({ page }) => {
  const quote = "حاشیهٔ رضایت کاربران در تجربهٔ نوشتن فارسی بهبود یافته و زمان رسیدن از ایده به فایل نهایی کوتاه‌تر شده است.";
  await seedDocument(page, {
    content: MANAGEMENT_REPORT,
    fileName: "گزارش مدیریتی راوی.ravi",
    viewMode: "reading",
    annotations: [
      {
        id: "landing-management-highlight",
        kind: "highlight",
        start: 0,
        end: quote.length,
        quote,
        prefix: "",
        suffix: "",
        body: "",
        createdAt: "2026-08-30T10:00:00.000Z",
      },
    ],
  });
  await page.getByRole("button", { name: "فهرست سند", exact: true }).click();
  await expect(page.locator("#library-panel")).toHaveClass(/is-open/);
  await expect(page.locator(".reading-document-outline-list .sidebar-row")).toHaveCount(5);
  await expect(page.locator("style[data-raavi-highlights]")).toHaveCount(1);
  await capture(page, "gallery-04-reading-report.png");
});

test("captures 05 — the two-leaf code and writing view", async ({ page }) => {
  await seedDocument(page, {
    content: SPLIT_DOCUMENT,
    fileName: "معماری نوشته.ravi",
  });
  await page.getByRole("button", { name: "نمونه‌خوانی دوبرگی", exact: true }).click();
  const split = page.locator('[data-workspace-screen="split"]');
  await expect(split).toBeVisible();
  await expect(split.locator(".editor-pane #markdown-editor")).toBeVisible();
  await expect(split.locator(".preview-pane #writing-editor")).toBeVisible();
  await capture(page, "gallery-05-split-view.png");
});

test("captures 06 — cloud backup settings", async ({ page }) => {
  await seedDocument(page, {
    content: SHOWCASE_DOCUMENT,
    fileName: "معرفی راوی.ravi",
  });
  await page.locator(".header-overflow-trigger").click();
  await page.locator('[data-overflow-action="shortcut-settings"]').click();
  await page
    .getByRole("navigation", { name: "دسته‌های تنظیمات" })
    .getByRole("button", { name: "فایل‌ها و کتابخانه" })
    .click();
  const dialog = page.getByRole("dialog", { name: "پشتیبان‌گیری ابری" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("radio", { name: /Google Drive/u })).toBeVisible();
  await expect(dialog.getByRole("radio", { name: /Proton Drive/u })).toBeVisible();
  await capture(page, "gallery-06-backup-settings.png");
});

test("captures 07 — an audio block while local speech-to-text is running", async ({ page }) => {
  await seedDocument(page, {
    content: AUDIO_DOCUMENT,
    fileName: "یادداشت جلسه محصول.ravi",
  });
  await page.evaluate(() => {
    const modelState = {
      supported: true,
      activeTier: "balanced",
      installState: "idle",
      installTier: null,
      installComponent: null,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      error: "",
      tiers: [
        {
          id: "balanced",
          label: "متعادل",
          suitableFor: "سیستم معمولی",
          detail: "تعادل سرعت و دقت",
          sizeBytes: 190_000_000,
          installed: true,
          recommended: true,
        },
      ],
    };
    const job = {
      id: "landing-audio-job",
      documentPath: "C:\\Raavi\\یادداشت جلسه محصول.ravi",
      relativePath: "./گزارش.assets/جلسه-برنامه‌ریزی-محصول.mp3",
      fileName: "جلسه-برنامه‌ریزی-محصول.mp3",
      durationMs: 428_000,
      tier: "balanced",
      phase: "transcribing",
      progress: 0.46,
      currentChunk: 2,
      totalChunks: 6,
      etaSeconds: 96,
      segments: [],
      error: "",
      updatedAt: "2026-08-30T10:00:00.000Z",
    };
    Object.defineProperty(window, "raaviDesktop", {
      configurable: true,
      value: {
        getAudioModelState: async () => modelState,
        listAudioTranscriptionJobs: async () => [],
        startAudioTranscription: async () => job,
        onAudioLocalEvent: () => () => {},
      },
    });
  });
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
  const audioBlock = page.locator(".cm-rich-audio");
  await expect(audioBlock).toBeVisible();
  await audioBlock.getByRole("button", { name: "تبدیل به متن" }).click();
  await expect(page.locator(".audio-ai-journey")).toBeVisible();
  await expect(page.locator(".audio-ai-progress")).toContainText("۴۶٪");
  await capture(page, "gallery-07-audio-transcription.png");
});

test("captures 08 — the Raavi command center with relevant commands", async ({ page }) => {
  await seedDocument(page, {
    content: SPLIT_DOCUMENT,
    fileName: "راهنمای مرکز فرمان راوی.ravi",
  });
  await page.keyboard.press("Control+K");
  const commandCenter = page.getByRole("dialog", { name: "مرکز فرمان راوی" });
  await expect(commandCenter).toBeVisible();
  await expect(
    commandCenter.getByRole("combobox", { name: "جست‌وجوی فرمان" }),
  ).toBeFocused();
  await expect(commandCenter.locator(".command-result-row")).toHaveCount(5);
  await expect(commandCenter).toContainText("بازکردن فایل");
  await expect(commandCenter).toContainText("خروجی Word یا PDF");
  await capture(page, "gallery-08-command-center.png");
});
