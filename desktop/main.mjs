import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme,
  protocol,
  safeStorage,
  shell,
  WebContentsView,
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
  getCodexModels,
  runCodexAudioCleanup,
  runCodexPrompt,
  runCodexPersianReview,
  runCodexSmartAnnotations,
  resetCodexConnection,
  startCodexCliInstall,
  startCodexLogin,
} from "./codex-cli.mjs";
import {
  clearStoredAiPreferences,
  readStoredAiPreferences,
  writeStoredAiPreferences,
} from "./ai-preferences-store.mjs";
import { createAudioLocalController } from "./audio-local.mjs";
import { createAudioFileResponse } from "./audio-protocol.mjs";
import {
  STARTUP_RECOVERY_TIMEOUT_MS,
  startupOverlayDataUrl,
} from "./startup-overlay.mjs";
import { createVaultBackupCoordinator } from "./backup-vault.mjs";
import { createGoogleDriveBackupProvider } from "./google-drive-backup.mjs";
import { createProtonDriveBackupProvider } from "./proton-drive-backup.mjs";
import { restoreCloudBackupSet } from "./cloud-restore.mjs";
import { createSoftwareUpdateController } from "./software-update.mjs";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "raavi-audio",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

const desktopDirectory = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(desktopDirectory, "..");
const allowedLibraryRoots = new Set();
const allowedDocumentPaths = new Set();
const allowedExportPaths = new Set();
const allowedRestorePaths = new Set();
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
  if (startupOverlayView) void renderStartupOverlay(startupOverlayState);
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
let audioLocalController = null;
let backupCoordinator = null;
let googleDriveBackupProvider = null;
let protonDriveBackupProvider = null;
let startupOverlayView = null;
let startupOverlayTimer = null;
let startupOverlayState = "loading";
let startupDocumentRequest = null;
let softwareUpdateController = null;
const startupLogoDataUrls = new Map();

function startupLogoDataUrl(theme = currentWindowTheme) {
  const safeTheme = theme === "dark" ? "dark" : "light";
  if (startupLogoDataUrls.has(safeTheme)) {
    return startupLogoDataUrls.get(safeTheme);
  }
  try {
    const svg = readFileSync(
      path.join(appRoot, "build", safeTheme === "dark" ? "icon-dark.svg" : "icon.svg"),
    );
    const dataUrl = `data:image/svg+xml;base64,${svg.toString("base64")}`;
    startupLogoDataUrls.set(safeTheme, dataUrl);
    return dataUrl;
  } catch (error) {
    console.error("Raavi startup logo failed", error);
    return "";
  }
}

function clearStartupOverlayTimer() {
  if (startupOverlayTimer) clearTimeout(startupOverlayTimer);
  startupOverlayTimer = null;
}

function startupOverlayBounds() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return { x: 0, y: 0, width: 1, height: 1 };
  }
  const [width, height] = mainWindow.getContentSize();
  return {
    x: 0,
    y: 0,
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

function updateStartupOverlayBounds() {
  if (!startupOverlayView || startupOverlayView.webContents.isDestroyed()) return;
  startupOverlayView.setBounds(startupOverlayBounds());
}

async function renderStartupOverlay(state = "loading") {
  if (!startupOverlayView || startupOverlayView.webContents.isDestroyed()) return;
  startupOverlayState = state === "error" ? "error" : "loading";
  await startupOverlayView.webContents
    .loadURL(
      startupOverlayDataUrl({
        theme: currentWindowTheme,
        state: startupOverlayState,
        logoDataUrl: startupLogoDataUrl(),
      }),
    )
    .catch((error) => console.error("Raavi startup overlay failed", error));
}

function armStartupOverlayTimeout() {
  clearStartupOverlayTimer();
  startupOverlayTimer = setTimeout(() => {
    if (!startupOverlayView) return;
    if (isSmokeTest) {
      console.error("Raavi renderer did not become ready before the startup deadline.");
      app.exit(1);
      return;
    }
    void renderStartupOverlay("error");
  }, STARTUP_RECOVERY_TIMEOUT_MS);
}

function removeStartupOverlay() {
  clearStartupOverlayTimer();
  const view = startupOverlayView;
  startupOverlayView = null;
  if (!view) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.contentView.removeChildView(view);
  }
  if (!view.webContents.isDestroyed()) view.webContents.close();
}

function retryStartup() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  rendererReady = false;
  if (startupDocumentRequest) {
    pendingDocumentRequest = { ...startupDocumentRequest };
  }
  void renderStartupOverlay("loading");
  armStartupOverlayTimeout();
  mainWindow.webContents.reloadIgnoringCache();
}

async function createStartupOverlay() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  startupOverlayView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  startupOverlayView.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  startupOverlayView.webContents.on("will-navigate", (event, url) => {
    if (url === "raavi-retry://reload") {
      event.preventDefault();
      retryStartup();
      return;
    }
    if (!url.startsWith("raavi-window://")) return;
    event.preventDefault();
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const action = url.slice("raavi-window://".length).replace(/\/$/u, "");
    if (action === "minimize") mainWindow.minimize();
    if (action === "maximize") {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
    if (action === "close") mainWindow.close();
  });
  mainWindow.contentView.addChildView(startupOverlayView);
  updateStartupOverlayBounds();
  await renderStartupOverlay("loading");
  armStartupOverlayTimeout();
}

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

function aiPreferencesPath() {
  return path.join(app.getPath("userData"), "ai-preferences.json");
}

function googleDriveTokenPath() {
  return path.join(app.getPath("userData"), "google-drive-token.dat");
}

function configuredGoogleClientId() {
  const fromEnvironment = String(process.env.RAAVI_GOOGLE_CLIENT_ID ?? "").trim();
  if (fromEnvironment) return fromEnvironment;
  try {
    return readFileSync(
      path.join(appRoot, "build", "google-oauth-client-id.txt"),
      "utf8",
    ).trim();
  } catch {
    return "";
  }
}

function configuredGoogleClientSecret() {
  const fromEnvironment = String(process.env.RAAVI_GOOGLE_CLIENT_SECRET ?? "").trim();
  if (fromEnvironment) return fromEnvironment;
  try {
    return readFileSync(
      path.join(appRoot, "build", "google-oauth-client-secret.txt"),
      "utf8",
    ).trim();
  } catch {
    return "";
  }
}

async function ensureBackupServices() {
  if (
    backupCoordinator &&
    googleDriveBackupProvider &&
    protonDriveBackupProvider
  ) {
    return {
      coordinator: backupCoordinator,
      providers: {
        "google-drive": googleDriveBackupProvider,
        "proton-drive": protonDriveBackupProvider,
      },
    };
  }

  const seal = async (value) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw Object.assign(new Error("Secure token storage is unavailable."), {
        code: "secure-storage-unavailable",
      });
    }
    return safeStorage.encryptString(value).toString("base64");
  };
  const unseal = async (value) => {
    if (!safeStorage.isEncryptionAvailable()) {
      throw Object.assign(new Error("Secure token storage is unavailable."), {
        code: "secure-storage-unavailable",
      });
    }
    return safeStorage.decryptString(Buffer.from(value, "base64"));
  };

  googleDriveBackupProvider = createGoogleDriveBackupProvider({
    clientId: configuredGoogleClientId(),
    clientSecret: configuredGoogleClientSecret(),
    tokenPath: googleDriveTokenPath(),
    openExternal: (url) => shell.openExternal(url),
    seal,
    unseal,
  });
  protonDriveBackupProvider = createProtonDriveBackupProvider({
    userDataPath: app.getPath("userData"),
    downloadsPath: app.getPath("downloads"),
    openExternal: (url) => shell.openExternal(url),
  });
  const providers = {
    "google-drive": googleDriveBackupProvider,
    "proton-drive": protonDriveBackupProvider,
  };
  backupCoordinator = createVaultBackupCoordinator({
    userDataPath: app.getPath("userData"),
    providers,
    prepareAudioAssets: (snapshot) =>
      audioLocalController?.prepareBackupAssets(snapshot) ?? [],
    onStatus(status) {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send("backup:status-changed", status);
    },
  });
  const selectedProviderId = (await backupCoordinator.status()).providerId;
  const connection = await providers[selectedProviderId].connectionInfo();
  await backupCoordinator.updateConnection(connection);
  return { coordinator: backupCoordinator, providers };
}

async function getBackupStatus() {
  const { coordinator } = await ensureBackupServices();
  return coordinator.status();
}

async function getBackupProviderConnections() {
  const { providers } = await ensureBackupServices();
  const entries = await Promise.all(
    Object.entries(providers).map(async ([providerId, provider]) => {
      try {
        const connection = await provider.connectionInfo();
        return [
          providerId,
          {
            state: ["connected", "reauth", "error"].includes(
              connection?.state,
            )
              ? connection.state
              : "disconnected",
            accountEmail:
              typeof connection?.accountEmail === "string"
                ? connection.accountEmail
                : "",
          },
        ];
      } catch {
        return [providerId, { state: "error", accountEmail: "" }];
      }
    }),
  );
  return Object.fromEntries(entries);
}

async function updateBackupPreferences(_event, preferences) {
  const { coordinator } = await ensureBackupServices();
  return coordinator.updatePreferences(preferences);
}

function validBackupProviderId(value) {
  return value === "proton-drive" ? "proton-drive" : "google-drive";
}

async function selectBackupProvider(_event, providerId) {
  const { coordinator, providers } = await ensureBackupServices();
  const selectedProviderId = validBackupProviderId(providerId);
  const connection = await providers[selectedProviderId].connectionInfo();
  return coordinator.updateProvider(selectedProviderId, connection);
}

async function connectCloudProvider(providerId) {
  const { coordinator, providers } = await ensureBackupServices();
  const selectedProviderId = validBackupProviderId(providerId);
  const provider = providers[selectedProviderId];
  const currentStatus = await coordinator.status();
  try {
    const connection = await provider.connect();
    if (currentStatus.providerId !== selectedProviderId) {
      await coordinator.updateProvider(selectedProviderId, connection);
    } else {
      await coordinator.updateConnection(connection);
    }
    await coordinator.updateQuota(connection.quota ?? null);
    void coordinator.flush();
    return coordinator.status();
  } catch (error) {
    // Keep an already-active provider untouched while a second provider is
    // authorizing. The destination only changes after the new login succeeds.
    if (currentStatus.providerId === selectedProviderId) {
      await coordinator.updateConnection({
        state: error?.code === "reauth" ? "reauth" : "error",
        accountEmail: "",
        error:
          error instanceof Error
            ? error.message
            : "Cloud connection failed.",
      });
    }
    return {
      ...(await coordinator.status()),
      connectionError: {
        code: error?.code ?? "connection-error",
        message:
          error instanceof Error
            ? error.message
            : "Cloud connection failed.",
      },
    };
  }
}

async function disconnectCloudProvider(providerId) {
  const { coordinator, providers } = await ensureBackupServices();
  const selectedProviderId = validBackupProviderId(providerId);
  const provider = providers[selectedProviderId];
  const connection = await provider.disconnect();
  if ((await coordinator.status()).providerId === selectedProviderId) {
    await coordinator.updateConnection(connection);
  }
  return coordinator.status();
}

async function connectGoogleDrive() {
  return connectCloudProvider("google-drive");
}

async function disconnectGoogleDrive() {
  return disconnectCloudProvider("google-drive");
}

async function connectBackupProvider(_event, providerId) {
  return connectCloudProvider(providerId);
}

async function disconnectBackupProvider(_event, providerId) {
  return disconnectCloudProvider(providerId);
}

async function promoteSnapshotToVault(_event, snapshot, reason) {
  const { coordinator } = await ensureBackupServices();
  return coordinator.stageSnapshot(snapshot, reason || "first-edit");
}

async function getSnapshotResidency(_event, snapshot) {
  const { coordinator } = await ensureBackupServices();
  return coordinator.documentResidency(snapshot);
}

async function flushBackup() {
  const { coordinator } = await ensureBackupServices();
  return coordinator.flush();
}

async function listCloudBackups() {
  const { coordinator, providers } = await ensureBackupServices();
  const status = await coordinator.status();
  if (status.connection.state !== "connected") {
    throw Object.assign(new Error("ابتدا فضای ابری را متصل کنید."), {
      code: "backup-disconnected",
    });
  }
  const provider = providers[status.providerId];
  if (!provider?.listBackups) {
    throw Object.assign(new Error("بازیابی برای این فضای ابری در دسترس نیست."), {
      code: "restore-unsupported",
    });
  }
  return provider.listBackups();
}

async function restoreCloudBackups(event, documentIds) {
  const ids = Array.isArray(documentIds)
    ? [...new Set(documentIds.map((value) => String(value || "")))]
        .filter((value) => /^[a-f0-9]{16,64}$/iu.test(value))
        .slice(0, 1_000)
    : [];
  if (!ids.length) {
    throw Object.assign(new Error("حداقل یک سند را برای بازیابی انتخاب کنید."), {
      code: "restore-selection-empty",
    });
  }
  const { coordinator, providers } = await ensureBackupServices();
  const status = await coordinator.status();
  if (status.connection.state !== "connected") {
    throw Object.assign(new Error("اتصال فضای ابری قطع شده است؛ دوباره وارد شوید."), {
      code: "backup-disconnected",
    });
  }
  const provider = providers[status.providerId];
  if (!provider?.listBackups || !provider?.downloadBackup) {
    throw Object.assign(new Error("بازیابی برای این فضای ابری در دسترس نیست."), {
      code: "restore-unsupported",
    });
  }
  const availableIds = new Set(
    (await provider.listBackups()).map((backup) => backup.documentId),
  );
  const selectedIds = ids.filter((id) => availableIds.has(id));
  if (!selectedIds.length) {
    throw Object.assign(new Error("بکاپ‌های انتخاب‌شده دیگر در فضای ابری وجود ندارند."), {
      code: "backup-missing",
    });
  }

  const owner = BrowserWindow.fromWebContents(event.sender) ?? mainWindow;
  const destination = await dialog.showOpenDialog(owner, {
    title: "انتخاب محل بازیابی فایل‌های راوی",
    buttonLabel: "بازیابی در این پوشه",
    defaultPath: app.getPath("documents"),
    properties: ["openDirectory", "createDirectory", "dontAddToRecent"],
  });
  if (destination.canceled || !destination.filePaths[0]) {
    return { canceled: true, restored: [], failed: [] };
  }

  const result = await restoreCloudBackupSet({
    documentIds: selectedIds,
    parentDirectory: destination.filePaths[0],
    downloadBackup: (documentId) => provider.downloadBackup(documentId),
    saveHistory: saveHistoryForPath,
  });
  const restoreRoot = path.resolve(result.restoreRoot);
  allowedRestorePaths.add(normalizedPathKey(restoreRoot));
  allowedLibraryRoots.add(restoreRoot);
  for (const item of result.restored) {
    allowedDocumentPaths.add(normalizedPathKey(item.filePath));
  }
  await rememberLibraryFolder(restoreRoot);
  watchLibraryFolder(restoreRoot);
  notifyLibraryChanged(restoreRoot, "restore");
  return {
    canceled: false,
    providerId: status.providerId,
    ...result,
  };
}

async function revealCloudRestore(_event, restoreRoot) {
  const resolvedPath = path.resolve(String(restoreRoot || ""));
  if (!allowedRestorePaths.has(normalizedPathKey(resolvedPath))) {
    throw new Error("این مسیر بازیابی در نشست جاری تأیید نشده است.");
  }
  const error = await shell.openPath(resolvedPath);
  return { revealed: !error };
}

let aiPreferencesWriteQueue = Promise.resolve();

function getStoredAiPreferences() {
  return readStoredAiPreferences(aiPreferencesPath());
}

function saveStoredAiPreferences(_event, preferences) {
  aiPreferencesWriteQueue = aiPreferencesWriteQueue
    .catch(() => {})
    .then(() => writeStoredAiPreferences(aiPreferencesPath(), preferences));
  return aiPreferencesWriteQueue;
}

function clearAiPreferences() {
  aiPreferencesWriteQueue = aiPreferencesWriteQueue
    .catch(() => {})
    .then(() => clearStoredAiPreferences(aiPreferencesPath()));
  return aiPreferencesWriteQueue;
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
      if (snapshot.residency && snapshot.residency !== "reading") {
        void ensureBackupServices()
          .then(({ coordinator }) =>
            coordinator.stageSnapshot(
              snapshot,
              snapshot.vaultReason || "local-change",
            ),
          )
          .catch(() => {});
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

  const { coordinator } = await ensureBackupServices();
  const knownResidency = await coordinator.documentResidency({
    activeDocumentPath: filePath,
    fileName: documentValue.name,
  });

  return {
    ...documentValue,
    openInReadingMode: Boolean(options.openInReadingMode),
    residency:
      knownResidency === "reading" && !options.openInReadingMode
        ? "vault-local"
        : knownResidency,
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
  const { coordinator } = await ensureBackupServices();
  const knownResidency = await coordinator.documentResidency({
    activeDocumentPath: filePath,
    fileName: documentValue.name,
  });
  return {
    ...documentValue,
    openInReadingMode: false,
    residency: knownResidency === "reading" ? "vault-local" : knownResidency,
  };
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
  let defaultDirectory = app.getPath("documents");
  if (typeof payload?.defaultDirectory === "string") {
    const requestedDirectory = path.resolve(payload.defaultDirectory);
    try {
      if ((await stat(requestedDirectory)).isDirectory()) {
        defaultDirectory = requestedDirectory;
      }
    } catch {
      // A removed or inaccessible preference safely falls back to Documents.
    }
  }
  const result = await dialog.showSaveDialog(owner, {
    title: "ذخیره‌ی فایل Markdown",
    buttonLabel: "ذخیره فایل",
    defaultPath: path.join(defaultDirectory, fileName),
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
  audioLocalController = createAudioLocalController({
    emit(event) {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      mainWindow.webContents.send("audio:local-event", event);
    },
    ensureDocumentAccess,
    getOwner: () => mainWindow,
  });
  ipcMain.handle("renderer-state:get", getRendererState);
  ipcMain.handle("renderer-state:save", saveRendererState);
  ipcMain.handle("backup:get-status", getBackupStatus);
  ipcMain.handle(
    "backup:get-provider-connections",
    getBackupProviderConnections,
  );
  ipcMain.handle("backup:update-preferences", updateBackupPreferences);
  ipcMain.handle("backup:select-provider", selectBackupProvider);
  ipcMain.handle("backup:connect-provider", connectBackupProvider);
  ipcMain.handle("backup:disconnect-provider", disconnectBackupProvider);
  ipcMain.handle("backup:connect-google", connectGoogleDrive);
  ipcMain.handle("backup:disconnect-google", disconnectGoogleDrive);
  ipcMain.handle("backup:flush", flushBackup);
  ipcMain.handle("backup:list-cloud", listCloudBackups);
  ipcMain.handle("backup:restore-cloud", restoreCloudBackups);
  ipcMain.handle("backup:reveal-restore", revealCloudRestore);
  ipcMain.handle("vault:promote", promoteSnapshotToVault);
  ipcMain.handle("vault:residency", getSnapshotResidency);
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
  ipcMain.handle("software-update:get-status", () =>
    softwareUpdateController?.getState(),
  );
  ipcMain.handle("software-update:check", () =>
    softwareUpdateController?.check({ manual: true }),
  );
  ipcMain.handle("software-update:download", () =>
    softwareUpdateController?.download(),
  );
  ipcMain.handle("software-update:pause", () =>
    softwareUpdateController?.pause(),
  );
  ipcMain.handle("software-update:resume", () =>
    softwareUpdateController?.resume(),
  );
  ipcMain.handle("software-update:cancel", () =>
    softwareUpdateController?.cancel(),
  );
  ipcMain.handle("software-update:install", async () => {
    const result = await softwareUpdateController?.install();
    if (result?.started) setTimeout(() => app.quit(), 120);
    return result;
  });
  ipcMain.handle("software-update:open-notes", async () => {
    const notesUrl = softwareUpdateController?.getState()?.notesUrl;
    if (!notesUrl) return { opened: false };
    await shell.openExternal(notesUrl);
    return { opened: true };
  });
  ipcMain.handle("software-update:open-direct-download", async () => {
    const directUrl = softwareUpdateController?.getDirectDownloadUrl();
    if (!directUrl) return { opened: false };
    await shell.openExternal(directUrl);
    return { opened: true };
  });
  ipcMain.handle("ai:preferences-get", getStoredAiPreferences);
  ipcMain.handle("ai:preferences-save", saveStoredAiPreferences);
  ipcMain.handle("ai:preferences-clear", clearAiPreferences);
  ipcMain.handle("codex:connection-status", getCodexConnectionStatus);
  ipcMain.handle("codex:models", getCodexModels);
  ipcMain.handle("codex:install-cli", startCodexCliInstall);
  ipcMain.handle("codex:start-login", startCodexLogin);
  ipcMain.handle("codex:reset-connection", resetCodexConnection);
  ipcMain.handle("codex:run", (_event, payload) => runCodexPrompt(payload));
  ipcMain.handle("codex:audio-cleanup", (_event, payload) =>
    runCodexAudioCleanup(payload),
  );
  ipcMain.handle("codex:persian-review", (_event, payload) =>
    runCodexPersianReview(payload),
  );
  ipcMain.handle("codex:smart-annotations", (_event, payload) =>
    runCodexSmartAnnotations(payload),
  );
  ipcMain.handle("audio:choose-asset", audioLocalController.chooseAudioAsset);
  ipcMain.handle("audio:remove-asset", audioLocalController.removeAudioAsset);
  ipcMain.handle("audio:resolve-asset", audioLocalController.resolveAudioAsset);
  ipcMain.handle("audio:model-state", audioLocalController.getAudioModelState);
  ipcMain.handle("audio:model-install", audioLocalController.installAudioModel);
  ipcMain.handle("audio:model-pause", audioLocalController.pauseAudioModelInstall);
  ipcMain.handle("audio:model-resume", audioLocalController.resumeAudioModelInstall);
  ipcMain.handle("audio:model-delete", audioLocalController.deleteAudioModel);
  ipcMain.handle("audio:transcription-start", audioLocalController.startAudioTranscription);
  ipcMain.handle("audio:transcription-pause", audioLocalController.pauseAudioTranscription);
  ipcMain.handle("audio:transcription-resume", audioLocalController.resumeAudioTranscription);
  ipcMain.handle("audio:transcription-cancel", audioLocalController.cancelAudioTranscription);
  ipcMain.handle("audio:transcription-list", audioLocalController.listAudioTranscriptionJobs);
  ipcMain.handle("audio:transcription-save-result", audioLocalController.saveAudioTranscriptionResult);
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
      startupDocumentRequest = { ...request };
      void openDocumentPath(request.filePath, {
        openInReadingMode: request.openInReadingMode,
      });
    } else {
      removeStartupOverlay();
    }
    if (isSmokeTest && !startupDocumentRequest) {
      setTimeout(() => app.quit(), 600);
    }
  });
  ipcMain.on("renderer:document-presented", (event) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) return;
    startupDocumentRequest = null;
    removeStartupOverlay();
    if (isSmokeTest) setTimeout(() => app.quit(), 200);
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
    if (startupOverlayView) void renderStartupOverlay("error");
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
  currentWindowTheme = nativeTheme.shouldUseDarkColors ? "dark" : "light";

  mainWindow = new BrowserWindow({
    width: 1540,
    height: 920,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    frame: false,
    backgroundColor:
      currentWindowTheme === "dark" ? "#141A16" : "#E9E5DC",
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
  mainWindow.on("resize", updateStartupOverlayBounds);
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
  mainWindow.webContents.once(
    "did-fail-load",
    (_event, _errorCode, errorDescription) => {
      console.error("Raavi desktop load failed", errorDescription);
      if (startupOverlayView) void renderStartupOverlay("error");
      if (isSmokeTest) app.exit(1);
    },
  );
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Raavi renderer process ended", details.reason);
    if (startupOverlayView) void renderStartupOverlay("error");
  });
  mainWindow.on("unresponsive", () => {
    console.error("Raavi renderer became unresponsive during startup.");
    if (startupOverlayView) void renderStartupOverlay("error");
  });
  mainWindow.on("closed", () => {
    rendererReady = false;
    startupDocumentRequest = null;
    removeStartupOverlay();
    mainWindow = null;
  });

  await createStartupOverlay();
  if (!isSmokeTest) mainWindow.show();
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

  app.whenReady().then(async () => {
    softwareUpdateController = createSoftwareUpdateController({
      currentVersion: app.getVersion(),
      userDataPath: app.getPath("userData"),
      publicKeyPath: path.join(appRoot, "build", "update-public-key.pem"),
      manifestUrl:
        process.env.RAAVI_UPDATE_MANIFEST_URL || undefined,
      emit(status) {
        if (!mainWindow || mainWindow.isDestroyed()) return;
        mainWindow.webContents.send("software-update:status-changed", status);
      },
    });
    protocol.handle("raavi-audio", async (request) => {
      const filePath = audioLocalController?.resolveProtocol(request.url);
      if (!filePath) return new Response("Audio asset not found", { status: 404 });
      try {
        return await createAudioFileResponse(request, filePath);
      } catch {
        return new Response("Audio asset not found", { status: 404 });
      }
    });
    await createWindow();
    if (!isSmokeTest) softwareUpdateController.start();
  });
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) void createWindow();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
  app.on("before-quit", () => {
    clearStartupOverlayTimer();
    closeLibraryWatchers();
    audioLocalController?.dispose();
    backupCoordinator?.dispose();
    softwareUpdateController?.dispose();
    if (localServer) void localServer.close();
  });
}
