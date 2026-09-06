import { releaseElectron as electron } from "./helpers/release-electron";
import { expect, Page, test } from "@playwright/test";

import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { waitForRaaviWindow } from "./helpers/electron-main-window";

async function interactiveTypeIssues(page: Page, minimum: number) {
  return page.evaluate((floor) => {
    const controls = [
      ...document.querySelectorAll<HTMLElement>(
        "button, a, input:not([type='hidden']), select, textarea, summary, [role='button'], [role='tab'], [role='menuitem']",
      ),
    ];
    const seen = new Set<HTMLElement>();
    const issues: Array<{ label: string; size: number }> = [];

    for (const control of controls) {
      if (control.closest("[inert], [aria-hidden='true']")) continue;
      const candidates = [
        control,
        ...control.querySelectorAll<HTMLElement>("span, small, strong, b, time"),
      ];
      for (const candidate of candidates) {
        if (seen.has(candidate)) continue;
        seen.add(candidate);
        const style = getComputedStyle(candidate);
        const rect = candidate.getBoundingClientRect();
        const hasText =
          candidate instanceof HTMLInputElement ||
          [...candidate.childNodes].some(
            (node) =>
              node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
          );
        if (
          !hasText ||
          style.display === "none" ||
          style.visibility === "hidden" ||
          rect.width <= 0 ||
          rect.height <= 0
        ) {
          continue;
        }
        const size = Number.parseFloat(style.fontSize);
        if (size < floor) {
          issues.push({
            label:
              candidate.getAttribute("aria-label") ||
              candidate.textContent?.trim().replace(/\s+/g, " ").slice(0, 70) ||
              candidate.tagName,
            size,
          });
        }
      }
    }
    return issues;
  }, minimum);
}

async function contrastRatio(
  page: Page,
  foregroundSelector: string,
  backgroundSelector: string,
) {
  return page.evaluate(
    ({ backgroundSelector: background, foregroundSelector: foreground }) => {
      const parse = (color: string) => {
        const values = color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
        return values.map((value) => value / 255);
      };
      const luminance = (color: string) =>
        parse(color)
          .map((value) =>
            value <= 0.03928
              ? value / 12.92
              : Math.pow((value + 0.055) / 1.055, 2.4),
          )
          .reduce(
            (sum, value, index) =>
              sum + value * ([0.2126, 0.7152, 0.0722][index] ?? 0),
            0,
          );
      const foregroundElement = document.querySelector<HTMLElement>(foreground);
      const backgroundElement = document.querySelector<HTMLElement>(background);
      if (!foregroundElement || !backgroundElement) return 0;
      const foregroundLuminance = luminance(
        getComputedStyle(foregroundElement).color,
      );
      const backgroundLuminance = luminance(
        getComputedStyle(backgroundElement).backgroundColor,
      );
      return (
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
      );
    },
    { backgroundSelector, foregroundSelector },
  );
}

test.describe("RAVI identity baseline", () => {
  test.skip(process.platform !== "win32", "The packaged desktop target is Windows.");

  test("keeps the proofreader desk stable in light and dark themes", async () => {
    test.slow();
    test.setTimeout(60_000);
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const fixturePath = path.join(
      projectRoot,
      "tests",
      "fixtures",
      "identity-baseline.md",
    );
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "raavi-identity-baseline-"),
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
      expect(await app.evaluate(({ app }) => app.getPath("userData"))).toBe(userDataPath);
      const window = await waitForRaaviWindow(app);
      await window.setViewportSize({ width: 1440, height: 900 });
      await window.emulateMedia({ reducedMotion: "reduce" });
      await window
        .locator('input[type="file"][accept*=".md"]')
        .first()
        .setInputFiles(fixturePath);
      await expect(window.locator(".document-identity")).toContainText(
        "identity-baseline.md",
      );
      await expect(window.locator(".markdown-body h1")).toContainText(
        "میز نمونه‌خوانی راوی",
      );
      await window
        .getByRole("button", { name: /بازگشت به میز/ })
        .click();
      await expect(window.locator('[data-workspace-screen="writing"]')).toBeVisible();
      await window.evaluate(() => document.fonts.ready);
      await expect(window.locator(".toast")).toBeHidden({ timeout: 8_000 });

      const primaryActions = window.locator(
        '.topbar [data-primary-action]:visible',
      );
      await expect(primaryActions).toHaveCount(3);
      await expect(window.locator(".topbar-action--open")).toHaveClass(/is-icon-only/);
      await expect(window.locator(".topbar-action--open .action-label")).toBeHidden();
      await expect(window.locator(".topbar-action--save")).toBeVisible();
      await expect(window.locator(".topbar-action--save .action-label")).toBeHidden();
      await expect(window.locator(".topbar-action--reading .action-label")).toBeHidden();
      await expect(window.locator(".revision-badge")).toBeHidden();
      await expect(window.locator(".document-stats")).toHaveText(/واژه/);

      const openAction = window.locator(".topbar-action--open");
      await openAction.focus();
      await expect
        .poll(() =>
          openAction.evaluate(
            (element) => getComputedStyle(element, "::after").content,
          ),
        )
        .not.toBe("none");

      const overflowTrigger = window.locator(".header-overflow-trigger");
      await overflowTrigger.click();
      const exportAction = window.locator('[data-overflow-action="export"]');
      await expect(exportAction).toBeVisible();
      await expect(window.locator('[data-overflow-action="theme"]')).toBeVisible();
      await expect(window.locator('[data-overflow-action="support"]')).toBeVisible();
      await expect(window.locator('[data-overflow-action="about"]')).toBeVisible();
      await expect(window).toHaveScreenshot("identity-shell-overflow.png", {
        animations: "disabled",
        caret: "hide",
        maxDiffPixels: 100,
        scale: "css",
      });
      await exportAction.click();
      await expect(window.locator(".export-modal")).toBeVisible();
      await window.keyboard.press("Escape");
      await expect(overflowTrigger).toBeFocused();
      await overflowTrigger.click();
      await window.locator(".header-overflow-backdrop").click({
        position: { x: 4, y: 4 },
      });
      await expect(overflowTrigger).toHaveAttribute("aria-expanded", "false");
      await expect(overflowTrigger).toBeFocused();
      await window.evaluate(() => {
        document.body.tabIndex = -1;
        document.body.focus();
        document.body.removeAttribute("tabindex");
      });
      await window.mouse.move(720, 500);

      await expect(window).toHaveScreenshot("identity-light.png", {
        animations: "disabled",
        caret: "hide",
        maxDiffPixels: 100,
        scale: "css",
      });
      expect(await interactiveTypeIssues(window, 12)).toEqual([]);
      expect(
        await contrastRatio(
          window,
          ".editor-pane .pane-visibility-toggle",
          ".editor-pane .pane-header",
        ),
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        await contrastRatio(
          window,
          ".preview-pane .pane-visibility-toggle",
          ".preview-pane .pane-header",
        ),
      ).toBeGreaterThanOrEqual(4.5);

      if ((await overflowTrigger.getAttribute("aria-expanded")) !== "true") {
        await overflowTrigger.click();
      }
      await window.locator('[data-overflow-action="theme"]').click();
      await expect(window.locator("html")).toHaveAttribute(
        "data-theme",
        "dark",
      );
      await expect(window).toHaveScreenshot("identity-dark.png", {
        animations: "disabled",
        caret: "hide",
        maxDiffPixels: 100,
        scale: "css",
      });
      expect(await interactiveTypeIssues(window, 12)).toEqual([]);

      await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(2);
      });
      await expect
        .poll(() =>
          window.evaluate(() => {
            const header = document.querySelector<HTMLElement>(".topbar");
            return (
              document.documentElement.scrollWidth - globalThis.innerWidth <= 0 &&
              Boolean(header && header.scrollWidth - header.clientWidth <= 0)
            );
          }),
        )
        .toBe(true);
      await app.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.webContents.setZoomFactor(1);
      });

      if (process.env.RAAVI_DESKTOP_ONLY === "1") return;
      await window.setViewportSize({ width: 320, height: 844 });
      await expect(window.locator(".mobile-tabs")).toBeVisible();
      await expect(window.locator(".topbar-action--open")).toBeVisible();
      await expect(window.locator(".topbar-action--open .action-label")).toBeHidden();
      await expect(window.locator(".save-indicator")).toHaveCSS(
        "font-size",
        "13px",
      );
      expect(
        await window.locator(".topbar button:visible").evaluateAll((buttons) =>
          buttons
            .map((button) => {
              const rect = button.getBoundingClientRect();
              return { height: rect.height, width: rect.width };
            })
            .filter(({ height, width }) => height < 44 || width < 44),
        ),
      ).toEqual([]);
      expect(
        await window.evaluate(
          () => document.documentElement.scrollWidth - globalThis.innerWidth,
        ),
      ).toBeLessThanOrEqual(0);
      await expect(window).toHaveScreenshot("identity-shell-320.png", {
        animations: "disabled",
        caret: "hide",
        maxDiffPixels: 100,
        scale: "css",
      });
      const mobileTypeIssues = await interactiveTypeIssues(window, 13);
      const mobileTypeContext = await window.evaluate(() => ({
        innerWidth: globalThis.innerWidth,
        labelToken: getComputedStyle(document.documentElement)
          .getPropertyValue("--type-ui-label")
          .trim(),
        saveIndicator: getComputedStyle(
          document.querySelector<HTMLElement>(".save-indicator")!,
        ).fontSize,
      }));
      expect(mobileTypeIssues, JSON.stringify(mobileTypeContext)).toEqual([]);
    } finally {
      await app.close();
      await rm(userDataPath, { recursive: true, force: true });
    }
  });
});
