import type { PersistedDocumentSession } from "./document-session";

const DATABASE = "raavi-document-session";
const STORE = "session";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// IndexedDB stores structured data asynchronously. Large tab snapshots must
// not be stringified and synchronously written into localStorage on typing.
export async function readDocumentSession(): Promise<unknown> {
  if (window.raaviDesktop?.getDocumentSession) return window.raaviDesktop.getDocumentSession();
  const db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).get("current");
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}

async function persistSession(session: PersistedDocumentSession) {
    if (window.raaviDesktop?.saveDocumentSession) {
      await window.raaviDesktop.saveDocumentSession(session);
      return;
    }
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(STORE, "readwrite");
        transaction.objectStore(STORE).put(session, "current");
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error ?? new Error("Session write aborted"));
      });
    } finally { db.close(); }
}

let running = false;
let pending: PersistedDocumentSession | null = null;
let waiters: { resolve: () => void; reject: (error: unknown) => void }[] = [];

async function drain() {
  if (running) return;
  running = true;
  try {
    while (pending) {
      const session = pending;
      const currentWaiters = waiters;
      pending = null;
      waiters = [];
      try {
        await persistSession(session);
        currentWaiters.forEach(waiter => waiter.resolve());
      } catch (error) { currentWaiters.forEach(waiter => waiter.reject(error)); }
    }
  } finally { running = false; }
}

export function writeDocumentSession(session: PersistedDocumentSession) {
  // The main process owns coalescing across renderer lifetimes. Dispatch the
  // final pagehide checkpoint immediately, even if an older IPC is awaiting IO.
  if (window.raaviDesktop?.saveDocumentSession) {
    return window.raaviDesktop.saveDocumentSession(session).then(() => {});
  }
  // One in-flight checkpoint and one latest pending checkpoint. Slow storage
  // must not retain a full document snapshot for every intermediate keystroke.
  pending = session;
  const result = new Promise<void>((resolve, reject) => { waiters.push({ resolve, reject }); });
  void drain();
  return result;
}
