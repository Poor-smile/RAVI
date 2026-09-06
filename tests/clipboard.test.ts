import assert from "node:assert/strict";
import test from "node:test";
import { JSDOM } from "jsdom";
import { copyPlainText } from "../app/editor/clipboard";

test("clipboard fallback copies text and restores focus and selection", async () => {
  const dom = new JSDOM(
    '<!doctype html><div id="before" contenteditable="true"><span id="selection">متن انتخاب‌شده</span></div>',
    { pretendToBeVisual: true },
  );
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const previousHTMLElement = Object.getOwnPropertyDescriptor(globalThis, "HTMLElement");
  const document = dom.window.document;
  let fallbackInvoked = false;
  Object.assign(document, {
    execCommand(command: string) {
      fallbackInvoked = command === "copy";
      return fallbackInvoked;
    },
  });
  Object.defineProperties(globalThis, {
    document: { configurable: true, value: document },
    HTMLElement: { configurable: true, value: dom.window.HTMLElement },
    navigator: {
      configurable: true,
      value: { clipboard: { writeText: async () => Promise.reject(new Error("denied")) } },
    },
  });

  try {
    const editor = document.querySelector<HTMLElement>("#before")!;
    const text = document.querySelector<HTMLElement>("#selection")!;
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(text);
    document.getSelection()!.removeAllRanges();
    document.getSelection()!.addRange(range);

    assert.equal(await copyPlainText("کد فارسی"), true);
    assert.equal(fallbackInvoked, true);
    assert.equal(document.activeElement, editor);
    assert.equal(document.getSelection()!.toString(), "متن انتخاب‌شده");
  } finally {
    dom.window.close();
    restoreGlobal("document", previousDocument);
    restoreGlobal("navigator", previousNavigator);
    restoreGlobal("HTMLElement", previousHTMLElement);
  }
});

function restoreGlobal(
  key: "document" | "navigator" | "HTMLElement",
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) Object.defineProperty(globalThis, key, descriptor);
  else Reflect.deleteProperty(globalThis, key);
}
