import assert from "node:assert/strict";
import test from "node:test";
import {
  BackLayerController,
  BackLayerEventPort,
  BackLayerHistoryPort,
  BackLayerScheduler,
} from "../app/back-layer-controller";

class FakeBrowser implements BackLayerHistoryPort, BackLayerEventPort {
  private entries: unknown[] = [{ route: "document" }];
  private index = 0;
  private listeners = new Set<() => void>();
  leftDocument = false;

  get state() {
    return this.entries[this.index];
  }

  get historyIndex() {
    return this.index;
  }

  pushState(data: unknown) {
    this.entries = this.entries.slice(0, this.index + 1);
    this.entries.push(data);
    this.index += 1;
  }

  replaceState(data: unknown) {
    this.entries[this.index] = data;
  }

  back() {
    if (this.index === 0) {
      this.leftDocument = true;
      return;
    }
    this.index -= 1;
    for (const listener of this.listeners) listener();
  }

  addEventListener(_type: "popstate", listener: () => void) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: "popstate", listener: () => void) {
    this.listeners.delete(listener);
  }
}

class FakeScheduler implements BackLayerScheduler {
  private callbacks: Array<() => void> = [];

  microtask(callback: () => void) {
    this.callbacks.push(callback);
  }

  flush() {
    const callbacks = this.callbacks;
    this.callbacks = [];
    for (const callback of callbacks) callback();
  }
}

function setup() {
  const browser = new FakeBrowser();
  const scheduler = new FakeScheduler();
  const controller = new BackLayerController(browser, browser, scheduler);
  controller.start();
  return { browser, controller, scheduler };
}

test("Back dismisses one nested layer at a time without leaving the document", () => {
  const { browser, controller, scheduler } = setup();
  const dismissed: string[] = [];
  let unregisterLibrary = () => {};
  let unregisterMenu = () => {};

  unregisterLibrary = controller.register("library", () => {
    dismissed.push("library");
    unregisterLibrary();
  });
  unregisterMenu = controller.register("mobile-menu", () => {
    dismissed.push("mobile-menu");
    unregisterMenu();
  });

  browser.back();
  assert.deepEqual(dismissed, ["mobile-menu"]);
  assert.equal(browser.historyIndex, 1);
  assert.equal(browser.leftDocument, false);

  browser.back();
  scheduler.flush();
  assert.deepEqual(dismissed, ["mobile-menu", "library"]);
  assert.equal(browser.historyIndex, 0);
  assert.equal(browser.leftDocument, false);
});
test("manual close removes the guard without adding a dead Back step", () => {
  const { browser, controller, scheduler } = setup();
  const unregister = controller.register("library", () => {});

  assert.equal(browser.historyIndex, 1);
  unregister();
  scheduler.flush();

  assert.equal(browser.historyIndex, 0);
  assert.equal(browser.leftDocument, false);
  assert.deepEqual(browser.state, { route: "document" });
});

test("replacing a layer in the same commit preserves the active guard", () => {
  const { browser, controller, scheduler } = setup();
  const dismissed: string[] = [];
  const unregisterMenu = controller.register("mobile-menu", () => {});

  unregisterMenu();
  let unregisterDialog = () => {};
  unregisterDialog = controller.register("new-document", () => {
    dismissed.push("new-document");
    unregisterDialog();
  });
  scheduler.flush();

  assert.equal(browser.historyIndex, 1);
  browser.back();
  scheduler.flush();
  assert.deepEqual(dismissed, ["new-document"]);
  assert.equal(browser.historyIndex, 0);
  assert.equal(browser.leftDocument, false);
});

test("a Back handler may open a confirmation layer without dropping the guard", () => {
  const { browser, controller } = setup();
  const dismissed: string[] = [];
  let unregisterConfirm = () => {};

  controller.register("mermaid-studio", () => {
    dismissed.push("request-close");
    unregisterConfirm = controller.register("mermaid-confirm", () => {
      dismissed.push("confirm");
      unregisterConfirm();
    });
  });

  browser.back();
  assert.deepEqual(dismissed, ["request-close"]);
  assert.equal(browser.historyIndex, 1);

  browser.back();
  assert.deepEqual(dismissed, ["request-close", "confirm"]);
  assert.equal(browser.historyIndex, 1);
  assert.equal(browser.leftDocument, false);
});

test("rapid Back presses never cross the guard while a layer remains", () => {
  const { browser, controller } = setup();
  let dismissRequests = 0;
  controller.register("slow-layer", () => {
    dismissRequests += 1;
  });

  browser.back();
  browser.back();
  browser.back();

  assert.equal(dismissRequests, 3);
  assert.equal(browser.historyIndex, 1);
  assert.equal(browser.leftDocument, false);
});
