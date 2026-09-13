import { test, expect } from "@playwright/test";
import { openWritingDocument } from "./helpers/open-writing-document";

test("large unsaved tab survives async session persistence and reload", async ({ page }) => {
  const content = "# سند بازیابی\n\n" + "متن فارسی برای نگهداری پیش‌نویس.\n\n".repeat(6000);
  await page.goto("/");
  await openWritingDocument(page, { content, fileName: "بازیابی.md" });
  await page.locator('#markdown-editor .cm-content').focus();
  await page.keyboard.press('Control+End');
  await page.keyboard.insertText('پایان یکتای بازیابی');
  await expect.poll(() => page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open('raavi-document-session', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
    });
    try {
      return await new Promise<boolean>((resolve, reject) => {
        const r = db.transaction('session').objectStore('session').get('current');
        r.onsuccess = () => resolve(Boolean(r.result?.tabs.some((tab: {snapshot: {content: string}}) => tab.snapshot.content.endsWith('پایان یکتای بازیابی'))));
        r.onerror = () => reject(r.error);
      });
    } finally { db.close(); }
  })).toBe(true);
  await page.reload();
  await page.locator('#markdown-editor .cm-content').focus();
  await page.keyboard.press('Control+End');
  await expect(page.locator('#markdown-editor .cm-content')).toContainText('پایان یکتای بازیابی');
  await expect(page.locator('.document-identity')).toContainText('بازیابی.md');
});

test("dirty state returns to saved after undo without serializing the whole document", async ({ page }) => {
  const content = '# سند سالم\n\nمتن فارسی';
  await page.goto('/');
  await openWritingDocument(page, { content, savedContent: JSON.stringify({ content, annotations: [], assets: [] }) });
  const editor = page.locator('#markdown-editor .cm-content');
  await editor.focus();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('x');
  await expect(page.locator('.save-indicator')).toHaveClass(/is-dirty/);
  await page.keyboard.press('Control+z');
  await expect(editor).toContainText('متن فارسی');
  await expect(editor).not.toContainText('فارسیx');
  await expect(page.locator('.save-indicator')).toHaveClass(/is-saved/);
});

test("typing before headings preserves outline rows and their Persian numbering", async ({ page }) => {
  const content = 'مقدمه پیش از تیتر\n\n' + Array.from({ length: 60 }, (_, i) => `# بخش ${i + 1}\n\nمتن بخش ${i + 1}\n\n`).join('');
  await page.goto('/');
  await openWritingDocument(page, { content });
  await page.locator('[data-sidebar-destination="outline"]:visible').click();
  const rows = page.locator('#reading-document-outline-list .sidebar-row');
  await expect(rows).toHaveCount(60);
  const lastRow = await rows.last().elementHandle();
  await expect(rows.first().locator('.sidebar-row-meta')).toHaveText('۰۱');
  const editor = page.locator('#markdown-editor .cm-content');
  await editor.focus();
  await page.keyboard.press('Control+Home');
  await page.keyboard.insertText('افزوده ');
  await expect(editor).toContainText('افزوده مقدمه');
  await expect(rows).toHaveCount(60);
  expect(await lastRow!.evaluate(node => node.isConnected && node === document.querySelector('#reading-document-outline-list .sidebar-row:last-child'))).toBe(true);
  await expect(rows.last().locator('.sidebar-row-meta')).toHaveText('۶۰');
  await rows.last().click();
  await expect(editor).toContainText('متن بخش 60');
});
