import path from "node:path";
import { createSnapshotStorage } from "./snapshot-storage.mjs";

// The desktop server chooses a new port on launch. Browser-origin storage
// cannot carry the tab session across launches; keep it in the user profile.
export function createDocumentSessionStore(filePath, { storage = createSnapshotStorage(path.join(path.dirname(filePath), "state-store")) } = {}) {
  let pending = null;
  let running = null;
  let waiters = [];
  let latest = null;
  let uncommitted = false;
  const read = async () => {
    // Reload can arrive while the previous renderer's final checkpoint is
    // still replacing the file. Restore the newest received state directly;
    // an in-process reload need not wait for disk or Windows ACL preparation.
    if (latest) return latest;
    try {
      const stored = await storage.read(filePath);
      return latest ?? stored;
    }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
  };
  const drain = async () => {
    while (pending) {
      const session = pending;
      const currentWaiters = waiters;
      pending = null;
      waiters = [];
      try {
        await storage.write(filePath, session);
        if (latest === session) uncommitted = false;
        currentWaiters.forEach(waiter => waiter.resolve({ saved: true }));
      } catch (error) { currentWaiters.forEach(waiter => waiter.reject(error)); }
    }
  };
  const write = session => {
    if (!session || session.version !== 2 || !Array.isArray(session.tabs) || !Array.isArray(session.closedTabs)) {
      return Promise.reject(new Error("Document session is invalid."));
    }
    latest = session;
    uncommitted = true;
    pending = session;
    const result = new Promise((resolve, reject) => { waiters.push({ resolve, reject }); });
    start();
    return result;
  };
  const start = () => {
    if (!running) running = drain().finally(() => {
      running = null;
      if (pending) start();
    });
  };
  const flush = async () => {
    while (running) await running;
    if (uncommitted) await write(latest);
  };
  return { read, write, flush, isWriting: () => running !== null, hasUncommitted: () => uncommitted };
}
