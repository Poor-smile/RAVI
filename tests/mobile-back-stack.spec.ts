import { expect, Page, test } from "@playwright/test";

async function expectGuard(page: Page, active: boolean) {
  await expect
    .poll(() =>
      page.evaluate(
        () => Boolean(window.history.state?.__raaviBackLayerGuard),
      ),
    )
    .toBe(active);
}

async function systemBack(page: Page) {
  const documentUrl = page.url();
  await page.evaluate(() => window.history.back());
  await expect(page).toHaveURL(documentUrl);
}

async function openMobileMenu(page: Page) {
  const trigger = page.locator(".mobile-topbar-menu-trigger");
  await expect
    .poll(async () => {
      if ((await trigger.getAttribute("aria-expanded")) !== "true") {
        await trigger.click();
      }
      return trigger.getAttribute("aria-expanded");
    })
    .toBe("true");
  await expect(page.locator(".mobile-topbar-menu")).toBeVisible();
  return trigger;
}

async function openEditorPane(page: Page) {
  const editorTab = page.locator('.mobile-tabs [role="tab"]').nth(0);
  await expect
    .poll(async () => {
      if ((await editorTab.getAttribute("aria-selected")) !== "true") {
        await editorTab.click();
      }
      return editorTab.getAttribute("aria-selected");
    })
    .toBe("true");
}

test("mobile Back closes the top transient layer before leaving the document", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toBeVisible();

  await openMobileMenu(page);
  await expectGuard(page, true);
  await systemBack(page);
  await expect(page.locator(".mobile-topbar-menu")).toBeHidden();
  await expectGuard(page, false);

  const libraryButton = page.locator(".mobile-library-trigger");
  await libraryButton.click();
  await expect(page.locator("#library-panel")).toBeVisible();
  await expectGuard(page, true);
  await systemBack(page);
  await expect(page.locator("#library-panel")).toBeHidden();
  await expectGuard(page, false);

  await openMobileMenu(page);
  await page.locator(".mobile-topbar-menu-grid > button").nth(1).click();
  const newDocumentDialog = page.locator(".new-document-modal");
  await expect(newDocumentDialog).toBeVisible();
  await expect(page.locator(".mobile-topbar-menu")).toBeHidden();
  await expectGuard(page, true);
  await systemBack(page);
  await expect(newDocumentDialog).toBeHidden();
  await expectGuard(page, false);
});

test("mobile file action opens the system picker outside the inert workspace", async ({
  page,
}) => {
  await page.goto("/");
  await openMobileMenu(page);

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.locator(".mobile-topbar-menu-grid > button").first().click(),
  ]);
  await fileChooser.setFiles({
    name: "سند-موبایل.md",
    mimeType: "text/markdown",
    buffer: Buffer.from("# سند موبایل\n\nفایل با انتخاب‌گر دستگاه باز شد.", "utf8"),
  });

  await expect(page.locator(".mobile-topbar-menu")).toBeHidden();
  await expect(page.locator(".document-identity")).toContainText("سند-موبایل.md");
  await expect(page.locator(".markdown-body")).toContainText("فایل با انتخاب‌گر دستگاه باز شد");
});

test("reading outline and editor tools unwind in visual order", async ({
  page,
}) => {
  await page.goto("/");
  await openMobileMenu(page);
  await page.locator(".mobile-topbar-menu-grid > button").nth(2).click();

  const workspace = page.locator(".workspace");
  await expect(workspace).toHaveClass(/workspace--reading/);
  await expect(page.locator(".reading-outline")).toBeVisible();
  await expectGuard(page, true);

  await systemBack(page);
  await expect(page.locator(".reading-outline")).toBeHidden();
  await expect(workspace).toHaveClass(/workspace--reading/);
  await expectGuard(page, true);

  await systemBack(page);
  await expect(workspace).not.toHaveClass(/workspace--reading/);
  await expectGuard(page, false);

  await openEditorPane(page);
  await page.locator(".format-tool-expand").click();
  await expect(workspace).toHaveClass(/mobile-editor-tools-is-open/);
  await expectGuard(page, true);
  await systemBack(page);
  await expect(workspace).not.toHaveClass(/mobile-editor-tools-is-open/);
  await expectGuard(page, false);
});

test("Mermaid sample library closes before the studio", async ({ page }) => {
  await page.goto("/");
  await openEditorPane(page);
  await page.locator('button[aria-label*="Mermaid"]').click();

  const studio = page.locator(".mermaid-studio");
  await expect(studio).toBeVisible();
  await studio.locator(".mermaid-mode-switch button").nth(1).click();

  await studio.locator(".mermaid-preview-tools > button").last().click();
  await expect(studio).toHaveClass(/preview-is-fullscreen/);
  await systemBack(page);
  await expect(studio).not.toHaveClass(/preview-is-fullscreen/);
  await expectGuard(page, true);

  await studio.locator(".mermaid-pane-actions > button").click();
  await expect(studio.locator("#mermaid-sample-library")).toBeVisible();
  await expectGuard(page, true);

  await systemBack(page);
  await expect(studio.locator("#mermaid-sample-library")).toBeHidden();
  await expect(studio).toBeVisible();
  await expectGuard(page, true);

  const codeEditor = studio.locator(".mermaid-code-editor .cm-content");
  await codeEditor.click();
  await codeEditor.press("Control+End");
  await codeEditor.type("\n%% mobile Back regression");

  await systemBack(page);
  await expect(studio.locator(".mermaid-discard-dialog")).toBeVisible();
  await expect(studio).toBeVisible();
  await expectGuard(page, true);

  await systemBack(page);
  await expect(studio.locator(".mermaid-discard-dialog")).toBeHidden();
  await expect(studio).toBeVisible();
  await studio.locator(".mermaid-studio-back").click();
  await studio.locator(".mermaid-discard").click();
  await expect(studio).toBeHidden();
  await expectGuard(page, false);
});
