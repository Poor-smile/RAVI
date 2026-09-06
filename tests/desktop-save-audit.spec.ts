import { releaseElectron as electron } from "./helpers/release-electron";
import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { waitForRaaviWindow } from "./helpers/electron-main-window";

test("desktop saves edited Markdown before and after closing a file operation", async () => {
  const testInfo = test.info();
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const profile = await mkdtemp(path.join(os.tmpdir(), "raavi-save-audit-"));
  const library = path.join(profile, "قفسه تست");
  const file = path.join(library, "draft.md");
  await mkdir(library);
  await writeFile(file, "# Draft\n");
  await writeFile(path.join(profile, "library-state.json"), JSON.stringify({ folders: [library], recents: [] }));
  const app = await electron.launch({ cwd: root, args: [path.join(root, "desktop/main.mjs"), `--user-data-dir=${profile}`] });
  const messages: string[] = [];
  try {
    expect(await app.evaluate(({ app }) => app.getPath("userData"))).toBe(profile);
    const page = await waitForRaaviWindow(app);
    page.on("console", (message) => { if (message.type() === "error") messages.push(message.text()); });
    await app.context().tracing.start({ screenshots: true, snapshots: true });
    await page.getByRole("button", { name: "کتابخانه", exact: true }).click();
    const tree = page.getByRole("tree", { name: "کاوشگر فایل‌های محلی" });
    await tree.getByRole("treeitem", { name: "قفسه تست" }).click();
    await tree.getByRole("treeitem", { name: "draft.md" }).click();
    await page.getByRole("button", { name: "بازگشت به میز", exact: true }).click();
    const editor = page.locator("#markdown-editor .cm-content");
    for (const closeOperation of [false, true]) {
      const text = closeOperation ? "# After dialog\n" : "# Direct save\n";
      await editor.fill(text);
      if (closeOperation) {
        const libraryButton = page.getByRole("button", { name: "کتابخانه", exact: true });
        if (!(await tree.isVisible())) await libraryButton.click();
        await tree.getByRole("button", { name: "عملیات فایل «draft.md»" }).click();
        await page.getByRole("button", { name: /تغییر نام/ }).click();
        await expect(page.getByText(/تغییرات ذخیره‌نشده دارد/)).toBeVisible();
        await page.getByRole("button", { name: "بستن عملیات فایل" }).click();
      }
      await page.getByRole("button", { name: /ذخیرهٔ تغییرات سند/ }).click();
      await expect.poll(() => readFile(file, "utf8")).toContain(text.trim());
    }
  } catch (error) {
    const page = app.windows().find((candidate) => candidate.url().startsWith("http://127.0.0.1:"));
    if (page) {
      await testInfo.attach("save-failure", { body: await page.screenshot(), contentType: "image/png" });
      await testInfo.attach("save-page-state", { body: await page.locator("body").innerText(), contentType: "text/plain" });
    }
    throw error;
  } finally {
    await app.context().tracing.stop({ path: testInfo.outputPath("electron-save-trace.zip") }).catch(() => {});
    await testInfo.attach("renderer-errors", { body: messages.join("\n"), contentType: "text/plain" });
    await app.close();
    await rm(profile, { recursive: true, force: true });
  }
});
