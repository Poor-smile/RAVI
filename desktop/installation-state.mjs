import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { atomicWriteFile } from "./atomic-file.mjs";

// Capture evidence before this launch creates its own document/settings files.
// The marker belongs to the native profile, not the temporary localhost origin.
export async function initializeInstallationState(directory, version) {
  const marker = path.join(directory, "installation-state.json");
  if (existsSync(marker)) return { firstLaunch: false };
  const existingInstallation = [
    "renderer-state.json", "document-session.json", "library-state.json",
    "ai-preferences.json", "reading-positions.json", "backup-preferences.json",
    "state-store", "vault",
  ].some(file => existsSync(path.join(directory, file)));
  await mkdir(directory, { recursive: true });
  await atomicWriteFile(marker, JSON.stringify({
    version: 1, firstSeenVersion: version, migrated: existingInstallation,
  }));
  return { firstLaunch: !existingInstallation };
}
