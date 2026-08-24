import path from "node:path";

export function normalizedPathKey(filePath) {
  return path.resolve(String(filePath)).toLocaleLowerCase("en-US");
}

export function isPathInsideRoot(filePath, rootPath) {
  const resolvedFile = path.resolve(String(filePath));
  const resolvedRoot = path.resolve(String(rootPath));
  const relativePath = path.relative(resolvedRoot, resolvedFile);
  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !path.isAbsolute(relativePath)
  );
}

export function canRestoreDocumentAccess(filePath, libraryState) {
  const requestedKey = normalizedPathKey(filePath);
  const recents = Array.isArray(libraryState?.recents)
    ? libraryState.recents
    : [];
  const folders = Array.isArray(libraryState?.folders)
    ? libraryState.folders
    : [];

  return (
    recents.some(
      (recent) =>
        typeof recent?.path === "string" &&
        normalizedPathKey(recent.path) === requestedKey,
    ) ||
    folders.some(
      (rootPath) =>
        typeof rootPath === "string" &&
        isPathInsideRoot(filePath, rootPath),
    )
  );
}
