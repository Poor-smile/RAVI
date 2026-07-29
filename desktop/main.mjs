import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme,
  shell,
} from "electron";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createRaaviServer,
  markdownPathFromArguments,
  readMarkdownFile,
  readMarkdownPath,
  scanMarkdownFolder,
} from "./server.mjs";

const desktopDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(desktopDirectory, "..");
const allowedLibraryRoots = new Set();
const isSmokeTest =
  process.argv.includes("--smoke-test") || process.env.RAAVI_SMOKE_TEST === "1";
let mainWindow = null;
let localServer = null;
let rendererReady = false;
let pendingMarkdownPath = markdownPathFromArguments(process.argv);

function safeMarkdownName(fileName) {
  const cleaned = String(fileName || "نوشته-راوی.md")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .trim();
  return /\.(?:md|markdown)$/i.test(cleaned) ? cleaned : `${cleaned}.md`;
}

async function chooseMarkdownFolder(event) {
  const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  const result = await dialog.showOpenDialog(owner, {
    title: "انتخاب پوشه‌ی کتابخانه",
    buttonLabel: "انتخاب پوشه",
    properties: ["openDirectory", "dontAddToRecent"],
  });

  if (result.canceled || !result.filePaths[0]) return null;
  const rootPath = path.resolve(result.filePaths[0]);
  allowedLibraryRoots.add(rootPath);
  return scanMarkdownFolder(rootPath);
}

async function rescanMarkdownFolder(_event, rootPath) {
  const resolvedRoot = path.resolve(String(rootPath));
  if (!allowedLibraryRoots.has(resolvedRoot)) {
    throw new Error("This folder must be selected again.");
  }
  return scanMarkdownFolder(resolvedRoot);
}

async function saveMarkdown(event, payload) {
  const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  const fileName = safeMarkdownName(payload?.fileName);
  const result = await dialog.showSaveDialog(owner, {
    title: "ذخیره‌ی فایل Markdown",
    buttonLabel: "ذخیره",
    defaultPath: path.join(app.getPath("documents"), fileName),
    filters: [
      { name: "Markdown", extensions: ["md", "markdown"] },
      { name: "همه‌ی فایل‌ها", extensions: ["*"] },
    ],
  });

  if (result.canceled || !result.filePath) return { saved: false };
  await writeFile(result.filePath, String(payload?.content ?? ""), "utf8");
  return { saved: true, filePath: result.filePath };
}

function registerDesktopHandlers() {
  ipcMain.handle("library:choose-folder", chooseMarkdownFolder);
  ipcMain.handle("library:scan-folder", rescanMarkdownFolder);
  ipcMain.handle("library:read-file", (_event, filePath) =>
    readMarkdownFile(String(filePath), allowedLibraryRoots),
  );
  ipcMain.handle("document:save-markdown", saveMarkdown);
}

async function openMarkdownPath(filePath) {
  if (!mainWindow || !rendererReady) {
    pendingMarkdownPath = filePath;
    return;
  }

  try {
    const content = await readMarkdownPath(filePath);
    mainWindow.webContents.send("document:open-path", {
      name: path.basename(filePath),
      path: filePath,
      content,
    });
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!isSmokeTest) mainWindow.show();
    mainWindow.focus();
  } catch {
    if (!isSmokeTest) {
      dialog.showErrorBox(
        "بازکردن فایل ممکن نبود",
        "فایل باید Markdown و کوچک‌تر از ۲ مگابایت باشد.",
      );
    }
  }
}

async function createWindow() {
  if (!localServer) localServer = await createRaaviServer();
  rendererReady = false;

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
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
  mainWindow.webContents.once("did-finish-load", () => {
    rendererReady = true;
    if (pendingMarkdownPath) {
      const filePath = pendingMarkdownPath;
      pendingMarkdownPath = null;
      void openMarkdownPath(filePath);
    }
    if (isSmokeTest) setTimeout(() => app.quit(), 500);
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
    if (filePath) void openMarkdownPath(filePath);
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.setAppUserModelId("ir.raavi.markdown");
  nativeTheme.themeSource = "light";
  registerDesktopHandlers();

  app.whenReady().then(createWindow);
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    if (localServer) void localServer.close();
  });
}
