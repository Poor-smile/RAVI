import { expect, test, type Page } from "@playwright/test";

const READING_DOCUMENT = [
  "# راهنمای مطالعه",
  "",
  "این متن برای بررسی تنظیمات واقعی مطالعه نوشته شده است.",
  "",
  "## بخش دوم",
  "",
  ...Array.from(
    { length: 28 },
    (_, index) =>
      `بند ${(index + 1).toLocaleString("fa-IR")} برای سنجش عرض، فاصلهٔ خطوط و رفتار هدر در یک سند بلند.`,
  ),
].join("\n\n");

async function openSettings(page: Page) {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page.locator(".header-overflow-trigger").click();
  await page.locator('[data-overflow-action="shortcut-settings"]').click();
  await page
    .getByRole("navigation", { name: "دسته‌های تنظیمات" })
    .getByRole("button", { name: "مطالعه" })
    .click();
}

test("P16 Reading matches Figma and drives the real reading surface", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1024 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((content) => {
    window.localStorage.clear();
    window.localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        fileName: "راهنمای-مطالعه.md",
        content,
        readerSize: 18,
        annotations: [],
        assets: [],
        revision: 1,
        versions: [],
        activeDocumentPath: "C:\\Raavi\\راهنمای-مطالعه.md",
        documentType: "markdown",
        lastSavedSnapshot: content,
        draftId: "p16-reading",
        viewMode: "writing",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, READING_DOCUMENT);
  await openSettings(page);

  const dialog = page.getByRole("dialog", { name: "مطالعه" });
  const sections = dialog.locator(".reading-settings-section");
  await expect(sections).toHaveCount(2);
  await expect(dialog.getByRole("radiogroup")).toHaveCount(3);
  await expect(dialog.getByRole("switch")).toHaveCount(3);
  const switchDirection = await dialog
    .getByRole("switch")
    .evaluateAll((switches) =>
      switches.map((control) => {
        const track = control.querySelector<HTMLElement>(
          ".settings-switch-track",
        )!;
        const thumb = track.firstElementChild!.getBoundingClientRect();
        const bounds = track.getBoundingClientRect();
        return {
          checked: control.getAttribute("aria-checked") === "true",
          thumbOnPhysicalLeft: thumb.x < bounds.x + bounds.width / 2,
        };
      }),
    );
  expect(switchDirection).toEqual([
    { checked: true, thumbOnPhysicalLeft: true },
    { checked: true, thumbOnPhysicalLeft: true },
    { checked: false, thumbOnPhysicalLeft: false },
  ]);

  const geometry = await dialog.evaluate((node) => {
    const rect = (element: Element) => {
      const bounds = element.getBoundingClientRect();
      return {
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    return {
      surface: rect(node.querySelector(".reading-settings")!),
      sections: Array.from(
        node.querySelectorAll(".reading-settings-section"),
        rect,
      ),
      rows: Array.from(node.querySelectorAll(".settings-preference-row"), rect),
      segments: Array.from(
        node.querySelectorAll(".settings-segmented-control"),
        rect,
      ),
      horizontalOverflow:
        node.querySelector<HTMLElement>(".shortcut-settings-content")!
          .scrollWidth -
        node.querySelector<HTMLElement>(".shortcut-settings-content")!
          .clientWidth,
    };
  });
  expect(geometry.sections).toHaveLength(2);
  expect(geometry.sections[0].width).toBe(geometry.sections[1].width);
  expect(geometry.sections[0].height).toBeLessThan(320);
  expect(geometry.sections[1].height).toBeLessThan(320);
  expect(geometry.rows.map((row) => row.height)).toEqual(Array(6).fill(64));
  expect(geometry.segments).toEqual(Array(3).fill({ width: 270, height: 40 }));
  expect(geometry.horizontalOverflow).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: ".artifacts/p16-settings-reading.png",
    fullPage: false,
  });

  const textSize = dialog.getByRole("radiogroup", { name: "اندازهٔ متن" });
  await textSize.getByRole("radio", { name: "معمولی" }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(textSize.getByRole("radio", { name: "کوچک" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await textSize.getByRole("radio", { name: "بزرگ" }).click();
  await dialog
    .getByRole("radiogroup", { name: "فاصلهٔ خطوط" })
    .getByRole("radio", { name: "باز" })
    .click();
  await dialog
    .getByRole("radiogroup", { name: "عرض متن" })
    .getByRole("radio", { name: "باریک" })
    .click();
  await dialog.getByRole("switch", { name: "پنهان شدن خودکار هدر" }).click();
  await dialog.getByRole("switch", { name: "باز کردن فهرست مطالب" }).click();

  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(
          localStorage.getItem("raavi:reading-preferences:v1") ?? "{}",
        ),
      ),
    )
    .toEqual({
      textSize: "large",
      lineSpacing: "open",
      textWidth: "narrow",
      rememberPosition: true,
      autoHideHeader: false,
      openOutlineOnEnter: true,
    });

  await dialog.getByRole("button", { name: "بازگشت به سند" }).click();
  await page.keyboard.press("F9");
  const shell = page.locator(".app-shell");
  const article = page.locator('[data-workspace-screen="reading"] .markdown-body');
  const sheet = page.locator('[data-workspace-screen="reading"] .preview-pane');
  await expect(shell).toHaveClass(/is-reading/);
  await expect(article).toHaveCSS("font-size", "20px");
  await expect(article).toHaveCSS("line-height", "45px");
  await expect(sheet).toHaveCSS("width", "640px");
  await expect(page.locator("#library-panel")).not.toHaveClass(/is-collapsed/);
  await expect(page.locator("#sidebar-pane-title")).toHaveText("فهرست سند");

  await page.locator('[data-workspace-screen="reading"]').evaluate((node) => {
    node.scrollTop = 700;
    node.dispatchEvent(new Event("scroll"));
  });
  await page.waitForTimeout(250);
  await expect(page.locator(".reading-header-document")).toBeVisible();
});

test("P16 Reading remains touch-safe and overflow-free on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => window.localStorage.clear());
  await openSettings(page);

  const contract = await page.evaluate(() => {
    const targets = document.querySelectorAll<HTMLElement>(
      ".reading-settings .settings-segmented-control > button, .reading-settings .settings-switch",
    );
    return {
      targetHeights: Array.from(targets, (target) =>
        Math.round(target.getBoundingClientRect().height),
      ),
      overflow:
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    };
  });
  expect(contract.overflow).toBeLessThanOrEqual(0);
  for (const height of contract.targetHeights) {
    expect(height).toBeGreaterThanOrEqual(44);
  }
});
