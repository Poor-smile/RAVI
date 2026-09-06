import { expect, test, type Page } from "@playwright/test";

const READING_TOOLS_FIXTURE = [
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
  "  style A fill:#fcfdf9,stroke:#cbd0c6,color:#171b18",
  "  style B fill:#e9efff,stroke:#2557e5,color:#1742bd",
  "  style C fill:#fcfdf9,stroke:#cbd0c6,color:#171b18",
  "  linkStyle default stroke:#50584f",
  "```",
].join("\n");

const READING_TOOLS_LONG_FIXTURE = [
  "# سنجش پیوستگی اندازهٔ متن",
  "",
  ...Array.from({ length: 64 }, (_, index) => [
    `## بخش ${(index + 1).toLocaleString("fa-IR")}`,
    "",
    `بند یکتای ${(index + 1).toLocaleString("fa-IR")} برای اطمینان از باقی‌ماندن خواننده در موقعیت زندهٔ سند پس از تغییر اندازهٔ متن نوشته شده است.`,
    "",
  ]).flat(),
].join("\n");

async function openReadingFixture(
  page: Page,
  viewport = { width: 1180, height: 858 },
  content = READING_TOOLS_FIXTURE,
) {
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript((content) => {
    window.localStorage.clear();
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
        documentType: "markdown",
        lastSavedSnapshot: content,
        draftId: "r07-reading-tools",
        viewMode: "reading",
        readingOutlineOpen: false,
        readingPositions: {},
        annotationComposer: null,
      }),
    );
  }, content);
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
}

test("R07 matches the exact 232×68 text-size popover from Figma", async ({
  page,
}) => {
  await openReadingFixture(page);

  const trigger = page.getByRole("button", {
    name: "ابزار مطالعه",
    exact: true,
  });
  await trigger.click();

  const menu = page.getByRole("menu", { name: "ابزار مطالعه" });
  const decrease = menu.getByRole("menuitem", {
    name: "کوچک‌تر کردن متن",
  });
  const increase = menu.getByRole("menuitem", {
    name: "بزرگ‌تر کردن متن",
  });
  const value = menu.locator(".reading-tools-size-value");

  await expect(menu).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(menu.getByRole("menuitem")).toHaveCount(2);
  await expect(page.getByRole("menuitem", { name: /هایلایت‌ها|نظرات/ })).toHaveCount(0);
  await expect(value).toHaveText("۱۸");
  await expect(decrease.locator('[data-material-symbol="text_decrease"]')).toBeVisible();
  await expect(increase.locator('[data-material-symbol="text_increase"]')).toBeVisible();
  await expect(decrease).toBeFocused();

  const contract = await menu.evaluate((node) => {
    const element = node as HTMLElement;
    const rect = (target: Element) => {
      const bounds = target.getBoundingClientRect();
      return {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      };
    };
    const controls = element.querySelectorAll("button");
    const valueNode = element.querySelector<HTMLElement>(
      ".reading-tools-size-value",
    )!;
    const style = getComputedStyle(element);
    const valueStyle = getComputedStyle(valueNode);
    return {
      menu: rect(element),
      trigger: rect(document.querySelector(".reading-header-tools-toggle")!),
      decrease: rect(controls[0]),
      value: rect(valueNode),
      increase: rect(controls[1]),
      surface: {
        background: style.backgroundColor,
        border: style.borderWidth,
        radius: style.borderRadius,
        shadow: style.boxShadow,
      },
      type: {
        color: valueStyle.color,
        size: valueStyle.fontSize,
        weight: valueStyle.fontWeight,
        line: valueStyle.lineHeight,
      },
    };
  });

  expect(contract.menu).toEqual({ x: contract.trigger.x - 120, y: contract.trigger.y + 36, width: 232, height: 68 });
  expect(contract.decrease).toEqual({ x: contract.menu.x + 32, y: contract.menu.y + 16, width: 36, height: 36 });
  expect(contract.value).toEqual({ x: contract.menu.x + 76, y: contract.menu.y + 22, width: 80, height: 24 });
  expect(contract.increase).toEqual({ x: contract.menu.x + 164, y: contract.menu.y + 16, width: 36, height: 36 });
  expect(contract.surface).toEqual({
    background: "rgb(255, 255, 255)",
    border: "0px",
    radius: "14px",
    shadow: expect.stringContaining("14px 34px"),
  });
  expect(contract.type).toEqual({
    color: "rgb(80, 88, 79)",
    size: "12px",
    weight: "700",
    line: "18px",
  });

  await expect(
    page.locator(
      '[data-workspace-screen="reading"] .mermaid-diagram .mermaid-render-surface',
    ),
  ).toBeVisible({ timeout: 15_000 });
  await page.screenshot({
    path: ".artifacts/r07-reading-tools.png",
  });
});

test("R07 enforces 16–22, keyboard navigation, and Escape focus restoration", async ({
  page,
}) => {
  await openReadingFixture(page);

  const trigger = page.getByRole("button", { name: "ابزار مطالعه" });
  await trigger.click();
  const menu = page.getByRole("menu", { name: "ابزار مطالعه" });
  const decrease = menu.getByRole("menuitem", {
    name: "کوچک‌تر کردن متن",
  });
  const increase = menu.getByRole("menuitem", {
    name: "بزرگ‌تر کردن متن",
  });
  const value = menu.locator(".reading-tools-size-value");
  const article = page.locator(
    '[data-workspace-screen="reading"] .markdown-body',
  );

  await decrease.press("ArrowRight");
  await expect(increase).toBeFocused();
  await increase.press("Home");
  await expect(decrease).toBeFocused();

  await decrease.click();
  await decrease.click();
  await expect(value).toHaveText("۱۶");
  await expect(decrease).toBeDisabled();
  await expect(increase).toBeEnabled();
  await expect(article).toHaveCSS("font-size", "16px");

  for (let step = 0; step < 6; step += 1) {
    await increase.click();
  }
  await expect(value).toHaveText("۲۲");
  await expect(increase).toBeDisabled();
  await expect(decrease).toBeEnabled();
  await expect(article).toHaveCSS("font-size", "22px");

  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await page.locator('[data-workspace-screen="reading"]').click({
    position: { x: 400, y: 300 },
  });
  await expect(menu).toBeHidden();
});

test("R07 keeps the Reading Rail reachable beside the mobile Drawer", async ({
  page,
}) => {
  await openReadingFixture(page, { width: 375, height: 812 });

  const sidebar = page.locator("#library-panel");
  const rail = sidebar.locator(".sidebar-rail");
  const commentsTrigger = rail.getByRole("button", {
    name: "نظرات",
    exact: true,
  });
  await expect(sidebar).toHaveClass(/has-persistent-rail/);
  await expect(sidebar).toHaveAttribute("role", "complementary");
  await expect(rail).toBeVisible();
  await expect(rail.getByRole("button")).toHaveCount(5);
  await expect(commentsTrigger).toBeVisible();
  await expect(
    page.locator(".reading-header-outline-toggle--mobile"),
  ).toHaveCount(0);

  const railContract = await page.evaluate(() => {
    const railNode = document.querySelector<HTMLElement>(
      "#library-panel .sidebar-rail",
    )!;
    const button = railNode.querySelector<HTMLElement>("button")!;
    const railRect = railNode.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();
    return {
      rail: {
        x: Math.round(railRect.x),
        width: Math.round(railRect.width),
      },
      button: {
        width: Math.round(buttonRect.width),
        height: Math.round(buttonRect.height),
      },
    };
  });
  expect(railContract).toEqual({
    rail: { x: 319, width: 56 },
    button: { width: 44, height: 44 },
  });

  const toolsTrigger = page.getByRole("button", { name: "ابزار مطالعه" });
  await expect(toolsTrigger).toHaveCSS("border-width", "0px");
  await toolsTrigger.click();
  const menu = page.getByRole("menu", { name: "ابزار مطالعه" });
  await expect(menu.getByRole("menuitem")).toHaveCount(2);
  await expect(menu.getByRole("menuitem").first()).toHaveCSS("width", "44px");
  const increase = menu.getByRole("menuitem", {
    name: "بزرگ‌تر کردن متن",
  });
  for (let step = 0; step < 4; step += 1) {
    await increase.click();
  }
  await expect(menu.locator(".reading-tools-size-value")).toHaveText("۲۲");
  await expect(
    page.locator('[data-workspace-screen="reading"] .markdown-body'),
  ).toHaveCSS("font-size", "22px");
  await page.keyboard.press("Escape");

  await commentsTrigger.click();
  await expect(sidebar).toHaveAttribute("role", "dialog");
  await expect(sidebar).toHaveAttribute("aria-modal", "true");
  await expect(commentsTrigger).toHaveAttribute("aria-current", "page");
});

test("R07 preserves the live reading anchor instead of a delayed saved position", async ({
  page,
}) => {
  await openReadingFixture(
    page,
    { width: 1180, height: 858 },
    READING_TOOLS_LONG_FIXTURE,
  );

  await page.getByRole("button", { name: "ابزار مطالعه" }).click();
  await expect(page.getByRole("menu", { name: "ابزار مطالعه" })).toBeVisible();

  const readProbe = () =>
    page.evaluate(() => {
      const root = document.querySelector<HTMLElement>(".workspace")!;
      const blocks = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[data-workspace-screen="reading"] .markdown-body :is(h1, h2, p)',
        ),
      );
      const rootRect = root.getBoundingClientRect();
      const probeY = Math.min(
        rootRect.bottom - 120,
        Math.max(rootRect.top + 110, rootRect.top + rootRect.height * 0.42),
      );
      const block = blocks.reduce((closest, candidate) => {
        const closestRect = closest.getBoundingClientRect();
        const candidateRect = candidate.getBoundingClientRect();
        const closestDistance =
          closestRect.top <= probeY && closestRect.bottom >= probeY
            ? 0
            : Math.min(
                Math.abs(closestRect.top - probeY),
                Math.abs(closestRect.bottom - probeY),
              );
        const candidateDistance =
          candidateRect.top <= probeY && candidateRect.bottom >= probeY
            ? 0
            : Math.min(
                Math.abs(candidateRect.top - probeY),
                Math.abs(candidateRect.bottom - probeY),
              );
        return candidateDistance < closestDistance ? candidate : closest;
      });
      return {
        text: block.textContent?.trim() ?? "",
        offset: Math.round(block.getBoundingClientRect().top - probeY),
        progress:
          root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight),
      };
    });

  await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".workspace")!;
    root.scrollTop = (root.scrollHeight - root.clientHeight) * 0.24;
    root.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.waitForTimeout(320);
  const savedProbe = await readProbe();

  const liveProbe = await page.evaluate(() => {
    const root = document.querySelector<HTMLElement>(".workspace")!;
    root.scrollTop = (root.scrollHeight - root.clientHeight) * 0.72;
    root.dispatchEvent(new Event("scroll", { bubbles: true }));
    const blocks = Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-workspace-screen="reading"] .markdown-body :is(h1, h2, p)',
      ),
    );
    const rootRect = root.getBoundingClientRect();
    const probeY = Math.min(
      rootRect.bottom - 120,
      Math.max(rootRect.top + 110, rootRect.top + rootRect.height * 0.42),
    );
    const block = blocks.reduce((closest, candidate) => {
      const distance = (element: HTMLElement) => {
        const rect = element.getBoundingClientRect();
        return rect.top <= probeY && rect.bottom >= probeY
          ? 0
          : Math.min(Math.abs(rect.top - probeY), Math.abs(rect.bottom - probeY));
      };
      return distance(candidate) < distance(closest) ? candidate : closest;
    });
    document
      .querySelector<HTMLButtonElement>(
        '#reading-tools-menu button[aria-label="بزرگ‌تر کردن متن"]',
      )!
      .click();
    return {
      text: block.textContent?.trim() ?? "",
      offset: Math.round(block.getBoundingClientRect().top - probeY),
      progress:
        root.scrollTop / Math.max(1, root.scrollHeight - root.clientHeight),
    };
  });

  expect(liveProbe.text).not.toBe(savedProbe.text);
  await expect(
    page.locator('[data-workspace-screen="reading"] .markdown-body'),
  ).toHaveCSS("font-size", "19px");
  await page.waitForTimeout(480);
  const restoredProbe = await readProbe();
  expect(restoredProbe.text).toBe(liveProbe.text);
  expect(Math.abs(restoredProbe.offset - liveProbe.offset)).toBeLessThan(80);
  expect(restoredProbe.progress).toBeGreaterThan(0.55);
});
