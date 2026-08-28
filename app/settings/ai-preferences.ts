export type AiPreferences = {
  model: string;
};

export const AI_PREFERENCES_STORAGE_KEY = "raavi:ai-preferences:v1";

export const DEFAULT_AI_PREFERENCES: AiPreferences = {
  model: "",
};

const MAX_MODEL_ID_LENGTH = 120;

function cleanModelId(value: unknown) {
  return typeof value === "string"
    ? value.trim().slice(0, MAX_MODEL_ID_LENGTH).replace(/[\u0000-\u001f\u007f]/gu, "")
    : "";
}

export function parseAiPreferences(
  value: string | null | undefined,
): AiPreferences {
  let candidate: unknown = null;
  try {
    candidate = value ? JSON.parse(value) : null;
  } catch {
    candidate = null;
  }
  const parsed = candidate && typeof candidate === "object"
    ? candidate as { model?: unknown; models?: { codex?: unknown } }
    : {};
  return {
    model: cleanModelId(parsed.model ?? parsed.models?.codex),
  };
}
