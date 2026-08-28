import assert from "node:assert/strict";
import test from "node:test";
import { canReuseAudioJobWithoutModel, latestAudioJobForSession } from "../app/audio/pipeline";
import type { AudioTranscriptionJob } from "../app/audio/types";

function job(id: string, phase: AudioTranscriptionJob["phase"], updatedAt: string): AudioTranscriptionJob {
  return {
    id,
    documentPath: "C:/docs/test.md",
    relativePath: "./test.assets/audio.mp3",
    fileName: "audio.mp3",
    durationMs: 60_000,
    tier: "accurate",
    phase,
    progress: phase === "complete" ? 1 : 0,
    currentChunk: phase === "complete" ? 1 : 0,
    totalChunks: 1,
    etaSeconds: phase === "complete" ? 0 : null,
    segments: phase === "complete" ? [{ id: "s1", startMs: 0, endMs: 1000, text: "سلام", confidence: 0.8, uncertain: false }] : [],
    error: "",
    updatedAt,
  };
}

test("a completed transcript is reused before asking for a model again", () => {
  const completed = job("done", "complete", "2026-08-25T10:00:00.000Z");
  const failedRetry = job("failed", "error", "2026-08-25T11:00:00.000Z");
  const latest = latestAudioJobForSession([completed, failedRetry], completed.relativePath);
  assert.equal(latest?.id, "done");
  assert.equal(canReuseAudioJobWithoutModel(latest), true);
  assert.equal(canReuseAudioJobWithoutModel(undefined), false);
});
