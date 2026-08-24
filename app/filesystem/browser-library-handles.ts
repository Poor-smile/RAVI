import type { BrowserDirectoryHandle } from "./browser-adapter";

const DATABASE_NAME = "raavi-library-handles";
const DATABASE_VERSION = 1;
const STORE_NAME = "directories";

export type PersistedBrowserLibraryHandle = {
  id: string;
  name: string;
  handle: BrowserDirectoryHandle;
};

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("INDEXEDDB_UNAVAILABLE"));
      return;
    }
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () =>
      reject(request.error ?? new Error("LIBRARY_HANDLE_DB_OPEN_FAILED")),
    );
  });
}

export async function readBrowserLibraryHandles() {
  const database = await openDatabase();
  return new Promise<PersistedBrowserLibraryHandle[]>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    request.addEventListener("success", () => {
      resolve(
        (request.result as PersistedBrowserLibraryHandle[]).filter(
          (record) => record?.handle?.kind === "directory",
        ),
      );
      database.close();
    });
    request.addEventListener("error", () => {
      reject(request.error ?? new Error("LIBRARY_HANDLE_DB_READ_FAILED"));
      database.close();
    });
  });
}

export async function persistBrowserLibraryHandle(
  record: PersistedBrowserLibraryHandle,
) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(record);
    transaction.addEventListener("complete", () => {
      resolve();
      database.close();
    });
    transaction.addEventListener("error", () => {
      reject(transaction.error ?? new Error("LIBRARY_HANDLE_DB_WRITE_FAILED"));
      database.close();
    });
  });
}

export async function removeBrowserLibraryHandle(id: string) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(id);
    transaction.addEventListener("complete", () => {
      resolve();
      database.close();
    });
    transaction.addEventListener("error", () => {
      reject(transaction.error ?? new Error("LIBRARY_HANDLE_DB_DELETE_FAILED"));
      database.close();
    });
  });
}
