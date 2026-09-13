import { releaseElectron as electron } from "./helpers/release-electron";
import { expect, test, type Page } from "@playwright/test";
import type { ElectronApplication } from "playwright";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { waitForRaaviWindow } from "./helpers/electron-main-window";

type Session = {
  activeTabId: string;
  tabs: {
    id: string;
    path: string;
    title: string;
    dirty: boolean;
    snapshot: {
      content: string;
      activeDocumentPath: string;
      lastSavedSnapshot: string;
    };
  }[];
};

async function fixture() {
  const profile = await mkdtemp(path.join(os.tmpdir(), "raavi-save-completion-"));
  const library = path.join(profile, "اسناد آزمایشی");
  await mkdir(library);
  const files = ["سند-الف.md", "سند-ب.md"].map(name => path.join(library, name));
  const original = ["# سند الف\n\nمتن اولیهٔ مستقل الف.\n", "# سند ب\n\nمتن اولیهٔ مستقل ب.\n"];
  await Promise.all(files.map((file, index) => writeFile(file, original[index])));
  await writeFile(path.join(profile, "library-state.json"), JSON.stringify({ folders: [library], recents: [] }));
  const launch = () => electron.launch({ args: [path.resolve("desktop/main.mjs"), `--user-data-dir=${profile}`] });
  return { profile, library, files, original, launch };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function session(page: Page): Promise<Session> {
  return page.evaluate(async () => await window.raaviDesktop!.getDocumentSession!() ?? { activeTabId: "", tabs: [] }) as Promise<Session>;
}

const tabFor = (page: Page, file: string) =>
  page.locator(".document-tabs").getByRole("tab").filter({ hasText: path.basename(file) });
const saveButton = (page: Page) => page.getByRole("button", { name: /ذخیرهٔ تغییرات سند/ });

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
  await expect.poll(async () => {
    const current = await session(page);
    return current.tabs.find(tab => tab.id === current.activeTabId)?.snapshot.activeDocumentPath;
  }).toBe(file);
}

async function replaceText(page: Page, content: string, file: string) {
  const raw = page.getByRole("button", { name: "متن خام", exact: true });
  if (await raw.isVisible()) await raw.click();
  const editor = page.locator("#markdown-editor .cm-content");
  await editor.focus();
  await page.keyboard.press("Control+Home");
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText(content);
  await expect.poll(async () => (await session(page)).tabs.find(tab => tab.path === file)?.snapshot.content).toBe(content);
}

// The original trusted IPC handler and real filesystem remain in use. Only
// delivery of the first completed result is held, making the ordering explicit.
async function installCompletionGate(app: ElectronApplication, channel: "document:save-current" | "document:save-markdown") {
  await app.evaluate(({ ipcMain }, selectedChannel) => {
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, (...args: unknown[]) => unknown> })._invokeHandlers;
    const original = handlers.get(selectedChannel);
    if (!original) throw new Error(`Missing native handler: ${selectedChannel}`);
    const state = globalThis as typeof globalThis & {
      completionGate?: { release: () => void; settled: boolean; delivered: boolean; failed: boolean };
    };
    const gate = new Promise<void>(resolve => {
      state.completionGate = { release: resolve, settled: false, delivered: false, failed: false };
    });
    let claimed = false;
    ipcMain.removeHandler(selectedChannel);
    ipcMain.handle(selectedChannel, async (...args) => {
      const hold = !claimed;
      claimed = true;
      let result: unknown;
      let failure: unknown;
      let failed = false;
      try {
        result = await original(...args);
      } catch (error) {
        failure = error;
        failed = true;
      }
      if (hold) {
        state.completionGate!.settled = true;
        state.completionGate!.failed = failed;
        await gate;
        state.completionGate!.delivered = true;
      }
      if (failed) throw failure;
      return result;
    });
  }, channel);
}

async function waitForNativeResult(app: ElectronApplication) {
  await expect.poll(() => app.evaluate(() =>
    (globalThis as typeof globalThis & { completionGate?: { settled: boolean } }).completionGate?.settled,
  )).toBe(true);
}

async function releaseCompletion(app: ElectronApplication, page: Page) {
  await app.evaluate(() => {
    (globalThis as typeof globalThis & { completionGate?: { release: () => void } }).completionGate?.release();
  });
  await expect.poll(() => app.evaluate(() =>
    (globalThis as typeof globalThis & { completionGate?: { delivered: boolean } }).completionGate?.delivered,
  )).toBe(true);
  // Allow the delivered IPC result and React's frame-scheduled tab mirror to
  // commit before observing operations that should leave B unchanged.
  await page.evaluate(() => new Promise<void>(resolve => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  }));
}

async function assertActive(page: Page, file: string, content: string) {
  await expect.poll(async () => {
    const current = await session(page);
    const tab = current.tabs.find(candidate => candidate.id === current.activeTabId);
    return tab ? { path: tab.path, snapshotPath: tab.snapshot.activeDocumentPath, content: tab.snapshot.content } : null;
  }).toEqual({ path: file, snapshotPath: file, content });
  await expect(tabFor(page, file)).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".document-identity")).toContainText(path.basename(file));
}

async function record(page: Page, name: string) {
  const statePath = test.info().outputPath(`${name}.json`);
  await writeFile(statePath, JSON.stringify(await session(page), null, 2));
  await test.info().attach(name, { path: statePath, contentType: "application/json" });
  const imagePath = test.info().outputPath(`${name}.png`);
  await page.screenshot({ path: imagePath });
  await test.info().attach(`${name}-ui`, { path: imagePath, contentType: "image/png" });
}

async function cleanUp(app: ElectronApplication, f: Fixture) {
  await app.evaluate(() => {
    (globalThis as typeof globalThis & { completionGate?: { release: () => void } }).completionGate?.release();
  }).catch(() => {});
  await writeFile(test.info().outputPath("final-files.json"), JSON.stringify({
    files: f.files,
    contents: await Promise.all(f.files.map(file => readFile(file, "utf8").catch(error => String(error)))),
  }, null, 2));
  await app.close().catch(() => {});
  const resolved = path.resolve(f.profile);
  if (path.dirname(resolved) !== path.resolve(os.tmpdir()) || !path.basename(resolved).startsWith("raavi-save-completion-")) {
    throw new Error("Refusing cleanup outside the isolated test profile.");
  }
  await rm(resolved, { recursive: true, force: true });
}

async function startSaveAs(app: ElectronApplication, page: Page, destination: string, canceled: boolean) {
  // Stub only the user's native path selection/cancellation. The original
  // save-markdown handler performs validation and every actual file write.
  await app.evaluate(({ dialog }, selection) => {
    dialog.showSaveDialog = async () => selection.canceled
      ? { canceled: true, filePath: "" }
      : { canceled: false, filePath: selection.destination };
  }, { destination, canceled });
  await installCompletionGate(app, "document:save-markdown");
  await page.locator(".document-identity").click();
  await page.getByRole("menuitem", { name: "ذخیره با نام", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "ذخیره فایل", exact: true });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "نام فایل", exact: true }).fill(path.basename(destination));
  await dialog.getByRole("button", { name: "ذخیره فایل", exact: true }).click();
  await waitForNativeResult(app);
  // Native selection has already finished, but its result is still gated.
  // Closing Ravi's own modal is an available UI action during that interval.
  await dialog.getByRole("button", { name: "بستن پنجره‌ی ذخیره", exact: true }).click();
  await expect(dialog).toBeHidden();
}

test("editing A while its save result is delayed preserves the new text as dirty", async () => {
  const f = await fixture();
  const app = await f.launch();
  try {
    const page = await waitForRaaviWindow(app);
    await openFile(app, page, f.files[0]);
    const savedText = `${f.original[0]}\nنسخهٔ هنگام آغاز ذخیره`;
    const laterText = `${savedText}\nویرایش تازه هنگام انتظار`;
    await replaceText(page, savedText, f.files[0]);
    await installCompletionGate(app, "document:save-current");
    await saveButton(page).click();
    await waitForNativeResult(app);
    expect(await readFile(f.files[0], "utf8")).toBe(savedText);
    await replaceText(page, laterText, f.files[0]);
    await releaseCompletion(app, page);
    await assertActive(page, f.files[0], laterText);
    await expect.poll(async () => (await session(page)).tabs.find(tab => tab.path === f.files[0])?.dirty).toBe(true);
    await expect.poll(async () => {
      const saved = (await session(page)).tabs.find(tab => tab.path === f.files[0])?.snapshot.lastSavedSnapshot;
      return JSON.parse(saved || "null")?.content;
    }).toBe(savedText);
    await record(page, "new-edits-remain-dirty");
    expect(await readFile(f.files[0], "utf8")).toBe(savedText);
    await saveButton(page).click();
    await expect.poll(() => readFile(f.files[0], "utf8")).toBe(laterText);
    await expect.poll(async () => (await session(page)).tabs.find(tab => tab.path === f.files[0])?.dirty).toBe(false);
    expect(await readFile(f.files[1], "utf8")).toBe(f.original[1]);
  } finally {
    await cleanUp(app, f);
  }
});

test("a delayed save-and-close request for A never closes B on B's next save", async () => {
  const f = await fixture();
  const app = await f.launch();
  try {
    const page = await waitForRaaviWindow(app);
    await openFile(app, page, f.files[0]);
    const editedA = `${f.original[0]}\nذخیره و بستن مخصوص الف`;
    const editedB = `${f.original[1]}\nب باید باز بماند`;
    await replaceText(page, editedA, f.files[0]);
    await installCompletionGate(app, "document:save-current");
    await page.locator(".document-tabs").getByRole("button", { name: `بستن ${path.basename(f.files[0])}`, exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "ذخیره و بستن", exact: true }).click();
    await waitForNativeResult(app);
    await openFile(app, page, f.files[1]);
    await replaceText(page, editedB, f.files[1]);
    await releaseCompletion(app, page);
    await assertActive(page, f.files[1], editedB);
    await saveButton(page).click();
    await expect.poll(() => readFile(f.files[1], "utf8")).toBe(editedB);
    await expect.poll(async () => (await session(page)).tabs.find(tab => tab.path === f.files[1])?.dirty).toBe(false);
    await assertActive(page, f.files[1], editedB);
    await expect(tabFor(page, f.files[1])).toHaveCount(1);
    await record(page, "b-open-after-own-save");
    expect(await readFile(f.files[0], "utf8")).toBe(editedA);
  } finally {
    await cleanUp(app, f);
  }
});

test("canceling A's Save As in the background leaves B active and A retryable", async () => {
  const f = await fixture();
  const app = await f.launch();
  try {
    const page = await waitForRaaviWindow(app);
    await openFile(app, page, f.files[0]);
    const editedA = `${f.original[0]}\nتغییر الف پس از لغو باید باقی بماند`;
    const editedB = `${f.original[1]}\nذخیرهٔ مستقل ب`;
    const canceledDestination = path.join(f.library, "نسخه-لغوشده.md");
    await replaceText(page, editedA, f.files[0]);
    await startSaveAs(app, page, canceledDestination, true);
    await openFile(app, page, f.files[1]);
    await replaceText(page, editedB, f.files[1]);
    await releaseCompletion(app, page);
    await assertActive(page, f.files[1], editedB);
    await expect(page.locator('[data-save-error-banner="true"]')).toBeHidden();
    await saveButton(page).click();
    await expect.poll(() => readFile(f.files[1], "utf8")).toBe(editedB);
    await assertActive(page, f.files[1], editedB);
    expect(await readFile(f.files[0], "utf8")).toBe(f.original[0]);
    await expect(readFile(canceledDestination, "utf8")).rejects.toMatchObject({ code: "ENOENT" });
    await tabFor(page, f.files[0]).click();
    await assertActive(page, f.files[0], editedA);
    await expect.poll(async () => (await session(page)).tabs.find(tab => tab.path === f.files[0])?.dirty).toBe(true);
    await saveButton(page).click();
    await expect.poll(() => readFile(f.files[0], "utf8")).toBe(editedA);
    await record(page, "canceled-a-retried-at-original-path");
    expect(await readFile(f.files[1], "utf8")).toBe(editedB);
  } finally {
    await cleanUp(app, f);
  }
});

test("a background Save As updates only A's tab to its fresh destination", async () => {
  const f = await fixture();
  const app = await f.launch();
  try {
    const page = await waitForRaaviWindow(app);
    await openFile(app, page, f.files[0]);
    const editedA = `${f.original[0]}\nنسخهٔ تازهٔ الف`;
    const editedB = `${f.original[1]}\nمتن مستقل ب`;
    const destination = path.join(f.library, "نسخه-تازه-الف.md");
    await replaceText(page, editedA, f.files[0]);
    await startSaveAs(app, page, destination, false);
    expect(await readFile(destination, "utf8")).toBe(editedA);
    await openFile(app, page, f.files[1]);
    await replaceText(page, editedB, f.files[1]);
    await releaseCompletion(app, page);
    await expect.poll(async () => (await session(page)).tabs.find(tab => tab.path === destination)?.snapshot.content).toBe(editedA);
    await assertActive(page, f.files[1], editedB);
    await saveButton(page).click();
    await expect.poll(() => readFile(f.files[1], "utf8")).toBe(editedB);
    await assertActive(page, f.files[1], editedB);
    const current = await session(page);
    expect(new Set(current.tabs.map(tab => tab.id)).size).toBe(current.tabs.length);
    expect(current.tabs.filter(tab => tab.path === destination)).toHaveLength(1);
    expect(current.tabs.some(tab => tab.path === f.files[0])).toBe(false);
    await tabFor(page, destination).click();
    await assertActive(page, destination, editedA);
    const latestA = `${editedA}\nویرایش پس از بازگشت`;
    await replaceText(page, latestA, destination);
    await saveButton(page).click();
    await expect.poll(() => readFile(destination, "utf8")).toBe(latestA);
    expect(await readFile(f.files[0], "utf8")).toBe(f.original[0]);
    expect(await readFile(f.files[1], "utf8")).toBe(editedB);
    await record(page, "save-as-new-path-preserved");
    await test.info().attach("save-as-file", { path: destination, contentType: "text/markdown" });
  } finally {
    await cleanUp(app, f);
  }
});
