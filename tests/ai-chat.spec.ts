import { expect, test } from "@playwright/test";
import { openWritingDocument } from "./helpers/open-writing-document";

test("AI chat opens from the document, block and text selection contexts", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page);

  const railTrigger = page.getByRole("button", {
    name: "راوی هوشمند",
    exact: true,
  });
  await railTrigger.click();
  await expect(page.locator("#sidebar-pane-title")).toHaveText("راوی هوشمند");
  await expect(page.locator(".ai-context-chip")).toContainText("کل سند");
  await expect(page.locator(".ai-chat-panel")).toContainText(
    "این اتصال در نسخهٔ دسکتاپ فعال است",
  );

  const editor = page.locator("#markdown-editor .cm-content");
  await editor.focus();
  await page.keyboard.press("Control+End");
  await page.locator(".writing-block-ai-trigger").click();
  await expect(page.locator(".ai-context-chip")).toContainText("بلاک فعال");

  await editor.fill("متن انتخاب‌شده برای گفتگو");
  await editor.focus();
  await page.keyboard.press("Control+a");
  const selectionToolbar = page.getByRole("toolbar", {
    name: "قالب‌بندی متن انتخاب‌شده",
  });
  await expect(selectionToolbar).toBeVisible();
  await selectionToolbar
    .getByRole("button", { name: "ابزارهای بیشتر", exact: true })
    .click();
  const moreMenu = page.getByRole("menu", {
    name: "ابزارهای بیشتر متن انتخاب‌شده",
  });
  await expect(
    moreMenu
      .getByRole("menuitem", { name: "پاک‌کردن قالب‌بندی" })
      .locator('[data-material-symbol="format_clear"]'),
  ).toHaveCount(1);
  await expect(selectionToolbar.locator(".magic-wand-icon")).toHaveCount(1);
  await selectionToolbar
    .getByRole("button", { name: "گفت‌وگو دربارهٔ متن انتخاب‌شده" })
    .click();
  await expect(page.locator(".ai-context-chip")).toContainText(
    "متن انتخاب‌شده",
  );
});

test("AI composer uses one input for free prompts and all 47 slash commands", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page);
  await page.evaluate(() => {
    Object.defineProperty(window, "raaviDesktop", {
      configurable: true,
      value: {
        getCodexConnectionStatus: async () => ({ state: "connected" }),
        runCodexPrompt: async () => ({
          answer: "پیشنهاد آزمایشی آماده شد.",
          replacement: null,
        }),
      },
    });
  });

  await page.getByRole("button", { name: "راوی هوشمند", exact: true }).click();
  const composer = page.getByRole("combobox", {
    name: "پیام به راوی هوشمند",
  });
  await expect(composer).toBeVisible();
  await expect(composer).toHaveAttribute("dir", "rtl");
  await expect(composer).toHaveAttribute(
    "placeholder",
    "درخواستتان را بنویسید…",
  );
  await expect(page.locator(".ai-quick-prompts .ai-command-button")).toHaveCount(
    4,
  );

  await composer.fill("/");
  await expect(
    page.getByRole("listbox", { name: "فرمان‌های نوشتاری راوی" }),
  ).toBeVisible();
  await expect(page.getByRole("option")).toHaveCount(47);
  await expect
    .poll(() =>
      page
        .locator(".ai-command-button")
        .first()
        .evaluate((node) => getComputedStyle(node).fontSize),
    )
    .toBe("11px");
  await expect
    .poll(() => composer.evaluate((node) => getComputedStyle(node).fontSize))
    .toBe("12px");
  for (let index = 0; index < 12; index += 1) {
    await composer.press("ArrowDown");
  }
  await expect(page.getByRole("option").nth(12)).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect
    .poll(() =>
      page.locator(".ai-command-results").evaluate((node) => node.scrollTop),
    )
    .toBeGreaterThan(0);
  await composer.fill("/جدول");
  await expect(page.getByRole("option")).toHaveCount(4);
  await expect(page.getByRole("option").first()).toContainText("جدول");

  await composer.fill("");
  await expect(
    page.getByRole("listbox", { name: "فرمان‌های نوشتاری راوی" }),
  ).toHaveCount(0);
  await expect(page.locator(".ai-quick-prompts .ai-command-button")).toHaveCount(
    4,
  );
});

test("missing ChatGPT connection opens setup and keeps login, model selection and reconnect", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 914 });
  await page.goto("/");
  await expect(page.locator(".app-shell")).toHaveAttribute(
    "data-hydrated",
    "true",
  );
  await openWritingDocument(page);
  await page.evaluate(() => {
    window.localStorage.removeItem("raavi:ai-preferences:v1");
    let connectionState: "auth_required" | "connected" = "auth_required";
    const audioState = {
      supported: true,
      activeTier: null,
      installState: "idle" as const,
      installTier: null,
      installComponent: null,
      progress: 0,
      downloadedBytes: 0,
      totalBytes: 0,
      error: "",
      tiers: [
        { id: "light" as const, label: "سبک", suitableFor: "سیستم ضعیف", detail: "سریع", sizeBytes: 60_000_000, installed: false, recommended: false },
        { id: "balanced" as const, label: "متعادل", suitableFor: "سیستم معمولی", detail: "متعادل", sizeBytes: 190_000_000, installed: false, recommended: true },
        { id: "accurate" as const, label: "دقیق", suitableFor: "سیستم قوی", detail: "دقیق‌تر", sizeBytes: 540_000_000, installed: false, recommended: false },
      ],
    };
    Object.defineProperty(window, "raaviDesktop", {
      configurable: true,
      value: {
        getCodexConnectionStatus: async () => ({ state: connectionState }),
        getCodexModels: async () => ({
          models: [
            { id: "gpt-5.6-sol", displayName: "GPT-5.6-Sol", description: "دقیق‌تر", isDefault: true },
            { id: "gpt-5.6-terra", displayName: "GPT-5.6-Terra", description: "متعادل", isDefault: false },
          ],
          defaultModel: "gpt-5.6-sol",
        }),
        getAudioModelState: async () => audioState,
        saveAiPreferences: async (preferences: { model: string }) => {
          window.localStorage.setItem(
            "raavi:test-native-ai-preferences",
            JSON.stringify(preferences),
          );
          return { saved: true, preferences };
        },
        startCodexLogin: async () => {
          connectionState = "connected";
          return { started: true, state: "auth_waiting" as const };
        },
        resetCodexConnection: async () => {
          connectionState = "auth_required";
          window.localStorage.setItem("raavi:test-chatgpt-reset", "true");
          return { state: "auth_required" as const };
        },
        installAudioModel: async () => audioState,
        deleteAudioModel: async () => audioState,
        onAudioLocalEvent: () => () => {},
      },
    });
  });

  await page.getByRole("button", { name: "راوی هوشمند", exact: true }).click();
  const setup = page.getByRole("dialog", {
    name: "برای استفاده از راوی هوشمند، به ChatGPT وصل شوید",
  });
  await expect(setup).toBeVisible();
  await setup.getByRole("button", { name: "تنظیم اتصال ChatGPT" }).click();

  await expect(page.getByRole("heading", { name: "هوش مصنوعی و گفتار" })).toBeVisible();
  const chatgptConnection = page.locator(".chatgpt-connection");
  await expect(chatgptConnection).toHaveCount(1);
  await expect(chatgptConnection).toContainText("ChatGPT");
  await expect(page.getByText("Claude Code")).toHaveCount(0);
  await expect(page.getByText("Gemini CLI")).toHaveCount(0);
  await expect(page.getByText("Cursor Agent")).toHaveCount(0);
  await expect(page.getByText("GitHub Copilot")).toHaveCount(0);
  await chatgptConnection.getByRole("button", { name: "ورود با ChatGPT" }).click();
  await chatgptConnection.getByRole("button", { name: "ورود را انجام دادم" }).click();
  await expect(chatgptConnection).toContainText("متصل و آماده");
  const modelSelect = chatgptConnection.getByRole("combobox", { name: "مدل ChatGPT" });
  await expect(modelSelect).toHaveValue("gpt-5.6-sol");
  await modelSelect.selectOption("gpt-5.6-terra");
  await expect(modelSelect).toHaveValue("gpt-5.6-terra");
  page.once("dialog", (dialog) => dialog.accept());
  await chatgptConnection.getByRole("button", { name: "قطع و اتصال دوباره" }).click();
  await expect(chatgptConnection).toContainText("در انتظار تکمیل ورود در مرورگر");
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("raavi:test-chatgpt-reset"))).toBe("true");
  await expect(page.locator(".speech-tier-row")).toHaveCount(3);
  await expect(page.locator(".speech-tier-list")).toContainText("پیشرفته");
  await expect.poll(() => page.evaluate(() => {
    const stored = window.localStorage.getItem("raavi:test-native-ai-preferences");
    return stored ? JSON.parse(stored).model : null;
  })).toBe("gpt-5.6-terra");

  await page.getByRole("button", { name: "بازگشت به سند", exact: true }).click();
  await page.locator(".header-overflow-trigger").click();
  await page.locator('[data-overflow-action="shortcut-settings"]').click();
  await page.getByRole("button", { name: "هوش مصنوعی و گفتار", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "مدل ChatGPT" })).toHaveValue("gpt-5.6-terra");
});
