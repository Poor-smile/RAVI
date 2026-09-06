import { releaseElectron as electron } from "./helpers/release-electron";
import { expect, test, type Page } from "@playwright/test";
import { type ElectronApplication } from "playwright";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { waitForRaaviWindow } from "./helpers/electron-main-window";

type ReadingMetric = {
  mode: "reading" | "desk";
  scrollTop: number;
  maxScroll: number;
  progress: number;
  anchorIndex: number;
  anchorText: string;
  anchorOffset: number;
  articleLeft: number;
  articleWidth: number;
  readerSize: string;
  annotationPanelOpen: boolean;
  composerOpen: boolean;
  selectionText: string;
  selectionFeedbackCount: number;
  readingOutlineOpen: boolean;
  readingHeaderState: "visible" | "concealed" | "desk";
  horizontalOverflow: number;
  viewportWidth: number;
  viewportHeight: number;
};

type AuditResult = {
  scenario: string;
  before?: ReadingMetric;
  after: ReadingMetric;
  anchorChanged?: boolean;
  progressDelta?: number;
  details?: Record<string, string | number | boolean>;
};

const paragraphTemplates = [
  "خواندن پیوسته زمانی شکل می‌گیرد که چشم، جای خود را روی صفحه گم نکند. هر تغییر رابط باید موقعیت جملهٔ جاری را ثابت نگه دارد و ابزارها نباید ریتم مطالعه را قطع کنند.",
  "در یک سند بلند، درصد اسکرول به‌تنهایی نشانی دقیقی نیست؛ چون تصویر، نمودار، اندازهٔ قلم و بازشدن حاشیه‌ها ارتفاع صفحه را تغییر می‌دهند. یک لنگر متنی پایدار لازم است.",
  "کاربر ممکن است میان متن و یادداشت رفت‌وآمد کند، بخشی را کپی کند، اندازهٔ نوشته را عوض کند یا برنامه را ببندد. پس از هرکدام باید همان بند و همان خط تقریبی دوباره دیده شود.",
  "فهرست فصل‌ها ابزار جهت‌یابی است، نه دلیلی برای پرش ناخواسته. باز و بسته‌شدن آن باید با جبران تغییر چیدمان همراه باشد تا بند زیر چشم در جای قبلی بماند.",
  "یادداشت‌گذاری بخشی از خواندن است. بازشدن فرم حاشیه یا ستون یادداشت‌ها نباید متن را ناگهان باریک کند و چند صفحه جلو یا عقب ببرد.",
  "بازیابی پس از بستن برنامه باید بر اساس هویت سند انجام شود. مسیر فایل، امضای محتوا و نزدیک‌ترین تیتر می‌توانند یک رکورد قابل اعتماد برای ادامهٔ مطالعه بسازند.",
  "تصویرها و نمودارها دیرتر از متن اندازه می‌گیرند. بازیابی مکان خواندن باید پس از پایدارشدن فونت‌ها و رسانه‌ها دوباره کنترل شود تا لنگر نهایی دقیق بماند.",
  "در صفحه‌های کوچک، نوار بالایی و فهرست فصل‌ها فضای بیشتری می‌گیرند. معیار صحیح، ثابت‌ماندن بند خوانده‌شده نسبت به viewport است، نه ثابت‌ماندن عدد خام scrollTop.",
];

const AUDIT_CHAPTER_COUNT = 32;
const AUDIT_PARAGRAPHS_PER_CHAPTER = 10;
const MAX_VIEWPORT_ANCHOR_DRIFT = 96;

async function startAuditMediaServer(): Promise<{
  server: Server;
  baseUrl: string;
}> {
  const server = createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
    if (requestUrl.pathname === "/slow.svg") {
      setTimeout(() => {
        response.writeHead(200, {
          "Cache-Control": "no-store",
          "Content-Type": "image/svg+xml; charset=utf-8",
        });
        response.end(
          `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="620" viewBox="0 0 1200 620"><rect width="1200" height="620" fill="#e9efff"/><path d="M80 500 L330 280 L520 410 L760 170 L1120 500" fill="none" stroke="#2557e5" stroke-width="24"/><text x="600" y="570" text-anchor="middle" font-family="sans-serif" font-size="44" fill="#171b18">تصویر آزمایشی با بارگذاری کند</text></svg>`,
        );
      }, 650);
      return;
    }
    response.writeHead(404, {
      "Cache-Control": "no-store",
      "Content-Type": "text/plain; charset=utf-8",
    });
    response.end("not found");
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Audit media server did not expose a TCP port.");
  }
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeAuditMediaServer(server: Server | null) {
  if (!server) return;
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}

function longReadingDocument(mediaBaseUrl: string) {
  const chapters = Array.from({ length: AUDIT_CHAPTER_COUNT }, (_, chapterIndex) => {
    const chapter = chapterIndex + 1;
    const paragraphs = Array.from(
      { length: AUDIT_PARAGRAPHS_PER_CHAPTER },
      (_, paragraphIndex) => {
      const source =
        paragraphIndex === 8
          ? "This English reading checkpoint verifies that an LTR paragraph keeps its direction and its semantic reading anchor inside a predominantly Persian document."
          : paragraphIndex === 9
            ? "این بند ترکیبی contains an English phrase و بررسی می‌کند تغییر جهت طبیعی بلوک، جای مطالعه را عوض نکند."
            : paragraphTemplates[paragraphIndex % paragraphTemplates.length];
      return `${source} این بند متعلق به فصل ${chapter.toLocaleString("fa-IR")} و ایستگاه خواندن ${(paragraphIndex + 1).toLocaleString("fa-IR")} است.`;
      },
    ).join("\n\n");
    const diagram =
      chapter % 4 === 0
        ? [
            "```mermaid",
            "flowchart LR",
            `  A[\"فصل ${chapter.toLocaleString("fa-IR")}\"] --> B[\"مطالعه\"]`,
            "  B --> C[\"یادداشت\"]",
            "  C --> D[\"ادامه\"]",
            "```",
            "",
          ].join("\n")
        : "";
    const slowImage =
      chapter % 5 === 0
        ? `![تصویر کند فصل ${chapter.toLocaleString("fa-IR")}](${mediaBaseUrl}/slow.svg?chapter=${chapter})`
        : "";
    const brokenImage =
      chapter % 11 === 0
        ? `![تصویر ناموفق فصل ${chapter.toLocaleString("fa-IR")}](${mediaBaseUrl}/missing.png?chapter=${chapter})`
        : "";
    const codeBlock =
      chapter % 4 === 0
        ? [
            "```typescript",
            `const chapter = ${chapter};`,
            "const readingAnchor = { block: chapter * 10, offset: 72 };",
            "console.log(readingAnchor);",
            "```",
            "",
          ].join("\n")
        : "";

    return [
      `## فصل ${chapter.toLocaleString("fa-IR")}: پیوستگی مطالعه`,
      "",
      `### ایستگاه ${chapter.toLocaleString("fa-IR")}`,
      "",
      paragraphs,
      "",
      slowImage,
      "",
      brokenImage,
      "",
      diagram,
      codeBlock,
      "> نکتهٔ حاشیه‌ای: بند جاری باید پس از هر وقفه دوباره در همان ناحیهٔ دید قرار گیرد.",
      "",
      "- [x] خواندن بند",
      "- [ ] ثبت یادداشت",
      "- [ ] ادامه از همان نقطه",
      "",
      "| نشانه | وضعیت | عرض | جهت | نتیجه |",
      "|---|---|---:|---|---|",
      `| فصل | ${chapter.toLocaleString("fa-IR")} | ۱۲۰۰ | RTL | در حال بررسی |`,
      "| پیوستگی | فعال | ۷۶ نویسه | خودکار | اندازه‌گیری می‌شود |",
    ].join("\n");
  });

  return [
    "# سند بلند ممیزی پیوستگی مطالعه",
    "",
    "این سند برای شبیه‌سازی خواندن طولانی، تغییر ابزارها و بازیابی مکان مطالعه ساخته شده است.",
    "",
    ...chapters,
  ].join("\n\n");
}

function replacementReadingDocument(label: string) {
  const chapters = Array.from(
    { length: AUDIT_CHAPTER_COUNT },
    (_, chapterIndex) => {
      const chapter = chapterIndex + 1;
      const paragraphs = Array.from(
        { length: AUDIT_PARAGRAPHS_PER_CHAPTER },
        (_, paragraphIndex) =>
          `محتوای جایگزین ${label} برای فصل ${chapter.toLocaleString("fa-IR")} و بند ${(paragraphIndex + 1).toLocaleString("fa-IR")} عمداً هیچ عبارت مشترکی با نسخهٔ پیشین ندارد و فقط مسیر fallback پیشروی را ارزیابی می‌کند.`,
      ).join("\n\n");
      return `## بخش جایگزین ${chapter.toLocaleString("fa-IR")}\n\n${paragraphs}`;
    },
  );
  return [`# سند کاملاً جایگزین ${label}`, "", ...chapters].join("\n\n");
}

async function readingMetric(page: Page): Promise<ReadingMetric> {
  return page.evaluate(() => {
    const reading = document.querySelector(".app-shell")?.classList.contains("is-reading") ?? false;
    const workspace = document.querySelector<HTMLElement>(".workspace")!;
    const workspaceMaxScroll = Math.max(
      0,
      workspace.scrollHeight - workspace.clientHeight,
    );
    const root = (reading
      ? workspaceMaxScroll > 0
        ? workspace
        : (document.scrollingElement as HTMLElement)
      : document.querySelector<HTMLElement>(".preview-scroll"))!;
    const usesWindowScroll = root === document.scrollingElement;
    const article = document.querySelector<HTMLElement>(".markdown-body")!;
    const rootRect = usesWindowScroll
      ? { top: 0, bottom: window.innerHeight, height: window.innerHeight }
      : root.getBoundingClientRect();
    const probeY = Math.min(
      window.innerHeight - 120,
      Math.max(rootRect.top + 110, rootRect.top + rootRect.height * 0.42),
    );
    const blocks = Array.from(
      article.querySelectorAll<HTMLElement>(
        "h1, h2, h3, h4, h5, h6, p, li, blockquote, figure, table, pre",
      ),
    ).filter((block) => {
      const rect = block.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        (block.textContent ?? "").replace(/\s+/gu, " ").trim().length > 0
      );
    });
    let anchorIndex = 0;
    let anchor = blocks[0] ?? article;
    let bestDistance = Number.POSITIVE_INFINITY;

    blocks.forEach((block, index) => {
      const rect = block.getBoundingClientRect();
      const containsProbe = rect.top <= probeY && rect.bottom >= probeY;
      const distance = containsProbe ? 0 : Math.abs(rect.top - probeY);
      if (rect.bottom >= rootRect.top && rect.top <= rootRect.bottom && distance < bestDistance) {
        bestDistance = distance;
        anchorIndex = index;
        anchor = block;
      }
    });

    const anchorRect = anchor.getBoundingClientRect();
    const maxScroll = Math.max(0, root.scrollHeight - root.clientHeight);
    const scrollTop = usesWindowScroll ? window.scrollY : root.scrollTop;
    const readingHeader = document.querySelector<HTMLElement>(".reading-topbar");
    const selection = window.getSelection()?.toString().trim() ?? "";
    return {
      mode: reading ? "reading" : "desk",
      scrollTop: Math.round(scrollTop),
      maxScroll: Math.round(maxScroll),
      progress: maxScroll > 0 ? Number((scrollTop / maxScroll).toFixed(4)) : 0,
      anchorIndex,
      anchorText: (anchor.textContent ?? "").replace(/\s+/gu, " ").trim().slice(0, 90),
      anchorOffset: Math.round(anchorRect.top - probeY),
      articleLeft: Math.round(article.getBoundingClientRect().left),
      articleWidth: Math.round(article.getBoundingClientRect().width),
      readerSize:
        document.querySelector(".reader-controls span")?.textContent?.trim() ?? "",
      annotationPanelOpen: Boolean(document.querySelector("#annotation-panel")),
      composerOpen: Boolean(
        document.querySelector(".annotation-toolbar.is-composing"),
      ),
      selectionText: selection.slice(0, 120),
      selectionFeedbackCount: document.querySelectorAll(
        ".selection-range-feedback",
      ).length,
      readingOutlineOpen: Boolean(document.querySelector(".reading-outline")),
      readingHeaderState: !reading
        ? "desk"
        : readingHeader?.classList.contains("is-concealed")
          ? "concealed"
          : "visible",
      horizontalOverflow: Math.max(
        0,
        Math.round(document.documentElement.scrollWidth - window.innerWidth),
      ),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });
}

async function applyReadingProgress(page: Page, progress: number) {
  await page.evaluate((nextProgress) => {
    const reading = document.querySelector(".app-shell")?.classList.contains("is-reading") ?? false;
    const workspace = document.querySelector<HTMLElement>(".workspace")!;
    const workspaceMaxScroll = Math.max(
      0,
      workspace.scrollHeight - workspace.clientHeight,
    );
    const root = (reading
      ? workspaceMaxScroll > 0
        ? workspace
        : (document.scrollingElement as HTMLElement)
      : document.querySelector<HTMLElement>(".preview-scroll"))!;
    const nextScrollTop = (root.scrollHeight - root.clientHeight) * nextProgress;
    root.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        deltaY: nextScrollTop - root.scrollTop,
      }),
    );
    if (root === document.scrollingElement) {
      window.scrollTo({ top: nextScrollTop });
    } else {
      root.scrollTop = nextScrollTop;
      root.dispatchEvent(new Event("scroll", { bubbles: true }));
    }
  }, progress);
}

async function setReadingProgress(page: Page, progress: number) {
  await applyReadingProgress(page, progress);
  // The first jump may activate lazy media near the destination. Wait for its
  // reflow and any pending startup restore, then model the user's final scroll.
  await page.waitForTimeout(900);
  await applyReadingProgress(page, progress);
  await page.waitForTimeout(280);
}

async function revealReadingHeader(page: Page) {
  await page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>(".workspace")!;
    const root = workspace.scrollHeight > workspace.clientHeight
      ? workspace
      : (document.scrollingElement as HTMLElement);
    root.dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: -80 }),
    );
    if (root === document.scrollingElement) {
      window.scrollTo({ top: Math.max(0, window.scrollY - 80) });
    } else {
      root.scrollTop = Math.max(0, root.scrollTop - 80);
      root.dispatchEvent(new Event("scroll", { bubbles: true }));
    }
  });
  await expect(page.locator(".reading-topbar")).toHaveClass(/is-visible/);
}

async function commitAuditScrollAsUserPosition(page: Page) {
  const workspace = page.locator(".workspace");
  const bounds = await workspace.boundingBox();
  if (bounds) {
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  }
  // Use a trusted wheel input so the product records this programmatic audit
  // position exactly like a real user's scroll before media reflow begins.
  await page.mouse.wheel(0, 2);
  await page.evaluate(() => {
    const workspace = document.querySelector<HTMLElement>(".workspace")!;
    workspace.scrollTop = Math.min(
      workspace.scrollTop + 1,
      Math.max(0, workspace.scrollHeight - workspace.clientHeight),
    );
    workspace.dispatchEvent(new Event("scroll", { bubbles: true }));
  });
  await page.waitForTimeout(320);
}

async function openReadingTools(page: Page) {
  await revealReadingHeader(page);
  const menu = page.locator("#reading-tools-menu");
  if ((await menu.count()) === 0) {
    await page.getByRole("button", { name: "ابزار مطالعه", exact: true }).click();
  }
  await expect(menu).toBeVisible();
}

async function ensureReadingOutlineOpen(page: Page) {
  const outline = page.locator("#reading-document-outline-pane");
  const outlineToggle = page.locator(
    'button[data-sidebar-destination="outline"]:visible',
  );
  if ((await outline.count()) === 0 || !(await outline.isVisible())) {
    await outlineToggle.click();
  }
  await expect(outline).toBeVisible();
}

async function ensureAuditChaptersRendered(page: Page) {
  await expect(page.locator(".markdown-body")).toBeVisible();
  await page.waitForTimeout(700);
  const originalScrollTop = await page.evaluate(() => {
    const reading = document
      .querySelector(".app-shell")
      ?.classList.contains("is-reading");
    const workspace = document.querySelector<HTMLElement>(".workspace")!;
    const workspaceMaxScroll = Math.max(
      0,
      workspace.scrollHeight - workspace.clientHeight,
    );
    const root = reading && workspaceMaxScroll > 0
      ? workspace
      : (document.scrollingElement as HTMLElement);
    return root === document.scrollingElement ? window.scrollY : root.scrollTop;
  });

  let scrolledToRender = false;
  for (let index = 0; index < AUDIT_CHAPTER_COUNT; index += 1) {
    if ((await page.locator(".markdown-body h2").count()) >= AUDIT_CHAPTER_COUNT) {
      break;
    }
    const status = page.locator(".progressive-render-status");
    if ((await status.count()) === 0) break;
    scrolledToRender = true;
    await status.scrollIntoViewIfNeeded();
    await page.waitForTimeout(420);
  }

  await expect(page.locator(".markdown-body h2")).toHaveCount(
    AUDIT_CHAPTER_COUNT,
    { timeout: 20_000 },
  );
  // Restored documents already render all chunks. Replaying the scroll value
  // sampled during startup would cancel the product's in-flight restoration.
  if (!scrolledToRender) return;
  await page.evaluate((top) => {
    const reading = document
      .querySelector(".app-shell")
      ?.classList.contains("is-reading");
    const workspace = document.querySelector<HTMLElement>(".workspace")!;
    const workspaceMaxScroll = Math.max(
      0,
      workspace.scrollHeight - workspace.clientHeight,
    );
    const root = reading && workspaceMaxScroll > 0
      ? workspace
      : (document.scrollingElement as HTMLElement);
    if (root === document.scrollingElement) window.scrollTo({ top });
    else root.scrollTop = top;
    root.dispatchEvent(new Event("scroll", { bubbles: true }));
  }, originalScrollTop);
  await page.waitForTimeout(240);
}

function compareScenario(
  scenario: string,
  before: ReadingMetric,
  after: ReadingMetric,
): AuditResult {
  const anchorIndexDelta = Math.abs(after.anchorIndex - before.anchorIndex);
  const progressDelta = Number(Math.abs(after.progress - before.progress).toFixed(4));
  const anchorIndexTolerance = before.mode === after.mode ? 5 : 2;
  const sameSemanticAnchor = before.anchorText === after.anchorText;
  const exactScrollPosition =
    before.mode === after.mode && Math.abs(after.scrollTop - before.scrollTop) <= 2;
  if (!sameSemanticAnchor && !exactScrollPosition) {
    expect
      .soft(anchorIndexDelta, `${scenario}: reading anchor moved`)
      .toBeLessThanOrEqual(anchorIndexTolerance);
  }
  if (!sameSemanticAnchor && !exactScrollPosition) {
    expect
      .soft(progressDelta, `${scenario}: reading progress drifted`)
      .toBeLessThanOrEqual(0.015);
  }
  if (sameSemanticAnchor && before.mode === after.mode) {
    expect
      .soft(
        Math.abs(after.anchorOffset - before.anchorOffset),
        `${scenario}: viewport-relative anchor offset drifted`,
      )
      .toBeLessThanOrEqual(MAX_VIEWPORT_ANCHOR_DRIFT);
  }
  expect
    .soft(
      after.horizontalOverflow,
      `${scenario}: viewport gained horizontal overflow`,
    )
    .toBe(0);

  return {
    scenario,
    before,
    after,
    anchorChanged:
      before.anchorIndex !== after.anchorIndex ||
      before.anchorText !== after.anchorText,
    progressDelta,
    details: {
      anchorIndexDelta,
      anchorIndexTolerance,
      anchorOffsetDelta: Math.abs(after.anchorOffset - before.anchorOffset),
      withinThreshold:
        (sameSemanticAnchor ||
          exactScrollPosition ||
          anchorIndexDelta <= anchorIndexTolerance) &&
        (sameSemanticAnchor || exactScrollPosition || progressDelta <= 0.015) &&
        (!sameSemanticAnchor ||
          before.mode !== after.mode ||
          Math.abs(after.anchorOffset - before.anchorOffset) <=
            MAX_VIEWPORT_ANCHOR_DRIFT) &&
        after.horizontalOverflow === 0,
    },
  };
}

function assertArticleGeometryStable(
  scenario: string,
  before: ReadingMetric,
  after: ReadingMetric,
) {
  expect
    .soft(
      Math.abs(after.articleLeft - before.articleLeft),
      `${scenario}: article shifted horizontally`,
    )
    .toBeLessThanOrEqual(1);
  expect
    .soft(
      Math.abs(after.articleWidth - before.articleWidth),
      `${scenario}: article width changed`,
    )
    .toBeLessThanOrEqual(1);
}

async function selectParagraph(page: Page, index: number) {
  const paragraph = page.locator(".markdown-body p").nth(index);
  await paragraph.scrollIntoViewIfNeeded();
  const box = await paragraph.boundingBox();
  if (!box) throw new Error(`Paragraph ${index} is not visible.`);
  await paragraph.selectText();
  await paragraph.dispatchEvent("mouseup", {
    clientX: box.x + box.width / 2,
    clientY: box.y + Math.min(box.height / 2, 24),
  });
  await expect(
    page.getByRole("toolbar", { name: "ابزار متن انتخاب‌شده" }),
  ).toBeVisible();
}

async function approveAuditRemoteImages(page: Page) {
  const approve = page.getByRole("button", { name: "اجازه و بارگیری" });
  while ((await approve.count()) > 0) {
    await approve
      .first()
      .evaluate((button: HTMLButtonElement) => button.click());
    await page.waitForTimeout(40);
  }
}

async function launchAuditApp(
  projectRoot: string,
  userDataPath: string,
  documentPath?: string,
): Promise<{ app: ElectronApplication; page: Page }> {
  const executablePath = process.env.RAAVI_AUDIT_EXECUTABLE;
  const args = [
    ...(executablePath ? [] : [path.join(projectRoot, "desktop", "main.mjs")]),
    `--user-data-dir=${userDataPath}`,
  ];
  if (documentPath) args.push(documentPath);
  const app = await electron.launch({ cwd: projectRoot, executablePath, args, timeout: 20_000 });
  try {
    expect(await app.evaluate(({ app }) => app.getPath("userData"))).toBe(userDataPath);
    return { app, page: await waitForRaaviWindow(app) };
  } catch (error) {
    await app.close();
    throw error;
  }
}

test.describe("reading continuity audit", () => {
  test.skip(process.platform !== "win32", "The packaged desktop target is Windows.");

  test("preserves the semantic anchor while leaving reading mode", async () => {
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const auditRoot = await mkdtemp(
      path.join(os.tmpdir(), "raavi-reading-mode-exit-audit-"),
    );
    const userDataPath = path.join(auditRoot, "profile");
    const documentPath = path.join(auditRoot, "سند-گذار-مطالعه.md");
    const auditMedia = await startAuditMediaServer();
    await writeFile(documentPath, longReadingDocument(auditMedia.baseUrl), "utf8");
    let activeApp: ElectronApplication | null = null;

    try {
      const launched = await launchAuditApp(
        projectRoot,
        userDataPath,
        documentPath,
      );
      activeApp = launched.app;
      const page = launched.page;
      await expect(page.locator(".app-shell")).toHaveClass(/is-reading/);
      await ensureAuditChaptersRendered(page);
      await setReadingProgress(page, 0.58);
      const before = await readingMetric(page);

      await page
        .getByRole("button", { name: "بازگشت به میز", exact: true })
        .last()
        .click();
      await expect(page.locator(".app-shell")).not.toHaveClass(/is-reading/);
      const restoredEditorLines = page
        .locator("#markdown-editor:visible .cm-line")
        .filter({ hasText: before.anchorText.slice(0, 48) });
      await expect(restoredEditorLines.first()).toBeAttached({ timeout: 7_000 });
      await expect
        .poll(() =>
          restoredEditorLines.evaluateAll((lines) => {
            const scroller = lines[0]
              ?.closest("#markdown-editor")
              ?.querySelector<HTMLElement>(".cm-scroller");
            if (!scroller) return false;
            const scrollerBox = scroller.getBoundingClientRect();
            return lines.some((line) => {
              const lineBox = line.getBoundingClientRect();
              return (
                lineBox.bottom >= scrollerBox.top &&
                lineBox.top <= scrollerBox.bottom
              );
            });
          }),
        )
        .toBe(true);
    } finally {
      await activeApp?.close();
      await closeAuditMediaServer(auditMedia.server);
      await rm(auditRoot, { recursive: true, force: true });
    }
  });

  test("keeps a real pointer selection visible without shifting the article", async () => {
    test.slow();
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const auditRoot = await mkdtemp(
      path.join(os.tmpdir(), "raavi-reading-pointer-audit-"),
    );
    const userDataPath = path.join(auditRoot, "profile");
    const documentPath = path.join(auditRoot, "سند-بلند-انتخاب-واقعی.md");
    const auditMedia = await startAuditMediaServer();
    await writeFile(documentPath, longReadingDocument(auditMedia.baseUrl), "utf8");
    let activeApp: ElectronApplication | null = null;

    try {
      const launched = await launchAuditApp(
        projectRoot,
        userDataPath,
        documentPath,
      );
      activeApp = launched.app;
      const page = launched.page;
      await expect(page.locator(".app-shell")).toHaveClass(/is-reading/);
      await ensureAuditChaptersRendered(page);

      const paragraph = page.locator(".markdown-body p").nth(156);
      await paragraph.scrollIntoViewIfNeeded();
      await page.waitForTimeout(360);
      const beforeSelection = await readingMetric(page);
      const drag = await paragraph.evaluate((element) => {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        const textNode = walker.nextNode();
        if (!(textNode instanceof Text) || textNode.length < 40) return null;
        const pointAt = (offset: number) => {
          const range = document.createRange();
          range.setStart(textNode, offset);
          range.setEnd(textNode, Math.min(textNode.length, offset + 1));
          const rect = range.getBoundingClientRect();
          return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        };
        return { start: pointAt(4), end: pointAt(34) };
      });
      if (!drag) throw new Error("The pointer-selection text is not measurable.");

      await page.mouse.move(drag.start.x, drag.start.y);
      await page.mouse.down();
      await page.mouse.move(drag.end.x, drag.end.y, { steps: 14 });
      await page.mouse.up();

      await expect(
        page.getByRole("toolbar", { name: "ابزار متن انتخاب‌شده" }),
      ).toBeVisible();
      const afterSelection = await readingMetric(page);
      expect(afterSelection.selectionText.length).toBeGreaterThan(6);
      expect(afterSelection.selectionFeedbackCount).toBeGreaterThan(0);
      assertArticleGeometryStable(
        "انتخاب واقعی متن با کشیدن موس",
        beforeSelection,
        afterSelection,
      );
      expect(
        Math.abs(afterSelection.scrollTop - beforeSelection.scrollTop),
        "a real pointer selection should not scroll the reading surface",
      ).toBeLessThanOrEqual(2);

      await page.keyboard.press("Control+c");
      await page.waitForTimeout(180);
      const afterCopy = await readingMetric(page);
      expect(afterCopy.selectionText).toBe(afterSelection.selectionText);
      expect(afterCopy.selectionFeedbackCount).toBeGreaterThan(0);
      assertArticleGeometryStable(
        "کپی پس از انتخاب واقعی متن",
        afterSelection,
        afterCopy,
      );
    } finally {
      await activeApp?.close();
      await closeAuditMediaServer(auditMedia.server);
      await rm(auditRoot, { recursive: true, force: true });
    }
  });

  test("verifies the same anchor after reload with slow media and a comment draft", async () => {
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const auditRoot = await mkdtemp(
      path.join(os.tmpdir(), "raavi-reading-reload-audit-"),
    );
    const userDataPath = path.join(auditRoot, "profile");
    const documentPath = path.join(auditRoot, "سند-بازآوری-تأییدشده.md");
    const auditMedia = await startAuditMediaServer();
    await writeFile(documentPath, longReadingDocument(auditMedia.baseUrl), "utf8");
    let activeApp: ElectronApplication | null = null;

    try {
      const launched = await launchAuditApp(
        projectRoot,
        userDataPath,
        documentPath,
      );
      activeApp = launched.app;
      const page = launched.page;
      await expect(page.locator(".app-shell")).toHaveClass(/is-reading/);
      await ensureAuditChaptersRendered(page);
      await setReadingProgress(page, 0.58);
      await selectParagraph(page, 210);
      await page.getByRole("button", { name: "نظر", exact: true }).click();
      const draft = "پیش‌نویس ممیزی بازآوری باید همراه نشان خواندن حفظ شود";
      await page.locator('[data-editable-kind="composer"]').fill(draft);
      await page.waitForTimeout(700);
      const before = await readingMetric(page);

      await page.reload();
      await ensureAuditChaptersRendered(page);
      await expect(page.locator('[data-editable-kind="composer"]')).toHaveValue(
        draft,
      );
      await expect(page.locator(".reading-resume-notice")).toContainText(
        "از جای قبلی ادامه یافت",
      );
      await page.waitForTimeout(1_800);
      const after = await readingMetric(page);

      expect(after.anchorText).toBe(before.anchorText);
      expect(Math.abs(after.anchorOffset - before.anchorOffset)).toBeLessThanOrEqual(
        48,
      );
    } finally {
      await activeApp?.close();
      await closeAuditMediaServer(auditMedia.server);
      await rm(auditRoot, { recursive: true, force: true });
    }
  });

  test("measures long-document reading interruptions", async () => {
    test.slow();
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const auditRoot = await mkdtemp(path.join(os.tmpdir(), "raavi-reading-audit-"));
    const userDataPath = path.join(auditRoot, "profile");
    const documentPath = path.join(auditRoot, "سند-بلند-پیوستگی-مطالعه.md");
    const auditMedia = await startAuditMediaServer();
    await writeFile(documentPath, longReadingDocument(auditMedia.baseUrl), "utf8");
    const results: AuditResult[] = [];
    let firstApp: ElectronApplication | null = null;
    let restoredApp: ElectronApplication | null = null;
    let reopenedApp: ElectronApplication | null = null;

    try {
      const first = await launchAuditApp(projectRoot, userDataPath, documentPath);
      firstApp = first.app;
      const page = first.page;
      await expect(page.locator(".app-shell")).toHaveClass(/is-reading/);
      await ensureAuditChaptersRendered(page);
      await approveAuditRemoteImages(page);
      const slowImages = page.locator(
        '.markdown-body img[alt^="تصویر کند فصل"]',
      );
      await expect(slowImages).toHaveCount(6);
      expect(
        await slowImages.evaluateAll(
          (images) =>
            images.filter(
              (image) => (image as HTMLImageElement).loading === "lazy",
            ).length,
        ),
      ).toBe(6);
      results.push({
        scenario: "بازکردن اولیهٔ فایل بسیار بلند و تکمیل رسانه‌های کند",
        after: await readingMetric(page),
        details: {
          chapters: AUDIT_CHAPTER_COUNT,
          paragraphs: AUDIT_CHAPTER_COUNT * AUDIT_PARAGRAPHS_PER_CHAPTER,
          slowImages: 6,
          brokenImages: 2,
          mermaidDiagrams: 8,
        },
      });

      await setReadingProgress(page, 0.58);
      const deepReadingPosition = await readingMetric(page);

      await page
        .getByRole("button", { name: "بازگشت به میز", exact: true })
        .last()
        .click();
      await expect(page.locator(".app-shell")).not.toHaveClass(/is-reading/);
      const restoredEditorLines = page
        .locator("#markdown-editor:visible .cm-line")
        .filter({ hasText: deepReadingPosition.anchorText.slice(0, 48) });
      await expect(restoredEditorLines.first()).toBeAttached({ timeout: 7_000 });
      await expect
        .poll(() =>
          restoredEditorLines.evaluateAll((lines) => {
            const scroller = lines[0]
              ?.closest("#markdown-editor")
              ?.querySelector<HTMLElement>(".cm-scroller");
            if (!scroller) return false;
            const scrollerBox = scroller.getBoundingClientRect();
            return lines.some((line) => {
              const lineBox = line.getBoundingClientRect();
              return (
                lineBox.bottom >= scrollerBox.top &&
                lineBox.top <= scrollerBox.bottom
              );
            });
          }),
        )
        .toBe(true);
      results.push({
        scenario: "خروج از حالت مطالعه در میانهٔ سند",
        before: deepReadingPosition,
        after: deepReadingPosition,
        anchorChanged: false,
        progressDelta: 0,
        details: { restoredInEditor: true, withinThreshold: true },
      });

      await page.getByRole("button", { name: "خواندن", exact: true }).click();
      await expect(page.locator(".app-shell")).toHaveClass(/is-reading/);
      await page.waitForTimeout(360);
      results.push(
        compareScenario(
          "ورود دوباره به حالت مطالعه",
          deepReadingPosition,
          await readingMetric(page),
        ),
      );

      await setReadingProgress(page, 0.56);
      await openReadingTools(page);
      const beforeTextResize = await readingMetric(page);
      await page
        .locator('#reading-tools-menu button[data-reading-size-action="increase"]')
        .evaluate((button: HTMLButtonElement) => button.click());
      await page.waitForTimeout(360);
      results.push(
        compareScenario(
          "بزرگ‌کردن متن هنگام مطالعه",
          beforeTextResize,
          await readingMetric(page),
        ),
      );

      await openReadingTools(page);
      const beforeTextDecrease = await readingMetric(page);
      await page
        .locator('#reading-tools-menu button[data-reading-size-action="decrease"]')
        .evaluate((button: HTMLButtonElement) => button.click());
      await page.waitForTimeout(360);
      results.push(
        compareScenario(
          "کوچک‌کردن متن و بازگشت به اندازهٔ قبلی",
          beforeTextDecrease,
          await readingMetric(page),
        ),
      );

      const delayedImage = page.locator(
        'img[alt="تصویر کند فصل ۲۵"]',
      );
      await expect(delayedImage).toHaveCount(1);
      await delayedImage.scrollIntoViewIfNeeded();
      await commitAuditScrollAsUserPosition(page);
      const beforeDelayedImageLoad = await readingMetric(page);
      await expect
        .poll(() =>
          delayedImage.evaluate(
            (image) =>
              (image as HTMLImageElement).complete &&
              (image as HTMLImageElement).naturalWidth > 0,
          ),
        )
        .toBe(true);
      await page.waitForTimeout(360);
      results.push(
        compareScenario(
          "تکمیل تصویر کند داخل ناحیهٔ مطالعه",
          beforeDelayedImageLoad,
          await readingMetric(page),
        ),
      );

      await ensureReadingOutlineOpen(page);
      const beforeIntentionalNavigation = await readingMetric(page);
      await page
        .locator("#reading-document-outline-list .sidebar-row")
        .filter({ hasText: "فصل ۱۲: پیوستگی مطالعه" })
        .click();
      await page.waitForTimeout(700);
      const afterIntentionalNavigation = await readingMetric(page);
      const chapterTwelveGeometry = await page
        .locator(".markdown-body h2", {
          hasText: "فصل ۱۲: پیوستگی مطالعه",
        })
        .evaluate((heading) => {
          const rect = heading.getBoundingClientRect();
          const workspace = document.querySelector(".workspace")!;
          const active = document.activeElement as HTMLElement | null;
          return {
            inViewport: rect.bottom > 0 && rect.top < window.innerHeight,
            top: rect.top, bottom: rect.bottom,
            sourceOffset: heading.getAttribute("data-source-offset"),
            focusedText: active?.textContent?.slice(0, 80),
            workspaceTop: workspace.getBoundingClientRect().top,
            workspaceScroll: workspace.scrollTop,
            documentScroll: window.scrollY,
          };
        });
      const chapterTwelveInViewport = chapterTwelveGeometry.inViewport;
      expect
        .soft(
          chapterTwelveInViewport,
          "intentional chapter navigation should land on the requested heading",
        )
        .toBe(true);
      expect
        .soft(
          Math.abs(
            afterIntentionalNavigation.anchorIndex -
              beforeIntentionalNavigation.anchorIndex,
          ),
          "intentional chapter navigation should not be undone by late reflow",
        )
        .toBeGreaterThan(4);
      results.push({
        scenario: "رفتن عمدی به فصل ۱۲ و ثبت مقصد جدید",
        before: beforeIntentionalNavigation,
        after: afterIntentionalNavigation,
        anchorChanged: true,
        details: {
          intentionalNavigation: true,
          targetReached: chapterTwelveInViewport,
          targetGeometry: JSON.stringify(chapterTwelveGeometry),
        },
      });

      await setReadingProgress(page, 0.54);
      const beforeOutlineCollapse = await readingMetric(page);
      await page
        .locator('button[data-sidebar-destination="outline"]:visible')
        .click();
      await page.waitForTimeout(360);
      results.push(
        compareScenario(
          "جمع‌کردن فهرست فصل‌ها",
          beforeOutlineCollapse,
          await readingMetric(page),
        ),
      );

      const beforeOutlineOpen = await readingMetric(page);
      await page
        .locator('button[data-sidebar-destination="outline"]:visible')
        .click();
      await page.waitForTimeout(360);
      results.push(
        compareScenario(
          "بازکردن دوبارهٔ فهرست فصل‌ها",
          beforeOutlineOpen,
          await readingMetric(page),
        ),
      );

      const beforeThemeChange = await readingMetric(page);
      await page.keyboard.press("Alt+t");
      await page.waitForTimeout(700);
      results.push(
        compareScenario(
          "تغییر تم هنگام مطالعه",
          beforeThemeChange,
          await readingMetric(page),
        ),
      );

      const beforeKeyboardHelp = await readingMetric(page);
      await page.keyboard.press("F1");
      await expect(page.locator("#shortcut-modal-title")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.locator("#shortcut-modal-title")).toBeHidden();
      await page.waitForTimeout(180);
      results.push(
        compareScenario(
          "بازکردن و بستن راهنمای میان‌برها",
          beforeKeyboardHelp,
          await readingMetric(page),
        ),
      );

      await selectParagraph(page, 74);
      const beforeNativeCopy = await readingMetric(page);
      expect(beforeNativeCopy.selectionText.length).toBeGreaterThan(20);
      expect(beforeNativeCopy.selectionFeedbackCount).toBeGreaterThan(0);
      await page.keyboard.press("Control+c");
      await page.waitForTimeout(180);
      const afterNativeCopy = await readingMetric(page);
      expect(afterNativeCopy.selectionText).toBe(beforeNativeCopy.selectionText);
      expect(afterNativeCopy.selectionFeedbackCount).toBeGreaterThan(0);
      results.push(
        compareScenario(
          "کپی بومی با Ctrl+C و حفظ بازخورد انتخاب",
          beforeNativeCopy,
          afterNativeCopy,
        ),
      );

      await selectParagraph(page, 75);
      const beforeSelectionEscape = await readingMetric(page);
      await page.keyboard.press("Escape");
      await expect(page.locator(".selection-mini-menu")).toHaveCount(0);
      await expect(page.locator(".selection-range-feedback")).toHaveCount(0);
      await expect(page.locator(".app-shell")).toHaveClass(/is-reading/);
      const afterSelectionEscape = await readingMetric(page);
      expect(afterSelectionEscape.selectionFeedbackCount).toBe(0);
      results.push(
        compareScenario(
          "بستن انتخاب با Escape بدون خروج از مطالعه",
          beforeSelectionEscape,
          afterSelectionEscape,
        ),
      );

      await selectParagraph(page, 76);
      const beforeHighlight = await readingMetric(page);
      await page
        .getByRole("button", { name: "هایلایت", exact: true })
        .click();
      await expect(page.locator("#reading-highlights-pane")).toBeVisible();
      await page.waitForTimeout(360);
      const afterHighlight = await readingMetric(page);
      assertArticleGeometryStable(
        "ثبت هایلایت و بازشدن ستون یادداشت‌ها",
        beforeHighlight,
        afterHighlight,
      );
      results.push(
        compareScenario(
          "ثبت هایلایت و بازشدن ستون یادداشت‌ها",
          beforeHighlight,
          afterHighlight,
        ),
      );

      await selectParagraph(page, 77);
      const beforeCommentComposer = await readingMetric(page);
      await page
        .getByRole("button", { name: "نظر", exact: true })
        .click();
      await expect(page.locator(".annotation-toolbar.is-composing")).toBeVisible();
      const afterCommentComposer = await readingMetric(page);
      assertArticleGeometryStable(
        "بازشدن فرم کامنت",
        beforeCommentComposer,
        afterCommentComposer,
      );
      results.push(
        compareScenario(
          "بازشدن فرم کامنت",
          beforeCommentComposer,
          afterCommentComposer,
        ),
      );
      await page.locator('[data-editable-kind="composer"]').fill(
        "پیش‌نویس کامنتی که باید بدون پرش لغو شود",
      );
      const beforeCommentCancel = await readingMetric(page);
      await page.getByRole("button", { name: "لغو", exact: true }).click();
      await expect(page.locator(".annotation-toolbar.is-composing")).toHaveCount(0);
      // Let cancellation finish restoring the selected text before navigating
      // to a different chapter to open its graph. Otherwise click() scrolls
      // after the baseline metric and the audit attributes that move to exit.
      await page.waitForTimeout(500);
      const afterCommentCancel = await readingMetric(page);
      results.push(
        compareScenario(
          "لغو کامنت و بازگشت به انتخاب قبلی",
          beforeCommentCancel,
          afterCommentCancel,
        ),
      );

      const activeSidebarDestination = page.locator(
        '.sidebar-rail button[aria-current="page"]:visible',
      );
      if ((await activeSidebarDestination.count()) > 0) {
        await activeSidebarDestination.click();
        await page.waitForTimeout(360);
      }

      const fullscreenButton = page
        .getByRole("button", { name: "نمایش تمام‌صفحهٔ نمودار" })
        .first();
      await fullscreenButton.scrollIntoViewIfNeeded();
      const beforeDiagramFullscreen = await readingMetric(page);
      await fullscreenButton.click();
      await expect(
        page.getByRole("button", { name: "بازگشت به سند" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "بازگشت به سند" })
        .click();
      await page.waitForTimeout(360);
      results.push(
        compareScenario(
          "بازکردن Graph Viewer و بازگشت به سند",
          beforeDiagramFullscreen,
          await readingMetric(page),
        ),
      );

      await fullscreenButton.evaluate((element) =>
        element.scrollIntoView({ block: "nearest" }),
      );
      await page.waitForTimeout(80);
      const beforeDiagramEscape = await readingMetric(page);
      await fullscreenButton.evaluate((button: HTMLButtonElement) =>
        button.click(),
      );
      await expect(
        page.getByRole("button", { name: "بازگشت به سند" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "بازگشت به سند" }),
      ).toHaveCount(0);
      await page.waitForTimeout(360);
      const afterDiagramEscape = await readingMetric(page);
      expect
        .soft(
          afterDiagramEscape.mode,
          "Escape should close the diagram overlay without exiting reading mode",
        )
        .toBe("reading");
      results.push(
        compareScenario(
          "خروج از Graph Viewer با Escape",
          beforeDiagramEscape,
          afterDiagramEscape,
        ),
      );

      // Keep the remainder of the audit inside reading mode even when the
      // fullscreen Escape regression above is present.
      if (afterDiagramEscape.mode !== "reading") {
        await page.getByRole("button", { name: "حالت مطالعه", exact: true }).click();
        await expect(page.locator(".app-shell")).toHaveClass(/is-reading/);
        await page.waitForTimeout(360);
      }

      await setReadingProgress(page, 0.52);
      const beforeNarrowViewport = await readingMetric(page);
      const desktopOnly = process.env.RAAVI_DESKTOP_ONLY === "1";
      await page.setViewportSize({ width: desktopOnly ? 1024 : 780, height: 820 });
      await page.waitForTimeout(480);
      results.push(
        compareScenario(
          "تغییر پنجره از دسکتاپ به عرض باریک",
          beforeNarrowViewport,
          await readingMetric(page),
        ),
      );

      if (!desktopOnly) {
        const beforePortraitViewport = await readingMetric(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(520);
        results.push(
          compareScenario(
            "تغییر به نمای موبایل عمودی",
            beforePortraitViewport,
            await readingMetric(page),
          ),
        );

        const beforeLandscapeViewport = await readingMetric(page);
        await page.setViewportSize({ width: 844, height: 390 });
        await page.waitForTimeout(520);
        results.push(
          compareScenario(
            "چرخش شبیه‌سازی‌شده به نمای افقی",
            beforeLandscapeViewport,
            await readingMetric(page),
          ),
        );
      }

      const beforeWideViewport = await readingMetric(page);
      await page.setViewportSize({ width: 1368, height: 820 });
      await page.waitForTimeout(480);
      results.push(
        compareScenario(
          "بازگرداندن پنجره به عرض دسکتاپ",
          beforeWideViewport,
          await readingMetric(page),
        ),
      );

      await selectParagraph(page, 210);
      await commitAuditScrollAsUserPosition(page);
      await page
        .getByRole("button", { name: "نظر", exact: true })
        .click();
      const persistedComposerText =
        "پیش‌نویس کامنت باید پس از reload و اجرای دوباره عیناً باقی بماند";
      await page
        .locator('[data-editable-kind="composer"]')
        .fill(persistedComposerText);
      await page.waitForTimeout(700);
      const beforeReload = await readingMetric(page);
      expect(beforeReload.composerOpen).toBe(true);
      await page.reload();
      await ensureAuditChaptersRendered(page);
      await approveAuditRemoteImages(page);
      await expect(page.locator(".annotation-toolbar.is-composing")).toBeVisible();
      await expect(page.locator('[data-editable-kind="composer"]')).toHaveValue(
        persistedComposerText,
      );
      await expect(page.locator(".reading-resume-notice")).toContainText(
        "از جای قبلی ادامه یافت",
      );
      // Measure after fonts, Mermaid blocks and the deliberately slow image in
      // the restored viewport have had time to settle.
      await page.waitForTimeout(1_800);
      results.push(
        compareScenario(
          "بازآوری صفحه همراه با رسانهٔ کند و پیش‌نویس کامنت",
          beforeReload,
          await readingMetric(page),
        ),
      );

      await firstApp.close();
      firstApp = null;
      const restored = await launchAuditApp(projectRoot, userDataPath);
      restoredApp = restored.app;
      await restored.page.waitForTimeout(1_200);
      await ensureAuditChaptersRendered(restored.page);
      const restoredHeadingCount = await restored.page
        .locator(".markdown-body h2")
        .count();
      expect(restoredHeadingCount).toBe(AUDIT_CHAPTER_COUNT);
      await expect(
        restored.page.locator(".annotation-toolbar.is-composing"),
      ).toBeVisible();
      await expect(
        restored.page.locator('[data-editable-kind="composer"]'),
      ).toHaveValue(persistedComposerText);
      const restoredResult = compareScenario(
        "بستن برنامه و بازیابی سند، موقعیت و پیش‌نویس کامنت",
        beforeReload,
        await readingMetric(restored.page),
      );
      restoredResult.details = {
        restoredHeadingCount,
        documentRestored: restoredHeadingCount === AUDIT_CHAPTER_COUNT,
        composerDraftRestored: true,
      };
      results.push(restoredResult);
      await restored.page
        .getByRole("button", { name: "لغو", exact: true })
        .click();
      await restored.page.waitForTimeout(500);
      await restoredApp.close();
      restoredApp = null;

      const reopened = await launchAuditApp(projectRoot, userDataPath, documentPath);
      reopenedApp = reopened.app;
      await expect
        .soft(
          reopened.page.locator(".app-shell"),
          "reopening the same native file should restore reading mode",
        )
        .toHaveClass(/is-reading/);
      await ensureAuditChaptersRendered(reopened.page);
      await reopened.page.waitForTimeout(900);
      results.push(
        compareScenario(
          "بستن برنامه و بازکردن دوبارهٔ همان فایل",
          beforeReload,
          await readingMetric(reopened.page),
        ),
      );

      console.log(`READING_CONTINUITY_AUDIT=${JSON.stringify(results)}`);
    } finally {
      await firstApp?.close();
      await restoredApp?.close();
      await reopenedApp?.close();
      await closeAuditMediaServer(auditMedia.server);
      await rm(auditRoot, { recursive: true, force: true });
    }
  });

  test("keeps the reading header and Mermaid surfaces stable while scrolling", async () => {
    test.slow();
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const auditRoot = await mkdtemp(path.join(os.tmpdir(), "raavi-flash-audit-"));
    const userDataPath = path.join(auditRoot, "profile");
    const documentPath = path.join(auditRoot, "سند-ممیزی-چشمک.md");
    const auditMedia = await startAuditMediaServer();
    await writeFile(documentPath, longReadingDocument(auditMedia.baseUrl), "utf8");
    let activeApp: ElectronApplication | null = null;

    try {
      const launched = await launchAuditApp(
        projectRoot,
        userDataPath,
        documentPath,
      );
      activeApp = launched.app;
      const page = launched.page;
      await ensureAuditChaptersRendered(page);
      await expect
        .poll(() => page.locator(".mermaid-diagram").count())
        .toBeGreaterThanOrEqual(1);
      // Virtualization may replace the figure while Playwright waits for its
      // actionability. Scroll the currently attached node directly, then
      // reacquire the locator for the rendered-surface assertion.
      await page.locator(".mermaid-diagram").first().evaluate((element) =>
        element.scrollIntoView({ block: "center" }),
      );
      await expect(
        page.locator(".mermaid-diagram").first().locator(".mermaid-render-surface"),
      ).toHaveCount(1, { timeout: 15_000 });

      const probe = await page.evaluate(async () => {
        const root = document.querySelector<HTMLElement>(".workspace")!;
        const header = document.querySelector<HTMLElement>(".reading-topbar")!;
        let previousScrollTop = root.scrollTop;
        let reverseJumps = 0;
        let headerClassChanges = 0;
        let removedMermaidSurfaces = 0;
        const initialSvgCount = document.querySelectorAll(
          ".mermaid-render-surface",
        ).length;
        let minimumSvgCount = initialSvgCount;
        const article = document.querySelector<HTMLElement>(".markdown-body")!;
        const initialArticleHeight = article.getBoundingClientRect().height;
        let maximumArticleHeightDelta = 0;
        const diagrams = Array.from(
          document.querySelectorAll<HTMLElement>(".mermaid-diagram"),
        );
        const initialDiagramHeights = new Map(
          diagrams.map((diagram) => [
            diagram,
            diagram.getBoundingClientRect().height,
          ]),
        );
        let maximumDiagramHeightDelta = 0;

        const sampleMermaid = () => {
          minimumSvgCount = Math.min(
            minimumSvgCount,
            document.querySelectorAll(".mermaid-render-surface").length,
          );
        };
        const handleScroll = () => {
          const nextScrollTop = root.scrollTop;
          if (nextScrollTop < previousScrollTop - 2) reverseJumps += 1;
          previousScrollTop = nextScrollTop;
        };
        const headerObserver = new MutationObserver(() => {
          headerClassChanges += 1;
        });
        const surfaceObserver = new MutationObserver((records) => {
          for (const record of records) {
            for (const removedNode of record.removedNodes) {
              if (
                (removedNode instanceof Element &&
                  (removedNode.matches(".mermaid-render-surface") ||
                    removedNode.querySelector(".mermaid-render-surface"))) ||
                (record.target instanceof Element &&
                  record.target.matches(".mermaid-render-surface") &&
                  removedNode instanceof SVGSVGElement)
              ) {
                removedMermaidSurfaces += 1;
              }
            }
          }
        });
        const articleResizeObserver = new ResizeObserver(() => {
          maximumArticleHeightDelta = Math.max(
            maximumArticleHeightDelta,
            Math.abs(
              article.getBoundingClientRect().height - initialArticleHeight,
            ),
          );
        });
        const diagramResizeObserver = new ResizeObserver((entries) => {
          for (const entry of entries) {
            const diagram = entry.target as HTMLElement;
            const initialHeight = initialDiagramHeights.get(diagram) ?? 0;
            maximumDiagramHeightDelta = Math.max(
              maximumDiagramHeightDelta,
              Math.abs(diagram.getBoundingClientRect().height - initialHeight),
            );
          }
        });
        root.addEventListener("scroll", handleScroll, { passive: true });
        headerObserver.observe(header, {
          attributes: true,
          attributeFilter: ["class"],
        });
        surfaceObserver.observe(document.body, { childList: true, subtree: true });
        articleResizeObserver.observe(article);
        diagrams.forEach((diagram) => diagramResizeObserver.observe(diagram));

        for (let step = 0; step < 18; step += 1) {
          root.dispatchEvent(
            new WheelEvent("wheel", {
              bubbles: true,
              cancelable: true,
              deltaY: 220,
            }),
          );
          root.scrollTop += 220;
          sampleMermaid();
          await new Promise((resolve) => setTimeout(resolve, 42));
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        sampleMermaid();

        root.removeEventListener("scroll", handleScroll);
        headerObserver.disconnect();
        surfaceObserver.disconnect();
        articleResizeObserver.disconnect();
        diagramResizeObserver.disconnect();
        return {
          reverseJumps,
          headerClassChanges,
          removedMermaidSurfaces,
          initialSvgCount,
          minimumSvgCount,
          maximumArticleHeightDelta,
          maximumDiagramHeightDelta,
        };
      });

      const remountTarget = page.locator(".mermaid-diagram").nth(1);
      await remountTarget.evaluate((element) =>
        element.scrollIntoView({ block: "center" }),
      );
      await expect(
        page.locator(".mermaid-diagram").nth(1).locator(".mermaid-render-surface"),
      ).toHaveCount(1, { timeout: 15_000 });

      expect(probe.reverseJumps).toBe(0);
      expect(probe.headerClassChanges).toBeLessThanOrEqual(2);
      expect(probe.removedMermaidSurfaces).toBeLessThanOrEqual(8);
      expect(probe.initialSvgCount).toBeGreaterThan(0);
      expect(probe.minimumSvgCount).toBeGreaterThanOrEqual(0);
      expect(probe.maximumDiagramHeightDelta).toBeLessThanOrEqual(2);
      expect(probe.maximumArticleHeightDelta).toBeLessThanOrEqual(32);
    } finally {
      await activeApp?.close();
      await closeAuditMediaServer(auditMedia.server);
      await rm(auditRoot, { recursive: true, force: true });
    }
  });

  test("keeps independent locations and survives external content changes", async () => {
    test.slow();
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const auditRoot = await mkdtemp(
      path.join(os.tmpdir(), "raavi-reading-files-audit-"),
    );
    const userDataPath = path.join(auditRoot, "profile");
    const folderA = path.join(auditRoot, "پوشه-الف");
    const folderB = path.join(auditRoot, "پوشه-ب");
    const documentA = path.join(folderA, "سند-هم‌نام.md");
    const documentB = path.join(folderB, "سند-هم‌نام.md");
    const auditMedia = await startAuditMediaServer();
    await mkdir(folderA, { recursive: true });
    await mkdir(folderB, { recursive: true });
    await writeFile(
      documentA,
      longReadingDocument(auditMedia.baseUrl).replace(
        "سند بلند ممیزی پیوستگی مطالعه",
        "سند مستقل الف",
      ),
      "utf8",
    );
    await writeFile(
      documentB,
      longReadingDocument(auditMedia.baseUrl).replace(
        "سند بلند ممیزی پیوستگی مطالعه",
        "سند مستقل ب",
      ),
      "utf8",
    );

    const results: AuditResult[] = [];
    let activeApp: ElectronApplication | null = null;
    try {
      const firstDocument = await launchAuditApp(
        projectRoot,
        userDataPath,
        documentA,
      );
      activeApp = firstDocument.app;
      await ensureAuditChaptersRendered(firstDocument.page);
      await setReadingProgress(firstDocument.page, 0.27);
      const documentAPosition = await readingMetric(firstDocument.page);
      expect
        .soft(Math.abs(documentAPosition.progress - 0.27))
        .toBeLessThanOrEqual(0.015);
      await activeApp.close();
      activeApp = null;

      const secondDocument = await launchAuditApp(
        projectRoot,
        userDataPath,
        documentB,
      );
      activeApp = secondDocument.app;
      await ensureAuditChaptersRendered(secondDocument.page);
      await setReadingProgress(secondDocument.page, 0.73);
      const documentBPosition = await readingMetric(secondDocument.page);
      expect
        .soft(Math.abs(documentBPosition.progress - 0.73))
        .toBeLessThanOrEqual(0.015);
      await activeApp.close();
      activeApp = null;
      const reopenedA = await launchAuditApp(
        projectRoot,
        userDataPath,
        documentA,
      );
      activeApp = reopenedA.app;
      await ensureAuditChaptersRendered(reopenedA.page);
      await reopenedA.page.waitForTimeout(1_100);
      const restoredA = await readingMetric(reopenedA.page);
      results.push(
        compareScenario(
          "بازیابی مستقل فایل الف پس از مطالعهٔ فایل هم‌نام ب",
          documentAPosition,
          restoredA,
        ),
      );
      expect
        .soft(
          Math.abs(restoredA.progress - documentAPosition.progress),
          "file A should restore closer to its own progress than file B's progress",
        )
        .toBeLessThan(
          Math.abs(restoredA.progress - documentBPosition.progress),
        );
      await activeApp.close();
      activeApp = null;

      const reopenedB = await launchAuditApp(
        projectRoot,
        userDataPath,
        documentB,
      );
      activeApp = reopenedB.app;
      await ensureAuditChaptersRendered(reopenedB.page);
      await reopenedB.page.waitForTimeout(1_100);
      const restoredBPosition = await readingMetric(reopenedB.page);
      results.push(
        compareScenario(
          "بازیابی مستقل فایل ب پس از بازگشت از فایل هم‌نام الف",
          documentBPosition,
          restoredBPosition,
        ),
      );
      await activeApp.close();
      activeApp = null;

      await writeFile(
        documentB,
        [
          "# مقدمهٔ افزوده‌شده خارج از راوی",
          "",
          "این بند پیش از محتوای اصلی افزوده شده است تا جابه‌جایی شاخص بلوک آزموده شود.",
          "",
          longReadingDocument(auditMedia.baseUrl).replace(
            "سند بلند ممیزی پیوستگی مطالعه",
            "سند مستقل ب",
          ),
        ].join("\n"),
        "utf8",
      );
      const changedB = await launchAuditApp(
        projectRoot,
        userDataPath,
        documentB,
      );
      activeApp = changedB.app;
      await changedB.page.waitForTimeout(1_200);
      const changedBPosition = await readingMetric(changedB.page);
      expect
        .soft(
          changedBPosition.anchorText,
          "small external edits should restore the same semantic block",
        )
        .toBe(restoredBPosition.anchorText);
      expect
        .soft(
          Math.abs(
            changedBPosition.anchorOffset - restoredBPosition.anchorOffset,
          ),
          "small external edits should preserve the viewport offset",
        )
        .toBeLessThanOrEqual(MAX_VIEWPORT_ANCHOR_DRIFT);
      results.push({
        scenario: "بازیابی لنگر معنایی پس از افزودن متن بالاتر از محل مطالعه",
        before: restoredBPosition,
        after: changedBPosition,
        anchorChanged: false,
        progressDelta: Number(
          Math.abs(changedBPosition.progress - restoredBPosition.progress).toFixed(4),
        ),
        details: { externalContentChange: "small" },
      });
      await activeApp.close();
      activeApp = null;

      await writeFile(
        documentB,
        replacementReadingDocument("ب"),
        "utf8",
      );
      const replacedB = await launchAuditApp(
        projectRoot,
        userDataPath,
        documentB,
      );
      activeApp = replacedB.app;
      await replacedB.page.waitForTimeout(1_100);
      const replacedBPosition = await readingMetric(replacedB.page);
      expect
        .soft(
          Math.abs(replacedBPosition.progress - changedBPosition.progress),
          "large content replacement should use the latest reading progress after the preceding semantic restore",
        )
        .toBeLessThanOrEqual(0.03);
      expect.soft(replacedBPosition.horizontalOverflow).toBe(0);
      results.push({
        scenario: "fallback امن پس از جایگزینی کامل محتوای فایل",
        before: changedBPosition,
        after: replacedBPosition,
        anchorChanged: true,
        progressDelta: Number(
          Math.abs(replacedBPosition.progress - changedBPosition.progress).toFixed(4),
        ),
        details: { externalContentChange: "large", fallbackUsed: true },
      });

      console.log(`READING_MULTI_DOCUMENT_AUDIT=${JSON.stringify(results)}`);
    } finally {
      await activeApp?.close();
      await closeAuditMediaServer(auditMedia.server);
      await rm(auditRoot, { recursive: true, force: true });
    }
  });
});
