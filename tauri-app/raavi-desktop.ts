import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { RaaviDesktopAPI } from "../app/page";

type OpenedDocument = Parameters<
  RaaviDesktopAPI["onOpenMarkdownFile"]
>[0] extends (document: infer Document) => void
  ? Document
  : never;

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
  chooseMarkdownFolder: () => invoke("choose_markdown_folder"),
  scanMarkdownFolder: (rootPath) =>
    invoke("scan_markdown_folder", { rootPath }),
  readLibraryDocument: (filePath) =>
    invoke("read_library_document", { filePath }),
  chooseDocument: () => invoke("choose_document"),
  openRecentDocument: (filePath) =>
    invoke("open_recent_document", { filePath }),
  saveMarkdown: (fileName, document) =>
    invoke("save_markdown", { fileName, document }),
  saveRaavi: (fileName, document) =>
    invoke("save_raavi", { fileName, document }),
  saveCurrentDocument: (filePath, document) =>
    invoke("save_current_document", { filePath, document }),
  saveWordExport: (fileName, bytes) =>
    invoke("save_word_export", bytes, {
      headers: { "x-raavi-file-name": encodeURIComponent(fileName) },
    }),
  exportPdf: (fileName) => invoke("export_pdf", { fileName }),
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

window.raaviDesktop = desktopApi;

document.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof Element)) return;
  const anchor = target.closest<HTMLAnchorElement>("a[href]");
  if (!anchor) return;

  const url = new URL(anchor.href, window.location.href);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  event.preventDefault();
  void openUrl(url.href);
});
