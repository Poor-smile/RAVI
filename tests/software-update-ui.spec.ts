import { expect, test } from "@playwright/test";
import type { SoftwareUpdateState } from "../app/software-update/types";

const availableState: SoftwareUpdateState = {
  phase: "available",
  currentVersion: "2.1.13",
  version: "2.2.0",
  notesUrl: "https://ravi.poorsmile.ir/updates/releases/2.2.0.json",
  downloadedBytes: 0,
  totalBytes: 98 * 1024 * 1024,
  progress: 0,
  checkedAt: new Date().toISOString(),
  message: "",
  installerPath: "",
};

test("software update banner and General Settings card follow the Figma states", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1536, height: 864 });
  await page.addInitScript((initialState) => {
    localStorage.clear();
    localStorage.setItem(
      "raavi:first-run-onboarding:v1",
      JSON.stringify({ completed: true, version: 1 }),
    );
    let updateState = initialState;
    let listener: ((state: typeof initialState) => void) | null = null;
    const calls = { cancel: 0 };
    Object.assign(window, {
      __raaviUpdateTest: {
        calls,
        emit(state: typeof initialState) {
          updateState = state;
          listener?.(state);
        },
      },
      raaviDesktop: {
        isDesktop: true,
        getLocalDocumentSnapshot: async () => null,
        saveLocalDocumentSnapshot: async () => ({ saved: true }),
        saveReadingPositions: async () => ({ saved: true }),
        getLibraryState: async () => ({ folders: [], recents: [] }),
        getCodexConnectionStatus: async () => ({
          state: "connected",
          cliInstalled: true,
          authenticated: true,
        }),
        getBackupProviderConnections: async () => ({
          "google-drive": { state: "connected", accountEmail: "test@example.com" },
          "proton-drive": { state: "disconnected", accountEmail: "" },
        }),
        getBackupStatus: async () => ({
          providerId: "google-drive",
          connection: { state: "connected", accountEmail: "test@example.com" },
          preferences: {
            textAndStructure: true,
            optimizedImages: true,
            audio: false,
            otherAttachments: false,
            versionHistory: true,
          },
          quota: null,
          queueSize: 0,
          lastSyncedAt: "",
          lastError: "",
        }),
        rendererReady: () => {},
        onOpenMarkdownFile: () => () => {},
        getSoftwareUpdateStatus: async () => updateState,
        checkSoftwareUpdate: async () => updateState,
        downloadSoftwareUpdate: async () => updateState,
        pauseSoftwareUpdate: async () => updateState,
        resumeSoftwareUpdate: async () => updateState,
        cancelSoftwareUpdate: async () => {
          calls.cancel += 1;
          return updateState;
        },
        installSoftwareUpdate: async () => ({ started: true }),
        openSoftwareUpdateNotes: async () => ({ opened: true }),
        openSoftwareUpdateDirectDownload: async () => ({ opened: true }),
        onSoftwareUpdateStatusChanged(callback: typeof listener) {
          listener = callback;
          return () => {
            listener = null;
          };
        },
      },
    });
  }, availableState);

  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  const banner = page.locator(".software-update-banner");
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("نسخهٔ جدید آماده است");
  const geometry = await banner.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      right: Math.round(innerWidth - rect.right),
      bottom: Math.round(innerHeight - rect.bottom),
    };
  });
  expect(geometry).toEqual({ width: 380, right: 32, bottom: 32 });

  await banner.getByRole("button", { name: "بستن اعلان به‌روزرسانی" }).click();
  await expect(banner).toBeHidden();
  expect(
    await page.evaluate(
      () => (window as typeof window & { __raaviUpdateTest: { calls: { cancel: number } } }).__raaviUpdateTest.calls.cancel,
    ),
  ).toBe(0);

  await page.evaluate((base) => {
    const testApi = (window as typeof window & {
      __raaviUpdateTest: { emit: (state: typeof base) => void };
    }).__raaviUpdateTest;
    testApi.emit({
      ...base,
      phase: "downloading",
      downloadedBytes: 38 * 1024 * 1024,
      progress: 0.38,
    });
  }, availableState);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("۳۸٪");

  await page.locator(".header-overflow-trigger").click();
  await page.locator('[data-overflow-action="shortcut-settings"]').click();
  const dialog = page.getByRole("dialog", { name: "عمومی" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".software-update-card")).toContainText(
    "در حال دریافت نسخهٔ ۲.۲.۰",
  );
  await page.screenshot({
    path: ".artifacts/software-update-2.2.png",
    fullPage: false,
  });
});
