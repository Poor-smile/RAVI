import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { waitForRaaviWindow } from "./helpers/electron-main-window";

test.describe("Persian Mermaid Studio", () => {
  test.skip(process.platform !== "win32", "The packaged desktop target is Windows.");

  test("offers a simple Persian Sankey flow and actionable errors", async ({}, testInfo) => {
    test.setTimeout(60_000);
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "raavi-mermaid-persian-"),
    );
    const app = await electron.launch({
      cwd: projectRoot,
      args: [
        path.join(projectRoot, "desktop", "main.mjs"),
        `--user-data-dir=${userDataPath}`,
      ],
      timeout: 20_000,
    });

    try {
      const window = await waitForRaaviWindow(app);
      await window.evaluate(() => {
        const content = "# سند جدید\n\n";
        localStorage.setItem(
          "raavi:document:v1",
          JSON.stringify({
            fileName: "سند جدید",
            content,
            readerSize: 18,
            annotations: [],
            assets: [],
            revision: 1,
            versions: [],
            documentType: "ravi",
            lastSavedSnapshot: content,
            draftId: "mermaid-persian-studio",
            viewMode: "live",
            readingOutlineOpen: false,
            readingPositions: {},
            annotationComposer: null,
          }),
        );
      });
      await window.reload();
      await expect(window.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
      await window.keyboard.press("Control+K");
      const commandCenter = window.getByRole("dialog", { name: "مرکز فرمان راوی" });
      await expect(commandCenter).toBeVisible();
      await commandCenter.getByRole("combobox", { name: "جست‌وجوی فرمان" }).fill("Mermaid");
      await commandCenter.getByRole("option", { name: /ساخت نمودار Mermaid/u }).click();
      const studio = window.getByRole("dialog", {
        name: "استودیو گراف",
        exact: true,
      });
      await expect(studio.getByRole("heading", { name: "چه نموداری می‌خواهید بسازید؟" })).toBeVisible();
      await expect(studio.locator(".mermaid-ai-catalog > button")).toHaveCount(29);
      await expect(studio.getByRole("button", { name: "افزودن به سند" })).toBeDisabled();
      await expect(studio.getByText("انتخاب نوع", { exact: true })).toBeVisible();
      await expect(studio).toHaveCSS("opacity", "1");
      await window.screenshot({ path: testInfo.outputPath("type-picker.png") });

      await studio.getByRole("option", { name: /^فرایند/ }).click();
      await expect(studio.getByRole("button", { name: /^گسترش در عرض/ })).toHaveAttribute("aria-pressed", "true");
      const flowchartSurface = studio.locator(".mermaid-render-surface");
      const horizontalRenderKey = await flowchartSurface.getAttribute(
        "data-mermaid-render-key",
      );
      await studio.getByRole("button", { name: /^گسترش در طول/ }).click();
      await expect(studio.getByRole("button", { name: /^گسترش در طول/ })).toHaveAttribute("aria-pressed", "true");
      await expect
        .poll(() => flowchartSurface.getAttribute("data-mermaid-render-key"))
        .not.toBe(horizontalRenderKey);
      await window.screenshot({ path: testInfo.outputPath("flowchart-orientation.png") });
      await studio.getByRole("button", { name: "کد پیشرفته", exact: true }).click();
      await expect(studio.locator(".mermaid-code-editor .cm-content")).toContainText("flowchart TB");
      await studio.getByRole("button", { name: "ساخت آسان", exact: true }).click();
      const beforeSequenceKey = await flowchartSurface.getAttribute(
        "data-mermaid-render-key",
      );
      await studio.getByRole("button", { name: "تغییر نوع", exact: true }).click();

      const typeSearch = studio.getByPlaceholder("نام نمودار را بنویسید…");
      await typeSearch.fill("توالی");
      await expect(studio.locator(".mermaid-ai-catalog > button")).toHaveCount(1);
      await studio.getByRole("option", { name: /^توالی/ }).click();
      await expect(studio.getByRole("region", { name: "ساخت آسان توالی" })).toBeVisible();
      await expect(studio.getByLabel("راهنمای کنترل عرض و طول نمودار")).toContainText("کنترل عرض");
      await expect(studio.getByRole("button", { name: "انتقال ردیف ۲ به بالا" })).toBeEnabled();
      await expect
        .poll(() => flowchartSurface.getAttribute("data-mermaid-render-key"))
        .not.toBe(beforeSequenceKey);
      const sequenceSurface = studio.locator("img.mermaid-render-surface");
      await expect
        .poll(() =>
          sequenceSurface.evaluate(async (image) =>
            fetch((image as HTMLImageElement).src).then((response) => response.text()),
          ),
        )
        .toContain("پیش‌نمایش آماده است");
      await window.screenshot({ path: testInfo.outputPath("sequence-builder.png") });
      const beforeSankeyKey = await flowchartSurface.getAttribute(
        "data-mermaid-render-key",
      );
      await studio.getByRole("button", { name: "تغییر نوع", exact: true }).click();
      await studio.getByPlaceholder("نام نمودار را بنویسید…").fill("سنکی");
      await studio.getByRole("option", { name: /^جریان سنکی/ }).click();
      await expect(studio.getByRole("region", { name: "ساخت آسان جریان سنکی" })).toBeVisible();
      const surface = studio.locator("img.mermaid-render-surface");
      await expect
        .poll(() => surface.getAttribute("data-mermaid-render-key"))
        .not.toBe(beforeSankeyKey);
      const sankeySvg = await surface.evaluate(async (image) =>
        fetch((image as HTMLImageElement).src).then((response) => response.text()),
      );
      expect(sankeySvg).toContain("ورودی");
      expect(sankeySvg).toContain("مطالعه");
      expect(sankeySvg).toContain("۸");

      await studio.getByRole("button", { name: "کد پیشرفته", exact: true }).click();
      const code = studio.locator(".mermaid-code-editor .cm-content");
      await code.fill("sankey-beta\n\nورودی،مطالعه");
      await expect(studio.getByRole("alert")).toContainText("ردیف ۳ قابل خواندن نیست");
      await expect(studio.locator(".cm-mermaid-error-line")).toHaveCount(1);
      await expect(studio.locator(".cm-mermaid-error-note")).toContainText(
        "هر مسیر باید سه بخش داشته باشد",
      );
      await expect(studio.getByRole("button", { name: "رفتن به ردیف مشکل‌دار" })).toBeVisible();
      await expect(studio.getByRole("button", { name: "دیدن نمونهٔ صحیح" })).toBeVisible();
      await expect(studio.getByRole("button", { name: "اصلاح پیشنهادی" })).toBeVisible();
      await expect(studio.getByText("جزئیات فنی", { exact: true })).toBeVisible();
      await window.screenshot({ path: testInfo.outputPath("persian-error.png") });
    } finally {
      await app.close();
      await rm(userDataPath, { recursive: true, force: true });
    }
  });
});
