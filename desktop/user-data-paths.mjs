import path from "node:path";

export function resolveUserDataPaths(appDataDirectory, explicitDirectory = "") {
  if (explicitDirectory) {
    return { directory: path.resolve(explicitDirectory), legacyDirectory: null };
  }
  return {
    directory: path.join(appDataDirectory, "Raavi"),
    legacyDirectory: path.join(appDataDirectory, "راوی"),
  };
}
