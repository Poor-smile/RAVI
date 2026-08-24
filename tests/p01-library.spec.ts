import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("P01 assembles the populated 304px Library panel from Figma", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const fixtureBase = await mkdtemp(path.join(os.tmpdir(), "raavi-p01-"));
  const libraryRoot = path.join(fixtureBase, "نوشته‌ها");

  try {
    await mkdir(path.join(libraryRoot, "پروژه کتاب"), { recursive: true });
    await Promise.all([
      writeFile(
        path.join(libraryRoot, "راهنمای راوی.md"),
        "# نوشتن برای خوانده‌شدن\n\nمتن خوب پیش از آن‌که زیبا باشد، مسیر خواندن را روشن می‌کند.",
        "utf8",
      ),
      writeFile(
        path.join(libraryRoot, "یادداشت روزانه.md"),
        "# یادداشت روزانه\n\nمتن محلی",
        "utf8",
      ),
      writeFile(
        path.join(libraryRoot, "پژوهش زبان.ravi"),
        JSON.stringify({ version: 1, markdown: "# پژوهش زبان" }),
        "utf8",
      ),
      writeFile(
        path.join(libraryRoot, "پروژه کتاب", "فصل نخست.md"),
        "# فصل نخست",
        "utf8",
      ),
    ]);

    await page.setViewportSize({ width: 1280, height: 914 });
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("raavi:sidebar:v1");
      localStorage.removeItem("raavi:file-tree:v1");
      localStorage.removeItem("raavi:workspace:v2");
    });
    await page.reload();
    await expect(page.locator(".app-shell")).toHaveAttribute(
      "data-hydrated",
      "true",
    );

    await page.locator("input[webkitdirectory]").setInputFiles(libraryRoot);
    await page.getByRole("button", { name: "کتابخانه", exact: true }).click();

    const shell = page.locator("#library-panel");
    await expect(shell).toHaveClass(/is-open/);
    await expect(page.locator("#sidebar-pane-title")).toHaveText("کتابخانه");
    await expect(
      page.getByRole("button", { name: "جست‌وجو در کتابخانه" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "جمع‌کردن نوار کناری" }),
    ).toBeVisible();

    const tree = page.getByRole("tree", { name: "کاوشگر فایل‌های محلی" });
    const root = tree.getByRole("treeitem", { name: "نوشته‌ها" });
    await expect(root).toBeVisible();
    await root.click();
    const guide = tree.getByRole("treeitem", { name: "راهنمای راوی.md" });
    await expect(guide).toBeVisible();
    await guide.click();
    await expect(page.locator(".document-identity")).toContainText(
      "راهنمای راوی.md",
    );
    const leaveReading = page.getByRole("button", {
      name: "بازگشت به میز",
      exact: true,
    });
    if (await leaveReading.isVisible()) await leaveReading.click();
    await page.getByRole("button", { name: "کتابخانه", exact: true }).click();
    await expect(shell).toHaveClass(/is-open/);
    await page.waitForTimeout(260);

    const geometry = await page.evaluate(() => {
      const rect = (selector: string) => {
        const bounds = document
          .querySelector<HTMLElement>(selector)!
          .getBoundingClientRect();
        return {
          x: Math.round(bounds.x),
          y: Math.round(bounds.y),
          width: Math.round(bounds.width),
          height: Math.round(bounds.height),
        };
      };
      const style = (selector: string) =>
        getComputedStyle(document.querySelector<HTMLElement>(selector)!);

      return {
        titlebar: rect(".topbar"),
        commandbar: rect(".proofbar"),
        shell: rect("#library-panel"),
        pane: rect("#library-panel .sidebar-pane"),
        rail: rect("#library-panel .sidebar-rail"),
        header: rect("#library-panel .sidebar-pane-header"),
        folderHeader: rect(
          "#library-panel .library-folders-section .library-section-title",
        ),
        document: rect('[data-workspace-screen="writing"] .editor-pane'),
        headerType: {
          size: style("#sidebar-pane-title").fontSize,
          line: style("#sidebar-pane-title").lineHeight,
        },
        neutralBorder: style(
          "#library-panel .file-explorer-row:not(.is-active)",
        ).borderWidth,
        selectedBackground: style(
          "#library-panel .file-explorer-row.is-active",
        ).backgroundColor,
        selectedStroke: style(
          "#library-panel .file-explorer-row.is-active",
        ).boxShadow,
        documentHeadingSize: style(
          '[data-workspace-screen="writing"] .cm-live-heading-1',
        ).fontSize,
        inactiveBlockBackground: style(
          '[data-workspace-screen="writing"] .cm-activeLine',
        ).backgroundColor,
      };
    });

    expect(geometry.titlebar.height).toBe(36);
    expect(geometry.commandbar.height).toBe(56);
    expect(geometry.shell).toEqual({ x: 920, y: 92, width: 360, height: 822 });
    expect(geometry.pane).toEqual({ x: 920, y: 92, width: 304, height: 822 });
    expect(geometry.rail).toEqual({ x: 1224, y: 92, width: 56, height: 822 });
    expect(geometry.header).toEqual({ x: 934, y: 106, width: 276, height: 52 });
    expect(geometry.folderHeader).toEqual({
      x: 934,
      y: 166,
      width: 276,
      height: 40,
    });
    expect(geometry.document).toEqual({
      x: 80,
      y: 144,
      width: 760,
      height: 754,
    });
    expect(geometry.headerType).toEqual({ size: "12px", line: "18px" });
    expect(geometry.neutralBorder).toBe("0px");
    expect(geometry.selectedBackground).toBe("rgb(233, 239, 255)");
    expect(geometry.selectedStroke).toContain("rgb(37, 87, 229)");
    expect(geometry.documentHeadingSize).toBe("30px");
    expect(geometry.inactiveBlockBackground).toBe("rgba(0, 0, 0, 0)");

    await expect(page.locator("#library-panel .file-explorer-row").first()).toHaveCSS(
      "height",
      "36px",
    );
    await expect(
      page.locator("#library-panel .file-explorer-row.is-active .file-explorer-meta"),
    ).toHaveText("فعال");
    await expect(
      page.locator("#library-panel .file-explorer-row.is-active .file-explorer-action"),
    ).toBeVisible();
    await expect(page.locator(".cm-live-syntax-is-visible")).toHaveCount(0);
    await expect(page.locator(".writing-block-gutter")).toBeHidden();
    await expect(page.locator("#library-panel .library-privacy")).toHaveText(
      "فقط روی این دستگاه · فایل‌ها به اینترنت ارسال نمی‌شوند",
    );
    await expect(page.locator("#library-panel .library-privacy svg")).toBeHidden();
    await expect(
      page.locator('#library-panel .sidebar-rail > button[aria-current="page"]'),
    ).toHaveAttribute("aria-label", "کتابخانه");

    await expect(page.locator(".toast")).toBeHidden({ timeout: 5_000 });
    await page.screenshot({
      path: ".artifacts/p01-library.png",
      fullPage: true,
    });
  } finally {
    await rm(fixtureBase, { recursive: true, force: true });
  }
});
