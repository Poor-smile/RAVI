import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme,
  shell,
} from "electron";
import { access, readFile, rename, stat, writeFile } from "node:fs/promises";
import { readFileSync, renameSync, watch, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRaaviServer,
  markdownPathFromArguments,
  readDocumentPath,
  readLibraryDocument,
  scanMarkdownFolder,
} from "./server.mjs";
import { desktopPdfOptions } from "./pdf-options.mjs";
import {
  performLibraryMutation,
  undoLibraryDelete,
} from "./library-filesystem.mjs";
import {
  canRestoreDocumentAccess,
  normalizedPathKey,
} from "./document-access.mjs";
import {
  getCodexConnectionStatus,
  runCodexPrompt,
  runCodexPersianReview,
  runCodexSmartAnnotations,
  startCodexLogin,
} from "./codex-cli.mjs";

const desktopDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(desktopDirectory, "..");
const allowedLibraryRoots = new Set();
const allowedDocumentPaths = new Set();
const allowedExportPaths = new Set();
const libraryWatchers = new Map();
const libraryWatchTimers = new Map();
const libraryUndoRecords = new Map();
const MAX_RECENT_FILES = 20;
const MAX_HISTORY_DOCUMENTS = 50;
let currentWindowTheme = "light";

function windowIconPath(theme = currentWindowTheme) {
  return path.join(
    appRoot,
    "build",
    theme === "dark" ? "icon-dark.ico" : "icon.ico",
  );
}

function applyWindowTheme(theme) {
  currentWindowTheme = theme === "dark" ? "dark" : "light";
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setIcon(windowIconPath());
  mainWindow.setBackgroundColor(
    currentWindowTheme === "dark" ? "#141A16" : "#E9E5DC",
  );
}
const MAX_DOCUMENT_VERSIONS = 30;
const MAX_RENDERER_STATE_BYTES = 48 * 1024 * 1024;
const MAX_EXPORT_BYTES = 96 * 1024 * 1024;
const isSmokeTest =
  process.argv.includes("--smoke-test") || process.env.RAAVI_SMOKE_TEST === "1";
const initialDocumentPath = markdownPathFromArguments(process.argv);

let mainWindow = null;
let localServer = null;
let rendererReady = false;
let rendererStateWriteQueue = Promise.resolve();
let rendererStateReadCount = 0;
let pendingDocumentRequest = initialDocumentPath
  ? { filePath: initialDocumentPath, openInReadingMode: true }
  : null;

function notifyLibraryChanged(rootPath, reason = "external") {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("library:changed", {
    rootPath,
    reason,
  });
}

function watchLibraryFolder(rootPath) {
  const resolvedRoot = path.resolve(rootPath);
  const key = normalizedPathKey(resolvedRoot);
  if (libraryWatchers.has(key)) return;
  try {
    const watcher = watch(
      resolvedRoot,
      { recursive: process.platform === "win32" || process.platform === "darwin" },
      () => {
        const currentTimer = libraryWatchTimers.get(key);
        if (currentTimer) clearTimeout(currentTimer);
        libraryWatchTimers.set(
          key,
          setTimeout(() => {
            libraryWatchTimers.delete(key);
            notifyLibraryChanged(resolvedRoot);
          }, 180),
        );
      },
    );
    watcher.on("error", () => {
      watcher.close();
      libraryWatchers.delete(key);
    });
    libraryWatchers.set(key, watcher);
  } catch {
    // Manual refresh remains available when recursive watching is unsupported.
  }
}

function closeLibraryWatchers() {
  for (const timer of libraryWatchTimers.values()) clearTimeout(timer);
  libraryWatchTimers.clear();
  for (const watcher of libraryWatchers.values()) watcher.close();
  libraryWatchers.clear();
}

function safeMarkdownName(fileName) {
  const cleaned = String(fileName || "نوشته-راوی.md")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .trim();
  return /\.(?:md|markdown)$/i.test(cleaned) ? cleaned : `${cleaned}.md`;
}

function safeExportName(fileName, extension, fallback) {
  const cleaned = String(fileName || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .trim();
  return cleaned.toLocaleLowerCase("en-US").endsWith(extension)
    ? cleaned
    : `${cleaned}${extension}`;
}

function libraryStatePath() {
  return path.join(app.getPath("userData"), "library-state.json");
}

function historyStatePath() {
  return path.join(app.getPath("userData"), "document-history.json");
}

function rendererStatePath() {
  return path.join(app.getPath("userData"), "renderer-state.json");
}

async function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

async function readLibraryState() {
  const value = await readJsonFile(libraryStatePath(), {
    folders: [],
    recents: [],
  });
  return {
    folders: Array.isArray(value.folders)
      ? value.folders.filter((item) => typeof item === "string").slice(0, 30)
      : [],
    recents: Array.isArray(value.recents)
      ? value.recents
          .filter(
            (item) =>
              item &&
              typeof item.path === "string" &&
              typeof item.name === "string",
          )
          .slice(0, MAX_RECENT_FILES)
      : [],
  };
}

async function writeLibraryState(value) {
  await writeFile(libraryStatePath(), JSON.stringify(value, null, 2), "utf8");
}

async function getRendererState() {
  rendererStateReadCount += 1;
  const snapshot = await readRendererStateFile();
  if (!initialDocumentPath || rendererStateReadCount > 1) return snapshot;

  // When Windows launches Raavi for a specific file, restoring the previous
  // document first creates a brief stale view and lets its scroll callbacks
  // race with the requested document. Only hydrate the cross-document reading
  // index; the requested file remains the sole source of visible content.
  return snapshot?.readingPositions
    ? { readingPositions: snapshot.readingPositions }
    : null;
}

async function readRendererStateFile() {
  const value = await readJsonFile(rendererStatePath(), null);
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

function saveRendererState(_event, snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new Error("Renderer state is invalid.");
  }
  const incomingSerialized = JSON.stringify(snapshot);
  if (Buffer.byteLength(incomingSerialized, "utf8") > MAX_RENDERER_STATE_BYTES) {
    throw new Error("Renderer state is too large.");
  }

  rendererStateWriteQueue = rendererStateWriteQueue
    .catch(() => {})
    .then(async () => {
      const currentSnapshot = (await readRendererStateFile()) ?? {};
      const currentPositions =
        currentSnapshot.readingPositions &&
        typeof currentSnapshot.readingPositions === "object" &&
        !Array.isArray(currentSnapshot.readingPositions)
          ? currentSnapshot.readingPositions
          : {};
      const incomingPositions =
        snapshot.readingPositions &&
        typeof snapshot.readingPositions === "object" &&
        !Array.isArray(snapshot.readingPositions)
          ? snapshot.readingPositions
          : {};
      const readingPositions = { ...incomingPositions };
      for (const [key, currentRecord] of Object.entries(currentPositions)) {
        const incomingRecord = readingPositions[key];
        if (
          !incomingRecord ||
          Number(currentRecord?.updatedAt ?? 0) >
            Number(incomingRecord?.updatedAt ?? 0)
        ) {
          readingPositions[key] = currentRecord;
        }
      }
      // A synchronous beforeunload save can interleave while this queued write
      // is awaiting the filesystem. Re-read immediately before serialization
      // so an older renderer snapshot never overwrites a newer reading anchor.
      const latestSnapshot = (await readRendererStateFile()) ?? {};
      const latestPositions =
        latestSnapshot.readingPositions &&
        typeof latestSnapshot.readingPositions === "object" &&
        !Array.isArray(latestSnapshot.readingPositions)
          ? latestSnapshot.readingPositions
          : {};
      for (const [key, latestRecord] of Object.entries(latestPositions)) {
        const candidate = readingPositions[key];
        if (
          !candidate ||
          Number(latestRecord?.updatedAt ?? 0) >
            Number(candidate?.updatedAt ?? 0)
        ) {
          readingPositions[key] = latestRecord;
        }
      }
      const serialized = JSON.stringify({ ...snapshot, readingPositions });
      if (Buffer.byteLength(serialized, "utf8") > MAX_RENDERER_STATE_BYTES) {
        throw new Error("Renderer state is too large.");
      }
      const targetPath = rendererStatePath();
      const temporaryPath = `${targetPath}.tmp`;
      await writeFile(temporaryPath, serialized, "utf8");
      try {
        await rename(temporaryPath, targetPath);
      } catch {
        await writeFile(targetPath, serialized, "utf8");
      }
      return { saved: true };
    });
  return rendererStateWriteQueue;
}

function saveRendererReadingPositions(_event, readingPositions) {
  if (
    !readingPositions ||
    typeof readingPositions !== "object" ||
    Array.isArray(readingPositions)
  ) {
    throw new Error("Renderer reading positions are invalid.");
  }

  rendererStateWriteQueue = rendererStateWriteQueue
    .catch(() => {})
    .then(async () => {
      const currentSnapshot = (await readRendererStateFile()) ?? {};
      const currentPositions =
        currentSnapshot.readingPositions &&
        typeof currentSnapshot.readingPositions === "object" &&
        !Array.isArray(currentSnapshot.readingPositions)
          ? currentSnapshot.readingPositions
          : {};
      const mergedPositions = { ...readingPositions };
      for (const [key, currentRecord] of Object.entries(currentPositions)) {
        const incomingRecord = mergedPositions[key];
        if (
          !incomingRecord ||
          Number(currentRecord?.updatedAt ?? 0) >
            Number(incomingRecord?.updatedAt ?? 0)
        ) {
          mergedPositions[key] = currentRecord;
        }
      }
      const latestSnapshot = (await readRendererStateFile()) ?? {};
      const latestPositions =
        latestSnapshot.readingPositions &&
        typeof latestSnapshot.readingPositions === "object" &&
        !Array.isArray(latestSnapshot.readingPositions)
          ? latestSnapshot.readingPositions
          : {};
      for (const [key, latestRecord] of Object.entries(latestPositions)) {
        const candidate = mergedPositions[key];
        if (
          !candidate ||
          Number(latestRecord?.updatedAt ?? 0) >
            Number(candidate?.updatedAt ?? 0)
        ) {
          mergedPositions[key] = latestRecord;
        }
      }
      const serialized = JSON.stringify({
        ...currentSnapshot,
        readingPositions: mergedPositions,
      });
      if (Buffer.byteLength(serialized, "utf8") > MAX_RENDERER_STATE_BYTES) {
        throw new Error("Renderer state is too large.");
      }
      const targetPath = rendererStatePath();
      const temporaryPath = `${targetPath}.tmp`;
      await writeFile(temporaryPath, serialized, "utf8");
      try {
        await rename(temporaryPath, targetPath);
      } catch {
        await writeFile(targetPath, serialized, "utf8");
      }
      return { saved: true };
    });
  return rendererStateWriteQueue;
}

function saveRendererReadingPositionsSync(event, readingPositions) {
  if (
    !readingPositions ||
    typeof readingPositions !== "object" ||
    Array.isArray(readingPositions)
  ) {
    event.returnValue = { saved: false };
    return;
  }

  try {
    const targetPath = rendererStatePath();
    let currentSnapshot = {};
    try {
      const parsed = JSON.parse(readFileSync(targetPath, "utf8"));
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        currentSnapshot = parsed;
      }
    } catch {
      // A first-run profile has no renderer snapshot yet.
    }
    const serialized = JSON.stringify({
      ...currentSnapshot,
      readingPositions,
    });
    if (Buffer.byteLength(serialized, "utf8") > MAX_RENDERER_STATE_BYTES) {
      event.returnValue = { saved: false };
      return;
    }
    const temporaryPath = `${targetPath}.positions.tmp`;
    writeFileSync(temporaryPath, serialized, "utf8");
    try {
      renameSync(temporaryPath, targetPath);
    } catch {
      writeFileSync(targetPath, serialized, "utf8");
    }
    event.returnValue = { saved: true };
  } catch {
    event.returnValue = { saved: false };
  }
}

async function rememberLibraryFolder(rootPath) {
  const state = await readLibraryState();
  const key = normalizedPathKey(rootPath);
  state.folders = [
    rootPath,
    ...state.folders.filter(
      (folderPath) => normalizedPathKey(folderPath) !== key,
    ),
  ].slice(0, 30);
  await writeLibraryState(state);
  watchLibraryFolder(rootPath);
}

async function forgetLibraryFolder(_event, rootPath) {
  const resolvedRoot = path.resolve(String(rootPath));
  const key = normalizedPathKey(resolvedRoot);
  const state = await readLibraryState();
  state.folders = state.folders.filter(
    (folderPath) => normalizedPathKey(folderPath) !== key,
  );
  await writeLibraryState(state);

  allowedLibraryRoots.delete(resolvedRoot);
  allowedLibraryRoots.delete(key);
  const timer = libraryWatchTimers.get(key);
  if (timer) clearTimeout(timer);
  libraryWatchTimers.delete(key);
  libraryWatchers.get(key)?.close();
  libraryWatchers.delete(key);

  return getLibrarySnapshot();
}

async function recordRecent(filePath, documentType) {
  const resolvedPath = path.resolve(filePath);
  const state = await readLibraryState();
  const key = normalizedPathKey(resolvedPath);
  const details = await stat(resolvedPath).catch(() => null);
  state.recents = [
    {
      path: resolvedPath,
      name: path.basename(resolvedPath),
      documentType,
      openedAt: new Date().toISOString(),
      lastModified: details?.mtimeMs,
    },
    ...state.recents.filter(
      (item) => normalizedPathKey(item.path) !== key,
    ),
  ].slice(0, MAX_RECENT_FILES);
  await writeLibraryState(state);
}

async function getLibrarySnapshot() {
  const state = await readLibraryState();
  for (const rootPath of state.folders) {
    allowedLibraryRoots.add(path.resolve(rootPath));
    watchLibraryFolder(rootPath);
  }
  const recents = await Promise.all(
    state.recents.map(async (recent) => {
      const details = await stat(recent.path).catch(() => null);
      if (details?.isFile()) {
        allowedDocumentPaths.add(normalizedPathKey(recent.path));
      }
      return {
        ...recent,
        lastModified: details?.mtimeMs ?? recent.lastModified,
      };
    }),
  );
  return {
    folders: state.folders.map((rootPath) => ({
      rootPath,
      rootName: path.basename(rootPath),
    })),
    recents,
  };
}

async function ensureDocumentAccess(filePath) {
  const requestedKey = normalizedPathKey(filePath);
  if (allowedDocumentPaths.has(requestedKey)) return;

  const state = await readLibraryState();
  if (!canRestoreDocumentAccess(filePath, state)) {
    throw Object.assign(
      new Error("This document must be opened before it can be saved."),
      { code: "permission" },
    );
  }

  let details;
  try {
    details = await stat(filePath);
  } catch (error) {
    throw Object.assign(new Error("The document is no longer available."), {
      code: error?.code === "EACCES" || error?.code === "EPERM"
        ? "permission"
        : "missing",
    });
  }
  if (!details.isFile()) {
    throw Object.assign(new Error("The document is no longer a file."), {
      code: "missing",
    });
  }

  allowedDocumentPaths.add(requestedKey);
}

async function removeRecentFileIfMissing(_event, filePath) {
  const resolvedPath = path.resolve(String(filePath));
  try {
    await access(resolvedPath);
    return { removed: false, state: await getLibrarySnapshot() };
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
  }
  const state = await readLibraryState();
  const key = normalizedPathKey(resolvedPath);
  state.recents = state.recents.filter(
    (item) => normalizedPathKey(item.path) !== key,
  );
  await writeLibraryState(state);
  return { removed: true, state: await getLibrarySnapshot() };
}

async function clearRecentFiles() {
  const state = await readLibraryState();
  state.recents = [];
  await writeLibraryState(state);
  return getLibrarySnapshot();
}

async function openExternalUrl(_event, value) {
  const url = String(value ?? "");
  if (!/^https?:\/\//i.test(url)) return { opened: false };
  await shell.openExternal(url);
  return { opened: true };
}

async function readHistoryState() {
  const value = await readJsonFile(historyStatePath(), { documents: {} });
  return {
    documents:
      value && typeof value.documents === "object" ? value.documents : {},
  };
}

async function historyForPath(filePath) {
  const state = await readHistoryState();
  const value = state.documents[normalizedPathKey(filePath)];
  if (!value || typeof value !== "object") {
    return { revision: 1, versions: [] };
  }
  return {
    revision:
      Number.isSafeInteger(value.revision) && value.revision > 0
        ? value.revision
        : 1,
    versions: Array.isArray(value.versions)
      ? value.versions.slice(-MAX_DOCUMENT_VERSIONS)
      : [],
  };
}

async function saveHistoryForPath(filePath, revision, versions) {
  const state = await readHistoryState();
  const key = normalizedPathKey(filePath);
  state.documents[key] = {
    path: path.resolve(filePath),
    revision,
    versions: Array.isArray(versions)
      ? versions.slice(-MAX_DOCUMENT_VERSIONS)
      : [],
    updatedAt: new Date().toISOString(),
  };

  const entries = Object.entries(state.documents)
    .sort(
      (first, second) =>
        Date.parse(second[1]?.updatedAt ?? "") -
        Date.parse(first[1]?.updatedAt ?? ""),
    )
    .slice(0, MAX_HISTORY_DOCUMENTS);
  state.documents = Object.fromEntries(entries);
  await writeFile(historyStatePath(), JSON.stringify(state, null, 2), "utf8");
}

function validateDocumentPayload(value) {
  if (
    !value ||
    typeof value.content !== "string" ||
    !Array.isArray(value.annotations) ||
    !Number.isSafeInteger(value.revision) ||
    value.revision < 1 ||
    !Array.isArray(value.versions)
  ) {
    throw new Error("Document payload is invalid.");
  }
  return {
    content: value.content,
    annotations: value.annotations,
    revision: value.revision,
    versions: value.versions.slice(-MAX_DOCUMENT_VERSIONS),
    raavi: value.raavi,
  };
}

async function enrichDocument(filePath, options = {}) {
  const documentValue = await readDocumentPath(filePath);
  allowedDocumentPaths.add(normalizedPathKey(filePath));

  if (documentValue.documentType === "markdown") {
    const history = await historyForPath(filePath);
    documentValue.revision = history.revision;
    documentValue.versions = history.versions;
  }

  if (options.remember !== false) {
    await recordRecent(filePath, documentValue.documentType);
  }

  return {
    ...documentValue,
    openInReadingMode: Boolean(options.openInReadingMode),
  };
}

async function chooseLibraryFolder(event) {
  const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  const result = await dialog.showOpenDialog(owner, {
    title: "افزودن پوشه به کتابخانه",
    buttonLabel: "افزودن پوشه",
    properties: ["openDirectory", "dontAddToRecent"],
  });

  if (result.canceled || !result.filePaths[0]) return null;
  const rootPath = path.resolve(result.filePaths[0]);
  allowedLibraryRoots.add(rootPath);
  await rememberLibraryFolder(rootPath);
  return scanMarkdownFolder(rootPath);
}

async function rescanLibraryFolder(_event, rootPath) {
  const resolvedRoot = path.resolve(String(rootPath));
  if (!allowedLibraryRoots.has(resolvedRoot)) {
    const state = await readLibraryState();
    const exists = state.folders.some(
      (folderPath) =>
        normalizedPathKey(folderPath) === normalizedPathKey(resolvedRoot),
    );
    if (!exists) throw new Error("This folder must be selected again.");
    allowedLibraryRoots.add(resolvedRoot);
  }
  return scanMarkdownFolder(resolvedRoot);
}

async function rewriteTrackedDocumentPath(
  rootPath,
  previousPath,
  nextPath,
  entryKind = "file",
) {
  if (!previousPath) return;
  const previousAbsolute = path.resolve(rootPath, previousPath);
  const nextAbsolute = nextPath ? path.resolve(rootPath, nextPath) : null;
  const previousKey = normalizedPathKey(previousAbsolute);

  const remapAbsolute = (candidatePath) => {
    const candidateKey = normalizedPathKey(candidatePath);
    const nestedPrefix = `${previousKey}${path.sep}`;
    const matches =
      candidateKey === previousKey ||
      (entryKind === "folder" && candidateKey.startsWith(nestedPrefix));
    if (!matches) return undefined;
    if (!nextAbsolute) return null;
    return `${nextAbsolute}${path.resolve(candidatePath).slice(previousAbsolute.length)}`;
  };

  for (const documentKey of [...allowedDocumentPaths]) {
    const mappedPath = remapAbsolute(documentKey);
    if (mappedPath === undefined) continue;
    allowedDocumentPaths.delete(documentKey);
    if (mappedPath) allowedDocumentPaths.add(normalizedPathKey(mappedPath));
  }

  const libraryState = await readLibraryState();
  libraryState.recents = libraryState.recents.flatMap((recent) => {
    const mappedPath = remapAbsolute(recent.path);
    if (mappedPath === undefined) return [recent];
    if (!mappedPath) return [];
    return [
      {
        ...recent,
        path: mappedPath,
        name: path.basename(mappedPath),
      },
    ];
  });
  await writeLibraryState(libraryState);

  if (!nextAbsolute) return;
  const historyState = await readHistoryState();
  let historyChanged = false;
  for (const [historyKey, value] of Object.entries(historyState.documents)) {
    const mappedPath = remapAbsolute(value?.path ?? historyKey);
    if (!mappedPath) continue;
    delete historyState.documents[historyKey];
    historyState.documents[normalizedPathKey(mappedPath)] = {
      ...value,
      path: mappedPath,
    };
    historyChanged = true;
  }
  if (historyChanged) {
    await writeFile(
      historyStatePath(),
      JSON.stringify(historyState, null, 2),
      "utf8",
    );
  }
}

async function mutateLibrary(_event, payload) {
  const rootPath = path.resolve(String(payload?.rootPath ?? ""));
  const allowedRoot = [...allowedLibraryRoots].find(
    (candidate) => normalizedPathKey(candidate) === normalizedPathKey(rootPath),
  );
  if (!allowedRoot) {
    throw Object.assign(new Error("This library must be selected again."), {
      code: "permission",
    });
  }
  const { result, undoRecord } = await performLibraryMutation({
    rootPath: allowedRoot,
    request: payload?.request ?? {},
    trashRoot: path.join(app.getPath("userData"), "library-trash"),
  });
  if (undoRecord) {
    libraryUndoRecords.set(undoRecord.token, {
      ...undoRecord,
      rootId: result.rootId,
      createdAt: Date.now(),
    });
    for (const [token, record] of libraryUndoRecords) {
      if (Date.now() - record.createdAt > 10 * 60 * 1000) {
        libraryUndoRecords.delete(token);
      }
    }
  }
  await rewriteTrackedDocumentPath(
    allowedRoot,
    result.previousPath,
    result.kind === "delete" ? null : result.nextPath,
    payload?.request?.entryKind ?? "file",
  );
  const scan = await scanMarkdownFolder(allowedRoot);
  notifyLibraryChanged(allowedRoot, "mutation");
  return { result, scan };
}

async function undoLibraryMutation(_event, tokenValue) {
  const token = String(tokenValue ?? "");
  const record = libraryUndoRecords.get(token);
  if (!record) {
    throw Object.assign(new Error("This undo action has expired."), {
      code: "missing",
    });
  }
  const result = await undoLibraryDelete(record);
  libraryUndoRecords.delete(token);
  await rewriteTrackedDocumentPath(record.rootPath, null, result.nextPath);
  const scan = await scanMarkdownFolder(record.rootPath);
  notifyLibraryChanged(record.rootPath, "undo");
  return {
    result: { ...result, rootId: record.rootId },
    scan,
  };
}

async function openLibraryDocument(_event, filePath) {
  const documentValue = await readLibraryDocument(
    String(filePath),
    allowedLibraryRoots,
  );
  allowedDocumentPaths.add(normalizedPathKey(filePath));
  if (documentValue.documentType === "markdown") {
    const history = await historyForPath(filePath);
    documentValue.revision = history.revision;
    documentValue.versions = history.versions;
  }
  await recordRecent(filePath, documentValue.documentType);
  return { ...documentValue, openInReadingMode: false };
}

async function readLibrarySearchText(_event, filePath) {
  const documentValue = await readLibraryDocument(
    String(filePath),
    allowedLibraryRoots,
  );
  return { content: documentValue.content };
}

async function chooseDocument(event) {
  const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  const result = await dialog.showOpenDialog(owner, {
    title: "بازکردن سند در راوی",
    buttonLabel: "بازکردن",
    properties: ["openFile"],
    filters: [
      { name: "فایل‌های Markdown", extensions: ["md", "markdown"] },
      { name: "همه‌ی فایل‌ها", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePaths[0]) return null;
  return enrichDocument(result.filePaths[0], { openInReadingMode: false });
}

async function openRecentDocument(_event, filePath) {
  const state = await readLibraryState();
  const requestedKey = normalizedPathKey(String(filePath));
  const recent = state.recents.find(
    (item) => normalizedPathKey(item.path) === requestedKey,
  );
  if (!recent) throw new Error("Recent file access is not allowed.");
  return enrichDocument(recent.path, { openInReadingMode: false });
}

async function readDocumentVersions(_event, filePath) {
  const resolvedPath = path.resolve(String(filePath));
  const requestedKey = normalizedPathKey(resolvedPath);
  if (!allowedDocumentPaths.has(requestedKey)) {
    const state = await readLibraryState();
    const isRecent = state.recents.some(
      (item) => normalizedPathKey(item.path) === requestedKey,
    );
    const isInLibrary = state.folders.some((rootPath) => {
      const resolvedRoot = path.resolve(rootPath);
      const relativePath = path.relative(resolvedRoot, resolvedPath);
      return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
    });
    if (!isRecent && !isInLibrary) {
      throw new Error("Document version access is not allowed.");
    }
  }

  const documentValue = await readDocumentPath(resolvedPath);
  if (documentValue.documentType === "markdown") {
    return historyForPath(resolvedPath);
  }
  return {
    revision: documentValue.revision ?? 1,
    versions: documentValue.versions ?? [],
  };
}

async function saveMarkdown(event, payload) {
  const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  const fileName = safeMarkdownName(payload?.fileName);
  const documentValue = validateDocumentPayload(payload?.document);
  const result = await dialog.showSaveDialog(owner, {
    title: "ذخیره‌ی فایل Markdown",
    buttonLabel: "ذخیره فایل",
    defaultPath: path.join(app.getPath("documents"), fileName),
    filters: [
      { name: "Markdown", extensions: ["md", "markdown"] },
      { name: "همه‌ی فایل‌ها", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePath) return { saved: false };
  const filePath = /\.(?:md|markdown)$/i.test(result.filePath)
    ? result.filePath
    : `${result.filePath}.md`;
  await writeFile(filePath, documentValue.content, "utf8");
  await saveHistoryForPath(
    filePath,
    documentValue.revision,
    documentValue.versions,
  );
  allowedDocumentPaths.add(normalizedPathKey(filePath));
  await recordRecent(filePath, "markdown");
  return { saved: true, filePath, documentType: "markdown" };
}

async function saveCurrentDocument(_event, payload) {
  const filePath = path.resolve(String(payload?.filePath ?? ""));
  await ensureDocumentAccess(filePath);

  const documentValue = validateDocumentPayload(payload?.document);
  if (/\.ravi$/i.test(filePath)) {
    throw new Error("LEGACY_DOCUMENT_REQUIRES_MARKDOWN_SAVE_AS");
  }
  await writeFile(filePath, documentValue.content, "utf8");
  await saveHistoryForPath(
    filePath,
    documentValue.revision,
    documentValue.versions,
  );

  await recordRecent(filePath, "markdown");
  return { saved: true, filePath, documentType: "markdown" };
}

async function saveWordExport(event, payload) {
  const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  const fileName = safeExportName(
    payload?.fileName,
    ".docx",
    "نوشته-راوی.docx",
  );
  const bytes = Buffer.from(payload?.bytes ?? []);
  if (
    bytes.length < 4 ||
    bytes.length > MAX_EXPORT_BYTES ||
    bytes[0] !== 0x50 ||
    bytes[1] !== 0x4b
  ) {
    throw new Error("Word export payload is invalid.");
  }
  const result = await dialog.showSaveDialog(owner, {
    title: "ذخیره خروجی Word",
    buttonLabel: "ذخیره فایل",
    defaultPath: path.join(app.getPath("documents"), fileName),
    filters: [{ name: "Word", extensions: ["docx"] }],
  });
  if (result.canceled || !result.filePath) return { saved: false };
  const filePath = /\.docx$/i.test(result.filePath)
    ? result.filePath
    : `${result.filePath}.docx`;
  await writeFile(filePath, bytes);
  allowedExportPaths.add(path.resolve(filePath));
  return { saved: true, filePath };
}

async function exportPdf(event, payload) {
  const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  const fileName = safeExportName(
    payload?.fileName,
    ".pdf",
    "نوشته-راوی.pdf",
  );
  const result = await dialog.showSaveDialog(owner, {
    title: "ذخیره خروجی PDF",
    buttonLabel: "ذخیره فایل",
    defaultPath: path.join(app.getPath("documents"), fileName),
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (result.canceled || !result.filePath) return { saved: false };
  const filePath = /\.pdf$/i.test(result.filePath)
    ? result.filePath
    : `${result.filePath}.pdf`;
  const bytes = await event.sender.printToPDF(desktopPdfOptions());
  await writeFile(filePath, bytes);
  allowedExportPaths.add(path.resolve(filePath));
  return { saved: true, filePath };
}

async function revealExport(_event, payload) {
  const filePath = path.resolve(String(payload?.filePath ?? ""));
  if (!allowedExportPaths.has(filePath)) return { revealed: false };
  shell.showItemInFolder(filePath);
  return { revealed: true };
}

function registerDesktopHandlers() {
  ipcMain.handle("renderer-state:get", getRendererState);
  ipcMain.handle("renderer-state:save", saveRendererState);
  ipcMain.handle(
    "renderer-state:save-reading-positions",
    saveRendererReadingPositions,
  );
  ipcMain.on(
    "renderer-state:save-reading-positions-sync",
    saveRendererReadingPositionsSync,
  );
  ipcMain.handle("library:get-state", getLibrarySnapshot);
  ipcMain.handle("library:clear-recents", clearRecentFiles);
  ipcMain.handle("library:remove-recent-if-missing", removeRecentFileIfMissing);
  ipcMain.handle("library:choose-folder", chooseLibraryFolder);
  ipcMain.handle("library:disconnect-folder", forgetLibraryFolder);
  ipcMain.handle("library:scan-folder", rescanLibraryFolder);
  ipcMain.handle("library:read-file", openLibraryDocument);
  ipcMain.handle("library:read-search-text", readLibrarySearchText);
  ipcMain.handle("library:mutate", mutateLibrary);
  ipcMain.handle("library:undo", undoLibraryMutation);
  ipcMain.handle("document:choose", chooseDocument);
  ipcMain.handle("document:open-recent", openRecentDocument);
  ipcMain.handle("document:read-versions", readDocumentVersions);
  ipcMain.handle("document:save-markdown", saveMarkdown);
  ipcMain.handle("document:save-current", saveCurrentDocument);
  ipcMain.handle("export:save-word", saveWordExport);
  ipcMain.handle("export:pdf", exportPdf);
  ipcMain.handle("export:reveal", revealExport);
  ipcMain.handle("external:open-url", openExternalUrl);
  ipcMain.handle("codex:connection-status", getCodexConnectionStatus);
  ipcMain.handle("codex:start-login", startCodexLogin);
  ipcMain.handle("codex:run", (_event, payload) => runCodexPrompt(payload));
  ipcMain.handle("codex:persian-review", (_event, payload) =>
    runCodexPersianReview(payload),
  );
  ipcMain.handle("codex:smart-annotations", (_event, payload) =>
    runCodexSmartAnnotations(payload),
  );
  ipcMain.on("window:set-theme", (event, theme) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    applyWindowTheme(theme);
  });
  ipcMain.on("window:minimize", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.on("window:toggle-maximize", (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (!owner) return;
    if (owner.isMaximized()) owner.unmaximize();
    else owner.maximize();
  });
  ipcMain.on("window:close", (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
  ipcMain.on("renderer:ready", (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    rendererReady = true;
    if (pendingDocumentRequest) {
      const request = pendingDocumentRequest;
      pendingDocumentRequest = null;
      void openDocumentPath(request.filePath, {
        openInReadingMode: request.openInReadingMode,
      });
    }
    if (isSmokeTest) setTimeout(() => app.quit(), 600);
  });
}

async function openDocumentPath(filePath, options = {}) {
  if (!mainWindow || !rendererReady) {
    pendingDocumentRequest = {
      filePath,
      openInReadingMode: options.openInReadingMode !== false,
    };
    return;
  }

  try {
    const documentValue = await enrichDocument(filePath, {
      openInReadingMode: options.openInReadingMode !== false,
    });
    mainWindow.webContents.send("document:open-path", documentValue);
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!isSmokeTest) mainWindow.show();
    mainWindow.focus();
  } catch {
    if (!isSmokeTest) {
      dialog.showErrorBox(
        "بازکردن فایل ممکن نبود",
        "فایل باید Markdown معتبر یا یک سند قدیمیِ قابل‌مهاجرت و در اندازه‌ی مجاز باشد.",
      );
    }
  }
}

async function createWindow() {
  if (!localServer) localServer = await createRaaviServer();
  rendererReady = false;

  mainWindow = new BrowserWindow({
    width: 1540,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    frame: false,
    backgroundColor: "#e9e5dc",
    icon: windowIconPath(),
    title: "راوی — Markdown فارسی",
    webPreferences: {
      preload: path.join(desktopDirectory, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(localServer.origin)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) void shell.openExternal(url);
    }
  });
  mainWindow.once("ready-to-show", () => {
    if (!isSmokeTest) mainWindow?.show();
  });
  mainWindow.webContents.once(
    "did-fail-load",
    (_event, _errorCode, errorDescription) => {
      console.error("Raavi desktop load failed", errorDescription);
      if (isSmokeTest) app.exit(1);
    },
  );
  mainWindow.on("closed", () => {
    rendererReady = false;
    mainWindow = null;
  });

  await mainWindow.loadURL(localServer.origin);
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine, workingDirectory) => {
    const filePath = markdownPathFromArguments(commandLine, workingDirectory);
    if (filePath) {
      void openDocumentPath(filePath, { openInReadingMode: true });
    }
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    void openDocumentPath(filePath, { openInReadingMode: true });
  });

  app.setAppUserModelId("ir.raavi.markdown");
  nativeTheme.themeSource = "system";
  registerDesktopHandlers();

  app.whenReady().then(createWindow);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", () => {
    closeLibraryWatchers();
    if (localServer) void localServer.close();
  });
}
