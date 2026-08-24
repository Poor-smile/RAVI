import { expect, Page, test } from "@playwright/test";

type TargetIssue = {
  label: string;
  width: number;
  height: number;
};

type TinyTextIssue = {
  label: string;
  fontSize: number;
  selector: string;
};

async function touchTargetIssues(page: Page) {
  return page.evaluate(() => {
    const selectors = [
      "button:not([disabled])",
      "summary",
      "input:not([disabled]):not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='file'])",
      "select:not([disabled])",
      "textarea:not([disabled])",
      "label:has(> input[type='checkbox']:not([disabled]))",
      "label:has(> input[type='radio']:not([disabled]))",
      "a.button",
      "a.support-action",
      ".support-modal-footer a",
      "a.library-install-action",
      "a.mermaid-docs-link",
      ".remote-media-blocked > a",
    ].join(",");

    return [...document.querySelectorAll<HTMLElement>(selectors)]
      .filter((element) => {
        if (element.closest("[inert]")) return false;
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0" &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > 0 &&
          rect.left < window.innerWidth &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight
        );
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          label:
            element.getAttribute("aria-label") ||
            element.getAttribute("title") ||
            element.textContent?.trim().replace(/\s+/g, " ").slice(0, 70) ||
            element.tagName,
          width: Math.round(rect.width * 10) / 10,
          height: Math.round(rect.height * 10) / 10,
        };
      })
      .filter((target) => target.width < 44 || target.height < 44) satisfies TargetIssue[];
  });
}

async function tinyTextIssues(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("body *")]
      .filter((element) => {
        if (
          element.closest("[inert]") ||
          element.closest('[aria-hidden="true"]') ||
          ["SCRIPT", "STYLE", "SVG"].includes(element.tagName)
        ) {
          return false;
        }

        const hasDirectText = [...element.childNodes].some(
          (node) =>
            node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
        );
        if (!hasDirectText) return false;

        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          style.opacity !== "0" &&
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > 0 &&
          rect.left < window.innerWidth &&
          rect.bottom > 0 &&
          rect.top < window.innerHeight &&
          Number.parseFloat(style.fontSize) > 0 &&
          Number.parseFloat(style.fontSize) < 9
        );
      })
      .map((element) => ({
        label: element.textContent?.trim().replace(/\s+/g, " ").slice(0, 70) || "",
        fontSize: Number.parseFloat(getComputedStyle(element).fontSize),
        selector: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${
          element.classList.length
            ? `.${[...element.classList].slice(0, 3).join(".")}`
            : ""
        }`,
      })) satisfies TinyTextIssue[],
  );
}

async function expectTypeSafe(page: Page) {
  await expect.poll(() => tinyTextIssues(page)).toEqual([]);
}

async function expectLayoutSafe(page: Page) {
  await expect.poll(() => touchTargetIssues(page)).toEqual([]);
  await expectTypeSafe(page);
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    )
    .toBeLessThanOrEqual(0);
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
}

async function openEditorPane(page: Page) {
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

async function openMarkdownFixture(
  page: Page,
  markdown = "# سند آزمون\n\nمتن آزمایشی",
) {
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page
    .locator('input[type="file"][accept*=".md"]')
    .first()
    .setInputFiles({
      name: "سند-آزمون.md",
      mimeType: "text/markdown",
      buffer: Buffer.from(markdown, "utf8"),
    });
  await expect(page.locator(".document-identity")).toContainText("سند-آزمون.md");
}

async function openLayer(page: Page, triggerSelector: string, layerSelector: string) {
  const trigger = page.locator(triggerSelector);
  const layer = page.locator(layerSelector);
  await expect(trigger).toBeVisible();
  await expect
    .poll(async () => {
      if (
        !(await layer.isVisible()) &&
        (await trigger.getAttribute("aria-expanded")) !== "true"
      ) {
        await trigger.click();
      }
      return layer.isVisible();
    })
    .toBe(true);
}

test("compact states keep every UI target at 44px and prevent viewport clipping", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toBeVisible();
  await openMarkdownFixture(
    page,
    "# جدول آزمون\n\n| ستون | مقدار |\n| --- | --- |\n| الف | ب |",
  );
  await expectLayoutSafe(page);

  const table = page.locator(".markdown-body table").first();
  await expect(table).toBeVisible();
  const tableBox = await table.boundingBox();
  expect(tableBox).not.toBeNull();
  expect(tableBox!.x).toBeGreaterThanOrEqual(0);
  expect(tableBox!.x + tableBox!.width).toBeLessThanOrEqual(320);

  await page.getByRole("button", { name: /بازگشت به میز/ }).click();
  await openMobileMenu(page);
  await expectLayoutSafe(page);
  await page.locator(".mobile-topbar-menu-header > button").click();

  await openMobileMenu(page);
  await page
    .locator(".mobile-topbar-menu-grid")
    .getByRole("button", { name: /بازکردن نوار کناری/ })
    .click();
  await expect(page.locator("#library-panel")).toBeVisible();
  await expectLayoutSafe(page);

  await page.reload({ waitUntil: "domcontentloaded" });
  await openEditorPane(page);
  const tools = page.locator(".format-tools");
  await expect(tools).toBeVisible();
  const toolMetrics = await tools.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    height: element.getBoundingClientRect().height,
  }));
  expect(toolMetrics.scrollWidth).toBe(toolMetrics.clientWidth);
  expect(toolMetrics.height).toBeLessThanOrEqual(220);
  await expectLayoutSafe(page);

  await page.locator('[data-mobile-editor-action="more"]').click();
  await page.getByRole("menuitem", { name: /Mermaid/u }).click();
  const studio = page.locator(".mermaid-studio");
  await expect(studio).toBeVisible();
  await expectLayoutSafe(page);
  await studio.getByRole("option").first().click();
  const compactModeSwitch = studio.locator(".mermaid-mode-switch--compact");
  await expect(compactModeSwitch).toBeVisible();
  await compactModeSwitch.getByRole("button").nth(1).click();
  await studio.locator(".mermaid-pane-actions > button").click();
  await expect(studio.locator("#mermaid-sample-library")).toBeVisible();
  await expectLayoutSafe(page);
});

test("base layout remains overflow-free across compact breakpoints", async ({
  page,
}) => {
  for (const width of [320, 375, 500, 820, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.locator(".app-shell")).toBeVisible();
    if (width <= 820) {
      await expectLayoutSafe(page);
    } else {
      await expectTypeSafe(page);
      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth - window.innerWidth,
          ),
        )
        .toBeLessThanOrEqual(0);
    }
  }
});

test("mobile editor bar exposes exactly five thumb-zone actions above safe areas", async ({
  page,
}) => {
  for (const width of [320, 375, 500, 820]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await openMarkdownFixture(page);
    await openEditorPane(page);

    const bar = page.locator(".editor-primary-tools");
    await expect(bar).toBeVisible();
    await expect(bar.locator("[data-mobile-editor-action]:visible")).toHaveCount(5);
    const metrics = await bar.evaluate((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        position: style.position,
        bottom: Math.round(window.innerHeight - rect.bottom),
        left: Math.round(rect.left),
        right: Math.round(window.innerWidth - rect.right),
      };
    });
    expect(metrics.position).toBe("fixed");
    expect(metrics.bottom).toBeGreaterThanOrEqual(0);
    expect(metrics.left).toBeGreaterThanOrEqual(0);
    expect(metrics.right).toBeGreaterThanOrEqual(0);
    await expectLayoutSafe(page);
  }
});

test("native file pickers stay programmatic and leave no English duplicate in the accessibility tree", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto("/");
  const fileInputs = page.locator('input[type="file"]');
  await expect(fileInputs).toHaveCount(3);
  for (let index = 0; index < 3; index += 1) {
    await expect(fileInputs.nth(index)).toHaveAttribute("aria-hidden", "true");
    await expect(fileInputs.nth(index)).toHaveAttribute("tabindex", "-1");
  }
  await expect(page.getByText("Choose File", { exact: false })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "باز کردن فایل" })).toBeVisible();
});

test("forced-colors keeps focus and active state visible without color alone", async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: "active" });
  await page.setViewportSize({ width: 375, height: 844 });
  await page.goto("/");
  await openMarkdownFixture(page);
  await openEditorPane(page);
  const activeTab = page.locator('.mobile-tabs [aria-selected="true"]');
  const bold = page.locator('[data-mobile-editor-action="bold"]');
  await bold.focus();
  await page.keyboard.press("Tab");
  const state = await page.evaluate(() => {
    const tab = document.querySelector<HTMLElement>('.mobile-tabs [aria-selected="true"]')!;
    const focused = document.activeElement as HTMLElement;
    return {
      activeOutline: getComputedStyle(tab).outlineStyle,
      activeBorder: getComputedStyle(tab).borderStyle,
      focusOutline: getComputedStyle(focused).outlineStyle,
    };
  });
  await expect(activeTab).toBeVisible();
  expect(state.activeOutline).not.toBe("none");
  expect(state.activeBorder).not.toBe("none");
  expect(state.focusOutline).not.toBe("none");
});

test("desktop operational text never falls back to 7px or 8px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toBeVisible();
  await openMarkdownFixture(page);
  await expectTypeSafe(page);
  await page.getByRole("button", { name: /بازگشت به میز/ }).click();

  await openLayer(
    page,
    '[data-sidebar-destination="comments"]',
    "#comments-panel",
  );
  await expectTypeSafe(page);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  const returnToDesk = page.getByRole("button", { name: /بازگشت به میز/ });
  if (await returnToDesk.isVisible()) {
    await returnToDesk.click();
  }
  await page.locator(".header-overflow-trigger").click();
  await page.locator('[data-overflow-action="shortcuts"]').click();
  await expect(page.locator(".shortcut-modal")).toBeVisible();
  await expectTypeSafe(page);

  await page.reload({ waitUntil: "domcontentloaded" });
  await openMarkdownFixture(page);
  const backToDesk = page.getByRole("button", { name: /بازگشت به میز/ });
  if (await backToDesk.isVisible()) await backToDesk.click();
  await page
    .getByRole("button", { name: "ویرایش روان", exact: true })
    .click();
  await page.locator("#markdown-editor:visible .cm-content").fill(
    "# سند آزمون\n\nتغییر ذخیره‌نشده",
  );
  await page.locator(".new-document-trigger").click();
  await expect(page.getByRole("tab", { name: "تب جدید", exact: true })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.locator(".workspace-office-setup")).toBeVisible();
  await expectTypeSafe(page);
});

test("lazy dialogs announce progress instead of leaving a blank delay", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator(".app-shell")).toBeVisible();
  await page.route(/about-dialog/, async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
  });
  await openMobileMenu(page);
  await page
    .locator('[data-overflow-action="about"]')
    .click();

  const loading = page.locator(".deferred-dialog-loading");
  await expect(loading).toBeVisible();
  await expect(loading).toContainText("دربارهٔ راوی در حال آماده‌شدن است");
  await expect(loading).toContainText("این بخش فقط هنگام نیاز بارگذاری می‌شود");
  await expect(page.locator(".about-modal")).toBeVisible();
});
