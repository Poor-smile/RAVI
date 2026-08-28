import { expect, test } from "@playwright/test";

async function openCliInstallStep(page: import("@playwright/test").Page) {
  await page.goto("/?onboarding=1&onboardingChatGPT=cli_missing");
  const vaultDialog = page.getByRole("dialog", {
    name: "پوشهٔ مخزن را انتخاب کنید",
  });
  await expect(vaultDialog).toBeVisible();
  await vaultDialog.getByRole("button", { name: "رد کردن", exact: true }).click();
  const chatGPTDialog = page.getByRole("dialog", {
    name: "راوی را به ChatGPT متصل کنید",
  });
  await expect(chatGPTDialog).toBeVisible();
  return chatGPTDialog;
}

test("First Run keeps CLI setup lightweight and uses Material Symbol actions", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const dialog = await openCliInstallStep(page);
  const installBox = dialog.locator(".first-run-cli-install-box");

  await expect(installBox).toContainText("npm install -g @openai/codex@latest");
  await expect(dialog.getByRole("button", { name: "بررسی دوباره" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "کپی فرمان نصب CLI" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "راهنمای نصب" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "نصب CLI در PowerShell" })).toBeVisible();

  await expect(dialog.locator('[data-material-symbol="refresh"]')).toHaveCount(1);
  await expect(dialog.locator('[data-material-symbol="content_copy"]')).toHaveCount(1);
  await expect(dialog.locator('[data-material-symbol="info"]')).toHaveCount(1);
  await expect(dialog.locator('[data-material-symbol="keyboard_return"]')).toHaveCount(1);

  const surfaceColor = await dialog
    .locator(".first-run-action-row.is-cli_missing")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(surfaceColor).not.toBe("rgb(255, 245, 243)");
});

test("First Run CLI actions stay touch-safe without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 760, height: 900 });
  const dialog = await openCliInstallStep(page);

  const geometry = await dialog.evaluate((element) => {
    const installBox = element.querySelector<HTMLElement>(
      ".first-run-cli-install-box",
    )!;
    const controls = Array.from(
      element.querySelectorAll<HTMLElement>(
        ".first-run-cli-install-controls button, .first-run-status-refresh",
      ),
    );
    return {
      dialogOverflow: element.scrollWidth - element.clientWidth,
      codeOverflow: installBox.scrollWidth - installBox.clientWidth,
      controlHeights: controls.map((control) =>
        Math.round(control.getBoundingClientRect().height),
      ),
    };
  });

  expect(geometry.dialogOverflow).toBeLessThanOrEqual(0);
  expect(geometry.codeOverflow).toBeLessThanOrEqual(0);
  expect(geometry.controlHeights.every((height) => height >= 44)).toBe(true);
});
