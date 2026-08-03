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
  const tab = page.locator('.mobile-tabs [role="tab"]').first();
  await expect
    .poll(async () => {
      if ((await tab.getAttribute("aria-selected")) !== "true") {
        await tab.click();
      }
      return tab.getAttribute("aria-selected");
    })
    .toBe("true");
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
  await expectLayoutSafe(page);

  const table = page.locator(".markdown-body table").first();
  await expect(table).toBeVisible();
  const tableBox = await table.boundingBox();
  expect(tableBox).not.toBeNull();
  expect(tableBox!.x).toBeGreaterThanOrEqual(0);
  expect(tableBox!.x + tableBox!.width).toBeLessThanOrEqual(320);

  await openMobileMenu(page);
  await expectLayoutSafe(page);
  await page.locator(".mobile-topbar-menu-header > button").click();

  await openLayer(page, ".mobile-library-trigger", "#library-panel");
  await expectLayoutSafe(page);

  await page.reload({ waitUntil: "domcontentloaded" });
  await openEditorPane(page);
  await page.locator(".format-tool-expand").click();
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

  await page.locator('button[aria-label*="Mermaid"]').click();
  const studio = page.locator(".mermaid-studio");
  await expect(studio).toBeVisible();
  await expectLayoutSafe(page);
  await studio.locator(".mermaid-mode-switch button").nth(1).click();
  await studio.locator(".mermaid-pane-actions > button").click();
  await expect(studio.locator("#mermaid-sample-library")).toBeVisible();
  await expectLayoutSafe(page);
});

test("base layout remains overflow-free across compact breakpoints", async ({
  page,
}) => {
  for (const width of [360, 390, 520, 820]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await expect(page.locator(".app-shell")).toBeVisible();
    await expectLayoutSafe(page);
  }
});

test("desktop operational text never falls back to 7px or 8px", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toBeVisible();
  await expectTypeSafe(page);

  await openLayer(page, ".mobile-library-trigger", "#library-panel");
  await expectTypeSafe(page);

  await page.reload({ waitUntil: "domcontentloaded" });
  await openLayer(page, ".editor-shortcut-help", ".shortcut-modal");
  await expectTypeSafe(page);

  await page.reload({ waitUntil: "domcontentloaded" });
  await openLayer(page, ".new-document-trigger", ".new-document-modal");
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
  await page
    .getByRole("button", { name: "دربارهٔ راوی و نسخهٔ فعلی" })
    .click();

  const loading = page.locator(".deferred-dialog-loading");
  await expect(loading).toBeVisible();
  await expect(loading).toContainText("دربارهٔ راوی در حال آماده‌شدن است");
  await expect(loading).toContainText("این بخش فقط هنگام نیاز بارگذاری می‌شود");
  await expect(page.locator(".about-modal")).toBeVisible();
});
