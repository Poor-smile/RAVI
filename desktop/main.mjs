import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme,
  shell,
} from "electron";
import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRaaviServer,
  markdownPathFromArguments,
  readDocumentPath,
  readLibraryDocument,
  scanMarkdownFolder,
} from "./server.mjs";

const desktopDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(desktopDirectory, "..");
const allowedLibraryRoots = new Set();
const allowedDocumentPaths = new Set();
const MAX_RECENT_FILES = 20;
const MAX_HISTORY_DOCUMENTS = 50;
const MAX_DOCUMENT_VERSIONS = 30;
const isSmokeTest =
  process.argv.includes("--smoke-test") || process.env.RAAVI_SMOKE_TEST === "1";
const initialDocumentPath = markdownPathFromArguments(process.argv);

let mainWindow = null;
let localServer = null;
let rendererReady = false;
let pendingDocumentRequest = initialDocumentPath
  ? { filePath: initialDocumentPath, openInReadingMode: true }
  : null;

function normalizedPathKey(filePath) {
  return path.resolve(filePath).toLocaleLowerCase("en-US");
}

function safeMarkdownName(fileName) {
  const cleaned = String(fileName || "نوشته-راوی.md")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .trim();
  return /\.(?:md|markdown)$/i.test(cleaned) ? cleaned : `${cleaned}.md`;
}

function safeRaaviName(fileName) {
  const cleaned = String(fileName || "نوشته-راوی.ravi")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .trim();
  return /\.ravi$/i.test(cleaned) ? cleaned : `${cleaned}.ravi`;
}

function libraryStatePath() {
  return path.join(app.getPath("userData"), "library-state.json");
}

function historyStatePath() {
  return path.join(app.getPath("userData"), "document-history.json");
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
}

async function recordRecent(filePath, documentType) {
  const resolvedPath = path.resolve(filePath);
  const state = await readLibraryState();
  const key = normalizedPathKey(resolvedPath);
  state.recents = [
    {
      path: resolvedPath,
      name: path.basename(resolvedPath),
      documentType,
      openedAt: new Date().toISOString(),
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
  }
  return {
    folders: state.folders.map((rootPath) => ({
      rootPath,
      rootName: path.basename(rootPath),
    })),
    recents: state.recents,
  };
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

async function chooseDocument(event) {
  const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  const result = await dialog.showOpenDialog(owner, {
    title: "بازکردن سند در راوی",
    buttonLabel: "بازکردن",
    properties: ["openFile"],
    filters: [
      { name: "سندهای راوی", extensions: ["md", "markdown", "ravi"] },
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

async function saveRaavi(event, payload) {
  const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  const fileName = safeRaaviName(payload?.fileName);
  const documentValue = validateDocumentPayload(payload?.document);
  if (
    !documentValue.raavi ||
    documentValue.raavi.format !== "ravi" ||
    documentValue.raavi.version !== 1
  ) {
    throw new Error("Raavi document payload is invalid.");
  }

  const result = await dialog.showSaveDialog(owner, {
    title: "ذخیره‌ی فایل راوی",
    buttonLabel: "ذخیره فایل",
    defaultPath: path.join(app.getPath("documents"), fileName),
    filters: [
      { name: "سند راوی", extensions: ["ravi"] },
      { name: "همه‌ی فایل‌ها", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePath) return { saved: false };
  const raviPath = /\.ravi$/i.test(result.filePath)
    ? result.filePath
    : `${result.filePath}.ravi`;
  const markdownPath = `${raviPath.replace(/\.ravi$/i, "")}.md`;

  let companionExists = false;
  try {
    await access(markdownPath);
    companionExists = true;
  } catch {
    companionExists = false;
  }

  if (companionExists) {
    const confirmation = await dialog.showMessageBox(owner, {
      type: "warning",
      title: "جایگزینی فایل Markdown",
      message: "یک فایل Markdown با همین نام کنار فایل راوی وجود دارد.",
      detail: `برای ذخیره‌ی هر دو فایل، «${path.basename(markdownPath)}» جایگزین می‌شود.`,
      buttons: ["جایگزین شود", "انصراف"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (confirmation.response !== 0) return { saved: false };
  }

  await writeFile(
    raviPath,
    JSON.stringify(documentValue.raavi, null, 2),
    "utf8",
  );
  await writeFile(markdownPath, documentValue.content, "utf8");
  allowedDocumentPaths.add(normalizedPathKey(raviPath));
  await recordRecent(raviPath, "ravi");
  return {
    saved: true,
    filePath: raviPath,
    raviPath,
    markdownPath,
    documentType: "ravi",
  };
}

async function saveCurrentDocument(_event, payload) {
  const filePath = path.resolve(String(payload?.filePath ?? ""));
  if (!allowedDocumentPaths.has(normalizedPathKey(filePath))) {
    throw new Error("This document must be opened before it can be saved.");
  }

  const documentValue = validateDocumentPayload(payload?.document);
  const documentType = /\.ravi$/i.test(filePath) ? "ravi" : "markdown";
  if (documentType === "ravi") {
    if (
      !documentValue.raavi ||
      documentValue.raavi.format !== "ravi" ||
      documentValue.raavi.version !== 1
    ) {
      throw new Error("Raavi document payload is invalid.");
    }
    await writeFile(
      filePath,
      JSON.stringify(documentValue.raavi, null, 2),
      "utf8",
    );
    await writeFile(
      `${filePath.replace(/\.ravi$/i, "")}.md`,
      documentValue.content,
      "utf8",
    );
  } else {
    await writeFile(filePath, documentValue.content, "utf8");
    await saveHistoryForPath(
      filePath,
      documentValue.revision,
      documentValue.versions,
    );
  }

  await recordRecent(filePath, documentType);
  return { saved: true, filePath, documentType };
}

function registerDesktopHandlers() {
  ipcMain.handle("library:get-state", getLibrarySnapshot);
  ipcMain.handle("library:choose-folder", chooseLibraryFolder);
  ipcMain.handle("library:scan-folder", rescanLibraryFolder);
  ipcMain.handle("library:read-file", openLibraryDocument);
  ipcMain.handle("document:choose", chooseDocument);
  ipcMain.handle("document:open-recent", openRecentDocument);
  ipcMain.handle("document:save-markdown", saveMarkdown);
  ipcMain.handle("document:save-ravi", saveRaavi);
  ipcMain.handle("document:save-current", saveCurrentDocument);
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
        "فایل باید Markdown یا .ravi معتبر و در اندازه‌ی مجاز باشد.",
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
    backgroundColor: "#e9e5dc",
    icon: path.join(appRoot, "build", "icon.svg"),
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
  nativeTheme.themeSource = "light";
  registerDesktopHandlers();

  app.whenReady().then(createWindow);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", () => {
    if (localServer) void localServer.close();
  });
}
