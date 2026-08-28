import { expect, type Locator } from "@playwright/test";

export async function activatePointerAction(locator: Locator) {
  await locator.dispatchEvent("pointerdown", {
    pointerType: "mouse",
    button: 0,
    isPrimary: true,
  });
}

export async function scrollIntoViewStable(locator: Locator) {
  await expect(async () => {
    await locator.scrollIntoViewIfNeeded();
    await expect(locator).toBeAttached();
  }).toPass();
}
