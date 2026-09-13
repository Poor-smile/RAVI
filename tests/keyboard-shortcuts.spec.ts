import { releaseElectron as electron } from "./helpers/release-electron";
import { expect, test, type Page } from "@playwright/test";

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ALL_COMMAND_IDS,
  ariaShortcut,
  commandById,
  CommandEnvironment,
  CommandId,
  formatBinding,
} from "../app/keyboard/command-registry";
import {
  SHORTCUT_GUIDE_SECTIONS,
  shortcutPlatformLabel,
} from "../app/keyboard/shortcut-guide";
import {
  KeyboardEventLike,
  registryConflicts,
  resolveCommand,
} from "../app/keyboard/command-resolver";
import { mermaidRenderKey } from "../app/mermaid/renderer";
import { MERMAID_SAMPLES } from "../app/mermaid/samples";
import packageMetadata from "../package.json" with { type: "json" };
import { waitForRaaviWindow } from "./helpers/electron-main-window";
import { activatePointerAction } from "./helpers/pointer-action";

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

async function startElectronWritingDraft(window: Page) {
  await expect(window.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await window
    .locator('input[type="file"][accept*=".md"]')
    .first()
    .setInputFiles({
      name: "سند جدید.md",
      mimeType: "text/markdown",
      buffer: Buffer.from("# سند جدید\n\nمتن آغازین", "utf8"),
    });
  const backToDesk = window.getByRole("button", { name: /بازگشت به میز/ });
  const liveMode = window.getByRole("button", {
    name: "ویرایش روان",
    exact: true,
  });
  await expect
    .poll(async () =>
      (await backToDesk.isVisible()) || (await liveMode.isVisible()),
    )
    .toBe(true);
  if (await backToDesk.isVisible()) await backToDesk.click();
  await expect(liveMode).toBeVisible({ timeout: 45_000 });
  if ((await liveMode.getAttribute("aria-pressed")) !== "true") {
    await liveMode.click();
  }
  await expect(window.locator('[data-workspace-screen="writing"]')).toBeVisible();
}

async function waitForPersistedDocumentText(window: Page, expected: string) {
  await expect
    .poll(() =>
      window.evaluate(async (needle) => {
        const desktop = (
          globalThis as typeof globalThis & {
            raaviDesktop?: {
              getLocalDocumentSnapshot: () => Promise<{
                content?: string;
              } | null>;
            };
          }
        ).raaviDesktop;
        const snapshot = await desktop?.getLocalDocumentSnapshot();
        return snapshot?.content?.includes(needle) ?? false;
      }, expected),
    )
    .toBe(true);
}

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
  test("documents structural shortcuts for Windows/Linux and macOS from one model", () => {
    const blockSection = SHORTCUT_GUIDE_SECTIONS.find(
      (section) => section.id === "blocks",
    );
    const insertAfter = blockSection?.items.find(
      (item) => item.id === "block-insert-after",
    );
    const duplicate = blockSection?.items.find(
      (item) => item.id === "block-duplicate",
    );
    const listItemReorder = blockSection?.items.find(
      (item) => item.id === "list-item-reorder",
    );
    expect(insertAfter).toBeDefined();
    expect(duplicate).toBeDefined();
    expect(listItemReorder).toBeDefined();
    expect(listItemReorder?.keys).toHaveLength(2);
    expect(listItemReorder?.context).toContain("List Block");
    expect(formatBinding(insertAfter!.keys[0].binding, "windows")).toBe(
      "Ctrl+Enter",
    );
    expect(formatBinding(insertAfter!.keys[0].binding, "linux")).toBe(
      "Ctrl+Enter",
    );
    expect(formatBinding(insertAfter!.keys[0].binding, "mac")).toBe(
      "⌘+Enter",
    );
    expect(formatBinding(duplicate!.keys[0].binding, "mac")).toBe("⌘+D");
    expect(shortcutPlatformLabel(windowsWeb)).toBe("Windows / Linux");
    expect(shortcutPlatformLabel(macWeb)).toBe("macOS");
  });

  test("marks Mod+K as contextual in both command definitions", () => {
    expect(commandById("edit.link").contextLabel).toContain("انتخاب متن");
    expect(commandById("view.commandPalette").contextLabel).toContain(
      "بدون انتخاب",
    );
  });

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

  test("routes Mod+K by editor selection without a registry conflict", () => {
    const shortcut = keyboardEvent("KeyK", { ctrlKey: true });
    const enabledCommandIds = new Set<CommandId>([
      "edit.link",
      "view.commandPalette",
    ]);
    expect(
      resolveCommand(shortcut, windowsWeb, {
        editableKind: "editor",
        enabledCommandIds,
        hasEditorSelection: true,
      })?.command.id,
    ).toBe("edit.link");
    expect(
      resolveCommand(shortcut, windowsWeb, {
        editableKind: "editor",
        enabledCommandIds,
        hasEditorSelection: false,
      })?.command.id,
    ).toBe("view.commandPalette");
  });

  test("routes Alt+F10 to the selection toolbar only with an editor selection", () => {
    const shortcut = keyboardEvent("F10", { altKey: true });
    const enabledCommandIds = new Set<CommandId>(["focus.selectionToolbar"]);
    expect(
      resolveCommand(shortcut, windowsWeb, {
        editableKind: "editor",
        enabledCommandIds,
        hasEditorSelection: true,
      })?.command.id,
    ).toBe("focus.selectionToolbar");
    expect(
      resolveCommand(shortcut, windowsWeb, {
        editableKind: "editor",
        enabledCommandIds,
        hasEditorSelection: false,
      }),
    ).toBeNull();
  });

  test("toggles the theme from the same physical key in Persian and English", () => {
    expect(
      resolveOnly(
        "view.theme",
        keyboardEvent("KeyT", { key: "t", altKey: true }),
      ),
    ).toBe("view.theme");
    expect(
      resolveOnly(
        "view.theme",
        keyboardEvent("KeyT", { key: "ف", altKey: true }),
      ),
    ).toBe("view.theme");
  });

  test("opens Mermaid Studio from Persian and English keyboard layouts", () => {
    expect(
      resolveOnly(
        "diagram.mermaid",
        keyboardEvent("KeyM", { key: "m", altKey: true }),
        windowsWeb,
        "editor",
      ),
    ).toBe("diagram.mermaid");
    expect(
      resolveOnly(
        "diagram.mermaid",
        keyboardEvent("KeyM", { key: "ئ", altKey: true }),
        windowsWeb,
        "editor",
      ),
    ).toBe("diagram.mermaid");
  });

  test("opens image insertion from Persian and English keyboard layouts", () => {
    expect(
      resolveOnly(
        "edit.image",
        keyboardEvent("KeyI", { key: "i", altKey: true }),
        windowsWeb,
        "editor",
      ),
    ).toBe("edit.image");
    expect(
      resolveOnly(
        "edit.image",
        keyboardEvent("KeyI", { key: "ه", altKey: true }),
        windowsWeb,
        "editor",
      ),
    ).toBe("edit.image");
  });

  test("routes the new editor shortcuts by physical key", () => {
    expect(
      resolveOnly(
        "edit.find",
        keyboardEvent("KeyF", { key: "ب", ctrlKey: true }),
        windowsWeb,
        "editor",
      ),
    ).toBe("edit.find");
    expect(
      resolveOnly(
        "edit.replace",
        keyboardEvent("KeyH", { key: "ا", ctrlKey: true }),
        windowsWeb,
        "editor",
      ),
    ).toBe("edit.replace");
    expect(
      resolveOnly(
        "edit.replace",
        keyboardEvent("KeyF", { key: "f", metaKey: true, altKey: true }),
        { platform: "mac", surface: "web" },
        "editor",
      ),
    ).toBe("edit.replace");
    expect(
      resolveOnly(
        "edit.undo",
        keyboardEvent("KeyZ", { key: "ظ", ctrlKey: true }),
        windowsWeb,
        "editor",
      ),
    ).toBe("edit.undo");
    expect(
      resolveOnly(
        "edit.redo",
        keyboardEvent("KeyZ", { key: "ظ", ctrlKey: true, shiftKey: true }),
        windowsWeb,
        "editor",
      ),
    ).toBe("edit.redo");
    expect(
      resolveOnly(
        "edit.selectAll",
        keyboardEvent("KeyA", { key: "ش", ctrlKey: true }),
        windowsWeb,
        "editor",
      ),
    ).toBe("edit.selectAll");
    expect(
      resolveOnly(
        "edit.findPrevious",
        keyboardEvent("F3", { shiftKey: true }),
        windowsWeb,
        "editor",
      ),
    ).toBe("edit.findPrevious");
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
    ).toBe("file.save");
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

const expectedMermaidLabels: Record<string, string[]> = {
  flowchart: ["شروع", "نیاز به بازبینی؟", "ویرایش سند", "انتشار"],
  sequence: ["کاربر", "راوی", "فایل را باز کن"],
  class: ["سند", "نمودار", "ذخیره"],
  state: ["پیش_نویس", "بازبینی", "منتشر_شده"],
  er: ["DOCUMENT", "DIAGRAM", "contains"],
  requirement: ["readability", "متن و نمودار خوانا باشند", "preview"],
  architecture: ["راوی", "ویرایشگر", "پیش نمایش"],
  c4: ["زمینه سامانه راوی", "خواننده", "راوی"],
  gantt: ["برنامه انتشار", "نمونه اولیه", "پیاده سازی"],
  timeline: ["مسیر سند", "پیش نویس", "انتشار"],
  kanban: ["برای انجام", "طراحی نمودار", "انجام شده"],
  gitgraph: ["شروع", "نمودار", "انتشار"],
  pie: ["زمان مطالعه", "مطالعه", "یادداشت"],
  xychart: ["رشد نسخه ها", "تغییرات"],
  sankey: ["ورودی", "مطالعه", "انتشار"],
  mindmap: ["راوی", "مطالعه", "Markdown"],
  journey: ["ساخت یک سند", "باز کردن فایل", "ذخیره نسخه"],
  quadrant: ["اولویت قابلیت ها", "جستجو", "نمودار"],
};

test.describe("Electron Mermaid parity", () => {
  test.skip(process.platform !== "win32", "The packaged desktop target is Windows.");

  test("renders every Studio sample in the document", async () => {
    test.slow();
    test.setTimeout(240_000);
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "raavi-mermaid-playwright-"),
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
      expect(await app.evaluate(({ app }) => app.getPath("userData"))).toBe(userDataPath);
      const window = await waitForRaaviWindow(app);
      await startElectronWritingDraft(window);
      const editor = window.locator("#markdown-editor:visible");
      const editorContent = editor.locator(".cm-content");
      const openStudio = async () => {
        await editorContent.focus();
        await window.keyboard.press("Control+K");
        const palette = window.getByRole("dialog", {
          name: "مرکز فرمان راوی",
          exact: true,
        });
        const query = palette.getByRole("combobox", {
          name: "جست‌وجوی فرمان",
        });
        await query.fill("ساخت نمودار Mermaid");
        await expect(
          palette.getByRole("option", { name: /ساخت نمودار Mermaid/ }),
        ).toBeVisible();
        await window.keyboard.press("Enter");
      };
      await expect(editor).toBeVisible();
      const theme = ((await window
        .locator("html")
        .getAttribute("data-theme")) || "light") as "light" | "dark";

      for (const sample of MERMAID_SAMPLES) {
        await editorContent.fill("");
        await editorContent.focus();
        await openStudio();

        const studio = window.getByRole("dialog", {
          name: "استودیو گراف",
          exact: true,
        });
        await expect(studio).toBeVisible();
        await studio.getByRole("listbox", { name: "نوع نمودار" }).getByRole("option").first().click();
        await studio
          .getByRole("button", { name: "کد پیشرفته", exact: true })
          .click();
        await studio
          .getByRole("button", { name: "نمونه‌ها", exact: true })
          .click();
        const sampleLibrary = studio.locator("#mermaid-sample-library");
        const sampleButton = sampleLibrary
          .getByRole("button")
          .filter({ hasText: sample.title });
        await expect(sampleButton).toHaveCount(1);
        await sampleButton.click();

        const expectedKey = mermaidRenderKey(sample.code, theme);
        const studioSurface = studio.locator(".mermaid-render-surface");
        await expect(studioSurface).toHaveAttribute(
          "data-mermaid-render-key",
          expectedKey,
          { timeout: 20_000 },
        );

        if (sample.id === MERMAID_SAMPLES[0]?.id) {
          const studioCanvas = studio.locator(".mermaid-studio-canvas");
          const canvasBox = await studioCanvas.boundingBox();
          expect(canvasBox).not.toBeNull();
          const initialTransform = await studioSurface.evaluate(
            (surface) => (surface as HTMLElement).style.transform,
          );
          await window.mouse.move(
            canvasBox!.x + canvasBox!.width / 2,
            canvasBox!.y + canvasBox!.height / 2,
          );
          await window.mouse.down();
          await window.mouse.move(
            canvasBox!.x + canvasBox!.width / 2 + 72,
            canvasBox!.y + canvasBox!.height / 2 + 44,
            { steps: 5 },
          );
          await window.mouse.up();
          await expect
            .poll(() =>
              studioSurface.evaluate(
                (surface) => (surface as HTMLElement).style.transform,
              ),
            )
            .not.toBe(initialTransform);

          await studio
            .getByRole("button", { name: "بزرگ‌نمایی", exact: true })
            .click();
          await expect(studio.locator(".mermaid-preview-tools output")).not.toHaveText(
            "۱۰۰٪",
          );
          await studio
            .getByRole("button", {
              name: "جا دادن کامل نمودار در نما",
              exact: true,
            })
            .click();
          await expect
            .poll(() =>
              studioSurface.evaluate(
                (surface) => (surface as HTMLElement).style.transform,
              ),
            )
            .toContain("scale(1)");
        }

        const studioRender = await studioSurface.evaluate(async (surface) => {
          const svg = await fetch((surface as HTMLImageElement).src).then((response) =>
            response.text(),
          );
          return {
            svg,
            accessibleName: (surface as HTMLImageElement).alt,
            text: new DOMParser()
              .parseFromString(svg, "image/svg+xml")
              .documentElement.textContent ?? "",
          };
        });
        const normalizedStudioText = studioRender.text.replace(/\s+/gu, " ");
        for (const label of expectedMermaidLabels[sample.id] ?? []) {
          expect(
            normalizedStudioText,
            `${sample.id} Studio should show "${label}"`,
          ).toContain(label.replace(/\s+/gu, " "));
        }

        await studio
          .getByRole("button", { name: "افزودن به سند", exact: true })
          .click();
        await editorContent.focus();
        await editorContent.press("Control+End");
        await editorContent.press("Control+Enter");
        const documentSurface = window
          .locator(".cm-rich-mermaid-stage.is-ready .cm-rich-mermaid-svg")
          .last();
        await expect(documentSurface).toBeVisible();
        await expect(documentSurface).toHaveAttribute("alt", /\S/u);
        await expect
          .poll(() =>
            documentSurface.evaluate(
              (surface) => (surface as HTMLImageElement).naturalWidth,
            ),
          )
          .toBeGreaterThan(0);
      }

      await window
        .getByRole("button", { name: "خواندن", exact: true })
        .click();
      const fullscreenButton = window.getByRole("button", {
        name: "نمایش تمام‌صفحهٔ نمودار",
        exact: true,
      });
      await expect(fullscreenButton).toBeVisible();
      await expect(
        window.getByRole("button", {
          name: "ویرایش این نمودار",
          exact: true,
        }),
      ).toHaveCount(0);
      await activatePointerAction(fullscreenButton);
      const detailedDiagram = window.locator(
        ".mermaid-diagram:fullscreen, .mermaid-diagram.is-detail-open",
      );
      await expect(detailedDiagram).toBeVisible();
      const closeFullscreenButton = window.getByRole("button", {
        name: "بازگشت به سند",
        exact: true,
      });
      await expect(closeFullscreenButton).toBeVisible();

      const fullscreenCanvas = detailedDiagram.locator(
        ".mermaid-diagram-canvas",
      );
      const fullscreenSurface = detailedDiagram.locator(
        ".mermaid-render-surface",
      );
      const fullscreenOutput = detailedDiagram.locator(
        ".mermaid-diagram-viewport-tools output",
      );
      const fullscreenToolbar = detailedDiagram.getByRole("toolbar", {
          name: "کنترل نمای نمودار",
          exact: true,
        });
      await expect(fullscreenToolbar).toBeVisible();
      const fullscreenBox = await fullscreenCanvas.boundingBox();
      const toolbarBox = await fullscreenToolbar.boundingBox();
      expect(fullscreenBox).not.toBeNull();
      expect(toolbarBox).not.toBeNull();
      expect(
        Math.abs(toolbarBox!.x - fullscreenBox!.x - 24),
      ).toBeLessThan(2);
      expect(
        Math.abs(toolbarBox!.y - fullscreenBox!.y - 24),
      ).toBeLessThan(2);
      const fullscreenToolSizes = await fullscreenToolbar
        .getByRole("button")
        .evaluateAll((buttons) =>
          buttons.map((button) => {
            const rect = button.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
          }),
        );
      for (const size of fullscreenToolSizes) {
        expect(size.width).toBe(36);
        expect(size.height).toBe(36);
      }
      expect(
        await closeFullscreenButton.evaluate(
          (button) =>
            button.closest(".mermaid-graph-viewer-header") !== null,
        ),
      ).toBe(true);
      await window.mouse.move(
        fullscreenBox!.x + fullscreenBox!.width / 2,
        fullscreenBox!.y + fullscreenBox!.height / 2,
      );
      await window.mouse.wheel(0, -180);
      await expect(fullscreenOutput).not.toHaveText("۱۰۰٪");

      const zoomedTransform = await fullscreenSurface.evaluate(
        (surface) => (surface as HTMLElement).style.transform,
      );
      await window.mouse.down();
      await window.mouse.move(
        fullscreenBox!.x + fullscreenBox!.width / 2 + 86,
        fullscreenBox!.y + fullscreenBox!.height / 2 + 52,
        { steps: 5 },
      );
      await window.mouse.up();
      await expect
        .poll(() =>
          fullscreenSurface.evaluate(
            (surface) => (surface as HTMLElement).style.transform,
          ),
        )
        .not.toBe(zoomedTransform);

      await detailedDiagram
        .getByRole("button", {
          name: "جا دادن کامل نمودار در کادر",
          exact: true,
        })
        .click();
      await expect
        .poll(() =>
          detailedDiagram.evaluate((diagram) => {
            const canvas = diagram.querySelector(
              ".mermaid-diagram-canvas",
            );
            const surface = diagram.querySelector(
              ".mermaid-render-surface",
            );
            if (
              !(canvas instanceof HTMLElement) ||
              !(surface instanceof HTMLElement)
            ) {
              return false;
            }
            const canvasRect = canvas.getBoundingClientRect();
            const surfaceRect = surface.getBoundingClientRect();
            return (
              surfaceRect.left >= canvasRect.left - 1 &&
              surfaceRect.right <= canvasRect.right + 1 &&
              surfaceRect.top >= canvasRect.top - 1 &&
              surfaceRect.bottom <= canvasRect.bottom + 1
            );
          }),
        )
        .toBe(true);
      // Fit writes its transform on the next animation frame.
      await expect.poll(() => fullscreenSurface.evaluate(
        (surface) => (surface as HTMLElement).style.transform,
      )).toMatch(
        /^translate3d\(-?\d+(?:\.\d+)?px, -?\d+(?:\.\d+)?px, 0px\) scale\((?:0?\.\d+|1)\)$/,
      );
      await expect(fullscreenOutput).toHaveAttribute(
        "aria-label",
        /بزرگ‌نمایی \d+ درصد/u,
      );

      await closeFullscreenButton.click();
      await expect(detailedDiagram).toHaveCount(0);
    } finally {
      await app.close();
      await rm(userDataPath, { recursive: true, force: true });
    }
  });
});

test.describe("Electron keyboard integration", () => {
  test.skip(process.platform !== "win32", "The packaged desktop target is Windows.");

  test("opens the platform-aware shortcut help and settings screen", async () => {
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "raavi-shortcuts-playwright-"),
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
      const window = await waitForRaaviWindow(app);
      await expect(window.locator(".app-shell")).toHaveAttribute(
        "data-hydrated",
        "true",
      );
      await window.keyboard.press("F1");
      const shortcutDialog = window.getByRole("dialog", {
        name: "میان‌برهای صفحه‌کلید",
      });
      await expect(shortcutDialog).toBeVisible();
      await expect(
        shortcutDialog.getByText("Enter با Ctrl/Cmd+Enter یکی نیست", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        shortcutDialog.locator('[data-shortcut-guide-id="block-insert-after"]'),
      ).toContainText("Ctrl");
      await expect(
        shortcutDialog.locator('[data-shortcut-guide-id="block-enter"]'),
      ).toContainText("داخل همان بلاک");
      await expect(
        shortcutDialog.locator('[data-shortcut-guide-id="list-soft-break"]'),
      ).toContainText("Shift");
      await expect(
        shortcutDialog.locator('[data-shortcut-guide-id="list-indent"]'),
      ).toContainText("Tab");
      await expect(
        shortcutDialog.locator('[data-shortcut-guide-id="list-item-reorder"]'),
      ).toContainText("Alt+↓");
      await expect(
        shortcutDialog.getByText("با انتخاب متن در ویرایشگر", { exact: true }),
      ).toBeVisible();
      await expect(
        shortcutDialog.getByText("بدون انتخاب متن", { exact: true }),
      ).toBeVisible();

      await shortcutDialog
        .getByRole("button", { name: "تنظیمات میان‌برها", exact: true })
        .click();
      const shortcutSettings = window.getByRole("dialog", {
        name: "میان‌برها",
      });
      await expect(shortcutSettings).toBeVisible();
      await expect(
        shortcutSettings.locator('[data-settings-shortcut-id="block-duplicate"]'),
      ).toContainText("Ctrl");
      await expect(window.locator(".topbar")).toHaveAttribute("inert", "");

      await shortcutSettings
        .getByRole("button", { name: "بازگشت به سند", exact: true })
        .click();
      await expect(shortcutSettings).toBeHidden();
      await expect(window.locator(".topbar")).not.toHaveAttribute("inert", "");
    } finally {
      await app.close();
      await rm(userDataPath, { recursive: true, force: true });
    }
  });

  test("runs Persian and English shortcuts and preserves modal focus", async () => {
    test.slow();
    test.setTimeout(120_000);
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "raavi-playwright-"),
    );
    const libraryFixturePath = path.join(userDataPath, "pin-library");
    const imageFixturePath = path.join(userDataPath, "embedded-image.png");
    await mkdir(libraryFixturePath);
    await Promise.all([
      writeFile(
        path.join(libraryFixturePath, "pinned-reference.md"),
        "# Pinned reference",
        "utf8",
      ),
      writeFile(
        path.join(libraryFixturePath, "ordinary-note.md"),
        "# Ordinary note",
        "utf8",
      ),
      writeFile(
        imageFixturePath,
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9JYxQAAAAASUVORK5CYII=",
          "base64",
        ),
      ),
    ]);
    const app = await electron.launch({
      cwd: projectRoot,
      args: [
        path.join(projectRoot, "desktop", "main.mjs"),
        `--user-data-dir=${userDataPath}`,
      ],
      timeout: 20_000,
    });

    try {
      const window = await waitForRaaviWindow(app);
      await startElectronWritingDraft(window);
      const editor = window.locator("#markdown-editor:visible");
      const editorContent = editor.locator(".cm-content");
      const editorScroller = editor.locator(".cm-scroller");
      await expect(editor).toBeVisible();
      const imageInput = window.locator(
        'input[accept="image/png,image/jpeg,image/webp,image/gif"]',
      );
      await expect(imageInput).toHaveCount(1);
      const openImageHelper = async () => {
        await editorContent.focus();
        await window.keyboard.press("Alt+i");
      };
      await openImageHelper();
      const imageDialog = window.locator(".editor-helper-popover");
      await expect(imageDialog).toBeVisible();
      await expect(
        imageDialog.getByRole("button", { name: "انتخاب فایل", exact: true }),
      ).toBeVisible();
      await imageInput.setInputFiles(imageFixturePath);
      await expect(imageDialog).toBeHidden();
      await window
        .getByRole("button", { name: "متن خام", exact: true })
        .click();
      await expect.poll(() => editorContent.textContent()).toContain("raavi-image://image-");
      await window
        .getByRole("button", { name: "ویرایش روان", exact: true })
        .click();
      await expect(window.locator(".markdown-body img").last()).toHaveAttribute(
        "src",
        /^data:image\/png;base64,/,
      );
      await openImageHelper();
      const imageUrlInput = imageDialog.locator("#editor-image-url");
      await expect(imageUrlInput).toBeVisible();
      const remoteImageUrl = "https://example.com/reference-image.png";
      await imageUrlInput.fill(remoteImageUrl);
      await imageDialog
        .getByRole("button", { name: "درج نشانی", exact: true })
        .click();
      await expect(imageDialog).toBeHidden();
      await window
        .getByRole("button", { name: "متن خام", exact: true })
        .click();
      await expect(editorContent).toContainText(remoteImageUrl);
      await window
        .getByRole("button", { name: "ویرایش روان", exact: true })
        .click();
      const selectAllEditorText = async () => {
        await editorContent.focus();
        await editorContent.press("Control+A");
        await window.waitForTimeout(40);
      };
      const topbar = window.locator(".topbar");
      await expect(
        topbar.getByRole("button", { name: "ذخیره فایل", exact: true }),
      ).toHaveCount(0);
      await expect(
        topbar.getByRole("button", { name: "میان‌برها", exact: true }),
      ).toHaveCount(0);

      const overflowTrigger = topbar.getByRole("button", {
        name: "بازکردن فرمان‌های بیشتر",
        exact: true,
      });
      await overflowTrigger.click();
      const supportTrigger = window.locator(
        '[data-overflow-action="support"]',
      );
      await expect(supportTrigger).toBeVisible();
      await supportTrigger.click();
      const supportDialog = window.getByRole("dialog", {
        name: "رایگان، همیشه",
        exact: true,
      });
      const supportTitle = supportDialog.locator("#support-modal-title");
      await expect(supportDialog).toBeVisible();
      await expect(supportTitle).toBeFocused();
      await expect(
        supportDialog.getByRole("link", {
          name: "حمایت مالی در دارمت",
          exact: true,
        }),
      ).toHaveAttribute("href", "https://daramet.com/poorsmile");
      await expect(
        supportDialog.getByRole("link", {
          name: "کانال بروزرسانی‌های راوی",
          exact: true,
        }),
      ).toHaveAttribute("href", "https://t.me/poorsmile_crafts");
      await expect(
        supportDialog.getByRole("link", {
          name: "ravi.poorsmile.ir",
          exact: true,
        }),
      ).toHaveAttribute("href", "https://ravi.poorsmile.ir");
      await expect(
        supportDialog.getByText("نامتان را در پیام حمایت بنویسید.", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(topbar).toHaveAttribute("inert", "");
      await window.keyboard.press("Escape");
      await expect(supportDialog).toBeHidden();
      await expect(overflowTrigger).toBeFocused();

      await overflowTrigger.click();
      const aboutTrigger = window.locator('[data-overflow-action="about"]');
      await expect(aboutTrigger).toBeVisible();
      await aboutTrigger.click();
      const aboutDialog = window.getByRole("dialog", {
        name: "دربارهٔ راوی",
        exact: true,
      });
      const aboutTitle = aboutDialog.locator("#about-modal-title");
      await expect(aboutDialog).toBeVisible();
      await expect(aboutTitle).toBeFocused();
      await expect(
        aboutDialog.getByText(packageMetadata.version, { exact: true }),
      ).toBeVisible();
      await expect(
        aboutDialog.getByRole("heading", {
          name: "حامیان راوی",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        aboutDialog.getByText("اندیشکده حکمرانی شریف", { exact: true }),
      ).toBeVisible();
      await expect(
        aboutDialog.getByText("مهدی میرزائی", { exact: true }),
      ).toBeVisible();
      await expect(
        aboutDialog.getByText("امیرمحمد شفیعی", { exact: true }),
      ).toBeVisible();
      await expect(
        aboutDialog.getByRole("heading", {
          name: "ویژگی‌های متمایز راوی",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        aboutDialog.getByRole("heading", {
          name: "دفتر تغییرات",
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        aboutDialog
          .getByRole("listitem")
          .filter({
            hasText: "پشتیبانی امن و lazy از بلوک‌های استاندارد Mermaid",
          }),
      ).toBeVisible();
      await expect(topbar).toHaveAttribute("inert", "");
      await window.keyboard.press("Escape");
      await expect(aboutDialog).toBeHidden();
      await expect(overflowTrigger).toBeFocused();

      const initialEditorValue = await editorContent.innerText();
      await editorContent.fill(`${initialEditorValue}\n\nتغییر ذخیره‌نشده`);
      const newDocumentTrigger = topbar.getByRole("button", {
        name: "فایل جدید",
        exact: true,
      });
      await expect(newDocumentTrigger).toBeVisible();
      await newDocumentTrigger.click();
      const newTabWorkspace = window.locator(".workspace-office-setup");
      await expect(newTabWorkspace).toBeVisible();
      await expect(
        window.getByRole("tab", { name: "تب جدید", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await window.getByRole("button", { name: "بستن تب جدید" }).click();
      await expect(editor).toBeVisible();
      await expect(editorContent).toContainText("تغییر ذخیره‌نشده");
      const scrollFixture = `${initialEditorValue}\n\n# راهنمای راوی\n\nبخش نخست راهنما\n\n## از کجا شروع کنم؟\n\n${Array.from(
        { length: 80 },
        (_, index) => `بند آزمایشی ${index + 1}`,
      ).join("\n\n")}`;
      await editorContent.fill(scrollFixture);
      await window.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );

      await window
        .getByRole("button", {
          name: "نمونه‌خوانی دوبرگی",
          exact: true,
        })
        .click();

      const previewScroll = window.locator("#writing-editor .cm-scroller");
      const scrollSyncToggle = window.locator(".scroll-sync-toggle");
      await expect(scrollSyncToggle).toHaveAttribute(
        "aria-label",
        "باز کردن قفل اسکرول هماهنگ",
      );
      await expect(scrollSyncToggle).toHaveAttribute("aria-pressed", "true");

      const editorScrollRange = await editorScroller.evaluate(
        (node: HTMLElement) => node.scrollHeight - node.clientHeight,
      );
      const previewScrollRange = await previewScroll.evaluate(
        (node: HTMLDivElement) => node.scrollHeight - node.clientHeight,
      );
      expect(editorScrollRange).toBeGreaterThan(0);
      expect(previewScrollRange).toBeGreaterThan(0);

      await editorScroller.evaluate((node: HTMLElement) => {
        node.scrollTop = 0;
        node.dispatchEvent(new Event("scroll"));
      });
      await previewScroll.evaluate((node: HTMLDivElement) => {
        node.scrollTop = 0;
        node.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
      await window.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );

      await editorScroller.evaluate((node: HTMLElement) => {
        node.scrollTop = (node.scrollHeight - node.clientHeight) * 0.7;
        node.dispatchEvent(new Event("scroll"));
      });
      await expect
        .poll(async () => {
          const ratio = await previewScroll.evaluate((node: HTMLDivElement) => {
            const range = node.scrollHeight - node.clientHeight;
            return range > 0 ? node.scrollTop / range : 0;
          });
          return Math.abs(ratio - 0.7) < 0.12;
        })
        .toBe(true);

      // Let the semantic-scroll feedback guard expire before testing the
      // reverse direction as an independent user scroll.
      await window.waitForTimeout(220);
      const editorRatioBeforeReverseSync = await editorScroller.evaluate(
        (node: HTMLElement) => {
          const range = node.scrollHeight - node.clientHeight;
          return range > 0 ? node.scrollTop / range : 0;
        },
      );
      await previewScroll.evaluate((node: HTMLDivElement) => {
        node.scrollTop = (node.scrollHeight - node.clientHeight) * 0.25;
        node.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
      await expect
        .poll(async () => {
          const ratio = await editorScroller.evaluate((node: HTMLElement) => {
            const range = node.scrollHeight - node.clientHeight;
            return range > 0 ? node.scrollTop / range : 0;
          });
          // OBL-11 synchronizes by semantic block, so unequal renderer heights
          // need not produce identical percentages. The editor must still follow
          // the preview to a different semantic position.
          return Math.abs(ratio - editorRatioBeforeReverseSync) > 0.02;
        })
        .toBe(true);

      await scrollSyncToggle.click();
      await expect(scrollSyncToggle).toHaveAttribute("aria-pressed", "false");
      await expect(scrollSyncToggle).toHaveAttribute(
        "aria-label",
        "قفل کردن اسکرول ادیتور و پیش‌نمایش",
      );
      const editorScrollBeforeUnlockedPreview = await editorScroller.evaluate(
        (node: HTMLElement) => node.scrollTop,
      );
      await previewScroll.evaluate(
        (node: HTMLDivElement) =>
          new Promise<void>((resolve) => {
            node.scrollTop = (node.scrollHeight - node.clientHeight) * 0.8;
            node.dispatchEvent(new Event("scroll", { bubbles: true }));
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );
      const editorScrollAfterUnlockedPreview = await editorScroller.evaluate(
        (node: HTMLElement) => node.scrollTop,
      );
      expect(
        Math.abs(
          editorScrollAfterUnlockedPreview - editorScrollBeforeUnlockedPreview,
        ),
      ).toBeLessThan(1);
      await scrollSyncToggle.click();

      const workspace = window.locator(".workspace");
      const editorPane = window.locator(".editor-pane");
      const previewPane = window.locator(".preview-pane");
      let paneSeparator = window.getByRole("separator", {
        name: "تغییر اندازهٔ کد و نوشتن",
        exact: true,
      });
      await expect(paneSeparator).toHaveAttribute("aria-valuenow", "50");
      const balancedPaneWidths = await Promise.all([
        previewPane.evaluate((node: HTMLElement) =>
          Math.round(node.getBoundingClientRect().width),
        ),
        editorPane.evaluate((node: HTMLElement) =>
          Math.round(node.getBoundingClientRect().width),
        ),
      ]);
      expect(Math.abs(balancedPaneWidths[0] - balancedPaneWidths[1])).toBeLessThan(
        3,
      );

      await paneSeparator.press("ArrowLeft");
      await expect(paneSeparator).toHaveAttribute("aria-valuenow", "45");
      await expect
        .poll(async () => {
          const [previewWidth, editorWidth] = await Promise.all([
            previewPane.evaluate(
              (node: HTMLElement) => node.getBoundingClientRect().width,
            ),
            editorPane.evaluate(
              (node: HTMLElement) => node.getBoundingClientRect().width,
            ),
          ]);
          return previewWidth - editorWidth;
        })
        .toBeGreaterThan(0);
      await paneSeparator.press("Enter");
      await expect(paneSeparator).toHaveAttribute("aria-valuenow", "50");

      await previewPane
        .getByRole("button", {
          name: "تمام‌صفحه‌کردن نوشتن",
          exact: true,
        })
        .click();
      await expect(workspace).toHaveAttribute("data-pane-layout", "editor");
      await expect(previewPane).toHaveAttribute("aria-hidden", "true");
      const splitModeButton = window.getByRole("button", {
        name: "نمونه‌خوانی دوبرگی",
        exact: true,
      });
      await expect(splitModeButton).toBeVisible();
      await splitModeButton.click();
      await expect(workspace).toHaveAttribute("data-pane-layout", "split");

      await editorPane
        .getByRole("button", {
          name: "تمام‌صفحه‌کردن کد",
          exact: true,
        })
        .click();
      await expect(workspace).toHaveAttribute("data-pane-layout", "editor");
      await expect(workspace).toHaveAttribute("data-workspace-screen", "code");
      await expect(previewPane).toHaveAttribute("aria-hidden", "true");
      await splitModeButton.click();
      await expect(workspace).toHaveAttribute("data-pane-layout", "split");
      await window.waitForTimeout(350);

      paneSeparator = window.getByRole("separator", {
        name: "تغییر اندازهٔ کد و نوشتن",
        exact: true,
      });
      const separatorBox = await paneSeparator.boundingBox();
      const workspaceBox = await workspace.boundingBox();
      const workspacePaddingLeft = await workspace.evaluate((node) =>
        Number.parseFloat(getComputedStyle(node).paddingLeft),
      );
      expect(separatorBox).not.toBeNull();
      expect(workspaceBox).not.toBeNull();
      const dragY = separatorBox!.y + 96;
      await window.mouse.move(
        separatorBox!.x + separatorBox!.width / 2,
        dragY,
      );
      await window.mouse.down();
      await window.mouse.move(
        workspaceBox!.x + workspacePaddingLeft + 2,
        dragY,
        { steps: 8 },
      );
      await expect(workspace).toHaveAttribute(
        "data-collapse-candidate",
        "editor",
      );
      await expect
        .poll(async () => Number(await paneSeparator.getAttribute("aria-valuenow")))
        .toBeLessThanOrEqual(25);
      await window.mouse.up();
      await expect(workspace).toHaveAttribute("data-pane-layout", "editor");
      await expect(workspace).toHaveAttribute("data-workspace-screen", "writing");
      await expect(previewPane).toHaveAttribute("aria-hidden", "true");
      await splitModeButton.click();
      await expect(workspace).toHaveAttribute("data-pane-layout", "split");
      paneSeparator = window.getByRole("separator", {
        name: "تغییر اندازهٔ کد و نوشتن",
        exact: true,
      });
      await expect(paneSeparator).toHaveAttribute("aria-valuenow", "50");
      await expect
        .poll(() =>
          window.evaluate(() =>
            window.localStorage.getItem("raavi:pane-layout:v1"),
          ),
        )
        .toContain('"mode":"split"');

      const readingModeButton = window.getByRole("button", {
        name: "خواندن",
        exact: true,
      });
      await readingModeButton.click();

      const readingHeader = window.locator(".reading-topbar");
      const readingFileName = readingHeader.locator(
        ".reading-header-document strong",
      );
      const backToDesk = readingHeader.getByRole("button", {
        name: /بازگشت به میز/,
      });
      await expect(readingFileName).toHaveText("سند جدید.md");
      await expect(backToDesk).toBeVisible();
      const readingFileNameBox = await readingFileName.boundingBox();
      const backToDeskBox = await backToDesk.boundingBox();
      expect(readingFileNameBox).not.toBeNull();
      expect(backToDeskBox).not.toBeNull();
      expect(backToDeskBox!.x).toBeLessThan(readingFileNameBox!.x);

      const readingOutlineRailButton = window
        .locator(".sidebar-rail")
        .getByRole("button", {
          name: "فهرست سند",
          exact: true,
        });
      await expect(readingOutlineRailButton).toBeVisible();
      await expect(readingOutlineRailButton).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await readingOutlineRailButton.click();

      const readingOutline = window.getByRole("complementary", {
        name: "فهرست سند",
        exact: true,
      });
      await expect(readingOutline).toBeVisible();
      await expect(
        readingOutline.getByRole("button", {
          name: /^راهنمای راوی/,
        }),
      ).toBeVisible();

      const secondChapter = readingOutline.getByRole("button", {
        name: /^از کجا شروع کنم؟/,
      });
      await secondChapter.click();
      await expect(secondChapter).toHaveAttribute("aria-current", "location");

      const readingOutlineToggle = readingOutline.getByRole("button", {
        name: "جمع‌کردن نوار کناری",
        exact: true,
      });
      await expect(readingOutlineToggle).toHaveAttribute(
        "aria-label",
        "جمع‌کردن نوار کناری",
      );
      await readingOutlineToggle.focus();
      await readingOutlineToggle.press("Enter");
      await expect(readingOutline).toHaveClass(/is-collapsed/);
      await expect(workspace).toHaveClass(/reading-outline-is-collapsed/);
      await expect
        .poll(async () => {
          const [workspaceBox, previewBox] = await Promise.all([
            workspace.boundingBox(),
            previewPane.boundingBox(),
          ]);
          if (!workspaceBox || !previewBox) return Number.POSITIVE_INFINITY;
          const workspaceCenter = workspaceBox.x + workspaceBox.width / 2;
          const previewCenter = previewBox.x + previewBox.width / 2;
          return Math.abs(workspaceCenter - previewCenter);
        })
        .toBeLessThanOrEqual(8);
      await expect(readingOutlineRailButton).toHaveAttribute(
        "aria-expanded",
        "false",
      );
      await expect(secondChapter).toBeHidden();

      const scrollReadingRoot = async ({
        top,
        delta = 0,
      }: {
        top?: number;
        delta?: number;
      }) =>
        window.evaluate(
          ({ top: requestedTop, delta: requestedDelta }) =>
            new Promise<void>((resolve, reject) => {
              const workspace =
                document.querySelector<HTMLElement>(".workspace--reading");
              if (!workspace) {
                reject(new Error("Reading workspace is unavailable."));
                return;
              }
              const useWorkspace =
                workspace.scrollHeight - workspace.clientHeight > 1;
              const currentTop = useWorkspace
                ? workspace.scrollTop
                : globalThis.scrollY;
              const maximumTop = useWorkspace
                ? workspace.scrollHeight - workspace.clientHeight
                : Math.max(
                    0,
                    document.documentElement.scrollHeight -
                      globalThis.innerHeight,
                  );
              const nextTop = Math.max(
                0,
                Math.min(
                  maximumTop,
                  requestedTop ?? currentTop + requestedDelta,
                ),
              );
              const wheelDelta = nextTop - currentTop;
              const intentEvent = new WheelEvent("wheel", {
                bubbles: true,
                deltaY: wheelDelta,
              });
              if (useWorkspace) {
                workspace.dispatchEvent(intentEvent);
                workspace.scrollTop = nextTop;
                workspace.dispatchEvent(new Event("scroll"));
              } else {
                globalThis.dispatchEvent(intentEvent);
                globalThis.scrollTo({ top: nextTop, behavior: "auto" });
                globalThis.dispatchEvent(new Event("scroll"));
              }
              requestAnimationFrame(() =>
                requestAnimationFrame(() => resolve()),
              );
            }),
          { top, delta },
        );

      await scrollReadingRoot({ delta: -80 });
      await expect(readingHeader).toHaveClass(/is-visible/);
      await readingOutlineRailButton.click();
      await expect(readingOutline).toBeVisible();
      await expect(secondChapter).toBeVisible();

      await scrollReadingRoot({ top: 0 });
      await expect(readingHeader).toHaveClass(/is-visible/);
      await scrollReadingRoot({ top: 260 });
      await expect(readingHeader).toHaveClass(/is-concealed/);
      await scrollReadingRoot({ delta: -80 });
      await expect(readingHeader).toHaveClass(/is-visible/);
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

      const documentRoot = window.locator("html");
      await overflowTrigger.click();
      let themeToggle = window.locator('[data-overflow-action="theme"]');
      await expect(themeToggle).toBeVisible();
      await expect(themeToggle).toHaveAttribute("aria-keyshortcuts", "Alt+T");

      if ((await documentRoot.getAttribute("data-theme")) === "dark") {
        await themeToggle.click();
        await expect(documentRoot).toHaveAttribute("data-theme", "light");
        await expect(window.locator(".theme-transition-overlay")).toHaveCount(
          0,
        );
      } else {
        await window.keyboard.press("Escape");
      }

      const persianThemeShortcut = await dispatchShortcut({
        code: "KeyT",
        key: "ف",
        altKey: true,
      });
      expect(persianThemeShortcut).toEqual({
        defaultPrevented: true,
        notCanceled: false,
      });
      await expect(window.locator(".theme-transition-overlay")).toBeVisible();
      await expect(documentRoot).toHaveAttribute("data-theme", "dark");
      await expect(window.locator(".theme-transition-overlay")).toHaveCount(0);
      await overflowTrigger.click();
      themeToggle = window.locator('[data-overflow-action="theme"]');
      await expect(themeToggle).toHaveAttribute(
        "aria-label",
        "فعال‌کردن تم روشن",
      );
      await window.keyboard.press("Escape");

      const measureThemeContrast = () =>
        window.evaluate(() => {
          const luminance = (color: string) => {
            const channels =
              color.match(/[\d.]+/g)?.slice(0, 3).map(Number) ?? [];
            const linear = channels.map((channel) => {
              const value = channel / 255;
              return value <= 0.04045
                ? value / 12.92
                : ((value + 0.055) / 1.055) ** 2.4;
            });
            return (
              0.2126 * linear[0] +
              0.7152 * linear[1] +
              0.0722 * linear[2]
            );
          };
          const ratio = (foreground: string, background: string) => {
            const foregroundLuminance = luminance(foreground);
            const backgroundLuminance = luminance(background);
            return (
              (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
              (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
            );
          };
          const elementPairs = [
            [".topbar", ".topbar"],
            [".library-panel", ".library-panel"],
            ["#markdown-editor", "#markdown-editor"],
            [".markdown-body", ".preview-scroll"],
            [".button--primary", ".button--primary"],
          ];
          const elementResults = elementPairs.flatMap(
            ([foregroundSelector, backgroundSelector]) => {
              const foregroundElement = document.querySelector(foregroundSelector);
              const backgroundElement = document.querySelector(backgroundSelector);
              if (!foregroundElement || !backgroundElement) return [];
              const foreground = getComputedStyle(foregroundElement).color;
              const background = getComputedStyle(backgroundElement).backgroundColor;
              return [{
                pair: `${foregroundSelector}/${backgroundSelector}`,
                ratio: ratio(foreground, background),
              }];
            },
          );

          const tokenPairs = [
            ["--ink-950", "--paper-50"],
            ["--ink-700", "--paper-50"],
            ["--ink-500", "--paper-50"],
            ["--ink-700", "--paper-100"],
            ["--chrome-fg", "--chrome-950"],
            ["--chrome-muted", "--chrome-950"],
            ["--on-accent", "--proof-blue"],
            ["--warning-text", "--warning-bg"],
            ["--error", "--error-soft"],
            ["--document-text", "--paper-50"],
            ["--ink-950", "--input-bg"],
            ["--proof-blue-dark", "--proof-blue-soft"],
          ];
          const rootStyle = getComputedStyle(document.documentElement);
          const probe = document.createElement("span");
          probe.hidden = true;
          document.body.appendChild(probe);
          const resolveToken = (token: string) => {
            probe.style.color = rootStyle.getPropertyValue(token);
            return getComputedStyle(probe).color;
          };
          const tokenResults = tokenPairs.map(
            ([foregroundToken, backgroundToken]) => ({
              pair: `${foregroundToken}/${backgroundToken}`,
              ratio: ratio(
                resolveToken(foregroundToken),
                resolveToken(backgroundToken),
              ),
            }),
          );
          probe.remove();
          return [...elementResults, ...tokenResults];
        });
      const darkContrast = await measureThemeContrast();
      for (const pair of darkContrast) {
        expect(pair.ratio, `${pair.pair} contrast`).toBeGreaterThanOrEqual(4.5);
      }

      await dispatchShortcut({ code: "KeyT", key: "t", altKey: true });
      await expect(documentRoot).toHaveAttribute("data-theme", "light");
      await expect(window.locator(".theme-transition-overlay")).toHaveCount(0);
      await overflowTrigger.click();
      themeToggle = window.locator('[data-overflow-action="theme"]');
      await expect(themeToggle).toHaveAttribute(
        "aria-label",
        "فعال‌کردن تم تاریک",
      );
      await window.keyboard.press("Escape");
      const lightContrast = await measureThemeContrast();
      for (const pair of lightContrast) {
        expect(pair.ratio, `${pair.pair} contrast`).toBeGreaterThanOrEqual(4.5);
      }

      const sidebar = window.locator("#library-panel");
      const filesView = sidebar.getByRole("button", {
        name: "کتابخانه",
        exact: true,
      });
      const searchView = filesView;
      const pinsView = sidebar.getByRole("button", {
        name: "تاریخچه",
        exact: true,
      });
      const addFolderButton = sidebar.getByRole("button", {
        name: "افزودن پوشه به کتابخانه",
        exact: true,
      });
      await expect(sidebar.locator(".sidebar-rail > button")).toHaveCount(8);
      await filesView.click();
      await expect(filesView).toHaveAttribute("aria-current", "page");
      await expect(addFolderButton).toBeVisible();
      await expect(addFolderButton).toHaveText("");

      await pinsView.click();
      await expect(pinsView).toHaveAttribute("aria-current", "page");
      await expect(window.locator("#recent-files-panel")).toBeVisible();
      await expect(addFolderButton).toBeHidden();

      await pinsView.press("Home");
      const aiView = sidebar.getByRole("button", {
        name: "راوی هوشمند",
        exact: true,
      });
      await expect(aiView).toHaveAttribute("aria-current", "page");
      await expect(addFolderButton).toBeHidden();
      await filesView.click();
      await expect(addFolderButton).toBeVisible();

      const directoryInput = window.locator("input[webkitdirectory]");
      await directoryInput.setInputFiles(libraryFixturePath);
      await sidebar
        .locator(".file-explorer-row.is-folder.is-root .file-explorer-main")
        .click();
      await expect(sidebar.locator(".file-explorer-row.is-file")).toHaveCount(2);

      const collapseSidebar = sidebar.getByRole("button", {
        name: "جمع‌کردن نوار کناری",
        exact: true,
      });
      await collapseSidebar.click();
      await expect(sidebar).toHaveClass(/is-collapsed/);
      await expect(sidebar.locator(".sidebar-rail")).toBeVisible();
      await expect(topbar.locator(".topbar-action--library")).toHaveCount(0);
      await filesView.click();
      await expect(sidebar).toHaveClass(/is-open/);

      await pinsView.click();
      await collapseSidebar.click();
      await expect(sidebar).toHaveClass(/is-collapsed/);
      await expect(workspace).not.toHaveAttribute("inert", "");
      await window
        .getByRole("button", { name: "متن خام", exact: true })
        .click();
      await editorContent.focus();
      await editorContent.fill("نمونه");
      await expect(editorContent).toHaveText("نمونه");
      await selectAllEditorText();
      expect(
        await dispatchShortcut({
          code: "KeyB",
          key: "ذ",
          ctrlKey: true,
        }),
      ).toEqual({ defaultPrevented: true, notCanceled: false });
      await expect(editorContent).toHaveText("**نمونه**");

      await editorContent.fill("sample");
      await expect(editorContent).toHaveText("sample");
      await selectAllEditorText();
      await dispatchShortcut({ code: "KeyB", key: "b", ctrlKey: true });
      await expect(editorContent).toHaveText("**sample**");

      await editorContent.fill("mini menu");
      await window
        .getByRole("button", { name: "ویرایش روان", exact: true })
        .click();
      await expect(editorContent).toContainText("mini menu");
      await selectAllEditorText();
      const editorBox = await editorContent.boundingBox();
      expect(editorBox).not.toBeNull();
      const editorSelectionPointer = {
        clientX: editorBox!.x + editorBox!.width * 0.58,
        clientY: editorBox!.y + 70,
      };
      await editorContent.dispatchEvent("mouseup", editorSelectionPointer);

      const editorSelectionMenu = window.getByRole("toolbar", {
        name: "قالب‌بندی متن انتخاب‌شده",
      });
      await expect(editorSelectionMenu).toBeVisible();
      for (const actionName of [
        "پررنگ",
        "مورب",
        "هایلایت",
        "افزودن پیوند",
      ]) {
        await expect(
          editorSelectionMenu.getByRole("button", {
            name: actionName,
            exact: true,
          }),
        ).toBeVisible();
      }
      const editorSelectionMenuBox = await editorSelectionMenu.boundingBox();
      expect(editorSelectionMenuBox).not.toBeNull();
      expect(
        Math.abs(
          editorSelectionMenuBox!.x +
            editorSelectionMenuBox!.width / 2 -
            editorSelectionPointer.clientX,
        ),
      ).toBeLessThan(110);
      await editorSelectionMenu
        .getByRole("button", { name: "پررنگ", exact: true })
        .click();
      await expect(editorContent).toContainText("**mini menu**");
      await expect(editorSelectionMenu).toBeHidden();

      await dispatchShortcut({ code: "Digit3", key: "۳", altKey: true });
      const librarySearch = window.locator(
        '[data-editable-kind="librarySearch"]',
      );
      await expect(searchView).toHaveAttribute("aria-current", "page");
      await expect(librarySearch).toBeFocused();

      const browserOwned = await dispatchShortcut({
        code: "KeyK",
        key: "ن",
        ctrlKey: true,
      });
      expect(browserOwned.defaultPrevented).toBe(true);
      const commandPaletteDialog = window.getByRole("dialog", {
        name: "مرکز فرمان راوی",
      });
      await expect(commandPaletteDialog).toBeVisible();
      const commandPaletteInput = commandPaletteDialog.getByRole("combobox", {
        name: "جست‌وجوی فرمان",
      });
      await expect(commandPaletteInput).toBeFocused();
      await commandPaletteInput.press("Escape");
      await expect(commandPaletteDialog).toBeHidden();

      await editorContent.focus();
      await dispatchShortcut({
        code: "KeyS",
        key: "S",
        ctrlKey: true,
        shiftKey: true,
      });
      const saveName = window.locator('[data-editable-kind="saveName"]').first();
      await expect(saveName).toBeFocused();

      await saveName.press("Escape");
      await expect(window.locator(".save-modal")).toBeHidden();
      await expect(editorContent).toBeFocused();

      await dispatchShortcut({ code: "Slash", key: "ش", ctrlKey: true });
      const shortcutTitle = window.locator("#shortcut-modal-title");
      await expect(shortcutTitle).toBeVisible();
      await expect(shortcutTitle).toBeFocused();
      await expect(window.locator(".topbar")).toHaveAttribute("inert", "");

      await window
        .getByRole("button", { name: "بستن راهنمای میان‌برها" })
        .click();
      await expect(shortcutTitle).toBeHidden();
      await expect(window.locator(".topbar")).not.toHaveAttribute("inert", "");

      await editorContent.focus();
      await dispatchShortcut({ code: "F1", key: "F1" });
      await expect(shortcutTitle).toBeVisible();
      await window
        .getByRole("button", { name: "بستن راهنمای میان‌برها" })
        .click();
      await expect(shortcutTitle).toBeHidden();
      await editorContent.focus();

      const markdownBody = window.locator(".markdown-body");
      await window
        .getByRole("button", { name: "متن خام", exact: true })
        .click();
      const englishDocument =
        "# English document\n\nThis document is written entirely in English.";
      await editorContent.fill(englishDocument);
      await expect
        .poll(async () =>
          (await editorContent.locator(".cm-line").allTextContents()).join("\n"),
        )
        .toBe(englishDocument);
      await waitForPersistedDocumentText(
        window,
        "This document is written entirely in English.",
      );
      await window
        .getByRole("button", { name: "خواندن", exact: true })
        .click();
      await expect(markdownBody).toHaveAttribute("dir", "ltr");
      await expect(markdownBody).toHaveCSS("text-align", "start");
      await expect(markdownBody.locator("h1")).toHaveAttribute("dir", "ltr");
      await expect(markdownBody.locator("p[data-source-offset]")).toHaveAttribute(
        "dir",
        "ltr",
      );

      await window.getByRole("button", { name: /بازگشت به میز/ }).click();
      await window
        .getByRole("button", { name: "متن خام", exact: true })
        .click();
      await expect(editor).toBeVisible();
      const mixedDocument = [
        "# Mixed document",
        "",
        "This paragraph is written almost entirely in English with فقط one Persian word.",
        "",
        "این پاراگراف فارسی است و فقط چند English word در آن دیده می‌شود.",
      ].join("\n");
      // Ctrl/Cmd+A intentionally selects the active semantic block in Raavi.
      // Use the editor fill contract when this scenario needs a whole-document
      // replacement before validating reading direction and drag selection.
      await editorContent.fill(mixedDocument);
      await expect
        .poll(async () =>
          (await editorContent.locator(".cm-line").allTextContents()).join("\n"),
        )
        .toBe(mixedDocument);
      await waitForPersistedDocumentText(
        window,
        "این پاراگراف فارسی است و فقط چند English word در آن دیده می‌شود.",
      );
      await window
        .getByRole("button", { name: "خواندن", exact: true })
        .click();
      await expect(markdownBody).toHaveAttribute("dir", "rtl");
      await expect(markdownBody.locator("h1")).toHaveAttribute("dir", "ltr");
      const englishParagraph = markdownBody
        .locator("p[data-source-offset]")
        .filter({ hasText: "This paragraph is written almost entirely" });
      const persianParagraph = markdownBody
        .locator("p[data-source-offset]")
        .filter({ hasText: "این پاراگراف فارسی است" });
      await expect(englishParagraph).toHaveAttribute("dir", "ltr");
      await expect(persianParagraph).toHaveAttribute("dir", "rtl");

      await expect(window.locator(".app-shell")).toHaveClass(/is-reading/);

      const selectionTarget = persianParagraph;
      await selectionTarget.scrollIntoViewIfNeeded();
      await selectionTarget.selectText();
      const selectionTargetBox = await selectionTarget.boundingBox();
      expect(selectionTargetBox).not.toBeNull();
      const selectionPointer = {
        clientX: selectionTargetBox!.x + selectionTargetBox!.width * 0.55,
        clientY: selectionTargetBox!.y + selectionTargetBox!.height * 0.7,
      };
      await selectionTarget.dispatchEvent("mouseup", selectionPointer);

      const selectionMenu = window.getByRole("toolbar", {
        name: "ابزار متن انتخاب‌شده",
      });
      await expect(selectionMenu).toBeVisible();
      await expect(
        selectionMenu.getByRole("button", { name: /هایلایت/ }),
      ).toBeVisible();
      await expect(
        selectionMenu.getByRole("button", { name: /نظر/ }),
      ).toBeVisible();
      await expect(
        selectionMenu.getByRole("button"),
      ).toHaveCount(2);
      await expect(
        selectionMenu.getByRole("button", { name: /حاشیه|کپی/ }),
      ).toHaveCount(0);

      const selectionFeedback = window.locator(".selection-range-feedback");
      await expect(selectionFeedback.first()).toBeVisible();

      const selectionMenuBox = await selectionMenu.boundingBox();
      expect(selectionMenuBox).not.toBeNull();
      expect(
        Math.abs(
          selectionMenuBox!.x +
            selectionMenuBox!.width / 2 -
            selectionPointer.clientX,
        ),
      ).toBeLessThan(120);

      await window.keyboard.press("Control+C");
      await expect(selectionMenu).toBeVisible();
      await expect(selectionFeedback.first()).toBeVisible();

      await selectionTarget.selectText();
      await selectionTarget.dispatchEvent("mouseup", selectionPointer);
      await expect(selectionMenu).toBeVisible();
      await selectionMenu.getByRole("button", { name: /هایلایت/ }).click();
      await expect(selectionMenu).toBeHidden();
      await expect(window.locator("#reading-highlights-pane")).toBeVisible();
    } finally {
      await app.close();
      await rm(userDataPath, { recursive: true, force: true });
    }
  });

  test("keeps native-copied preview selection highlighted until cancellation", async () => {
    test.slow();
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "raavi-selection-playwright-"),
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
      const window = await waitForRaaviWindow(app);
      await startElectronWritingDraft(window);
      await window
        .getByRole("button", { name: "متن خام", exact: true })
        .click();
      const editor = window.locator("#markdown-editor:visible");
      const editorContent = editor.locator(".cm-content");
      const markdownBody = window.locator(".markdown-body");
      await expect(editor).toBeVisible();
      await editorContent.fill(
        "# انتخاب متن\n\nاین متن برای بررسی ماندگاری محدودهٔ انتخاب‌شده است.",
      );
      await waitForPersistedDocumentText(
        window,
        "این متن برای بررسی ماندگاری محدودهٔ انتخاب‌شده است.",
      );
      await window
        .getByRole("button", { name: "خواندن", exact: true })
        .click();

      const selectionText =
        "این متن برای بررسی ماندگاری محدودهٔ انتخاب‌شده است.";
      const selectionTarget = () =>
        markdownBody.getByText(selectionText, { exact: true });
      await expect(selectionTarget()).toHaveText(selectionText);
      const selectionMenu = window.getByRole("toolbar", {
        name: "ابزار متن انتخاب‌شده",
      });
      const dragTargetBox = await selectionTarget().boundingBox();
      expect(dragTargetBox).not.toBeNull();
      await window.mouse.move(
        dragTargetBox!.x + dragTargetBox!.width - 6,
        dragTargetBox!.y + dragTargetBox!.height / 2,
      );
      await window.mouse.down();
      await window.mouse.move(
        dragTargetBox!.x + 6,
        dragTargetBox!.y + dragTargetBox!.height / 2,
        { steps: 12 },
      );
      await window.mouse.up();
      await expect
        .poll(() =>
          window.evaluate(() => globalThis.getSelection()?.toString().trim()),
        )
        .not.toBe("");
      await expect(selectionMenu).toBeVisible();
      await window.keyboard.press("Escape");
      await expect(selectionMenu).toHaveCount(0);

      await expect(async () => {
        await selectionTarget().selectText();
        await expect
          .poll(() =>
            window.evaluate(() => globalThis.getSelection()?.toString()),
          )
          .toBe(selectionText);
      }).toPass();
      const selectionTargetBox = await selectionTarget().boundingBox();
      expect(selectionTargetBox).not.toBeNull();
      await expect
        .poll(async () => {
          const currentTarget = selectionTarget();
          const currentBox = await currentTarget.boundingBox();
          if (!currentBox) return false;
          await currentTarget.selectText();
          await currentTarget.dispatchEvent("mouseup", {
            clientX: currentBox.x + currentBox.width / 2,
            clientY: currentBox.y + currentBox.height / 2,
          });
          return selectionMenu.isVisible();
        })
        .toBe(true);
      const selectionFeedback = window.locator(".selection-range-feedback");
      await expect(selectionFeedback.first()).toBeVisible();

      await window.keyboard.press("Control+C");
      await expect(selectionMenu).toBeVisible();
      await expect(selectionFeedback.first()).toBeVisible();

      await window.keyboard.press("Escape");
      await expect(selectionMenu).toHaveCount(0);
      await expect(selectionFeedback).toHaveCount(0);
    } finally {
      await app.close();
      await rm(userDataPath, { recursive: true, force: true });
    }
  });

  test("keeps reading-mode media mounted while selecting text", async () => {
    test.slow();
    const projectRoot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
    );
    const userDataPath = await mkdtemp(
      path.join(os.tmpdir(), "raavi-reading-selection-playwright-"),
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
      const window = await waitForRaaviWindow(app);
      await startElectronWritingDraft(window);
      await window
        .getByRole("button", { name: "متن خام", exact: true })
        .click();
      const editorContent = window.locator("#markdown-editor:visible .cm-content");
      await expect(editorContent).toBeVisible();
      await editorContent.fill(
        [
          "# انتخاب بدون پرش",
          "",
          "```mermaid",
          "flowchart TB",
          '  A["شروع"] --> B["پایان"]',
          "```",
          "",
          "این متن باید بدون بازسازی نمودار انتخاب شود.",
        ].join("\n"),
      );
      await waitForPersistedDocumentText(
        window,
        "این متن باید بدون بازسازی نمودار انتخاب شود.",
      );

      await window
        .getByRole("button", { name: "ویرایش روان", exact: true })
        .click();
      await expect(
        window.locator(".cm-rich-mermaid-stage.is-ready .cm-rich-mermaid-svg"),
      ).toBeVisible();
      await window
        .getByRole("button", { name: "خواندن", exact: true })
        .click();
      await expect(window.locator(".app-shell")).toHaveClass(/is-reading/);

      const figure = () => window.locator(".mermaid-diagram").first();
      await expect(async () => {
        await figure().scrollIntoViewIfNeeded();
        await expect(figure().locator(".mermaid-render-surface")).toBeVisible();
      }).toPass();
      const selectionTarget = window
        .locator(".markdown-body")
        .getByText("این متن باید بدون بازسازی نمودار انتخاب شود.", {
          exact: true,
        });
      await selectionTarget.scrollIntoViewIfNeeded();
      await figure().evaluate((element) =>
        element.setAttribute("data-test-mount-marker", "stable"),
      );
      const figureBefore = await figure().boundingBox();
      expect(figureBefore).not.toBeNull();

      await selectionTarget.selectText();
      const selectionTargetBox = await selectionTarget.boundingBox();
      expect(selectionTargetBox).not.toBeNull();
      await selectionTarget.dispatchEvent("mouseup", {
        clientX: selectionTargetBox!.x + selectionTargetBox!.width / 2,
        clientY: selectionTargetBox!.y + selectionTargetBox!.height / 2,
      });

      await expect(
        window.getByRole("toolbar", { name: "ابزار متن انتخاب‌شده" }),
      ).toBeVisible();
      await expect(figure()).toHaveAttribute("data-test-mount-marker", "stable");
      const figureAfter = await figure().boundingBox();
      expect(figureAfter).not.toBeNull();
      expect(Math.abs(figureAfter!.y - figureBefore!.y)).toBeLessThan(1);
      expect(Math.abs(figureAfter!.height - figureBefore!.height)).toBeLessThan(
        1,
      );
    } finally {
      await app.close();
      await rm(userDataPath, { recursive: true, force: true });
    }
  });
});
