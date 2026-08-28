import type { AudioTranscriptionJob } from "./types";

export function latestAudioJobForSession(
  jobs: readonly AudioTranscriptionJob[] | undefined,
  relativePath: string,
) {
  const matches = jobs
    ?.filter((candidate) => candidate.relativePath === relativePath)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const latest = matches?.[0];
  if (latest && ["error", "cancelled"].includes(latest.phase)) {
    return matches?.find((candidate) => candidate.phase === "complete" && candidate.segments.length > 0) ?? latest;
  }
  return latest;
}

export function canReuseAudioJobWithoutModel(job: AudioTranscriptionJob | undefined) {
  return Boolean(job && job.phase === "complete" && job.segments.length > 0);
}
