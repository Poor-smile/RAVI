import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { _electron, expect } from "@playwright/test";
import { waitForRaaviWindow } from "../tests/helpers/electron-main-window";

const [phase, executable, profile, documentPath, evidencePath] = process.argv.slice(2);
if (!["seed", "baseline", "verify"].includes(phase) || !evidencePath) throw new Error("Usage: node --import tsx scripts/check-installed-upgrade.mts seed|baseline|verify EXE PROFILE DOCUMENT EVIDENCE_JSON");
const source = await readFile(documentPath, "utf8");
const note = "نظر پایدار برای آزمون ارتقای نسخهٔ عمومی";
const app = await _electron.launch({ executablePath: path.resolve(executable), args: [`--user-data-dir=${path.resolve(profile)}`, documentPath], timeout: 30_000 });
try {
  const identity = await app.evaluate(({ app }) => ({ version: app.getVersion(), profile: app.getPath("userData"), executable: process.execPath }));
  assert.equal(path.resolve(identity.profile), path.resolve(profile));
  assert.equal(path.resolve(identity.executable).toLowerCase(), path.resolve(executable).toLowerCase());
  const page = await waitForRaaviWindow(app, 60_000);
  await expect.poll(() => page.evaluate(async () => (await window.raaviDesktop!.getLocalDocumentSnapshot())?.fileName)).toBe(path.basename(documentPath));
  if (phase === "seed") {
    const article = page.locator(".markdown-body");
    await expect(article).toBeVisible();
    await article.evaluate(node => {
      const paragraph = node.querySelector("p")!;
      const range = document.createRange();
      range.selectNodeContents(paragraph);
      const selection = window.getSelection()!;
      selection.removeAllRanges(); selection.addRange(range);
      const rect = range.getBoundingClientRect();
      node.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: rect.x + rect.width / 2, clientY: rect.y + rect.height / 2 }));
    });
    await page.getByRole("button", { name: "نظر", exact: true }).click();
    const composer = page.locator('[data-editable-kind="composer"]');
    await composer.fill(note);
    await composer.press("Control+Enter");
    await expect(composer).toHaveCount(0);
    await page.keyboard.press("Control+s");
    await expect.poll(() => page.evaluate(async () => (await window.raaviDesktop!.getLocalDocumentSnapshot())?.annotations.map(a => a.body))).toContain(note);
    await expect.poll(() => readFile(documentPath, "utf8")).toContain(note);
    const snapshot = await page.evaluate(() => window.raaviDesktop!.getLocalDocumentSnapshot());
    await writeFile(evidencePath, JSON.stringify({ identity, note, snapshot, content: await readFile(documentPath, "utf8") }, null, 2));
  } else {
    const before = JSON.parse(await readFile(evidencePath, "utf8"));
    await expect.poll(() => page.evaluate(async () => (await window.raaviDesktop!.getLocalDocumentSnapshot())?.annotations.map(a => a.body))).toContain(before.note);
    const snapshot = await page.evaluate(() => window.raaviDesktop!.getLocalDocumentSnapshot());
    assert.ok(snapshot?.annotations.some(a => a.body === before.note), "Comment was lost during installation upgrade");
    assert.equal(await readFile(documentPath, "utf8"), before.content, "Portable Markdown changed during upgrade");
    if (phase === "baseline") {
      assert.equal(identity.version, before.identity.version, "The baseline must be reopened with the previous public version");
      // Compare reopened files on both versions. The legacy writer normalizes
      // trailing whitespace when embedding annotations, before any upgrade.
      await writeFile(evidencePath, JSON.stringify({ ...before, initialSnapshot: before.snapshot, snapshot, reopenedWithPreviousVersion: true }, null, 2));
    } else {
      assert.equal(before.reopenedWithPreviousVersion, true, "Reopen the saved file with the previous version before comparing the upgrade");
      assert.equal(snapshot?.content, before.snapshot.content, "Restored document content differs after upgrade");
      await writeFile(evidencePath.replace(/\.json$/, "-verified.json"), JSON.stringify({ identity, annotationsPreserved: true, markdownPreserved: true, sourceBytesBeforeLaunch: Buffer.byteLength(source) }, null, 2));
    }
  }
} finally { await app.close(); }
