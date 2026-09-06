import { expect, test, type Page } from "@playwright/test";

const READING_SELECTION_FIXTURE = [
  "---",
  "subject: راهنمای نگارش فارسی",
  "---",
  "",
  "# نوشتن برای خوانده‌شدن",
  "",
  "متن خوب پیش از آن‌که زیبا باشد، مسیر خواندن را روشن می‌کند. هر بخش باید یک ایدهٔ مشخص داشته باشد و فاصله‌ها به چشم فرصت مکث بدهند.",
  "",
  "> ساختار، پیش از تزئین، به خواننده اطمینان می‌دهد.",
  "",
  "```mermaid",
  "flowchart RL",
  "  A[ایده] --> B[ساختار] --> C[متن نهایی]",
  "```",
].join("\n");

const SELECTED_FRAGMENT = "فاصله‌ها به چشم فرصت مکث بدهند.";

async function openReadingFixture(
  page: Page,
  {
    theme = "light",
    content = READING_SELECTION_FIXTURE,
    viewport = { width: 1180, height: 858 },
  }: {
    theme?: "light" | "dark";
    content?: string;
    viewport?: { width: number; height: number };
  } = {},
) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(
    ({ content, selectedTheme }) => {
      if (sessionStorage.getItem("r08-seeded")) return;
      sessionStorage.setItem("r08-seeded", "true");
      window.localStorage.clear();
      window.localStorage.setItem("raavi:theme:v1", selectedTheme);
      window.localStorage.setItem(
        "raavi:document:v1",
        JSON.stringify({
          fileName: "راهنمای نگارش.md",
          content,
          readerSize: 18,
          annotations: [],
          assets: [],
          revision: 1,
          versions: [],
          activeDocumentPath: "C:\\Raavi\\راهنمای نگارش.md",
          documentType: "ravi",
          lastSavedSnapshot: content,
          draftId: `r08-reading-selection-${selectedTheme}`,
          viewMode: "reading",
          readingOutlineOpen: false,
          readingPositions: {},
          annotationComposer: null,
        }),
      );
    },
    { content, selectedTheme: theme },
  );
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
}

async function selectFragment(page: Page, fragment = SELECTED_FRAGMENT) {
  const selected = await page.evaluate((quote) => {
    const article = document.querySelector<HTMLElement>(
      '[data-workspace-screen="reading"] .markdown-body',
    )!;
    const walker = document.createTreeWalker(article, NodeFilter.SHOW_TEXT);
    let node: Text | null = null;
    let offset = -1;
    while (walker.nextNode()) {
      const candidate = walker.currentNode as Text;
      const candidateOffset = candidate.data.indexOf(quote);
      if (candidateOffset >= 0) {
        node = candidate;
        offset = candidateOffset;
        break;
      }
    }
    if (!node || offset < 0) throw new Error(`Selection fragment not found: ${quote}`);

    const range = document.createRange();
    range.setStart(node, offset);
    range.setEnd(node, offset + quote.length);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    const rect = range.getBoundingClientRect();
    article.dispatchEvent(
      new MouseEvent("mouseup", {
        bubbles: true,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
      }),
    );
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    };
  }, fragment);
  await expect(
    page.getByRole("toolbar", { name: "ابزار متن انتخاب‌شده" }),
  ).toBeVisible();
  return selected;
}

test("R08 matches the exact dark two-action Selection palette from Figma", async ({
  page,
}) => {
  await openReadingFixture(page, { theme: "dark" });
  const selected = await selectFragment(page);
  const menu = page.getByRole("toolbar", {
    name: "ابزار متن انتخاب‌شده",
  });
  const highlight = menu.getByRole("button", { name: "هایلایت" });
  const comment = menu.getByRole("button", { name: "نظر" });

  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button")).toHaveCount(2);
  await expect(menu.getByRole("button", { name: /کپی|حاشیه/ })).toHaveCount(0);
  await expect(
    highlight.locator('[data-material-symbol="ink_highlighter"]'),
  ).toBeVisible();
  await expect(
    comment.locator('[data-material-symbol="chat"]'),
  ).toBeVisible();
  await page.waitForTimeout(220);

  const contract = await menu.evaluate((node) => {
    const element = node as HTMLElement;
    const bounds = (target: Element) => {
      const rect = target.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
      };
    };
    const highlightAction = element.querySelector<HTMLElement>(
      '[data-selection-action="highlight"]',
    )!;
    const commentAction = element.querySelector<HTMLElement>(
      '[data-selection-action="comment"]',
    )!;
    const feedback = document.querySelector<HTMLElement>(
      ".selection-range-feedback",
    )!;
    const menuStyle = getComputedStyle(element);
    const highlightStyle = getComputedStyle(highlightAction);
    const commentStyle = getComputedStyle(commentAction);
    const feedbackStyle = getComputedStyle(feedback);
    const selectedTextElement = document.querySelector<HTMLElement>(
      ".markdown-body p",
    )!;
    const highlightStyles =
      document.querySelector<HTMLStyleElement>("style[data-raavi-highlights]")
        ?.textContent ?? "";
    return {
      geometry: {
        menu: bounds(element),
        highlight: bounds(highlightAction),
        comment: bounds(commentAction),
        feedback: bounds(feedback),
      },
      surface: {
        background: menuStyle.backgroundColor,
        border: menuStyle.borderWidth,
        radius: menuStyle.borderRadius,
        shadow: menuStyle.boxShadow,
        gap: menuStyle.gap,
        padding: menuStyle.padding,
      },
      highlightStyle: {
        background: highlightStyle.backgroundColor,
        color: highlightStyle.color,
        border: highlightStyle.borderWidth,
        radius: highlightStyle.borderRadius,
        size: highlightStyle.fontSize,
        weight: highlightStyle.fontWeight,
        line: highlightStyle.lineHeight,
      },
      commentStyle: {
        background: commentStyle.backgroundColor,
        color: commentStyle.color,
        border: commentStyle.borderWidth,
        radius: commentStyle.borderRadius,
      },
      feedbackStyle: {
        background: feedbackStyle.backgroundColor,
        radius: feedbackStyle.borderRadius,
        shadow: feedbackStyle.boxShadow,
        opacity: feedbackStyle.opacity,
        nativeSelectionPaint: getComputedStyle(
          selectedTextElement,
          "::selection",
        ).backgroundColor,
        customSelectionPaintIsTransparent:
          /::highlight\(raavi-selection\)\s*\{[\s\S]*?background:\s*transparent;/.test(
            highlightStyles,
          ),
      },
    };
  });

  expect(contract.geometry.menu.width).toBe(248);
  expect(contract.geometry.menu.height).toBe(52);
  expect(contract.geometry.highlight.width).toBe(108);
  expect(contract.geometry.highlight.height).toBe(36);
  expect(contract.geometry.comment.width).toBe(108);
  expect(contract.geometry.comment.height).toBe(36);
  expect(contract.geometry.highlight.x).toBeGreaterThan(
    contract.geometry.comment.x,
  );
  expect(
    Math.abs(
      contract.geometry.menu.x +
        contract.geometry.menu.width / 2 -
        (selected.x + selected.width / 2),
    ),
  ).toBeLessThan(2);
  expect(
    Math.abs(contract.geometry.menu.bottom - contract.geometry.feedback.y),
  ).toBeLessThan(2);
  expect(contract.surface).toEqual({
    background: "rgb(16, 22, 18)",
    border: "0px",
    radius: "14px",
    shadow: expect.stringContaining("6px 16px"),
    gap: "8px",
    padding: "8px",
  });
  expect(contract.highlightStyle).toEqual({
    background: "rgb(86, 74, 23)",
    color: "rgb(242, 245, 241)",
    border: "0px",
    radius: "6px",
    size: "12px",
    weight: "700",
    line: "18px",
  });
  expect(contract.commentStyle).toEqual({
    background: "rgb(38, 57, 98)",
    color: "rgb(154, 181, 255)",
    border: "0px",
    radius: "6px",
  });
  expect(contract.feedbackStyle).toEqual({
    background: "rgb(248, 230, 157)",
    radius: "6px",
    shadow: "none",
    opacity: "0.72",
    nativeSelectionPaint: "rgba(0, 0, 0, 0)",
    customSelectionPaintIsTransparent: true,
  });

  await page.screenshot({
    path: ".artifacts/r08-reading-selection.png",
  });
});

test("R08 supports RTL keyboard flow, every dismissal path, and real actions", async ({
  page,
}) => {
  await openReadingFixture(page);
  const article = page.locator(
    '[data-workspace-screen="reading"] .markdown-body',
  );
  const menu = page.getByRole("toolbar", {
    name: "ابزار متن انتخاب‌شده",
  });
  const feedback = page.locator(".selection-range-feedback");

  await expect(menu).toHaveCount(0);
  await selectFragment(page);
  const highlight = menu.getByRole("button", { name: "هایلایت" });
  const comment = menu.getByRole("button", { name: "نظر" });
  await expect(menu).toBeVisible();
  await expect(menu).toHaveCSS("background-color", "rgb(255, 255, 255)");
  await expect(highlight).toHaveCSS("background-color", "rgb(248, 230, 157)");
  await expect(comment).toHaveCSS("background-color", "rgb(220, 230, 255)");

  await highlight.focus();
  await highlight.press("ArrowLeft");
  await expect(comment).toBeFocused();
  await expect(comment).not.toHaveCSS("box-shadow", "none");
  await comment.press("ArrowRight");
  await expect(highlight).toBeFocused();
  await highlight.press("End");
  await expect(comment).toBeFocused();
  await comment.press("Home");
  await expect(highlight).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(feedback).toHaveCount(0);
  await expect(article).toBeFocused();

  await selectFragment(page);
  await page.locator(".reading-header-document").click({
    position: { x: 500, y: 20 },
  });
  await expect(menu).toHaveCount(0);
  await expect(feedback).toHaveCount(0);

  await selectFragment(page);
  await page.evaluate(() => {
    window.getSelection()?.removeAllRanges();
    document
      .querySelector<HTMLElement>(
        '[data-workspace-screen="reading"] .markdown-body',
      )!
      .dispatchEvent(
        new KeyboardEvent("keyup", { bubbles: true, key: "ArrowRight" }),
      );
  });
  await expect(menu).toHaveCount(0);
  await expect(feedback).toHaveCount(0);

  await selectFragment(page);
  await page.keyboard.press("Control+C");
  await expect(menu).toBeVisible();
  await expect(feedback.first()).toBeVisible();
  await article.click();
  await expect(feedback).toHaveCount(0);

  await selectFragment(page);
  await menu.getByRole("button", { name: "نظر" }).click();
  const composer = page.locator(".annotation-toolbar.is-composing");
  await expect(composer).toBeVisible();
  await expect(menu).toHaveCount(0);
  await composer.getByRole("button", { name: "لغو", exact: true }).click();
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button", { name: "نظر" })).toBeFocused();

  await menu.getByRole("button", { name: "هایلایت" }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.locator("#library-panel")).toHaveClass(/is-open/);
  await expect(page.locator(".reading-highlight-row")).toHaveCount(1);
});

test("R08 keeps both actions touch-safe and inside the mobile Reading workspace", async ({
  page,
}) => {
  await openReadingFixture(page, {
    viewport: { width: 375, height: 812 },
  });
  await selectFragment(page);
  const menu = page.getByRole("toolbar", {
    name: "ابزار متن انتخاب‌شده",
  });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("button")).toHaveCount(2);

  const contract = await page.evaluate(() => {
    const menu = document.querySelector<HTMLElement>(
      ".reading-selection-menu",
    )!;
    const workspace = document.querySelector<HTMLElement>(
      '[data-workspace-screen="reading"]',
    )!;
    const buttons = menu.querySelectorAll<HTMLElement>("button");
    const menuRect = menu.getBoundingClientRect();
    const workspaceRect = workspace.getBoundingClientRect();
    return {
      menu: {
        x: Math.round(menuRect.x),
        right: Math.round(menuRect.right),
        width: Math.round(menuRect.width),
        height: Math.round(menuRect.height),
      },
      workspace: {
        x: Math.round(workspaceRect.x),
        right: Math.round(workspaceRect.right),
      },
      actions: Array.from(buttons, (button) => {
        const rect = button.getBoundingClientRect();
        return {
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }),
    };
  });

  expect(contract.menu.width).toBeGreaterThanOrEqual(240);
  expect(contract.menu.width).toBeLessThanOrEqual(248);
  expect(contract.menu.height).toBe(60);
  expect(contract.menu.x).toBeGreaterThanOrEqual(contract.workspace.x + 8);
  expect(contract.menu.right).toBeLessThanOrEqual(contract.workspace.right - 8);
  expect(contract.actions).toEqual([
    { width: 108, height: 44 },
    { width: 108, height: 44 },
  ]);
});

for (const theme of ["light", "dark"] as const) {
  test(`comment composer is a centered keyboard modal and retains the reading anchor in ${theme}`, async ({ page }) => {
    const quote = "این عبارت برای ثبت نظر در میانهٔ سند است.";
    const content = Array.from({ length: 60 }, (_, index) =>
      `## بخش ${index + 1}\n\n${index === 30 ? quote : "متن خواندنی برای بررسی حفظ محل مطالعه. ".repeat(8)}\n`,
    ).join("\n");
    await openReadingFixture(page, { theme, content });
    await page.evaluate(() => document.fonts.ready);
    const paragraph = page.locator(".workspace--reading .markdown-body p").filter({ hasText: quote });
    await paragraph.scrollIntoViewIfNeeded();
    await selectFragment(page, quote);
    const initialY = (await paragraph.boundingBox())!.y;
    const menu = page.getByRole("toolbar", { name: "ابزار متن انتخاب‌شده" });
    const comment = menu.getByRole("button", { name: "نظر", exact: true });
    const dialog = page.getByRole("dialog", { name: "افزودن نظر", exact: true });
    const field = dialog.getByRole("textbox");
    const cancel = dialog.getByRole("button", { name: "لغو", exact: true });
    const submit = dialog.getByRole("button", { name: "ثبت", exact: true });
    await comment.click();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(field).toBeFocused();
    await expect(submit).toBeDisabled();
    await expect.poll(async () => Math.abs((await paragraph.boundingBox())!.y - initialY)).toBeLessThan(4);
    for (const width of [1024, 1536, 1180]) {
      await page.setViewportSize({ width, height: 858 });
      await expect.poll(() => dialog.evaluate(node => {
        const rect = node.getBoundingClientRect();
        return Math.max(Math.abs(rect.x + rect.width / 2 - innerWidth / 2), Math.abs(rect.y + rect.height / 2 - innerHeight / 2));
      })).toBeLessThan(2);
    }
    // Resizing reflows the document independently of opening or closing a modal.
    const beforeCancelY = (await paragraph.boundingBox())!.y;
    await field.press("Shift+Tab");
    await expect(cancel).toBeFocused();
    await cancel.press("Tab");
    await expect(field).toBeFocused();
    await field.fill("نظر آزمایشی با حفظ محل مطالعه");
    await field.press("Tab");
    await expect(submit).toBeFocused();
    await submit.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(comment).toBeFocused();
    await expect.poll(async () => Math.abs((await paragraph.boundingBox())!.y - beforeCancelY)).toBeLessThan(4);
    await comment.click();
    await page.locator(".annotation-composer-backdrop").click({ position: { x: 5, y: 5 } });
    await expect(dialog).toHaveCount(0);
    await expect(comment).toBeFocused();
    await comment.click();
    const draft = "پیش‌نویس نظر پس از بازخوانی باقی می‌ماند";
    await field.fill(draft);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("raavi:document:v1")!).annotationComposer?.text)).toBe(draft);
    await page.reload();
    await expect(field).toHaveValue(draft);
    await expect(field).toBeFocused();
    await expect(paragraph).toBeInViewport();
    await page.screenshot({ path: `.artifacts/reading-navigation-fix-2026-09-06/comment-modal-${theme}.png` });
    await field.press("Control+Enter");
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("raavi:document:v1")!).annotations.map((a: { body: string }) => a.body))).toContain(draft);
    await expect(page.locator(".workspace--reading .markdown-body")).toBeFocused();
    await expect(paragraph).toBeInViewport();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("raavi:document:v1")!).content)).toBe(content);
  });
}

test("Escape cancels a queued selection frame without reopening the palette", async ({ page }) => {
  await openReadingFixture(page);
  await selectFragment(page);
  await page.locator(".workspace--reading .markdown-body").evaluate(article => {
    const range = window.getSelection()!.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    article.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 }));
    article.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", bubbles: true, cancelable: true }));
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(page.locator(".selection-mini-menu")).toHaveCount(0);
  await expect(page.locator(".selection-range-feedback")).toHaveCount(0);
  await expect(page.locator(".app-shell")).toHaveClass(/is-reading/);
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("");
});
