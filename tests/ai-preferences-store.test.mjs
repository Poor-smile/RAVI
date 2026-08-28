import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  clearStoredAiPreferences,
  readStoredAiPreferences,
  writeStoredAiPreferences,
} from "../desktop/ai-preferences-store.mjs";

test("selected ChatGPT model survives a fresh native-store read", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "raavi-ai-preferences-"));
  const filePath = path.join(directory, "ai-preferences.json");
  await writeStoredAiPreferences(filePath, { model: "  gpt-5.6-sol  " });
  assert.deepEqual(await readStoredAiPreferences(filePath), { model: "gpt-5.6-sol" });
});

test("native ChatGPT preferences migrate, sanitize and clear cleanly", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "raavi-ai-preferences-"));
  const filePath = path.join(directory, "ai-preferences.json");
  await writeStoredAiPreferences(filePath, {
    models: { codex: "gpt-5.3-codex\u0000" },
  });
  assert.deepEqual(await readStoredAiPreferences(filePath), { model: "gpt-5.3-codex" });
  await clearStoredAiPreferences(filePath);
  assert.equal(await readStoredAiPreferences(filePath), null);
});
