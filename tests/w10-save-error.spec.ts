import { expect, test } from "@playwright/test";

test("W10 exposes a persistent save failure with dismiss and real retry recovery", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        fileName: "راهنمای نگارش.md",
        content: "## نوشتن برای خوانده‌شدن\n",
        readerSize: 18,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        activeDocumentPath: "C:\\Raavi\\راهنمای نگارش.md",
        documentType: "markdown",
        lastSavedSnapshot: "",
        draftId: "w10-save-error",
        viewMode: "desk",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  });

  await page.goto("/");
  const shell = page.locator(".app-shell");
  await expect(shell).toHaveAttribute("data-hydrated", "true");
  await expect(page.locator(".document-identity")).toContainText(
    "راهنمای نگارش.md",
  );
  await page.evaluate(() => {
    const activePath = "C:\\Raavi\\راهنمای نگارش.md";
    let saveAttempts = 0;
    Object.defineProperty(window, "__w10SaveAttempts", {
      configurable: true,
      get: () => saveAttempts,
    });
    Object.defineProperty(window, "raaviDesktop", {
      configurable: true,
      value: {
        isDesktop: true,
        saveLocalDocumentSnapshot: async () => ({ saved: true }),
        saveReadingPositions: async () => ({ saved: true }),
        saveReadingPositionsSync: () => ({ saved: true }),
        saveCurrentDocument: async () => {
          saveAttempts += 1;
          if (saveAttempts < 3) throw new Error("EACCES");
          await new Promise((resolve) => window.setTimeout(resolve, 500));
          return {
            saved: true,
            filePath: activePath,
            documentType: "markdown" as const,
          };
        },
      },
    });
  });

  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
  const workspace = page.locator('[data-workspace-screen="writing"]');
  const saveStatus = page.locator(".save-indicator");
  await expect(workspace).toBeVisible();
  const editor = workspace.locator("#markdown-editor .cm-content");
  await editor.focus();
  await page.keyboard.press("Control+End");

  await saveStatus.click();
  const banner = page.locator('[data-save-error-banner="true"]');
  await expect(shell).toHaveClass(/has-save-error/);
  await expect(saveStatus).toContainText("ذخیره ناموفق");
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute("role", "alert");
  await expect(banner.locator("strong")).toHaveText(
    "هماهنگ‌سازی فایل انجام نشد",
  );
  await expect(banner.locator("#save-error-description")).toHaveText(
    "فایل در دسترس نیست یا مجوز آن تغییر کرده است. مسیر را بررسی کنید.",
  );
  await expect(
    banner.getByRole("button", { name: "تلاش دوباره", exact: true }),
  ).toBeVisible();
  await expect(banner.locator('[data-material-symbol="warning"]')).toHaveCount(1);
  await expect(banner.locator('[data-material-symbol="close"]')).toHaveCount(1);
  await expect(workspace.locator(".writing-block-gutter")).toBeHidden();
  await expect(workspace.locator(".cm-live-heading-2")).toHaveText(
    "نوشتن برای خوانده‌شدن",
  );

  const contract = await page.evaluate(() => {
    const element = (selector: string) =>
      document.querySelector<HTMLElement>(selector)!;
    const rect = (selector: string) => {
      const bounds = element(selector).getBoundingClientRect();
      return {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    const style = (selector: string) => getComputedStyle(element(selector));
    return {
      geometry: {
        banner: rect(".save-error-banner"),
        document: rect('[data-workspace-screen="writing"] .editor-pane'),
        status: rect(".save-indicator"),
        retry: rect(".save-error-banner__retry"),
        dismiss: rect(".save-error-banner__dismiss"),
      },
      surface: {
        background: style(".save-error-banner").backgroundColor,
        border: style(".save-error-banner").borderWidth,
        radius: style(".save-error-banner").borderRadius,
        shadow: style(".save-error-banner").boxShadow,
        statusBackground: style(".save-indicator").backgroundColor,
        statusBorder: style(".save-indicator").borderColor,
        statusBorderWidth: style(".save-indicator").borderWidth,
        renderedBlock: style("#markdown-editor .cm-activeLine").backgroundColor,
        emptyBlockPlaceholder: getComputedStyle(
          element("#markdown-editor .cm-line:last-child"),
          "::before",
        ).content,
      },
      type: {
        titleSize: style(".save-error-banner__content strong").fontSize,
        titleLineHeight: style(".save-error-banner__content strong").lineHeight,
        titleWeight: style(".save-error-banner__content strong").fontWeight,
        detailSize: style("#save-error-description").fontSize,
        detailLineHeight: style("#save-error-description").lineHeight,
        actionSize: style(".save-error-banner__retry").fontSize,
        contentPaddingTop: style(
          '[data-workspace-screen="writing"] .cm-content',
        ).paddingTop,
      },
    };
  });

  expect(contract.geometry).toEqual({
    banner: { x: 318, y: 144, width: 588, height: 68 },
    document: { x: 232, y: 144, width: 760, height: 754 },
    status: { x: 992, y: 46, width: 132, height: 36 },
    retry: { x: 376, y: 160, width: 75, height: 36 },
    dismiss: { x: 332, y: 160, width: 36, height: 36 },
  });
  expect(contract.surface).toEqual({
    background: "rgb(255, 240, 237)",
    border: "0px",
    radius: "14px",
    shadow: "none",
    statusBackground: "rgb(255, 240, 237)",
    statusBorder: "rgb(185, 56, 47)",
    statusBorderWidth: "1px",
    renderedBlock: "rgba(0, 0, 0, 0)",
    emptyBlockPlaceholder: "none",
  });
  expect(contract.type).toEqual({
    titleSize: "12px",
    titleLineHeight: "18px",
    titleWeight: "700",
    detailSize: "11px",
    detailLineHeight: "17px",
    actionSize: "12px",
    contentPaddingTop: "32px",
  });

  await expect(page.locator(".toast")).toBeHidden({ timeout: 8_000 });
  await page.screenshot({
    path: ".artifacts/w10-save-error.png",
    fullPage: true,
  });

  await page.setViewportSize({ width: 360, height: 800 });
  await expect(banner).toBeVisible();
  const mobileContract = await banner.evaluate((element) => {
    const title = element.querySelector("strong")!;
    const detail = element.querySelector("#save-error-description")!;
    const bounds = element.getBoundingClientRect();
    return {
      width: Math.round(bounds.width),
      height: Math.round(bounds.height),
      titleWhiteSpace: getComputedStyle(title).whiteSpace,
      detailWhiteSpace: getComputedStyle(detail).whiteSpace,
      detailOverflow: getComputedStyle(detail).overflow,
    };
  });
  expect(mobileContract).toMatchObject({
    width: 340,
    titleWhiteSpace: "normal",
    detailWhiteSpace: "normal",
    detailOverflow: "visible",
  });
  expect(mobileContract.height).toBeGreaterThan(68);
  await page.setViewportSize({ width: 1280, height: 914 });
  await expect(banner).toHaveCSS("height", "68px");

  await banner
    .getByRole("button", { name: "بستن پیام خطای ذخیره", exact: true })
    .click();
  await expect(banner).toBeHidden();
  await expect(shell).not.toHaveClass(/has-save-error/);
  await expect(saveStatus).toContainText("ذخیره ناموفق");
  await expect(saveStatus).toBeFocused();

  await saveStatus.click();
  await expect(banner).toBeVisible();
  await banner.getByRole("button", { name: "تلاش دوباره", exact: true }).click();
  await expect(banner).toBeHidden();
  await expect(saveStatus).toContainText("در حال ذخیره…");
  await expect(saveStatus).toBeDisabled();
  await expect(saveStatus).toHaveCSS("border-width", "0px");
  await expect(saveStatus).toContainText("ذخیره شده");
  await expect(saveStatus).toBeFocused();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Number((window as unknown as { __w10SaveAttempts: number }).__w10SaveAttempts),
      ),
    )
    .toBe(3);
});

test("W10 retry preserves the failed Save As name and file type", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        fileName: "راهنمای نگارش.md",
        content: "## نوشتن برای خوانده‌شدن\n",
        readerSize: 18,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        activeDocumentPath: "C:\\Raavi\\راهنمای نگارش.md",
        documentType: "markdown",
        lastSavedSnapshot: "",
        draftId: "w10-save-as-retry",
        viewMode: "desk",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  });

  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page.evaluate(() => {
    const saveAsNames: string[] = [];
    let currentSaveAttempts = 0;
    Object.defineProperty(window, "__w10SaveAsContract", {
      configurable: true,
      get: () => ({ saveAsNames: [...saveAsNames], currentSaveAttempts }),
    });
    Object.defineProperty(window, "raaviDesktop", {
      configurable: true,
      value: {
        isDesktop: true,
        saveLocalDocumentSnapshot: async () => ({ saved: true }),
        saveReadingPositions: async () => ({ saved: true }),
        saveReadingPositionsSync: () => ({ saved: true }),
        saveCurrentDocument: async () => {
          currentSaveAttempts += 1;
          throw new Error("WRONG_SAVE_OPERATION");
        },
        saveMarkdown: async (name: string) => {
          saveAsNames.push(name);
          if (saveAsNames.length === 1) throw new Error("EACCES");
          return {
            saved: true,
            filePath: `C:\\Raavi\\${name}`,
            documentType: "markdown" as const,
          };
        },
        saveRaavi: async () => {
          throw new Error("WRONG_SAVE_TYPE");
        },
      },
    });
  });

  await page.locator(".document-identity").click();
  await page
    .getByRole("menuitem", { name: "ذخیره با نام", exact: true })
    .click();
  const saveDialog = page.getByRole("dialog", { name: "ذخیره فایل" });
  await expect(saveDialog).toBeVisible();
  await saveDialog.locator('[data-editable-kind="saveName"]').first().fill(
    "نسخه ویژه",
  );
  await saveDialog
    .getByRole("button", { name: "ذخیره فایل", exact: true })
    .click();

  const banner = page.locator('[data-save-error-banner="true"]');
  await expect(saveDialog).toBeHidden();
  await expect(banner).toBeVisible();
  await expect(page.locator(".workspace")).not.toHaveAttribute("inert", "");
  await expect(
    banner.getByRole("button", { name: "تلاش دوباره", exact: true }),
  ).toBeEnabled();

  await banner.getByRole("button", { name: "تلاش دوباره", exact: true }).click();
  await expect(page.locator(".save-indicator")).toContainText("ذخیره شده");
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as unknown as {
              __w10SaveAsContract: {
                saveAsNames: string[];
                currentSaveAttempts: number;
              };
            }
          ).__w10SaveAsContract,
      ),
    )
    .toEqual({
      saveAsNames: ["نسخه ویژه.md", "نسخه ویژه.md"],
      currentSaveAttempts: 0,
    });
});

test("W10 keeps the desktop banner layout on a coarse Windows pointer", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL as string,
    viewport: { width: 1280, height: 914 },
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.localStorage.setItem(
        "raavi:document:v1",
        JSON.stringify({
          fileName: "راهنمای نگارش.md",
          content: "## نوشتن برای خوانده‌شدن\n",
          readerSize: 18,
          annotations: [],
          assets: [],
          revision: 1,
          versions: [],
          activeDocumentPath: "C:\\Raavi\\راهنمای نگارش.md",
          documentType: "markdown",
          lastSavedSnapshot: "",
          draftId: "w10-coarse-desktop",
          viewMode: "desk",
          readingOutlineOpen: false,
          readingPositions: {},
          annotationComposer: null,
        }),
      );
    });
    await page.goto("/");
    await expect(page.locator(".app-shell")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    await page.evaluate(() => {
      Object.defineProperty(window, "raaviDesktop", {
        configurable: true,
        value: {
          isDesktop: true,
          saveLocalDocumentSnapshot: async () => ({ saved: true }),
          saveReadingPositions: async () => ({ saved: true }),
          saveReadingPositionsSync: () => ({ saved: true }),
          saveCurrentDocument: async () => {
            throw new Error("EACCES");
          },
        },
      });
    });

    await page
      .getByRole("button", { name: "ویرایش روان", exact: true })
      .click();
    await page.locator(".save-indicator").click();
    const banner = page.locator('[data-save-error-banner="true"]');
    await expect(banner).toBeVisible();
    const contract = await banner.evaluate((element) => {
      const bounds = element.getBoundingClientRect();
      const retry = element.querySelector<HTMLElement>(
        ".save-error-banner__retry",
      )!;
      const dismiss = element.querySelector<HTMLElement>(
        ".save-error-banner__dismiss",
      )!;
      return {
        coarse: matchMedia("(any-pointer: coarse)").matches,
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
        display: getComputedStyle(element).display,
        titleWhiteSpace: getComputedStyle(
          element.querySelector("strong")!,
        ).whiteSpace,
        retryHeight: Math.round(retry.getBoundingClientRect().height),
        dismissHeight: Math.round(dismiss.getBoundingClientRect().height),
      };
    });
    expect(contract).toEqual({
      coarse: true,
      width: 588,
      height: 68,
      display: "flex",
      titleWhiteSpace: "nowrap",
      retryHeight: 44,
      dismissHeight: 44,
    });
  } finally {
    await context.close();
  }
});
