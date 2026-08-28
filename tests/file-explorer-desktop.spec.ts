import { _electron as electron, expect, test } from "@playwright/test";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { waitForRaaviWindow } from "./helpers/electron-main-window";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("desktop explorer protects dirty text and completes rename, delete and undo", async () => {
  test.skip(process.platform !== "win32", "The packaged desktop target is Windows.");
  test.setTimeout(90_000);
  const userDataPath = await mkdtemp(path.join(os.tmpdir(), "raavi-obl04-desktop-"));
  const libraryPath = path.join(userDataPath, "قفسه تست");
  const sourcePath = path.join(libraryPath, "draft note.md");
  const renamedPath = path.join(libraryPath, "یادداشت نهایی.md");
  await mkdir(libraryPath);
  await writeFile(sourcePath, "# Draft\n", "utf8");
  await writeFile(
    path.join(userDataPath, "library-state.json"),
    JSON.stringify({ folders: [libraryPath], recents: [] }),
    "utf8",
  );

  const app = await electron.launch({
    cwd: projectRoot,
    args: [
      path.join(projectRoot, "desktop", "main.mjs"),
      `--user-data-dir=${userDataPath}`,
    ],
    timeout: 25_000,
  });
  try {
    const window = await waitForRaaviWindow(app);
    await expect(window.locator(".app-shell")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    await window.getByRole("button", { name: "کتابخانه", exact: true }).click();
    const tree = window.getByRole("tree", { name: "کاوشگر فایل‌های محلی" });
    await expect(tree).toBeVisible();
    await tree.getByRole("treeitem", { name: "قفسه تست" }).click();
    const fileRow = tree.getByRole("treeitem", { name: "draft note.md" });
    await fileRow.click();
    await expect(window.getByRole("region", { name: "پیش‌نمایش Markdown" })).toContainText(
      "Draft",
    );
    await window.getByRole("button", { name: "بازگشت به میز", exact: true }).click();
    await expect(window.locator("#markdown-editor .cm-content")).toBeVisible();
    await window.getByRole("button", { name: "کتابخانه", exact: true }).click();
    await window.getByRole("button", { name: "جست‌وجو در کتابخانه" }).click();
    await expect(window.locator(".library-search-status")).toContainText(
      /محلی|روی همین دستگاه/,
    );
    await expect
      .poll(async () => {
        const state = JSON.parse(await readFile(path.join(userDataPath, "library-state.json"), "utf8"));
        return state.recents.length;
      })
      .toBe(1);
    await window.getByRole("button", { name: "کتابخانه", exact: true }).click();
    await expect(tree).toBeVisible();
    await window.locator("#markdown-editor .cm-content").fill("# متن ویرایش‌شده\n");
    await expect(tree.locator(".file-explorer-dirty")).toBeVisible();

    await tree.getByRole("button", { name: "عملیات فایل «draft note.md»" }).click();
    await expect(window.locator(".file-operation-dialog")).toBeVisible();
    await window.getByRole("button", { name: /تغییر نام/ }).click();
    await expect(window.getByText(/تغییرات ذخیره‌نشده دارد/)).toBeVisible();
    await expect(
      window.getByRole("button", { name: "انجام", exact: true }),
    ).toBeDisabled();
    await window.getByRole("button", { name: "بستن عملیات فایل" }).click();

    await window.getByRole("button", { name: /ذخیرهٔ تغییرات سند/ }).click();
    await expect
      .poll(() => readFile(sourcePath, "utf8"))
      .toContain("متن ویرایش‌شده");

    await tree.getByRole("button", { name: "عملیات فایل «draft note.md»" }).click();
    await expect(window.locator(".file-operation-dialog")).toBeVisible();
    await window.getByRole("button", { name: /تغییر نام/ }).click();
    await window.getByLabel("نام تازه").fill("یادداشت نهایی.md");
    await window.getByRole("button", { name: "انجام", exact: true }).click();
    await expect(tree.getByRole("treeitem", { name: "یادداشت نهایی.md" })).toBeVisible();
    await expect.poll(async () => {
      try {
        await access(renamedPath);
        return true;
      } catch {
        return false;
      }
    }).toBe(true);
    await expect.poll(async () => {
      try {
        await access(sourcePath);
        return true;
      } catch {
        return false;
      }
    }).toBe(false);

    await tree.getByRole("button", { name: "عملیات فایل «یادداشت نهایی.md»" }).click();
    await window.getByRole("button", { name: /حذف امن/ }).click();
    await window.getByRole("button", { name: "حذف و امکان بازگردانی" }).click();
    await expect(window.getByRole("button", { name: "بازگردانی" })).toBeVisible();
    await expect.poll(async () => {
      try {
        await access(renamedPath);
        return true;
      } catch {
        return false;
      }
    }).toBe(false);
    await window.getByRole("button", { name: "بازگردانی" }).click();
    await expect.poll(async () => {
      try {
        await access(renamedPath);
        return true;
      } catch {
        return false;
      }
    }).toBe(true);
    await expect(await readFile(renamedPath, "utf8")).toContain("متن ویرایش‌شده");
  } finally {
    await app.close();
    await rm(userDataPath, { recursive: true, force: true });
  }
});
