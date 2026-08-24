import { expect, test } from "@playwright/test";

const EMPTY_BLOCK_PLACEHOLDER =
  "برای نوشتن تایپ کنید؛ برای انتخاب نوع بلاک / را بزنید";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    localStorage.clear();
    const rootPath = "C:\\یادداشت‌ها\\دفتر راوی";
    let createdContent = "";
    let createdName = "";
    const scan = () => ({
      rootName: "دفتر راوی",
      rootPath,
      truncated: false,
      errors: [],
      files: createdName
        ? [
            {
              id: createdName,
              name: createdName,
              path: createdName,
              nativePath: `${rootPath}\\${createdName}`,
              size: createdContent.length,
              lastModified: Date.now(),
              documentType: "markdown",
            },
          ]
        : [],
    });
    const api = {
      isDesktop: true as const,
      getLocalDocumentSnapshot: async () => null,
      saveLocalDocumentSnapshot: async () => ({ saved: true }),
      saveReadingPositions: async () => ({ saved: true }),
      saveReadingPositionsSync: () => ({ saved: true }),
      getLibraryState: async () => ({
        folders: [{ rootName: "دفتر راوی", rootPath }],
        recents: [],
      }),
      clearRecentFiles: async () => ({ folders: [], recents: [] }),
      chooseMarkdownFolder: async () => scan(),
      disconnectLibraryFolder: async () => ({ folders: [], recents: [] }),
      scanMarkdownFolder: async () => scan(),
      readLibraryDocument: async () => ({
        name: createdName,
        path: `${rootPath}\\${createdName}`,
        documentType: "markdown" as const,
        content: createdContent,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        openInReadingMode: false,
      }),
      readLibrarySearchText: async () => ({ content: createdContent }),
      mutateLibrary: async (_rootPath: string, request: { name: string; content?: string }) => {
        createdName = request.name;
        createdContent = request.content ?? "";
        return {
          result: {
            kind: "create-file",
            rootId: rootPath.toLocaleLowerCase("en-US"),
            nextPath: createdName,
          },
          scan: scan(),
        };
      },
      undoLibraryMutation: async () => ({ result: { kind: "undo", rootId: rootPath }, scan: scan() }),
      onLibraryChanged: () => () => {},
      chooseDocument: async () => null,
      openRecentDocument: async () => {
        throw new Error("not used");
      },
      saveMarkdown: async () => ({ saved: true }),
      saveRaavi: async () => ({ saved: true }),
      saveCurrentDocument: async () => ({ saved: true }),
      saveWordExport: async () => ({ saved: false }),
      exportPdf: async () => ({ saved: false }),
      rendererReady: () => {},
      onOpenMarkdownFile: () => () => {},
    };
    Object.defineProperty(window, "raaviDesktop", {
      configurable: true,
      value: api,
    });
  });
});

test("P0 creates Persian template documents in the active office and keeps keyboard tabs", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByRole("heading", { name: "از کجا شروع می‌کنید؟" })).toBeVisible();
  await expect(page.locator(".note-template-card")).toHaveCount(12);
  await expect(page.locator(".document-tabs")).toHaveCSS("height", "36px");

  const sourceTabs = page.getByRole("tablist", { name: "روش شروع سند" });
  await expect(sourceTabs.getByRole("tab", { name: /قالب‌ها/u })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(sourceTabs.getByRole("tab", { name: /اخیر/u })).toBeDisabled();

  const templateContract = await page.locator(".note-template-card").evaluateAll((cards) =>
    cards.map((card) => ({
      id: card.getAttribute("data-template-id"),
      icon: card.querySelector("[data-material-symbol]")?.getAttribute("data-material-symbol"),
    })),
  );
  expect(templateContract.map(({ id }) => id)).toHaveLength(12);
  expect(new Set(templateContract.map(({ icon }) => icon)).size).toBe(12);

  const templatePositions = await page.evaluate(() => {
    const blank = document.querySelector<HTMLElement>('[data-template-id="blank"]')!;
    const quick = document.querySelector<HTMLElement>('[data-template-id="quick-note"]')!;
    const blankRect = blank.getBoundingClientRect();
    const quickRect = quick.getBoundingClientRect();
    return {
      blank: { x: Math.round(blankRect.x), y: Math.round(blankRect.y) },
      quick: { x: Math.round(quickRect.x), y: Math.round(quickRect.y) },
    };
  });
  expect(templatePositions.blank.y).toBe(templatePositions.quick.y);
  expect(templatePositions.blank.x).toBeGreaterThan(templatePositions.quick.x);

  const firstTemplate = page.getByRole("button", { name: /یادداشت خالی/u });
  await firstTemplate.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("button", { name: /یادداشت سریع/u })).toBeFocused();
  await page.getByRole("button", { name: /گزارش مالی/u }).click();

  await expect(page.locator("#markdown-editor .cm-content")).toContainText("گزارش مالی");
  await expect(page.locator(".document-tab")).toHaveCount(1);
  await expect(page.locator(".document-tab.is-active")).toContainText("گزارش مالی");

  await page.keyboard.press("Control+N");
  await expect(page.getByRole("heading", { name: "از کجا شروع می‌کنید؟" })).toBeVisible();
  await expect(page.locator(".document-tab--new-workspace")).toHaveClass(/is-active/);
  await expect(page.locator(".document-tabs__new")).not.toHaveClass(/is-active/);

  const recentTab = sourceTabs.getByRole("tab", { name: /اخیر/u });
  await expect(recentTab).toBeEnabled();
  await recentTab.click();
  await expect(recentTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("[data-new-tab-recent-card]")).toHaveCount(1);
  await expect(page.locator("[data-new-tab-recent-card]").first()).toContainText("گزارش مالی");
  await page.screenshot({ path: ".artifacts/workspace-p0-new-tab-recent.png" });

  await sourceTabs.getByRole("tab", { name: /قالب‌ها/u }).click();
  await expect(page.locator(".note-template-card")).toHaveCount(12);
  await page.screenshot({ path: ".artifacts/workspace-p0-new-tab.png" });

  const geometry = await page.evaluate(() => ({
    tabbar: Math.round(document.querySelector(".document-tabs")!.getBoundingClientRect().height),
    template: Math.round(document.querySelector(".note-template-card")!.getBoundingClientRect().height),
  }));
  expect(geometry).toEqual({ tabbar: 36, template: 68 });
});

test("a blank template activates the first block and exposes its visual-only placeholder", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");

  await page.getByRole("button", { name: /یادداشت خالی/u }).click();

  const editor = page.locator("#markdown-editor .cm-content");
  const firstBlock = editor.locator(
    ".cm-line.cm-activeLine.cm-live-empty-block.cm-live-syntax-is-visible",
  );
  await expect(editor).toBeFocused();
  await expect(firstBlock).toBeVisible();
  await expect(firstBlock).toHaveCount(1);
  expect(
    await firstBlock.evaluate(
      (element) => getComputedStyle(element, "::before").content,
    ),
  ).toBe(`"${EMPTY_BLOCK_PLACEHOLDER}"`);
  await page.screenshot({ path: ".artifacts/workspace-p0-blank-first-block.png" });

  await page.keyboard.type("ن");
  await expect(firstBlock).toHaveCount(0);
  await expect(editor.locator(".cm-activeLine")).toContainText("ن");
});

test("P0 compact settings uses the approved density contract", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.locator(".header-overflow-trigger").click();
  await page.locator('[data-overflow-action="shortcut-settings"]').click();
  await page
    .getByRole("navigation", { name: "دسته‌های تنظیمات" })
    .getByRole("button", { name: "فایل‌ها و دفتر" })
    .click();

  await expect(page.getByRole("heading", { name: "فایل‌ها و دفتر" })).toBeVisible();
  await expect(page.getByText("دفتر فعال")).toBeVisible();
  await expect(page.getByRole("switch", { name: "بازیابی تب‌های نشست قبلی" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  const geometry = await page.evaluate(() => {
    const height = (selector: string) =>
      Math.round(document.querySelector(selector)!.getBoundingClientRect().height);
    const width = (selector: string) =>
      Math.round(document.querySelector(selector)!.getBoundingClientRect().width);
    return {
      header: height(".shortcut-settings-header"),
      navigation: width(".shortcut-settings-nav"),
      row: height(".settings-preference-row"),
      headingSize: getComputedStyle(
        document.querySelector(".shortcut-settings-heading h2")!,
      ).fontSize,
    };
  });
  expect(geometry).toEqual({
    header: 72,
    navigation: 280,
    row: 88,
    headingSize: "30px",
  });
  await page.screenshot({ path: ".artifacts/workspace-p0-settings.png" });
});
