import { expect, test } from "@playwright/test";
import { openWritingDocument } from "./helpers/open-writing-document";

const CONTEXT_MARKDOWN = [
  "# راهنمای راوی",
  "",
  "## از کجا شروع کنم؟",
  "",
  "این بند برای سنجش پیوستگی موقعیت سند است.",
  "",
  "### رفتار درست متن فنی",
  "",
  "متن فنی باید جهت طبیعی خود را حفظ کند.",
].join("\n");

async function openContextDocument(page: import("@playwright/test").Page) {
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute("data-hydrated", "true");
  await openWritingDocument(page);
  const editor = page.locator("#markdown-editor .cm-content");
  await page.getByRole("button", { name: "متن خام", exact: true }).click();
  await editor.fill(CONTEXT_MARKDOWN);
  await page.getByRole("button", { name: "ویرایش روان", exact: true }).click();
  return editor;
}

test("outline targets the active surface and Reading preserves the semantic block", async ({
  page,
}) => {
  await openContextDocument(page);

  const outlineRailButton = page
    .locator(".sidebar-rail")
    .getByRole("button", { name: "فهرست سند", exact: true });
  const sidebarTitle = page.locator("#sidebar-pane-title");
  await expect(outlineRailButton).toBeVisible();
  await expect
    .poll(async () => {
      if ((await sidebarTitle.textContent())?.trim() !== "فهرست سند") {
        await outlineRailButton.click();
      }
      return (await sidebarTitle.textContent())?.trim();
    })
    .toBe("فهرست سند");
  const outline = page.getByRole("complementary", {
    name: "فهرست سند",
    exact: true,
  });
  const secondHeading = outline.getByRole("button", {
    name: /^از کجا شروع کنم؟/,
  });
  await secondHeading.click();
  await expect(page.locator(".cm-activeLine")).toContainText("از کجا شروع کنم؟");

  await page.getByRole("button", { name: "خواندن", exact: true }).click();
  const readingHeading = page.getByRole("heading", {
    name: "از کجا شروع کنم؟",
    exact: true,
  });
  await expect(readingHeading).toBeVisible();
  await expect
    .poll(async () => (await readingHeading.boundingBox())?.y ?? -1)
    .toBeGreaterThan(60);
  await expect
    .poll(async () => (await readingHeading.boundingBox())?.y ?? 10_000)
    .toBeLessThan(560);

  await page
    .locator(".sidebar-rail")
    .getByRole("button", { name: "فهرست سند", exact: true })
    .click();
  await expect(outline).toBeVisible();

  const thirdHeading = outline.getByRole("button", {
    name: /^رفتار درست متن فنی/,
  });
  await thirdHeading.click();
  await expect(thirdHeading).toHaveAttribute("aria-current", "location");
  await expect(
    page.getByRole("heading", { name: "رفتار درست متن فنی", exact: true }),
  ).toBeFocused();

  await page.getByRole("button", { name: "بازگشت به میز", exact: true }).click();
  await expect(page.locator(".workspace")).not.toHaveClass(/workspace--reading/);
  await expect(page.locator(".cm-activeLine")).toContainText(
    "رفتار درست متن فنی",
  );
});

// Mobile editor contract retired; device access is covered in desktop-access.spec.ts.

test("annotation deletion is reversible without moving the reading position", async ({
  page,
}) => {
  await openContextDocument(page);
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await page.getByRole("button", { name: "خواندن", exact: true }).click();
  await expect(page.locator(".app-shell")).toHaveClass(/is-reading/u);
  const target = page.locator(".markdown-body p").first();
  await target.selectText();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  await target.dispatchEvent("mouseup", {
    clientX: box!.x + box!.width * 0.5,
    clientY: box!.y + box!.height * 0.5,
  });
  await page
    .getByRole("toolbar", { name: "ابزار متن انتخاب‌شده" })
    .getByRole("button", { name: /هایلایت/ })
    .click();

  const cards = page
    .getByRole("list", { name: "هایلایت‌های همین سند" })
    .getByRole("listitem");
  await expect(cards).toHaveCount(1);
  const beforeScroll = await page.locator(".preview-scroll").evaluate((node) =>
    (node as HTMLElement).scrollTop,
  );
  await cards.getByRole("button", { name: /رفتن به هایلایت/ }).focus();
  await page.keyboard.press("Delete");
  await expect(cards).toHaveCount(0);
  const undoNotice = page.locator(".annotation-undo-notice");
  await expect(undoNotice).toContainText("هایلایت حذف شد");
  await undoNotice.getByRole("button", { name: "واگرد", exact: true }).click();
  await expect(cards).toHaveCount(1);
  await expect(cards.getByRole("button", { name: /رفتن به هایلایت/ })).toBeFocused();
  const afterScroll = await page.locator(".preview-scroll").evaluate((node) =>
    (node as HTMLElement).scrollTop,
  );
  expect(Math.abs(afterScroll - beforeScroll)).toBeLessThanOrEqual(2);
});
