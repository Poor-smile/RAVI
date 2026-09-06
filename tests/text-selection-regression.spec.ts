import { expect, test, type Locator, type Page } from "@playwright/test";
import { openWritingDocument } from "./helpers/open-writing-document";

const TARGET_LINE = "شروع فارسیEnglish و ادامهٔ جمله برای انتخاب روان متن";
const DRAG_FRAGMENT = "ادامهٔ جمله برای انتخاب روان";
const SECOND_PARAGRAPH = "پاراگراف دوم برای مرزبندی انتخاب چندکلیکی.";
const NAVIGATION_LINES = [
  "خط پیمایش یک",
  "خط پیمایش دو",
  "خط پیمایش سه",
] as const;
const PADDING = Array.from(
  { length: 32 },
  (_, index) => `پاراگراف زمینه ${index + 1} برای آزمون پایداری اسکرول.`,
);
const FIXTURE = [
  "# آزمون جامع انتخاب متن",
  "",
  ...PADDING,
  "",
  ...NAVIGATION_LINES.map((line) => `> ${line}`),
  "",
  TARGET_LINE,
  "",
  SECOND_PARAGRAPH,
  "",
  ...PADDING,
].join("\n");
const STABILITY_SCENARIOS = [
  { name: "بدون Mermaid یا فرمول", content: FIXTURE },
  {
    name: "دارای Mermaid",
    content: [
      FIXTURE,
      "",
      "```mermaid",
      "flowchart RL",
      "  A[آغاز] --> B[بازبینی] --> C[پایان]",
      "```",
    ].join("\n"),
  },
  {
    name: "دارای فرمول",
    content: [FIXTURE, "", "$$", "x^2 + y^2 = z^2", "$$"].join("\n"),
  },
] as const;

type Point = { x: number; y: number };

async function selectedText(page: Page) {
  return page.evaluate(() => window.getSelection()?.toString() ?? "");
}

async function rangePoints(root: Locator, fragment: string) {
  return root.evaluate((element, target) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    let text = "";
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      nodes.push(node as Text);
      text += node.textContent ?? "";
    }
    const targetStart = text.indexOf(target);
    if (targetStart < 0) throw new Error(`Fragment not found: ${target}`);
    const targetEnd = targetStart + target.length;
    const resolveBoundary = (offset: number) => {
      let consumed = 0;
      for (const node of nodes) {
        const next = consumed + node.data.length;
        if (offset <= next) {
          return {
            node,
            offset: Math.max(0, Math.min(node.data.length, offset - consumed)),
          };
        }
        consumed = next;
      }
      throw new Error(`Offset outside selection root: ${offset}`);
    };
    const resolvePoint = (offset: number, after: boolean): Point => {
      let consumed = 0;
      for (const node of nodes) {
        const next = consumed + node.data.length;
        if (offset <= next) {
          const local = Math.max(0, Math.min(node.data.length, offset - consumed));
          const range = document.createRange();
          const start = after ? Math.max(0, local - 1) : local;
          const end = after ? local : Math.min(node.data.length, local + 1);
          range.setStart(node, start);
          range.setEnd(node, Math.max(start, end));
          const rect = range.getBoundingClientRect();
          return {
            x: after ? rect.right - Math.min(2, rect.width / 2) : rect.left + Math.min(2, rect.width / 2),
            y: rect.top + Math.max(2, rect.height / 2),
          };
        }
        consumed = next;
      }
      throw new Error(`Offset outside selection root: ${offset}`);
    };
    const targetStartBoundary = resolveBoundary(targetStart);
    const targetEndBoundary = resolveBoundary(targetEnd);
    const targetRange = document.createRange();
    targetRange.setStart(targetStartBoundary.node, targetStartBoundary.offset);
    targetRange.setEnd(targetEndBoundary.node, targetEndBoundary.offset);
    const targetRect = targetRange.getBoundingClientRect();
    return {
      start: resolvePoint(targetStart, false),
      middle: {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + Math.max(2, targetRect.height / 2),
      },
      end: resolvePoint(targetEnd, true),
    };
  }, fragment);
}

async function clearSelection(page: Page, pressEscape = true) {
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  if (pressEscape) {
    await page.keyboard.press("Escape").catch(() => undefined);
  }
  await page.waitForTimeout(1_000);
}

async function assertGesturesOnEditorMode(
  page: Page,
  mode: "نوشتن" | "کد",
) {
  const modeButton = page.getByRole("button", {
    name: mode === "نوشتن" ? "ویرایش روان" : "متن خام",
    exact: true,
  });
  await modeButton.click();

  const editor = page.locator("#markdown-editor .cm-content");
  const line = editor.locator(".cm-line").filter({ hasText: TARGET_LINE });
  await line.evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "auto" }),
  );
  await page.waitForTimeout(350);
  await expect(line).toBeVisible();
  const scroller = page.locator("#markdown-editor .cm-scroller");

  const navigationLines = NAVIGATION_LINES.map((text) =>
    editor.locator(".cm-line").filter({ hasText: text }),
  );
  await navigationLines[0].scrollIntoViewIfNeeded();
  await navigationLines[0].click();
  await expect(editor.locator(".cm-line.cm-activeLine")).toContainText(
    NAVIGATION_LINES[0],
  );
  await editor.press("ArrowDown");
  await expect(editor.locator(".cm-line.cm-activeLine")).toContainText(
    NAVIGATION_LINES[1],
  );
  await editor.press("ArrowDown");
  await expect(editor.locator(".cm-line.cm-activeLine")).toContainText(
    NAVIGATION_LINES[2],
  );
  await editor.press("ArrowUp");
  await expect(editor.locator(".cm-line.cm-activeLine")).toContainText(
    NAVIGATION_LINES[1],
  );
  await editor.press("ArrowUp");
  await expect(editor.locator(".cm-line.cm-activeLine")).toContainText(
    NAVIGATION_LINES[0],
  );

  const mixed = await rangePoints(line, "فارسیEnglish");
  const doubleStartedAt = await page.evaluate(() => performance.now());
  await page.mouse.dblclick(mixed.middle.x, mixed.middle.y, { delay: 50 });
  await expect.poll(() => selectedText(page)).toBe("فارسیEnglish");
  const doubleDuration =
    (await page.evaluate(() => performance.now())) - doubleStartedAt;
  expect(doubleDuration, `${mode}: double-click response`).toBeLessThan(750);

  await clearSelection(page);
  await line.evaluate((element) =>
    element.scrollIntoView({ block: "center", behavior: "auto" }),
  );
  await page.waitForTimeout(350);
  const triplePoint = await rangePoints(line, "فارسیEnglish");
  await page.mouse.click(triplePoint.middle.x, triplePoint.middle.y, {
    clickCount: 3,
    delay: 50,
  });
  await expect.poll(() => selectedText(page)).toContain(TARGET_LINE);

  await editor.press("ArrowLeft");
  await clearSelection(page);
  const drag = await rangePoints(line, DRAG_FRAGMENT);
  const scrollBefore = await scroller.evaluate((element) => element.scrollTop);
  const dragStartedAt = await page.evaluate(() => performance.now());
  await page.mouse.move(drag.start.x, drag.start.y);
  await page.mouse.down();
  await page.mouse.move(drag.end.x, drag.end.y, { steps: 12 });
  await page.mouse.up();
  await expect.poll(() => selectedText(page)).toContain("جمله برای انتخاب");
  const dragDuration =
    (await page.evaluate(() => performance.now())) - dragStartedAt;
  expect(dragDuration, `${mode}: drag response`).toBeLessThan(750);
  const scrollAfter = await scroller.evaluate((element) => element.scrollTop);
  expect(
    Math.abs(scrollAfter - scrollBefore),
    `${mode}: selection must not shift the editor viewport`,
  ).toBeLessThanOrEqual(8);

  if (mode === "نوشتن") {
    await editor.press("ArrowLeft");
    await clearSelection(page);
    await line.evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "auto" }),
    );
    await page.waitForTimeout(350);
    const destination = editor
      .locator(".cm-line")
      .filter({ hasText: SECOND_PARAGRAPH });
    const crossStart = await rangePoints(line, "شروع فارسیEnglish");
    const crossEnd = await rangePoints(destination, "پاراگراف دوم");
    const toolbar = page.getByRole("toolbar", {
      name: "قالب‌بندی متن انتخاب‌شده",
    });
    await expect(toolbar).toBeHidden();

    await page.mouse.move(crossStart.start.x, crossStart.start.y);
    await page.mouse.down();
    await page.mouse.move(crossEnd.end.x, crossEnd.end.y, { steps: 12 });
    // A real user often pauses to inspect the boundary before releasing. The
    // toolbar must not mount and the active source block must not jump during
    // that pause.
    await page.waitForTimeout(650);
    await expect(toolbar).toBeHidden();
    await expect(line).toHaveClass(/cm-live-syntax-is-visible/u);
    await expect(destination).not.toHaveClass(/cm-live-syntax-is-visible/u);
    await page.mouse.up();

    await expect.poll(() => selectedText(page)).toContain("پاراگراف دو");
    await expect(toolbar).toBeVisible();
  }
}

for (const scenario of STABILITY_SCENARIOS) {
  for (const mode of ["نوشتن", "کد"] as const) {
    test(`${scenario.name}: selection gestures stay fast, line-accurate and stable in ${mode}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 1280, height: 914 });
      await page.goto("/");
      await expect(page.locator(".app-shell")).toHaveAttribute(
        "data-hydrated",
        "true",
      );
      await openWritingDocument(page, { content: scenario.content });

      await assertGesturesOnEditorMode(page, mode);
    });
  }

  test(`${scenario.name}: selection gestures stay stable in Reading with mixed-direction text`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 914 });
    await page.goto("/");
    await expect(page.locator(".app-shell")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    await openWritingDocument(page, { content: scenario.content });
    await page.getByRole("button", { name: "خواندن", exact: true }).click();

    const article = page.locator(
      '[data-workspace-screen="reading"] .markdown-body',
    );
    const paragraph = article.locator("p").filter({ hasText: TARGET_LINE });
    await paragraph.evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "auto" }),
    );
    await page.waitForTimeout(350);
    await expect(paragraph).toBeVisible();
    const workspace = page.locator('[data-workspace-screen="reading"]');

    const mixed = await rangePoints(paragraph, "فارسیEnglish");
    await page.mouse.dblclick(mixed.middle.x, mixed.middle.y, { delay: 50 });
    await expect.poll(() => selectedText(page)).toBe("فارسیEnglish");

    await clearSelection(page, false);
    await paragraph.evaluate((element) =>
      element.scrollIntoView({ block: "center", behavior: "auto" }),
    );
    await page.waitForTimeout(350);
    const triplePoint = await rangePoints(paragraph, "فارسیEnglish");
    await page.mouse.click(triplePoint.middle.x, triplePoint.middle.y, {
      clickCount: 3,
      delay: 50,
    });
    await expect.poll(() => selectedText(page)).toContain(TARGET_LINE);

    await clearSelection(page, false);
    const drag = await rangePoints(paragraph, DRAG_FRAGMENT);
    const scrollBefore = await workspace.evaluate((element) => element.scrollTop);
    await page.mouse.move(drag.start.x, drag.start.y);
    await page.mouse.down();
    await page.mouse.move(drag.end.x, drag.end.y, { steps: 12 });
    await page.mouse.up();
    await expect.poll(() => selectedText(page)).toContain("جمله برای انتخاب");
    const scrollAfter = await workspace.evaluate((element) => element.scrollTop);
    expect(Math.abs(scrollAfter - scrollBefore)).toBeLessThanOrEqual(2);
  });
}
