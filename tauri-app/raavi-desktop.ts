import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";
import type { RaaviDesktopAPI } from "../app/page";

type OpenedDocument = Parameters<
  RaaviDesktopAPI["onOpenMarkdownFile"]
>[0] extends (document: infer Document) => void
  ? Document
  : never;
type LibraryState = Awaited<ReturnType<RaaviDesktopAPI["getLibraryState"]>>;

let openDocumentListenerReady = Promise.resolve();
const RENDERER_STATE_STORAGE_KEY = "raavi:tauri-renderer-state:v1";

const desktopApi = Object.freeze<RaaviDesktopAPI>({
  isDesktop: true,
  getLocalDocumentSnapshot: async () => {
    try {
      const saved = window.localStorage.getItem(RENDERER_STATE_STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  },
  saveLocalDocumentSnapshot: async (snapshot) => {
    window.localStorage.setItem(
      RENDERER_STATE_STORAGE_KEY,
      JSON.stringify(snapshot),
    );
    return { saved: true };
  },
  saveReadingPositions: async (readingPositions) => {
    let currentSnapshot: Record<string, unknown> = {};
    try {
      const saved = window.localStorage.getItem(RENDERER_STATE_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        currentSnapshot = parsed;
      }
    } catch {
      currentSnapshot = {};
    }
    window.localStorage.setItem(
      RENDERER_STATE_STORAGE_KEY,
      JSON.stringify({ ...currentSnapshot, readingPositions }),
    );
    return { saved: true };
  },
  getLibraryState: () => invoke("get_library_state"),
  clearRecentFiles: () => invoke("clear_recent_files"),
  removeRecentFileIfMissing: (filePath) =>
    invoke("remove_recent_file_if_missing", { filePath }),
  chooseMarkdownFolder: () => invoke("choose_markdown_folder"),
  disconnectLibraryFolder: (rootPath) =>
    invoke("disconnect_library_folder", { rootPath }),
  scanMarkdownFolder: (rootPath) =>
    invoke("scan_markdown_folder", { rootPath }),
  readLibraryDocument: (filePath) =>
    invoke("read_library_document", { filePath }),
  readLibrarySearchText: (filePath) =>
    invoke("read_library_search_text", { filePath }),
  onLibraryChanged: (callback) => {
    let disposed = false;
    let unlisten: UnlistenFn | undefined;
    const announceFolders = async () => {
      try {
        const library = await invoke<LibraryState>("get_library_state");
        if (disposed) return;
        for (const folder of library.folders) {
          callback({ rootPath: folder.rootPath, reason: "focus" });
        }
      } catch {
        // Manual refresh remains available if native state cannot be read.
      }
    };
    void listen<{ rootPath: string; reason: string }>(
      "library-changed",
      (event) => {
        if (!disposed) callback(event.payload);
      },
    ).then((nextUnlisten) => {
      if (disposed) nextUnlisten();
      else unlisten = nextUnlisten;
    });
    window.addEventListener("focus", announceFolders);
    document.addEventListener("visibilitychange", announceFolders);
    return () => {
      disposed = true;
      unlisten?.();
      window.removeEventListener("focus", announceFolders);
      document.removeEventListener("visibilitychange", announceFolders);
    };
  },
  chooseDocument: () => invoke("choose_document"),
  openRecentDocument: (filePath) =>
    invoke("open_recent_document", { filePath }),
  readDocumentVersions: (filePath) =>
    invoke("read_document_versions", { filePath }),
  saveMarkdown: (fileName, document, defaultDirectory) =>
    invoke("save_markdown", { fileName, document, defaultDirectory }),
  saveCurrentDocument: (filePath, document) =>
    invoke("save_current_document", { filePath, document }),
  saveWordExport: (fileName, bytes) =>
    invoke("save_word_export", bytes, {
      headers: { "x-raavi-file-name": encodeURIComponent(fileName) },
    }),
  exportPdf: (fileName) => invoke("export_pdf", { fileName }),
  revealExport: async (filePath) => {
    await revealItemInDir(filePath);
    return { revealed: true };
  },
  openExternalUrl: async (url) => {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return { opened: false };
    }
    await openUrl(parsed.href);
    return { opened: true };
  },
  minimizeWindow: async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().minimize();
  },
  toggleMaximizeWindow: async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().toggleMaximize();
  },
  closeWindow: async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  },
  rendererReady: () => {
    void openDocumentListenerReady.then(() => invoke("renderer_ready"));
  },
  onOpenMarkdownFile: (callback) => {
    let disposed = false;
    let unlisten: UnlistenFn | undefined;

    openDocumentListenerReady = listen<OpenedDocument>(
      "document-open-path",
      (event) => {
        callback(event.payload);
      },
    ).then((nextUnlisten) => {
      if (disposed) nextUnlisten();
      else unlisten = nextUnlisten;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  },
});

const isTauriRuntime = "__TAURI_INTERNALS__" in window;

if (isTauriRuntime) {
  window.raaviDesktop = desktopApi;

  document.addEventListener("click", (event) => {
    if (event.defaultPrevented) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>("a[href]");
    if (!anchor) return;

    const url = new URL(anchor.href, window.location.href);
    if (url.protocol !== "http:" && url.protocol !== "https:") return;
    event.preventDefault();
    void openUrl(url.href);
  });
}
