import { readFile, rename, rm, writeFile } from "node:fs/promises";

const MAX_MODEL_ID_LENGTH = 120;

function cleanModel(value) {
  return typeof value === "string"
    ? value.trim().slice(0, MAX_MODEL_ID_LENGTH).replace(/[\u0000-\u001f\u007f]/gu, "")
    : "";
}

export function sanitizeStoredAiPreferences(value) {
  const candidate = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
  return {
    model: cleanModel(candidate.model ?? candidate.models?.codex),
  };
}

export async function readStoredAiPreferences(filePath) {
  try {
    return sanitizeStoredAiPreferences(JSON.parse(await readFile(filePath, "utf8")));
  } catch {
    return null;
  }
}

export async function writeStoredAiPreferences(filePath, value) {
  const preferences = sanitizeStoredAiPreferences(value);
  const temporaryPath = `${filePath}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(preferences, null, 2), "utf8");
  try {
    await rename(temporaryPath, filePath);
  } catch {
    await writeFile(filePath, JSON.stringify(preferences, null, 2), "utf8");
    await rm(temporaryPath, { force: true });
  }
  return { saved: true, preferences };
}

export async function clearStoredAiPreferences(filePath) {
  await Promise.all([
    rm(filePath, { force: true }),
    rm(`${filePath}.tmp`, { force: true }),
  ]);
  return { cleared: true };
}
