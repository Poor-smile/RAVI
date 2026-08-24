import {
  joinLibraryPath,
  libraryBaseName,
  makeLibraryError,
  normalizeLibraryRelativePath,
  parentLibraryPath,
  validateLibraryDocumentRename,
  validateLibraryEntryName,
  type LibraryMutationRequest,
  type LibraryMutationResult,
} from "./contract";

export type BrowserFileHandle = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
  createWritable?: () => Promise<{
    write: (data: Blob | BufferSource | string) => Promise<void>;
    close: () => Promise<void>;
    abort?: () => Promise<void>;
  }>;
  move?: (directory: BrowserDirectoryHandle, name?: string) => Promise<void>;
};

export type BrowserDirectoryHandle = {
  kind: "directory";
  name: string;
  values: () => AsyncIterableIterator<BrowserFileHandle | BrowserDirectoryHandle>;
  getFileHandle?: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<BrowserFileHandle>;
  getDirectoryHandle?: (
    name: string,
    options?: { create?: boolean },
  ) => Promise<BrowserDirectoryHandle>;
  removeEntry?: (
    name: string,
    options?: { recursive?: boolean },
  ) => Promise<void>;
  requestPermission?: (options?: { mode?: "read" | "readwrite" }) => Promise<string>;
  queryPermission?: (options?: { mode?: "read" | "readwrite" }) => Promise<string>;
  move?: (directory: BrowserDirectoryHandle, name?: string) => Promise<void>;
};

type BrowserSnapshot =
  | { kind: "file"; name: string; bytes: ArrayBuffer }
  | { kind: "directory"; name: string; children: BrowserSnapshot[] };

export type BrowserUndoRecord = {
  rootId: string;
  parentPath: string;
  snapshot: BrowserSnapshot;
};

async function getDirectory(
  root: BrowserDirectoryHandle,
  relativePath: string,
  create = false,
) {
  if (!root.getDirectoryHandle) {
    throw makeLibraryError(
      "unsupported",
      "این مرورگر مدیریت پوشه را پشتیبانی نمی‌کند؛ از نسخهٔ دسکتاپ استفاده کنید.",
    );
  }
  let current = root;
  const normalized = normalizeLibraryRelativePath(relativePath);
  for (const segment of normalized ? normalized.split("/") : []) {
    const getChildDirectory = current.getDirectoryHandle;
    if (!getChildDirectory) {
      throw makeLibraryError(
        "unsupported",
        "این مرورگر پیمایش پوشه را پشتیبانی نمی‌کند.",
      );
    }
    current = await getChildDirectory.call(current, segment, { create });
  }
  return current;
}

async function findEntry(
  directory: BrowserDirectoryHandle,
  name: string,
  kind: "file" | "folder",
) {
  if (kind === "file") {
    if (!directory.getFileHandle) throw makeLibraryError("unsupported", "مدیریت فایل در این مرورگر در دسترس نیست.");
    return directory.getFileHandle(name);
  }
  if (!directory.getDirectoryHandle) throw makeLibraryError("unsupported", "مدیریت پوشه در این مرورگر در دسترس نیست.");
  return directory.getDirectoryHandle(name);
}

async function assertEntryMissing(directory: BrowserDirectoryHandle, name: string) {
  for await (const entry of directory.values()) {
    if (entry.name.normalize("NFC") === name.normalize("NFC")) {
      throw makeLibraryError(
        "already-exists",
        "فایل یا پوشه‌ای با این نام از قبل وجود دارد.",
      );
    }
  }
}

async function writeBrowserFile(handle: BrowserFileHandle, data: ArrayBuffer | string) {
  if (!handle.createWritable) {
    throw makeLibraryError(
      "unsupported",
      "مرورگر اجازهٔ نوشتن در این پوشه را نمی‌دهد؛ دسترسی را دوباره تأیید کنید.",
    );
  }
  const writable = await handle.createWritable();
  try {
    await writable.write(data);
    await writable.close();
  } catch (error) {
    await writable.abort?.().catch(() => {});
    throw error;
  }
}

async function captureSnapshot(
  handle: BrowserFileHandle | BrowserDirectoryHandle,
  budget: { files: number; bytes: number },
): Promise<BrowserSnapshot> {
  budget.files += 1;
  if (budget.files > 2_000) {
    throw makeLibraryError(
      "unsupported",
      "این پوشه برای حذف امن در مرورگر بسیار بزرگ است؛ از نسخهٔ دسکتاپ استفاده کنید.",
    );
  }
  if (handle.kind === "file") {
    const file = await handle.getFile();
    budget.bytes += file.size;
    if (budget.bytes > 64 * 1024 * 1024) {
      throw makeLibraryError(
        "unsupported",
        "حجم این مورد برای بازگشت امن در مرورگر بیشتر از ۶۴ مگابایت است.",
      );
    }
    return { kind: "file", name: handle.name, bytes: await file.arrayBuffer() };
  }
  const children: BrowserSnapshot[] = [];
  for await (const child of handle.values()) {
    children.push(await captureSnapshot(child, budget));
  }
  return { kind: "directory", name: handle.name, children };
}

async function restoreSnapshot(
  parent: BrowserDirectoryHandle,
  snapshot: BrowserSnapshot,
) {
  await assertEntryMissing(parent, snapshot.name);
  if (snapshot.kind === "file") {
    if (!parent.getFileHandle) throw makeLibraryError("unsupported", "بازگردانی فایل در این مرورگر ممکن نیست.");
    const file = await parent.getFileHandle(snapshot.name, { create: true });
    await writeBrowserFile(file, snapshot.bytes);
    return;
  }
  if (!parent.getDirectoryHandle) throw makeLibraryError("unsupported", "بازگردانی پوشه در این مرورگر ممکن نیست.");
  const directory = await parent.getDirectoryHandle(snapshot.name, {
    create: true,
  });
  for (const child of snapshot.children) {
    await restoreSnapshot(directory, child);
  }
}

async function removeEntry(
  parent: BrowserDirectoryHandle,
  name: string,
  recursive: boolean,
) {
  if (!parent.removeEntry) {
    throw makeLibraryError(
      "unsupported",
      "حذف فایل در این مرورگر پشتیبانی نمی‌شود؛ از نسخهٔ دسکتاپ استفاده کنید.",
    );
  }
  await parent.removeEntry(name, { recursive });
}

async function copySnapshot(
  destination: BrowserDirectoryHandle,
  snapshot: BrowserSnapshot,
  nextName = snapshot.name,
) {
  const renamed = { ...snapshot, name: nextName } as BrowserSnapshot;
  await restoreSnapshot(destination, renamed);
}

export async function browserLibraryIsWritable(root: BrowserDirectoryHandle) {
  if (!root.getFileHandle || !root.getDirectoryHandle || !root.removeEntry) {
    return false;
  }
  try {
    const permission = await root.queryPermission?.({ mode: "readwrite" });
    if (permission === "granted") return true;
    return (await root.requestPermission?.({ mode: "readwrite" })) === "granted";
  } catch {
    return false;
  }
}

export async function performBrowserLibraryMutation(
  root: BrowserDirectoryHandle,
  request: LibraryMutationRequest,
  undoStore: Map<string, BrowserUndoRecord>,
): Promise<LibraryMutationResult> {
  if (!(await browserLibraryIsWritable(root))) {
    throw makeLibraryError(
      "permission",
      "اجازهٔ نوشتن پوشه در دسترس نیست؛ پوشه را دوباره با دسترسی ویرایش متصل کنید.",
    );
  }

  if (request.kind === "create-file" || request.kind === "create-folder") {
    const kind = request.kind === "create-file" ? "file" : "folder";
    const nameError = validateLibraryEntryName(request.name, { kind });
    if (nameError) throw makeLibraryError("invalid-name", nameError);
    const parent = await getDirectory(root, request.parentPath);
    await assertEntryMissing(parent, request.name);
    if (request.kind === "create-file") {
      if (!parent.getFileHandle) throw makeLibraryError("unsupported", "ساخت فایل در این مرورگر ممکن نیست.");
      const handle = await parent.getFileHandle(request.name, { create: true });
      await writeBrowserFile(handle, request.content ?? "");
    } else {
      if (!parent.getDirectoryHandle) throw makeLibraryError("unsupported", "ساخت پوشه در این مرورگر ممکن نیست.");
      await parent.getDirectoryHandle(request.name, { create: true });
    }
    return {
      kind: request.kind,
      rootId: request.rootId,
      nextPath: joinLibraryPath(request.parentPath, request.name),
    };
  }

  const sourcePath = normalizeLibraryRelativePath(request.sourcePath);
  const sourceParentPath = parentLibraryPath(sourcePath);
  const sourceName = libraryBaseName(sourcePath);
  const sourceParent = await getDirectory(root, sourceParentPath);
  const source = await findEntry(sourceParent, sourceName, request.entryKind);

  if (request.kind === "delete") {
    const snapshot = await captureSnapshot(source, { files: 0, bytes: 0 });
    const token = crypto.randomUUID();
    await removeEntry(sourceParent, sourceName, request.entryKind === "folder");
    undoStore.set(token, {
      rootId: request.rootId,
      parentPath: sourceParentPath,
      snapshot,
    });
    return {
      kind: "delete",
      rootId: request.rootId,
      previousPath: sourcePath,
      undoToken: token,
    };
  }

  const destinationParentPath =
    request.kind === "rename"
      ? sourceParentPath
      : normalizeLibraryRelativePath(request.destinationFolder);
  if (
    request.entryKind === "folder" &&
    request.kind === "move" &&
    (destinationParentPath === sourcePath ||
      destinationParentPath.startsWith(`${sourcePath}/`))
  ) {
    throw makeLibraryError(
      "unsafe-path",
      "پوشه را نمی‌توان به درون خودش منتقل کرد.",
    );
  }
  const destinationName =
    request.kind === "rename" ? request.name : sourceName;
  const nameError =
    request.kind === "rename" && request.entryKind === "file"
      ? validateLibraryDocumentRename(sourceName, destinationName)
      : validateLibraryEntryName(destinationName, {
          kind: request.entryKind,
          markdownOnly: false,
        });
  if (nameError) throw makeLibraryError("invalid-name", nameError);
  const destinationParent = await getDirectory(root, destinationParentPath);
  await assertEntryMissing(destinationParent, destinationName);

  const movable = source as BrowserFileHandle | BrowserDirectoryHandle;
  if (movable.move) {
    await movable.move(destinationParent, destinationName);
  } else {
    const snapshot = await captureSnapshot(source, { files: 0, bytes: 0 });
    await copySnapshot(destinationParent, snapshot, destinationName);
    try {
      await removeEntry(sourceParent, sourceName, request.entryKind === "folder");
    } catch (error) {
      await removeEntry(
        destinationParent,
        destinationName,
        request.entryKind === "folder",
      ).catch(() => {});
      throw error;
    }
  }

  return {
    kind: request.kind,
    rootId: request.rootId,
    previousPath: sourcePath,
    nextPath: joinLibraryPath(destinationParentPath, destinationName),
  };
}

export async function undoBrowserLibraryDelete(
  root: BrowserDirectoryHandle,
  token: string,
  undoStore: Map<string, BrowserUndoRecord>,
): Promise<LibraryMutationResult> {
  const record = undoStore.get(token);
  if (!record) {
    throw makeLibraryError("missing", "فرصت بازگردانی این حذف پایان یافته است.");
  }
  const parent = await getDirectory(root, record.parentPath);
  await restoreSnapshot(parent, record.snapshot);
  undoStore.delete(token);
  return {
    kind: "undo",
    rootId: record.rootId,
    nextPath: joinLibraryPath(record.parentPath, record.snapshot.name),
  };
}
