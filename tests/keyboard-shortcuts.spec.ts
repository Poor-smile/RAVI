import { expect, test } from "@playwright/test";
import { _electron as electron } from "playwright";
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
} from "../app/keyboard/command-registry";
import {
  KeyboardEventLike,
  registryConflicts,
  resolveCommand,
} from "../app/keyboard/command-resolver";
import { mermaidRenderKey } from "../app/mermaid/renderer";
import { MERMAID_SAMPLES } from "../app/mermaid/samples";
import packageMetadata from "../package.json" with { type: "json" };

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

  test("keeps every sample identical from Studio to document", async () => {
    test.slow();
    test.setTimeout(150_000);
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
      const window = await app.firstWindow();
      const editor = window.locator("#markdown-editor");
      const editorContent = editor.locator(".cm-content");
      const openStudio = window.getByRole("button", {
        name: "ساخت نمودار Mermaid",
        exact: true,
      });
      await expect(editor).toBeVisible();
      await expect(openStudio).toBeVisible();
      const theme = ((await window
        .locator("html")
        .getAttribute("data-theme")) || "light") as "light" | "dark";

      for (const sample of MERMAID_SAMPLES) {
        await editorContent.fill("");
        await editorContent.focus();
        await openStudio.click();

        const studio = window.getByRole("dialog", {
          name: "ساخت نمودار",
          exact: true,
        });
        await expect(studio).toBeVisible();
        await studio
          .getByRole("button", { name: "کد پیشرفته", exact: true })
          .click();
        await studio
          .getByRole("button", { name: "نمونه‌های پیشرفته", exact: true })
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

        const studioRender = await studioSurface.evaluate((surface) => {
          const svg = surface.querySelector(":scope > svg");
          return {
            svg: svg?.outerHTML ?? "",
            text: svg?.textContent ?? "",
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
        const documentSurface = window.locator(
          `.mermaid-render-surface[data-mermaid-render-key="${expectedKey}"]`,
        );
        await expect(documentSurface).toBeVisible();
        const documentRender = await documentSurface.evaluate((surface) => {
          const svg = surface.querySelector(":scope > svg");
          return {
            svg: svg?.outerHTML ?? "",
            text: svg?.textContent ?? "",
          };
        });

        expect(documentRender.svg, `${sample.id} SVG parity`).toBe(
          studioRender.svg,
        );
        expect(documentRender.text, `${sample.id} label parity`).toBe(
          studioRender.text,
        );
      }

      await window
        .getByRole("button", { name: "حالت مطالعه", exact: true })
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
      await fullscreenButton.click();
      const detailedDiagram = window.locator(
        ".mermaid-diagram:fullscreen, .mermaid-diagram.is-detail-open",
      );
      await expect(detailedDiagram).toBeVisible();
      const closeFullscreenButton = window.getByRole("button", {
        name: "بستن نمای تمام‌صفحهٔ نمودار",
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
        Math.abs(
          toolbarBox!.x +
            toolbarBox!.width / 2 -
            (fullscreenBox!.x + fullscreenBox!.width / 2),
        ),
      ).toBeLessThan(2);
      expect(
        fullscreenBox!.y +
          fullscreenBox!.height -
          (toolbarBox!.y + toolbarBox!.height),
      ).toBeLessThanOrEqual(20);
      const fullscreenToolSizes = await fullscreenToolbar
        .getByRole("button")
        .evaluateAll((buttons) =>
          buttons.map((button) => {
            const rect = button.getBoundingClientRect();
            return { width: rect.width, height: rect.height };
          }),
        );
      for (const size of fullscreenToolSizes) {
        expect(size.width).toBeGreaterThanOrEqual(44);
        expect(size.height).toBeGreaterThanOrEqual(44);
      }
      expect(
        await closeFullscreenButton.evaluate(
          (button) =>
            button.closest(".mermaid-diagram-viewport-tools") !== null,
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
      const fittedTransform = await fullscreenSurface.evaluate(
        (surface) => (surface as HTMLElement).style.transform,
      );
      expect(fittedTransform).toMatch(
        /^translate\(-?\d+(?:\.\d+)?px, -?\d+(?:\.\d+)?px\) scale\((?:0?\.\d+|1)\)$/,
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
      const window = await app.firstWindow();
      const editor = window.locator("#markdown-editor");
      const editorContent = editor.locator(".cm-content");
      const editorScroller = editor.locator(".cm-scroller");
      await expect(editor).toBeVisible();
      const imageInput = window.locator(
        'input[accept="image/png,image/jpeg,image/webp,image/gif"]',
      );
      await expect(imageInput).toHaveCount(1);
      const imageButton = window.getByRole("button", {
        name: "افزودن تصویر",
        exact: true,
      });
      await imageButton.click();
      const imageDialog = window.locator(".image-insert-modal");
      await expect(imageDialog).toBeVisible();
      await expect(
        imageDialog.getByRole("tab", { name: "فایل محلی", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      await imageInput.setInputFiles(imageFixturePath);
      await expect(imageDialog).toBeHidden();
      await expect.poll(() => editorContent.textContent()).toContain("raavi-image://image-");
      await expect(window.locator(".markdown-body img").last()).toHaveAttribute(
        "src",
        /^data:image\/png;base64,/,
      );
      await imageButton.click();
      await imageDialog
        .getByRole("tab", { name: "نشانی اینترنتی", exact: true })
        .click();
      await expect(
        imageDialog.locator('[data-editable-kind="imageUrl"]'),
      ).toBeVisible();
      const remoteImageUrl = "https://example.com/reference-image.png";
      await imageDialog
        .locator('[data-editable-kind="imageUrl"]')
        .fill(remoteImageUrl);
      await imageDialog
        .getByRole("button", { name: "درج نشانی", exact: true })
        .click();
      await expect(imageDialog).toBeHidden();
      await expect.poll(() => editorContent.textContent()).toContain(remoteImageUrl);
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

      const supportTrigger = topbar.getByRole("button", {
        name: "حمایت از راوی",
        exact: true,
      });
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
      await expect(supportTrigger).toBeFocused();

      const aboutTrigger = topbar.getByRole("button", {
        name: "دربارهٔ راوی و نسخهٔ فعلی",
        exact: true,
      });
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
      await expect(aboutTrigger).toBeFocused();

      const initialEditorValue = await editorContent.innerText();
      await editorContent.fill(`${initialEditorValue}\n\nتغییر ذخیره‌نشده`);
      const newDocumentTrigger = topbar.getByRole("button", {
        name: "فایل جدید",
        exact: true,
      });
      await expect(newDocumentTrigger).toBeVisible();
      await newDocumentTrigger.click();
      const newDocumentDialog = window.getByRole("dialog", {
        name: "ساخت فایل جدید",
        exact: true,
      });
      const newDocumentName = newDocumentDialog.locator(
        '[data-editable-kind="saveName"]',
      ).first();
      await expect(newDocumentDialog).toBeVisible();
      await expect(newDocumentName).toBeFocused();
      await expect(
        newDocumentDialog.getByText("سند فعلی تغییر ذخیره‌نشده دارد", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(
        newDocumentDialog.getByText("نوشته تازه.md", { exact: true }),
      ).toBeVisible();

      await newDocumentName.fill("CON");
      await expect(
        newDocumentDialog.getByText(
          "این نام در ویندوز رزرو شده است؛ نام دیگری انتخاب کنید.",
          { exact: true },
        ),
      ).toBeVisible();
      await expect(
        newDocumentDialog.getByRole("button", {
          name: "ساخت بدون ذخیرهٔ قبلی",
          exact: true,
        }),
      ).toBeDisabled();

      await newDocumentName.fill("گزارش هفتگی.md");
      await expect(newDocumentName).toHaveValue("گزارش هفتگی");
      await expect(
        newDocumentDialog.getByText("گزارش هفتگی.md", { exact: true }),
      ).toBeVisible();
      await newDocumentDialog
        .getByRole("radio", { name: /سند راوی/ })
        .check();
      await expect(
        newDocumentDialog.getByText("گزارش هفتگی.ravi", { exact: true }),
      ).toBeVisible();
      await expect(
        newDocumentDialog.getByText(/نسخهٔ خوانای Markdown/),
      ).toBeVisible();
      await expect(topbar).toHaveAttribute("inert", "");
      await window.keyboard.press("Escape");
      await expect(newDocumentDialog).toBeHidden();
      await expect(newDocumentTrigger).toBeFocused();
      await editorContent.fill(initialEditorValue);
      await window.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
          }),
      );

      const previewScroll = window.locator(".preview-scroll");
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
        .poll(() =>
          previewScroll.evaluate((node: HTMLDivElement) => {
            const range = node.scrollHeight - node.clientHeight;
            return range > 0 ? node.scrollTop / range : 0;
          }),
        )
        .toBeCloseTo(0.7, 1);

      await previewScroll.evaluate((node: HTMLDivElement) => {
        node.scrollTop = (node.scrollHeight - node.clientHeight) * 0.25;
        node.dispatchEvent(new Event("scroll", { bubbles: true }));
      });
      await expect
        .poll(() =>
          editorScroller.evaluate((node: HTMLElement) => {
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
        name: "تغییر اندازهٔ ویرایشگر و پیش‌نمایش",
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
        .toBeLessThan(0);
      await paneSeparator.press("Enter");
      await expect(paneSeparator).toHaveAttribute("aria-valuenow", "50");

      await previewPane
        .getByRole("button", {
          name: "پنهان‌کردن پیش‌نمایش",
          exact: true,
        })
        .click();
      await expect(workspace).toHaveAttribute("data-pane-layout", "editor");
      await expect(previewPane).toHaveAttribute("aria-hidden", "true");
      const showPreview = window.getByRole("button", {
        name: "نمایش پیش‌نمایش",
        exact: true,
      });
      await expect(showPreview).toBeVisible();
      await showPreview.click();
      await expect(workspace).toHaveAttribute("data-pane-layout", "split");

      await editorPane
        .getByRole("button", {
          name: "پنهان‌کردن ویرایشگر",
          exact: true,
        })
        .click();
      await expect(workspace).toHaveAttribute("data-pane-layout", "preview");
      await expect(editorPane).toHaveAttribute("aria-hidden", "true");
      await window
        .getByRole("button", {
          name: "نمایش ویرایشگر",
          exact: true,
        })
        .click();
      await expect(workspace).toHaveAttribute("data-pane-layout", "split");
      await window.waitForTimeout(350);

      paneSeparator = window.getByRole("separator", {
        name: "تغییر اندازهٔ ویرایشگر و پیش‌نمایش",
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
        "preview",
      );
      await expect(paneSeparator).toHaveAttribute("aria-valuenow", "10");
      await window.mouse.up();
      await expect(workspace).toHaveAttribute("data-pane-layout", "editor");
      await expect(previewPane).toHaveAttribute("aria-hidden", "true");
      await window
        .getByRole("button", {
          name: "نمایش پیش‌نمایش",
          exact: true,
        })
        .click();
      await expect(workspace).toHaveAttribute("data-pane-layout", "split");
      await expect
        .poll(() =>
          window.evaluate(() =>
            window.localStorage.getItem("raavi:pane-layout:v1"),
          ),
        )
        .toContain('"mode":"split"');

      const readingModeButton = topbar.getByRole("button", {
        name: /حالت مطالعه/,
      });
      await readingModeButton.click();

      const readingHeader = window.locator(".reading-topbar");
      const readingFileName = readingHeader.locator(
        ".reading-header-document strong",
      );
      const backToDesk = readingHeader.getByRole("button", {
        name: /بازگشت به میز/,
      });
      await expect(readingFileName).toHaveText("راهنمای-راوی.md");
      await expect(backToDesk).toBeVisible();
      const readingFileNameBox = await readingFileName.boundingBox();
      const backToDeskBox = await backToDesk.boundingBox();
      expect(readingFileNameBox).not.toBeNull();
      expect(backToDeskBox).not.toBeNull();
      expect(backToDeskBox!.x).toBeLessThan(readingFileNameBox!.x);

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
      await expect(readingOutline).toHaveCount(0);
      const headerOutlineToggle = readingHeader.getByRole("button", {
        name: "بازکردن فهرست فصل‌ها",
        exact: true,
      });
      await expect(headerOutlineToggle).toHaveAttribute(
        "aria-label",
        "بازکردن فهرست فصل‌ها",
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
      await headerOutlineToggle.click();
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

      const themeToggle = topbar.locator(".theme-toggle");
      const documentRoot = window.locator("html");
      await expect(themeToggle).toBeVisible();
      await expect(themeToggle).toHaveAttribute("aria-keyshortcuts", "Alt+T");

      if ((await documentRoot.getAttribute("data-theme")) === "dark") {
        await themeToggle.click();
        await expect(documentRoot).toHaveAttribute("data-theme", "light");
        await expect(window.locator(".theme-transition-overlay")).toHaveCount(
          0,
        );
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
      await expect(themeToggle).toHaveAttribute(
        "aria-label",
        "فعال‌کردن تم روشن",
      );
      await expect(window.locator(".theme-transition-overlay")).toHaveCount(0);

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
          const elementResults = elementPairs.map(
            ([foregroundSelector, backgroundSelector]) => {
              const foreground = getComputedStyle(
                document.querySelector(foregroundSelector)!,
              ).color;
              const background = getComputedStyle(
                document.querySelector(backgroundSelector)!,
              ).backgroundColor;
              return {
                pair: `${foregroundSelector}/${backgroundSelector}`,
                ratio: ratio(foreground, background),
              };
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
      await expect(themeToggle).toHaveAttribute(
        "aria-label",
        "فعال‌کردن تم تاریک",
      );
      await expect(window.locator(".theme-transition-overlay")).toHaveCount(0);
      const lightContrast = await measureThemeContrast();
      for (const pair of lightContrast) {
        expect(pair.ratio, `${pair.pair} contrast`).toBeGreaterThanOrEqual(4.5);
      }

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

      const directoryInput = window.locator("input[webkitdirectory]");
      await directoryInput.setInputFiles(libraryFixturePath);
      await expect(sidebar.locator(".library-file")).toHaveCount(2);

      const pinnedSection = sidebar.locator(".library-pinned-section");
      const pinnedFileName = "pinned-reference.md";
      const originalPinButton = sidebar.getByRole("button", {
        name: `سنجاق‌کردن «${pinnedFileName}»`,
        exact: true,
      });
      await originalPinButton.click();
      await expect(
        pinnedSection.getByText(pinnedFileName, { exact: true }),
      ).toBeVisible();
      await expect(
        sidebar.getByText(pinnedFileName, { exact: true }),
      ).toHaveCount(2);

      await expect
        .poll(() =>
          window.evaluate(() =>
            window.localStorage.getItem("raavi:library-pins:v1"),
          ),
        )
        .toContain("pinned-reference.md");

      const unpinButton = pinnedSection.getByRole("button", {
        name: `برداشتن «${pinnedFileName}» از سنجاق‌شده‌ها`,
        exact: true,
      });
      await unpinButton.click();
      await expect(
        pinnedSection.getByText(pinnedFileName, { exact: true }),
      ).toHaveCount(0);
      await expect(
        sidebar.getByText(pinnedFileName, { exact: true }),
      ).toHaveCount(1);
      await expect(originalPinButton).toHaveAttribute("aria-pressed", "false");

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
      await editorContent.fill("نمونه");
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
      await selectAllEditorText();
      await dispatchShortcut({ code: "KeyB", key: "b", ctrlKey: true });
      await expect(editorContent).toHaveText("**sample**");

      await editorContent.fill("mini menu");
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
        "کد درون‌خطی",
        "نقل‌قول",
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
      await expect(editorContent).toHaveText("**mini menu**");
      await expect(editorSelectionMenu).toBeHidden();

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

      await editorContent.focus();
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
      await expect(editorContent).toBeFocused();

      await editorContent.focus();
      await dispatchShortcut({ code: "F1", key: "F1" });
      await expect(shortcutTitle).toBeVisible();
      await dispatchShortcut({ code: "Escape", key: "Escape" });
      await expect(editorContent).toBeFocused();

      const markdownBody = window.locator(".markdown-body");
      await editorContent.fill(
        "# English document\n\nThis document is written entirely in English.",
      );
      await expect(markdownBody).toHaveAttribute("dir", "ltr");
      await expect(markdownBody).toHaveCSS("text-align", "left");
      await expect(markdownBody.locator("h1")).toHaveAttribute("dir", "ltr");
      await expect(markdownBody.locator("p")).toHaveAttribute("dir", "ltr");

      await editorContent.fill(
        [
          "# Mixed document",
          "",
          "This paragraph is written almost entirely in English with فقط one Persian word.",
          "",
          "این پاراگراف فارسی است و فقط چند English word در آن دیده می‌شود.",
        ].join("\n"),
      );
      await expect(markdownBody).toHaveAttribute("dir", "rtl");
      await expect(markdownBody.locator("h1")).toHaveAttribute("dir", "ltr");
      await expect(markdownBody.locator("p").nth(0)).toHaveAttribute(
        "dir",
        "ltr",
      );
      await expect(markdownBody.locator("p").nth(1)).toHaveAttribute(
        "dir",
        "rtl",
      );

      await dispatchShortcut({ code: "F9", key: "F9" });
      await expect(window.locator(".app-shell")).toHaveClass(/is-reading/);
      await dispatchShortcut({ code: "Escape", key: "Escape" });
      await expect(window.locator(".app-shell")).not.toHaveClass(/is-reading/);

      const selectionTarget = markdownBody.locator("p").nth(1);
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
        selectionMenu.getByRole("button", { name: /کامنت/ }),
      ).toBeVisible();
      await expect(
        selectionMenu.getByRole("button", { name: /حاشیه/ }),
      ).toBeVisible();
      await expect(
        selectionMenu.getByRole("button", { name: "کپی" }),
      ).toBeVisible();

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

      await selectionMenu.getByRole("button", { name: "کپی" }).click();
      await expect(selectionMenu).toBeHidden();
      await expect(selectionFeedback.first()).toBeVisible();

      await selectionTarget.selectText();
      await selectionTarget.dispatchEvent("mouseup", selectionPointer);
      await expect(selectionMenu).toBeVisible();
      await selectionMenu.getByRole("button", { name: /هایلایت/ }).click();
      await expect(selectionMenu).toBeHidden();
      await expect(window.locator("#annotation-panel")).toBeVisible();
    } finally {
      await app.close();
      await rm(userDataPath, { recursive: true, force: true });
    }
  });

  test("keeps copied preview selection visibly highlighted", async () => {
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
      const window = await app.firstWindow();
      const editor = window.locator("#markdown-editor");
      const editorContent = editor.locator(".cm-content");
      const markdownBody = window.locator(".markdown-body");
      await expect(editor).toBeVisible();
      await editorContent.fill(
        "# انتخاب متن\n\nاین متن برای بررسی ماندگاری محدودهٔ انتخاب‌شده است.",
      );

      const selectionTarget = markdownBody.locator("p");
      await expect(selectionTarget).toHaveText(
        "این متن برای بررسی ماندگاری محدودهٔ انتخاب‌شده است.",
      );
      const selectionTargetBox = await selectionTarget.boundingBox();
      expect(selectionTargetBox).not.toBeNull();
      await selectionTarget.selectText();
      await expect
        .poll(() => window.evaluate(() => window.getSelection()?.toString()))
        .toBe("این متن برای بررسی ماندگاری محدودهٔ انتخاب‌شده است.");
      await selectionTarget.dispatchEvent("mouseup", {
        clientX: selectionTargetBox!.x + selectionTargetBox!.width / 2,
        clientY: selectionTargetBox!.y + selectionTargetBox!.height / 2,
      });

      const selectionMenu = window.getByRole("toolbar", {
        name: "ابزار متن انتخاب‌شده",
      });
      const selectionFeedback = window.locator(".selection-range-feedback");
      await expect(selectionMenu).toBeVisible();
      await expect(selectionFeedback.first()).toBeVisible();

      await selectionMenu.getByRole("button", { name: "کپی" }).click();
      await expect(selectionMenu).toBeHidden();
      await expect(selectionFeedback.first()).toBeVisible();

      await selectionTarget.click();
      await expect(selectionFeedback.first()).toBeVisible();
    } finally {
      await app.close();
      await rm(userDataPath, { recursive: true, force: true });
    }
  });

  test("keeps reading-mode media mounted while selecting text", async () => {
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
      const window = await app.firstWindow();
      const editorContent = window.locator("#markdown-editor .cm-content");
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

      const figure = window.locator(".mermaid-diagram");
      await expect(figure).toHaveClass(/is-valid/);
      await window
        .getByRole("button", { name: "حالت مطالعه", exact: true })
        .click();
      await expect(window.locator(".app-shell")).toHaveClass(/is-reading/);

      const selectionTarget = window.locator(".markdown-body p");
      await selectionTarget.scrollIntoViewIfNeeded();
      await figure.evaluate((element) =>
        element.setAttribute("data-test-mount-marker", "stable"),
      );
      const figureBefore = await figure.boundingBox();
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
      await expect(figure).toHaveAttribute("data-test-mount-marker", "stable");
      const figureAfter = await figure.boundingBox();
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
