import { expect, test } from "@playwright/test";

const sidebarStorageKey = "raavi:sidebar:v1";
const paneLayoutStorageKey = "raavi:pane-layout:v1";
const workspaceStorageKey = "raavi:workspace:v2";

async function openWithFreshSidebar(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.waitForTimeout(300);
  await page.evaluate(
    ({ sidebarKey, paneKey, workspaceKey }) => {
      window.localStorage.removeItem(sidebarKey);
      window.localStorage.removeItem(paneKey);
      window.localStorage.removeItem(workspaceKey);
    },
    {
      sidebarKey: sidebarStorageKey,
      paneKey: paneLayoutStorageKey,
      workspaceKey: workspaceStorageKey,
    },
  );
  await page.goto("/?fresh-sidebar=1");
}

test("desktop starts rail-only with eight destinations and preserves the document while panels change", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openWithFreshSidebar(page);

  const shell = page.locator(".sidebar-shell");
  const railButtons = page.locator(".sidebar-rail > button");
  await expect(shell).toHaveClass(/is-collapsed/);
  await expect(railButtons).toHaveCount(8);
  await expect(page.locator(".sidebar-rail > button.is-magic")).toHaveCount(1);
  expect(
    await railButtons.evaluateAll((buttons) =>
      buttons.map((button) => (button as HTMLButtonElement).disabled),
    ),
  ).toEqual([true, false, false, true, true, true, true, true]);
  await expect(
    page.getByRole("heading", {
      name: "یک پوشه را به‌عنوان دفتر مرکزی انتخاب کنید",
    }),
  ).toBeVisible();
  await expect(page.locator(".note-template-card")).toHaveCount(0);

  const placement = await page.evaluate(() => {
    const sidebar = document.querySelector<HTMLElement>(".sidebar-shell")!;
    const workspace = document.querySelector<HTMLElement>(".workspace")!;
    return {
      sidebarX: sidebar.getBoundingClientRect().x,
      sidebarWidth: sidebar.getBoundingClientRect().width,
      sidebarRight: sidebar.getBoundingClientRect().right,
      workspaceX: workspace.getBoundingClientRect().x,
      workspaceRight: workspace.getBoundingClientRect().right,
    };
  });
  expect(Math.abs(placement.sidebarRight - 1440)).toBeLessThan(1);
  expect(Math.abs(placement.sidebarX - placement.workspaceRight)).toBeLessThan(1);
  expect(Math.round(placement.sidebarWidth)).toBe(56);
  const shellGeometry = await page.evaluate(() => ({
    titleBar: document.querySelector<HTMLElement>(".topbar")!.getBoundingClientRect().height,
    commandBar: document.querySelector<HTMLElement>(".proofbar")!.getBoundingClientRect().height,
    rail: document.querySelector<HTMLElement>(".sidebar-rail")!.getBoundingClientRect().width,
  }));
  expect(Math.round(shellGeometry.titleBar)).toBe(36);
  expect(Math.round(shellGeometry.commandBar)).toBe(56);
  expect(Math.round(shellGeometry.rail)).toBe(56);
  const wideCommandSizes = await page.locator(".topbar-primary-actions .shell-action:visible").evaluateAll(
    (buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      }),
  );
  expect(wideCommandSizes.every(({ width, height }) => width >= 36 && height === 36)).toBe(true);
  expect(wideCommandSizes).toHaveLength(3);
  const emptyGeometry = await page.locator(".workspace-office-setup").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      radius: getComputedStyle(element).borderRadius,
    };
  });
  expect(emptyGeometry).toEqual({ width: 684, height: 390, radius: "14px" });

  await page
    .locator('input[type="file"][accept*=".md"]')
    .first()
    .setInputFiles({
      name: "سند-فعال.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# سند فعال\n\n## بخش دوم\n\n### بخش سوم\n\nمتن آزمون"),
    });
  const leaveReading = page.getByRole("button", {
    name: "بازگشت به میز",
    exact: true,
  });
  if (await leaveReading.isVisible()) await leaveReading.click();
  await expect(page.locator("#markdown-editor .cm-content")).toBeVisible();
  await expect(shell).toHaveClass(/is-collapsed/);
  expect(
    await railButtons.evaluateAll((buttons) =>
      buttons.map((button) => (button as HTMLButtonElement).disabled),
    ),
  ).toEqual([false, false, false, false, false, false, false, false]);
  await expect(page.locator('.editor-mode-switcher button[aria-pressed="true"]')).toHaveText(
    "ویرایش روان",
  );
  await expect(page.locator(".workspace")).toHaveAttribute("data-pane-layout", "editor");

  await page.getByRole("button", { name: "تاریخچه", exact: true }).click();
  await expect(page.locator("#sidebar-pane-title")).toHaveText("تاریخچه");
  await expect(page.locator("#recent-files-panel")).toBeVisible();
  await expect(page.locator("#library-versions-panel")).toHaveCount(0);
  await page.getByRole("button", { name: "نسخه‌ها", exact: true }).click();
  await expect(page.locator("#sidebar-pane-title")).toHaveText("نسخه‌ها");
  await expect(page.locator("#library-versions-panel")).toBeVisible();
  await expect(page.locator("#library-history-panel")).toHaveCount(0);

  await page.evaluate(() => {
    (window as typeof window & { __obl03Editor?: Element | null }).__obl03Editor =
      document.querySelector("#markdown-editor");
  });
  const fileName = await page.locator(".document-identity").innerText();
  await page.getByRole("button", { name: "فهرست سند", exact: true }).click();
  await expect(page.locator("#sidebar-pane-title")).toHaveText("فهرست سند");
  await expect(page.locator(".sidebar-outline-list .sidebar-row")).toHaveCount(3);
  await expect(page.locator(".document-identity")).toHaveText(fileName);
  expect(
    await page.evaluate(
      () =>
        (window as typeof window & { __obl03Editor?: Element | null }).__obl03Editor ===
        document.querySelector("#markdown-editor"),
    ),
  ).toBe(true);

  const separator = page.getByRole("separator", { name: "تغییر عرض نوار کناری" });
  await separator.press("End");
  await page.waitForTimeout(250);
  const resizedWidth = await page.locator(".sidebar-pane").evaluate((element) =>
    element.getBoundingClientRect().width,
  );
  expect(resizedWidth).toBeGreaterThan(410);
  await separator.press("ArrowRight");
  await expect
    .poll(() =>
      page.locator(".sidebar-pane").evaluate((element) =>
        element.getBoundingClientRect().width,
      ),
    )
    .toBeLessThan(resizedWidth);
  await separator.press("ArrowLeft");
  await expect
    .poll(() =>
      page.locator(".sidebar-pane").evaluate((element) =>
        element.getBoundingClientRect().width,
      ),
    )
    .toBeGreaterThanOrEqual(resizedWidth);
  await page.waitForTimeout(180);
  await page.reload();
  await expect(shell).toHaveClass(/is-open/);
  await page.waitForTimeout(300);
  await expect(page.locator("#sidebar-pane-title")).toHaveText("فهرست سند");
  await expect
    .poll(() =>
      page.locator(".sidebar-pane").evaluate((element) =>
        element.getBoundingClientRect().width,
      ),
    )
    .toBeGreaterThan(410);

  await page.getByRole("button", { name: "فهرست سند", exact: true }).click();
  await expect(shell).toHaveClass(/is-collapsed/);
  await expect(page.locator(".sidebar-rail")).toBeVisible();
  await page.getByRole("button", { name: "نظرات", exact: true }).click();
  await expect(shell).toHaveClass(/is-open/);
  await expect(page.locator("#sidebar-pane-title")).toHaveText("نظرات");
  await expect(page.locator("#comments-panel")).toBeVisible();
  await page.getByRole("button", { name: "نظرات", exact: true }).click();
  await expect(shell).toHaveClass(/is-collapsed/);
  await page.waitForTimeout(180);
  await page.reload();
  await expect(shell).toHaveClass(/is-collapsed/);
  await expect(page.locator(".sidebar-rail")).toBeVisible();
});

test("empty dark uses the independent W02 surface hierarchy", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await openWithFreshSidebar(page);

  await page.locator(".titlebar-theme-control").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".theme-transition-overlay")).toHaveCount(0);

  const surfaces = await page.evaluate(() => {
    const background = (selector: string) =>
      getComputedStyle(document.querySelector<HTMLElement>(selector)!).backgroundColor;

    return {
      titlebar: background(".topbar"),
      commandbar: background(".proofbar"),
      workspace: background(".workspace.workspace-is-empty"),
      rail: background(".sidebar-rail"),
      office: background(".workspace-office-setup"),
      officeIcon: background(".workspace-office-setup__icon"),
      themeControl: background(".titlebar-theme-control"),
      disabledRailOpacity: getComputedStyle(
        document.querySelector<HTMLElement>(".sidebar-rail > button:disabled")!,
      ).opacity,
    };
  });

  expect(surfaces).toEqual({
    titlebar: "rgb(14, 19, 15)",
    commandbar: "rgb(24, 30, 26)",
    workspace: "rgb(26, 33, 28)",
    rail: "rgb(16, 20, 17)",
    office: "rgb(24, 30, 26)",
    officeIcon: "rgb(20, 26, 22)",
    themeControl: "rgb(24, 30, 26)",
    disabledRailOpacity: "0.42",
  });

  const geometry = await page.evaluate(() => {
    const rect = (selector: string) =>
      document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
    const shortcut = rect(".titlebar-command-shortcut");
    const theme = rect(".titlebar-theme-control");
    const glyph = rect(".workspace-office-setup__icon svg");
    const railGlyph = rect(".sidebar-rail > button svg");
    const railItemStyle = getComputedStyle(
      document.querySelector<HTMLElement>(".sidebar-rail > button")!,
    );
    const shellStyle = getComputedStyle(
      document.querySelector<HTMLElement>(".app-shell.is-new-ui")!,
    );
    const shortcutStyle = getComputedStyle(
      document.querySelector<HTMLElement>(".titlebar-command-shortcut")!,
    );
    const brandStyle = getComputedStyle(
      document.querySelector<HTMLElement>(".is-new-ui .brand")!,
    );

    return {
      shortcut: [Math.round(shortcut.width), Math.round(shortcut.height)],
      theme: [Math.round(theme.width), Math.round(theme.height)],
      glyph: [Math.round(glyph.width), Math.round(glyph.height)],
      railGlyph: [Math.round(railGlyph.width), Math.round(railGlyph.height)],
      railRadius: railItemStyle.borderRadius,
      shellRadius: shellStyle.borderRadius,
      shortcutColor: shortcutStyle.color,
      brandCursor: brandStyle.cursor,
    };
  });

  expect(geometry).toEqual({
    shortcut: [101, 22],
    theme: [22, 22],
    glyph: [28, 28],
    railGlyph: [18, 18],
    railRadius: "6px",
    shellRadius: "14px",
    shortcutColor: "rgb(242, 245, 241)",
    brandCursor: "default",
  });
});

test("compact desktop preserves the 760px document measure and opens the sidebar as a drawer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1085, height: 878 });
  await openWithFreshSidebar(page);

  const shell = page.locator("#library-panel");
  const workspace = page.locator(".workspace");
  await expect(shell).toBeHidden();

  const openAction = page.locator(".topbar-action--open");
  await expect(openAction).toHaveClass(/is-icon-only/);
  await expect(openAction.locator(".action-label")).toBeHidden();
  await page
    .locator('input[type="file"][accept*=".md"]')
    .first()
    .setInputFiles({
      name: "سند-فعال.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# سند فعال\n\nمتن آزمون"),
    });
  await expect(page.locator(".document-identity")).toContainText("سند-فعال.md");
  const activeFileTab = page.getByRole("tab", { name: /سند-فعال\.md/u });
  const leaveReading = page.getByRole("button", {
    name: "بازگشت به میز",
    exact: true,
  });
  if (await leaveReading.isVisible()) await leaveReading.click();
  await expect(page.locator(".app-shell")).not.toHaveClass(/is-reading/);
  await expect(activeFileTab).toBeVisible();
  await expect(activeFileTab).toHaveAttribute("aria-selected", "true");
  await expect(openAction).toHaveClass(/is-icon-only/);
  await expect(openAction.locator(".action-label")).toBeHidden();

  const desktopActionSizes = await page.locator(".topbar-primary-actions .shell-action:visible").evaluateAll(
    (buttons) =>
      buttons.map((button) => {
        const rect = button.getBoundingClientRect();
        return { width: Math.round(rect.width), height: Math.round(rect.height) };
      }),
  );
  expect(desktopActionSizes.every(({ width, height }) => width === 36 && height === 36)).toBe(true);

  const stageWidth = await workspace.evaluate(
    (element) => element.getBoundingClientRect().width,
  );
  expect(stageWidth).toBeGreaterThan(1060);

  const paneHeaderHeights = await page.locator(".pane-header").evaluateAll(
    (headers) => headers.map((header) => header.getBoundingClientRect().height),
  );
  expect(Math.abs(paneHeaderHeights[0] - paneHeaderHeights[1])).toBeLessThan(1);
  await expect(page.locator(".annotation-toolbar")).toBeHidden();
  await expect(page.locator(".editor-status, .editor-shortcut-help")).toHaveCount(0);

  const moreButton = page.getByRole("button", {
    name: "بازکردن فرمان‌های بیشتر",
    exact: true,
  });
  await moreButton.click();
  const shortcutsButton = page.getByRole("menuitem", {
    name: "میان‌برهای صفحه‌کلید",
    exact: true,
  });
  await expect(shortcutsButton).toBeVisible();
  await shortcutsButton.click();
  const shortcutsDialog = page.getByRole("dialog", {
    name: "میان‌برهای صفحه‌کلید",
    exact: true,
  });
  await expect(shortcutsDialog).toBeVisible();
  await shortcutsDialog
    .getByRole("button", { name: "بستن راهنمای میان‌برها", exact: true })
    .click();
  await expect(moreButton).toBeFocused();

  const registrationSpineWidth = await page
    .locator(".registration-spine")
    .evaluate((spine) => spine.getBoundingClientRect().width);
  expect(registrationSpineWidth).toBeLessThanOrEqual(26.5);

  await moreButton.click();
  await page
    .getByRole("button", { name: "بازکردن نوار کناری" })
    .click();
  await expect(shell).toBeVisible();
  await expect(shell).toHaveAttribute("role", "dialog");
  await expect(shell).toHaveAttribute("aria-modal", "true");
  await expect(page.locator(".sidebar-scrim")).toBeVisible();

  const editorWidth = await page.locator(".editor-pane").evaluate(
    (pane) => Math.round(pane.getBoundingClientRect().width),
  );
  const previewWidth = await page.locator(".preview-pane").evaluate(
    (pane) => Math.round(pane.getBoundingClientRect().width),
  );
  expect(editorWidth).toBe(760);
  expect(previewWidth).toBeLessThanOrEqual(1);
});

test("mobile sidebar is a trapped drawer with scrim, Escape and focus restoration", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openWithFreshSidebar(page);

  const overflow = page.getByRole("button", { name: "بازکردن فرمان‌های بیشتر" });
  await overflow.click();
  await page
    .getByRole("button", { name: /بازکردن نوار کناری/ })
    .click();

  const drawer = page.getByRole("dialog", { name: "کتابخانه" });
  await expect(drawer).toBeVisible();
  await expect(drawer).toHaveAttribute("aria-modal", "true");
  await expect(page.locator(".sidebar-scrim")).toBeVisible();
  await expect(page.locator(".sidebar-rail > button")).toHaveCount(8);
  await expect(page.getByRole("button", { name: "جمع‌کردن نوار کناری" })).toBeFocused();

  const undersizedTargets = await drawer.locator("button").evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && (rect.width < 43.5 || rect.height < 43.5);
      })
      .map((button) => button.getAttribute("aria-label") || button.textContent?.trim()),
  );
  expect(undersizedTargets).toEqual([]);

  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(overflow).toBeFocused();
});
