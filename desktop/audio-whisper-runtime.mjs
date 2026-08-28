import path from "node:path";
import { access, readdir } from "node:fs/promises";

export const WHISPER_EXECUTABLE_NAMES = [
  "whisper-cli.exe",
  "whisper-cli",
  "main.exe",
  "main",
];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findNamedFile(root, fileName) {
  if (!(await exists(root))) return "";
  const entries = await readdir(root, { withFileTypes: true });
  const directMatch = entries.find(
    (entry) => entry.isFile() && entry.name.toLocaleLowerCase("en-US") === fileName,
  );
  if (directMatch) return path.join(root, directMatch.name);
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const found = await findNamedFile(path.join(root, entry.name), fileName);
    if (found) return found;
  }
  return "";
}

export async function findPreferredWhisperExecutable(root) {
  for (const fileName of WHISPER_EXECUTABLE_NAMES) {
    const found = await findNamedFile(root, fileName);
    if (found) return found;
  }
  return "";
}

export function whisperProgressFromOutput(value) {
  let latest = null;
  for (const match of String(value ?? "").matchAll(/progress\s*=\s*(\d{1,3})%/giu)) {
    latest = Math.max(0, Math.min(100, Number(match[1]))) / 100;
  }
  return latest;
}

export function audioRuntimeRelativePath(dataRoot, targetPath) {
  const relative = path.relative(path.resolve(dataRoot), path.resolve(targetPath));
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("مسیر فایل موتور صوتی خارج از پوشهٔ دادهٔ محلی است.");
  }
  return relative;
}

export function whisperRuntimePaths(dataRoot, { modelPath, outputBase, wavPath }) {
  return {
    modelPath: audioRuntimeRelativePath(dataRoot, modelPath),
    outputBase: audioRuntimeRelativePath(dataRoot, outputBase),
    wavPath: audioRuntimeRelativePath(dataRoot, wavPath),
  };
}

export function resolveActiveAudioModelTier({ activeTier, runtimeReady, tiers }) {
  if (!runtimeReady) return null;
  const installed = Array.isArray(tiers) ? tiers.filter((tier) => tier?.installed) : [];
  if (installed.some((tier) => tier.id === activeTier)) return activeTier;
  return installed[0]?.id ?? null;
}
