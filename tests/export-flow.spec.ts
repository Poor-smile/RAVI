import { expect, test, type Page } from "@playwright/test";
import { chromium } from "playwright";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import { createRaaviServer } from "../desktop/server.mjs";

const ULTIMATE_STRESS_MARKDOWN_PATH = fileURLToPath(
  new URL("../docs/MERMAID_ULTIMATE_STRESS_TEST_FA.md", import.meta.url),
);

const OUTPUT_UI_SELECTOR = [
  ".topbar",
  ".proofbar",
  ".library-panel",
  ".editor-pane",
  ".reading-outline",
  ".registration-spine",
  ".export-modal",
  ".save-modal",
  ".toast",
  ".mermaid-diagram-action",
  ".mermaid-diagram-viewport-tools",
  ".mermaid-diagram-hint",
  ".selection-range-feedback",
  "button",
  "input",
  "textarea",
  "select",
].join(",");

const ACCEPTANCE_COUNTS = {
  headings: 41,
  tables: 3,
  diagrams: 26,
  uiElements: 0,
} as const;

let server: Awaited<ReturnType<typeof createRaaviServer>>;

async function openExportDialog(page: Page) {
  // A newly opened document starts in Reading, whose compact chrome does not
  // expose the desktop overflow menu. The export command remains available
  // from the shared command registry on every document surface.
  await page.keyboard.press("Control+Shift+KeyE");
  await expect(page.getByRole("dialog", { name: "خروجی سند" })).toBeVisible();
}

test.beforeAll(async () => {
  server = await createRaaviServer({ host: "127.0.0.1", port: 0 });
});

test.afterAll(async () => {
  await server.close();
});

test("preserves the ultimate Markdown acceptance counts in Word and PDF", async () => {
  test.setTimeout(180_000);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript((uiSelector) => {
      window.print = () => {
        const root = document.getElementById("raavi-print-root");
        const article = root?.querySelector<HTMLElement>(
          ":scope > article.markdown-body",
        );
        const counts = {
          headings:
            article?.querySelectorAll("h1, h2, h3, h4, h5, h6").length ?? -1,
          tables: article?.querySelectorAll("table").length ?? -1,
          diagrams: article?.querySelectorAll(".mermaid-diagram").length ?? -1,
          uiElements: root?.querySelectorAll(uiSelector).length ?? -1,
          invalidDiagrams:
            article?.querySelectorAll(".mermaid-diagram.is-invalid").length ??
            -1,
          articleOnly: Boolean(article && root?.children.length === 1),
        };
        document.documentElement.dataset.raaviAcceptancePdf =
          JSON.stringify(counts);
      };
    }, OUTPUT_UI_SELECTOR);
    await page.goto(server.origin);
    await page
      .locator('input[type="file"][accept*=".md"]')
      .first()
      .setInputFiles(ULTIMATE_STRESS_MARKDOWN_PATH);

    await expect(page.locator(".mermaid-diagram")).toHaveCount(
      ACCEPTANCE_COUNTS.diagrams,
      { timeout: 60_000 },
    );

    await openExportDialog(page);
    const exportButton = page.locator(
      ".export-modal-actions .button--primary",
    );
    await exportButton.click();
    await expect(page.locator(".export-review")).toBeVisible({
      timeout: 120_000,
    });
    const reviewConfirmation = page.locator(
      'input[name="confirm-export-review"]',
    );
    await reviewConfirmation.check();
    const [download] = await Promise.all([
      page.waitForEvent("download", { timeout: 120_000 }),
      exportButton.click(),
    ]);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const wordArchive = await JSZip.loadAsync(await readFile(downloadPath!));
    const documentXml = await wordArchive
      .file("word/document.xml")!
      .async("string");
    const paragraphs =
      documentXml.match(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/gu) ?? [];
    const wordCounts = {
      headings: paragraphs.filter((paragraph) =>
        /<w:pStyle w:val="Heading[1-6]"\s*\/>/u.test(paragraph),
      ).length,
      tables: documentXml.match(/<w:tbl>/gu)?.length ?? 0,
      diagrams: Object.keys(wordArchive.files).filter(
        (name) => name.startsWith("word/media/") && name.endsWith(".svg"),
      ).length,
      uiElements:
        documentXml.match(/<(?:w:control|w:sdt|w:object|w:altChunk)\b/gu)
          ?.length ?? 0,
    };
    expect(wordCounts).toEqual(ACCEPTANCE_COUNTS);
    const successDialog = page.getByRole("dialog", { name: "خروجی آماده است" });
    await expect(successDialog).toBeVisible();
    await expect(
      successDialog.getByRole("button", { name: "نمایش در پوشه" }),
    ).toHaveCount(0);
    await expect(successDialog.getByRole("button", { name: "تمام" })).toBeFocused();
    await successDialog.getByRole("button", { name: "تمام" }).click();

    await openExportDialog(page);
    await page.locator('input[value="pdf"]').check();
    await page.locator(".export-modal-actions .button--primary").click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-raavi-acceptance-pdf",
      /"articleOnly":true/u,
      { timeout: 120_000 },
    );
    const pdfCounts = await page.locator("html").getAttribute(
      "data-raavi-acceptance-pdf",
    );
    expect(JSON.parse(pdfCounts!)).toEqual({
      ...ACCEPTANCE_COUNTS,
      invalidDiagrams: 0,
      articleOnly: true,
    });
    await expect(page.locator("#raavi-print-root")).toHaveCount(0);
    await expect(page.locator(".export-modal")).toBeHidden();
  } finally {
    await browser.close();
  }
});

test("downloads an editable Word file from the export dialog", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(server.origin);

    await openExportDialog(page);
    await expect(page.locator(".export-modal")).toBeVisible();
    await expect(page.locator('input[value="word"]')).toBeChecked();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".export-modal-actions .button--primary").click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.docx$/iu);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const bytes = await readFile(downloadPath!);
    expect(Array.from(bytes.subarray(0, 2))).toEqual([0x50, 0x4b]);
    expect(bytes.byteLength).toBeGreaterThan(2_000);
    await expect(
      page.getByRole("dialog", { name: "خروجی آماده است" }),
    ).toBeVisible();
    const wordSuccessDialog = page.getByRole("dialog", {
      name: "خروجی آماده است",
    });
    await expect(
      wordSuccessDialog.getByRole("button", { name: "نمایش در پوشه" }),
    ).toHaveCount(0);
    await expect(
      wordSuccessDialog.getByRole("button", { name: "تمام" }),
    ).toBeFocused();
    await wordSuccessDialog.getByRole("button", { name: "تمام" }).click();
  } finally {
    await browser.close();
  }
});

test("embeds Mermaid as padded SVG with an adaptive high-resolution PNG fallback", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(server.origin);
    await page
      .locator('input[type="file"][accept*=".md"]')
      .first()
      .setInputFiles({
        name: "vector-mermaid.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(
          [
            "# نمودار برداری",
            "",
            "```mermaid",
            "flowchart LR",
            "  A[شروع] --> B[بازبینی] --> C[پایان]",
            "```",
          ].join("\n"),
        ),
      });
    await expect(
      page.locator(".mermaid-diagram .mermaid-render-surface"),
    ).toBeVisible({ timeout: 15_000 });

    await openExportDialog(page);
    await page.locator(".export-modal-actions .button--primary").click();
    await expect(page.locator(".export-review")).toBeVisible({
      timeout: 120_000,
    });
    await page.locator('input[name="confirm-export-review"]').check();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(".export-modal-actions .button--primary").click(),
    ]);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const bytes = await readFile(downloadPath!);
    const archive = await JSZip.loadAsync(bytes);
    const mediaNames = Object.keys(archive.files).filter((name) =>
      name.startsWith("word/media/"),
    );
    const svgName = mediaNames.find((name) => name.endsWith(".svg"));
    const pngName = mediaNames.find((name) => name.endsWith(".png"));
    expect(svgName).toBeTruthy();
    expect(pngName).toBeTruthy();

    const svg = await archive.file(svgName!)!.async("string");
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"');
    const viewBox = svg
      .match(/viewBox="([^"]+)"/u)?.[1]
      ?.split(/\s+/u)
      .map(Number);
    expect(viewBox).toHaveLength(4);
    expect(viewBox?.[0]).toBeLessThan(0);
    expect(viewBox?.[1]).toBeLessThan(0);

    const documentXml = await archive
      .file("word/document.xml")!
      .async("string");
    expect(documentXml).toContain("asvg:svgBlip");
    const extent = documentXml.match(
      /<wp:extent cx="(\d+)" cy="(\d+)"\s*\/>/u,
    );
    expect(extent).toBeTruthy();

    const png = await archive.file(pngName!)!.async("uint8array");
    const pngView = new DataView(png.buffer, png.byteOffset, png.byteLength);
    const pngWidth = pngView.getUint32(16);
    const pngHeight = pngView.getUint32(20);
    const displayWidth = Number(extent![1]) / 9_525;
    const displayHeight = Number(extent![2]) / 9_525;
    expect(pngWidth).toBeGreaterThanOrEqual(Math.floor(displayWidth * 5));
    expect(pngHeight).toBeGreaterThanOrEqual(Math.floor(displayHeight * 5));
  } finally {
    await browser.close();
  }
});

test("prepares the preview and opens the browser PDF print flow", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.print = () => {
        const printRoot = document.getElementById("raavi-print-root");
        document.documentElement.dataset.raaviPrintCalled = "true";
        document.documentElement.dataset.raaviPrintArticleOnly = String(
          Boolean(
            printRoot?.querySelector(":scope > article.markdown-body") &&
              !printRoot.querySelector(
                ".topbar, .library-panel, .editor-pane, .export-modal",
              ),
          ),
        );
        document.documentElement.dataset.raaviPrintFileName =
          printRoot?.dataset.fileName ?? "";
      };
    });
    await page.goto(server.origin);
    await page
      .locator('input[type="file"][accept*=".md"]')
      .first()
      .setInputFiles({
        name: "print-preview.md",
        mimeType: "text/markdown",
        buffer: Buffer.from("# پیش‌نمایش چاپ\n\nمتن نمونه برای خروجی PDF."),
      });

    await openExportDialog(page);
    await page.locator('input[value="pdf"]').check();
    await page.locator(".export-modal-actions .button--primary").click();

    await expect(page.locator("html")).toHaveAttribute(
      "data-raavi-print-called",
      "true",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-raavi-print-article-only",
      "true",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-raavi-print-file-name",
      /\.pdf$/iu,
    );
    await expect(page.locator("#raavi-print-root")).toHaveCount(0);
    await expect(page.locator(".export-modal")).toBeHidden();
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-raavi-pdf-export",
      "",
    );
  } finally {
    await browser.close();
  }
});

test("requires explicit confirmation before exporting a failed Mermaid diagram", async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      window.print = () => {
        document.documentElement.dataset.raaviPrintCalled = "true";
      };
    });
    await page.goto(server.origin);

    await page
      .locator('input[type="file"][accept*=".md"]')
      .first()
      .setInputFiles({
        name: "broken-mermaid.md",
        mimeType: "text/markdown",
        buffer: Buffer.from(
          ["# نمودار ناموفق", "", "```mermaid", "flowchart LR", "  A -->[", "```"].join(
            "\n",
          ),
        ),
      });
    await expect(page.locator(".mermaid-diagram.is-invalid")).toBeVisible({
      timeout: 15_000,
    });

    await openExportDialog(page);
    await page.locator('input[value="pdf"]').check();
    await page.locator(".export-modal-actions .button--primary").click();

    const confirmation = page.locator('input[name="confirm-export-review"]');
    const continueButton = page.locator(
      ".export-modal-actions .button--primary",
    );
    await expect(confirmation).toBeVisible();
    await expect(confirmation).not.toBeChecked();
    await expect(continueButton).toBeDisabled();
    await expect(page.locator("html")).not.toHaveAttribute(
      "data-raavi-print-called",
      "true",
    );

    await confirmation.check();
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    await expect(page.locator("html")).toHaveAttribute(
      "data-raavi-print-called",
      "true",
    );
    await expect(page.locator(".export-modal")).toBeHidden();
  } finally {
    await browser.close();
  }
});
