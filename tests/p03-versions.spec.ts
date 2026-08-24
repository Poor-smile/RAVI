import { expect, test } from "@playwright/test";

test("P03 assembles the independent local Versions panel from Figma", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const now = new Date();
  const at = (dayOffset: number, hour: number, minute: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + dayOffset);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };
  const currentContent = "# نوشتن برای خوانده‌شدن\n\nمتن فعلی سند";
  const versions = [
    {
      number: 1,
      savedAt: at(-1, 9, 20),
      content: "# نسخه یک\n\nمتن قدیمی",
      annotations: [],
      kind: "autosave" as const,
    },
    {
      number: 2,
      savedAt: at(-1, 18, 45),
      content: "# نسخه دو\n\nمتن دیروز",
      annotations: [],
      kind: "manual" as const,
    },
    {
      number: 3,
      savedAt: at(0, 14, 10),
      content: "# نسخه سه\n\nذخیره دستی",
      annotations: [],
      kind: "manual" as const,
    },
    {
      number: 4,
      savedAt: at(0, 14, 32),
      content: "# نسخه چهار\n\nنسخه قابل بازیابی",
      annotations: [],
      kind: "autosave" as const,
    },
    {
      number: 5,
      savedAt: at(0, 15, 0),
      content: currentContent,
      annotations: [],
      kind: "manual" as const,
    },
  ];
  const activePath = "C:\\Raavi\\راهنمای راوی.md";

  await page.addInitScript(
    ({ content, documentPath, documentVersions }) => {
      const p03State = {
        refreshMode: "success" as "success" | "error" | "empty",
        readCalls: 0,
        openRecentCalls: 0,
        savedVersionCount: 0,
        saveShouldFail: false,
      };
      let durableVersions = [...documentVersions];
      Object.assign(window, { __p03State: p03State });
      const openedDocument = {
        name: "راهنمای راوی.md",
        path: documentPath,
        documentType: "markdown" as const,
        content,
        revision: 5,
        versions: documentVersions,
        annotations: [],
        assets: [],
        openInReadingMode: false,
      };
      Object.defineProperty(window, "raaviDesktop", {
        configurable: true,
        value: {
          isDesktop: true,
          getLocalDocumentSnapshot: async () => ({
            content,
            fileName: "راهنمای راوی.md",
            readerSize: 18,
            annotations: [],
            assets: [],
            revision: 5,
            versions: documentVersions,
            activeDocumentPath: documentPath,
            documentType: "markdown",
            lastSavedSnapshot: JSON.stringify({
              content,
              annotations: [],
              assets: [],
            }),
            draftId: "p03-document",
            viewMode: "desk",
            readingOutlineOpen: false,
            readingPositions: {},
          }),
          saveLocalDocumentSnapshot: async () => ({ saved: true }),
          saveReadingPositions: async () => ({ saved: true }),
          saveReadingPositionsSync: () => ({ saved: true }),
          getLibraryState: async () => ({ folders: [], recents: [] }),
          chooseMarkdownFolder: async () => null,
          scanMarkdownFolder: async () => ({
            rootName: "",
            rootPath: "",
            files: [],
            truncated: false,
          }),
          readLibraryDocument: async () => openedDocument,
          readLibrarySearchText: async () => ({ content: "" }),
          chooseDocument: async () => null,
          openRecentDocument: async () => {
            p03State.openRecentCalls += 1;
            return openedDocument;
          },
          readDocumentVersions: async () => {
            p03State.readCalls += 1;
            await new Promise((resolve) => window.setTimeout(resolve, 180));
            if (p03State.refreshMode === "error") {
              throw new Error("P03_TEST_READ_ERROR");
            }
            return {
              revision: 5,
              versions:
                p03State.refreshMode === "empty" ? [] : durableVersions,
            };
          },
          saveMarkdown: async () => ({ saved: false }),
          saveRaavi: async () => ({ saved: false }),
          saveCurrentDocument: async (
            _filePath: string,
            document: { versions: typeof documentVersions },
          ) => {
            if (p03State.saveShouldFail) {
              throw new Error("P03_TEST_SAVE_ERROR");
            }
            durableVersions = [...document.versions];
            p03State.savedVersionCount = durableVersions.length;
            return {
              saved: true,
              filePath: documentPath,
              documentType: "markdown" as const,
            };
          },
          saveWordExport: async () => ({ saved: false }),
          exportPdf: async () => ({ saved: false }),
          rendererReady: () => undefined,
          onOpenMarkdownFile: () => () => undefined,
        },
      });
    },
    {
      content: currentContent,
      documentPath: activePath,
      documentVersions: versions,
    },
  );

  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );

  await page.getByRole("button", { name: "نسخه‌ها", exact: true }).click();
  const panel = page.locator("#library-versions-panel");
  await expect(panel).toBeVisible();
  await expect(page.locator("#sidebar-pane-title")).toHaveText("نسخه‌ها");
  await expect(
    page.getByRole("button", { name: "به‌روزرسانی نسخه‌ها" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "جمع‌کردن نوار کناری" }),
  ).toBeVisible();
  await expect(panel.locator(".versions-current-document")).toContainText(
    "۵ نسخه",
  );
  await expect(panel.locator(".versions-current-document")).toContainText(
    "راهنمای راوی.md",
  );
  await expect(panel.getByRole("heading", { name: "امروز" })).toHaveCount(1);
  await expect(panel.getByRole("heading", { name: "دیروز" })).toHaveCount(1);
  await expect(panel.locator(".versions-row")).toHaveCount(5);
  await expect(panel.locator(".versions-row.is-current")).toContainText(
    "آخرین وضعیت ذخیره‌شده",
  );
  await expect(panel).toContainText("ذخیرهٔ دستی");
  await expect(panel).toContainText("ذخیرهٔ خودکار");
  await expect(panel).toContainText(
    "فقط روی این دستگاه · نسخه‌ها به اینترنت ارسال نمی‌شوند",
  );

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
      shell: rect("#library-panel"),
      pane: rect("#library-panel .sidebar-pane"),
      rail: rect("#library-panel .sidebar-rail"),
      header: rect("#library-panel .sidebar-pane-header"),
      summaryHeight: rect("#library-versions-panel .versions-current-document")
        .height,
      rowHeight: rect("#library-versions-panel .versions-row").height,
      neutralBorder: style(
        "#library-versions-panel .versions-row:not(.is-current)",
      ).borderWidth,
      currentBackground: style(
        "#library-versions-panel .versions-row.is-current",
      ).backgroundColor,
      titleSize: style(
        "#library-versions-panel .versions-row-copy strong",
      ).fontSize,
      metaSize: style(
        "#library-versions-panel .versions-row-copy small",
      ).fontSize,
    };
  });

  expect(geometry.shell).toEqual({ x: 920, y: 92, width: 360, height: 822 });
  expect(geometry.pane).toEqual({ x: 920, y: 92, width: 304, height: 822 });
  expect(geometry.rail).toEqual({ x: 1224, y: 92, width: 56, height: 822 });
  expect(geometry.header).toEqual({ x: 934, y: 106, width: 276, height: 52 });
  expect(geometry.summaryHeight).toBe(40);
  expect(geometry.rowHeight).toBe(56);
  expect(geometry.neutralBorder).toBe("0px");
  expect(geometry.currentBackground).toBe("rgb(245, 246, 240)");
  expect(geometry.titleSize).toBe("12px");
  expect(geometry.metaSize).toBe("11px");

  const historicalRow = panel.locator(".versions-row:not(.is-current)").first();
  const restoreButton = historicalRow.getByRole("button", { name: /بازیابی/ });
  await expect(restoreButton).toBeVisible();
  await expect(restoreButton).toHaveCSS("opacity", "1");
  await page.screenshot({
    path: ".artifacts/p03-versions.png",
    fullPage: true,
  });

  await restoreButton.click();
  await expect(panel.getByRole("alertdialog")).toContainText(
    "این نسخه بازگردانی شود؟",
  );
  await expect(panel.getByRole("alertdialog")).toContainText(
    "وضعیت فعلی ابتدا به‌صورت نسخهٔ جدید ذخیره می‌شود",
  );
  await expect(page.locator("#markdown-editor .cm-content")).toContainText(
    "متن فعلی سند",
  );
  const confirmGeometry = await panel.evaluate((root) => {
    const bounds = (selector: string) => {
      const rect = root.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const buttons = root.querySelectorAll<HTMLElement>(
      ".versions-confirm-actions button",
    );
    const descriptionStyle = getComputedStyle(
      root.querySelector<HTMLElement>("#versions-restore-description")!,
    );
    return {
      cancel: {
        x: Math.round(buttons[0].getBoundingClientRect().x),
        width: Math.round(buttons[0].getBoundingClientRect().width),
      },
      restore: {
        x: Math.round(buttons[1].getBoundingClientRect().x),
        width: Math.round(buttons[1].getBoundingClientRect().width),
      },
      indicator: bounds(".versions-confirm-indicator"),
      descriptionSize: descriptionStyle.fontSize,
      descriptionLineHeight: descriptionStyle.lineHeight,
    };
  });
  expect(confirmGeometry.cancel.width).toBe(confirmGeometry.restore.width);
  expect(confirmGeometry.cancel.x).toBeLessThan(confirmGeometry.restore.x);
  expect(confirmGeometry.indicator).toMatchObject({ width: 36, height: 36 });
  expect(confirmGeometry.descriptionSize).toBe("12px");
  expect(confirmGeometry.descriptionLineHeight).toBe("18px");
  await page.screenshot({
    path: ".artifacts/p03-versions-confirm.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(panel.getByRole("alertdialog")).toHaveCount(0);
  await expect(restoreButton).toBeFocused();

  await page.evaluate(() => {
    (window as typeof window & {
      __p03State: { saveShouldFail: boolean };
    }).__p03State.saveShouldFail = true;
  });
  await restoreButton.click();
  await panel.getByRole("button", { name: "بازگردانی", exact: true }).click();
  await expect(page.locator(".toast")).toContainText(
    "حفظ وضعیت فعلی ممکن نشد",
  );
  await expect(page.locator("#markdown-editor .cm-content")).toContainText(
    "متن فعلی سند",
  );
  await expect(panel.getByRole("alertdialog")).toBeVisible();

  await page.evaluate(() => {
    (window as typeof window & {
      __p03State: { saveShouldFail: boolean };
    }).__p03State.saveShouldFail = false;
  });
  await panel.getByRole("button", { name: "بازگردانی", exact: true }).click();
  await expect(page.locator("#markdown-editor .cm-content")).toContainText(
    "نسخه چهار",
  );
  await expect(panel.locator(".versions-current-document")).toContainText(
    "۶ نسخه",
  );
  await expect(page.locator(".toast")).toContainText("وضعیت فعلی حفظ شد");
  expect(
    await page.evaluate(() =>
      (window as typeof window & {
        __p03State: { savedVersionCount: number };
      }).__p03State.savedVersionCount,
    ),
  ).toBe(6);

  await page.getByRole("button", { name: "به‌روزرسانی نسخه‌ها" }).click();
  await expect(panel).toContainText("در حال خواندن نسخه‌های محلی…");
  await expect(page.locator(".toast")).toContainText("فهرست نسخه‌ها به‌روز شد");
  await expect(panel.locator(".versions-row")).toHaveCount(6);
  expect(
    await page.evaluate(() =>
      (window as typeof window & {
        __p03State: { readCalls: number; openRecentCalls: number };
      }).__p03State,
    ),
  ).toMatchObject({ readCalls: 1, openRecentCalls: 0 });

  await page.evaluate(() => {
    (window as typeof window & {
      __p03State: { refreshMode: "success" | "error" | "empty" };
    }).__p03State.refreshMode = "error";
  });
  await page.getByRole("button", { name: "به‌روزرسانی نسخه‌ها" }).click();
  await expect(panel.getByRole("alert")).toContainText("نسخه‌ها خوانده نشد");
  await expect(panel.getByRole("button", { name: "تلاش دوباره" })).toBeVisible();
  const errorStrip = await panel.locator(".versions-state-icon").evaluate((node) => {
    const bounds = node.getBoundingClientRect();
    return { width: Math.round(bounds.width), height: Math.round(bounds.height) };
  });
  expect(errorStrip).toEqual({ width: 276, height: 48 });

  await page.evaluate(() => {
    (window as typeof window & {
      __p03State: { refreshMode: "success" | "error" | "empty" };
    }).__p03State.refreshMode = "success";
  });
  await panel.getByRole("button", { name: "تلاش دوباره" }).click();
  await expect(panel).toContainText("در حال خواندن نسخه‌های محلی…");
  await expect(panel.locator(".versions-current-document")).toBeVisible();

  await page.evaluate(() => {
    (window as typeof window & {
      __p03State: { refreshMode: "success" | "error" | "empty" };
    }).__p03State.refreshMode = "empty";
  });
  await page.getByRole("button", { name: "به‌روزرسانی نسخه‌ها" }).click();
  await expect(panel).toContainText("هنوز نسخه‌ای برای این سند نیست");
  await expect(panel.locator(".versions-current-document")).toHaveCount(0);
  await expect(panel.locator(".versions-state-icon svg")).toHaveAttribute(
    "data-material-symbol",
    "folder_zip",
  );

  await page.getByRole("button", { name: "جمع‌کردن نوار کناری" }).click();
  await expect(page.locator("#library-panel")).toHaveClass(/is-collapsed/);
});
