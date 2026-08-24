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
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  const backToDesk = page.getByRole("button", { name: /بازگشت به میز/ });
  const liveMode = page.getByRole("button", {
    name: "ویرایش روان",
    exact: true,
  });
  await expect
    .poll(async () =>
      (await backToDesk.isVisible()) || (await liveMode.isVisible()),
    )
    .toBe(true);
  if (await backToDesk.isVisible()) await backToDesk.click();
  await expect(liveMode).toBeVisible();
  if ((await liveMode.getAttribute("aria-pressed")) !== "true") {
    await liveMode.click();
  }
  await expect(page.locator(".workspace")).toHaveAttribute(
    "data-workspace-screen",
    "writing",
  );
}

async function openMarkdownFixture(page: Page) {
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page
    .locator('input[type="file"][accept*=".md"]')
    .first()
    .setInputFiles({
      name: "سند-لایه‌ها.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# سند لایه‌ها\n\nمتن آزمون موبایل.", "utf8"),
    });
  await expect(page.locator(".document-identity")).toContainText("سند-لایه‌ها.md");
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

  await openMobileMenu(page);
  await page
    .locator(".mobile-topbar-menu-grid")
    .getByRole("button", { name: /بازکردن نوار کناری/ })
    .click();
  await expect(page.locator("#library-panel")).toBeVisible();
  await expectGuard(page, true);
  await systemBack(page);
  await expect(page.locator("#library-panel")).toBeHidden();
  await expectGuard(page, false);

  await openMobileMenu(page);
  await page.locator(".mobile-topbar-menu-grid > button").nth(1).click();
  await expect(page.locator(".mobile-topbar-menu")).toBeHidden();
  await expect(page.getByRole("tab", { name: "تب جدید", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".workspace-office-setup")).toBeVisible();
  await expect(page.locator(".new-document-modal")).toHaveCount(0);
  await expectGuard(page, false);
});

test("mobile file action opens the system picker outside the inert workspace", async ({
  page,
}) => {
  await page.goto("/");
  await openMarkdownFixture(page);
  await page.getByRole("button", { name: /بازگشت به میز/ }).click();
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
  await openMarkdownFixture(page);
  await page.getByRole("button", { name: /بازگشت به میز/ }).click();
  await openMobileMenu(page);
  await page.locator(".mobile-topbar-menu-grid > button").nth(2).click();

  const workspace = page.locator(".workspace");
  const sidebar = page.locator("#library-panel");
  await expect(workspace).toHaveClass(/workspace--reading/);
  await expect(sidebar).toBeVisible();
  await expect(sidebar).toHaveClass(/is-collapsed/);
  await expect(sidebar.locator(".sidebar-pane")).toBeHidden();
  await expectGuard(page, true);

  const outlineTrigger = page.getByRole("button", {
    name: "فهرست سند",
    exact: true,
  });
  await outlineTrigger.click();
  await expect(sidebar).toHaveClass(/is-open/);
  await expect(sidebar.locator(".sidebar-pane")).toBeVisible();
  await expect(sidebar).toHaveAttribute(
    "aria-modal",
    "true",
  );
  await expect(page.locator(".workspace")).toHaveAttribute("inert", "");

  await systemBack(page);
  await expect(sidebar).toHaveClass(/is-collapsed/);
  await expect(sidebar.locator(".sidebar-pane")).toBeHidden();
  await expect(workspace).toHaveClass(/workspace--reading/);
  await expectGuard(page, true);

  await systemBack(page);
  await expect(workspace).not.toHaveClass(/workspace--reading/);
  await expectGuard(page, false);

  await openEditorPane(page);
  await page.getByRole("button", { name: "ابزارهای بیشتر", exact: true }).click();
  const editorTools = page.getByRole("menu", {
    name: "ابزارهای بیشتر ویرایش",
  });
  await expect(editorTools).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(editorTools).toBeHidden();
  await expectGuard(page, false);
});

test("Mermaid sample library closes before the studio", async ({ page }) => {
  await page.goto("/");
  await openMarkdownFixture(page);
  await openEditorPane(page);
  await page.getByRole("button", { name: "ابزارهای بیشتر", exact: true }).click();
  await page
    .getByRole("menu", { name: "ابزارهای بیشتر ویرایش" })
    .getByRole("menuitem", { name: "نمودار Mermaid", exact: true })
    .click();

  const studio = page.locator(".mermaid-studio");
  await expect(studio).toBeVisible();
  await studio.getByRole("option").first().click();
  const compactModeSwitch = studio.locator(".mermaid-mode-switch--compact");
  await expect(compactModeSwitch).toBeVisible();
  await compactModeSwitch.getByRole("button").nth(1).click();

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
