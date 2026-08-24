/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "raaviDesktop",
  Object.freeze({
    isDesktop: true,
    getLocalDocumentSnapshot: () => ipcRenderer.invoke("renderer-state:get"),
    saveLocalDocumentSnapshot: (snapshot) =>
      ipcRenderer.invoke("renderer-state:save", snapshot),
    saveReadingPositions: (positions) =>
      ipcRenderer.invoke("renderer-state:save-reading-positions", positions),
    saveReadingPositionsSync: (positions) =>
      ipcRenderer.sendSync(
        "renderer-state:save-reading-positions-sync",
        positions,
      ),
    getLibraryState: () => ipcRenderer.invoke("library:get-state"),
    clearRecentFiles: () => ipcRenderer.invoke("library:clear-recents"),
    removeRecentFileIfMissing: (filePath) =>
      ipcRenderer.invoke("library:remove-recent-if-missing", filePath),
    chooseMarkdownFolder: () => ipcRenderer.invoke("library:choose-folder"),
    disconnectLibraryFolder: (rootPath) =>
      ipcRenderer.invoke("library:disconnect-folder", rootPath),
    scanMarkdownFolder: (rootPath) =>
      ipcRenderer.invoke("library:scan-folder", rootPath),
    readLibraryDocument: (filePath) =>
      ipcRenderer.invoke("library:read-file", filePath),
    readLibrarySearchText: (filePath) =>
      ipcRenderer.invoke("library:read-search-text", filePath),
    mutateLibrary: (rootPath, request) =>
      ipcRenderer.invoke("library:mutate", { rootPath, request }),
    undoLibraryMutation: (token) => ipcRenderer.invoke("library:undo", token),
    onLibraryChanged: (callback) => {
      const listener = (_event, change) => callback(change);
      ipcRenderer.on("library:changed", listener);
      return () => ipcRenderer.removeListener("library:changed", listener);
    },
    chooseDocument: () => ipcRenderer.invoke("document:choose"),
    openRecentDocument: (filePath) =>
      ipcRenderer.invoke("document:open-recent", filePath),
    readDocumentVersions: (filePath) =>
      ipcRenderer.invoke("document:read-versions", filePath),
    saveMarkdown: (fileName, document) =>
      ipcRenderer.invoke("document:save-markdown", { fileName, document }),
    saveCurrentDocument: (filePath, document) =>
      ipcRenderer.invoke("document:save-current", { filePath, document }),
    saveWordExport: (fileName, bytes) =>
      ipcRenderer.invoke("export:save-word", { fileName, bytes }),
    exportPdf: (fileName) => ipcRenderer.invoke("export:pdf", { fileName }),
    revealExport: (filePath) =>
      ipcRenderer.invoke("export:reveal", { filePath }),
    openExternalUrl: (url) => ipcRenderer.invoke("external:open-url", url),
    getCodexConnectionStatus: () =>
      ipcRenderer.invoke("codex:connection-status"),
    startCodexLogin: () => ipcRenderer.invoke("codex:start-login"),
    runCodexPrompt: (payload) => ipcRenderer.invoke("codex:run", payload),
    runCodexPersianReview: (payload) =>
      ipcRenderer.invoke("codex:persian-review", payload),
    runCodexSmartAnnotations: (payload) =>
      ipcRenderer.invoke("codex:smart-annotations", payload),
    setWindowTheme: (theme) => ipcRenderer.send("window:set-theme", theme),
    minimizeWindow: async () => {
      ipcRenderer.send("window:minimize");
    },
    toggleMaximizeWindow: async () => {
      ipcRenderer.send("window:toggle-maximize");
    },
    closeWindow: async () => {
      ipcRenderer.send("window:close");
    },
    rendererReady: () => ipcRenderer.send("renderer:ready"),
    onOpenMarkdownFile: (callback) => {
      const listener = (_event, document) => callback(document);
      ipcRenderer.on("document:open-path", listener);
      return () => ipcRenderer.removeListener("document:open-path", listener);
    },
  }),
);
