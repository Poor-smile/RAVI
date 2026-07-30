import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALL_COMMAND_IDS,
  ariaShortcut,
  commandById,
  CommandEnvironment,
  CommandId,
} from "../app/keyboard/command-registry";
import {
  KeyboardEventLike,
  registryConflicts,
  resolveCommand,
} from "../app/keyboard/command-resolver";

const windowsWeb: CommandEnvironment = {
  platform: "windows",
  surface: "web",
};
const windowsElectron: CommandEnvironment = {
  platform: "windows",
  surface: "electron",
};
const macWeb: CommandEnvironment = {
  platform: "mac",
  surface: "web",
};

function keyboardEvent(
  code: string,
  overrides: Partial<KeyboardEventLike> & { key?: string } = {},
) {
  return {
    code,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    isComposing: false,
    defaultPrevented: false,
    ...overrides,
  } satisfies KeyboardEventLike & { key?: string };
}

function resolveOnly(
  id: CommandId,
  event: ReturnType<typeof keyboardEvent>,
  environment: CommandEnvironment = windowsWeb,
  editableKind: Parameters<typeof resolveCommand>[2]["editableKind"] = null,
) {
  return resolveCommand(event, environment, {
    editableKind,
    enabledCommandIds: new Set([id]),
  })?.command.id;
}

test.describe("command resolver", () => {
  test("resolves the same physical shortcut on Persian and English layouts", () => {
    const english = keyboardEvent("KeyS", {
      key: "s",
      ctrlKey: true,
    });
    const persian = keyboardEvent("KeyS", {
      key: "س",
      ctrlKey: true,
    });

    expect(resolveOnly("file.save", english)).toBe("file.save");
    expect(resolveOnly("file.save", persian)).toBe("file.save");
  });

  test("requires exact modifiers and ignores IME composition", () => {
    expect(
      resolveOnly(
        "file.save",
        keyboardEvent("KeyS", { ctrlKey: true, altKey: true }),
      ),
    ).toBeUndefined();
    expect(
      resolveOnly(
        "file.save",
        keyboardEvent("KeyS", { ctrlKey: true, isComposing: true }),
      ),
    ).toBeUndefined();
  });

  test("honors each editable allowlist", () => {
    const save = keyboardEvent("KeyS", { ctrlKey: true });
    expect(resolveOnly("file.save", save, windowsWeb, "editor")).toBe(
      "file.save",
    );
    expect(resolveOnly("file.save", save, windowsWeb, "annotationBody")).toBe(
      "file.save",
    );
    expect(
      resolveOnly("file.save", save, windowsWeb, "composer"),
    ).toBeUndefined();
    expect(
      resolveOnly(
        "help.shortcuts",
        keyboardEvent("Slash", { ctrlKey: true, key: "ش" }),
        windowsWeb,
        "librarySearch",
      ),
    ).toBe("help.shortcuts");
  });

  test("blocks repeats except for reader size commands", () => {
    expect(
      resolveOnly(
        "file.save",
        keyboardEvent("KeyS", { ctrlKey: true, repeat: true }),
      ),
    ).toBeUndefined();
    expect(
      resolveOnly(
        "view.text.increase",
        keyboardEvent("BracketRight", { altKey: true, repeat: true }),
      ),
    ).toBe("view.text.increase");
  });

  test("keeps browser-owned shortcuts in the browser", () => {
    expect(
      resolveOnly(
        "file.new",
        keyboardEvent("KeyN", { ctrlKey: true }),
        windowsWeb,
        "editor",
      ),
    ).toBeUndefined();
    expect(
      resolveOnly("help.shortcuts", keyboardEvent("F1"), windowsWeb),
    ).toBeUndefined();
    expect(
      resolveOnly(
        "file.new",
        keyboardEvent("KeyN", { ctrlKey: true }),
        windowsElectron,
        "editor",
      ),
    ).toBe("file.new");
    expect(
      resolveOnly("help.shortcuts", keyboardEvent("F1"), windowsElectron),
    ).toBe("help.shortcuts");
  });

  test("uses Command on macOS and omits unsafe annotation bindings", () => {
    expect(
      resolveOnly(
        "file.save",
        keyboardEvent("KeyS", { metaKey: true }),
        macWeb,
      ),
    ).toBe("file.save");
    expect(
      resolveOnly(
        "annotation.comment",
        keyboardEvent("KeyM", { ctrlKey: true, altKey: true }),
        macWeb,
      ),
    ).toBeUndefined();
    expect(
      ariaShortcut(commandById("file.save").bindings[0], "mac"),
    ).toBe("Meta+S");
  });

  test("registry has no active binding conflicts", () => {
    expect(registryConflicts(windowsWeb)).toEqual([]);
    expect(registryConflicts(windowsElectron)).toEqual([]);
    expect(registryConflicts(macWeb)).toEqual([]);
    expect(new Set(ALL_COMMAND_IDS).size).toBe(ALL_COMMAND_IDS.length);
  });
});

test.describe("Electron keyboard integration", () => {
  test.skip(process.platform !== "win32", "The packaged desktop target is Windows.");

  test("runs Persian and English shortcuts and preserves modal focus", async () => {
    test.slow();
    test.setTimeout(60_000);
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "raavi-playwright-"),
    );
    const app = await electron.launch({
      cwd: projectRoot,
      args: [
        path.join(projectRoot, "desktop", "main.mjs"),
        `--user-data-dir=${userDataPath}`,
      ],
      timeout: 20_000,
    });

    try {
      const window = await app.firstWindow();
      const editor = window.locator("#markdown-editor");
      await expect(editor).toBeVisible();
      const topbar = window.locator(".topbar");
      await expect(
        topbar.getByRole("button", { name: "ذخیره فایل", exact: true }),
      ).toHaveCount(0);
      await expect(
        topbar.getByRole("button", { name: "میان‌برها", exact: true }),
      ).toHaveCount(0);

      const previewScroll = window.locator(".preview-scroll");
      const scrollSyncToggle = window.locator(".scroll-sync-toggle");
      await expect(scrollSyncToggle).toHaveAttribute(
        "aria-label",
        "باز کردن قفل اسکرول هماهنگ",
      );
      await expect(scrollSyncToggle).toHaveAttribute("aria-pressed", "true");

      const editorScrollRange = await editor.evaluate(
        (node: HTMLTextAreaElement) => node.scrollHeight - node.clientHeight,
      );
      const previewScrollRange = await previewScroll.evaluate(
        (node: HTMLDivElement) => node.scrollHeight - node.clientHeight,
      );
      expect(editorScrollRange).toBeGreaterThan(0);
      expect(previewScrollRange).toBeGreaterThan(0);

      await editor.evaluate((node: HTMLTextAreaElement) => {
        node.scrollTop = (node.scrollHeight - node.clientHeight) * 0.7;
        node.dispatchEvent(new Event("scroll"));
      });
      await expect
        .poll(() =>
          previewScroll.evaluate((node: HTMLDivElement) => {
            const range = node.scrollHeight - node.clientHeight;
            return range > 0 ? node.scrollTop / range : 0;
          }),
        )
        .toBeCloseTo(0.7, 1);

      await previewScroll.evaluate((node: HTMLDivElement) => {
        node.scrollTop = (node.scrollHeight - node.clientHeight) * 0.25;
        node.dispatchEvent(new Event("scroll"));
      });
      await expect
        .poll(() =>
          editor.evaluate((node: HTMLTextAreaElement) => {
            const range = node.scrollHeight - node.clientHeight;
            return range > 0 ? node.scrollTop / range : 0;
          }),
        )
        .toBeCloseTo(0.25, 1);

      await scrollSyncToggle.click();
      await expect(scrollSyncToggle).toHaveAttribute("aria-pressed", "false");
      await expect(scrollSyncToggle).toHaveAttribute(
        "aria-label",
        "قفل کردن اسکرول ادیتور و پیش‌نمایش",
      );
      const editorScrollBeforeUnlockedPreview = await editor.evaluate(
        (node: HTMLTextAreaElement) => node.scrollTop,
      );
      await previewScroll.evaluate(
        (node: HTMLDivElement) =>
          new Promise<void>((resolve) => {
            node.scrollTop = (node.scrollHeight - node.clientHeight) * 0.8;
            node.dispatchEvent(new Event("scroll"));
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );
      const editorScrollAfterUnlockedPreview = await editor.evaluate(
        (node: HTMLTextAreaElement) => node.scrollTop,
      );
      expect(
        Math.abs(
          editorScrollAfterUnlockedPreview - editorScrollBeforeUnlockedPreview,
        ),
      ).toBeLessThan(1);
      await scrollSyncToggle.click();

      const readingModeButton = topbar.getByRole("button", {
        name: /حالت مطالعه/,
      });
      await readingModeButton.click();

      const readingOutline = window.getByRole("complementary", {
        name: "فهرست فصل‌های سند",
        exact: true,
      });
      await expect(readingOutline).toBeVisible();
      await expect(
        readingOutline.getByRole("button", {
          name: "راهنمای راوی",
          exact: true,
        }),
      ).toBeVisible();

      const secondChapter = readingOutline.getByRole("button", {
        name: "از کجا شروع کنم؟",
        exact: true,
      });
      await secondChapter.click();
      await expect(secondChapter).toHaveAttribute("aria-current", "location");

      const readingOutlineToggle = readingOutline.locator(
        ".reading-outline-toggle",
      );
      await expect(readingOutlineToggle).toHaveAttribute(
        "aria-label",
        "جمع‌کردن فهرست فصل‌ها",
      );
      await readingOutlineToggle.click();
      await expect(readingOutline).toHaveClass(/is-collapsed/);
      await expect(readingOutlineToggle).toHaveAttribute(
        "aria-label",
        "بازکردن فهرست فصل‌ها",
      );
      await expect(secondChapter).toBeHidden();

      await readingOutlineToggle.click();
      await expect(readingOutline).toHaveClass(/is-open/);
      await expect(secondChapter).toBeVisible();
      await topbar.getByRole("button", { name: /بازگشت به میز/ }).click();

      const dispatchShortcut = async ({
        code,
        key,
        ctrlKey = false,
        altKey = false,
        shiftKey = false,
      }: {
        code: string;
        key: string;
        ctrlKey?: boolean;
        altKey?: boolean;
        shiftKey?: boolean;
      }) =>
        window.evaluate(
          (eventInit) => {
            const event = new KeyboardEvent("keydown", {
              ...eventInit,
              bubbles: true,
              cancelable: true,
            });
            const target = document.activeElement ?? document.body;
            const notCanceled = target.dispatchEvent(event);
            return {
              defaultPrevented: event.defaultPrevented,
              notCanceled,
            };
          },
          { code, key, ctrlKey, altKey, shiftKey },
        );

      const sidebar = window.locator("#library-panel");
      const historyTab = sidebar.getByRole("tab", {
        name: /تاریخچه/,
      });
      const libraryTab = sidebar.getByRole("tab", {
        name: /کتابخانه/,
      });
      const addFolderButton = sidebar.getByRole("button", {
        name: "افزودن پوشه به کتابخانه",
        exact: true,
      });
      await expect(historyTab).toBeVisible();
      await expect(libraryTab).toHaveAttribute("aria-selected", "true");
      await expect(addFolderButton).toBeVisible();
      await expect(addFolderButton).toHaveText("");

      await historyTab.click();
      await expect(historyTab).toHaveAttribute("aria-selected", "true");
      await expect(window.locator("#library-history-panel")).toBeVisible();
      await expect(addFolderButton).toBeHidden();

      await historyTab.press("ArrowLeft");
      await expect(libraryTab).toHaveAttribute("aria-selected", "true");
      await expect(addFolderButton).toBeVisible();

      const collapseSidebar = sidebar.getByRole("button", {
        name: "جمع‌کردن سایدبار",
        exact: true,
      });
      await collapseSidebar.click();
      await expect(sidebar).toBeHidden();
      const reopenSidebar = topbar.locator(".mobile-library-trigger");
      await expect(reopenSidebar).toBeVisible();
      await expect(reopenSidebar).toHaveAttribute("aria-label", "کتابخانه");
      await reopenSidebar.click();
      await expect(sidebar).toBeVisible();

      await historyTab.click();
      await editor.fill("نمونه");
      await editor.evaluate((node: HTMLTextAreaElement) =>
        node.setSelectionRange(0, node.value.length),
      );
      expect(
        await dispatchShortcut({
          code: "KeyB",
          key: "ذ",
          ctrlKey: true,
        }),
      ).toEqual({ defaultPrevented: true, notCanceled: false });
      await expect(editor).toHaveValue("**نمونه**");

      await editor.fill("sample");
      await editor.evaluate((node: HTMLTextAreaElement) =>
        node.setSelectionRange(0, node.value.length),
      );
      await dispatchShortcut({ code: "KeyB", key: "b", ctrlKey: true });
      await expect(editor).toHaveValue("**sample**");

      await dispatchShortcut({ code: "Digit3", key: "۳", altKey: true });
      const librarySearch = window.locator(
        '[data-editable-kind="librarySearch"]',
      );
      await expect(libraryTab).toHaveAttribute("aria-selected", "true");
      await expect(librarySearch).toBeFocused();

      const browserOwned = await dispatchShortcut({
        code: "KeyK",
        key: "ن",
        ctrlKey: true,
      });
      expect(browserOwned.defaultPrevented).toBe(false);

      await editor.focus();
      await dispatchShortcut({
        code: "KeyS",
        key: "س",
        ctrlKey: true,
        shiftKey: true,
      });
      const saveName = window.locator('[data-editable-kind="saveName"]').first();
      await expect(saveName).toBeFocused();

      await dispatchShortcut({ code: "Slash", key: "ش", ctrlKey: true });
      const shortcutTitle = window.locator("#shortcut-modal-title");
      await expect(shortcutTitle).toBeVisible();
      await expect(shortcutTitle).toBeFocused();
      await expect(window.locator(".topbar")).toHaveAttribute("inert", "");

      await dispatchShortcut({ code: "Escape", key: "Escape" });
      await expect(shortcutTitle).toBeHidden();
      await expect(saveName).toBeFocused();

      await dispatchShortcut({ code: "Escape", key: "Escape" });
      await expect(window.locator(".save-modal")).toBeHidden();
      await expect(editor).toBeFocused();

      await editor.focus();
      await dispatchShortcut({ code: "F1", key: "F1" });
      await expect(shortcutTitle).toBeVisible();
      await dispatchShortcut({ code: "Escape", key: "Escape" });
      await expect(editor).toBeFocused();

      await dispatchShortcut({ code: "F9", key: "F9" });
      await expect(window.locator(".app-shell")).toHaveClass(/is-reading/);
      await dispatchShortcut({ code: "Escape", key: "Escape" });
      await expect(window.locator(".app-shell")).not.toHaveClass(/is-reading/);
    } finally {
      await app.close();
      await rm(userDataPath, { recursive: true, force: true });
    }
  });
});
