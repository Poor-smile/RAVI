import { expect, test } from "@playwright/test";

const COMMENTS_FIXTURE = [
  "# تصمیم‌های طراحی",
  "",
  "این تصمیم باید مستند شود.",
  "",
  "# رفتار محصول",
  "",
  "رفتارها باید همان باشد.",
  "",
  "# سطح سند",
  "",
  "سند وسط‌چین شود.",
].join("\n");

test("P07 assembles the independent editable Comments panel from Figma", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.addInitScript((content) => {
    window.localStorage.clear();
    window.localStorage.setItem("raavi:theme:v1", "dark");
    const now = new Date();
    const entries = [
      {
        id: "p07-decision",
        quote: "این تصمیم باید مستند شود.",
        body: "به یک مرجع معتبر نیاز دارد.",
        hour: 12,
        minute: 40,
      },
      {
        id: "p07-behavior",
        quote: "رفتارها باید همان باشد.",
        body: "در تست پذیرش بررسی شود.",
        hour: 11,
        minute: 5,
      },
      {
        id: "p07-width",
        quote: "سند وسط‌چین شود.",
        body: "حداکثر عرض هم ثبت شود.",
        dayOffset: 1,
      },
    ];
    const annotations = entries.map((entry) => {
      const createdAt = new Date(now);
      createdAt.setDate(createdAt.getDate() - (entry.dayOffset ?? 0));
      createdAt.setHours(entry.hour ?? 12, entry.minute ?? 0, 0, 0);
      const start = content.indexOf(entry.quote);
      return {
        id: entry.id,
        kind: "comment",
        start,
        end: start + entry.quote.length,
        quote: entry.quote,
        prefix: content.slice(Math.max(0, start - 32), start),
        suffix: content.slice(
          start + entry.quote.length,
          start + entry.quote.length + 32,
        ),
        body: entry.body,
        createdAt: createdAt.toISOString(),
      };
    });
    window.localStorage.setItem(
      "raavi:document:v1",
      JSON.stringify({
        fileName: "تصمیم‌های طراحی.ravi",
        content,
        readerSize: 18,
        annotations,
        assets: [],
        revision: 1,
        versions: [],
        activeDocumentPath: "C:\\Raavi\\تصمیم‌های طراحی.ravi",
        documentType: "ravi",
        lastSavedSnapshot: content,
        draftId: "p07-comments",
        viewMode: "desk",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, COMMENTS_FIXTURE);

  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );

  const trigger = page.getByRole("button", { name: "نظرات", exact: true });
  await trigger.click();

  const sidebar = page.locator("#library-panel");
  const panel = page.locator("#comments-panel");
  const rows = panel.locator(".reading-comment-row");
  const jumps = rows.locator(".reading-comment-row-jump");
  const bodies = rows.locator(".reading-comment-row-body");

  await expect(panel).toBeVisible();
  await expect(page.locator("#sidebar-pane-title")).toHaveText("نظرات");
  await expect(
    sidebar.getByRole("button", { name: "جمع‌کردن نوار کناری" }),
  ).toBeVisible();
  await expect(
    sidebar.getByRole("button", { name: "جست‌وجو در نظرات" }),
  ).toBeVisible();
  await expect(panel.locator(".reading-comments-summary")).toHaveText(
    "نظرات · ۳ مورد",
  );
  await expect(rows).toHaveCount(3);
  await expect(rows.locator(".reading-comment-row-main svg")).toHaveCount(0);
  await expect(panel.getByRole("button", { name: /افزودن نظر/ })).toHaveCount(0);
  await expect(jumps.nth(0)).toContainText("«این تصمیم باید مستند شود.»");
  await expect(bodies.nth(0)).toHaveValue("به یک مرجع معتبر نیاز دارد.");
  await expect(bodies.nth(1)).toHaveValue("در تست پذیرش بررسی شود.");
  await expect(bodies.nth(2)).toHaveValue("حداکثر عرض هم ثبت شود.");
  await expect(jumps.nth(0)).toHaveAttribute("aria-current", "location");
  await expect(rows.nth(2).locator("time")).toHaveText("دیروز");
  await expect(sidebar).toContainText("Markdown · محلی و قابل‌حمل");

  await page.waitForTimeout(260);
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
        shell: rect("#library-panel"),
        pane: rect("#library-panel .sidebar-pane"),
        rail: rect("#library-panel .sidebar-rail"),
        header: rect("#library-panel .sidebar-pane-header"),
        summary: rect(".reading-comments-summary"),
        row: rect(".reading-comment-row"),
        footer: rect("#library-panel .library-footer"),
      },
      surface: {
        panelBackground: style("#library-panel .sidebar-pane").backgroundColor,
        rowBorder: style(".reading-comment-row-main").borderWidth,
        activeBackground: style(
          ".reading-comment-row.is-active .reading-comment-row-main",
        ).backgroundColor,
        activeQuote: style(
          ".reading-comment-row.is-active .reading-comment-row-jump",
        ).color,
        bodyColor: style(
          ".reading-comment-row.is-active .reading-comment-row-body",
        ).color,
        timeColor: style(
          ".reading-comment-row.is-active .reading-comment-row-main time",
        ).color,
        quoteSize: style(".reading-comment-row-jump strong").fontSize,
        bodySize: style(".reading-comment-row-body").fontSize,
      },
      targets: {
        jump: rect(".reading-comment-row-jump").height,
        body: rect(".reading-comment-row-body").height,
      },
    };
  });

  expect(contract.geometry).toEqual({
    shell: { x: 920, y: 92, width: 360, height: 822 },
    pane: { x: 920, y: 92, width: 304, height: 822 },
    rail: { x: 1224, y: 92, width: 56, height: 822 },
    header: { x: 934, y: 106, width: 276, height: 52 },
    summary: { x: 934, y: 214, width: 276, height: 18 },
    row: { x: 934, y: 236, width: 276, height: 64 },
    footer: { x: 934, y: 866, width: 276, height: 34 },
  });
  expect(contract.surface).toEqual({
    panelBackground: "rgb(14, 19, 15)",
    rowBorder: "0px",
    activeBackground: "rgb(32, 46, 80)",
    activeQuote: "rgb(134, 168, 255)",
    bodyColor: "rgb(189, 198, 189)",
    timeColor: "rgb(174, 184, 175)",
    quoteSize: "12px",
    bodySize: "11px",
  });
  expect(contract.targets).toEqual({ jump: 24, body: 24 });

  await page.mouse.move(500, 500);
  await page.screenshot({
    path: ".artifacts/p07-comments-dark.png",
    fullPage: true,
  });

  await jumps.nth(0).click();
  await expect
    .poll(() =>
      page.evaluate(() => ({
        activeLabel: document.activeElement?.getAttribute("aria-label"),
        selection: window.getSelection()?.toString() ?? "",
      })),
    )
    .toEqual({
      activeLabel: "متن Markdown",
      selection: "این تصمیم باید مستند شود.",
    });

  const searchAction = sidebar.getByRole("button", {
    name: "جست‌وجو در نظرات",
  });
  await searchAction.click();
  const search = panel.getByRole("searchbox", {
    name: "جست‌وجو در نظرات سند",
  });
  await expect(search).toBeFocused();
  await search.fill("پذيرش");
  await expect(rows).toHaveCount(1);
  await expect(bodies.first()).toHaveValue("در تست پذیرش بررسی شود.");
  await search.fill("ناموجود");
  await expect(panel).toContainText("نظری مطابق جست‌وجو پیدا نشد");
  await panel
    .getByRole("button", { name: "پاک‌کردن جست‌وجوی نظرات" })
    .click();
  await expect(rows).toHaveCount(3);
  await searchAction.click();
  await expect(search).toBeHidden();

  await jumps.nth(0).focus();
  await page.keyboard.press("ArrowDown");
  await expect(jumps.nth(1)).toBeFocused();
  await page.keyboard.press("End");
  await expect(jumps.nth(2)).toBeFocused();

  await bodies.nth(1).fill("در پذیرش نهایی دوباره بررسی شود.");
  await expect(bodies.nth(1)).toHaveValue(
    "در پذیرش نهایی دوباره بررسی شود.",
  );
  await expect
    .poll(() =>
      page.evaluate(() => {
        const snapshot = JSON.parse(
          window.localStorage.getItem("raavi:document:v1") ?? "{}",
        ) as { annotations?: Array<{ id: string; body: string }> };
        return snapshot.annotations?.find(
          (annotation) => annotation.id === "p07-behavior",
        )?.body;
      }),
    )
    .toBe("در پذیرش نهایی دوباره بررسی شود.");
  await bodies.nth(1).press("Escape");
  await expect(jumps.nth(1)).toBeFocused();

  await jumps.nth(1).press("Delete");
  await expect(rows).toHaveCount(2);
  await expect(page.locator(".annotation-undo-notice")).toContainText(
    "نظر حذف شد.",
  );
  await page.getByRole("button", { name: "واگرد", exact: true }).click();
  await expect(rows).toHaveCount(3);
  await expect(jumps.nth(1)).toBeFocused();

  for (let remaining = 2; remaining >= 0; remaining -= 1) {
    await jumps.first().focus();
    await jumps.first().press("Delete");
    await expect(rows).toHaveCount(remaining);
  }
  await expect(panel).toContainText("نظرات · ۰ مورد");
  await expect(panel).toContainText("هنوز نشانهٔ هوشمندی ثبت نشده");
  for (let restored = 1; restored <= 3; restored += 1) {
    await page
      .locator(".annotation-undo-notice")
      .first()
      .getByRole("button", { name: "واگرد", exact: true })
      .click();
    await expect(rows).toHaveCount(restored);
  }

  await jumps.first().focus();
  await jumps.first().press("Escape");
  await expect(sidebar).toHaveClass(/is-collapsed/);
  await expect(trigger).toBeFocused();

  await page.setViewportSize({ width: 1024, height: 812 });
  const overflow = page.getByRole("button", {
    name: "بازکردن فرمان‌های بیشتر",
  });
  await overflow.click();
  await page
    .getByRole("button", { name: /بازکردن نوار کناری/ })
    .click();
  await expect(sidebar).toHaveAttribute("role", "dialog");
  await sidebar.getByRole("button", { name: "جست‌وجو در نظرات" }).click();
  await jumps.first().focus();
  const compactTargets = await page.evaluate(() => {
    const size = (selector: string) => {
      const bounds = document
        .querySelector<HTMLElement>(selector)!
        .getBoundingClientRect();
      return {
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    return {
      searchDismiss: size(".reading-comments-search-control button"),
      deleteAction: size(".reading-comment-row-delete"),
      jump: size(".reading-comment-row-jump"),
      body: size(".reading-comment-row-body"),
      row: size(".reading-comment-row"),
    };
  });
  expect(compactTargets).toMatchObject({
    searchDismiss: { width: 32, height: 32 },
    deleteAction: { width: 36, height: 36 },
    jump: { height: 24 },
    body: { height: 24 },
    row: { height: 64 },
  });
  await page.keyboard.press("Escape");
  await expect(sidebar).toBeHidden();
  await expect(overflow).toBeFocused();
});
