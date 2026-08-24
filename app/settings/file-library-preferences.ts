export type FileOpenMode = "reading" | "writing";
export type LibraryFileVisibility = "all" | "markdown";

export type FileLibraryPreferences = {
  defaultOpenMode: FileOpenMode;
  fileVisibility: LibraryFileVisibility;
  autoRefresh: boolean;
  activeWorkspaceRootId: string;
  restoreDocumentTabs: boolean;
};

export const FILE_LIBRARY_PREFERENCES_STORAGE_KEY =
  "raavi:file-library-preferences:v1";

export const DEFAULT_FILE_LIBRARY_PREFERENCES: FileLibraryPreferences = {
  defaultOpenMode: "reading",
  fileVisibility: "all",
  autoRefresh: true,
  activeWorkspaceRootId: "",
  restoreDocumentTabs: true,
};

export function parseFileLibraryPreferences(
  stored: string | null,
): FileLibraryPreferences {
  if (!stored) return DEFAULT_FILE_LIBRARY_PREFERENCES;
  try {
    const value = JSON.parse(stored) as Partial<FileLibraryPreferences>;
    return {
      defaultOpenMode:
        value.defaultOpenMode === "writing" ? "writing" : "reading",
      fileVisibility:
        value.fileVisibility === "markdown" ? value.fileVisibility : "all",
      autoRefresh:
        typeof value.autoRefresh === "boolean" ? value.autoRefresh : true,
      activeWorkspaceRootId:
        typeof value.activeWorkspaceRootId === "string"
          ? value.activeWorkspaceRootId
          : "",
      restoreDocumentTabs:
        typeof value.restoreDocumentTabs === "boolean"
          ? value.restoreDocumentTabs
          : true,
    };
  } catch {
    return DEFAULT_FILE_LIBRARY_PREFERENCES;
  }
}
