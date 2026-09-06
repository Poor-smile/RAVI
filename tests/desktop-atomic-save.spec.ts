import { releaseElectron as electron } from "./helpers/release-electron";
import { expect, test } from "@playwright/test";
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { waitForRaaviWindow } from "./helpers/electron-main-window";
import { makeRaaviDocument } from "../app/raavi";

const documentPayload = (content: string, revision: number) => ({
  content, revision, annotations: [], versions: [], assets: [],
  raavi: makeRaaviDocument("test.md", content, [], revision),
});

test("Save As, concurrent saves, permission failure, and restart preserve complete Markdown and history", async () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const profile = await mkdtemp(path.join(os.tmpdir(), "raavi-atomic-desktop-"));
  const library = path.join(profile, "قفسه آزمایشی");
  const original = path.join(library, "original.md");
  const created = path.join(library, "ذخیره تازه.md");
  await mkdir(library);
  await writeFile(original, "# Original\n");
  await writeFile(path.join(profile, "library-state.json"), JSON.stringify({ folders: [library], recents: [] }));
  const launch = async () => {
    const executablePath = process.env.RAAVI_ELECTRON_EXECUTABLE;
    const app = await electron.launch({ cwd: root, executablePath, args: [
      ...(executablePath ? [] : [path.join(root, "desktop/main.mjs")]), `--user-data-dir=${profile}`,
    ] });
    expect(await app.evaluate(({ app }) => app.getPath("userData"))).toBe(profile);
    return app;
  };
  let app = await launch();
  try {
    const page = await waitForRaaviWindow(app);
    await app.evaluate(({ dialog }, target) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath: target });
    }, created);
    const result = await page.evaluate(async ({ original, created, initial, revisions }) => {
      const desktop = window.raaviDesktop!;
      await desktop.getLibraryState();
      await desktop.readLibraryDocument(original);
      const savedAs = await desktop.saveMarkdown("ذخیره تازه.md", initial);
      const saves = [];
      for (const revision of revisions) {
        saves.push(desktop.saveCurrentDocument(original, revision.main));
        saves.push(desktop.saveCurrentDocument(created, revision.other));
      }
      return { savedAs, saves: await Promise.all(saves) };
    }, { original, created, initial: documentPayload("# Saved as\n", 2), revisions: Array.from({ length: 8 }, (_, index) => ({
      main: documentPayload(`# Revision ${index + 3}\n` + "فارسی 📝\n".repeat(500), index + 3),
      other: documentPayload(`# Other ${index + 3}\n`, index + 3),
    })) });
    expect(result.savedAs).toMatchObject({ saved: true, filePath: created });
    expect(result.saves.every((save) => save.saved)).toBe(true);
    const expected = "# Revision 10\n" + "فارسی 📝\n".repeat(500);
    expect(await readFile(original, "utf8")).toBe(expected);
    expect(await readFile(created, "utf8")).toBe("# Other 10\n");
    const history = JSON.parse(await readFile(path.join(profile, "document-history.json"), "utf8"));
    expect(history.documents[original.toLowerCase()].revision).toBe(10);
    expect(history.documents[created.toLowerCase()].revision).toBe(10);
    await chmod(original, 0o444);
    try {
      const failure = await page.evaluate(async ({ file, payload }) => {
        try {
          await window.raaviDesktop!.saveCurrentDocument(file, payload);
          return "unexpected success";
        } catch (error) { return String(error); }
      }, { file: original, payload: documentPayload("should not replace", 11) });
      expect(failure).toMatch(/EACCES|EPERM/);
      expect(await readFile(original, "utf8")).toBe(expected);
    } finally { await chmod(original, 0o666); }
    expect((await readdir(library)).filter((name) => name.endsWith(".tmp"))).toEqual([]);
    await app.close();
    app = await launch();
    const restarted = await waitForRaaviWindow(app);
    const restored = await restarted.evaluate(async (file) => {
      await window.raaviDesktop!.getLibraryState();
      return window.raaviDesktop!.readLibraryDocument(file);
    }, original);
    expect(restored.content).toBe(expected);
    expect(restored.revision).toBe(10);
  } finally {
    await app.close().catch(() => {});
    await rm(profile, { recursive: true, force: true });
  }
});
