import { expect, test } from "@playwright/test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("a reading-only Markdown file enters Vault only after the first edit", async ({
  page,
}) => {
  const fixtureBase = await mkdtemp(path.join(os.tmpdir(), "raavi-vault-p20-"));
  const libraryRoot = path.join(fixtureBase, "مطالعه");
  try {
    await mkdir(libraryRoot, { recursive: true });
    await writeFile(
      path.join(libraryRoot, "مقاله.md"),
      "# مقاله\n\nاین فایل فقط برای مطالعه باز شده است.",
      "utf8",
    );
    await page.addInitScript(() => window.localStorage.clear());
    await page.goto("/");
    await expect(page.locator(".app-shell")).toHaveAttribute(
      "data-hydrated",
      "true",
    );
    await page.locator("input[webkitdirectory]").setInputFiles(libraryRoot);
    await page.getByRole("button", { name: "کتابخانه", exact: true }).click();
    const tree = page.getByRole("tree", { name: "کاوشگر فایل‌های محلی" });
    await tree.getByRole("treeitem", { name: "مطالعه" }).click();
    await tree.getByRole("treeitem", { name: "مقاله.md" }).click();

    await expect(page.locator(".reading-local-note")).toContainText(
      "فقط مطالعه · خارج از مخزن",
    );
    await expect(
      page.getByRole("button", { name: "انتقال فایل به مخزن" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "بازگشت به میز", exact: true }).click();
    await page
      .locator("#markdown-editor .cm-content")
      .fill("# مقالهٔ ویرایش‌شده\n\nاین تغییر باید Vault را فعال کند.");
    await expect(page.locator(".toast")).toContainText(
      "با اولین تغییر، نسخه‌ای امن در مخزن ساخته شد",
    );

    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<string>((resolve, reject) => {
              const request = indexedDB.open("raavi-local-documents", 1);
              request.addEventListener("error", () => reject(request.error));
              request.addEventListener("success", () => {
                const db = request.result;
                const transaction = db.transaction("documents", "readonly");
                const recordRequest = transaction
                  .objectStore("documents")
                  .get("active");
                recordRequest.addEventListener("error", () =>
                  reject(recordRequest.error),
                );
                recordRequest.addEventListener("success", () => {
                  resolve(recordRequest.result?.snapshot?.residency ?? "");
                  db.close();
                });
              });
            }),
        ),
      )
      .toBe("vault-local");
  } finally {
    await rm(fixtureBase, { recursive: true, force: true });
  }
});
