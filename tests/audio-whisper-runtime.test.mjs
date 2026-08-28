import assert from "node:assert/strict";
import path from "node:path";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import test from "node:test";
import {
  audioRuntimeRelativePath,
  findPreferredWhisperExecutable,
  resolveActiveAudioModelTier,
  whisperProgressFromOutput,
  whisperRuntimePaths,
} from "../desktop/audio-whisper-runtime.mjs";

test("whisper receives relative paths when the app data directory is Persian", () => {
  const dataRoot = path.resolve("C:/Users/test/AppData/Roaming/راوی/audio-local");
  const paths = whisperRuntimePaths(dataRoot, {
    modelPath: path.join(dataRoot, "models", "ggml-medium-q5_0.bin"),
    outputBase: path.join(dataRoot, "jobs", "job-123", "chunk-0"),
    wavPath: path.join(dataRoot, "jobs", "job-123", "source.wav"),
  });

  assert.equal(paths.modelPath, path.join("models", "ggml-medium-q5_0.bin"));
  assert.equal(paths.outputBase, path.join("jobs", "job-123", "chunk-0"));
  assert.equal(paths.wavPath, path.join("jobs", "job-123", "source.wav"));
  assert.doesNotMatch(Object.values(paths).join(" "), /راوی/u);
});

test("whisper runtime paths cannot escape the managed audio directory", () => {
  const dataRoot = path.resolve("C:/Users/test/AppData/Roaming/راوی/audio-local");
  assert.throws(
    () => audioRuntimeRelativePath(dataRoot, path.resolve(dataRoot, "..", "outside.wav")),
    /خارج از پوشه/u,
  );
});

test("whisper-cli is selected before deprecated main even when main is encountered first", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "raavi-whisper-choice-"));
  const release = path.join(root, "Release");
  await mkdir(release, { recursive: true });
  await writeFile(path.join(release, "main.exe"), "deprecated");
  await writeFile(path.join(release, "whisper-cli.exe"), "current");
  try {
    assert.equal(
      await findPreferredWhisperExecutable(root),
      path.join(release, "whisper-cli.exe"),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("whisper progress is parsed from streaming diagnostic output", () => {
  assert.equal(
    whisperProgressFromOutput("whisper_print_progress_callback: progress = 37%\r"),
    0.37,
  );
  assert.equal(
    whisperProgressFromOutput("progress = 10%\rprogress = 42%\r"),
    0.42,
  );
  assert.equal(whisperProgressFromOutput("loading model"), null);
});

test("an installed model is restored when the saved active tier is missing", () => {
  const tiers = [
    { id: "light", installed: false },
    { id: "balanced", installed: true },
    { id: "accurate", installed: true },
  ];
  assert.equal(resolveActiveAudioModelTier({ activeTier: null, runtimeReady: true, tiers }), "balanced");
  assert.equal(resolveActiveAudioModelTier({ activeTier: "accurate", runtimeReady: true, tiers }), "accurate");
  assert.equal(resolveActiveAudioModelTier({ activeTier: "accurate", runtimeReady: false, tiers }), null);
});
