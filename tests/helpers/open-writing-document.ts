import type { Page } from "@playwright/test";

export const WRITING_DOCUMENT_FIXTURE = [
  "# نوشتن برای خوانده‌شدن",
  "",
  "هر بخش باید یک ایدهٔ روشن داشته باشد و فاصله‌ها به چشم فرصت مکث بدهند.",
  "",
  "> ساختار، پیش از تزئین، به خواننده اطمینان می‌دهد.",
  "",
  "- [ ] مثال‌ها را بازبینی کن",
  "",
  "",
].join("\n");

export async function openWritingDocument(
  page: Page,
  options: {
    content?: string;
    fileName?: string;
    savedContent?: string;
  } = {},
) {
  const content = options.content ?? WRITING_DOCUMENT_FIXTURE;
  const initializationKey = `raavi:test-writing:${Date.now()}:${Math.random()}`;
  await page.addInitScript(
    ({ nextContent, fileName, savedContent, initializationKey }) => {
      const marker = "raavi:test-writing-init";
      if (window.sessionStorage.getItem(marker) === initializationKey) return;
      window.sessionStorage.setItem(marker, initializationKey);
      window.localStorage.removeItem("raavi:document-session:v1");
      window.localStorage.removeItem("raavi:document-session:v2");
      window.localStorage.setItem(
        "raavi:document:v1",
        JSON.stringify({
          fileName,
          content: nextContent,
          readerSize: 18,
          annotations: [],
          assets: [],
          revision: 1,
          versions: [],
          activeDocumentPath: "",
          documentType: "ravi",
          lastSavedSnapshot: savedContent,
          draftId: `test-writing-${Date.now()}`,
          viewMode: "desk",
          readingOutlineOpen: false,
          readingPositions: {},
          annotationComposer: null,
        }),
      );
    },
    {
      nextContent: content,
      fileName: options.fileName ?? "سند جدید",
      savedContent: options.savedContent ?? "",
      initializationKey,
    },
  );
  await page.reload();
  await page.locator("#markdown-editor .cm-content").waitFor({ state: "visible" });
}
