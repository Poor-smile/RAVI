import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
      const window = await app.firstWindow();
      await window
        .getByRole("button", { name: "ساخت نمودار Mermaid", exact: true })
        .click();
      const studio = window.getByRole("dialog", {
        name: "ساخت نمودار",
        exact: true,
      });
      await expect(studio.getByRole("heading", { name: "چه نموداری می‌خواهید بسازید؟" })).toBeVisible();
      await expect(studio.locator(".mermaid-kind-list > button")).toHaveCount(29);
      await expect(studio.getByRole("button", { name: "افزودن به سند" })).toBeDisabled();
      await expect(studio.getByText("ابتدا نوع نمودار را انتخاب کنید", { exact: true })).toBeVisible();
      await expect(studio).toHaveCSS("opacity", "1");
      await window.screenshot({ path: testInfo.outputPath("type-picker.png") });

      await studio.getByRole("button", { name: /^فرایند/ }).click();
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
      await studio.getByRole("button", { name: "تغییر نوع", exact: true }).click();

      const typeSearch = studio.getByRole("searchbox", { name: "جست‌وجوی نوع نمودار" });
      await typeSearch.fill("توالی");
      await expect(studio.locator(".mermaid-kind-list > button")).toHaveCount(1);
      await studio.getByRole("button", { name: /^توالی/ }).click();
      await expect(studio.getByRole("region", { name: "ساخت آسان توالی" })).toBeVisible();
      await expect(studio.getByLabel("راهنمای کنترل عرض و طول نمودار")).toContainText("کنترل عرض");
      await expect(studio.getByRole("button", { name: "انتقال ردیف ۲ به بالا" })).toBeEnabled();
      await expect(studio.locator(".mermaid-render-surface")).toContainText(
        "پیش‌نمایش آماده است",
      );
      await window.screenshot({ path: testInfo.outputPath("sequence-builder.png") });
      await studio.getByRole("button", { name: "تغییر نوع", exact: true }).click();
      await studio.getByRole("searchbox", { name: "جست‌وجوی نوع نمودار" }).fill("");
      await studio.getByRole("button", { name: /^جریان سنکی/ }).click();
      await expect(studio.getByRole("region", { name: "ساخت آسان جریان سنکی" })).toBeVisible();
      const surface = studio.locator(".mermaid-render-surface");
      await expect(surface).toContainText("ورودی");
      await expect(surface).toContainText("مطالعه");
      await expect(surface).toContainText("۸");

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
