import { releaseElectron as electron } from "./helpers/release-electron";
import { expect, test, type Page } from "@playwright/test";
import type { ElectronApplication } from "playwright";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { waitForRaaviWindow } from "./helpers/electron-main-window";
import { createSnapshotStorage } from "../desktop/snapshot-storage.mjs";

async function fixture(count: number) {
  const profile = await mkdtemp(path.join(os.tmpdir(), "raavi-document-safety-"));
  const library = path.join(profile, "اسناد آزمایشی");
  await mkdir(library);
  const files = Array.from({ length: count }, (_, i) => path.join(library, `سند-${i + 1}.md`));
  const original = files.map((_, i) => `# سند ${i + 1}\n\nمتن اولیهٔ مستقل ${i + 1}.\n`);
  await Promise.all(files.map((file, i) => writeFile(file, original[i])));
  await writeFile(path.join(profile, "library-state.json"), JSON.stringify({ folders: [library], recents: [] }));
  const launch = () => electron.launch({ args: [path.resolve("desktop/main.mjs"), `--user-data-dir=${profile}`] });
  return { profile, files, original, launch };
}

async function openFile(app: ElectronApplication, page: Page, file: string) {
  await app.evaluate(({ dialog }, selected) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [selected] });
  }, file);
  const desk = page.getByRole("button", { name: "بازگشت به میز", exact: true });
  if (await desk.isVisible()) await desk.click();
  await page.getByRole("button", { name: "باز کردن فایل", exact: true }).click();
  await expect(page.locator(".document-identity")).toContainText(path.basename(file));
  if (await desk.isVisible()) await desk.click();
  await expect(page.locator("#markdown-editor .cm-content")).toBeVisible();
}

async function replaceText(page: Page, content: string) {
  const raw = page.getByRole("button", { name: "متن خام", exact: true });
  if (await raw.isVisible()) await raw.click();
  const editor = page.locator("#markdown-editor .cm-content");
  await editor.focus();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText(content);
}

async function session(page: Page) {
  return page.evaluate(async () => await window.raaviDesktop!.getDocumentSession!() ?? { activeTabId: "", tabs: [] }) as Promise<{
    activeTabId: string;
    tabs: { id: string; path: string; title: string; dirty: boolean; snapshot: { content: string; activeDocumentPath: string; lastSavedSnapshot: string } }[];
  }>;
}

async function record(page: Page, name: string) {
  const statePath = test.info().outputPath(`${name}.json`);
  await writeFile(statePath, JSON.stringify(await session(page), null, 2));
  await test.info().attach(name, { path: statePath, contentType: "application/json" });
  const imagePath = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path: imagePath });
  await test.info().attach(`${name}-ui`, { path: imagePath, contentType: "image/png" });
}

const tabFor = (page: Page, file: string) => page.locator(".document-tabs").getByRole("tab").filter({ hasText: path.basename(file) });

async function removeProfile(profile: string) {
  const resolved = path.resolve(profile);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("raavi-document-safety-")) {
    throw new Error("Refusing cleanup outside the isolated test profile.");
  }
  await rm(resolved, { recursive: true, force: true });
}

for (const count of [2, 5]) {
  for (const exitMode of ["normal", "crash"] as const) {
    test(`${count} Persian tabs recover active and inactive unsaved content after ${exitMode} exit`, async () => {
      const f = await fixture(count);
      let app = await f.launch();
      const edited = f.original.map((text, i) => `${text}\nتغییر ذخیره‌نشده-${i + 1}`);
      try {
        let page = await waitForRaaviWindow(app);
        for (let i = 0; i < count; i++) {
          await openFile(app, page, f.files[i]);
          await replaceText(page, edited[i]);
        }
        await expect.poll(async () => (await session(page)).tabs.map(t => t.snapshot.content)).toEqual(edited);
        await record(page, "before-close");
        const exited = new Promise<void>(resolve => app.process().once("exit", () => resolve()));
        if (exitMode === "normal") {
          // Close immediately after the final edit, before the debounced session
          // checkpoint. The unload path must include this exact latest text.
          edited[count - 1] += "-آخرین-تغییر-فوری";
          await replaceText(page, edited[count - 1]);
          // Native window button exercises the real close/unload path.
          await page.getByRole("button", { name: "بستن پنجره", exact: true }).click();
        } else {
          // getDocumentSession may return the in-memory checkpoint while native
          // IO is pending. A committed checkpoint is verified on disk before an
          // abrupt exit; normal-close coverage above also tests pending edits.
          await expect.poll(async () => {
            // Read the persisted manifest and immutable blobs with a fresh reader,
            // never the desktop store's in-memory latest checkpoint.
            const stored = await createSnapshotStorage(path.join(f.profile, "state-store")).read(path.join(f.profile, "document-session.json"));
            return stored?.tabs?.map((tab: { snapshot: { content: string } }) => tab.snapshot.content);
          }).toEqual(edited);
          // app.exit skips the normal close/unload handlers in this isolated app.
          await app.evaluate(({ app }) => app.exit(7)).catch(() => {});
        }
        await exited;
        await writeFile(test.info().outputPath("session-on-disk-after-exit.json"), await readFile(path.join(f.profile, "document-session.json"), "utf8"));
        app = await f.launch();
        page = await waitForRaaviWindow(app);
        await record(page, "after-relaunch");
        await expect(page.getByRole("tab")).toHaveCount(count);
        for (let i = 0; i < count; i++) {
          await tabFor(page, f.files[i]).click();
          const desk = page.getByRole("button", { name: "بازگشت به میز", exact: true });
          if (await desk.isVisible()) await desk.click();
          await expect(page.locator("#markdown-editor .cm-content")).toContainText(`تغییر ذخیره‌نشده-${i + 1}`);
        }
        await record(page, "after-recovery");
        expect(await Promise.all(f.files.map(file => readFile(file, "utf8")))).toEqual(f.original);
        // Recovery preserves the correct save destination, not just the text.
        for (let i = 0; i < count; i++) {
          await tabFor(page, f.files[i]).click();
          await page.getByRole("button", { name: /ذخیرهٔ تغییرات سند/ }).click();
          await expect.poll(() => readFile(f.files[i], "utf8")).toBe(edited[i]);
          await expect.poll(async () => (await session(page)).tabs[i]?.dirty).toBe(false);
        }
        expect(await Promise.all(f.files.map(file => readFile(file, "utf8")))).toEqual(edited);
      } finally {
        await app.close().catch(() => {});
        await removeProfile(f.profile);
      }
    });
  }
}

test("a delayed save of A cannot redirect the next save of B after opening B", async () => {
  const f = await fixture(2);
  let app = await f.launch();
  try {
    let page = await waitForRaaviWindow(app);
    await openFile(app, page, f.files[0]);
    const editedA = `${f.original[0]}\nویرایش مخصوص الف`;
    await replaceText(page, editedA);
    // Delay only delivery of a real native save result. File writes, permissions,
    // and history still use the original trusted handler in this isolated app.
    await app.evaluate(({ ipcMain }) => {
      const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, (...args: unknown[]) => unknown> })._invokeHandlers;
      const original = handlers.get("document:save-current");
      if (!original) throw new Error("Native save handler missing");
      const state = globalThis as typeof globalThis & { safetySaveGate?: { release: () => void; written: boolean } };
      const gate = new Promise<void>(resolve => { state.safetySaveGate = { release: resolve, written: false }; });
      let first = true;
      ipcMain.removeHandler("document:save-current");
      ipcMain.handle("document:save-current", async (...args) => {
        const result = await original(...args);
        if (first) {
          first = false;
          state.safetySaveGate!.written = true;
          await gate;
        }
        return result;
      });
    });
    await page.getByRole("button", { name: /ذخیرهٔ تغییرات سند/ }).click();
    await expect.poll(() => readFile(f.files[0], "utf8")).toBe(editedA);
    await openFile(app, page, f.files[1]);
    const editedB = `${f.original[1]}\nویرایش مخصوص ب`;
    await replaceText(page, editedB);
    await app.evaluate(() => {
      (globalThis as typeof globalThis & { safetySaveGate: { release: () => void } }).safetySaveGate.release();
    });
    await expect.poll(async () => (await session(page)).tabs.some(t => t.path === f.files[0] && JSON.parse(t.snapshot.lastSavedSnapshot || "null")?.content === editedA)).toBe(true);
    await record(page, "after-delayed-save-result");
    const state = await session(page);
    expect(state.tabs.find(t => t.id === state.activeTabId)?.path).toBe(f.files[1]);
    expect(state.tabs.find(t => t.id === state.activeTabId)?.snapshot.activeDocumentPath).toBe(f.files[1]);
    await page.getByRole("button", { name: /ذخیرهٔ تغییرات سند/ }).click();
    await expect.poll(() => readFile(f.files[1], "utf8")).toBe(editedB);
    expect(await readFile(f.files[0], "utf8")).toBe(editedA);
    await app.close();
    app = await f.launch();
    page = await waitForRaaviWindow(app);
    const restarted = await session(page);
    expect(new Set(restarted.tabs.map(t => t.id)).size).toBe(restarted.tabs.length);
    expect(await Promise.all(f.files.map(file => readFile(file, "utf8")))).toEqual([editedA, editedB]);
  } finally {
    await writeFile(test.info().outputPath("final-files.json"), JSON.stringify({
      files: f.files, contents: await Promise.all(f.files.map(file => readFile(file, "utf8"))),
    }, null, 2));
    await app.evaluate(() => {
      (globalThis as typeof globalThis & { safetySaveGate?: { release: () => void } }).safetySaveGate?.release();
    }).catch(() => {});
    await app.close().catch(() => {});
    await removeProfile(f.profile);
  }
});
