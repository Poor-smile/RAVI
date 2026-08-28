/* eslint-disable @typescript-eslint/no-require-imports */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld(
  "raaviDesktop",
  Object.freeze({
    isDesktop: true,
    getLocalDocumentSnapshot: () => ipcRenderer.invoke("renderer-state:get"),
    saveLocalDocumentSnapshot: (snapshot) =>
      ipcRenderer.invoke("renderer-state:save", snapshot),
    getBackupStatus: () => ipcRenderer.invoke("backup:get-status"),
    getBackupProviderConnections: () =>
      ipcRenderer.invoke("backup:get-provider-connections"),
    updateBackupPreferences: (preferences) =>
      ipcRenderer.invoke("backup:update-preferences", preferences),
    selectBackupProvider: (providerId) =>
      ipcRenderer.invoke("backup:select-provider", providerId),
    connectBackupProvider: (providerId) =>
      ipcRenderer.invoke("backup:connect-provider", providerId),
    disconnectBackupProvider: (providerId) =>
      ipcRenderer.invoke("backup:disconnect-provider", providerId),
    connectGoogleDrive: () => ipcRenderer.invoke("backup:connect-google"),
    disconnectGoogleDrive: () =>
      ipcRenderer.invoke("backup:disconnect-google"),
    flushBackup: () => ipcRenderer.invoke("backup:flush"),
    listCloudBackups: () => ipcRenderer.invoke("backup:list-cloud"),
    restoreCloudBackups: (documentIds) =>
      ipcRenderer.invoke("backup:restore-cloud", documentIds),
    revealCloudRestore: (restoreRoot) =>
      ipcRenderer.invoke("backup:reveal-restore", restoreRoot),
    promoteToVault: (snapshot, reason) =>
      ipcRenderer.invoke("vault:promote", snapshot, reason),
    getVaultResidency: (snapshot) =>
      ipcRenderer.invoke("vault:residency", snapshot),
    onBackupStatusChanged: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on("backup:status-changed", listener);
      return () => ipcRenderer.removeListener("backup:status-changed", listener);
    },
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
    saveMarkdown: (fileName, document, defaultDirectory) =>
      ipcRenderer.invoke("document:save-markdown", {
        fileName,
        document,
        defaultDirectory,
      }),
    saveCurrentDocument: (filePath, document) =>
      ipcRenderer.invoke("document:save-current", { filePath, document }),
    saveWordExport: (fileName, bytes) =>
      ipcRenderer.invoke("export:save-word", { fileName, bytes }),
    exportPdf: (fileName) => ipcRenderer.invoke("export:pdf", { fileName }),
    revealExport: (filePath) =>
      ipcRenderer.invoke("export:reveal", { filePath }),
    openExternalUrl: (url) => ipcRenderer.invoke("external:open-url", url),
    getSoftwareUpdateStatus: () =>
      ipcRenderer.invoke("software-update:get-status"),
    checkSoftwareUpdate: () => ipcRenderer.invoke("software-update:check"),
    downloadSoftwareUpdate: () =>
      ipcRenderer.invoke("software-update:download"),
    pauseSoftwareUpdate: () => ipcRenderer.invoke("software-update:pause"),
    resumeSoftwareUpdate: () => ipcRenderer.invoke("software-update:resume"),
    cancelSoftwareUpdate: () => ipcRenderer.invoke("software-update:cancel"),
    installSoftwareUpdate: () => ipcRenderer.invoke("software-update:install"),
    openSoftwareUpdateNotes: () =>
      ipcRenderer.invoke("software-update:open-notes"),
    openSoftwareUpdateDirectDownload: () =>
      ipcRenderer.invoke("software-update:open-direct-download"),
    onSoftwareUpdateStatusChanged: (callback) => {
      const listener = (_event, status) => callback(status);
      ipcRenderer.on("software-update:status-changed", listener);
      return () =>
        ipcRenderer.removeListener("software-update:status-changed", listener);
    },
    getAiPreferences: () => ipcRenderer.invoke("ai:preferences-get"),
    saveAiPreferences: (preferences) =>
      ipcRenderer.invoke("ai:preferences-save", preferences),
    clearAiPreferences: () => ipcRenderer.invoke("ai:preferences-clear"),
    getCodexConnectionStatus: () =>
      ipcRenderer.invoke("codex:connection-status"),
    getCodexModels: () => ipcRenderer.invoke("codex:models"),
    installCodexCli: () => ipcRenderer.invoke("codex:install-cli"),
    startCodexLogin: () => ipcRenderer.invoke("codex:start-login"),
    resetCodexConnection: () => ipcRenderer.invoke("codex:reset-connection"),
    runCodexPrompt: (payload) => ipcRenderer.invoke("codex:run", payload),
    runCodexPersianReview: (payload) =>
      ipcRenderer.invoke("codex:persian-review", payload),
    runCodexSmartAnnotations: (payload) =>
      ipcRenderer.invoke("codex:smart-annotations", payload),
    chooseAudioAsset: (documentPath) =>
      ipcRenderer.invoke("audio:choose-asset", documentPath),
    removeAudioAsset: (documentPath, relativePath) =>
      ipcRenderer.invoke("audio:remove-asset", documentPath, relativePath),
    resolveAudioAsset: (documentPath, relativePath) =>
      ipcRenderer.invoke("audio:resolve-asset", documentPath, relativePath),
    getAudioModelState: () => ipcRenderer.invoke("audio:model-state"),
    installAudioModel: (tier) =>
      ipcRenderer.invoke("audio:model-install", tier),
    pauseAudioModelInstall: () => ipcRenderer.invoke("audio:model-pause"),
    resumeAudioModelInstall: () => ipcRenderer.invoke("audio:model-resume"),
    deleteAudioModel: (tier) =>
      ipcRenderer.invoke("audio:model-delete", tier),
    startAudioTranscription: (payload) =>
      ipcRenderer.invoke("audio:transcription-start", payload),
    pauseAudioTranscription: (jobId) =>
      ipcRenderer.invoke("audio:transcription-pause", jobId),
    resumeAudioTranscription: (jobId) =>
      ipcRenderer.invoke("audio:transcription-resume", jobId),
    cancelAudioTranscription: (jobId) =>
      ipcRenderer.invoke("audio:transcription-cancel", jobId),
    listAudioTranscriptionJobs: (documentPath) =>
      ipcRenderer.invoke("audio:transcription-list", documentPath),
    saveAudioTranscriptionResult: (jobId, result) =>
      ipcRenderer.invoke("audio:transcription-save-result", jobId, result),
    runCodexAudioCleanup: (payload) =>
      ipcRenderer.invoke("codex:audio-cleanup", payload),
    onAudioLocalEvent: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on("audio:local-event", listener);
      return () => ipcRenderer.removeListener("audio:local-event", listener);
    },
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
    documentPresented: () => ipcRenderer.send("renderer:document-presented"),
    onOpenMarkdownFile: (callback) => {
      const listener = (_event, document) => callback(document);
      ipcRenderer.on("document:open-path", listener);
      return () => ipcRenderer.removeListener("document:open-path", listener);
    },
  }),
);
