import { expect, test } from "@playwright/test";

async function openBackupSettings(page: import("@playwright/test").Page) {
  await page.locator(".header-overflow-trigger").click();
  await page.locator('[data-overflow-action="shortcut-settings"]').click();
  await page
    .getByRole("navigation", { name: "دسته‌های تنظیمات" })
    .getByRole("button", { name: "فایل‌ها و کتابخانه" })
    .click();
  return page.getByRole("dialog", { name: "پشتیبان‌گیری ابری" });
}

test("Backup Settings follows the Raavi shell and persists the user policy", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  const dialog = await openBackupSettings(page);

  await expect(dialog.getByRole("heading", { name: "حساب و فضای ذخیره‌سازی" })).toBeVisible();
  await expect(dialog.locator('img[src$="google-drive-2026.svg"]').first()).toBeVisible();
  await expect(dialog.locator('img[src$="google-sign-in-g.svg"]')).toBeVisible();
  await expect(dialog.getByRole("radio", { name: /Google Drive/u })).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByRole("radio", { name: /Proton Drive/u })).toBeVisible();
  await expect(dialog.getByText("Reading Cache همیشه خارج می‌ماند.")).toBeVisible();

  const switches = dialog.locator(".backup-policy-section [role=switch]");
  await expect(switches).toHaveCount(5);
  await expect(dialog.getByRole("switch", { name: "متن و ساختار" })).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByRole("switch", { name: "تصاویر بهینه‌شده" })).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByRole("switch", { name: "فایل‌های صوتی" })).toHaveAttribute("aria-checked", "false");

  await dialog.getByRole("switch", { name: "فایل‌های صوتی" }).click();
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("raavi:backup-preferences:v1") ?? "{}"),
      ),
    )
    .toMatchObject({
      textAndStructure: true,
      optimizedImages: true,
      audio: true,
      otherAttachments: false,
      versionHistory: true,
    });

  await dialog.getByRole("radio", { name: /Proton Drive/u }).click();
  await expect(dialog.getByRole("button", { name: "اتصال به Proton Drive" })).toBeVisible();
  await dialog.getByRole("button", { name: "اتصال به Proton Drive" }).click();
  await expect(dialog.getByRole("alert")).toContainText("فایل‌های محلی محفوظ‌اند");
  await page.screenshot({ path: ".artifacts/p20-backup-settings-desktop.png" });
});

test("Backup Settings remains touch-safe and horizontally overflow-free", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  const dialog = await openBackupSettings(page);
  const contract = await dialog.evaluate((node) => ({
    overflow: node.scrollWidth - node.clientWidth,
    actionHeights: Array.from(
      node.querySelectorAll<HTMLElement>(".backup-drive-card button, .backup-restore-section button, .backup-policy-section button"),
      (button) => Math.round(button.getBoundingClientRect().height),
    ),
  }));
  expect(contract.overflow).toBeLessThanOrEqual(0);
  for (const height of contract.actionHeights) expect(height).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: ".artifacts/p20-backup-settings-mobile.png" });
});

test("Backup Settings restores every selected cloud document into a safe new folder", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await page.evaluate(() => {
    const preferences = {
      textAndStructure: true,
      optimizedImages: true,
      audio: false,
      otherAttachments: false,
      versionHistory: true,
    };
    Object.defineProperty(window, "raaviDesktop", {
      configurable: true,
      value: {
        isDesktop: true,
        connectBackupProvider: async () => ({
          providerId: "google-drive",
          connection: {
            state: "connected",
            accountEmail: "reader@example.com",
          },
          preferences,
          quota: null,
          queuedDocuments: 0,
          syncState: "up-to-date",
          lastSyncAt: "2026-08-26T10:00:00.000Z",
          lastError: "",
        }),
        listCloudBackups: async () => [
          {
            providerId: "google-drive",
            documentId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            fileName: "پژوهش.md",
            backedUpAt: "2026-08-26T10:00:00.000Z",
            versionCount: 4,
            assetCount: 2,
            audioCount: 0,
            attachmentCount: 0,
            categories: preferences,
          },
          {
            providerId: "google-drive",
            documentId: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            fileName: "یادداشت‌ها.md",
            backedUpAt: "2026-08-25T09:00:00.000Z",
            versionCount: 2,
            assetCount: 0,
            audioCount: 1,
            attachmentCount: 0,
            categories: preferences,
          },
        ],
        restoreCloudBackups: async (documentIds: string[]) => ({
          canceled: false,
          providerId: "google-drive",
          restoreRoot: "C:\\Users\\Reader\\Documents\\Raavi Restore 2026-08-26",
          restored: documentIds.map((documentId, index) => ({
            documentId,
            fileName: index ? "یادداشت‌ها.md" : "پژوهش.md",
            filePath: `C:\\Restore\\${documentId}.md`,
            mediaCount: index ? 1 : 2,
            versionCount: index ? 2 : 4,
          })),
          failed: [],
        }),
        revealCloudRestore: async () => {
          document.documentElement.dataset.restoreRevealed = "true";
          return { revealed: true };
        },
      },
    });
  });

  const dialog = await openBackupSettings(page);
  await dialog.getByRole("button", { name: "اتصال به Google Drive" }).click();
  await expect(dialog.getByText("reader@example.com")).toBeVisible();
  await dialog.getByRole("button", { name: "پیدا کردن بکاپ‌ها" }).click();
  await expect(dialog.locator(".backup-restore-list input")).toHaveCount(2);
  await expect(dialog.getByText("۲ از ۲ سند")).toBeVisible();
  await dialog.getByRole("button", { name: "بازیابی ۲ سند" }).click();
  await expect(dialog.getByText("۲ سند بازیابی شد")).toBeVisible();
  await expect(
    dialog.getByText("C:\\Users\\Reader\\Documents\\Raavi Restore 2026-08-26"),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "نمایش پوشه" }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-restore-revealed",
    "true",
  );
  await page.screenshot({ path: ".artifacts/p20-backup-restore-success.png" });
});
