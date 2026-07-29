/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "raaviDesktop",
  Object.freeze({
    isDesktop: true,
    chooseMarkdownFolder: () => ipcRenderer.invoke("library:choose-folder"),
    scanMarkdownFolder: (rootPath) =>
      ipcRenderer.invoke("library:scan-folder", rootPath),
    readMarkdownFile: (filePath) =>
      ipcRenderer.invoke("library:read-file", filePath),
    saveMarkdown: (fileName, content) =>
      ipcRenderer.invoke("document:save-markdown", { fileName, content }),
    onOpenMarkdownFile: (callback) => {
      const listener = (_event, document) => callback(document);
      ipcRenderer.on("document:open-path", listener);
      return () => ipcRenderer.removeListener("document:open-path", listener);
    },
  }),
);
