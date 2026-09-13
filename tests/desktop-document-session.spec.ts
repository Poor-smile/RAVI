import { releaseElectron as electron } from "./helpers/release-electron";
import { expect, test } from "@playwright/test";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { waitForRaaviWindow } from "./helpers/electron-main-window";

test("desktop session survives a complete restart and restores both large unsaved tabs", async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), "raavi-session-restart-"));
  const launch = () => electron.launch({ args: [path.resolve("desktop/main.mjs"), `--user-data-dir=${profile}`] });
  let app = await launch();
  try {
    const page = await waitForRaaviWindow(app);
    const content = "# پیش‌نویس حجیم\n\n" + "متن فارسی برای بازیابی کامل.\n".repeat(100000);
    const session = {
      version: 2, activeTabId: "draft:second", closedTabs: [],
      tabs: ["first", "second"].map(id => ({
        id: `draft:${id}`, title: `${id}.md`, path: "", draftId: id, dirty: true, pinned: false,
        snapshot: { fileName: `${id}.md`, content: `${content}\nپایان-${id}`, readerSize: 18,
          annotations: [], assets: [], revision: 1, versions: [], activeDocumentPath: "", documentType: "ravi",
          lastSavedSnapshot: "", draftId: id, viewMode: "desk", readingOutlineOpen: false, readingPositions: {}, annotationComposer: null },
      })),
    };
    // A user-visible session must come from the persistent native profile,
    // independently of the ephemeral server origin and its browser databases.
    await page.evaluate(async value => {
      await window.raaviDesktop!.saveDocumentSession!(value);
      const restored = await window.raaviDesktop!.getDocumentSession!();
      if (JSON.stringify(restored) !== JSON.stringify(value)) throw new Error("Session mismatch");
    }, session);
    const { createSnapshotStorage } = await import("../desktop/snapshot-storage.mjs");
    const onDisk = createSnapshotStorage(path.join(profile, "state-store"));
    expect(await onDisk.read(path.join(profile, "document-session.json"))).toEqual(session);
    await app.close();
    app = await launch();
    const reopened = await waitForRaaviWindow(app);
    await expect(reopened.locator(".document-identity")).toContainText("second.md");
    const editor = reopened.locator("#markdown-editor .cm-content");
    await editor.focus();
    await reopened.keyboard.press("Control+End");
    await expect(editor).toContainText("پایان-second");
    const restored = await reopened.evaluate(() => window.raaviDesktop!.getDocumentSession!()) as typeof session;
    expect(restored.tabs.map(tab => tab.snapshot.content)).toEqual(session.tabs.map(tab => tab.snapshot.content));
    // Reload immediately, without waiting for the 240 ms tab checkpoint or
    // the 450 ms active-document checkpoint. The final character must survive.
    await editor.focus();
    await reopened.keyboard.press("Control+End");
    await reopened.keyboard.insertText("-آخرین-تغییر-فوری");
    const reloadStarted = performance.now();
    await reopened.reload();
    await expect(reopened.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
    console.log("LARGE_SESSION_IMMEDIATE_RELOAD_MS", Math.round(performance.now() - reloadStarted));
    await expect(reopened.locator(".document-identity")).toContainText("second.md");
    const immediateSession = await reopened.evaluate(() => window.raaviDesktop!.getDocumentSession!()) as typeof session;
    expect(immediateSession.tabs.find(tab => tab.id === "draft:second")?.snapshot.content).toBe(`${session.tabs[1].snapshot.content}-آخرین-تغییر-فوری`);
    const editorAfterReload = reopened.locator("#markdown-editor .cm-content");
    await editorAfterReload.focus();
    await reopened.keyboard.press("Control+End");
    await expect(editorAfterReload).toContainText("پایان-second-آخرین-تغییر-فوری");
    await reopened.keyboard.insertText("-پیش‌از‌بستن");
    await app.close();
    app = await launch();
    const afterQuit = await waitForRaaviWindow(app);
    await expect(afterQuit.locator(".document-identity")).toContainText("second.md");
    const quitSession = await afterQuit.evaluate(() => window.raaviDesktop!.getDocumentSession!()) as typeof session;
    expect(quitSession.tabs.find(tab => tab.id === "draft:second")?.snapshot.content).toBe(`${session.tabs[1].snapshot.content}-آخرین-تغییر-فوری-پیش‌از‌بستن`);
  } finally {
    await app.close().catch(() => {});
    await rm(profile, { recursive: true, force: true });
  }
});

test("launching a file restores its unsaved tab instead of overwriting it with disk or another tab", async () => {
  const profile = await mkdtemp(path.join(os.tmpdir(), "raavi-session-open-"));
  const file = path.join(profile, "هدف.md");
  await writeFile(file, "# نسخهٔ روی دیسک\n");
  const tab = (id: string, filePath: string, content: string) => ({
    id, title: filePath ? "هدف.md" : "تب دیگر.md", path: filePath, draftId: id, dirty: true, pinned: false,
    snapshot: { content, fileName: filePath ? "هدف.md" : "تب دیگر.md", readerSize: 18, annotations: [], assets: [], revision: 1, versions: [], activeDocumentPath: filePath, documentType: "markdown", lastSavedSnapshot: "", draftId: id, viewMode: "desk", readingPositions: {} },
  });
  const targetId = `path:${file.normalize("NFC").toLocaleLowerCase("en-US")}`;
  let app = await electron.launch({ args: [path.resolve("desktop/main.mjs"), `--user-data-dir=${profile}`] });
  try {
    const page = await waitForRaaviWindow(app);
    const tabs = [tab(targetId, file, "# پیش‌نویس هدف\n\nآخرین تغییر ذخیره‌نشده"), tab("draft:other", "", "# پیش‌نویس تب دیگر")];
    await page.evaluate(async tabs => { await window.raaviDesktop!.saveDocumentSession!({ version: 2, activeTabId: "draft:other", tabs, closedTabs: [] }); }, tabs);
    await app.close();
    app = await electron.launch({ args: [path.resolve("desktop/main.mjs"), `--user-data-dir=${profile}`, file] });
    const reopened = await waitForRaaviWindow(app);
    await expect(reopened.locator(".document-identity")).toContainText("هدف.md");
    await expect(reopened.locator("#markdown-editor .cm-content")).toContainText("آخرین تغییر ذخیره‌نشده");
    await expect.poll(() => reopened.evaluate(async () => (await window.raaviDesktop!.getDocumentSession!() as { activeTabId: string }).activeTabId)).toBe(targetId);
    const recovered = await reopened.evaluate(async () => await window.raaviDesktop!.getDocumentSession!()) as { tabs: typeof tabs };
    expect(recovered.tabs.map(tab => tab.snapshot.content)).toEqual(tabs.map(tab => tab.snapshot.content));
    expect(await readFile(file, "utf8")).toBe("# نسخهٔ روی دیسک\n");
  } finally { await app.close().catch(() => {});await rm(profile, { recursive: true, force: true }); }
});
