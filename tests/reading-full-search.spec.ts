import { expect, test, type Page } from "@playwright/test";
import { installReadingSearchGate, waitForHeldSearch, flushOldSearch } from "./helpers/reading-search-gate";

async function open(page: Page, content: string) {
  await page.addInitScript(content => {
    localStorage.setItem("raavi:document:v1", JSON.stringify({ content, fileName: "full-search.md", readerSize: 18, annotations: [], assets: [], revision: 1, versions: [], documentType: "markdown", viewMode: "reading", draftId: "full-search", readingPositions: {} }));
  }, content);
  await page.goto("/");
  await expect(page.locator('.app-shell[data-hydrated="true"]')).toBeVisible();
  await page.locator('[data-sidebar-destination="search"]:visible').click();
}

test("finds and navigates to unrendered end of document without rendering it just to search", async ({ page }) => {
  const content = Array.from({ length: 40 }, (_, i) => `## فصل ${i + 1}\n\n${"متن زمینه برای آزمون جست‌وجو. ".repeat(180)}\n`).join("\n") + "\nعبارت یکتای انتهای سند\n";
  await open(page, content);
  const paragraph = page.locator('.markdown-body p').filter({ hasText: /^عبارت یکتای انتهای سند$/ });
  await expect(paragraph).toHaveCount(0);
  const chunksBefore = await page.locator('[data-markdown-chunk]').count();
  await page.getByRole('searchbox', { name: 'جست‌وجو در متن سند' }).fill('عبارت یکتای انتهای سند');
  await expect(page.locator('.reading-document-search-summary')).toHaveText('۱ نتیجه در همین سند');
  await expect(page.locator('[data-markdown-chunk]')).toHaveCount(chunksBefore);
  await page.locator('.reading-document-search-results button').click();
  await expect(paragraph).toBeInViewport({ timeout: 30_000 });
  await page.waitForTimeout(1300);
  await expect(paragraph).toBeInViewport();
});

test("reports every occurrence and allows visiting pages after result 100", async ({ page }) => {
  await open(page, Array.from({ length: 207 }, (_, i) => `## فصل ${i + 1}\n\nنشان مشترک ${i + 1}\n`).join('\n'));
  await page.getByRole('searchbox', { name: 'جست‌وجو در متن سند' }).fill('نشان مشترک');
  await expect(page.locator('.reading-document-search-summary')).toHaveText('۲۰۷ نتیجه در همین سند');
  await expect(page.locator('.reading-document-search-results button')).toHaveCount(50);
  for (let i = 0; i < 4; i++) {
    await page.getByRole('button', { name: 'نتایج بعدی', exact: true }).click();
    await expect(page.locator('.reading-document-search-summary')).toHaveText('۲۰۷ نتیجه در همین سند');
    await expect(page.locator('.reading-document-search-result-index').first()).toHaveText(`${(50 * (i + 1) + 1).toLocaleString('fa-IR')}/۲۰۷`);
  }
  await expect(page.locator('.reading-document-search-results button')).toHaveCount(7);
  await expect(page.getByRole('button', { name: 'نتایج بعدی', exact: true })).toBeDisabled();
  await page.locator('.reading-document-search-results button').last().click();
  await expect(page.locator('.markdown-body p').filter({ hasText: /^نشان مشترک 207$/ })).toBeInViewport();
});

test("latest query replaces stale results and inline-format matches remain navigable", async ({ page }) => {
  await open(page, '# آغاز\n\nواژه قدیمی\n\nمتن **پررنگ** و پیوند تازه\n');
  const input = page.getByRole('searchbox', { name: 'جست‌وجو در متن سند' });
  await input.fill('قدیمی');
  await input.fill('متن پررنگ و پیوند تازه');
  await expect(page.locator('.reading-document-search-summary')).toHaveText('۱ نتیجه در همین سند');
  await page.locator('.reading-document-search-results button').click();
  await expect(page.locator('.markdown-body p').filter({ hasText: 'متن پررنگ و پیوند تازه' })).toBeInViewport();
  await input.fill('وجود ندارد');
  await expect(page.locator('.reading-document-search-summary')).toHaveText('۰ نتیجه در همین سند');
  await expect(page.locator('.reading-document-search-results button')).toHaveCount(0);
});

test("large-document direct jump skips parsing predecessors and selection materializes every intervening paragraph", async ({ page }) => {
  const chapters = Array.from({ length: 70 }, (_, i) => `## فصل ${i + 1}\n\nنشانه مستقل ${i + 1}\n\n${"متن فارسی برای مطالعه و آزمون مستقیم. ".repeat(700)}\n\n`);
  const content = chapters.join("") + "\nپایان یکتای پیمایش مستقیم\n";
  expect(content.length).toBeGreaterThan(1024 * 1024);
  await open(page, content);
  await page.getByRole('searchbox', { name: 'جست‌وجو در متن سند' }).fill('پایان یکتای پیمایش مستقیم');
  await expect(page.locator('.reading-document-search-summary')).toHaveText('۱ نتیجه در همین سند');
  const start = Date.now();
  await page.locator('.reading-document-search-results button').click();
  const end = page.locator('.markdown-body p').filter({ hasText: /^پایان یکتای پیمایش مستقیم$/ });
  await expect(end).toBeInViewport();
  console.log('DIRECT_JUMP_MS', Date.now() - start);
  await page.waitForTimeout(1300);
  await expect(end).toBeInViewport();
  expect(await page.locator('[data-chunk-pending="true"]').count()).toBeGreaterThan(10);
  // A range across unloaded sections must include them before copy; neither
  // late navigation nor rendering order may silently truncate copied text.
  await page.evaluate(() => {
    const article = document.querySelector('.markdown-body')!;
    const paragraphs = article.querySelectorAll('p');
    const range = document.createRange();
    range.setStartBefore(paragraphs[0]);
    range.setEndAfter(paragraphs[paragraphs.length - 1]);
    const selection = window.getSelection()!;
    selection.removeAllRanges(); selection.addRange(range);
    document.dispatchEvent(new Event('selectionchange'));
  });
  await expect(page.locator('[data-chunk-pending="true"]')).toHaveCount(0);
  const selection = await page.evaluate(() => window.getSelection()?.toString() ?? '');
  for (let chapter = 1; chapter <= 70; chapter++) expect(selection).toContain(`نشانه مستقل ${chapter}`);
});

test("late chunks resolve Mermaid and formulas using their actual document offsets", async ({ page }) => {
  const prefix = Array.from({ length: 12 }, (_, i) => `## فصل ${i}\n\n${"زمینه برای خواندن. ".repeat(700)}\n\n`).join("");
  await open(page, prefix + '\n## رسانه انتهایی\n\nمقصد رسانه یکتا\n\n```mermaid\nflowchart LR\n A["نمودار انتها"] --> B["درست"]\n```\n\n$$\nx^2 + y^2\n$$\n');
  await page.getByRole('searchbox', { name: 'جست‌وجو در متن سند' }).fill('مقصد رسانه یکتا');
  await expect(page.locator('.reading-document-search-summary')).toHaveText('۱ نتیجه در همین سند');
  await page.locator('.reading-document-search-results button').click();
  const diagram = page.locator('.markdown-body .mermaid-diagram[data-mermaid-block-id]');
  await expect(diagram).toHaveCount(1);
  await diagram.scrollIntoViewIfNeeded();
  const image = diagram.locator('img.mermaid-render-surface');
  await expect(image).toBeVisible();
  const labels = await image.evaluate(async element => {
    const svg = await (await fetch((element as HTMLImageElement).src)).text();
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    return [...parsed.querySelectorAll('.node text')].map(node => node.textContent);
  });
  expect(labels).toContain('نمودار انتها');
  await expect(page.locator('.markdown-body .formula-document-block .katex')).toHaveCount(1);
});

async function showReadingSearch(page: Page) {
  const read = page.getByRole('button', { name: 'خواندن', exact: true });
  if (await read.isVisible()) await read.click();
  const input = page.getByRole('searchbox', { name: 'جست‌وجو در متن سند' });
  if (!await input.isVisible()) await page.locator('[data-sidebar-destination="search"]:visible').click();
  return input;
}

test("switching documents rejects an already completed old reply and restores the original document search", async ({ page }, info) => {
  await installReadingSearchGate(page);
  const first = '# گزارش نخست\n\nنشان مشترک در سند نخست\n';
  const second = '# گزارش دوم\n\nنشان مشترک در آغاز دوم\n\n' +
    Array.from({ length: 24 }, (_, i) => `## بخش ${i}\n\n${'زمینهٔ گزارش دوم. '.repeat(200)}\n\n`).join('') +
    '\nنشان مشترک در پایان دوم\n';
  await page.addInitScript(({ first, second }) => {
    const tabs = [first, second].map((content, i) => ({
      id: `search-${i}`, title: `گزارش ${i + 1}.md`, path: '', draftId: `search-${i}`, dirty: true, pinned: false,
      snapshot: { content, fileName: `گزارش ${i + 1}.md`, readerSize: 18, annotations: [], assets: [], revision: 1,
        versions: [], activeDocumentPath: '', documentType: 'markdown', draftId: `search-${i}`,
        viewMode: 'reading', readingOutlineOpen: false, readingPositions: {}, annotationComposer: null },
    }));
    localStorage.setItem('raavi:document-session:v2', JSON.stringify({ version: 2, activeTabId: 'search-0', tabs, closedTabs: [] }));
  }, { first, second });
  await page.goto('/');
  await expect(page.locator('.app-shell')).toHaveAttribute('data-hydrated', 'true');
  await (await showReadingSearch(page)).fill('نشان مشترک');
  await waitForHeldSearch(page);
  await page.getByRole('button', { name: 'بازگشت به میز', exact: true }).click();
  await page.locator('.document-tabs').getByRole('tab').filter({ hasText: 'گزارش 2.md' }).click();
  await (await showReadingSearch(page)).fill('نشان مشترک');
  const summary = page.locator('.reading-document-search-summary');
  const results = page.locator('.reading-document-search-results button');
  await expect(summary).toHaveText('۲ نتیجه در همین سند');
  await flushOldSearch(page);
  await expect(summary).toHaveText('۲ نتیجه در همین سند');
  await expect(results).toHaveCount(2);
  await expect(results).not.toContainText(['سند نخست']);
  await results.last().click();
  await expect(page.locator('.markdown-body p').filter({ hasText: /^نشان مشترک در پایان دوم$/ })).toBeInViewport();
  await page.screenshot({ path: info.outputPath('search-after-tab-change.png') });
  await page.getByRole('button', { name: 'بازگشت به میز', exact: true }).click();
  await page.locator('.document-tabs').getByRole('tab').filter({ hasText: 'گزارش 1.md' }).click();
  await (await showReadingSearch(page)).fill('نشان مشترک');
  await expect(summary).toHaveText('۱ نتیجه در همین سند');
  await results.click();
  await expect(page.locator('.markdown-body p').filter({ hasText: /^نشان مشترک در سند نخست$/ })).toBeInViewport();
});

test("editing a document while search is pending replaces counts and target offsets without accepting its old reply", async ({ page }, info) => {
  await installReadingSearchGate(page);
  await open(page, '# نسخهٔ قبلی\n\nنشان ویرایش قدیمی اول\n\nنشان ویرایش قدیمی دوم\n\nنشان ویرایش قدیمی سوم\n');
  await page.getByRole('searchbox', { name: 'جست‌وجو در متن سند' }).fill('نشان ویرایش');
  await waitForHeldSearch(page);
  await page.getByRole('button', { name: 'بازگشت به میز', exact: true }).click();
  await page.getByRole('button', { name: 'متن خام', exact: true }).click();
  const changed = '# نسخهٔ ویرایش‌شده\n\nنشان ویرایش تازه در ابتدا\n\n' +
    Array.from({ length: 12 }, (_, i) => `## بخش ${i}\n\n${'متن جابه‌جا شده برای بررسی مقصد. '.repeat(30)}\n\n`).join('') +
    '\nنشان ویرایش تازه در انتها\n';
  await page.locator('#markdown-editor .cm-content').fill(changed);
  await (await showReadingSearch(page)).fill('نشان ویرایش');
  const summary = page.locator('.reading-document-search-summary');
  const results = page.locator('.reading-document-search-results button');
  await expect(summary).toHaveText('۲ نتیجه در همین سند');
  await flushOldSearch(page);
  await expect(summary).toHaveText('۲ نتیجه در همین سند');
  await expect(results).toHaveCount(2);
  await expect(results).not.toContainText(['قدیمی']);
  await results.last().click();
  await expect(page.locator('.markdown-body p').filter({ hasText: /^نشان ویرایش تازه در انتها$/ })).toBeInViewport();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('raavi:document:v1') || '{}').content)).toBe(changed);
  await page.screenshot({ path: info.outputPath('search-after-edit.png') });
});
