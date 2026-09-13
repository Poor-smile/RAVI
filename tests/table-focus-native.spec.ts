import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { releaseElectron as electron } from "./helpers/release-electron";
import { waitForRaaviWindow } from "./helpers/electron-main-window";

test("desktop keeps the table mounted across theme changes and saves cell edits", async ({}, info) => {
  const profile = await mkdtemp(path.join(os.tmpdir(), "raavi-table-focus-"));
  const library = path.join(profile, "قفسه آزمون");
  const file = path.join(library, "table.md");
  await mkdir(library);
  const source = "| ردیف | متن |\n| --- | --- |\n| ۱ | نمونه فارسی |\n\nپایان\n";
  await writeFile(file, source);
  await writeFile(path.join(profile, "library-state.json"), JSON.stringify({ folders: [library], recents: [] }));
  const app = await electron.launch({ cwd: process.cwd(), args: [path.resolve("desktop/main.mjs"), `--user-data-dir=${profile}`] });
  try {
    const page = await waitForRaaviWindow(app);
    await page.getByRole("button", { name: "کتابخانه", exact: true }).click();
    const tree = page.getByRole("tree", { name: "کاوشگر فایل‌های محلی" });
    await tree.getByRole("treeitem", { name: "قفسه آزمون" }).click();
    await tree.getByRole("treeitem", { name: "table.md" }).click();
    await page.getByRole("button", { name: "بازگشت به میز", exact: true }).click();
    for (const mode of ["live", "proof"] as const) {
      await page.getByRole("button", { name: mode === "live" ? "ویرایش روان" : "نمونه‌خوانی دوبرگی", exact: true }).click();
      const host = page.locator(mode === "live" ? "#markdown-editor" : "#writing-editor");
      const table = host.locator(".cm-rich-table");
      const cell = table.locator('textarea[data-table-row="0"][data-table-column="1"]');
      await cell.click();
      const element = await table.elementHandle();
      const height = (await table.boundingBox())!.height;
      for (let i = 0; i < 2; i++) {
        await page.getByRole("button", { name: /فعال‌کردن تم (تاریک|روشن)/ }).first().click();
        await expect.poll(() => element!.evaluate(node => node.isConnected)).toBe(true);
        expect(Math.abs((await table.boundingBox())!.height - height)).toBeLessThan(2);
        await cell.click();
      }
      if (mode === "live") expect(await readFile(file, "utf8")).toBe(source);
      const value = `متن ذخیره‌شده ${mode}`;
      await cell.fill(value);
      await page.getByRole("button", { name: /فعال‌کردن تم (تاریک|روشن)/ }).first().click();
      await expect.poll(() => element!.evaluate(node => node.isConnected)).toBe(true);
      await page.getByRole("button", { name: /ذخیرهٔ تغییرات سند/ }).click();
      await expect.poll(() => readFile(file, "utf8")).toContain(value);
      await page.screenshot({ path: info.outputPath(`${mode}.png`) });
    }
  } finally {
    await app.close();
    // Keep the isolated profile and saved fixture for inspection; no user files used.
    await info.attach("isolated-profile", { body: profile, contentType: "text/plain" });
  }
});
