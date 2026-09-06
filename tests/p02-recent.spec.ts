import { expect, test } from "@playwright/test";
import { dismissFirstRunIfNeeded } from "./helpers/electron-main-window";

test("P02 assembles the independent compact Recent panel from Figma", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const now = new Date();
  const todayAt = (hour: number, minute: number) => {
    const date = new Date(now);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };
  const yesterdayAt = (hour: number, minute: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() - 1);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  };
  const recents = [
    {
      path: "C:\\Raavi\\راهنمای راوی.md",
      name: "راهنمای راوی.md",
      documentType: "markdown" as const,
      openedAt: todayAt(14, 32),
    },
    {
      path: "C:\\Raavi\\پژوهش زبان.ravi",
      name: "پژوهش زبان.ravi",
      documentType: "ravi" as const,
      openedAt: todayAt(12, 10),
    },
    {
      path: "C:\\Raavi\\یادداشت روزانه.md",
      name: "یادداشت روزانه.md",
      documentType: "markdown" as const,
      openedAt: yesterdayAt(18, 45),
    },
    {
      path: "C:\\Raavi\\فصل دوم.md",
      name: "فصل دوم.md",
      documentType: "markdown" as const,
      openedAt: yesterdayAt(9, 20),
    },
  ];

  await page.addInitScript((recentFiles) => {
    const documents = new Map(
      recentFiles.map((recent) => [
        recent.path,
        {
          name: recent.name,
          path: recent.path,
          documentType: recent.documentType,
          content: `# ${recent.name}\n\nمتن سند محلی`,
          revision: 1,
          versions: [],
          annotations: [],
          assets: [],
          openInReadingMode: false,
        },
      ]),
    );
    Object.defineProperty(window, "raaviDesktop", {
      configurable: true,
      value: {
        isDesktop: true,
        getLocalDocumentSnapshot: async () => null,
        saveLocalDocumentSnapshot: async () => ({ saved: true }),
        saveReadingPositions: async () => ({ saved: true }),
        saveReadingPositionsSync: () => ({ saved: true }),
        getLibraryState: async () => ({ folders: [], recents: recentFiles }),
        chooseMarkdownFolder: async () => null,
        scanMarkdownFolder: async () => ({
          rootName: "",
          rootPath: "",
          files: [],
          truncated: false,
        }),
        readLibraryDocument: async () => {
          throw new Error("NOT_USED");
        },
        readLibrarySearchText: async () => ({ content: "" }),
        chooseDocument: async () => null,
        openRecentDocument: async (filePath: string) => {
          const document = documents.get(filePath);
          if (!document) throw new Error("NOT_FOUND");
          return document;
        },
        saveMarkdown: async () => ({ saved: false }),
        saveRaavi: async () => ({ saved: false }),
        saveCurrentDocument: async () => ({ saved: false }),
        saveWordExport: async () => ({ saved: false }),
        exportPdf: async () => ({ saved: false }),
        rendererReady: () => undefined,
        onOpenMarkdownFile: () => () => undefined,
      },
    });
  }, recents);

  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );

  await dismissFirstRunIfNeeded(page);
  await page.getByRole("button", { name: "تاریخچه", exact: true }).click();
  const panel = page.locator("#recent-files-panel");
  await expect(panel).toBeVisible();
  await expect(page.locator("#sidebar-pane-title")).toHaveText("تاریخچه");
  await expect(panel.getByRole("heading", { name: "امروز" })).toBeVisible();
  await expect(panel.getByRole("heading", { name: "دیروز" })).toBeVisible();
  await expect(panel.locator("[data-recent-row]")).toHaveCount(4);
  await expect(panel).toContainText(
    "فقط روی این دستگاه · فایل‌ها به اینترنت ارسال نمی‌شوند",
  );
  await expect(panel).not.toContainText("C:\\Raavi");
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
      rowHeight: rect("#recent-files-panel [data-recent-row]").height,
      neutralBorder: style(
        "#recent-files-panel [data-recent-row]:not(.is-active)",
      ).borderWidth,
      titleSize: style("#recent-files-panel .recent-files-name").fontSize,
      metaSize: style("#recent-files-panel time").fontSize,
    };
  });

  expect(geometry.shell).toEqual({ x: 920, y: 92, width: 360, height: 822 });
  expect(geometry.pane).toEqual({ x: 920, y: 92, width: 304, height: 822 });
  expect(geometry.rail).toEqual({ x: 1224, y: 92, width: 56, height: 822 });
  expect(geometry.header).toEqual({ x: 934, y: 106, width: 276, height: 52 });
  expect(geometry.rowHeight).toBe(36);
  expect(geometry.neutralBorder).toBe("0px");
  expect(geometry.titleSize).toBe("12px");
  expect(geometry.metaSize).toBe("11px");

  const firstRow = panel.getByRole("button", { name: /راهنمای راوی\.md/ });
  const secondRow = panel.getByRole("button", { name: /پژوهش زبان\.ravi/ });
  await firstRow.focus();
  await page.keyboard.press("ArrowDown");
  await expect(secondRow).toBeFocused();
  await page.keyboard.press("Home");
  await expect(firstRow).toBeFocused();

  await firstRow.click();
  await expect(page.locator(".document-identity")).toContainText(
    "راهنمای راوی.md",
  );
  const leaveReading = page.getByRole("button", {
    name: "بازگشت به میز",
    exact: true,
  });
  if (await leaveReading.isVisible()) await leaveReading.click();
  await page.getByRole("button", { name: "تاریخچه", exact: true }).click();
  await expect(panel).toBeVisible();
  const selectedRow = panel.getByRole("button", { name: /راهنمای راوی\.md/ });
  await expect(selectedRow).toHaveAttribute("aria-current", "page");
  await expect(selectedRow).toHaveCSS("background-color", "rgb(233, 239, 255)");
  await expect(selectedRow).toHaveCSS("box-shadow", /rgb\(37, 87, 229\)/);

  const searchButton = page.getByRole("button", {
    name: "جست‌وجو در فایل‌های اخیر",
  });
  await searchButton.click();
  const searchInput = page.getByRole("searchbox", {
    name: "جست‌وجو در فایل‌های اخیر",
  });
  await expect(searchInput).toBeFocused();
  await searchInput.fill("پژوهش");
  await expect(panel.locator("[data-recent-row]")).toHaveCount(1);
  await expect(panel).toContainText("پژوهش زبان.ravi");
  await page.keyboard.press("Escape");
  await expect(searchInput).toBeHidden();
  await expect(searchButton).toBeFocused();

  await page.screenshot({
    path: ".artifacts/p02-recent.png",
    fullPage: true,
  });

  await page.getByRole("button", { name: "جمع‌کردن نوار کناری" }).click();
  await expect(page.locator("#library-panel")).toHaveClass(/is-collapsed/);
});
