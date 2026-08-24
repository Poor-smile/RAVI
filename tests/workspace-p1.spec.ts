import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("workspace-p1-initialized")) return;
    sessionStorage.setItem("workspace-p1-initialized", "true");
    localStorage.clear();
    const snapshot = (id: string, title: string) => {
      const content = `# ${title}\n\nمتن آزمایشی ${id}`;
      return {
        content,
        fileName: `${title}.md`,
        readerSize: 18,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        activeDocumentPath: `D:/Notes/${title}.md`,
        documentType: "markdown",
        lastSavedSnapshot: JSON.stringify({ content, annotations: [], assets: [] }),
        draftId: `draft-${id}`,
        viewMode: "desk",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      };
    };
    const tab = (id: string, title: string, pinned: boolean) => ({
      id,
      title: `${title}.md`,
      path: `D:/Notes/${title}.md`,
      draftId: `draft-${id}`,
      dirty: false,
      pinned,
      snapshot: snapshot(id, title),
    });
    localStorage.setItem(
      "raavi:document-session:v2",
      JSON.stringify({
        version: 2,
        activeTabId: "meeting",
        tabs: [
          tab("plan", "برنامه محصول", true),
          tab("meeting", "یادداشت جلسه", false),
          tab("research", "پژوهش بازار", false),
        ],
        closedTabs: [],
      }),
    );
  });
});

test("P1 keeps tabs below App Chrome and supports the complete keyboard tab flow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await expect(page.locator(".document-tab")).toHaveCount(3);
  await expect(page.locator(".document-tab").first()).toHaveClass(/is-pinned/);

  const chromeGeometry = await page.evaluate(() => {
    const chrome = document.querySelector(".proofbar")!.getBoundingClientRect();
    const tabs = document.querySelector(".document-tabs")!.getBoundingClientRect();
    return {
      chromeBottom: Math.round(chrome.bottom),
      tabsTop: Math.round(tabs.top),
      tabsHeight: Math.round(tabs.height),
    };
  });
  expect(chromeGeometry.tabsTop).toBe(chromeGeometry.chromeBottom);
  expect(chromeGeometry.tabsHeight).toBe(36);

  const meeting = page.getByRole("tab", { name: /یادداشت جلسه/u });
  await meeting.focus();
  await page.keyboard.press("Shift+F10");
  const menu = page.getByRole("menu", { name: /عملیات یادداشت جلسه/u });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(menu.getByRole("menuitem").nth(1)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(meeting).toBeFocused();

  await page.keyboard.press("Alt+Shift+P");
  await expect(meeting.locator("xpath=..")).toHaveClass(/is-pinned/);

  await page.keyboard.press("Control+W");
  await expect(page.getByRole("status").filter({ hasText: "یادداشت جلسه.md" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /یادداشت جلسه/u })).toHaveCount(0);

  await page.keyboard.press("Control+Shift+T");
  const reopened = page.getByRole("tab", { name: /یادداشت جلسه/u });
  await expect(reopened).toBeVisible();
  await expect(reopened.locator("xpath=..")).toHaveClass(/is-pinned/);

  await page.waitForTimeout(350);
  await page.reload();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByRole("tab", { name: /یادداشت جلسه/u }).locator("xpath=.."))
    .toHaveClass(/is-pinned/);
  await page.screenshot({ path: ".artifacts/workspace-p1-tabs.png" });
});

test("a dirty document can be closed without saving after explicit confirmation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");

  const meeting = page.getByRole("tab", { name: /یادداشت جلسه/u });
  const editor = page.locator("#markdown-editor .cm-content");
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\nتغییر ذخیره‌نشده");
  await expect(meeting.locator("xpath=..")).toHaveClass(/is-dirty/);

  await page.keyboard.press("Control+W");
  const confirmation = page.getByRole("alertdialog", {
    name: /یادداشت جلسه\.md.*بدون ذخیره بسته شود/u,
  });
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole("button", { name: "انصراف" })).toBeFocused();
  await expect(
    confirmation.getByRole("button", { name: "ذخیره و بستن" }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(confirmation).toBeHidden();
  await expect(meeting).toBeVisible();

  await page.getByRole("button", { name: "بستن یادداشت جلسه.md" }).click();
  await confirmation.getByRole("button", { name: "بستن بدون ذخیره" }).click();
  await expect(meeting).toHaveCount(0);
  await expect(page.getByText("«یادداشت جلسه.md» بدون ذخیره بسته شد.")).toBeVisible();

  await page.waitForTimeout(350);
  await page.reload();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await expect(page.getByRole("tab", { name: /یادداشت جلسه/u })).toHaveCount(0);
});

test("save and close completes the save flow before removing the dirty tab", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");

  const meeting = page.getByRole("tab", { name: /یادداشت جلسه/u });
  const editor = page.locator("#markdown-editor .cm-content");
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.keyboard.type("\nنسخهٔ آمادهٔ ذخیره");
  await expect(meeting.locator("xpath=..")).toHaveClass(/is-dirty/);

  await page.keyboard.press("Control+W");
  const confirmation = page.getByRole("alertdialog", {
    name: /یادداشت جلسه\.md.*بدون ذخیره بسته شود/u,
  });
  await confirmation.getByRole("button", { name: "ذخیره و بستن" }).click();

  const saveDialog = page.getByRole("dialog", { name: "ذخیره فایل" });
  await expect(saveDialog).toBeVisible();
  const download = page.waitForEvent("download");
  await saveDialog.getByRole("button", { name: "ذخیره فایل" }).click();
  await download;
  await expect(meeting).toHaveCount(0);
});
