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
  }),
);
