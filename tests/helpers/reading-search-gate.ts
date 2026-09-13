import { expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    readingSearchGate: {
      hold: boolean;
      pending: number;
      flush: () => number;
    };
  }
}

/** Delay delivery of real worker replies, never replace the search algorithm. */
export async function installReadingSearchGate(page: Page) {
  await page.addInitScript(() => {
    const NativeWorker = window.Worker;
    const queued: { worker: Worker; data: unknown }[] = [];
    const gate: Window["readingSearchGate"] = {
      hold: true,
      get pending() { return queued.length; },
      flush() {
        gate.hold = false;
        const messages = queued.splice(0);
        for (const { worker, data } of messages) {
          worker.dispatchEvent(new MessageEvent("message", { data }));
        }
        return messages.length;
      },
    };
    window.readingSearchGate = gate;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        if (!String(url).includes("reading-document")) return;
        // Register before the application sets onmessage, so even a completed
        // reply can be delivered after a later document has already searched.
        this.addEventListener("message", event => {
          if (!gate.hold) return;
          event.stopImmediatePropagation();
          queued.push({ worker: this, data: event.data });
        });
      }
    };
  });
}

export async function waitForHeldSearch(page: Page) {
  await expect.poll(() => page.evaluate(() => window.readingSearchGate.pending)).toBeGreaterThan(0);
  await page.evaluate(() => { window.readingSearchGate.hold = false; });
}

export async function flushOldSearch(page: Page) {
  expect(await page.evaluate(() => window.readingSearchGate.flush())).toBeGreaterThan(0);
  // Let React process a wrongly accepted event before assertions inspect UI.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}
