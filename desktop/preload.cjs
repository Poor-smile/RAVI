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
    chooseMarkdownFolder: () => ipcRenderer.invoke("library:choose-folder"),
    scanMarkdownFolder: (rootPath) =>
      ipcRenderer.invoke("library:scan-folder", rootPath),
    readLibraryDocument: (filePath) =>
      ipcRenderer.invoke("library:read-file", filePath),
    chooseDocument: () => ipcRenderer.invoke("document:choose"),
    openRecentDocument: (filePath) =>
      ipcRenderer.invoke("document:open-recent", filePath),
    saveMarkdown: (fileName, document) =>
      ipcRenderer.invoke("document:save-markdown", { fileName, document }),
    saveRaavi: (fileName, document) =>
      ipcRenderer.invoke("document:save-ravi", { fileName, document }),
    saveCurrentDocument: (filePath, document) =>
      ipcRenderer.invoke("document:save-current", { filePath, document }),
    saveWordExport: (fileName, bytes) =>
      ipcRenderer.invoke("export:save-word", { fileName, bytes }),
    exportPdf: (fileName) => ipcRenderer.invoke("export:pdf", { fileName }),
    rendererReady: () => ipcRenderer.send("renderer:ready"),
    onOpenMarkdownFile: (callback) => {
      const listener = (_event, document) => callback(document);
      ipcRenderer.on("document:open-path", listener);
      return () => ipcRenderer.removeListener("document:open-path", listener);
    },
  }),
);
