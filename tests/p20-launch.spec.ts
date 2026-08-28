import { expect, test, type Page } from "@playwright/test";

const ROOT_PATH = "C:\\یادداشت‌ها\\مخزن راوی";

async function waitForLaunch(page: Page) {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await expect(page.locator(".launch-returning")).toBeVisible();
  await expect(page.locator("[data-launch-recent-card]")).toHaveCount(9);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(({ rootPath }) => {
    localStorage.clear();
    const now = Date.now();
    const names = [
      "گزارش سالانه.md",
      "برنامه محصول.md",
      "یادداشت جلسه.md",
      "راهنمای انتشار.md",
      "تحقیق کاربران.md",
      "پیشنهاد پروژه.md",
      "چک‌لیست نسخه.md",
      "مستند API.md",
      "آرشیو فصل سوم.md",
    ];
    const removedPaths = new Set<string>(
      JSON.parse(sessionStorage.getItem("p20:removed-recents") ?? "[]"),
    );
    const recents = names.map((name, index) => ({
      path:
        index === 0
          ? `C:\\بایگانی خارج از مخزن\\${name}`
          : `${rootPath}\\${name}`,
      name,
      documentType: "markdown",
      // Deliberately oppose open order and edit order: Launch must use mtime.
      openedAt: new Date(now - (names.length - index) * 3_600_000).toISOString(),
      lastModified: now - index * 3_600_000,
    })).filter((recent) => !removedPaths.has(recent.path));
    const scan = {
      rootName: "مخزن راوی",
      rootPath,
      truncated: false,
      errors: [],
      files: names.map((name, index) => ({
        id: `${rootPath}\\${name}`,
        name,
        path: name,
        nativePath: `${rootPath}\\${name}`,
        size: 1200 + index,
        lastModified: now - index * 3_600_000,
        documentType: "markdown",
      })),
    };
    const api = {
      isDesktop: true as const,
      getLocalDocumentSnapshot: async () => null,
      saveLocalDocumentSnapshot: async () => ({ saved: true }),
      saveReadingPositions: async () => ({ saved: true }),
      saveReadingPositionsSync: () => ({ saved: true }),
      getLibraryState: async () => ({
        folders: [{ rootName: "مخزن راوی", rootPath }],
        recents,
      }),
      getCodexConnectionStatus: async () => ({
        state: "connected" as const,
        cliInstalled: true,
        authenticated: true,
      }),
      getBackupProviderConnections: async () => ({
        "google-drive": {
          state: "connected" as const,
          accountEmail: "test@example.com",
        },
        "proton-drive": { state: "disconnected" as const, accountEmail: "" },
      }),
      clearRecentFiles: async () => ({ folders: [], recents: [] }),
      removeRecentFileIfMissing: async (filePath: string) => {
        const testWindow = window as typeof window & {
          __recentFailure?: "missing" | "transient";
        };
        if (testWindow.__recentFailure !== "missing") {
          return {
            removed: false,
            state: {
              folders: [{ rootName: "مخزن راوی", rootPath }],
              recents,
            },
          };
        }
        removedPaths.add(filePath);
        sessionStorage.setItem(
          "p20:removed-recents",
          JSON.stringify([...removedPaths]),
        );
        return {
          removed: true,
          state: {
            folders: [{ rootName: "مخزن راوی", rootPath }],
            recents: recents.filter((recent) => recent.path !== filePath),
          },
        };
      },
      chooseMarkdownFolder: async () => scan,
      disconnectLibraryFolder: async () => ({ folders: [], recents: [] }),
      scanMarkdownFolder: async () => scan,
      readLibraryDocument: async (path: string) => {
        const testWindow = window as typeof window & {
          __openedRecent?: string;
          __recentFailure?: "missing" | "transient";
        };
        testWindow.__openedRecent = path;
        if (testWindow.__recentFailure) {
          throw new Error(testWindow.__recentFailure);
        }
        return {
          name: path.split(/[\\/]/u).at(-1) ?? "سند.md",
          path,
          documentType: "markdown" as const,
          content: "# سند بازشده\n\nمحتوای محلی",
          annotations: [],
          assets: [],
          revision: 1,
          versions: [],
          openInReadingMode: true,
        };
      },
      readLibrarySearchText: async () => ({ content: "" }),
      mutateLibrary: async () => ({ result: { kind: "create-file" }, scan }),
      undoLibraryMutation: async () => ({ result: { kind: "undo" }, scan }),
      onLibraryChanged: () => () => {},
      chooseDocument: async () => null,
      openRecentDocument: async (path: string) => {
        const testWindow = window as typeof window & {
          __openedRecent?: string;
          __recentFailure?: "missing" | "transient";
        };
        testWindow.__openedRecent = path;
        if (testWindow.__recentFailure) {
          throw new Error(testWindow.__recentFailure);
        }
        return {
          name: path.split(/[\\/]/u).at(-1) ?? "سند.md",
          path,
          documentType: "markdown" as const,
          content: "# سند بازشده\n\nمحتوای محلی",
          annotations: [],
          assets: [],
          revision: 1,
          versions: [],
          openInReadingMode: true,
        };
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
  }, { rootPath: ROOT_PATH });
});

test("P20 matches the returning-user Launch frame and opens a real recent file", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await waitForLaunch(page);

  await expect(page.getByRole("heading", { name: "خوش آمدید" })).toBeVisible();
  await expect(page.getByText("۹ فایل اخیر", { exact: true })).toBeVisible();
  await expect(page.locator(".topbar")).toBeHidden();
  await expect(page.locator(".document-tabs")).toBeHidden();

  const cards = page.locator("[data-launch-recent-card]");
  await expect(cards.first()).toBeFocused();
  await expect(cards.first()).toHaveClass(/is-active/);
  await expect(cards.first()).toContainText("گزارش سالانه");
  await expect(cards.first()).toHaveAttribute("tabindex", "0");
  await expect(cards.nth(1)).toHaveAttribute("tabindex", "-1");
  await expect
    .poll(() => cards.evaluateAll((items) => items.filter((item) => item.tabIndex === 0).length))
    .toBe(1);

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
    const rows = Array.from(
      document.querySelectorAll<HTMLElement>("[data-launch-recent-card]"),
      (card) => ({
        width: Math.round(card.getBoundingClientRect().width),
        height: Math.round(card.getBoundingClientRect().height),
      }),
    );
    return {
      launch: rect(".launch-returning"),
      heading: rect(".launch-returning__heading"),
      grid: rect(".launch-recent-grid"),
      rows,
    };
  });
  expect(geometry.launch).toEqual({ x: 0, y: 0, width: 1440, height: 1024 });
  expect(geometry.heading).toEqual({ x: 120, y: 54, width: 1200, height: 100 });
  expect(geometry.grid).toEqual({ x: 120, y: 182, width: 1200, height: 732 });
  expect(new Set(geometry.rows.map((row) => row.width))).toEqual(new Set([384]));
  expect(new Set(geometry.rows.map((row) => row.height))).toEqual(new Set([232]));

  await page.screenshot({
    path: ".artifacts/p20-launch-desktop.png",
    fullPage: false,
  });

  await page.keyboard.press("ArrowLeft");
  await expect(cards.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(cards.nth(4)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".launch-returning")).toBeHidden();
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as typeof window & { __openedRecent?: string }).__openedRecent,
      ),
    )
    .toContain("تحقیق کاربران.md");
});

test("P20 adapts Launch to one touch-safe mobile column without overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await waitForLaunch(page);

  const mobile = await page.evaluate(() => ({
    launchWidth: Math.round(
      document.querySelector<HTMLElement>(".launch-returning")!.getBoundingClientRect()
        .width,
    ),
    cardWidths: Array.from(
      document.querySelectorAll<HTMLElement>("[data-launch-recent-card]"),
      (card) => Math.round(card.getBoundingClientRect().width),
    ),
    actionHeight: Math.round(
      document.querySelector<HTMLElement>(".launch-recent-open")!.getBoundingClientRect()
        .height,
    ),
    pageOverflow:
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  }));
  expect(mobile.launchWidth).toBe(390);
  expect(new Set(mobile.cardWidths)).toEqual(new Set([358]));
  expect(mobile.actionHeight).toBeGreaterThanOrEqual(44);
  expect(mobile.pageOverflow).toBeLessThanOrEqual(0);

  await page.screenshot({
    path: ".artifacts/p20-launch-mobile.png",
    fullPage: false,
  });
});

test("P20 removes a missing recent entry and keeps recovery visible locally", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await waitForLaunch(page);
  await page.evaluate(() => {
    (window as typeof window & {
      __recentFailure?: "missing";
    }).__recentFailure = "missing";
  });

  await page.keyboard.press("End");
  await expect(page.locator("[data-launch-recent-card]").last()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator(".launch-returning__error")).toContainText(
    "این فایل در مسیر قبلی پیدا نشد",
  );
  await expect(page.locator("[data-launch-recent-card]")).toHaveCount(8);
  await expect(page.getByText("۸ فایل اخیر", { exact: true })).toBeVisible();
  await expect(page.locator("[data-launch-recent-card]").last()).toBeFocused();
  await expect(page.locator("[data-launch-recent-card]").last()).toHaveAttribute(
    "tabindex",
    "0",
  );
  await page.reload();
  await expect(page.locator(".launch-returning")).toBeVisible();
  await expect(page.locator("[data-launch-recent-card]")).toHaveCount(8);
  await expect(page.getByText("۸ فایل اخیر", { exact: true })).toBeVisible();
});

test("P20 keeps a healthy Recent after a transient open failure", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await waitForLaunch(page);
  await page.evaluate(() => {
    (window as typeof window & {
      __recentFailure?: "transient";
    }).__recentFailure = "transient";
  });

  await page.locator("[data-launch-recent-card]").first().click();
  await expect(page.locator(".launch-returning__error")).toContainText(
    "باز کردن فایل انجام نشد",
  );
  await expect(page.locator("[data-launch-recent-card]")).toHaveCount(9);
  await expect(page.getByText("۹ فایل اخیر", { exact: true })).toBeVisible();
});

test("New Tab matches the compact 59 Screens template workspace in full RTL", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await waitForLaunch(page);
  await page.locator("[data-launch-recent-card]").first().click();
  await expect(page.locator(".launch-returning")).toBeHidden();

  await page.keyboard.press("Control+n");
  const newTab = page.locator(".new-tab-workspace:not(.launch-returning)");
  const cards = newTab.locator("[data-note-template-card]");
  await expect(newTab).toBeVisible();
  await expect(cards).toHaveCount(12);
  await expect(cards.first()).toBeFocused();
  await expect(cards.first()).toContainText("یادداشت خالی");
  await expect(newTab.getByText("مخزن راوی", { exact: true })).toBeVisible();
  const newWorkspaceTab = page.getByRole("tab", { name: "تب جدید", exact: true });
  await expect(newWorkspaceTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: "بستن تب جدید" })).toBeVisible();

  const geometry = await newTab.evaluate((node) => {
    const rect = (selector: string) => {
      const element = selector === ":scope"
        ? node
        : node.querySelector<HTMLElement>(selector)!;
      const bounds = element.getBoundingClientRect();
      return {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    return {
      surface: rect(":scope"),
      header: rect(":scope > header"),
      office: rect(".new-tab-workspace__office"),
      grid: rect(".note-template-grid"),
      footer: rect(":scope > footer"),
      cards: Array.from(
        node.querySelectorAll<HTMLElement>("[data-note-template-card]"),
        (card) => ({
          x: Math.round(card.getBoundingClientRect().x),
          width: Math.round(card.getBoundingClientRect().width),
          height: Math.round(card.getBoundingClientRect().height),
          direction: getComputedStyle(card).direction,
        }),
      ),
    };
  });
  expect(geometry.surface).toEqual({ x: 0, y: 128, width: 1224, height: 786 });
  expect(geometry.header).toEqual({ x: 232, y: 166, width: 760, height: 58 });
  expect(geometry.office).toEqual({ x: 232, y: 166, width: 280, height: 58 });
  expect(geometry.grid).toEqual({ x: 232, y: 294, width: 760, height: 458 });
  expect(geometry.footer).toEqual({ x: 232, y: 802, width: 760, height: 24 });
  expect(new Set(geometry.cards.map((card) => card.width))).toEqual(new Set([372]));
  expect(new Set(geometry.cards.map((card) => card.height))).toEqual(new Set([68]));
  expect(new Set(geometry.cards.map((card) => card.direction))).toEqual(new Set(["rtl"]));

  await page.screenshot({
    path: ".artifacts/p20-new-tab-templates.png",
    fullPage: false,
  });

  await page.keyboard.press("ArrowLeft");
  await expect(cards.nth(1)).toBeFocused();
  await expect(cards.nth(1)).toContainText("یادداشت سریع");
  await page.keyboard.press("ArrowDown");
  await expect(cards.nth(3)).toBeFocused();
});
